/**
 * MathOrchestrator: Centralized DSP pipeline for all active Quadrants.
 * Calculates FFT, Transfer Function, Phase, Coherence, Impulse Response, Step Response, and Group Delay.
 * Shares results to avoid redundant calculations and implements adaptive throttling.
 */

import { untrack } from 'svelte';
import { traceManager } from './traceManager.svelte';
import { uiStore } from './ui.svelte';
import { meterStore } from './meterStore.svelte';
import { calibrationStore } from './calibrationStore.svelte';
import { getCoeffsForType, biquadResponse } from '../dsp/biquad';
import {
    calculateMagnitude,
    calculatePhase,
    calculateStepResponse,
    calculateGroupDelay,
} from '../dsp/osmMetrics';
import { applySourceWindow } from '../dsp/sourceWindowing';
import { WindowFunction } from '../dsp/windowFunction';
import { getWeightingGain } from '../dsp/weighting';
import { ComplexAveraging } from '../dsp/averaging';
import { deconvolve } from '../dsp/deconvolution';

class MathOrchestrator {
    // Reactive version to notify subscribers of new calculations
    version = $state(0);
    dirty = $state(true);
    lastMathTime = 0;

    activeMetricsByQuadrant = $state<Record<string, string[]>>({});
    BINS = 4096;
    private FFT_SIZE = 8192;



    // Shared calculation buffers (for fallback synchronous execution)
    fftInputReal = new Float32Array(this.BINS);
    fftInputImag = new Float32Array(this.BINS);
    fftRefReal = new Float32Array(this.BINS);
    fftRefImag = new Float32Array(this.BINS);
    hReal = new Float32Array(this.BINS);
    hImag = new Float32Array(this.BINS);

    // Private processors for synchronous fallback
    private averagingProcessor: ComplexAveraging | null = null;
    private avgInputReal = new Float32Array(this.BINS);
    private avgInputImag = new Float32Array(this.BINS);
    private windowProcessor = new WindowFunction();

    tempFullReal = new Float32Array(this.FFT_SIZE);
    tempFullImag = new Float32Array(this.FFT_SIZE);
    tempFullRealOut = new Float32Array(this.FFT_SIZE);
    tempFullImagOut = new Float32Array(this.FFT_SIZE);
    tempPhaseRadians = new Float32Array(this.BINS);

    // Shared output buffers
    outputMagnitude = $state.raw(new Float32Array(this.BINS));
    outputPhase = $state.raw(new Float32Array(this.BINS));
    outputCoherence = $state.raw(new Float32Array(this.BINS));
    outputGroupDelay = $state.raw(new Float32Array(this.BINS));
    outputImpulse = $state.raw(new Float32Array(this.FFT_SIZE));
    outputStep = $state.raw(new Float32Array(this.FFT_SIZE));
    outputCrestFactor = $state.raw(new Float32Array(this.BINS));

    // Cache for EQ response
    eqResponseCache = new Float32Array(this.BINS);
    private lastBandsHash = 0;
    private lastMeasuring = false;
    private lastSimulating = false;

    // Worker & autonomous timer
    private worker: Worker | null = null;
    private timerId: any = null;

