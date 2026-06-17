export interface DeviationResult {
    rms: number;
    peak: number;
    count: number;
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

    for (let i = 0; i < bins; i++) {
        const freq = i * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        if (coherence && coherence[i] < cohThreshold) continue;

        const measured = magnitude[i] || 0;
        const tgt = target ? (target[i] || 0) : 0;
        const diff = measured - tgt;

        sumSq += diff * diff;
        maxAbs = Math.max(maxAbs, Math.abs(diff));
        count++;
    }

    return {
        rms: count > 0 ? Math.sqrt(sumSq / count) : 0,
        peak: maxAbs,
        count
    };
}
