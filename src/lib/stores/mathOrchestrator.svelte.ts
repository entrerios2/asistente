/**
 * MathOrchestrator: Centralized DSP pipeline for all active Quadrants.
 * Calculates FFT, Transfer Function, Phase, Coherence, Impulse Response, Step Response, and Group Delay.
 * Shares results to avoid redundant calculations and implements adaptive throttling.
 */

import { traceManager, type Trace } from './traceManager.svelte';
import { uiStore } from './ui.svelte';
import {
    calculateMagnitude,
    calculatePhase,
    calculateImpulseResponse,
    calculateStepResponse,
    calculateGroupDelay,
} from '../dsp/osmMetrics';

const BINS = 4096;
const FFT_SIZE = 8192;

class MathOrchestrator {
    // Reactive version to notify subscribers of new calculations
    version = $state(0);
    dirty = $state(true);
    lastMathTime = 0;

    // Shared calculation buffers
    fftInputReal = new Float32Array(BINS);
    fftInputImag = new Float32Array(BINS);
    fftRefReal = new Float32Array(BINS);
    fftRefImag = new Float32Array(BINS);
    hReal = new Float32Array(BINS);
    hImag = new Float32Array(BINS);

    tempFullReal = new Float32Array(FFT_SIZE);
    tempFullImag = new Float32Array(FFT_SIZE);

    // Shared output buffers
    outputMagnitude = new Float32Array(BINS);
    outputPhase = new Float32Array(BINS);
    outputCoherence = new Float32Array(BINS);
    outputGroupDelay = new Float32Array(BINS);
    outputImpulse = new Float32Array(FFT_SIZE);
    outputStep = new Float32Array(FFT_SIZE);
    tempPhaseRadians = new Float32Array(BINS);

    // Cache for EQ response
    eqResponseCache = new Float32Array(BINS);
    private lastBandsStr = "";
    private lastMeasuring = false;
    private lastSimulating = false;

    constructor() {
        this.updateEQCache();
    }

    /**
     * Dynamically calculates the throttle interval based on the active layout grid.
     */
    get throttleMs(): number {
        switch (uiStore.layout) {
            case '1x1': return 100; // 10 FPS
            case '1x2':
            case '2x1': return 142; // ~7 FPS
            case '2x2': return 200; // 5 FPS
            default: return 333;    // 3 FPS (3x2, etc.)
        }
    }

    /**
     * Checks if any parameters have changed to trigger an immediate recalculation.
     */
    private checkDirty() {
        const bandsStr = JSON.stringify(traceManager.eqBands);
        const measuring = uiStore.isMeasuring;
        const simulating = uiStore.isSimulating;

        if (bandsStr !== this.lastBandsStr || measuring !== this.lastMeasuring || simulating !== this.lastSimulating) {
            this.lastBandsStr = bandsStr;
            this.lastMeasuring = measuring;
            this.lastSimulating = simulating;
            this.dirty = true;
            this.updateEQCache();
        }
    }

    /**
     * Precomputes the EQ response curve.
     */
    private updateEQCache() {
        const sr = 48000;
        for (let i = 0; i < BINS; i++) {
            const freq = (i * sr) / 2 / BINS;
            let totalGain = 0;
            for (let b = 0; b < traceManager.eqBands.length; b++) {
                const band = traceManager.eqBands[b];
                const fo = band.freq;
                const G = band.gain;
                const Q = band.q;

                const bw = fo / Q;
                const dist = Math.abs(Math.log2(freq / fo || 1e-6));
                const octBw = bw / fo;
                const weight = Math.exp(-Math.pow(dist / (octBw * 1.2), 2));
                totalGain += G * weight;
            }
            this.eqResponseCache[i] = totalGain;
        }
    }

    getEQResponseCached(f: number): number {
        const binWidth = 24000 / BINS;
        const idx = Math.round(f / binWidth);
        if (idx < 0) return this.eqResponseCache[0];
        if (idx >= BINS) return this.eqResponseCache[BINS - 1];
        return this.eqResponseCache[idx];
    }

