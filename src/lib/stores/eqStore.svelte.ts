/**
 * EQStore: Estado centralizado de ecualización (gráfica y paramétrica).
 * Single source of truth para las bandas de EQ activas.
 */

/**
 * Calculates the correct Q factor for a graphic EQ band based on the number of bands.
 * Uses the Audio EQ Cookbook formula: Q = sqrt(2^BW) / (2^BW - 1)
 * where BW = totalOctaves / numBands.
 */
function graphicBandQ(numBands: number): number {
    const totalOctaves = Math.log2(20000 / 20); // ≈ 9.97
    const bwOctaves = totalOctaves / numBands;
    const bw2 = Math.pow(2, bwOctaves);
    return Math.sqrt(bw2) / (bw2 - 1);
}

export interface EQBand {
    freq: number;
    gain: number;
    q: number;
    type: string;
}

export interface GraphicBand {
    freq: number;
    gain: number;
}

export interface ParametricFilter {
    id: number;
    freq: number;
    gain: number;
    q: number;
    type: string;
    supportedTypes: string[];
    showConfig: boolean;
}

import { type AutoEQResult as _AutoEQResult, type BenchmarkResult as _BenchmarkResult } from '$lib/dsp/autoEQ';
export type AutoEQResult = _AutoEQResult;
export type BenchmarkResults = _BenchmarkResult;

export interface EQConfig {
    eqType?: 'grafico' | 'parametrico';
    eqShowEQ?: boolean;
    eqGraphicBands?: { freq: number; gain: number }[];
    eqParametricFilters?: Array<{
        id: number; freq: number; gain: number; q: number;
        type: string; supportedTypes?: string[];
    }>;
}

class EQStore {
    eqType = $state<'grafico' | 'parametrico'>('grafico');
    showEQ = $state(false);
    showSimulatedResponse = $state(false);
    numGraphicBands = $state(10);
    customBandCount = $state(false);
    isCalculatingAutoEQ = $state(false);
    autoEQSourceLayer = $state<string>('active');

    // Version counter for dirty tracking (replaces traceManager.eqBandsVersion)
    activeBandsVersion = $state(0);

    // ─── AutoEQ Configuration (D7) ───
    autoEQAlgorithm = $state<'greedy' | 'nelder-mead' | 'pso' | 'genetic' | 'all'>('greedy');
    autoEQCostDomain = $state<'dB' | 'energy'>('dB');
    autoEQNumFilters = $state(6);
    autoEQMaxBoost = $state(6);
    autoEQMaxCut = $state(-12);
    autoEQMinQ = $state(0.2);
    autoEQMaxQ = $state(6.0);
    autoEQMaxIterations = $state(200);
    autoEQCoherenceThreshold = $state(0.3);
    autoEQTrebleAveraging = $state(true);
    autoEQTrebleFreq = $state(10000);
    autoEQOnlyCorrectPeaks = $state(false);
    autoEQShowAdvanced = $state(false);

    // PSO-specific
    autoEQPSOPopulation = $state(30);
    autoEQPSOInertia = $state(0.7);
    autoEQPSOCognitive = $state(1.5);
    autoEQPSOSocial = $state(1.5);

    // GA-specific
    autoEQGAPopulation = $state(50);
    autoEQGAMutationRate = $state(0.1);
    autoEQGACrossoverRate = $state(0.8);
    autoEQGAElitism = $state(2);

    // ─── AutoEQ Source Selection (G1) ───
    autoEQSourceType = $state<'live' | 'snapshot' | 'calculated'>('live');
    autoEQSnapshotIds = $state<string[]>([]);
    autoEQCalcOperation = $state<'average' | 'min' | 'max'>('average');

    // ─── AutoEQ Results ───
    autoEQProgress = $state<{ algorithm: string; progress: number } | null>(null);
    autoEQLastResult = $state<AutoEQResult | null>(null);
    autoEQBenchmarkResults = $state<BenchmarkResults | null>(null);
    autoEQPreviewIndex = $state<number>(-1); // -1 = none, 0..N = preview specific result

    graphicBands = $state<GraphicBand[]>([
        { freq: 31, gain: 0 },
        { freq: 63, gain: 0 },
        { freq: 125, gain: 0 },
        { freq: 250, gain: 0 },
        { freq: 500, gain: 0 },
        { freq: 1000, gain: 0 },
        { freq: 2000, gain: 0 },
        { freq: 4000, gain: 0 },
        { freq: 8000, gain: 0 },
        { freq: 16000, gain: 0 },
    ]);

