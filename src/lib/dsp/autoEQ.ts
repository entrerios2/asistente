/**
 * AutoEQ orchestrator — multi-algorithm parametric EQ optimizer.
 * Implements: Greedy Sequential, Nelder-Mead, PSO, Genetic Algorithm.
 * Supports: dB and energy domain cost functions, coherence weighting,
 *           treble averaging, peak-only correction, and benchmark mode.
 */

import { getCoeffsForType } from './biquad';
import { nelderMead } from './optimizers/nelderMead';
import { particleSwarm } from './optimizers/psoEQ';
import { geneticOptimize } from './optimizers/geneticEQ';
import { computeDeviation, type DeviationResult } from './deviationMetrics';

// ════════════════════════════════════════════
//  Types
// ════════════════════════════════════════════

export type OptimizerAlgorithm = 'greedy' | 'nelder-mead' | 'pso' | 'genetic' | 'all';
export type CostDomain = 'dB' | 'energy';

export interface FilterParams {
    fc: number;
    gain: number;
    q: number;
    type: string;
}

export interface AutoEQConfig {
    algorithm: OptimizerAlgorithm;
    costDomain: CostDomain;
    numFilters: number;
    allowedTypes: string[];
    freqRange: [number, number];
    maxBoost: number;
    maxCut: number;
    minQ: number;
    maxQ: number;
    coherenceThreshold: number;
    maxIterations: number;
    preamp: 'auto' | number;
    trebleAveraging: boolean;
    trebleFreq: number;
    onlyCorrectPeaks: boolean;
    // PSO-specific
    psoPopulation: number;
    psoInertia: number;
    psoCognitive: number;
    psoSocial: number;
    // GA-specific
    gaPopulation: number;
    gaMutationRate: number;
    gaCrossoverRate: number;
    gaElitism: number;
}

export interface AutoEQResult {
    filters: FilterParams[];
    preamp: number;
    residualMSE: number;
    iterations: number;
    timeMs: number;
    algorithm: OptimizerAlgorithm;
}

export interface BenchmarkEntry {
    algorithm: OptimizerAlgorithm;
    result: AutoEQResult;
    metrics: DeviationResult;
    improvement: number;
}

export interface BenchmarkResult {
    results: BenchmarkEntry[];
    best: OptimizerAlgorithm;
    totalTimeMs: number;
}

export interface ProgressCallback {
    (algorithm: string, iteration: number, mse: number): void;
}

export const DEFAULT_CONFIG: AutoEQConfig = {
    algorithm: 'greedy',
    costDomain: 'dB',
    numFilters: 6,
    allowedTypes: ['peaking', 'low_shelf', 'high_shelf'],
    freqRange: [20, 20000],
    maxBoost: 6,
    maxCut: -12,
    minQ: 0.2,
    maxQ: 6.0,
    coherenceThreshold: 0.3,
    maxIterations: 200,
    preamp: 'auto',
    trebleAveraging: true,
    trebleFreq: 10000,
    onlyCorrectPeaks: false,
    psoPopulation: 30,
    psoInertia: 0.7,
    psoCognitive: 1.5,
    psoSocial: 1.5,
    gaPopulation: 50,
    gaMutationRate: 0.1,
    gaCrossoverRate: 0.8,
    gaElitism: 2,
};

// ════════════════════════════════════════════
//  Shared DSP utilities
// ════════════════════════════════════════════

/** Compute EQ response in dB for given filters at frequency bins */
function computeEQResponse(
    filters: FilterParams[],
    bins: number,
    sampleRate: number,
): Float32Array {
    const response = new Float32Array(bins);
    if (filters.length === 0) return response;

    const nyquist = sampleRate / 2;
    const TWO_PI = 2 * Math.PI;

    // Precompute all coefficients
    const allCoeffs: number[][] = [];
    for (const f of filters) {
        allCoeffs.push(getCoeffsForType(f.type, f.fc, f.gain, f.q, sampleRate));
    }

    for (let i = 0; i < bins; i++) {
        const freq = (i * nyquist) / bins || 1e-6;
        const w = TWO_PI * freq / sampleRate;
        const cosW = Math.cos(w);
        const sinW = Math.sin(w);
        const cos2W = 2 * cosW * cosW - 1;
        const sin2W = 2 * sinW * cosW;

        let totalRe = 1.0, totalIm = 0.0;

        for (const c of allCoeffs) {
            const nR = c[0] + c[1] * cosW + c[2] * cos2W;
            const nI = -(c[1] * sinW + c[2] * sin2W);
            const dR = c[3] + c[4] * cosW + c[5] * cos2W;
            const dI = -(c[4] * sinW + c[5] * sin2W);
            const dMagSq = dR * dR + dI * dI + 1e-20;
            const hRe = (nR * dR + nI * dI) / dMagSq;
            const hIm = (nI * dR - nR * dI) / dMagSq;
            const newRe = totalRe * hRe - totalIm * hIm;
            const newIm = totalRe * hIm + totalIm * hRe;
            totalRe = newRe;
            totalIm = newIm;
        }

        response[i] = 10 * Math.log10(totalRe * totalRe + totalIm * totalIm + 1e-20);
    }

    return response;
}

