import {
    calculateMagnitude,
    calculatePhase,
    calculateStepResponse,
    calculateGroupDelay,
    processSignalLevel,
} from './osmMetrics';
import { getWeightingGain } from './weighting';
import { ComplexAveraging } from './averaging';
import { deconvolve } from './deconvolution';
import { applySourceWindow } from './sourceWindowing';
import { WindowFunction } from './windowFunction';
import { fft } from './fft';

// WebFFT: motor FFT acelerado (WASM/GPU)
let webfftEngine: any = null;
let webfftSize = 0;

async function initWebFFT(fftSize: number): Promise<void> {
    try {
        const { default: WebFFT } = await import('webfft');
        webfftEngine = new WebFFT(fftSize);
        await webfftEngine.profile();
        webfftSize = fftSize;
    } catch (e) {
        console.warn('[dspWorker] WebFFT not available, using Radix-2 fallback:', e);
        webfftEngine = null;
    }
}

// Shared calculation buffers
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

// Averaging buffers (applied on H(f), not raw Y)
let avgHReal: Float32Array;
let avgHImag: Float32Array;

// Coherence accumulator state
let cohGxx: Float32Array;
let cohGyy: Float32Array;
let cohGxyR: Float32Array;
let cohGxyI: Float32Array;
let cohAlpha = 0.1;

let currentBins = 0;
let currentFftSize = 0;

let averagingProcessor: ComplexAveraging | null = null;
const windowProcessor = new WindowFunction();

function feedCoherence(
    refR: Float32Array, refI: Float32Array,
    measR: Float32Array, measI: Float32Array,
    bins: number
): void {
    for (let k = 0; k < bins; k++) {
        const xx = refR[k] * refR[k] + refI[k] * refI[k];
        const yy = measR[k] * measR[k] + measI[k] * measI[k];
        const xyR = measR[k] * refR[k] + measI[k] * refI[k];
        const xyI = measI[k] * refR[k] - measR[k] * refI[k];

        cohGxx[k] += (xx - cohGxx[k]) * cohAlpha;
        cohGyy[k] += (yy - cohGyy[k]) * cohAlpha;
        cohGxyR[k] += (xyR - cohGxyR[k]) * cohAlpha;
        cohGxyI[k] += (xyI - cohGxyI[k]) * cohAlpha;
    }
}

function computeCoherence(output: Float32Array, bins: number): void {
    for (let k = 0; k < bins; k++) {
        const crossMagSq = cohGxyR[k] * cohGxyR[k] + cohGxyI[k] * cohGxyI[k];
        const denom = cohGxx[k] * cohGyy[k] + 1e-12;
        // γ = |Gxy| / √(Gxx·Gyy) — como OSM (no γ²)
        output[k] = Math.min(1, Math.max(0, Math.sqrt(crossMagSq) / Math.sqrt(denom)));
    }
}

function circularShift(buffer: Float32Array, samples: number): void {
    const N = buffer.length;
    const shift = ((samples % N) + N) % N;
    if (shift === 0) return;
    const temp = new Float32Array(shift);
    temp.set(buffer.subarray(0, shift));
    buffer.copyWithin(0, shift);
    buffer.set(temp, N - shift);
}

