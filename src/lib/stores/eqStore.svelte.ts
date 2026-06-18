/**
 * EQStore: Estado centralizado de ecualización (gráfica y paramétrica).
 * Extraído de Sidebar.svelte para desacoplar el estado de la UI.
 */

import { traceManager } from './traceManager.svelte';

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

    constructor() {
        // Sincronización reactiva con traceManager.eqBands
        $effect.root(() => {
            $effect(() => {
                if (!this.showEQ) {
                    traceManager.eqBands = [];
                    return;
                }

                if (this.eqType === "grafico") {
                    traceManager.eqBands = this.graphicBands.map((b) => ({
                        freq: b.freq,
                        gain: b.gain,
                        q: 1.414,
                        type: "peaking",
                    }));
                } else if (this.eqType === "parametrico") {
                    traceManager.eqBands = this.parametricFilters
                        .map((f) => ({
                            freq: f.freq,
                            gain: f.gain,
                            q: f.q,
                            type: f.type,
                        }));
                }
            });
        });
    }
}

export const eqStore = new EQStore();