    parametricFilters = $state<ParametricFilter[]>([
        { id: 1, freq: 80, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "lowpass", "highpass", "low_shelf", "high_shelf", "notch", "bandpass"], showConfig: false },
        { id: 2, freq: 500, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "low_shelf", "high_shelf", "notch"], showConfig: false },
        { id: 3, freq: 2000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "notch"], showConfig: false },
        { id: 4, freq: 8000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "lowpass", "low_shelf", "high_shelf"], showConfig: false },
        { id: 5, freq: 12000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "lowpass"], showConfig: false },
        { id: 6, freq: 16000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking"], showConfig: false },
    ]);

    /**
     * Single source of truth: returns the unified EQBand[] for the active EQ type.
     * Consumers (mathOrchestrator, Quadrant, quadrantDraw) read this instead of traceManager.eqBands.
     *
     * NOTE: No manual caching — Svelte 5's reactivity system automatically tracks
     * dependencies (showEQ, eqType, graphicBands, parametricFilters) and only
     * re-evaluates consumers when those change. A manual cache with plain fields
     * breaks Svelte's dependency tracking and causes stale data.
     */
    get activeBands(): EQBand[] {
        if (!this.showEQ) return [];

        if (this.eqType === "grafico") {
            const q = graphicBandQ(this.graphicBands.length);
            return this.graphicBands.map((b) => ({
                freq: b.freq,
                gain: b.gain,
                q,
                type: "peaking",
            }));
        } else {
            return this.parametricFilters.map((f) => ({
                freq: f.freq,
                gain: f.gain,
                q: f.q,
                type: f.type,
            }));
        }
    }

    /**
     * Updates a band parameter and bumps the version counter.
     * Replaces traceManager.updateEQBand().
     */
    updateBand(index: number, field: 'freq' | 'gain' | 'q' | 'type', value: number | string) {
        if (this.eqType === 'grafico') {
            if (field === 'gain') {
                this.graphicBands[index].gain = value as number;
            }
            // In graphic mode, freq/q/type are fixed — only gain changes
        } else {
            const filter = this.parametricFilters[index];
            if (filter) {
                switch (field) {
                    case 'freq': filter.freq = value as number; break;
                    case 'gain': filter.gain = value as number; break;
                    case 'q': filter.q = value as number; break;
                    case 'type': filter.type = value as string; break;
                }
            }
        }
        this.activeBandsVersion++;
    }

    loadFromConfig(config: EQConfig & Record<string, unknown>) {
        if (config.eqType) this.eqType = config.eqType;
        if (config.eqShowEQ !== undefined) this.showEQ = config.eqShowEQ;
        if (config.eqGraphicBands && Array.isArray(config.eqGraphicBands)) {
            this.graphicBands = config.eqGraphicBands;
        }
        if (config.eqParametricFilters && Array.isArray(config.eqParametricFilters)) {
            this.parametricFilters = config.eqParametricFilters.map((f) => ({
                ...f,
                showConfig: false,
                supportedTypes: f.supportedTypes || ['peaking'],
            }));
        }
        // AutoEQ config
        if (config.autoEQAlgorithm) this.autoEQAlgorithm = config.autoEQAlgorithm as any;
        if (config.autoEQCostDomain) this.autoEQCostDomain = config.autoEQCostDomain as any;
        if (config.autoEQMaxBoost !== undefined) this.autoEQMaxBoost = config.autoEQMaxBoost as number;
        if (config.autoEQMaxCut !== undefined) this.autoEQMaxCut = config.autoEQMaxCut as number;
        if (config.autoEQMinQ !== undefined) this.autoEQMinQ = config.autoEQMinQ as number;
        if (config.autoEQMaxQ !== undefined) this.autoEQMaxQ = config.autoEQMaxQ as number;
        if (config.autoEQMaxIterations !== undefined) this.autoEQMaxIterations = config.autoEQMaxIterations as number;
        if (config.autoEQCoherenceThreshold !== undefined) this.autoEQCoherenceThreshold = config.autoEQCoherenceThreshold as number;
        if (config.autoEQTrebleAveraging !== undefined) this.autoEQTrebleAveraging = config.autoEQTrebleAveraging as boolean;
        if (config.autoEQTrebleFreq !== undefined) this.autoEQTrebleFreq = config.autoEQTrebleFreq as number;
        if (config.autoEQOnlyCorrectPeaks !== undefined) this.autoEQOnlyCorrectPeaks = config.autoEQOnlyCorrectPeaks as boolean;
        // PSO
        if (config.autoEQPSOPopulation !== undefined) this.autoEQPSOPopulation = config.autoEQPSOPopulation as number;
        if (config.autoEQPSOInertia !== undefined) this.autoEQPSOInertia = config.autoEQPSOInertia as number;
        if (config.autoEQPSOCognitive !== undefined) this.autoEQPSOCognitive = config.autoEQPSOCognitive as number;
        if (config.autoEQPSOSocial !== undefined) this.autoEQPSOSocial = config.autoEQPSOSocial as number;
        // GA
        if (config.autoEQGAPopulation !== undefined) this.autoEQGAPopulation = config.autoEQGAPopulation as number;
        if (config.autoEQGAMutationRate !== undefined) this.autoEQGAMutationRate = config.autoEQGAMutationRate as number;
        if (config.autoEQGACrossoverRate !== undefined) this.autoEQGACrossoverRate = config.autoEQGACrossoverRate as number;
        if (config.autoEQGAElitism !== undefined) this.autoEQGAElitism = config.autoEQGAElitism as number;
    }

    toConfig() {
        return {
            eqType: this.eqType,
            eqShowEQ: this.showEQ,
            eqGraphicBands: $state.snapshot(this.graphicBands).map(b => ({ freq: b.freq, gain: b.gain })),
            eqParametricFilters: $state.snapshot(this.parametricFilters).map(f => ({
                id: f.id, freq: f.freq, gain: f.gain, q: f.q, type: f.type, supportedTypes: f.supportedTypes,
            })),
            // AutoEQ config
            autoEQAlgorithm: this.autoEQAlgorithm,
            autoEQCostDomain: this.autoEQCostDomain,
            autoEQMaxBoost: this.autoEQMaxBoost,
            autoEQMaxCut: this.autoEQMaxCut,
            autoEQMinQ: this.autoEQMinQ,
            autoEQMaxQ: this.autoEQMaxQ,
            autoEQMaxIterations: this.autoEQMaxIterations,
            autoEQCoherenceThreshold: this.autoEQCoherenceThreshold,
            autoEQTrebleAveraging: this.autoEQTrebleAveraging,
            autoEQTrebleFreq: this.autoEQTrebleFreq,
            autoEQOnlyCorrectPeaks: this.autoEQOnlyCorrectPeaks,
            autoEQPSOPopulation: this.autoEQPSOPopulation,
            autoEQPSOInertia: this.autoEQPSOInertia,
            autoEQPSOCognitive: this.autoEQPSOCognitive,
            autoEQPSOSocial: this.autoEQPSOSocial,
            autoEQGAPopulation: this.autoEQGAPopulation,
            autoEQGAMutationRate: this.autoEQGAMutationRate,
            autoEQGACrossoverRate: this.autoEQGACrossoverRate,
            autoEQGAElitism: this.autoEQGAElitism,
        };
    }

    resetEQ() {
        this.eqType = 'grafico';
        this.showEQ = true;
        this.graphicBands = [
            { freq: 31, gain: 0 }, { freq: 63, gain: 0 }, { freq: 125, gain: 0 },
            { freq: 250, gain: 0 }, { freq: 500, gain: 0 }, { freq: 1000, gain: 0 },
            { freq: 2000, gain: 0 }, { freq: 4000, gain: 0 }, { freq: 8000, gain: 0 },
            { freq: 16000, gain: 0 },
        ];
        this.parametricFilters = [
            { id: 1, freq: 80, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "lowpass", "highpass", "low_shelf", "high_shelf", "notch", "bandpass"], showConfig: false },
            { id: 2, freq: 500, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "low_shelf", "high_shelf", "notch"], showConfig: false },
            { id: 3, freq: 2000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "notch"], showConfig: false },
            { id: 4, freq: 8000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "lowpass", "low_shelf", "high_shelf"], showConfig: false },
        ];
    }

    resetAutoEQ() {
        this.autoEQAlgorithm = 'greedy';
        this.autoEQCostDomain = 'dB';
        this.autoEQMaxBoost = 6;
        this.autoEQMaxCut = -12;
        this.autoEQMinQ = 0.2;
        this.autoEQMaxQ = 6.0;
        this.autoEQMaxIterations = 200;
        this.autoEQCoherenceThreshold = 0.3;
        this.autoEQTrebleAveraging = true;
        this.autoEQTrebleFreq = 10000;
        this.autoEQOnlyCorrectPeaks = false;
        this.autoEQPSOPopulation = 30;
        this.autoEQPSOInertia = 0.7;
        this.autoEQPSOCognitive = 1.5;
        this.autoEQPSOSocial = 1.5;
        this.autoEQGAPopulation = 50;
        this.autoEQGAMutationRate = 0.1;
        this.autoEQGACrossoverRate = 0.8;
        this.autoEQGAElitism = 2;
    }
}

export const eqStore = new EQStore();