/** Compute weighted cost: MSE between (magnitude + eqResponse) and target */
function computeCost(
    filters: FilterParams[],
    magnitude: Float32Array,
    target: Float32Array,
    weights: Float32Array,
    bins: number,
    sampleRate: number,
    domain: CostDomain,
    sharpnessPenalty: number = 0.01,
): number {
    const eqResp = computeEQResponse(filters, bins, sampleRate);
    let cost = 0;
    let totalWeight = 0;

    for (let i = 0; i < bins; i++) {
        const w = weights[i];
        if (w <= 0) continue;

        if (domain === 'dB') {
            const diff = (magnitude[i] + eqResp[i]) - target[i];
            cost += w * diff * diff;
        } else {
            // Energy domain (AcoustiQ-style): optimize in linear magnitude²
            const correctedLinear = Math.pow(10, (magnitude[i] + eqResp[i]) / 10);
            const targetLinear = Math.pow(10, target[i] / 10);
            const diff = correctedLinear - targetLinear;
            cost += w * diff * diff;
        }
        totalWeight += w;
    }

    if (totalWeight > 0) cost /= totalWeight;

    // Sharpness penalty (like AutoEq): penalize high Q + high gain
    for (const f of filters) {
        cost += Math.abs(f.gain) * Math.max(0, f.q - 2) * sharpnessPenalty;
    }

    return cost;
}

/** Build coherence-based weights */
function buildWeights(
    coherence: Float32Array | null,
    bins: number,
    sampleRate: number,
    config: AutoEQConfig,
): Float32Array {
    const weights = new Float32Array(bins);
    const nyquist = sampleRate / 2;

    for (let i = 0; i < bins; i++) {
        const freq = (i * nyquist) / bins;
        if (freq < config.freqRange[0] || freq > config.freqRange[1]) {
            weights[i] = 0;
            continue;
        }
        const coh = coherence ? coherence[i] : 1.0;
        weights[i] = coh >= config.coherenceThreshold ? coh : 0;
    }

    return weights;
}

// ════════════════════════════════════════════
//  Peak detection
// ════════════════════════════════════════════

interface Peak {
    index: number;
    freq: number;
    height: number;
    width: number; // in bins
    isPositive: boolean;
}

function findPeaksAndDips(
    error: Float32Array,
    bins: number,
    sampleRate: number,
    minProminence: number = 1.0,
): Peak[] {
    const peaks: Peak[] = [];
    const nyquist = sampleRate / 2;

    for (let i = 2; i < bins - 2; i++) {
        const val = error[i];
        const isLocalMax = val > error[i - 1] && val > error[i + 1] && val > error[i - 2] && val > error[i + 2];
        const isLocalMin = val < error[i - 1] && val < error[i + 1] && val < error[i - 2] && val < error[i + 2];

        if (!isLocalMax && !isLocalMin) continue;
        if (Math.abs(val) < minProminence) continue;

        // Estimate width: find -3dB points
        const target3dB = Math.abs(val) * 0.5;
        let wLeft = 0, wRight = 0;
        for (let j = i - 1; j >= 0; j--) {
            if (Math.abs(error[j]) < target3dB) { wLeft = i - j; break; }
        }
        for (let j = i + 1; j < bins; j++) {
            if (Math.abs(error[j]) < target3dB) { wRight = j - i; break; }
        }
        const width = Math.max(wLeft + wRight, 1);

        peaks.push({
            index: i,
            freq: (i * nyquist) / bins,
            height: val,
            width,
            isPositive: val > 0,
        });
    }

    // Sort by importance: width × |height|
    peaks.sort((a, b) => (Math.abs(b.height) * b.width) - (Math.abs(a.height) * a.width));

    return peaks;
}

// ════════════════════════════════════════════
//  Greedy Sequential (D2)
// ════════════════════════════════════════════