    constructor() {
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
                const fftSize = uiStore.fftSize;
                untrack(() => this.reallocateBuffers(fftSize));
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
            this.outputMagnitude.set(new Float32Array(data.outputMagnitude));
            this.outputPhase.set(new Float32Array(data.outputPhase));
            this.outputCoherence.set(new Float32Array(data.outputCoherence));
            this.outputGroupDelay.set(new Float32Array(data.outputGroupDelay));
            this.outputImpulse.set(new Float32Array(data.outputImpulse));
            this.outputStep.set(new Float32Array(data.outputStep));
            if (data.outputCrestFactor) {
                this.outputCrestFactor.set(new Float32Array(data.outputCrestFactor));
            }
            
            // PROPAGAR VÚMETROS DINÁMICAMENTE CONFORME A LOS CANALES ACTIVOS (PROMPT 7)
            const inChCount = uiStore.inChannels.filter(Boolean).length || 2;
            const outChCount = uiStore.outChannels.filter(Boolean).length || 2;
            meterStore.updateIn(Array.from({ length: inChCount }, () => data.dbIn));
            meterStore.updateOut(Array.from({ length: outChCount }, () => data.dbIn));
            
            // ESCRIBIR EN LA CAPA ACTIVA BAJO MEDICIÓN (PROMPT 6)
            const activeLayer = traceManager.layers.find(l => l.isMeasuring && l.id === uiStore.activeLayerId);
            if (activeLayer) {
                const qMetrics = this.activeMetricsByQuadrant[activeLayer.quadrantId] || ["Magnitude"];
                const mainMetric = qMetrics.find(m => ["Magnitude", "Phase", "Coherence", "Spectrum", "Group Delay"].includes(m)) || "Magnitude";
                
                let sourceBuffer = this.outputMagnitude;
                if (mainMetric === "Phase") sourceBuffer = this.outputPhase;
                else if (mainMetric === "Coherence") sourceBuffer = this.outputCoherence;
                else if (mainMetric === "Group Delay") sourceBuffer = this.outputGroupDelay;

                if (activeLayer.data.length !== sourceBuffer.length) {
                    activeLayer.data = new Float32Array(sourceBuffer.length);
                }
                activeLayer.data.set(sourceBuffer);
            }

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
        // Guard: skip if size hasn't changed and buffers are already allocated
        if (newFftSize === this.FFT_SIZE && this.outputMagnitude.length === newFftSize / 2) {
            return;
        }
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
        this.tempFullRealOut = new Float32Array(this.FFT_SIZE);
        this.tempFullImagOut = new Float32Array(this.FFT_SIZE);

        this.outputMagnitude = new Float32Array(this.BINS);
        this.outputPhase = new Float32Array(this.BINS);
        this.outputCoherence = new Float32Array(this.BINS);
        this.outputGroupDelay = new Float32Array(this.BINS);
        this.outputImpulse = new Float32Array(this.FFT_SIZE);
        this.outputStep = new Float32Array(this.FFT_SIZE);
        this.tempPhaseRadians = new Float32Array(this.BINS);
        this.outputCrestFactor = new Float32Array(this.BINS);

        this.avgInputReal = new Float32Array(this.BINS);
        this.avgInputImag = new Float32Array(this.BINS);
        this.averagingProcessor = new ComplexAveraging(this.BINS, uiStore.averagingDepth || 16);

        this.eqResponseCache = new Float32Array(this.BINS);
        this.updateEQCache();
        this.dirty = true;
    }

    get throttleMs(): number {
        return 1000 / uiStore.dspUpdateRate;
    }

    private checkDirty() {
        try {
            if (typeof traceManager === 'undefined' || !traceManager || !traceManager.eqBands) {
                return;
            }
            let bandsHash = 0;
            for (let b = 0; b < traceManager.eqBands.length; b++) {
                const band = traceManager.eqBands[b];
                bandsHash += band.freq * 1e6 + band.gain * 1e3 + band.q + (band.type ? band.type.charCodeAt(0) * 100 : 0);
            }
            // Incluir sugerencias de calibración para refrescar el caché de EQ
            for (const filter of calibrationStore.suggestedFilters) {
                bandsHash += filter.frequency * 1e6 + filter.gain * 1e3 + filter.q + (filter.enabled ? 1 : 0) + (filter.type ? filter.type.charCodeAt(0) * 100 : 0);
            }

            const measuring = uiStore.isMeasuring;
            const simulating = uiStore.isSimulating;

            // EQ-only change: just update cache. The canvas render loop already runs
            // at 60fps via requestAnimationFrame and reads getEQResponseCached() directly.
            // Do NOT set dirty=true or version++ — dirty triggers the full DSP pipeline,
            // and version++ triggers interpolation reset (causing magnitude to "fall from 0dB").
            if (bandsHash !== this.lastBandsHash) {
                this.lastBandsHash = bandsHash;
                this.updateEQCache();
            }

            // State changes that require full DSP reprocessing
            if (measuring !== this.lastMeasuring || simulating !== this.lastSimulating) {
                this.lastMeasuring = measuring;
                this.lastSimulating = simulating;
                this.dirty = true;
            }
        } catch (e) {
            // Ignorar ReferenceError temporal durante la carga ESM
        }
    }

