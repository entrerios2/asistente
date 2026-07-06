import { fft, ifft } from '../../../dsp/fft';

export function computeTransferFunction(refBuffer: Float32Array, measBuffer: Float32Array, sampleRate: number) {
    const minLen = Math.min(refBuffer.length, measBuffer.length);
    const fftSize = 1 << Math.floor(Math.log2(minLen));

    if (fftSize < 64) return null;

    const bins = fftSize / 2;
    const hopSize = fftSize / 2;
    const numWindows = Math.max(1, Math.floor((minLen - fftSize) / hopSize) + 1);

    const window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    const gxx = new Float32Array(bins);
    const gyy = new Float32Array(bins);
    const gxyReal = new Float32Array(bins);
    const gxyImag = new Float32Array(bins);

    const refWin = new Float32Array(fftSize);
    const measWin = new Float32Array(fftSize);

    for (let w = 0; w < numWindows; w++) {
        const offset = Math.round(w * hopSize);
        for (let i = 0; i < fftSize; i++) {
            refWin[i] = refBuffer[offset + i] * window[i];
            measWin[i] = measBuffer[offset + i] * window[i];
        }

        const X = fft(refWin);
        const Y = fft(measWin);

        for (let k = 0; k < bins; k++) {
            const xR = X.real[k], xI = X.imag[k];
            const yR = Y.real[k], yI = Y.imag[k];
            gxx[k] += xR * xR + xI * xI;
            gyy[k] += yR * yR + yI * yI;
            gxyReal[k] += yR * xR + yI * xI;
            gxyImag[k] += yI * xR - yR * xI;
        }
    }

    const hReal = new Float32Array(bins);
    const hImag = new Float32Array(bins);
    const magnitude = new Float32Array(bins);
    const phase = new Float32Array(bins);
    const coherence = new Float32Array(bins);
    const frequencies = new Float32Array(bins);

    for (let k = 0; k < bins; k++) {
        const avgGxx = gxx[k] / numWindows;
        const avgGyy = gyy[k] / numWindows;
        const avgGxyR = gxyReal[k] / numWindows;
        const avgGxyI = gxyImag[k] / numWindows;

        const denom = Math.max(avgGxx, 1e-12);
        hReal[k] = avgGxyR / denom;
        hImag[k] = avgGxyI / denom;

        const mag = Math.sqrt(hReal[k] * hReal[k] + hImag[k] * hImag[k]);
        magnitude[k] = 20 * Math.log10(Math.max(mag, 1e-12));
        phase[k] = (Math.atan2(hImag[k], hReal[k]) * 180) / Math.PI;

        const gxyMagSq = avgGxyR * avgGxyR + avgGxyI * avgGxyI;
        const cohDenom = avgGxx * avgGyy;
        coherence[k] = cohDenom > 1e-24 ? Math.min(gxyMagSq / cohDenom, 1) : 0;
        frequencies[k] = (k * sampleRate) / fftSize;
    }

    return { hReal, hImag, magnitude, phase, coherence, frequencies, fftSize, bins, numWindows };
}

export function computeImpulseResponse(hReal: Float32Array, hImag: Float32Array, fftSize: number): Float32Array {
    const fullReal = new Float32Array(fftSize);
    const fullImag = new Float32Array(fftSize);
    const bins = fftSize / 2;

    fullReal[0] = hReal[0];
    fullImag[0] = 0;
    for (let k = 1; k < bins; k++) {
        fullReal[k] = hReal[k];
        fullImag[k] = hImag[k];
        fullReal[fftSize - k] = hReal[k];
        fullImag[fftSize - k] = -hImag[k];
    }
    fullReal[bins] = hReal[bins - 1];
    fullImag[bins] = 0;

    return ifft(fullReal, fullImag);
}

export function computeGroupDelay(hReal: Float32Array, hImag: Float32Array, sampleRate: number, fftSize: number): Float32Array {
    const bins = fftSize / 2;
    const groupDelay = new Float32Array(bins);
    const binWidth = sampleRate / fftSize;

    for (let k = 0; k < bins; k++) {
        const kPrev = Math.max(k - 1, 0);
        const kNext = Math.min(k + 1, bins - 1);
        const magSq = hReal[k] * hReal[k] + hImag[k] * hImag[k];
        if (magSq < 1e-24) { groupDelay[k] = 0; continue; }
        const dRe = (hReal[kNext] - hReal[kPrev]) / (2 * binWidth);
        const dIm = (hImag[kNext] - hImag[kPrev]) / (2 * binWidth);
        const gd = -(hReal[k] * dIm - hImag[k] * dRe) / magSq;
        groupDelay[k] = gd * 1000;
    }

    return groupDelay;
}

export function computePhaseDelay(phaseRad: Float32Array, frequencies: Float32Array): Float32Array {
    const bins = phaseRad.length;
    const phaseDelay = new Float32Array(bins);
    for (let k = 1; k < bins; k++) {
        const f = frequencies[k];
        if (f > 0) {
            const gd = -phaseRad[k] / (2 * Math.PI * f);
            phaseDelay[k] = gd * 1000;
        }
    }
    return phaseDelay;
}

export function computeSpectrum(buffer: Float32Array, sampleRate: number) {
    const fftSize = 1 << Math.floor(Math.log2(buffer.length));
    if (fftSize < 64) return null;

    const bins = fftSize / 2;
    const window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    const winBuf = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) winBuf[i] = buffer[i] * window[i];

    const result = fft(winBuf);
    const spectrum = new Float32Array(bins);
    const frequencies = new Float32Array(bins);

    for (let k = 0; k < bins; k++) {
        const mag = Math.sqrt(result.real[k] * result.real[k] + result.imag[k] * result.imag[k]);
        const magNorm = mag / fftSize;
        spectrum[k] = 20 * Math.log10(Math.max(magNorm, 1e-12));
        frequencies[k] = (k * sampleRate) / fftSize;
    }

    return { spectrum, frequencies, fftSize, bins };
}
