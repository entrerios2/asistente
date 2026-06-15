import {
    calculateMagnitude,
    calculatePhase,
    calculateStepResponse,
    calculateGroupDelay,
} from './osmMetrics';
import { getWeightingGain } from './weighting';
import { ComplexAveraging } from './averaging';
import { deconvolve } from './deconvolution';
import { applySourceWindow } from './sourceWindowing';
import { WindowFunction } from './windowFunction';

// WebFFT: motor FFT acelerado (WASM/GPU)
let webfftEngine: any = null;
let webfftSize = 0;

async function initWebFFT(fftSize: number): Promise<void> {
    try {
        const { default: WebFFT } = await import('webfft');
        webfftEngine = new WebFFT(fftSize);
        await webfftEngine.profile();
        webfftSize = fftSize;
        console.log('[dspWorker] WebFFT initialized:', webfftEngine.toString());
    } catch (e) {
        console.warn('[dspWorker] WebFFT not available, using Radix-2 fallback:', e);
        webfftEngine = null;
    }
}

interface EQBand {
    freq: number;
    gain: number;
    q: number;
    type: string;
}

interface EQFilter {
    frequency: number;
    gain: number;
    q: number;
    type: 'peaking' | 'highshelf' | 'lowshelf';
    enabled: boolean;
}

interface CalibrationPoint {
    frequency: number;
    gain: number;
}

function getPhaseValueRadians(freq: number, isMeasuring: boolean, eqBands: EQBand[], calibrationFilters: EQFilter[]): number {
    const delayMs = 1.4;
    let phase = -2 * Math.PI * freq * (delayMs / 1000);

    for (let b = 0; b < eqBands.length; b++) {
        const band = eqBands[b];
        if (band.gain !== 0) {
            const w0 = 2 * Math.PI * band.freq / 48000;
            const sinW0 = Math.sin(w0);
            const cosW0 = Math.cos(w0);
            const alpha = sinW0 / (2 * band.q);
            const A = Math.pow(10, band.gain / 40);

            const b0 = 1 + alpha * A;
            const b1 = -2 * cosW0;
            const b2 = 1 - alpha * A;
            const a0 = 1 + alpha / A;
            const a1 = -2 * cosW0;
            const a2 = 1 - alpha / A;

            const w = 2 * Math.PI * freq / 48000;
            const cosW = Math.cos(w);
            const sinW = Math.sin(w);
            const cos2W = Math.cos(2 * w);
            const sin2W = Math.sin(2 * w);

            const nI = -(b1 * sinW + b2 * sin2W);
            const nR = b0 + b1 * cosW + b2 * cos2W;
            const dI = -(a1 * sinW + a2 * sin2W);
            const dR = a0 + a1 * cosW + a2 * cos2W;

            phase += Math.atan2(nI, nR) - Math.atan2(dI, dR);
        }
    }

    if (calibrationFilters) {
        for (const filter of calibrationFilters) {
            if (filter.enabled) {
                const fc = filter.frequency;
                const G = filter.gain;
                const Q = filter.q;
                const A = Math.pow(10, G / 40);
                const w0 = 2 * Math.PI * fc / 48000;
                const sinW0 = Math.sin(w0);
                const cosW0 = Math.cos(w0);
                
                let b0 = 0, b1 = 0, b2 = 0, a0 = 0, a1 = 0, a2 = 0;
                if (filter.type === 'peaking') {
                    const alpha = sinW0 / (2 * Q);
                    b0 = 1 + alpha * A;
                    b1 = -2 * cosW0;
                    b2 = 1 - alpha * A;
                    a0 = 1 + alpha / A;
                    a1 = -2 * cosW0;
                    a2 = 1 - alpha / A;
                } else if (filter.type === 'lowshelf') {
                    const alpha = sinW0 / 2 * Math.sqrt((A + 1/A) * (1/Q - 1) + 2);
                    const sqrtA2alpha = 2 * Math.sqrt(A) * alpha;
                    b0 = A * ((A + 1) - (A - 1) * cosW0 + sqrtA2alpha);
                    b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
                    b2 = A * ((A + 1) - (A - 1) * cosW0 - sqrtA2alpha);
                    a0 = (A + 1) + (A - 1) * cosW0 + sqrtA2alpha;
                    a1 = -2 * ((A - 1) + (A + 1) * cosW0);
                    a2 = (A + 1) + (A - 1) * cosW0 - sqrtA2alpha;
                } else if (filter.type === 'highshelf') {
                    const alpha = sinW0 / 2 * Math.sqrt((A + 1/A) * (1/Q - 1) + 2);
                    const sqrtA2alpha = 2 * Math.sqrt(A) * alpha;
                    b0 = A * ((A + 1) + (A - 1) * cosW0 + sqrtA2alpha);
                    b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
                    b2 = A * ((A + 1) - (A - 1) * cosW0 - sqrtA2alpha);
                    a0 = (A + 1) - (A - 1) * cosW0 + sqrtA2alpha;
                    a1 = 2 * ((A - 1) - (A + 1) * cosW0);
                    a2 = (A + 1) - (A - 1) * cosW0 - sqrtA2alpha;
                }

                const w = 2 * Math.PI * freq / 48000;
                const cosW = Math.cos(w);
                const sinW = Math.sin(w);
                const cos2W = Math.cos(2 * w);
                const sin2W = Math.sin(2 * w);

                const nI = -(b1 * sinW + b2 * sin2W);
                const nR = b0 + b1 * cosW + b2 * cos2W;
                const dI = -(a1 * sinW + a2 * sin2W);
                const dR = a0 + a1 * cosW + a2 * cos2W;

                phase += Math.atan2(nI, nR) - Math.atan2(dI, dR);
            }
        }
    }

    if (isMeasuring) {
        phase += (Math.random() - 0.5) * 0.04;
    }
    return phase;
}

