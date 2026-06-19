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
import { createInputFilter, type InputFilterType, type BiquadIIR } from './iirFilter';

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
let outputSpectrum: Float32Array;

// Averaging buffers (applied on H(f), not raw Y)
let avgHReal: Float32Array;
let avgHImag: Float32Array;

// --- Coherence FIFO circular (como OSM) ---
const COH_DEFAULT_DEPTH = 21; // OSM default
let cohDepth = COH_DEFAULT_DEPTH;
let cohPointer = 0;

// Buffers FIFO: [depth][bins] para Grr, Gmm, Grm (complejo)
let cohFifoGrr: Float32Array[] = [];
let cohFifoGmm: Float32Array[] = [];
let cohFifoGrmR: Float32Array[] = [];
let cohFifoGrmI: Float32Array[] = [];

// Acumuladores (suma de todas las depth snapshots)
let cohSumGrr: Float32Array;
let cohSumGmm: Float32Array;
let cohSumGrmR: Float32Array;
let cohSumGrmI: Float32Array;

function initCoherenceFIFO(bins: number, depth: number): void {
    cohDepth = depth;
    cohPointer = 0;
    cohFifoGrr = Array.from({ length: depth }, () => new Float32Array(bins));
    cohFifoGmm = Array.from({ length: depth }, () => new Float32Array(bins));
    cohFifoGrmR = Array.from({ length: depth }, () => new Float32Array(bins));
    cohFifoGrmI = Array.from({ length: depth }, () => new Float32Array(bins));
    cohSumGrr = new Float32Array(bins);
    cohSumGmm = new Float32Array(bins);
    cohSumGrmR = new Float32Array(bins);
    cohSumGrmI = new Float32Array(bins);
}

function feedCoherenceFIFO(
    refR: Float32Array, refI: Float32Array,
    measR: Float32Array, measI: Float32Array,
    bins: number
): void {
    const p = cohPointer;
    for (let k = 0; k < bins; k++) {
        const rr = refR[k] * refR[k] + refI[k] * refI[k];
        const mm = measR[k] * measR[k] + measI[k] * measI[k];
        const rmR = refR[k] * measR[k] + refI[k] * measI[k]; // conj(ref) * meas
        const rmI = refR[k] * measI[k] - refI[k] * measR[k];

        // Subtract old snapshot, add new (running sum)
        cohSumGrr[k]  += rr  - cohFifoGrr[p][k];
        cohSumGmm[k]  += mm  - cohFifoGmm[p][k];
        cohSumGrmR[k] += rmR - cohFifoGrmR[p][k];
        cohSumGrmI[k] += rmI - cohFifoGrmI[p][k];

        // Store in FIFO slot
        cohFifoGrr[p][k]  = rr;
        cohFifoGmm[p][k]  = mm;
        cohFifoGrmR[p][k] = rmR;
        cohFifoGrmI[p][k] = rmI;
    }
    cohPointer = (p + 1) % cohDepth;
}

function computeCoherenceFIFO(output: Float32Array, bins: number): void {
    for (let k = 0; k < bins; k++) {
        const crmMagSq = cohSumGrmR[k] * cohSumGrmR[k] + cohSumGrmI[k] * cohSumGrmI[k];
        const denom = cohSumGrr[k] * cohSumGmm[k] + 1e-12;
        // γ = |Σ Crm| / √(Σ Crr · Σ Cmm) — como OSM
        output[k] = Math.min(1, Math.max(0, Math.sqrt(crmMagSq) / Math.sqrt(denom)));
    }
}

let currentBins = 0;
let currentFftSize = 0;

let averagingProcessor: ComplexAveraging | null = null;
const windowProcessor = new WindowFunction();