    private updateEQCache() {
        try {
            if (typeof traceManager === 'undefined' || !traceManager || !traceManager.eqBands) {
                return;
            }
            const sr = 48000;
            const nyquist = sr / 2;

            // 1. Precompute coefficients ONCE per band (avoids recalculating sin/cos 4096× per band)
            const bandCoeffs: number[][] = [];
            for (let b = 0; b < traceManager.eqBands.length; b++) {
                const band = traceManager.eqBands[b];
                if (band.gain !== 0 || !['peaking', 'low_shelf', 'high_shelf'].includes(band.type)) {
                    bandCoeffs.push(getCoeffsForType(band.type, band.freq, band.gain, band.q, sr));
                }
            }

            // Precompute calibration filter coefficients
            const calCoeffs: number[][] = [];
            for (const filter of calibrationStore.suggestedFilters) {
                if (filter.enabled) {
                    calCoeffs.push(getCoeffsForType(
                        filter.type || 'peaking', filter.frequency, filter.gain, filter.q, sr
                    ));
                }
            }

            const TWO_PI = 2 * Math.PI;
            const invBins = nyquist / this.BINS;

            // 2. Single pass over bins, evaluating all precomputed filters
            for (let i = 0; i < this.BINS; i++) {
                const freq = i * invBins || 1e-6;
                const w = TWO_PI * freq / sr;
                const cosW = Math.cos(w);
                const sinW = Math.sin(w);
                const cos2W = 2 * cosW * cosW - 1;  // cos(2w) = 2cos²(w) - 1 (avoids extra trig)
                const sin2W = 2 * sinW * cosW;       // sin(2w) = 2sin(w)cos(w)

                let totalGain = 0;

                // Evaluate each EQ band
                for (let b = 0; b < bandCoeffs.length; b++) {
                    const c = bandCoeffs[b];
                    const nR = c[0] + c[1] * cosW + c[2] * cos2W;
                    const nI = -(c[1] * sinW + c[2] * sin2W);
                    const dR = c[3] + c[4] * cosW + c[5] * cos2W;
                    const dI = -(c[4] * sinW + c[5] * sin2W);
                    totalGain += 10 * Math.log10((nR * nR + nI * nI) / (dR * dR + dI * dI + 1e-20));
                }

                // Evaluate each calibration filter
                for (let c2 = 0; c2 < calCoeffs.length; c2++) {
                    const c = calCoeffs[c2];
                    const nR = c[0] + c[1] * cosW + c[2] * cos2W;
                    const nI = -(c[1] * sinW + c[2] * sin2W);
                    const dR = c[3] + c[4] * cosW + c[5] * cos2W;
                    const dI = -(c[4] * sinW + c[5] * sin2W);
                    totalGain += 10 * Math.log10((nR * nR + nI * nI) / (dR * dR + dI * dI + 1e-20));
                }

                this.eqResponseCache[i] = totalGain;
            }
        } catch (e) {
            // Ignorar ReferenceError temporal durante la carga ESM
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

        // Evaluar analíticamente la fase de las bandas de EQ (Playground) con biquads (Prompt 7)
        for (let b = 0; b < traceManager.eqBands.length; b++) {
            const band = traceManager.eqBands[b];
            if (band.gain !== 0 || !['peaking', 'low_shelf', 'high_shelf'].includes(band.type)) {
                const coeffs = getCoeffsForType(band.type, band.freq, band.gain, band.q, 48000);
                const [_, phaseRad] = biquadResponse(coeffs, freq, 48000);
                phase += phaseRad;
            }
        }

        // Evaluar analíticamente la fase de los filtros de calibrationStore (Prompt 7)
        phase += calibrationStore.getFilterPhaseAt(freq);

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

    run(liveTrace: any | undefined) {
        this.checkDirty();

        const isMeasuring = uiStore.isMeasuring;

        // If not measuring and not dirty, skip calculation
        if (!isMeasuring && !this.dirty) {
            return;
        }

        this.lastMathTime = performance.now();

        // Obtener la referencia de datos de entrada directa (Prompt 8/Fix)
        let liveData: Float32Array | null = null;
        if (liveTrace) {
            if (liveTrace instanceof Float32Array) {
                liveData = liveTrace;
            } else if (liveTrace.data) {
                liveData = liveTrace.data;
            }
        }

        if (this.worker) {
            // Web Worker asynchronous calculation (main path)
            let liveDataTransfer: ArrayBuffer | undefined = undefined;
            if (liveData && liveData.length > 0) {
                const copy = new Float32Array(liveData);
                liveDataTransfer = copy.buffer;
            }

            this.worker.postMessage({
                type: 'run-dsp',
                liveData: liveDataTransfer,
                BINS: this.BINS,
                FFT_SIZE: this.FFT_SIZE,
                eqResponseCache: this.eqResponseCache,
                eqBands: [],  // EQ must NOT enter measurement pipeline — it's visualization only
                calibrationFilters: $state.snapshot(calibrationStore.suggestedFilters),
                calibrationPoints: $state.snapshot(calibrationStore.calibrationPoints),
                inputGain: uiStore.inputGain,
                displayOffset: uiStore.displayOffset,
                isMeasuring,
                metrics: Array.from(this.globalActiveMetrics),
                weightingType: uiStore.weightingType,
                averagingType: uiStore.averagingType,
                averagingDepth: uiStore.averagingDepth,
                averagingAlpha: uiStore.averagingAlpha,
                windowType: uiStore.windowType,
                enableSourceWindow: uiStore.enableSourceWindow,
                sourceWindowWidthMs: uiStore.sourceWindowWidthMs,
                sourceWindowOffsetMs: uiStore.sourceWindowOffsetMs,
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
            if (liveData && liveData.length > 0) {
                const mapIdx = Math.floor((k * liveData.length) / this.BINS);
                liveDb = liveData[mapIdx] || -120;

                // 1. Aplicar ganancia de entrada
                liveDb += uiStore.inputGain;

                // 2. Compensar curva de calibración acústica
                liveDb -= calibrationStore.getCalibrationGainAt(f_k);

                // 3. Aplicar ponderación de frecuencia ANSI (A, B, C, Z) (Prompt 9)
                liveDb += getWeightingGain(f_k, uiStore.weightingType || 'Z');

                // 4. Aplicar offset absoluto de visualización
                liveDb += uiStore.displayOffset;
            } else {
                const binWidth = 24000 / this.BINS;
                const idx = Math.max(0, Math.min(this.BINS - 1, Math.round(f_k / binWidth)));
                const eqGain = this.eqResponseCache[idx] || 0;
                liveDb = -50 + eqGain + Math.sin(k * 0.08) * 0.3;

                // Aplicar ponderación también a la simulación si está calibrada
                liveDb += getWeightingGain(f_k, uiStore.weightingType || 'Z');
                liveDb += uiStore.displayOffset;
            }

            const liveMag = Math.pow(10, liveDb / 20);
            const phaseTotal = this.getPhaseValueRadians(f_k, isMeasuring) + refPhase;

            this.fftInputReal[k] = liveMag * Math.cos(phaseTotal);
            this.fftInputImag[k] = liveMag * Math.sin(phaseTotal);
            this.fftRefReal[k] = refMag * Math.cos(refPhase);
            this.fftRefImag[k] = refMag * Math.sin(refPhase);

            this.outputCoherence[k] = this.getCoherenceValue(f_k, isMeasuring);
        }

        // 5. Aplicar Promediado Complejo sobre el espectro de entrada (Prompt 9)
        if (this.averagingProcessor && uiStore.averagingType !== 'None') {
            this.averagingProcessor.setDepth(uiStore.averagingDepth || 16);
            if (uiStore.averagingType === 'FIFO') {
                this.averagingProcessor.processFIFO(this.fftInputReal, this.fftInputImag, this.avgInputReal, this.avgInputImag);
                this.fftInputReal.set(this.avgInputReal);
                this.fftInputImag.set(this.avgInputImag);
            } else if (uiStore.averagingType === 'LPF') {
                this.averagingProcessor.processLPF(this.fftInputReal, this.fftInputImag, this.avgInputReal, this.avgInputImag, uiStore.averagingAlpha || 0.1);
                this.fftInputReal.set(this.avgInputReal);
                this.fftInputImag.set(this.avgInputImag);
            }
        }

        let peakSum = 0;
        for (let k = 0; k < this.BINS; k++) {
            const mag = Math.sqrt(this.fftInputReal[k] * this.fftInputReal[k] + this.fftInputImag[k] * this.fftInputImag[k]);
            if (mag > peakSum) peakSum = mag;
        }
        const dbIn = 20 * Math.log10(peakSum || 1e-6);

        // 6. Cálculo de Métricas Síncronas (Magnitude, Phase, Impulse, etc.)
        const activeLayerId = uiStore.activeLayerId;
        const activeLayerForMetrics = traceManager.layers.find(l => l.id === activeLayerId);
        const activeMetrics = new Set(this.activeMetricsByQuadrant[activeLayerForMetrics?.quadrantId || ""] || ["Magnitude"]);

        const needMagnitude = activeMetrics.has("Magnitude") || activeMetrics.has("Spectrum") || activeMetrics.has("Spectrogram") || activeMetrics.has("Impulse") || activeMetrics.has("Step");
        const needPhase = activeMetrics.has("Phase") || activeMetrics.has("Group Delay");
        const needImpulse = activeMetrics.has("Impulse") || activeMetrics.has("Step");

        if (needMagnitude) {
            calculateMagnitude(
                this.fftInputReal,
                this.fftInputImag,
                this.fftRefReal,
                this.fftRefImag,
                this.outputMagnitude,
                this.hReal,
                this.hImag
            );
        }
        if (needPhase) {
            calculatePhase(
                this.fftInputReal,
                this.fftInputImag,
                this.fftRefReal,
                this.fftRefImag,
                this.outputPhase
            );
        }
        if (needImpulse) {
            // Deconvolución síncrona
            deconvolve(
                this.fftInputReal,
                this.fftInputImag,
                this.fftRefReal,
                this.fftRefImag,
                this.outputImpulse,
                this.tempFullReal,
                this.tempFullImag,
                this.tempFullRealOut,
                this.tempFullImagOut
            );

            // Aplicar source windowing si está activo (Prompt 9)
            if (uiStore.enableSourceWindow) {
                applySourceWindow(this.outputImpulse, uiStore.sourceWindowWidthMs, uiStore.sourceWindowOffsetMs, 48000);
            }
            // Aplicar WindowFunction si es necesario (Prompt 9)
            if (uiStore.windowType !== 'Rectangular') {
                this.windowProcessor.apply(this.outputImpulse, uiStore.windowType);
            }
        }
        if (activeMetrics.has("Step")) {
            calculateStepResponse(this.outputImpulse, this.outputStep);
        }
        if (activeMetrics.has("Group Delay")) {
            for (let k = 0; k < this.BINS; k++) {
                this.tempPhaseRadians[k] = (this.outputPhase[k] * Math.PI) / 180;
            }
            calculateGroupDelay(this.tempPhaseRadians, 24000 / this.BINS, this.outputGroupDelay);
        }

        // PROPAGAR VÚMETROS DINÁMICAMENTE CONFORME A LOS CANALES ACTIVOS (PROMPT 7)
        const inChCount = uiStore.inChannels.filter(Boolean).length || 2;
        const outChCount = uiStore.outChannels.filter(Boolean).length || 2;
        meterStore.updateIn(Array.from({ length: inChCount }, () => dbIn));
        meterStore.updateOut(Array.from({ length: outChCount }, () => dbIn));

        // Guardar en la capa activa bajo medición
        const activeLayer = traceManager.layers.find(l => l.isMeasuring && l.id === uiStore.activeLayerId);
        if (activeLayer) {
            const qMetrics = this.activeMetricsByQuadrant[activeLayer.quadrantId] || ["Magnitude"];
            const mainMetric = qMetrics.find(m => ["Magnitude", "Phase", "Coherence", "Spectrum", "Group Delay"].includes(m)) || "Magnitude";
            
            let sourceBuffer = this.outputMagnitude;
            if (mainMetric === "Phase") sourceBuffer = this.outputPhase;
            else if (mainMetric === "Coherence") sourceBuffer = this.outputCoherence;
            else if (mainMetric === "Group Delay") sourceBuffer = this.outputGroupDelay;

            if (activeLayer.data.length !== sourceBuffer.length) {
                activeLayer.data = new Float32Array(sourceBuffer.length);
            }
            activeLayer.data.set(sourceBuffer);
        }

        this.version++;

        if (this.dirty) {
            this.dirty = false;
        }
    }
}

export const mathOrchestrator = new MathOrchestrator();
