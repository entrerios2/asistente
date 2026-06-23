/**
 * TraceManager: Gestor de estado reactivo para trazos de audio, capas de medición e instantáneas persistidas.
 * Implementado con Svelte 5 Runes e integrado con IndexedDB.
 */

import { uiStore } from './ui.svelte';
import { mathOrchestrator } from './mathOrchestrator.svelte';
import { targetTrace } from './targetTrace.svelte';



export interface MeasurementLayer {
    id: string;
    name: string;
    visible: boolean;
    isMeasuring: boolean;
    quadrantId: string;
    sourceType: 'live' | 'snapshot' | 'calculated';
    data: Float32Array;
    isCalculated?: boolean;        // true = capa virtual calculada
    calcOperation?: 'average' | 'sum' | 'subtract' | 'min' | 'max';  // Operación
    calcTargetMetrics?: string[];  // Métricas sobre las que calcular (vacío = todas)
    // Fase 1b: vínculo a instantánea y datos multi-métrica
    instantaneaId?: string;
    multiMetricData?: Record<string, Float32Array>;
    color?: string;
    dashPattern?: number[];
}

export interface InstantaneaTags {
    ubicacion?: string;
    posicion?: string;
    custom: string[];
}

export interface InstantaneaMetadata {
    sampleRate: number;
    fftSize: number;
    averagingDepth: number;
}

export interface Instantanea {
    id: string;
    name: string;
    timestamp: number;
    data: Record<string, Float32Array>;
    visible: boolean;
    color: string;
    source: 'manual' | 'secuencial';
    metric: string;
    offsetY: number;
    // Fase 1a: tags, sesión y metadata
    tags: InstantaneaTags;
    sessionId?: string;
    metadata?: InstantaneaMetadata;
}

export interface Session {
    id: string;
    name: string;
    venue?: string;
    event?: string;
    createdAt: number;
}

export interface EQBand {
    freq: number;
    gain: number;
    q: number;
    type: string;
}

// Fase 1e: Palette de colores por ubicación
export const UBICACION_COLORS: Record<string, string> = {
    'Principal': '#00ff88',
    'Delay 1': '#06b6d4',
    'Delay 2': '#6366f1',
    'Delay 3': '#a855f7',
    'Relleno': '#f97316',
    'Subwoofer': '#ef4444',
};

class TraceManager {
    // Propiedad reactiva para forzar la reactividad en Svelte 5
    version = $state(0);

    // Buffer reactivo dedicado para los datos espectrales en vivo (RTA) (Prompt 8/Fix)
    liveFrequencyData = $state(new Float32Array(4096));

    // SISTEMA DE INSTANTÁNEAS MULTIMÉTRICAS PERSISTIDAS CON INDEXEDDB (PROMPT 8)
    instantaneas = $state<Instantanea[]>([]);
    
    // SISTEMA DE CAPAS GLOBALES (PROMPT 6)
    layers = $state<MeasurementLayer[]>([]);

    // Fase 1c: Sesiones
    sessions = $state<Session[]>([]);
    activeSessionId = $state<string | null>(null);

    // Fase 1d: Tag presets y sticky tags (persistidos en localStorage)
    tagPresets = $state(this._loadTagPresets());
    lastUsedTags = $state<{ ubicacion?: string; posicion?: string }>({});

    // Estado reactivo para mostrar el modal de captura desde cualquier origen
    pendingCaptureForModal = $state<Instantanea | null>(null);

