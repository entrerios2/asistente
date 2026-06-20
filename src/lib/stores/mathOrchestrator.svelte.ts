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
import { getAudioProvider } from '../hal';

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

    hReal = $state.raw(new Float32Array(this.BINS));
    hImag = $state.raw(new Float32Array(this.BINS));

    // Dual-channel time-domain buffers (recibidos del HAL)
    private measTimeDomain: Float32Array | null = null;
    private refTimeDomain: Float32Array | null = null;

    // Auto delay compensation tracking
    compensationDelaySamples = 0;

    // Cache for EQ response
    eqResponseCache = new Float32Array(this.BINS);
    private lastBandsHash = 0;
    private lastMeasuring = false;
    private lastSimulating = false;

    // Cache for calibration gain
    private calGainCache: Float32Array | null = null;
    private calGainHash = 0;

    // Worker & autonomous timer
    private worker: Worker | null = null;
    private timerId: ReturnType<typeof setInterval> | null = null;

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
                this.startTimer(uiStore.dspUpdateRate);
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

    private handleWorkerMessage(data: any) {
        if (data.type === 'dsp-results') {
            this.lastMathTime = performance.now();
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
            
            // Meters independientes por canal
            meterStore.updateIn([data.refPeakDb ?? -60]);
            meterStore.updateOut([data.measPeakDb ?? -60]);

            // Spectrum del worker → liveFrequencyData para el rendering
            if (data.outputSpectrum) {
                const specData = new Float32Array(data.outputSpectrum);
                if (traceManager.liveFrequencyData.length !== specData.length) {
                    traceManager.liveFrequencyData = new Float32Array(specData.length);
                }
                traceManager.liveFrequencyData.set(specData);
            }

            // Auto delay compensation
            if (data.detectedDelaySamples !== undefined) {
                this.compensationDelaySamples = data.detectedDelaySamples;
            }
            
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
            const sr = uiStore.sampleRate;
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
        const binWidth = (uiStore.sampleRate / 2) / this.BINS;
        const idx = Math.round(f / binWidth);
        if (idx < 0) return this.eqResponseCache[0];
        if (idx >= this.BINS) return this.eqResponseCache[this.BINS - 1];
        return this.eqResponseCache[idx];
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
                metrics: Array.from(this.globalActiveMetrics),
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