function getCoherenceValue(freq: number, isMeasuring: boolean, eqBands: EQBand[]): number {
    let coh = 0.98;
    if (freq < 45) coh -= 0.35 * (1 - freq / 45);
    if (freq > 16000) coh -= (0.12 * (freq - 16000)) / 4000;

    for (let b = 0; b < eqBands.length; b++) {
        const band = eqBands[b];
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

function getCalibrationGainAt(freq: number, pts: CalibrationPoint[]): number {
    if (!pts || pts.length === 0) return 0;
    if (freq <= pts[0].frequency) return pts[0].gain;
    if (freq >= pts[pts.length - 1].frequency) return pts[pts.length - 1].gain;

    let low = 0;
    let high = pts.length - 1;
    while (high - low > 1) {
        const mid = (low + high) >> 1;
        if (pts[mid].frequency > freq) {
            high = mid;
        } else {
            low = mid;
        }
    }

    const f0 = pts[low].frequency;
    const g0 = pts[low].gain;
    const f1 = pts[high].frequency;
    const g1 = pts[high].gain;

    const logF = Math.log10(freq);
    const logF0 = Math.log10(f0);
    const logF1 = Math.log10(f1);

    const t = (logF - logF0) / (logF1 - logF0 || 1);
    return g0 * (1 - t) + g1 * t;
}

// Shared calculation buffers in worker scope to avoid GC pressure
let fftInputReal: Float32Array;
let fftInputImag: Float32Array;
let fftRefReal: Float32Array;
let fftRefImag: Float32Array;
let hReal: Float32Array;
let hImag: Float32Array;

let tempFullReal: Float32Array;
let tempFullImag: Float32Array;
let tempFullRealOut: Float32Array;
let tempFullImagOut: Float32Array;

let outputMagnitude: Float32Array;
let outputPhase: Float32Array;
let outputCoherence: Float32Array;
let outputGroupDelay: Float32Array;
let outputImpulse: Float32Array;
let outputStep: Float32Array;
let tempPhaseRadians: Float32Array;
let outputCrestFactor: Float32Array;

// Temp buffers for averaging
let avgInputReal: Float32Array;
let avgInputImag: Float32Array;

let currentBins = 0;
let currentFftSize = 0;

let averagingProcessor: ComplexAveraging | null = null;
const windowProcessor = new WindowFunction();

self.onmessage = (event) => {
    if (event.data && event.data.type === 'run-dsp') {
        const {
            liveData,
            BINS,
            FFT_SIZE,
            eqResponseCache,
            eqBands,
            calibrationFilters,
            calibrationPoints,
            inputGain,
            displayOffset,
            isMeasuring,
            metrics,
            weightingType,
            averagingType,
            averagingDepth,
            averagingAlpha,
            windowType,
            enableSourceWindow,
            sourceWindowWidthMs,
            sourceWindowOffsetMs,
        } = event.data;

        // WebFFT initialization if FFT_SIZE changes
        if (FFT_SIZE && FFT_SIZE !== webfftSize) {
            initWebFFT(FFT_SIZE);
        }

        // Re-allocate only if dimensions changed
        if (BINS !== currentBins || FFT_SIZE !== currentFftSize) {
            currentBins = BINS;
            currentFftSize = FFT_SIZE;
            
            fftInputReal = new Float32Array(BINS);
            fftInputImag = new Float32Array(BINS);
            fftRefReal = new Float32Array(BINS);
            fftRefImag = new Float32Array(BINS);
            hReal = new Float32Array(BINS);
            hImag = new Float32Array(BINS);

            tempFullReal = new Float32Array(FFT_SIZE);
            tempFullImag = new Float32Array(FFT_SIZE);
            tempFullRealOut = new Float32Array(FFT_SIZE);
            tempFullImagOut = new Float32Array(FFT_SIZE);

            outputMagnitude = new Float32Array(BINS);
            outputPhase = new Float32Array(BINS);
            outputCoherence = new Float32Array(BINS);
            outputGroupDelay = new Float32Array(BINS);
            outputImpulse = new Float32Array(FFT_SIZE);
            outputStep = new Float32Array(FFT_SIZE);
            tempPhaseRadians = new Float32Array(BINS);
            outputCrestFactor = new Float32Array(BINS);

            avgInputReal = new Float32Array(BINS);
            avgInputImag = new Float32Array(BINS);

            averagingProcessor = new ComplexAveraging(BINS, averagingDepth || 16);
        }

        if (averagingProcessor) {
            averagingProcessor.setDepth(averagingDepth || 16);
        }

        const metricsSet = new Set<string>(metrics);
        const liveTraceData = liveData ? new Float32Array(liveData) : null;

        for (let k = 0; k < BINS; k++) {
            const f_k = k * (24000 / BINS) || 1e-6;

            // Simulated pink noise reference
            const refDb = -50 + Math.sin(k * 0.05) * 0.5;
            const refMag = Math.pow(10, refDb / 20);
            const refPhase = 0;

            // Measurement
            let liveDb = -50;
            if (liveTraceData && liveTraceData.length > 0) {
                const mapIdx = Math.floor((k * liveTraceData.length) / BINS);
                liveDb = liveTraceData[mapIdx] || -120;

                // 1. Aplicar ganancia de entrada
                liveDb += inputGain || 0;

                // 2. Compensar curva de calibración acústica
                liveDb -= getCalibrationGainAt(f_k, calibrationPoints);

                // 3. Aplicar ponderación de frecuencia ANSI (A, B, C, Z) (Prompt 9)
                liveDb += getWeightingGain(f_k, weightingType || 'Z');

                // 4. Aplicar offset absoluto de visualización
                liveDb += displayOffset || 0;
            } else {
                const binWidth = 24000 / BINS;
                const idx = Math.max(0, Math.min(BINS - 1, Math.round(f_k / binWidth)));
                const eqGain = eqResponseCache[idx] || 0;
                liveDb = -50 + eqGain + Math.sin(k * 0.08) * 0.3;

                // Aplicar ponderación también a la simulación si está calibrada
                liveDb += getWeightingGain(f_k, weightingType || 'Z');
                liveDb += displayOffset || 0;
            }

            const liveMag = Math.pow(10, liveDb / 20);
            const phaseTotal = getPhaseValueRadians(f_k, isMeasuring, eqBands, calibrationFilters) + refPhase;

            fftInputReal[k] = liveMag * Math.cos(phaseTotal);
            fftInputImag[k] = liveMag * Math.sin(phaseTotal);
            fftRefReal[k] = refMag * Math.cos(refPhase);
            fftRefImag[k] = refMag * Math.sin(refPhase);

            outputCoherence[k] = getCoherenceValue(f_k, isMeasuring, eqBands);
        }

        // 5. Aplicar Promediado Complejo sobre el espectro de entrada (Prompt 9)
        if (averagingProcessor && averagingType !== 'None') {
            if (averagingType === 'FIFO') {
                averagingProcessor.processFIFO(fftInputReal, fftInputImag, avgInputReal, avgInputImag);
                fftInputReal.set(avgInputReal);
                fftInputImag.set(avgInputImag);
            } else if (averagingType === 'LPF') {
                averagingProcessor.processLPF(fftInputReal, fftInputImag, avgInputReal, avgInputImag, averagingAlpha || 0.1);
                fftInputReal.set(avgInputReal);
                fftInputImag.set(avgInputImag);
            }
        }

        // Calcular el valor RMS o Peak del espectro
        let peakSum = 0;
        for (let k = 0; k < BINS; k++) {
            const mag = Math.sqrt(fftInputReal[k] * fftInputReal[k] + fftInputImag[k] * fftInputImag[k]);
            if (mag > peakSum) peakSum = mag;
        }
        const dbIn = 20 * Math.log10(peakSum || 1e-6);

        const needMagnitude = metricsSet.has("Magnitude") || metricsSet.has("Spectrum") || metricsSet.has("Spectrogram") || metricsSet.has("Impulse") || metricsSet.has("Step");
        const needPhase = metricsSet.has("Phase") || metricsSet.has("Group Delay");
        const needImpulse = metricsSet.has("Impulse") || metricsSet.has("Step");

        if (needMagnitude) {
            calculateMagnitude(
                fftInputReal,
                fftInputImag,
                fftRefReal,
                fftRefImag,
                outputMagnitude,
                hReal,
                hImag,
            );
        }
        if (needPhase) {
            calculatePhase(
                fftInputReal,
                fftInputImag,
                fftRefReal,
                fftRefImag,
                outputPhase,
            );
        }

        // Crest Factor por bin: CF = peak_dB - rms_dB (simplificado a partir de la magnitud)
        if (metricsSet.has("Crest Factor")) {
            for (let k = 0; k < BINS; k++) {
                const mag = Math.sqrt(fftInputReal[k] * fftInputReal[k] + fftInputImag[k] * fftInputImag[k]);
                const peakDb = 20 * Math.log10(mag + 1e-12);
                // Estimar RMS como promedio local de 5 bins
                let sumSq = 0;
                let count = 0;
                for (let j = Math.max(0, k - 2); j <= Math.min(BINS - 1, k + 2); j++) {
                    const m = Math.sqrt(fftInputReal[j] * fftInputReal[j] + fftInputImag[j] * fftInputImag[j]);
                    sumSq += m * m;
                    count++;
                }
                const rmsDb = 10 * Math.log10(sumSq / count + 1e-24);
                outputCrestFactor[k] = Math.max(0, Math.min(30, peakDb - rmsDb));
            }
        }
        
        // 6. Deconvolución en Tiempo Real (Prompt 9)
        if (needImpulse) {
            if (webfftEngine && webfftEngine.size === FFT_SIZE) {
                const bins = fftInputReal.length;
                const N = bins * 2;
                const regularization = 1e-10;

                // 1. División compleja en frecuencia H(f) = Y(f) / X(f)
                for (let k = 0; k < bins; k++) {
                    const den = fftRefReal[k] * fftRefReal[k] + fftRefImag[k] * fftRefImag[k] + regularization;
                    const hR = (fftInputReal[k] * fftRefReal[k] + fftInputImag[k] * fftRefImag[k]) / den;
                    const hI = (fftInputImag[k] * fftRefReal[k] - fftInputReal[k] * fftRefImag[k]) / den;

                    tempFullReal[k] = hR;
                    tempFullImag[k] = hI;
                }

                // 2. Espectro simétrico hermítico para señal real
                for (let k = 1; k < bins; k++) {
                    tempFullReal[N - k] = tempFullReal[k];
                    tempFullImag[N - k] = -tempFullImag[k];
                }

                // 3. IFFT compleja usando WebFFT
                const interleaved = new Float32Array(N * 2);
                for (let i = 0; i < N; i++) {
                    interleaved[i * 2] = tempFullReal[i];
                    interleaved[i * 2 + 1] = -tempFullImag[i];
                }
                const result = webfftEngine.fft(interleaved);
                for (let i = 0; i < N; i++) {
                    outputImpulse[i] = result[i * 2] / N;
                }
            } else {
                deconvolve(
                    fftInputReal,
                    fftInputImag,
                    fftRefReal,
                    fftRefImag,
                    outputImpulse,
                    tempFullReal,
                    tempFullImag,
                    tempFullRealOut,
                    tempFullImagOut
                );
            }

            // Aplicar source windowing si está activo (Prompt 9)
            if (enableSourceWindow) {
                applySourceWindow(outputImpulse, sourceWindowWidthMs, sourceWindowOffsetMs, 48000);
            }
            // Aplicar WindowFunction si es necesario (Prompt 9)
            if (windowType !== 'Rectangular') {
                windowProcessor.apply(outputImpulse, windowType);
            }
        }

        if (metricsSet.has("Step")) {
            calculateStepResponse(outputImpulse, outputStep);
        }
        if (metricsSet.has("Group Delay")) {
            for (let k = 0; k < BINS; k++) {
                tempPhaseRadians[k] = (outputPhase[k] * Math.PI) / 180;
            }
            calculateGroupDelay(tempPhaseRadians, 24000 / BINS, outputGroupDelay);
        }

        (self as any).postMessage({
            type: 'dsp-results',
            outputMagnitude: outputMagnitude.slice().buffer,
            outputPhase: outputPhase.slice().buffer,
            outputCoherence: outputCoherence.slice().buffer,
            outputGroupDelay: outputGroupDelay.slice().buffer,
            outputImpulse: outputImpulse.slice().buffer,
            outputStep: outputStep.slice().buffer,
            outputCrestFactor: outputCrestFactor.slice().buffer,
            dbIn
        });
    }
};
