/**
 * Calibration Store: Gestión del estado global de calibración acústica.
 * Implementado con runas de Svelte 5 ($state, $derived).
 */

export interface EQFilter {
    frequency: number;
    gain: number; // en dB
    q: number;
    type: 'peaking' | 'highshelf' | 'lowshelf';
    enabled: boolean;
}

export class CalibrationStore {
    // Estado base reactivo
    measuredCurve = $state<Float32Array>(new Float32Array(1024));
    targetCurve = $state<Float32Array>(new Float32Array(1024));
    suggestedFilters = $state<EQFilter[]>([]);
    agnosticMode = $state<boolean>(false);
    sampleRate = $state<number>(48000);

    /**
     * Curva predicha: Se deriva reactivamente sumando la medición y los filtros.
     */
    predictedCurve = $derived.by(() => {
        const result = new Float32Array(this.measuredCurve.length);
        const bins = this.measuredCurve.length;

        for (let i = 0; i < bins; i++) {
            // Frecuencia del bin actual
            const freq = (i * (this.sampleRate / 2)) / bins;
            
            // Sumamos el impacto de todos los filtros activos
            let totalFilterGain = 0;
            for (const filter of this.suggestedFilters) {
                if (filter.enabled) {
                    totalFilterGain += this.calculateFilterGainAt(filter, freq);
                }
            }

            result[i] = this.measuredCurve[i] + totalFilterGain;
        }
        return result;
    });

    /**
     * Calcula la ganancia en dB de un filtro específico para una frecuencia dada.
     * Utiliza una aproximación de campana (Bell/Peaking) para visualización.
     */
    private calculateFilterGainAt(filter: EQFilter, f: number): number {
        const fc = filter.frequency;
        const G = filter.gain;
        const Q = filter.q;

        if (filter.type === 'peaking') {
            if (f <= 0) return 0;
            // Aproximación de respuesta en frecuencia para EQ paramétrico
            const bandwidth = fc / Q;
            const diff = f - fc;
            // Usamos una campana de Gauss simplificada para la representación visual en dB
            const exponent = -Math.pow(f - fc, 2) / (2 * Math.pow(bandwidth / 2, 2));
            return G * Math.exp(exponent);
        }
        
        // TODO: Implementar modelos precisos para High/Low Shelving
        return 0;
    }

    // Acciones para modificar el estado
    setMeasuredCurve(data: Float32Array) {
        this.measuredCurve = data;
    }

    addFilter(filter: EQFilter) {
        this.suggestedFilters.push(filter);
    }

    removeFilter(index: number) {
        this.suggestedFilters.splice(index, 1);
    }

    toggleAgnosticMode() {
        this.agnosticMode = !this.agnosticMode;
    }

    reset() {
        this.suggestedFilters = [];
        this.measuredCurve.fill(0);
        this.agnosticMode = false;
    }
}

// Instancia única (Singleton) para toda la aplicación
export const calibrationStore = new CalibrationStore();
