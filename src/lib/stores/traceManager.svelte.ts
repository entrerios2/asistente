/**
 * TraceManager: Gestor de estado reactivo para trazos de audio y capas de medición.
 * Implementado con Svelte 5 Runes.
 */

import { uiStore } from './ui.svelte';

export interface Trace {
    id: string;
    name: string;
    type: 'live' | 'snapshot' | 'math' | 'eq';
    metric: string;
    data: Float32Array;
    color: string;
    style: 'solid' | 'dashed';
    visible: boolean;
    offsetY: number;
    timestamp: number;
    source: 'manual' | 'secuencial';
}

export interface MeasurementLayer {
    id: string;
    name: string;
    visible: boolean;
    isMeasuring: boolean;
    quadrantId: string;
    sourceType: 'live' | 'snapshot' | 'calculated';
    data: Float32Array;
}

export interface EQBand {
    freq: number;
    gain: number;
    q: number;
    type: string;
}

class TraceManager {
    // Propiedad reactiva para forzar la reactividad en Svelte 5
    version = $state(0);

    // Biblioteca histórica de trazos/instantáneas
    traces = $state<Trace[]>([]);
    
    // SISTEMA DE CAPAS GLOBALES (PROMPT 6)
    layers = $state<MeasurementLayer[]>([]);

    // Estado de las bandas de EQ (Playground)
    eqBands = $state<EQBand[]>([
        { freq: 100, gain: 0, q: 1, type: 'peaking' },
        { freq: 500, gain: 0, q: 1, type: 'peaking' },
        { freq: 1000, gain: 0, q: 1, type: 'peaking' },
        { freq: 5000, gain: 0, q: 1, type: 'peaking' },
        { freq: 10000, gain: 0, q: 1, type: 'peaking' }
    ]);

    constructor() {
        // Inicializar con una capa por defecto para el primer cuadrante
        this.addLayer('Capa 1', 'q-1', 'live');
    }

    /**
     * Métodos CRUD para Capas de Medición (Prompt 6)
     */
    addLayer(name: string, quadrantId: string, sourceType: 'live' | 'snapshot' | 'calculated' = 'live') {
        const layer: MeasurementLayer = {
            id: crypto.randomUUID(),
            name,
            visible: true,
            isMeasuring: sourceType === 'live',
            quadrantId,
            sourceType,
            data: new Float32Array(4096)
        };
        this.layers.push(layer);
        
        if (sourceType === 'live') {
            uiStore.activeLayerId = layer.id;
        }
        return layer;
    }

    renameLayer(id: string, name: string) {
        const layer = this.layers.find(l => l.id === id);
        if (layer) {
            layer.name = name;
        }
    }

    duplicateLayer(id: string) {
        const original = this.layers.find(l => l.id === id);
        if (!original) return;
        const copy: MeasurementLayer = {
            id: crypto.randomUUID(),
            name: `${original.name} (Copia)`,
            visible: original.visible,
            isMeasuring: false,
            quadrantId: original.quadrantId,
            sourceType: original.sourceType === 'live' ? 'snapshot' : original.sourceType,
            data: new Float32Array(original.data)
        };
        this.layers.push(copy);
    }

    deleteLayer(id: string) {
        this.layers = this.layers.filter(l => l.id !== id);
        if (uiStore.activeLayerId === id) {
            const nextLive = this.layers.find(l => l.sourceType === 'live');
            uiStore.activeLayerId = nextLive ? nextLive.id : '';
        }
    }

    moveLayer(id: string, targetQuadrantId: string) {
        const layer = this.layers.find(l => l.id === id);
        if (layer) {
            layer.quadrantId = targetQuadrantId;
        }
    }

    setLayerSource(id: string, type: 'live' | 'snapshot', snapshotData?: Float32Array) {
        const layer = this.layers.find(l => l.id === id);
        if (layer) {
            layer.sourceType = type;
            if (type === 'snapshot' && snapshotData) {
                layer.data.set(snapshotData);
                layer.isMeasuring = false;
            } else if (type === 'live') {
                layer.isMeasuring = true;
                uiStore.activeLayerId = layer.id;
            }
        }
    }

    /**
     * Métodos para la biblioteca de Trazos/Instantáneas
     */
    addTrace(trace: Trace) {
        this.traces.push(trace);
    }

    removeTrace(id: string) {
        this.traces = this.traces.filter(t => t.id !== id);
    }

    toggleVisibility(id: string) {
        const trace = this.traces.find(t => t.id === id);
        if (trace) {
            trace.visible = !trace.visible;
        }
    }

    updateLiveTrace(id: string, data: Float32Array) {
        const trace = this.traces.find(t => t.id === id);
        if (trace) {
            if (trace.data.length === data.length) {
                trace.data.set(data);
            } else {
                trace.data = new Float32Array(data);
            }
            this.version++;
        }
    }

    captureSnapshot(liveTraceId: string, name?: string, source: 'manual' | 'secuencial' = 'manual') {
        const live = this.traces.find(t => t.id === liveTraceId);
        // Fallback si no encuentra el traceId (por si pasan los datos directamente en una versión intermedia)
        const dataToCopy = live ? live.data : new Float32Array(0);

        const snapshot: Trace = {
            id: crypto.randomUUID(),
            name: name || `Snap ${new Date().toLocaleTimeString()}`,
            type: 'snapshot',
            metric: live ? live.metric : 'magnitude',
            data: new Float32Array(dataToCopy),
            color: live ? live.color : '#fff',
            style: live ? live.style : 'solid',
            visible: true,
            offsetY: 0,
            timestamp: Date.now(),
            source
        };
        this.addTrace(snapshot);
        return snapshot;
    }

    get snapshots() {
        return this.traces
            .filter(t => t.type === 'snapshot')
            .sort((a, b) => b.timestamp - a.timestamp);
    }
}

export const traceManager = new TraceManager();