    private getPhaseValueRadians(freq: number, isMeasuring: boolean): number {
        const delayMs = 1.4;
        let phase = -2 * Math.PI * freq * (delayMs / 1000);

        for (let b = 0; b < traceManager.eqBands.length; b++) {
            const band = traceManager.eqBands[b];
            const dist = Math.log2(freq / band.freq || 1e-6);
            const weight = dist / (1 + dist * dist * band.q);
            phase += band.gain * 0.04 * weight;
        }
        if (isMeasuring) {
            phase += (Math.random() - 0.5) * 0.04;
        }
        return phase;
    }

    private getCoherenceValue(freq: number, isMeasuring: boolean): number {
        let coh = 0.98;
        if (freq < 45) coh -= 0.35 * (1 - freq / 45);
        if (freq > 16000) coh -= (0.12 * (freq - 16000)) / 4000;

        for (let b = 0; b < traceManager.eqBands.length; b++) {
            const band = traceManager.eqBands[b];
            if (band.gain < -5) {
                const dist = Math.abs(Math.log2(freq / band.freq));
                if (dist < 0.25) coh -= 0.18 * (1 - dist / 0.25);
            }
        }
        if (isMeasuring) {
            coh += (Math.random() - 0.5) * 0.015;
        }
        return Math.max(0.01, Math.min(1, coh));
    }

    /**
     * Runs the centralized math pipeline.
     */
    run(liveTrace: Trace | undefined) {
        this.checkDirty();

        const now = performance.now();
        const isMeasuring = uiStore.isMeasuring;

        // If not measuring and not dirty, skip calculation
        if (!isMeasuring && !this.dirty) {
            return;
        }

        // Apply adaptive throttling when measuring and not forced (dirty)
        if (isMeasuring && !this.dirty) {
            if (now - this.lastMathTime < this.throttleMs) {
                return;
            }
        }

        this.lastMathTime = now;

        for (let k = 0; k < BINS; k++) {
            const f_k = k * (24000 / BINS) || 1e-6;

            // Simulated pink noise reference
            const refDb = -50 + Math.sin(k * 0.05) * 0.5;
            const refMag = Math.pow(10, refDb / 20);
            const refPhase = 0;

            // Measurement
            let liveDb = -50;
            if (liveTrace && liveTrace.data && liveTrace.data.length > 0) {
                const mapIdx = Math.floor((k * liveTrace.data.length) / BINS);
                liveDb = liveTrace.data[mapIdx] || -120;
            } else {
                liveDb = -50 + this.getEQResponseCached(f_k) + Math.sin(k * 0.08) * 0.3;
            }

            const liveMag = Math.pow(10, liveDb / 20);
            const phaseTotal = this.getPhaseValueRadians(f_k, isMeasuring) + refPhase;

            this.fftInputReal[k] = liveMag * Math.cos(phaseTotal);
            this.fftInputImag[k] = liveMag * Math.sin(phaseTotal);
            this.fftRefReal[k] = refMag * Math.cos(refPhase);
            this.fftRefImag[k] = refMag * Math.sin(refPhase);

            this.outputCoherence[k] = this.getCoherenceValue(f_k, isMeasuring);
        }

        // 1. Magnitude
        calculateMagnitude(
            this.fftInputReal,
            this.fftInputImag,
            this.fftRefReal,
            this.fftRefImag,
            this.outputMagnitude,
            this.hReal,
            this.hImag,
        );

        // 2. Phase
        calculatePhase(
            this.fftInputReal,
            this.fftInputImag,
            this.fftRefReal,
            this.fftRefImag,
            this.outputPhase,
        );

        // 3. Impulse Response (IFFT)
        calculateImpulseResponse(
            this.hReal,
            this.hImag,
            this.outputImpulse,
            this.tempFullReal,
            this.tempFullImag,
        );

        // 4. Step Response (integral)
        calculateStepResponse(this.outputImpulse, this.outputStep);

        // 5. Group Delay (derivative of phase)
        for (let k = 0; k < BINS; k++) {
            this.tempPhaseRadians[k] = (this.outputPhase[k] * Math.PI) / 180;
        }
        calculateGroupDelay(this.tempPhaseRadians, 24000 / BINS, this.outputGroupDelay);

        // Increment version to notify subscribers
        this.version++;

        // Reset dirty flag after successful run
        if (this.dirty) {
            this.dirty = false;
        }
    }
}

export const mathOrchestrator = new MathOrchestrator();