function optimizeGreedy(
    magnitude: Float32Array,
    target: Float32Array,
    weights: Float32Array,
    bins: number,
    sampleRate: number,
    config: AutoEQConfig,
    onProgress?: ProgressCallback,
): FilterParams[] {
    const nyquist = sampleRate / 2;
    const filters: FilterParams[] = [];

    // Compute initial error (what we need to correct)
    const error = new Float32Array(bins);
    for (let i = 0; i < bins; i++) {
        error[i] = (target[i] - magnitude[i]) * (weights[i] > 0 ? 1 : 0);
    }

    // Apply treble averaging if enabled
    if (config.trebleAveraging) {
        const trebleBin = Math.round((config.trebleFreq * bins) / nyquist);
        const windowSize = Math.max(5, Math.round(bins * 0.02));
        for (let i = trebleBin; i < bins; i++) {
            let sum = 0, count = 0;
            for (let j = Math.max(trebleBin, i - windowSize); j <= Math.min(bins - 1, i + windowSize); j++) {
                sum += error[j];
                count++;
            }
            error[i] = count > 0 ? sum / count : error[i];
        }
    }

    for (let f = 0; f < config.numFilters; f++) {
        const peaks = findPeaksAndDips(error, bins, sampleRate, 0.5);
        if (peaks.length === 0) break;

        const peak = peaks[0];
        let gain = -peak.height;

        // Apply constraints
        if (config.onlyCorrectPeaks && gain > 0) {
            // Skip if this would boost — find next dip instead
            const dip = peaks.find(p => p.isPositive);
            if (!dip) break;
            gain = -dip.height;
        }

        gain = Math.max(config.maxCut, Math.min(config.maxBoost, gain));

        // Estimate Q from width
        const peakFreq = peak.freq;
        const bandwidthHz = (peak.width * nyquist) / bins;
        let q = peakFreq / Math.max(bandwidthHz, 1);
        q = Math.max(config.minQ, Math.min(config.maxQ, q));

        // Determine filter type
        let type = 'peaking';
        if (config.allowedTypes.includes('low_shelf') && peakFreq < config.freqRange[0] * 3) {
            type = 'low_shelf';
        } else if (config.allowedTypes.includes('high_shelf') && peakFreq > config.freqRange[1] * 0.6) {
            type = 'high_shelf';
        }

        const filter: FilterParams = { fc: peakFreq, gain, q, type };
        filters.push(filter);

        // Subtract this filter's response from the error
        const filterResp = computeEQResponse([filter], bins, sampleRate);
        for (let i = 0; i < bins; i++) {
            error[i] += filterResp[i]; // filterResp is the correction, error is what remains
        }

        if (onProgress) {
            const mse = computeCost(filters, magnitude, target, weights, bins, sampleRate, config.costDomain);
            onProgress('greedy', f + 1, mse);
        }
    }

    return filters;
}

// ════════════════════════════════════════════
//  Parameter encoding/decoding for optimizers
// ════════════════════════════════════════════

function encodeFilters(filters: FilterParams[]): number[] {
    const params: number[] = [];
    for (const f of filters) {
        params.push(Math.log10(f.fc)); // log10 for perceptual spacing
        params.push(f.q);
        params.push(f.gain);
    }
    return params;
}

function decodeFilters(params: number[], types: string[]): FilterParams[] {
    const filters: FilterParams[] = [];
    for (let i = 0; i < params.length; i += 3) {
        filters.push({
            fc: Math.pow(10, params[i]),
            q: params[i + 1],
            gain: params[i + 2],
            type: types[Math.floor(i / 3)] || 'peaking',
        });
    }
    return filters;
}

function buildBounds(config: AutoEQConfig, numFilters: number): [number, number][] {
    const bounds: [number, number][] = [];
    for (let i = 0; i < numFilters; i++) {
        bounds.push([Math.log10(config.freqRange[0]), Math.log10(config.freqRange[1])]); // log10(fc)
        bounds.push([config.minQ, config.maxQ]); // Q
        bounds.push([config.maxCut, config.maxBoost]); // gain
    }
    return bounds;
}

// ════════════════════════════════════════════
//  Main orchestrator
// ════════════════════════════════════════════

