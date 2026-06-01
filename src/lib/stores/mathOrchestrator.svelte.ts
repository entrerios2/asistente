/**
 * MathOrchestrator: Centralized DSP pipeline for all active Quadrants.
 * Calculates FFT, Transfer Function, Phase, Coherence, Impulse Response, Step Response, and Group Delay.
 * Shares results to avoid redundant calculations and implements adaptive throttling.
 */

import { traceManager, type Trace } from './traceManager.svelte';
import { uiStore } from './ui.svelte';
import { meterStore } from './meterStore.svelte';
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

    // Shared calculation buffers (for fallback synchronous execution)
    fftInputReal = new Float32Array(this.BINS);
    fftInputImag = new Float32Array(this.BINS);
    fftRefReal = new Float32Array(this.BINS);
    fftRefImag = new Float32Array(this.BINS);
    hReal = new Float32Array(this.BINS);
    hImag = new Float32Array(this.BINS);

    tempFullReal = new Float32Array(this.FFT_SIZE);
    tempFullImag = new Float32Array(this.FFT_SIZE);
    tempPhaseRadians = new Float32Array(this.BINS);

    // Shared output buffers
    outputMagnitude = $state(new Float32Array(this.BINS));
    outputPhase = $state(new Float32Array(this.BINS));
    outputCoherence = $state(new Float32Array(this.BINS));
    outputGroupDelay = $state(new Float32Array(this.BINS));
    outputImpulse = $state(new Float32Array(this.FFT_SIZE));
    outputStep = $state(new Float32Array(this.FFT_SIZE));

    // Cache for EQ response
    eqResponseCache = new Float32Array(this.BINS);
    private lastBandsHash = 0;
    private lastMeasuring = false;
    private lastSimulating = false;

    // Worker & autonomous timer
    private worker: Worker | null = null;
    private timerId: any = null;

    constructor() {
        this.updateEQCache();

        if (typeof window !== 'undefined') {
            try {
                // Initialize Web Worker with Vite URL loader
                this.worker = new Worker(
                    new URL('../dsp/dspWorker.ts', import.meta.url),
                    { type: 'module' }
                );
                this.worker.onmessage = (event) => {
                    this.handleWorkerMessage(event.data);
                };
            } catch (e) {
                console.error('[MathOrchestrator] Error initializing dspWorker:', e);
            }
        }

        $effect.root(() => {
            $effect(() => {
                this.reallocateBuffers(uiStore.fftSize);
            });
            $effect(() => {
                this.startTimer(uiStore.dspUpdateRate);
            });
        });
    }

    private startTimer(rate: number) {
        if (this.timerId) {
            clearInterval(this.timerId);
        }
        const intervalMs = 1000 / rate;
        this.timerId = setInterval(() => {
            const liveTrace = traceManager.traces.find((t) => t.id === "live-1");
            this.run(liveTrace);
        }, intervalMs);
    }

    private handleWorkerMessage(data: any) {
        if (data.type === 'dsp-results') {
            this.outputMagnitude = new Float32Array(data.outputMagnitude);
            this.outputPhase = new Float32Array(data.outputPhase);
            this.outputCoherence = new Float32Array(data.outputCoherence);
            this.outputGroupDelay = new Float32Array(data.outputGroupDelay);
            this.outputImpulse = new Float32Array(data.outputImpulse);
            this.outputStep = new Float32Array(data.outputStep);
            
            meterStore.updateIn([data.dbIn, data.dbIn]);
            
            this.version++;
        }
    }

    registerQuadrantMetrics(id: string, metrics: string[]) {
        this.activeMetricsByQuadrant[id] = metrics;
    }

    unregisterQuadrant(id: string) {
        delete this.activeMetricsByQuadrant[id];
    }

    globalActiveMetrics = $derived.by(() => {
        const active = new Set<string>();
        for (const id in this.activeMetricsByQuadrant) {
            for (const metric of this.activeMetricsByQuadrant[id]) {
                active.add(metric);
            }
        }
        return active;
    });

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

    get throttleMs(): number {
        return 1000 / uiStore.dspUpdateRate;
    }

    private checkDirty() {
        let bandsHash = 0;
        for (let b = 0; b < traceManager.eqBands.length; b++) {
            const band = traceManager.eqBands[b];
            bandsHash += band.freq * 1e6 + band.gain * 1e3 + band.q;
        }
        const measuring = uiStore.isMeasuring;
        const simulating = uiStore.isSimulating;

        if (bandsHash !== this.lastBandsHash || measuring !== this.lastMeasuring || simulating !== this.lastSimulating) {
            this.lastBandsHash = bandsHash;
            this.lastMeasuring = measuring;
            this.lastSimulating = simulating;
            this.dirty = true;
            this.updateEQCache();
        }
    }

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

    run(liveTrace: Trace | undefined) {
        this.checkDirty();

        const isMeasuring = uiStore.isMeasuring;

        // If not measuring and not dirty, skip calculation
        if (!isMeasuring && !this.dirty) {
            return;
        }

        this.lastMathTime = performance.now();

        if (this.worker) {
            // Web Worker asynchronous calculation (main path)
            const liveData = liveTrace && liveTrace.data && liveTrace.data.length > 0 ? liveTrace.data : null;
            let liveDataTransfer: ArrayBuffer | undefined = undefined;
            if (liveData) {
                const copy = new Float32Array(liveData);
                liveDataTransfer = copy.buffer;
            }

            this.worker.postMessage({
                type: 'run-dsp',
                liveData: liveDataTransfer,
                BINS: this.BINS,
                FFT_SIZE: this.FFT_SIZE,
                eqResponseCache: this.eqResponseCache,
                eqBands: $state.snapshot(traceManager.eqBands),
                isMeasuring,
                metrics: Array.from(this.globalActiveMetrics)
            }, liveDataTransfer ? [liveDataTransfer] : []);

            if (this.dirty) {
                this.dirty = false;
            }
            return;
        }

        // Fallback synchronous calculations inside Main Thread (SSR or Worker fail)
        for (let k = 0; k < this.BINS; k++) {
            const f_k = k * (24000 / this.BINS) || 1e-6;

            const refDb = -50 + Math.sin(k * 0.05) * 0.5;
            const refMag = Math.pow(10, refDb / 20);
            const refPhase = 0;

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

        let peakSum = 0;
        for (let k = 0; k < this.BINS; k++) {
            const mag = Math.sqrt(this.fftInputReal[k] * this.fftInputReal[k] + this.fftInputImag[k] * this.fftInputImag[k]);
            if (mag > peakSum) peakSum = mag;
        }
        const dbIn = 20 * Math.log10(peakSum || 1e-6);

        meterStore.updateIn([dbIn, dbIn]);

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

        this.version++;

        if (this.dirty) {
            this.dirty = false;
        }
    }
}

export const mathOrchestrator = new MathOrchestrator();
