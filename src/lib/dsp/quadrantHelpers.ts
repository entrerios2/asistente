/**
 * quadrantHelpers.ts — Pure logic extracted from Quadrant.svelte.
 *
 * Contains functions that don't depend on Svelte reactivity:
 * - PPO smoothing
 * - Metric domain exclusion logic
 * - Metric alpha calculation (solo/hover)
 * - EQ node hit testing
 * - EQ drag snapping (ISO 1/3 octave, gain steps)
 */

import { valToX, valToY, xToVal, yToVal, type InteractionState } from './canvasInteraction';
import { type MetricConfig } from './quadrantState';
import type { EQBand } from '../stores/eqStore.svelte';

// ── DSP Helpers ──

/**
 * Smooths a bin value using Points-Per-Octave averaging.
 * When ppo >= 48, returns raw bin value (no smoothing).
 */
export function getPPOSmoothedValue(
    binIndex: number,
    dataArray: Float32Array,
    ppo: number,
    sampleRate: number,
    bins: number,
): number {
    if (ppo >= 48) return dataArray[binIndex];

    const octaveFraction = 1 / ppo;
    const binWidth = sampleRate / 2 / bins;
    const freq = binIndex * binWidth || 1e-6;

    const f_start = freq * Math.pow(2, -octaveFraction / 2);
    const f_end = freq * Math.pow(2, octaveFraction / 2);

    const k_start = Math.max(0, Math.round(f_start / binWidth));
    const k_end = Math.min(
        dataArray.length - 1,
        Math.round(f_end / binWidth),
    );

    let sum = 0;
    let count = 0;
    for (let k = k_start; k <= k_end; k++) {
        sum += dataArray[k];
        count++;
    }
    return count > 0 ? sum / count : dataArray[binIndex];
}

// ── Metric Domain Logic ──

const FREQ_DOMAIN_METRICS = [
    "Spectrum",
    "Magnitude",
    "Simulated Magnitude",
    "Phase",
    "Coherence",
    "Group Delay",
    "Spectrogram",
];

const TIME_DOMAIN_METRICS = ["Impulse", "Step"];

/**
 * Checks if a metric is in the frequency domain set.
 */
export function isFreqDomainMetric(name: string): boolean {
    return FREQ_DOMAIN_METRICS.includes(name);
}

/**
 * Checks if a metric is in the time domain set.
 */
export function isTimeDomainMetric(name: string): boolean {
    return TIME_DOMAIN_METRICS.includes(name);
}

/**
 * Determines whether a metric should be disabled given the currently active metrics.
 * Enforces Cartesian exclusion: freq-domain and time-domain can't coexist.
 */
export function isMetricDisabled(
    name: string,
    hasTimeDomainActive: boolean,
    hasFreqDomainActive: boolean,
): boolean {
    if (FREQ_DOMAIN_METRICS.includes(name)) {
        if (hasTimeDomainActive) return true;
    }
    if (TIME_DOMAIN_METRICS.includes(name)) {
        if (hasFreqDomainActive) return true;
    }
    return false;
}

/**
 * Computes alpha for a metric curve based on solo/hover state.
 */
export function getMetricAlpha(
    metric: string,
    soloMetric: string | null,
    hoverMetric: string | null,
): number {
    if (soloMetric) {
        return soloMetric === metric ? 1.0 : 0.2;
    }
    if (hoverMetric) {
        return hoverMetric === metric ? 1.0 : 0.15;
    }
    return 1.0;
}

// ── EQ Interaction Helpers ──

/** Standard ISO 1/3 octave center frequencies */
const ISO_THIRD_OCTAVE_FREQS = [
    20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
    630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
    10000, 12500, 16000, 20000,
];

/**
 * Hit-tests EQ band nodes against a mouse position.
 * Returns the index of the hit node, or null if none.
 * @param hitRadiusSq - squared pixel radius for hit detection (default 400 = 20px)
 */
export function hitTestEQNodes(
    mouseX: number,
    mouseY: number,
    bands: EQBand[],
    containerWidth: number,
    containerHeight: number,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    hitRadiusSq: number = 400,
): number | null {
    for (let i = 0; i < bands.length; i++) {
        const nx = valToX(bands[i].freq, containerWidth, false, state);
        const ny = valToY(bands[i].gain, containerHeight, "Magnitude", metricConfigs, state);
        const dx = mouseX - nx;
        const dy = mouseY - ny;
        if (dx * dx + dy * dy < hitRadiusSq) {
            return i;
        }
    }
    return null;
}

/**
 * Snaps a frequency to the nearest ISO 1/3 octave center frequency.
 */
export function snapToISOFreq(freq: number): number {
    let best = ISO_THIRD_OCTAVE_FREQS[0];
    let bestDist = Math.abs(Math.log10(freq) - Math.log10(best));
    for (const f of ISO_THIRD_OCTAVE_FREQS) {
        const d = Math.abs(Math.log10(freq) - Math.log10(f));
        if (d < bestDist) { bestDist = d; best = f; }
    }
    return best;
}

/**
 * Converts mouse position to EQ band parameters (freq + gain),
 * applying optional ISO snap (Shift) and gain stepping (Ctrl).
 */
export function mouseToEQParams(
    mouseX: number,
    mouseY: number,
    containerWidth: number,
    containerHeight: number,
    state: InteractionState,
    shiftKey: boolean,
    ctrlKey: boolean,
): { freq: number; gain: number } {
    const rawFreq = xToVal(mouseX, containerWidth, false, state);
    const rawGain = yToVal(mouseY, containerHeight, "Magnitude", state);

    let freq = Math.max(20, Math.min(20000, Math.round(rawFreq)));
    let gain = Math.max(-30, Math.min(30, parseFloat(rawGain.toFixed(1))));

    // Snap to ISO 1/3 octave frequencies when Shift is held
    if (shiftKey) {
        freq = snapToISOFreq(freq);
    }

    // Snap gain to 0.5dB steps when Ctrl is held
    if (ctrlKey) {
        gain = Math.round(gain * 2) / 2;
    }

    return { freq, gain };
}

// ── Smoothing Pre-computation ──

/**
 * Pre-smooths a data array into a target buffer using PPO smoothing.
 * Used for magnitude and spectrum curves before rendering.
 */
export function preSmoothBuffer(
    target: Float32Array,
    source: Float32Array,
    bins: number,
    ppo: number,
    sampleRate: number,
): void {
    if (ppo < 48) {
        const len = Math.min(bins, source.length);
        for (let i = 0; i < len; i++) {
            target[i] = getPPOSmoothedValue(i, source, ppo, sampleRate, bins);
        }
    } else {
        // No smoothing — copy source to target
        if (source.length > bins) {
            target.set(source.subarray(0, bins));
        } else {
            target.set(source);
        }
    }
}
