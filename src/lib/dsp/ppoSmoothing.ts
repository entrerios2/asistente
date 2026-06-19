/**
 * PPO (Points Per Octave) Fractional-Octave Smoothing
 * Standard technique for frequency-domain data visualization.
 * 
 * For each bin k at frequency f(k), averages all bins within
 * [f(k) / 2^(1/(2*PPO)), f(k) * 2^(1/(2*PPO))].
 * 
 * This is applied post-processing (after averaging, calibration, etc.)
 * as a display-only smoothing operation.
 */

// Pre-allocated static buffers to avoid GC pressure
let _smoothedMag: Float32Array | null = null;
let _smoothedPhase: Float32Array | null = null;
let _bufBins = 0;

function getSmoothedMag(bins: number): Float32Array {
    if (!_smoothedMag || _bufBins !== bins) {
        _smoothedMag = new Float32Array(bins);
        _smoothedPhase = new Float32Array(bins);
        _bufBins = bins;
    }
    return _smoothedMag;
}

function getSmoothedPhase(bins: number): Float32Array {
    if (!_smoothedPhase || _bufBins !== bins) {
        _smoothedMag = new Float32Array(bins);
        _smoothedPhase = new Float32Array(bins);
        _bufBins = bins;
    }
    return _smoothedPhase;
}

/**
 * Apply fractional-octave smoothing to a frequency-domain buffer (in dB).
 * @param data - Input array in dB (modified in-place)
 * @param bins - Number of bins
 * @param sampleRate - Sample rate in Hz
 * @param ppo - Points per octave (1, 3, 6, 12, 24, 48)
 */
export function applyPPOSmoothing(
    data: Float32Array,
    bins: number,
    sampleRate: number,
    ppo: number,
): void {
    if (ppo <= 0 || bins <= 0) return;

    const nyquist = sampleRate / 2;
    const freqPerBin = nyquist / bins;
    // Half-octave bandwidth factor: 2^(1/(2*PPO))
    const factor = Math.pow(2, 1 / (2 * ppo));

    // Reuse pre-allocated buffer
    const smoothed = getSmoothedMag(bins);

    for (let k = 1; k < bins; k++) {
        const fc = k * freqPerBin;
        const fLow = fc / factor;
        const fHigh = fc * factor;

        // Convert to bin indices
        const kLow = Math.max(1, Math.floor(fLow / freqPerBin));
        const kHigh = Math.min(bins - 1, Math.ceil(fHigh / freqPerBin));

        let sum = 0;
        const count = kHigh - kLow + 1;
        for (let j = kLow; j <= kHigh; j++) {
            sum += data[j];
        }
        smoothed[k] = sum / count;
    }

    // DC bin stays as-is
    smoothed[0] = data[0];

    // Copy back
    data.set(smoothed);
}

/**
 * Apply fractional-octave smoothing to phase data (in degrees).
 * Uses circular averaging to handle wrapping.
 */
export function applyPPOSmoothingPhase(
    data: Float32Array,
    bins: number,
    sampleRate: number,
    ppo: number,
): void {
    if (ppo <= 0 || bins <= 0) return;

    const nyquist = sampleRate / 2;
    const freqPerBin = nyquist / bins;
    const factor = Math.pow(2, 1 / (2 * ppo));
    const DEG2RAD = Math.PI / 180;
    const RAD2DEG = 180 / Math.PI;

    const smoothed = getSmoothedPhase(bins);

    for (let k = 1; k < bins; k++) {
        const fc = k * freqPerBin;
        const fLow = fc / factor;
        const fHigh = fc * factor;

        const kLow = Math.max(1, Math.floor(fLow / freqPerBin));
        const kHigh = Math.min(bins - 1, Math.ceil(fHigh / freqPerBin));

        // Circular average via sin/cos decomposition
        let sinSum = 0;
        let cosSum = 0;
        for (let j = kLow; j <= kHigh; j++) {
            const rad = data[j] * DEG2RAD;
            sinSum += Math.sin(rad);
            cosSum += Math.cos(rad);
        }
        smoothed[k] = Math.atan2(sinSum, cosSum) * RAD2DEG;
    }

    smoothed[0] = data[0];
    data.set(smoothed);
}