self.onmessage = (event) => {
    if (event.data && event.data.type === 'run-dsp') {
        const {
            measTimeDomain,
            refTimeDomain,
            BINS,
            FFT_SIZE,
            metrics,
            windowType,
            weightingType,
            averagingType,
            averagingDepth,
            averagingAlpha,
            averagingThresholdDb,
            enableSourceWindow,
            sourceWindowWidthMs,
            sourceWindowOffsetMs,
            sampleRate,
            compensationDelaySamples,
            autoDelayCompensation,
        } = event.data;

        const sr = sampleRate || 48000;

        // Validar datos reales
        if (!measTimeDomain || !refTimeDomain) return;

        // WebFFT initialization if FFT_SIZE changes
        if (FFT_SIZE && FFT_SIZE !== webfftSize) {
            initWebFFT(FFT_SIZE);
        }

        // Re-allocate only if dimensions changed
        if (BINS !== currentBins || FFT_SIZE !== currentFftSize) {
            currentBins = BINS;
            currentFftSize = FFT_SIZE;

            fftInputReal = new Float32Array(FFT_SIZE);
            fftInputImag = new Float32Array(FFT_SIZE);
            fftRefReal = new Float32Array(FFT_SIZE);
            fftRefImag = new Float32Array(FFT_SIZE);
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

            avgHReal = new Float32Array(BINS);
            avgHImag = new Float32Array(BINS);

            // Coherence accumulator
            cohGxx = new Float32Array(BINS);
            cohGyy = new Float32Array(BINS);
            cohGxyR = new Float32Array(BINS);
            cohGxyI = new Float32Array(BINS);

            averagingProcessor = new ComplexAveraging(BINS, averagingDepth || 16);
        }

        if (averagingProcessor) {
            averagingProcessor.setDepth(averagingDepth || 16);
        }
        cohAlpha = averagingAlpha || 0.1;

        const metricsSet = new Set<string>(metrics);

        // --- PIPELINE REAL ---

        const meas = new Float32Array(measTimeDomain);
        const ref = new Float32Array(refTimeDomain);

        // 1. Calcular niveles Peak/RMS ANTES de aplicar ventana
        const refLevel = processSignalLevel(ref);
        const measLevel = processSignalLevel(meas);

        // 2. Delay compensation en la referencia
        if (compensationDelaySamples && compensationDelaySamples > 0) {
            circularShift(ref, compensationDelaySamples);
        }

        // 3. Aplicar ventana pre-FFT a ambos canales
        const winType = windowType || 'Hann';
        if (winType !== 'Rectangular') {
            windowProcessor.apply(meas, winType);
            windowProcessor.apply(ref, winType);
        }

        // 3b. DC removal (como OSM: resta media integrada post-ventana)
        let dcMeas = 0, dcRef = 0;
        for (let i = 0; i < FFT_SIZE; i++) {
            dcMeas += meas[i];
            dcRef += ref[i];
        }
        dcMeas /= FFT_SIZE;
        dcRef /= FFT_SIZE;
        for (let i = 0; i < FFT_SIZE; i++) {
            meas[i] -= dcMeas;
            ref[i] -= dcRef;
        }

        // 4. FFT de ambos canales → espectros complejos REALES
        fft(ref, fftRefReal, fftRefImag);       // X(f) REAL
        fft(meas, fftInputReal, fftInputImag);  // Y(f) REAL

        // Tomar solo la primera mitad (bins positivos)
        // fft() ya devuelve el espectro completo; usamos los primeros BINS

        // 5. Transfer Function H(f) = Y·conj(X) / |X|²
        const needMagnitude = metricsSet.has("Magnitude") || metricsSet.has("Impulse") || metricsSet.has("Step");
        const needPhase = metricsSet.has("Phase") || metricsSet.has("Group Delay");
        const needImpulse = metricsSet.has("Impulse") || metricsSet.has("Step");

        if (needMagnitude) {
            calculateMagnitude(
                fftInputReal, fftInputImag,
                fftRefReal, fftRefImag,
                outputMagnitude, hReal, hImag,
            );
        }

        // 6. Averaging sobre H(f)
        if (averagingProcessor && averagingType !== 'None' && needMagnitude) {
            if (averagingType === 'FIFO') {
                averagingProcessor.processFIFO(hReal, hImag, avgHReal, avgHImag, averagingThresholdDb);
                hReal.set(avgHReal);
                hImag.set(avgHImag);
                // Recalcular magnitud desde H promediada
                for (let k = 0; k < BINS; k++) {
                    const mag = Math.sqrt(hReal[k] * hReal[k] + hImag[k] * hImag[k]);
                    outputMagnitude[k] = 20 * Math.log10(mag + 1e-8);
                }
            } else if (averagingType === 'LPF') {
                averagingProcessor.processLPF(hReal, hImag, avgHReal, avgHImag, averagingAlpha || 0.1);
                hReal.set(avgHReal);
                hImag.set(avgHImag);
                for (let k = 0; k < BINS; k++) {
                    const mag = Math.sqrt(hReal[k] * hReal[k] + hImag[k] * hImag[k]);
                    outputMagnitude[k] = 20 * Math.log10(mag + 1e-8);
                }
            }
        }

        // 7. Phase de H(f)
        if (needPhase) {
            calculatePhase(
                fftInputReal, fftInputImag,
                fftRefReal, fftRefImag,
                outputPhase,
            );
        }

        // 8. Coherencia real
        feedCoherence(fftRefReal, fftRefImag, fftInputReal, fftInputImag, BINS);
        computeCoherence(outputCoherence, BINS);

        // 9. Impulse Response = IFFT(H(f))
        if (needImpulse) {
            deconvolve(
                fftInputReal, fftInputImag,
                fftRefReal, fftRefImag,
                outputImpulse,
                tempFullReal, tempFullImag,
                tempFullRealOut, tempFullImagOut
            );

            if (enableSourceWindow) {
                applySourceWindow(outputImpulse, sourceWindowWidthMs, sourceWindowOffsetMs, sr);
            }
        }

        // 10. Step Response
        if (metricsSet.has("Step")) {
            calculateStepResponse(outputImpulse, outputStep, sr);
        }

        // 11. Group Delay
        if (metricsSet.has("Group Delay")) {
            for (let k = 0; k < BINS; k++) {
                tempPhaseRadians[k] = (outputPhase[k] * Math.PI) / 180;
            }
            calculateGroupDelay(tempPhaseRadians, (sr / 2) / BINS, outputGroupDelay);
        }

        // 12. Crest Factor real (time-domain)
        const globalCF = measLevel.peakDb - measLevel.rmsDb;
        outputCrestFactor.fill(Math.max(0, Math.min(30, globalCF)));

        // 13. Auto delay compensation — detectar pico del IR
        let detectedDelaySamples = 0;
        if (autoDelayCompensation && needImpulse) {
            let peakVal = 0;
            for (let i = 0; i < outputImpulse.length; i++) {
                const absVal = Math.abs(outputImpulse[i]);
                if (absVal > peakVal) {
                    peakVal = absVal;
                    detectedDelaySamples = i;
                }
            }
        }

        // --- ENVIAR RESULTADOS ---
        const magBuf = outputMagnitude.buffer;
        const phaseBuf = outputPhase.buffer;
        const cohBuf = outputCoherence.buffer;
        const gdBuf = outputGroupDelay.buffer;
        const impBuf = outputImpulse.buffer;
        const stepBuf = outputStep.buffer;
        const cfBuf = outputCrestFactor.buffer;
        const hRealBuf = hReal.buffer;
        const hImagBuf = hImag.buffer;

        (self as any).postMessage({
            type: 'dsp-results',
            outputMagnitude: magBuf,
            outputPhase: phaseBuf,
            outputCoherence: cohBuf,
            outputGroupDelay: gdBuf,
            outputImpulse: impBuf,
            outputStep: stepBuf,
            outputCrestFactor: cfBuf,
            hReal: hRealBuf,
            hImag: hImagBuf,
            refPeakDb: refLevel.peakDb,
            refRmsDb: refLevel.rmsDb,
            measPeakDb: measLevel.peakDb,
            measRmsDb: measLevel.rmsDb,
            detectedDelaySamples,
        }, [magBuf, phaseBuf, cohBuf, gdBuf, impBuf, stepBuf, cfBuf, hRealBuf, hImagBuf]);

        // Realocar buffers transferidos
        outputMagnitude = new Float32Array(currentBins);
        outputPhase = new Float32Array(currentBins);
        outputCoherence = new Float32Array(currentBins);
        outputGroupDelay = new Float32Array(currentBins);
        outputImpulse = new Float32Array(currentFftSize);
        outputStep = new Float32Array(currentFftSize);
        outputCrestFactor = new Float32Array(currentBins);
        hReal = new Float32Array(currentBins);
        hImag = new Float32Array(currentBins);
    }
};
