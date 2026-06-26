/**
 * MathOrchestrator: Centralized DSP pipeline for all active Quadrants.
 * Calculates FFT, Transfer Function, Phase, Coherence, Impulse Response, Step Response, and Group Delay.
 * Shares results to avoid redundant calculations and implements adaptive throttling.
 */

import { untrack } from 'svelte';
import { traceManager } from './traceManager.svelte';
import { eqStore } from './eqStore.svelte';
import { uiStore } from './ui.svelte';
import { meterStore } from './meterStore.svelte';
import { calibrationStore } from './calibrationStore.svelte';
import { getCoeffsForType } from '../dsp/biquad';
import { getAudioProvider } from '../hal';

/** Typed result from the DSP worker's postMessage */
interface DSPWorkerResult {
    type: 'dsp-results';
    outputMagnitude: ArrayBuffer;
    outputPhase: ArrayBuffer;
    outputCoherence: ArrayBuffer;
    outputGroupDelay: ArrayBuffer;
    outputImpulse: ArrayBuffer;
    outputStep: ArrayBuffer;
    outputCrestFactor?: ArrayBuffer;
    outputSpectrum?: ArrayBuffer;
    hReal?: ArrayBuffer;
    hImag?: ArrayBuffer;
    refPeakDb?: number;
    measPeakDb?: number;
    detectedDelaySamples?: number;
}

class MathOrchestrator {
    // Reactive version to notify subscribers of new calculations
    version = $state(0);
    workerError = $state<string | null>(null);
    dirty = $state(true);
    lastMathTime = 0;

    activeMetricsByQuadrant = $state<Record<string, string[]>>({});
    BINS = 4096;
    private FFT_SIZE = 8192;

    // Shared output buffers
    outputMagnitude = $state.raw(new Float32Array(this.BINS));
    outputPhase = $state.raw(new Float32Array(this.BINS));
    outputCoherence = $state.raw(new Float32Array(this.BINS));
    outputGroupDelay = $state.raw(new Float32Array(this.BINS));
    outputImpulse = $state.raw(new Float32Array(this.FFT_SIZE));
    outputStep = $state.raw(new Float32Array(this.FFT_SIZE));
    outputCrestFactor = $state.raw(new Float32Array(this.BINS));
    outputSpectrum = $state.raw(new Float32Array(this.BINS));

    hReal = $state.raw(new Float32Array(this.BINS));
    hImag = $state.raw(new Float32Array(this.BINS));

    // Dual-channel time-domain buffers (recibidos del HAL)
    private measTimeDomain: Float32Array | null = null;
    private refTimeDomain: Float32Array | null = null;

    // Auto delay compensation tracking
    compensationDelaySamples = 0;

    // Cache for EQ response (magnitude dB + phase radians)
    eqResponseCache = new Float32Array(this.BINS);
    eqPhaseCache = new Float32Array(this.BINS);
    eqBandCoeffs: number[][] = [];  // Cached biquad coefficients for render
    private lastBandsHash = 0;
    private lastMeasuring = false;
    private lastSimulating = false;

    // Cache for calibration gain
    private calGainCache: Float32Array | null = null;
    private calGainHash = 0;

