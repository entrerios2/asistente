/**
 * Deviation metrics for evaluating EQ effectiveness.
 * Compares measured/corrected response against a target curve.
 */

export interface DeviationResult {
    rms: number;              // RMS deviation (dB)
    peak: number;             // Peak deviation (dB)
    count: number;            // Bins evaluated
    weightedMSE: number;      // MSE weighted by coherence
    meanDeviation: number;    // Mean deviation with sign (bias)
    percentWithin3dB: number; // % of bins within ±3dB of target
    percentWithin6dB: number; // % of bins within ±6dB of target
}

export function computeDeviation(
    magnitude: Float32Array,
    target: Float32Array | null,
    coherence: Float32Array | null,
    bins: number,
    sampleRate: number = 48000,
    freqMin: number = 20,
    freqMax: number = 20000,
    cohThreshold: number = 0.5
): DeviationResult {
    const binWidth = (sampleRate / 2) / bins;
    let sumSq = 0;
    let maxAbs = 0;
    let count = 0;
    let weightedSumSq = 0;
    let totalWeight = 0;
    let sumDiff = 0;
    let within3dB = 0;
    let within6dB = 0;

    for (let i = 0; i < bins; i++) {
        const freq = i * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        if (coherence && coherence[i] < cohThreshold) continue;

        const measured = magnitude[i] || 0;
        const tgt = target ? (target[i] || 0) : 0;
        const diff = measured - tgt;
        const absDiff = Math.abs(diff);

        sumSq += diff * diff;
        maxAbs = Math.max(maxAbs, absDiff);
        sumDiff += diff;
        count++;

        if (absDiff < 3) within3dB++;
        if (absDiff < 6) within6dB++;

        // Weighted MSE (weight = coherence)
        const w = coherence ? coherence[i] : 1.0;
        weightedSumSq += w * diff * diff;
        totalWeight += w;
    }

    return {
        rms: count > 0 ? Math.sqrt(sumSq / count) : 0,
        peak: maxAbs,
        count,
        weightedMSE: totalWeight > 0 ? weightedSumSq / totalWeight : 0,
        meanDeviation: count > 0 ? sumDiff / count : 0,
        percentWithin3dB: count > 0 ? (within3dB / count) * 100 : 0,
        percentWithin6dB: count > 0 ? (within6dB / count) * 100 : 0,
    };
}

/**
 * H2: Compute spatial consistency (σ between multiple snapshots) after EQ.
 * Measures how uniform the correction is across different positions.
 * Target: σ < 3dB (SMPTE 202M / McCarthy §14).
 */
export function computeSpatialConsistency(
    snapshots: Float32Array[],
    eqResponse: Float32Array,
    bins: number,
    sampleRate: number = 48000,
    freqRange: [number, number] = [20, 20000],
): {
    stdDevPerBin: Float32Array;
    meanStdDev: number;
    maxStdDev: number;
} {
    const binWidth = (sampleRate / 2) / bins;
    const stdDevPerBin = new Float32Array(bins);
    let sumStdDev = 0;
    let maxStdDev = 0;
    let validBins = 0;

    const N = snapshots.length;
    if (N < 2) {
        return { stdDevPerBin, meanStdDev: 0, maxStdDev: 0 };
    }

    for (let i = 0; i < bins; i++) {
        const freq = i * binWidth;
        if (freq < freqRange[0] || freq > freqRange[1]) continue;

        // Compute mean of (snapshot + EQ) at this bin
        let mean = 0;
        for (let s = 0; s < N; s++) {
            mean += (snapshots[s][i] || 0) + (eqResponse[i] || 0);
        }
        mean /= N;

        // Compute variance
        let variance = 0;
        for (let s = 0; s < N; s++) {
            const val = (snapshots[s][i] || 0) + (eqResponse[i] || 0);
            const diff = val - mean;
            variance += diff * diff;
        }
        variance /= N;

        const stdDev = Math.sqrt(variance);
        stdDevPerBin[i] = stdDev;
        sumStdDev += stdDev;
        maxStdDev = Math.max(maxStdDev, stdDev);
        validBins++;
    }

    return {
        stdDevPerBin,
        meanStdDev: validBins > 0 ? sumStdDev / validBins : 0,
        maxStdDev,
    };
}

/**
 * Compute the EQ score badge showing before/after deviation.
 * Extracted from Quadrant.svelte's $derived.by to keep the component lean.
 */
export function computeEQScoreBadge(
    magnitude: Float32Array,
    coherence: Float32Array,
    target: Float32Array,
    bins: number,
    sampleRate: number,
    getEQResponse: (f: number) => number,
): { before: DeviationResult; after: DeviationResult } | null {
    if (!magnitude || magnitude.length === 0) return null;

    const before = computeDeviation(magnitude, target, coherence, bins, sampleRate);

    // Compute corrected magnitude
    const binWidth = (sampleRate / 2) / bins;
    const adjusted = new Float32Array(bins);
    for (let i = 0; i < bins; i++) {
        const freq = i * binWidth || 1e-6;
        adjusted[i] = (magnitude[i] || 0) + getEQResponse(freq);
    }
    const after = computeDeviation(adjusted, target, coherence, bins, sampleRate);

    return { before, after };
}
