/**
 * TraceManager: Gestor de estado reactivo para trazos de audio (Live, Snapshot, Math).
 * Implementado con Svelte 5 Runes.
 */

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

export interface EQBand {
    freq: number;
    gain: number;
    q: number;
    type: string;
}

class TraceManager {
    // Propiedad reactiva para forzar la reactividad en Svelte 5 al actualizar arrays in-place
    version = $state(0);

    // Estado reactivo de los trazos
    traces = $state<Trace[]>([{
        id: 'live-1',
        name: 'Micrófono en vivo',
        type: 'live',
        metric: 'magnitude',
        data: new Float32Array(0),
        color: '#00ff88',
        style: 'solid',
        visible: true,
        offsetY: 0,
        timestamp: Date.now(),
        source: 'manual'
    }]);
    
    // Estado de las bandas de EQ (Playground)
    eqBands = $state<EQBand[]>([
        { freq: 100, gain: 0, q: 1, type: 'peaking' },
        { freq: 500, gain: 0, q: 1, type: 'peaking' },
        { freq: 1000, gain: 0, q: 1, type: 'peaking' },
        { freq: 5000, gain: 0, q: 1, type: 'peaking' },
        { freq: 10000, gain: 0, q: 1, type: 'peaking' }
    ]);

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
     * Actualiza los datos de un trazo Live en tiempo real.
     */
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

    /**
     * Captura el estado actual de un trazo live y lo guarda como snapshot.
     */
    captureSnapshot(liveTraceId: string, name?: string, source: 'manual' | 'secuencial' = 'manual') {
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
            timestamp: Date.now(),
            source
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