    private _loadTagPresets(): { ubicacion: string[]; posicion: string[] } {
        const defaults = {
            ubicacion: ['Principal', 'Delay 1', 'Delay 2', 'Delay 3', 'Relleno', 'Subwoofer'],
            posicion: ['Izquierda', 'Centro', 'Derecha', 'Arriba', 'Abajo'],
        };
        if (typeof window === 'undefined') return defaults;
        try {
            const saved = localStorage.getItem('tagPresets');
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return defaults;
    }

    private _saveTagPresets() {
        try {
            localStorage.setItem('tagPresets', JSON.stringify(this.tagPresets));
        } catch { /* ignore */ }
    }

    addTagPreset(category: 'ubicacion' | 'posicion', value: string) {
        const trimmed = value.trim();
        if (!trimmed || this.tagPresets[category].includes(trimmed)) return;
        this.tagPresets[category] = [...this.tagPresets[category], trimmed];
        this._saveTagPresets();
    }

    // Configuración de capturas (checkboxes interactivos)
    metricsToCapture = $state<Record<string, boolean>>({
        "Magnitude": true,
        "Phase": true,
        "Coherence": true,
        "Impulse": false,
        "GroupDelay": false,
        "Step": false
    });

    // EQ state has been moved to eqStore (single source of truth).
    // Use eqStore.activeBands and eqStore.updateBand() instead.

    private _targetCurveCache: Float32Array | null = null;
    private _targetCurveCacheKey: string = '';

    getTargetCurve(bins: number, sampleRate: number = 48000): Float32Array {
        const key = `${targetTrace.name}_${bins}_${sampleRate}_${targetTrace.offset}`;
        if (this._targetCurveCache && this._targetCurveCacheKey === key) {
            return this._targetCurveCache;
        }

        const target = new Float32Array(bins);
        const binWidth = (sampleRate / 2) / bins;
        for (let i = 0; i < bins; i++) {
            const freq = Math.max(i * binWidth, 1);
            target[i] = targetTrace.getInterpolatedGain(freq);
        }

        this._targetCurveCache = target;
        this._targetCurveCacheKey = key;
        return target;
    }


    constructor() {
        // Inicializar con una capa por defecto para el primer cuadrante
        this.addLayer('Capa 1', 'q-1', 'live');

        if (typeof window !== 'undefined') {
            this.loadFromDB();
        }
    }

    /**
     * Carga asíncronamente todas las instantáneas guardadas en IndexedDB al arrancar la aplicación (Prompt 8).
     * Fase 1i: Retrocompatibilidad — si un registro no tiene `tags`, asignar `{ custom: [] }`.
     */
    async loadFromDB() {
        try {
            const { loadAllInstantaneas, loadAllSessions } = await import('../utils/db');
            const items = await loadAllInstantaneas();
            this.instantaneas = items.map((item: any) => {
                const data: Record<string, Float32Array> = {};
                for (const metric in item.data) {
                    data[metric] = new Float32Array(item.data[metric]);
                }
                return {
                    id: item.id,
                    name: item.name,
                    timestamp: item.timestamp,
                    data,
                    visible: item.visible ?? true,
                    color: item.color || '#00ff88',
                    source: item.source || 'manual',
                    metric: item.metric || 'Multimétrica',
                    offsetY: item.offsetY || 0,
                    tags: item.tags || { custom: [] },
                    sessionId: item.sessionId,
                    metadata: item.metadata,
                };
            });
            // Cargar sesiones
            const sessions = await loadAllSessions();
            this.sessions = sessions;
        } catch (e) {
            console.error('[TraceManager] Error cargando instantáneas de IndexedDB:', e);
        }
    }

    /**
     * Fase 1g: Genera un nombre automático basado en tags + hora.
     */
    generateSnapName(tags: { ubicacion?: string; posicion?: string }): string {
        const parts = [tags.ubicacion, tags.posicion].filter(Boolean);
        const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return parts.length > 0 ? `${parts.join(' · ')} · ${time}` : time;
    }

    /**
     * Captura una instantánea multimétrica en caliente de los buffers de mathOrchestrator.
     * Fase 1f: Acepta tags y metadata, auto-asigna color por ubicación y sessionId.
     */
    async captureInstantanea(
        name?: string,
        metricsToCapture?: string[],
        tags?: InstantaneaTags,
        metadata?: InstantaneaMetadata
    ) {
        const id = crypto.randomUUID();
        const data: Record<string, Float32Array> = {};

        const list = metricsToCapture || Object.keys(this.metricsToCapture).filter(k => this.metricsToCapture[k]);

        // Capturar los buffers activos elegidos en las configuraciones
        for (const metric of list) {
            let src: Float32Array | null = null;
            if (metric === "Magnitude") src = mathOrchestrator.outputMagnitude;
            else if (metric === "Phase") src = mathOrchestrator.outputPhase;
            else if (metric === "Coherence") src = mathOrchestrator.outputCoherence;
            else if (metric === "Impulse") src = mathOrchestrator.outputImpulse;
            else if (metric === "GroupDelay") src = mathOrchestrator.outputGroupDelay;
            else if (metric === "Step") src = mathOrchestrator.outputStep;

            if (src && src.length > 0) {
                data[metric] = new Float32Array(src);
            }
        }

        const resolvedTags: InstantaneaTags = tags || { custom: [] };
        const autoColor = UBICACION_COLORS[resolvedTags.ubicacion || ''] || '#00ff88';

        const ins: Instantanea = {
            id,
            name: name || this.generateSnapName(resolvedTags),
            timestamp: Date.now(),
            data,
            visible: true,
            color: autoColor,
            source: uiStore.measurementMode === 'manual' ? 'manual' : 'secuencial',
            metric: 'Multimétrica',
            offsetY: 0,
            tags: resolvedTags,
            sessionId: this.activeSessionId || undefined,
            metadata,
        };

        this.instantaneas.push(ins);

        // Guardar en la DB
        try {
            const { saveInstantanea } = await import('../utils/db');
            const serializedData: Record<string, ArrayBufferLike> = {};
            for (const metric in data) {
                serializedData[metric] = data[metric].buffer;
            }
            await saveInstantanea({
                id: ins.id,
                name: ins.name,
                timestamp: ins.timestamp,
                data: serializedData,
                visible: ins.visible,
                color: ins.color,
                source: ins.source,
                metric: ins.metric,
                offsetY: ins.offsetY,
                tags: ins.tags,
                sessionId: ins.sessionId,
                metadata: ins.metadata,
            });
        } catch (e) {
            console.error('[TraceManager] Error guardando instantánea en IndexedDB:', e);
        }

        // Abrir modal para etiquetar
        this.pendingCaptureForModal = ins;

        return ins;
    }

    /**
     * Fase 1h: Crea una capa snapshot vinculada a una instantánea con datos multi-métrica.
     */
    addSnapshotLayer(instantanea: Instantanea, quadrantId: string): MeasurementLayer {
        const layer: MeasurementLayer = {
            id: crypto.randomUUID(),
            name: instantanea.name,
            visible: true,
            isMeasuring: false,
            quadrantId,
            sourceType: 'snapshot',
            data: instantanea.data['Magnitude'] || new Float32Array(0),
            instantaneaId: instantanea.id,
            multiMetricData: { ...instantanea.data },
            color: instantanea.color,
        };
        this.layers.push(layer);
        return layer;
    }

    /**
     * Elimina una instantánea tanto del estado reactivo como de IndexedDB (Prompt 8).
     */
    async deleteInstantanea(id: string) {
        this.instantaneas = this.instantaneas.filter(ins => ins.id !== id);
        try {
            const { deleteInstantanea } = await import('../utils/db');
            await deleteInstantanea(id);
        } catch (e) {
            console.error('[TraceManager] Error eliminando instantánea de IndexedDB:', e);
        }
    }

    /**
     * Exporta la instantánea multimétrica a un archivo legible .snapshot.json (Prompt 8).
     */
    exportInstantaneaToJSON(id: string) {
        const ins = this.instantaneas.find(i => i.id === id);
        if (!ins) return;

        const serializableData: Record<string, number[]> = {};
        for (const metric in ins.data) {
            serializableData[metric] = Array.from(ins.data[metric]);
        }

        const serializable = {
            id: ins.id,
            name: ins.name,
            timestamp: ins.timestamp,
            visible: ins.visible,
            color: ins.color,
            data: serializableData
        };

        const jsonStr = JSON.stringify(serializable, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ins.name.replace(/\s+/g, '_')}.snapshot.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Importa una instantánea multimétrica desde un archivo .snapshot.json y la guarda reactivamente (Prompt 8).
     */
    async importInstantaneaFromJSON(content: string): Promise<Instantanea | null> {
        try {
            const parsed = JSON.parse(content);
            if (!parsed.id || !parsed.name || !parsed.data) {
                throw new Error('Estructura de archivo .snapshot.json inválida.');
            }

            const data: Record<string, Float32Array> = {};
            for (const metric in parsed.data) {
                data[metric] = new Float32Array(parsed.data[metric]);
            }

            const ins: Instantanea = {
                id: parsed.id,
                name: parsed.name,
                timestamp: parsed.timestamp || Date.now(),
                visible: parsed.visible ?? true,
                color: parsed.color || '#00ff88',
                data,
                source: parsed.source || 'manual',
                metric: parsed.metric || 'Multimétrica',
                offsetY: parsed.offsetY || 0,
                tags: parsed.tags || { custom: [] },
                sessionId: parsed.sessionId,
                metadata: parsed.metadata,
            };

            this.instantaneas.push(ins);

            const { saveInstantanea } = await import('../utils/db');
            const serializedData: Record<string, ArrayBufferLike> = {};
            for (const metric in ins.data) {
                serializedData[metric] = ins.data[metric].buffer;
            }
            await saveInstantanea({
                id: ins.id,
                name: ins.name,
                timestamp: ins.timestamp,
                data: serializedData,
                visible: ins.visible,
                color: ins.color,
                source: ins.source,
                metric: ins.metric,
                offsetY: ins.offsetY,
                tags: ins.tags,
                sessionId: ins.sessionId,
                metadata: ins.metadata,
            });

            return ins;
        } catch (e) {
            console.error('[TraceManager] Error importando instantánea:', e);
            return null;
        }
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

    addCalculatedLayer(name: string, quadrantId: string, operation: 'average' | 'sum' | 'subtract' | 'min' | 'max' = 'average'): string {
        const id = `calc-${Date.now()}`;
        this.layers.push({
            id,
            name,
            visible: true,
            isMeasuring: false,
            quadrantId,
            sourceType: 'live',
            data: new Float32Array(0),
            isCalculated: true,
            calcOperation: operation,
            calcTargetMetrics: ['Magnitude'],
        });
        return id;
    }

    updateCalculatedLayers(): void {
        for (const layer of this.layers) {
            if (!layer.isCalculated || !layer.visible) continue;

            // Obtener capas fuente: mismo quadrantId, visibles, NO calculadas
            const sources = this.layers.filter(l =>
                l.quadrantId === layer.quadrantId &&
                l.visible &&
                !l.isCalculated &&
                l.data.length > 0
            );

            if (sources.length === 0) {
                layer.data = new Float32Array(0);
                continue;
            }

            const bins = sources[0].data.length;
            const result = new Float32Array(bins);

            switch (layer.calcOperation) {
                case 'average': {
                    for (let k = 0; k < bins; k++) {
                        let sum = 0;
                        for (const src of sources) {
                            sum += src.data[k] || 0;
                        }
                        result[k] = sum / sources.length;
                    }
                    break;
                }
                case 'sum': {
                    for (let k = 0; k < bins; k++) {
                        for (const src of sources) {
                            result[k] += src.data[k] || 0;
                        }
                    }
                    break;
                }
                case 'min': {
                    result.fill(Infinity);
                    for (let k = 0; k < bins; k++) {
                        for (const src of sources) {
                            if ((src.data[k] || 0) < result[k]) result[k] = src.data[k];
                        }
                    }
                    break;
                }
                case 'max': {
                    result.fill(-Infinity);
                    for (let k = 0; k < bins; k++) {
                        for (const src of sources) {
                            if ((src.data[k] || 0) > result[k]) result[k] = src.data[k];
                        }
                    }
                    break;
                }
                case 'subtract': {
                    if (sources.length >= 2) {
                        for (let k = 0; k < bins; k++) {
                            result[k] = (sources[0].data[k] || 0) - (sources[1].data[k] || 0);
                        }
                    }
                    break;
                }
            }

            if (layer.data.length !== bins) {
                layer.data = new Float32Array(bins);
            }
            layer.data.set(result);
        }
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
     * Fase 2a: Sincroniza visibilidad de instantánea con capas snapshot.
     * Cuando se hace visible, crea una capa snapshot en el primer cuadrante.
     * Cuando se oculta, elimina las capas vinculadas.
     */
    syncSnapshotVisibility(snapId: string, visible: boolean) {
        const snap = this.instantaneas.find(s => s.id === snapId);
        if (!snap) return;

        if (visible) {
            // Crear capa snapshot si no existe ya una vinculada
            const existingLayer = this.layers.find(l => l.instantaneaId === snapId);
            if (!existingLayer) {
                this.addSnapshotLayer(snap, 'q-1');
            }
        } else {
            // Eliminar capas vinculadas a esta instantánea
            this.layers = this.layers.filter(l => l.instantaneaId !== snapId);
        }
    }

    /**
     * Fase 2b: Toggle de visibilidad de instantánea + sincronización con capas.
     */
    toggleVisibility(id: string) {
        const ins = this.instantaneas.find(i => i.id === id);
        if (ins) {
            ins.visible = !ins.visible;
            this.syncSnapshotVisibility(id, ins.visible);
        }
    }

    async captureInstantaneaFromLive(name?: string, _source: 'manual' | 'secuencial' = 'manual') {
        const metricList = Object.keys(this.metricsToCapture).filter(k => this.metricsToCapture[k]);
        return this.captureInstantanea(name, metricList);
    }
}

export const traceManager = new TraceManager();

if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as any).traceManager = traceManager;
}
