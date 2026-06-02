import {
    calculateMagnitude,
    calculatePhase,
    calculateImpulseResponse,
    calculateStepResponse,
    calculateGroupDelay,
} from './osmMetrics';

function getPhaseValueRadians(freq: number, isMeasuring: boolean, eqBands: any[], calibrationFilters: any[]): number {
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
                    b2 = A * ((A + 1) + (A - 1) * cosW0 - sqrtA2alpha);
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

function getCalibrationGainAt(freq: number, pts: any[]): number {
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

                // 1. Aplicar ganancia de entrada (Prompt 7)
                liveDb += inputGain || 0;

                // 2. Compensar curva de calibración acústica (Prompt 7)
                liveDb -= getCalibrationGainAt(f_k, calibrationPoints);

                // 3. Aplicar offset absoluto de visualización (Prompt 7)
                liveDb += displayOffset || 0;
            } else {
                const binWidth = 24000 / BINS;
                const idx = Math.max(0, Math.min(BINS - 1, Math.round(f_k / binWidth)));
                const eqGain = eqResponseCache[idx] || 0;
                liveDb = -50 + eqGain + Math.sin(k * 0.08) * 0.3;

                // Aplicar offset de visualización al simulado también
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
