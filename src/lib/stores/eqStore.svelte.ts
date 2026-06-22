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

class EQStore {
    eqType = $state<'grafico' | 'parametrico'>('grafico');
    showEQ = $state(true);
    numGraphicBands = $state(10);
    customBandCount = $state(false);
    isCalculatingAutoEQ = $state(false);
    autoEQSourceLayer = $state<string>('active');

    // Version counter for dirty tracking (replaces traceManager.eqBandsVersion)
    activeBandsVersion = $state(0);

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
                (filter as any)[field] = value;
            }
        }
        this.activeBandsVersion++;
    }

    loadFromConfig(config: any) {
        if (config.eqType) this.eqType = config.eqType;
        if (config.eqShowEQ !== undefined) this.showEQ = config.eqShowEQ;
        if (config.eqGraphicBands && Array.isArray(config.eqGraphicBands)) {
            this.graphicBands = config.eqGraphicBands;
        }
        if (config.eqParametricFilters && Array.isArray(config.eqParametricFilters)) {
            this.parametricFilters = config.eqParametricFilters.map((f: any) => ({
                ...f,
                showConfig: false,
                supportedTypes: f.supportedTypes || ['peaking'],
            }));
        }
    }

    toConfig() {
        return {
            eqType: this.eqType,
            eqShowEQ: this.showEQ,
            eqGraphicBands: $state.snapshot(this.graphicBands).map(b => ({ freq: b.freq, gain: b.gain })),
            eqParametricFilters: $state.snapshot(this.parametricFilters).map(f => ({
                id: f.id, freq: f.freq, gain: f.gain, q: f.q, type: f.type, supportedTypes: f.supportedTypes,
            })),
        };
    }
}

export const eqStore = new EQStore();
