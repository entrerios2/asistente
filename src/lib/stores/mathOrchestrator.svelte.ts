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

class MathOrchestrator {
    // Reactive version to notify subscribers of new calculations
    version = $state(0);
    dirty = $state(true);
    lastMathTime = 0;

    activeMetricsByQuadrant = $state<Record<string, string[]>>({});
    private BINS = 4096;
    private FFT_SIZE = 8192;

    // Shared calculation buffers
    fftInputReal = new Float32Array(this.BINS);
    fftInputImag = new Float32Array(this.BINS);
    fftRefReal = new Float32Array(this.BINS);
    fftRefImag = new Float32Array(this.BINS);
    hReal = new Float32Array(this.BINS);
    hImag = new Float32Array(this.BINS);

    tempFullReal = new Float32Array(this.FFT_SIZE);
    tempFullImag = new Float32Array(this.FFT_SIZE);

    // Shared output buffers
    outputMagnitude = new Float32Array(this.BINS);
    outputPhase = new Float32Array(this.BINS);
    outputCoherence = new Float32Array(this.BINS);
    outputGroupDelay = new Float32Array(this.BINS);
    outputImpulse = new Float32Array(this.FFT_SIZE);
    outputStep = new Float32Array(this.FFT_SIZE);
    tempPhaseRadians = new Float32Array(this.BINS);

    // Cache for EQ response
    eqResponseCache = new Float32Array(this.BINS);
    private lastBandsStr = "";
    private lastMeasuring = false;
    private lastSimulating = false;

    constructor() {
        this.updateEQCache();
        $effect.root(() => {
            $effect(() => {
                this.reallocateBuffers(uiStore.fftSize);
            });
        });
    }

    registerQuadrantMetrics(id: string, metrics: string[]) {
        this.activeMetricsByQuadrant[id] = metrics;
    }

    unregisterQuadrant(id: string) {
        delete this.activeMetricsByQuadrant[id];
    }

    get globalActiveMetrics(): Set<string> {
        const active = new Set<string>();
        for (const id in this.activeMetricsByQuadrant) {
            for (const metric of this.activeMetricsByQuadrant[id]) {
                active.add(metric);
            }
        }
        return active;
    }

    reallocateBuffers(newFftSize: number) {
        this.FFT_SIZE = newFftSize;
        this.BINS = newFftSize / 2;

        this.fftInputReal = new Float32Array(this.BINS);
        this.fftInputImag = new Float32Array(this.BINS);
        this.fftRefReal = new Float32Array(this.BINS);
        this.fftRefImag = new Float32Array(this.BINS);
        this.hReal = new Float32Array(this.BINS);
        this.hImag = new Float32Array(this.BINS);

        this.tempFullReal = new Float32Array(this.FFT_SIZE);
        this.tempFullImag = new Float32Array(this.FFT_SIZE);

        this.outputMagnitude = new Float32Array(this.BINS);
        this.outputPhase = new Float32Array(this.BINS);
        this.outputCoherence = new Float32Array(this.BINS);
        this.outputGroupDelay = new Float32Array(this.BINS);
        this.outputImpulse = new Float32Array(this.FFT_SIZE);
        this.outputStep = new Float32Array(this.FFT_SIZE);
        this.tempPhaseRadians = new Float32Array(this.BINS);

        this.eqResponseCache = new Float32Array(this.BINS);
        this.updateEQCache();
        this.dirty = true;
    }

    /**
     * Dynamically calculates the throttle interval based on the active layout grid.
     */
    get throttleMs(): number {
        return 1000 / uiStore.dspUpdateRate;
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
        for (let i = 0; i < this.BINS; i++) {
            const freq = (i * sr) / 2 / this.BINS;
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
        const binWidth = 24000 / this.BINS;
        const idx = Math.round(f / binWidth);
        if (idx < 0) return this.eqResponseCache[0];
        if (idx >= this.BINS) return this.eqResponseCache[this.BINS - 1];
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

        for (let k = 0; k < this.BINS; k++) {
            const f_k = k * (24000 / this.BINS) || 1e-6;

            // Simulated pink noise reference
            const refDb = -50 + Math.sin(k * 0.05) * 0.5;
            const refMag = Math.pow(10, refDb / 20);
            const refPhase = 0;

            // Measurement
            let liveDb = -50;
            if (liveTrace && liveTrace.data && liveTrace.data.length > 0) {
                const mapIdx = Math.floor((k * liveTrace.data.length) / this.BINS);
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

        const metrics = this.globalActiveMetrics;
        const needMagnitude = metrics.has("Magnitude") || metrics.has("Spectrum") || metrics.has("Spectrogram") || metrics.has("Impulse") || metrics.has("Step");
        const needPhase = metrics.has("Phase") || metrics.has("Group Delay");
        const needImpulse = metrics.has("Impulse") || metrics.has("Step");

        if (needMagnitude) {
            calculateMagnitude(
                this.fftInputReal,
                this.fftInputImag,
                this.fftRefReal,
                this.fftRefImag,
                this.outputMagnitude,
                this.hReal,
                this.hImag,
            );
        }
        if (needPhase) {
            calculatePhase(
                this.fftInputReal,
                this.fftInputImag,
                this.fftRefReal,
                this.fftRefImag,
                this.outputPhase,
            );
        }
        if (needImpulse) {
            calculateImpulseResponse(
                this.hReal,
                this.hImag,
                this.outputImpulse,
                this.tempFullReal,
                this.tempFullImag,
            );
        }
        if (metrics.has("Step")) {
            calculateStepResponse(this.outputImpulse, this.outputStep);
        }
        if (metrics.has("Group Delay")) {
            for (let k = 0; k < this.BINS; k++) {
                this.tempPhaseRadians[k] = (this.outputPhase[k] * Math.PI) / 180;
            }
            calculateGroupDelay(this.tempPhaseRadians, 24000 / this.BINS, this.outputGroupDelay);
        }

        // Increment version to notify subscribers
        this.version++;

        // Reset dirty flag after successful run
        if (this.dirty) {
            this.dirty = false;
        }
    }
}

export const mathOrchestrator = new MathOrchestrator();
