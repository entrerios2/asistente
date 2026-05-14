/**
 * TraceManager: Gestor de estado reactivo para trazos de audio (Live, Snapshot, Math).
 * Implementado con Svelte 5 Runes.
 */

export interface Trace {
    id: string;
    name: string;
    type: 'live' | 'snapshot' | 'math';
    metric: string;
    data: Float32Array;
    color: string;
    style: 'solid' | 'dashed';
    visible: boolean;
    offsetY: number;
    timestamp: number;
}

class TraceManager {
    // Estado reactivo de los trazos
    traces = $state<Trace[]>([]);

    /**
     * Añade un nuevo trazo al gestor.
     */
    addTrace(trace: Trace) {
        this.traces.push(trace);
    }

    /**
     * Elimina un trazo por ID.
     */
    removeTrace(id: string) {
        this.traces = this.traces.filter(t => t.id !== id);
    }

    /**
     * Alterna la visibilidad de un trazo.
     */
    toggleVisibility(id: string) {
        const trace = this.traces.find(t => t.id === id);
        if (trace) {
            trace.visible = !trace.visible;
        }
    }

    /**
     * Ajusta el desplazamiento en el eje Y (dB/Magnitud).
     */
    setYOffset(id: string, offset: number) {
        const trace = this.traces.find(t => t.id === id);
        if (trace) {
            trace.offsetY = offset;
        }
    }

    /**
     * Captura el estado actual de un trazo live y lo guarda como snapshot.
     */
    captureSnapshot(liveTraceId: string, name?: string) {
        const live = this.traces.find(t => t.id === liveTraceId);
        if (!live) return;

        // Creamos una copia profunda de los datos (Float32Array)
        const dataCopy = new Float32Array(live.data);

        const snapshot: Trace = {
            id: crypto.randomUUID(),
            name: name || `${live.name} (Snap ${new Date().toLocaleTimeString()})`,
            type: 'snapshot',
            metric: live.metric,
            data: dataCopy,
            color: live.color,
            style: live.style,
            visible: true,
            offsetY: live.offsetY,
            timestamp: Date.now()
        };

        this.addTrace(snapshot);
    }

    /**
     * Obtiene solo los trazos de tipo snapshot ordenados por tiempo.
     */
    get snapshots() {
        return this.traces
            .filter(t => t.type === 'snapshot')
            .sort((a, b) => b.timestamp - a.timestamp);
    }
}

export const traceManager = new TraceManager();
