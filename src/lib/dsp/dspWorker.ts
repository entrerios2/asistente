import {
    calculateMagnitude,
    calculatePhase,
    calculateImpulseResponse,
    calculateStepResponse,
    calculateGroupDelay,
} from './osmMetrics';

function getPhaseValueRadians(freq: number, isMeasuring: boolean, eqBands: any[]): number {
    const delayMs = 1.4;
    let phase = -2 * Math.PI * freq * (delayMs / 1000);

    for (let b = 0; b < eqBands.length; b++) {
        const band = eqBands[b];
        const dist = Math.log2(freq / band.freq || 1e-6);
        const weight = dist / (1 + dist * dist * band.q);
        phase += band.gain * 0.04 * weight;
    }
    if (isMeasuring) {
        phase += (Math.random() - 0.5) * 0.04;
    }
    return phase;
}

function getCoherenceValue(freq: number, isMeasuring: boolean, eqBands: any[]): number {
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

self.onmessage = (event) => {
    if (event.data && event.data.type === 'run-dsp') {
        const {
            liveData,
            BINS,
            FFT_SIZE,
            eqResponseCache,
            eqBands,
            isMeasuring,
            metrics
        } = event.data;

        const metricsSet = new Set<string>(metrics);

        const liveTraceData = liveData ? new Float32Array(liveData) : null;

        // Shared calculation buffers in worker context
        const fftInputReal = new Float32Array(BINS);
        const fftInputImag = new Float32Array(BINS);
        const fftRefReal = new Float32Array(BINS);
        const fftRefImag = new Float32Array(BINS);
        const hReal = new Float32Array(BINS);
        const hImag = new Float32Array(BINS);

        const tempFullReal = new Float32Array(FFT_SIZE);
        const tempFullImag = new Float32Array(FFT_SIZE);
        const tempFullRealOut = new Float32Array(FFT_SIZE);
        const tempFullImagOut = new Float32Array(FFT_SIZE);

        const outputMagnitude = new Float32Array(BINS);
        const outputPhase = new Float32Array(BINS);
        const outputCoherence = new Float32Array(BINS);
        const outputGroupDelay = new Float32Array(BINS);
        const outputImpulse = new Float32Array(FFT_SIZE);
        const outputStep = new Float32Array(FFT_SIZE);
        const tempPhaseRadians = new Float32Array(BINS);

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
            } else {
                const binWidth = 24000 / BINS;
                const idx = Math.max(0, Math.min(BINS - 1, Math.round(f_k / binWidth)));
                const eqGain = eqResponseCache[idx] || 0;
                liveDb = -50 + eqGain + Math.sin(k * 0.08) * 0.3;
            }

            const liveMag = Math.pow(10, liveDb / 20);
            const phaseTotal = getPhaseValueRadians(f_k, isMeasuring, eqBands) + refPhase;

            fftInputReal[k] = liveMag * Math.cos(phaseTotal);
            fftInputImag[k] = liveMag * Math.sin(phaseTotal);
            fftRefReal[k] = refMag * Math.cos(refPhase);
            fftRefImag[k] = refMag * Math.sin(refPhase);

            outputCoherence[k] = getCoherenceValue(f_k, isMeasuring, eqBands);
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
        if (needImpulse) {
            calculateImpulseResponse(
                hReal,
                hImag,
                outputImpulse,
                tempFullReal,
                tempFullImag,
                tempFullRealOut,
                tempFullImagOut,
            );
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
            outputMagnitude: outputMagnitude.buffer,
            outputPhase: outputPhase.buffer,
            outputCoherence: outputCoherence.buffer,
            outputGroupDelay: outputGroupDelay.buffer,
            outputImpulse: outputImpulse.buffer,
            outputStep: outputStep.buffer,
            dbIn
        }, [
            outputMagnitude.buffer,
            outputPhase.buffer,
            outputCoherence.buffer,
            outputGroupDelay.buffer,
            outputImpulse.buffer,
            outputStep.buffer
        ]);
    }
};