function runSingleAlgorithm(
    algorithm: Exclude<OptimizerAlgorithm, 'all'>,
    magnitude: Float32Array,
    target: Float32Array,
    coherence: Float32Array | null,
    bins: number,
    sampleRate: number,
    config: AutoEQConfig,
    onProgress?: ProgressCallback,
): AutoEQResult {
    const t0 = performance.now();
    const weights = buildWeights(coherence, bins, sampleRate, config);

    let filters: FilterParams[];

    if (algorithm === 'greedy') {
        filters = optimizeGreedy(magnitude, target, weights, bins, sampleRate, config, onProgress);
    } else {
        // All other algorithms start with greedy initialization
        const initialFilters = optimizeGreedy(magnitude, target, weights, bins, sampleRate, config);
        const types = initialFilters.map(f => f.type);
        const x0 = encodeFilters(initialFilters);
        const bounds = buildBounds(config, initialFilters.length);

        // Build objective function
        const objective = (params: number[]): number => {
            const decoded = decodeFilters(params, types);
            return computeCost(decoded, magnitude, target, weights, bins, sampleRate, config.costDomain);
        };

        let result: { x: number[]; fval: number; iterations: number };

        if (algorithm === 'nelder-mead') {
            result = nelderMead(
                objective,
                x0,
                { maxIterations: config.maxIterations, tolerance: 1e-6 },
                bounds,
                onProgress ? (iter, fval) => onProgress('nelder-mead', iter, fval) : undefined,
            );
        } else if (algorithm === 'pso') {
            result = particleSwarm(
                objective,
                x0.length,
                bounds,
                {
                    population: config.psoPopulation,
                    maxIterations: config.maxIterations,
                    inertia: config.psoInertia,
                    cognitive: config.psoCognitive,
                    social: config.psoSocial,
                },
                x0,
                onProgress ? (iter, fval) => onProgress('pso', iter, fval) : undefined,
            );
        } else {
            // genetic
            result = geneticOptimize(
                objective,
                x0.length,
                bounds,
                {
                    population: config.gaPopulation,
                    maxIterations: config.maxIterations,
                    mutationRate: config.gaMutationRate,
                    crossoverRate: config.gaCrossoverRate,
                    elitism: config.gaElitism,
                },
                x0,
                onProgress ? (gen, fval) => onProgress('genetic', gen, fval) : undefined,
            );
        }

        filters = decodeFilters(result.x, types);
    }

    // Compute preamp
    let preamp: number;
    if (config.preamp === 'auto') {
        const eqResp = computeEQResponse(filters, bins, sampleRate);
        let maxGain = 0;
        for (let i = 0; i < bins; i++) maxGain = Math.max(maxGain, eqResp[i]);
        preamp = -maxGain; // headroom = -max_peak
    } else {
        preamp = config.preamp;
    }

    const residualMSE = computeCost(filters, magnitude, target, weights, bins, sampleRate, config.costDomain, 0);
    const timeMs = performance.now() - t0;

    return {
        filters,
        preamp,
        residualMSE,
        iterations: config.maxIterations,
        timeMs,
        algorithm,
    };
}

/**
 * Run AutoEQ with the specified algorithm.
 */
export function runAutoEQ(
    magnitude: Float32Array,
    target: Float32Array,
    coherence: Float32Array | null,
    bins: number,
    sampleRate: number,
    config: AutoEQConfig,
    onProgress?: ProgressCallback,
): AutoEQResult {
    if (config.algorithm === 'all') {
        throw new Error('Use benchmarkAll() for algorithm="all"');
    }
    return runSingleAlgorithm(config.algorithm, magnitude, target, coherence, bins, sampleRate, config, onProgress);
}

/**
 * D8: Benchmark all algorithms sequentially, compare metrics, rank by WMSE.
 */
export function benchmarkAll(
    magnitude: Float32Array,
    target: Float32Array,
    coherence: Float32Array | null,
    bins: number,
    sampleRate: number,
    config: AutoEQConfig,
    onProgress?: (algorithm: string, progress: number) => void,
): BenchmarkResult {
    const t0 = performance.now();
    const algorithms: Exclude<OptimizerAlgorithm, 'all'>[] = ['greedy', 'nelder-mead', 'pso', 'genetic'];

    // Compute baseline metrics (no EQ)
    const baselineMetrics = computeDeviation(magnitude, target, coherence, bins, sampleRate,
        config.freqRange[0], config.freqRange[1], config.coherenceThreshold);

    const results: BenchmarkEntry[] = [];

    for (let a = 0; a < algorithms.length; a++) {
        const algo = algorithms[a];
        if (onProgress) onProgress(algo, a / algorithms.length);

        const algoConfig = { ...config, algorithm: algo as OptimizerAlgorithm };
        const result = runSingleAlgorithm(algo, magnitude, target, coherence, bins, sampleRate, algoConfig);

        // Compute corrected magnitude for metrics
        const eqResp = computeEQResponse(result.filters, bins, sampleRate);
        const corrected = new Float32Array(bins);
        for (let i = 0; i < bins; i++) corrected[i] = magnitude[i] + eqResp[i];

        const metrics = computeDeviation(corrected, target, coherence, bins, sampleRate,
            config.freqRange[0], config.freqRange[1], config.coherenceThreshold);

        const improvement = baselineMetrics.rms > 0
            ? ((baselineMetrics.rms - metrics.rms) / baselineMetrics.rms) * 100
            : 0;

        results.push({ algorithm: algo, result, metrics, improvement });
    }

    if (onProgress) onProgress('done', 1);

    // Rank by RMS (lower = better)
    results.sort((a, b) => a.metrics.rms - b.metrics.rms);

    return {
        results,
        best: results[0].algorithm,
        totalTimeMs: performance.now() - t0,
    };
}