// Input filter state (F3)
let currentInputFilterMeas: BiquadIIR | null = null;
let currentInputFilterRef: BiquadIIR | null = null;
let currentInputFilterType: string = 'None';
let currentInputFilterSR: number = 0;

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
            inputGain,
            displayOffset,
            polarity,
            calibrationGain,
            inputFilter,
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
            outputSpectrum = new Float32Array(BINS);

            avgHReal = new Float32Array(BINS);
            avgHImag = new Float32Array(BINS);

            // Coherence FIFO
            initCoherenceFIFO(BINS, averagingDepth || COH_DEFAULT_DEPTH);

            averagingProcessor = new ComplexAveraging(BINS, averagingDepth || 16);
        }

        if (averagingProcessor) {
            averagingProcessor.setDepth(averagingDepth || 16);
        }


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

        // 2b. Input Gain (solo meas, pre-ventana)
        if (inputGain && inputGain !== 0) {
            const gainLinear = Math.pow(10, inputGain / 20);
            for (let i = 0; i < FFT_SIZE; i++) {
                meas[i] *= gainLinear;
            }
        }

        // 2c. Polarity inversion (solo meas, pre-ventana)
        if (polarity) {
            for (let i = 0; i < FFT_SIZE; i++) {
                meas[i] = -meas[i];
            }
        }

        // 2d. Input Filter pre-FFT (ambos canales, como OSM)
        if (inputFilter && inputFilter !== 'None') {
            if (!currentInputFilterMeas || currentInputFilterType !== inputFilter || currentInputFilterSR !== sr) {
                currentInputFilterType = inputFilter;
                currentInputFilterSR = sr;
                currentInputFilterMeas = createInputFilter(inputFilter as InputFilterType, sr);
                currentInputFilterRef = createInputFilter(inputFilter as InputFilterType, sr);
            }
            if (currentInputFilterMeas) currentInputFilterMeas.process(meas);
            if (currentInputFilterRef) currentInputFilterRef.process(ref);
        } else {
            // Filter disabled: reset to avoid stale state
            if (currentInputFilterMeas) {
                currentInputFilterMeas = null;
                currentInputFilterRef = null;
                currentInputFilterType = 'None';
            }
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

        // 4b. Spectrum (RTA) — magnitud absoluta del canal de medición con normalización 1/N
        if (metricsSet.has("Spectrum")) {
            for (let k = 0; k < BINS; k++) {
                const mag = Math.sqrt(fftInputReal[k] * fftInputReal[k] + fftInputImag[k] * fftInputImag[k]);
                outputSpectrum[k] = 20 * Math.log10((mag / FFT_SIZE) * Math.SQRT2 + 1e-12);  // 1/N + √2 (como OSM)
            }
            // Display Offset (solo Spectrum, en dB)
            if (displayOffset && displayOffset !== 0) {
                for (let k = 0; k < BINS; k++) {
                    outputSpectrum[k] += displayOffset;
                }
            }
        }

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

        // 6b. Display Offset (solo Magnitude, en dB)
        if (displayOffset && displayOffset !== 0 && needMagnitude) {
            for (let k = 0; k < BINS; k++) {
                outputMagnitude[k] += displayOffset;
            }
        }

        // 6c. Calibración de micrófono (solo Magnitude y Spectrum, en dB)
        if (calibrationGain) {
            const cal = new Float32Array(calibrationGain);
            if (needMagnitude) {
                for (let k = 0; k < BINS; k++) {
                    outputMagnitude[k] += cal[k];
                }
            }
            if (metricsSet.has("Spectrum")) {
                for (let k = 0; k < BINS; k++) {
                    outputSpectrum[k] += cal[k];
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

        // 8. Coherencia real (FIFO circular como OSM)
        feedCoherenceFIFO(fftRefReal, fftRefImag, fftInputReal, fftInputImag, BINS);
        computeCoherenceFIFO(outputCoherence, BINS);

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
        const specBuf = outputSpectrum.buffer;

        (self as any).postMessage({
            type: 'dsp-results',
            outputMagnitude: magBuf,
            outputPhase: phaseBuf,
            outputCoherence: cohBuf,
            outputGroupDelay: gdBuf,
            outputImpulse: impBuf,
            outputStep: stepBuf,
            outputCrestFactor: cfBuf,
            outputSpectrum: specBuf,
            hReal: hRealBuf,
            hImag: hImagBuf,
            refPeakDb: refLevel.peakDb,
            refRmsDb: refLevel.rmsDb,
            measPeakDb: measLevel.peakDb,
            measRmsDb: measLevel.rmsDb,
            detectedDelaySamples,
        }, [magBuf, phaseBuf, cohBuf, gdBuf, impBuf, stepBuf, cfBuf, specBuf, hRealBuf, hImagBuf]);

        // Realocar buffers transferidos
        outputMagnitude = new Float32Array(currentBins);
        outputPhase = new Float32Array(currentBins);
        outputCoherence = new Float32Array(currentBins);
        outputGroupDelay = new Float32Array(currentBins);
        outputImpulse = new Float32Array(currentFftSize);
        outputStep = new Float32Array(currentFftSize);
        outputCrestFactor = new Float32Array(currentBins);
        outputSpectrum = new Float32Array(currentBins);
        hReal = new Float32Array(currentBins);
        hImag = new Float32Array(currentBins);
    }

    // --- RESET AVERAGING ---
    if (event.data && event.data.type === 'reset-averaging') {
        if (currentBins > 0) {
            initCoherenceFIFO(currentBins, COH_DEFAULT_DEPTH);
        }
        if (averagingProcessor) {
            averagingProcessor.reset();
        }
    }
};