    // Worker & autonomous timer
    private worker: Worker | null = null;
    private timerId: ReturnType<typeof setInterval> | null = null;
    private dspFrameCount = 0;

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
                this.workerError = 'No se pudo inicializar el procesador DSP. La medición no estará disponible.';
            }
        }

        $effect.root(() => {
            $effect(() => {
                const fftSize = uiStore.fftSize;
                untrack(() => this.reallocateBuffers(fftSize));
            });
            $effect(() => {
                this.startTimer(uiStore.dspBaseRate);
            });
            // Enviar FSK enable/disable al worklet cuando cambia measurementMode
            $effect(() => {
                const mode = uiStore.measurementMode;
                untrack(() => {
                    const provider = getAudioProvider();
                    if (provider.sendWorkletMessage) {
                        provider.sendWorkletMessage({ type: 'setFskEnabled', enabled: mode === 'secuencial' });
                    }
                });
            });
            // Enviar refChannel al worklet cuando cambia (-1=loop, 0=L, 1=R)
            $effect(() => {
                const ch = uiStore.refChannel;
                untrack(() => {
                    const provider = getAudioProvider();
                    if (provider.sendWorkletMessage) {
                        provider.sendWorkletMessage({ type: 'setRefChannel', channel: ch });
                    }
                });
            });

            // Enviar measChannel al worklet cuando cambia (0=L, 1=R)
            $effect(() => {
                const ch = uiStore.measChannel;
                untrack(() => {
                    const provider = getAudioProvider();
                    if (provider.sendWorkletMessage) {
                        provider.sendWorkletMessage({ type: 'setMeasChannel', channel: ch });
                    }
                });
            });

            // Control de ciclo de vida de medición (desacoplado de TabMedicion)
            $effect(() => {
                const shouldMeasure = uiStore.isMeasuring;
                untrack(() => {
                    if (shouldMeasure) {
                        this.startMeasurementCapture();
                    } else {
                        this.stopMeasurementCapture();
                    }
                });
            });

            // Control reactivo del generador (desacoplado de TabMedicion)
            $effect(() => {
                if (uiStore.measurementMode === "manual") {
                    const provider = getAudioProvider();
                    provider.playGenerator(
                        uiStore.generatorType as any,
                        uiStore.genActive,
                        uiStore.genFreq,
                        uiStore.genLevel,
                        uiStore.genRouting
                    );
                }
            });
        });
    }

    private startTimer(rate: number) {
        if (this.timerId) {
            clearInterval(this.timerId);
        }
        const intervalMs = 1000 / rate;
        this.timerId = setInterval(() => {
            this.run();
        }, intervalMs);
    }

    private async startMeasurementCapture() {
        const provider = getAudioProvider();
        try {
            if (uiStore.measurementMode === "manual") {
                await provider.startCapture({
                    onAudioData: () => {},
                    onTimeDomainData: (meas: Float32Array, ref: Float32Array) => {
                        this.feedTimeDomain(meas, ref);
                    },
                });
                // Encender generador DESPUÉS de que la captura esté lista
                if (uiStore.linkGeneratorToMeasurement && !uiStore.genActive) {
                    uiStore.genActive = true;
                }
            }
        } catch (e) {
            console.error('[MathOrchestrator] startMeasurementCapture error:', e);
            uiStore.isMeasuring = false;
        }
    }

    private stopMeasurementCapture() {
        const provider = getAudioProvider();
        if (uiStore.measurementMode === "manual") {
            provider.stopCapture();
        }
        if (uiStore.autoSaveSnapshotOnStop) {
            traceManager.captureInstantaneaFromLive('Auto-snapshot', 'manual');
        }
        if (uiStore.linkGeneratorToMeasurement) {
            uiStore.genActive = false;
        }
    }

    // Mapeo de nombre de métrica (en UI) → clave en metricDecimation
    private static METRIC_TO_DECIM_KEY: Record<string, string> = {
        'Magnitude': 'magnitude',
        'Phase': 'phase',
        'Coherence': 'coherence',
        'Spectrum': 'spectrum',
        'Group Delay': 'gd',
        'Impulse': 'impulse',
        'Step': 'step',
        'Crest': 'crest',
    };

    private handleWorkerMessage(data: DSPWorkerResult) {
        if (data.type === 'dsp-results') {
            this.lastMathTime = performance.now();
            this.dspFrameCount++;

            // Always update raw output buffers (zero-copy from worker)
            this.outputMagnitude = new Float32Array(data.outputMagnitude);
            this.outputPhase = new Float32Array(data.outputPhase);
            this.outputCoherence = new Float32Array(data.outputCoherence);
            this.outputGroupDelay = new Float32Array(data.outputGroupDelay);
            this.outputImpulse = new Float32Array(data.outputImpulse);
            this.outputStep = new Float32Array(data.outputStep);
            if (data.outputCrestFactor) {
                this.outputCrestFactor = new Float32Array(data.outputCrestFactor);
            }
            if (data.hReal) {
                this.hReal = new Float32Array(data.hReal);
            }
            if (data.hImag) {
                this.hImag = new Float32Array(data.hImag);
            }
            
            // Meters — siempre
            meterStore.updateIn([data.refPeakDb ?? -60]);
            meterStore.updateOut([data.measPeakDb ?? -60]);

            // Spectrum — siempre (para espectrograma / liveFrequencyData)
            if (data.outputSpectrum) {
                const specData = new Float32Array(data.outputSpectrum);
                this.outputSpectrum = specData;
                traceManager.liveFrequencyData = specData;
            }

            // Auto delay compensation — siempre
            if (data.detectedDelaySamples !== undefined) {
                this.compensationDelaySamples = data.detectedDelaySamples;
            }
            
            // Escribir en la capa activa solo cuando el factor de decimación
            // de la métrica principal lo permite
            const activeLayer = traceManager.layers.find(l => l.isMeasuring && l.id === uiStore.activeLayerId);
            if (activeLayer) {
                const qMetrics = this.activeMetricsByQuadrant[activeLayer.quadrantId] || ["Magnitude"];
                const mainMetric = qMetrics.find(m => ["Magnitude", "Phase", "Coherence", "Spectrum", "Group Delay", "Crest"].includes(m)) || "Magnitude";
                
                const decimKey = MathOrchestrator.METRIC_TO_DECIM_KEY[mainMetric] || 'magnitude';
                const decimFactor = (uiStore.metricDecimation as any)[decimKey] || 1;

                if (this.dspFrameCount % decimFactor === 0) {
                    let sourceBuffer = this.outputMagnitude;
                    if (mainMetric === "Phase") sourceBuffer = this.outputPhase;
                    else if (mainMetric === "Coherence") sourceBuffer = this.outputCoherence;
                    else if (mainMetric === "Group Delay") sourceBuffer = this.outputGroupDelay;
                    else if (mainMetric === "Crest") sourceBuffer = this.outputCrestFactor;

                    if (activeLayer.data.length !== sourceBuffer.length) {
                        activeLayer.data = new Float32Array(sourceBuffer.length);
                    }
                    activeLayer.data.set(sourceBuffer);

                    this.version++;
                }
            } else {
                this.version++;
            }
        }
    }

    registerQuadrantMetrics(id: string, metrics: string[]) {
        this.activeMetricsByQuadrant[id] = metrics;
    }

    unregisterQuadrant(id: string) {
        delete this.activeMetricsByQuadrant[id];
    }

    /**
     * Recibe datos time-domain dual-channel del HAL y dispara el pipeline DSP.
     */
    feedTimeDomain(measSamples: Float32Array, refSamples?: Float32Array): void {
        this.measTimeDomain = measSamples;
        this.refTimeDomain = refSamples || measSamples;
        this.dirty = true;
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

    private getWorkerMetrics(): string[] {
        const metrics = new Set(this.globalActiveMetrics);
        // Si hay un cuadrante con espectrograma pero nadie pidió Spectrum,
        // lo agregamos automáticamente — el worker lo necesita para alimentar
        // outputSpectrum → interpSpectrum → spectrogram feed.
        if (metrics.has("Spectrogram") && !metrics.has("Spectrum")) {
            metrics.add("Spectrum");
        }
        return Array.from(metrics);
    }

    reallocateBuffers(newFftSize: number) {
        // Guard: skip if size hasn't changed and buffers are already allocated
        if (newFftSize === this.FFT_SIZE && this.outputMagnitude.length === newFftSize / 2) {
            return;
        }
        this.FFT_SIZE = newFftSize;
        this.BINS = newFftSize / 2;

        this.outputMagnitude = new Float32Array(this.BINS);
        this.outputPhase = new Float32Array(this.BINS);
        this.outputCoherence = new Float32Array(this.BINS);
        this.outputGroupDelay = new Float32Array(this.BINS);
        this.outputImpulse = new Float32Array(this.FFT_SIZE);
        this.outputStep = new Float32Array(this.FFT_SIZE);
        this.outputCrestFactor = new Float32Array(this.BINS);
        this.hReal = new Float32Array(this.BINS);
        this.hImag = new Float32Array(this.BINS);

        this.eqResponseCache = new Float32Array(this.BINS);
        this.eqPhaseCache = new Float32Array(this.BINS);
        this.updateEQCache();
        this.dirty = true;
    }

    get throttleMs(): number {
        return 1000 / uiStore.dspBaseRate;
    }

    /**
     * Compute a robust hash for the current EQ + calibration bands.
     * Uses multiplicative hash to avoid arithmetic collisions.
     */
    private computeBandsHash(): number {
        const bands = eqStore.activeBands;
        let hash = 17;
        for (let b = 0; b < bands.length; b++) {
            const band = bands[b];
            hash = (hash * 31 + (band.freq * 1e6)) | 0;
            hash = (hash * 31 + (band.gain * 1e3)) | 0;
            hash = (hash * 31 + (band.q * 100)) | 0;
            hash = (hash * 31 + (band.type ? band.type.charCodeAt(0) : 0)) | 0;
            hash = (hash * 31 + (band.muted ? 1 : 0)) | 0;
        }
        for (const filter of calibrationStore.suggestedFilters) {
            hash = (hash * 31 + (filter.frequency * 1e6)) | 0;
            hash = (hash * 31 + (filter.gain * 1e3)) | 0;
            hash = (hash * 31 + (filter.q * 100)) | 0;
            hash = (hash * 31 + (filter.enabled ? 1 : 0)) | 0;
            hash = (hash * 31 + (filter.type ? filter.type.charCodeAt(0) : 0)) | 0;
        }
        return hash;
    }

    /**
     * Fast EQ-only cache refresh. Call from the render loop (60fps) to ensure
     * the EQ response curve updates instantly when dragging nodes, without
     * waiting for the throttled DSP pipeline tick.
     */
    refreshEQCache(): void {
        try {
            const hash = this.computeBandsHash();
            if (hash !== this.lastBandsHash) {
                this.lastBandsHash = hash;
                this.updateEQCache();
            }
        } catch (e) {
            // Ignorar ReferenceError temporal durante la carga ESM
        }
    }

    private checkDirty() {
        try {
            // EQ cache — delegates to unified hash logic
            this.refreshEQCache();

            const measuring = uiStore.isMeasuring;
            const simulating = uiStore.isSimulating;

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
            const sr = uiStore.sampleRate;
            const nyquist = sr / 2;

            // 1. Precompute coefficients ONCE per band
            const bands = eqStore.activeBands;
            const bandCoeffs: number[][] = [];
            for (let b = 0; b < bands.length; b++) {
                const band = bands[b];
                // Skip muted bands
                if (band.muted) continue;
                // A2 fix: include notch/bandpass/lowpass/highpass even when gain=0
                if (band.gain !== 0 || ['lowpass', 'highpass', 'notch', 'bandpass'].includes(band.type)) {
                    bandCoeffs.push(getCoeffsForType(band.type, band.freq, band.gain, band.q, sr));
                }
            }
            // Expose for render loop (Phase 3B)
            this.eqBandCoeffs = bandCoeffs;

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

            // 2. Single pass over bins — multiply in complex domain (A1)
            for (let i = 0; i < this.BINS; i++) {
                const freq = i * invBins || 1e-6;
                const w = TWO_PI * freq / sr;
                const cosW = Math.cos(w);
                const sinW = Math.sin(w);
                const cos2W = 2 * cosW * cosW - 1;
                const sin2W = 2 * sinW * cosW;

                // Accumulate total response as complex product H_total = H1 * H2 * ... * Hn
                let totalRe = 1.0;
                let totalIm = 0.0;

                // Evaluate each EQ band in complex domain
                for (let b = 0; b < bandCoeffs.length; b++) {
                    const c = bandCoeffs[b];
                    const nR = c[0] + c[1] * cosW + c[2] * cos2W;
                    const nI = -(c[1] * sinW + c[2] * sin2W);
                    const dR = c[3] + c[4] * cosW + c[5] * cos2W;
                    const dI = -(c[4] * sinW + c[5] * sin2W);
                    const dMagSq = dR * dR + dI * dI + 1e-20;
                    const hRe = (nR * dR + nI * dI) / dMagSq;
                    const hIm = (nI * dR - nR * dI) / dMagSq;
                    // Complex multiply: total = total * H
                    const newRe = totalRe * hRe - totalIm * hIm;
                    const newIm = totalRe * hIm + totalIm * hRe;
                    totalRe = newRe;
                    totalIm = newIm;
                }

                // Evaluate each calibration filter in complex domain
                for (let c2 = 0; c2 < calCoeffs.length; c2++) {
                    const c = calCoeffs[c2];
                    const nR = c[0] + c[1] * cosW + c[2] * cos2W;
                    const nI = -(c[1] * sinW + c[2] * sin2W);
                    const dR = c[3] + c[4] * cosW + c[5] * cos2W;
                    const dI = -(c[4] * sinW + c[5] * sin2W);
                    const dMagSq = dR * dR + dI * dI + 1e-20;
                    const hRe = (nR * dR + nI * dI) / dMagSq;
                    const hIm = (nI * dR - nR * dI) / dMagSq;
                    const newRe = totalRe * hRe - totalIm * hIm;
                    const newIm = totalRe * hIm + totalIm * hRe;
                    totalRe = newRe;
                    totalIm = newIm;
                }

                // Convert complex product to magnitude (dB) and phase (radians)
                this.eqResponseCache[i] = 10 * Math.log10(totalRe * totalRe + totalIm * totalIm + 1e-20);
                this.eqPhaseCache[i] = Math.atan2(totalIm, totalRe);
            }
        } catch (e) {
            // Ignorar ReferenceError temporal durante la carga ESM
        }
    }

    getEQResponseCached(f: number): number {
        const binWidth = (uiStore.sampleRate / 2) / this.BINS;
        const fIdx = f / binWidth;
        if (fIdx <= 0) return this.eqResponseCache[0];
        if (fIdx >= this.BINS - 1) return this.eqResponseCache[this.BINS - 1];
        // Linear interpolation between adjacent bins — eliminates staircase at low freqs
        const lo = fIdx | 0;
        const frac = fIdx - lo;
        return this.eqResponseCache[lo] + frac * (this.eqResponseCache[lo + 1] - this.eqResponseCache[lo]);
    }

    getEQPhaseCached(f: number): number {
        const binWidth = (uiStore.sampleRate / 2) / this.BINS;
        const fIdx = f / binWidth;
        if (fIdx <= 0) return this.eqPhaseCache[0];
        if (fIdx >= this.BINS - 1) return this.eqPhaseCache[this.BINS - 1];
        const lo = fIdx | 0;
        const frac = fIdx - lo;
        return this.eqPhaseCache[lo] + frac * (this.eqPhaseCache[lo + 1] - this.eqPhaseCache[lo]);
    }

    run() {
        this.checkDirty();

        // Sin datos time-domain, no procesamos
        if (!this.measTimeDomain || !this.refTimeDomain) {
            return;
        }

        if (!this.dirty) {
            return;
        }

        if (this.worker) {
            const measCopy = new Float32Array(this.measTimeDomain);
            const refCopy = new Float32Array(this.refTimeDomain);

            // E1: Interpolar curva de calibración a bins del FFT (cached)
            let calGainBuf: ArrayBuffer | undefined;
            if (calibrationStore.calibrationPoints.length > 0) {
                // Simple hash to detect changes
                let calHash = calibrationStore.calibrationPoints.length * 1e6;
                for (const p of calibrationStore.calibrationPoints) {
                    calHash += p.frequency * 1e3 + p.gain;
                }
                if (calHash !== this.calGainHash || !this.calGainCache || this.calGainCache.length !== this.BINS) {
                    const calGain = new Float32Array(this.BINS);
                    const sr = uiStore.sampleRate;
                    for (let k = 0; k < this.BINS; k++) {
                        const freq = (k * sr / 2) / this.BINS;
                        calGain[k] = calibrationStore.getCalibrationGainAt(freq);
                    }
                    this.calGainCache = calGain;
                    this.calGainHash = calHash;
                }
                // Copy for transfer (cache stays intact)
                const calCopy = new Float32Array(this.calGainCache);
                calGainBuf = calCopy.buffer;
            }

            const transferables: ArrayBuffer[] = [measCopy.buffer, refCopy.buffer];
            if (calGainBuf) transferables.push(calGainBuf);

            this.worker.postMessage({
                type: 'run-dsp',
                measTimeDomain: measCopy.buffer,
                refTimeDomain: refCopy.buffer,
                BINS: this.BINS,
                FFT_SIZE: this.FFT_SIZE,
                metrics: this.getWorkerMetrics(),
                windowType: uiStore.windowType,
                weightingType: uiStore.weightingType,
                averagingType: uiStore.averagingType,
                averagingDepth: uiStore.averagingDepth,
                averagingAlpha: uiStore.averagingAlpha,
                averagingThresholdDb: uiStore.averagingThresholdDb,
                enableSourceWindow: uiStore.enableSourceWindow,
                sourceWindowWidthMs: uiStore.sourceWindowWidthMs,
                sourceWindowOffsetMs: uiStore.sourceWindowOffsetMs,
                sampleRate: uiStore.sampleRate,
                compensationDelaySamples: uiStore.autoDelayCompensation
                    ? this.compensationDelaySamples
                    : Math.round(uiStore.compensationDelayMs * uiStore.sampleRate / 1000),
                autoDelayCompensation: uiStore.autoDelayCompensation,
                inputGain: uiStore.inputGain,
                displayOffset: uiStore.displayOffset,
                polarity: uiStore.polarity,
                calibrationGain: calGainBuf,
                inputFilter: uiStore.inputFilter,
                besselSpeed: uiStore.besselSpeed,
                ppoSmoothing: uiStore.ppoSmoothing,
                fftOverlap: uiStore.fftOverlap,
            }, transferables);

            this.dirty = false;
        }
    }

    resetAveraging(): void {
        this.worker?.postMessage({ type: 'reset-averaging' });
    }
}

export const mathOrchestrator = new MathOrchestrator();
