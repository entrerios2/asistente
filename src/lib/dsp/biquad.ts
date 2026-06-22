/**
 * Calcula los coeficientes biquad según Robert Bristow-Johnson Audio EQ Cookbook.
 * Retorna [b0, b1, b2, a0, a1, a2] normalizados por a0.
 */
export function peakingCoeffs(fc: number, gain: number, Q: number, fs: number): number[] {
    const A  = Math.pow(10, gain / 40); // gain en dB
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 =  1 + alpha * A;
    const b1 = -2 * cosW0;
    const b2 =  1 - alpha * A;
    const a0 =  1 + alpha / A;
    const a1 = -2 * cosW0;
    const a2 =  1 - alpha / A;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

export function lowShelfCoeffs(fc: number, gain: number, Q: number, fs: number): number[] {
    const A  = Math.pow(10, gain / 40);
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / 2 * Math.sqrt((A + 1/A) * (1/Q - 1) + 2);
    const sqrtA2alpha = 2 * Math.sqrt(A) * alpha;

    const b0 =      A * ((A + 1) - (A - 1) * cosW0 + sqrtA2alpha);
    const b1 =  2 * A * ((A - 1) - (A + 1) * cosW0);
    const b2 =      A * ((A + 1) - (A - 1) * cosW0 - sqrtA2alpha);
    const a0 =           (A + 1) + (A - 1) * cosW0 + sqrtA2alpha;
    const a1 =     -2 * ((A - 1) + (A + 1) * cosW0);
    const a2 =           (A + 1) + (A - 1) * cosW0 - sqrtA2alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

export function highShelfCoeffs(fc: number, gain: number, Q: number, fs: number): number[] {
    const A  = Math.pow(10, gain / 40);
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / 2 * Math.sqrt((A + 1/A) * (1/Q - 1) + 2);
    const sqrtA2alpha = 2 * Math.sqrt(A) * alpha;

    const b0 =      A * ((A + 1) + (A - 1) * cosW0 + sqrtA2alpha);
    const b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
    const b2 =      A * ((A + 1) + (A - 1) * cosW0 - sqrtA2alpha);
    const a0 =           (A + 1) - (A - 1) * cosW0 + sqrtA2alpha;
    const a1 =      2 * ((A - 1) - (A + 1) * cosW0);
    const a2 =           (A + 1) - (A - 1) * cosW0 - sqrtA2alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

export function lowpassCoeffs(fc: number, _gain: number, Q: number, fs: number): number[] {
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 = (1 - cosW0) / 2;
    const b1 =  1 - cosW0;
    const b2 = (1 - cosW0) / 2;
    const a0 =  1 + alpha;
    const a1 = -2 * cosW0;
    const a2 =  1 - alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

export function highpassCoeffs(fc: number, _gain: number, Q: number, fs: number): number[] {
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 =  (1 + cosW0) / 2;
    const b1 = -(1 + cosW0);
    const b2 =  (1 + cosW0) / 2;
    const a0 =  1 + alpha;
    const a1 = -2 * cosW0;
    const a2 =  1 - alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

export function notchCoeffs(fc: number, _gain: number, Q: number, fs: number): number[] {
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 =  1;
    const b1 = -2 * cosW0;
    const b2 =  1;
    const a0 =  1 + alpha;
    const a1 = -2 * cosW0;
    const a2 =  1 - alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

export function bandpassCoeffs(fc: number, _gain: number, Q: number, fs: number): number[] {
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 =  alpha;
    const b1 =  0;
    const b2 = -alpha;
    const a0 =  1 + alpha;
    const a1 = -2 * cosW0;
    const a2 =  1 - alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

/**
 * F1: Coefficient memoization cache.
 * Key: "type|fc|gain|Q|fs" (rounded to 3 decimals for floating point stability).
 * LRU eviction at 256 entries to bound memory.
 */
const _coeffCache = new Map<string, number[]>();
const _COEFF_CACHE_MAX = 256;

function _coeffCacheKey(type: string, fc: number, gain: number, Q: number, fs: number): string {
    return `${type}|${fc.toFixed(3)}|${gain.toFixed(3)}|${Q.toFixed(3)}|${fs}`;
}

export function getCoeffsForType(
    type: string, fc: number, gain: number, Q: number, fs: number
): number[] {
    const key = _coeffCacheKey(type, fc, gain, Q, fs);
    const cached = _coeffCache.get(key);
    if (cached) return cached;

    let result: number[];
    switch (type) {
        case 'peaking':                        result = peakingCoeffs(fc, gain, Q, fs); break;
        case 'low_shelf':  case 'lowshelf':    result = lowShelfCoeffs(fc, gain, Q, fs); break;
        case 'high_shelf': case 'highshelf':   result = highShelfCoeffs(fc, gain, Q, fs); break;
        case 'lowpass':                        result = lowpassCoeffs(fc, gain, Q, fs); break;
        case 'highpass':                       result = highpassCoeffs(fc, gain, Q, fs); break;
        case 'notch':                          result = notchCoeffs(fc, gain, Q, fs); break;
        case 'bandpass':                       result = bandpassCoeffs(fc, gain, Q, fs); break;
        default:                               result = peakingCoeffs(fc, gain, Q, fs); break;
    }

    // LRU eviction: remove oldest if at capacity
    if (_coeffCache.size >= _COEFF_CACHE_MAX) {
        const firstKey = _coeffCache.keys().next().value;
        if (firstKey !== undefined) _coeffCache.delete(firstKey);
    }
    _coeffCache.set(key, result);
    return result;
}

/**
 * Evalúa la respuesta compleja H(e^jω) de un filtro biquad en una frecuencia dada.
 * Retorna [magnitudDb, phaseRad].
 */
export function biquadResponse(
    coeffs: number[], freq: number, fs: number
): [number, number] {
    const [b0, b1, b2, a0, a1, a2] = coeffs;
    const w = 2 * Math.PI * freq / fs;
    const cosW  = Math.cos(w);
    const sinW  = Math.sin(w);
    const cos2W = Math.cos(2 * w);
    const sin2W = Math.sin(2 * w);

    const numReal = b0 + b1 * cosW + b2 * cos2W;
    const numImag = -(b1 * sinW + b2 * sin2W);
    const denReal = a0 + a1 * cosW + a2 * cos2W;
    const denImag = -(a1 * sinW + a2 * sin2W);

    const numMagSq = numReal * numReal + numImag * numImag;
    const denMagSq = denReal * denReal + denImag * denImag;

    const magnitudeDb = 10 * Math.log10(numMagSq / (denMagSq + 1e-20));
    const phaseRad = Math.atan2(numImag, numReal) - Math.atan2(denImag, denReal);

    return [magnitudeDb, phaseRad];
}

/**
 * Versión optimizada para llenar un cache completo de BINS frecuencias.
 * Evita crear arrays intermedios — escribe directo en buffers pre-alocados.
 * Alineada con la directiva de Zero-Allocation.
 */
export function fillBiquadResponseCache(
    coeffs: number[],
    bins: number,
    fs: number,
    outMagnitude: Float32Array,
    outPhase: Float32Array
): void {
    const [b0, b1, b2, a0, a1, a2] = coeffs;
    const nyquist = fs / 2;

    for (let i = 0; i < bins; i++) {
        const freq = (i * nyquist) / bins || 1e-6;
        const w = 2 * Math.PI * freq / fs;
        const cosW  = Math.cos(w);
        const sinW  = Math.sin(w);
        const cos2W = Math.cos(2 * w);
        const sin2W = Math.sin(2 * w);

        const nR = b0 + b1 * cosW + b2 * cos2W;
        const nI = -(b1 * sinW + b2 * sin2W);
        const dR = a0 + a1 * cosW + a2 * cos2W;
        const dI = -(a1 * sinW + a2 * sin2W);

        const nSq = nR * nR + nI * nI;
        const dSq = dR * dR + dI * dI;

        outMagnitude[i] = 10 * Math.log10(nSq / (dSq + 1e-20));
        outPhase[i] = Math.atan2(nI, nR) - Math.atan2(dI, dR);
    }
}
