import type { EQFilter } from '../stores/calibrationStore';

/**
 * AutoEq: Motor de derivación automática de filtros paramétricos.
 */
export class AutoEq {
    /**
     * Deriva una lista de filtros sugeridos para aplanar la respuesta medida hacia la objetivo.
     * 
     * @param measured Respuesta en frecuencia medida (dB).
     * @param target Respuesta en frecuencia objetivo (dB).
     * @param coherence Coherencia de la medición (0.0 a 1.0).
     * @param agnosticMode Si es true, prohíbe ganancias positivas.
     * @param sampleRate Frecuencia de muestreo del sistema.
     * @returns Array de filtros sugeridos.
     */
    static deriveFilters(
        measured: Float32Array,
        target: Float32Array,
        coherence: Float32Array,
        agnosticMode: boolean,
        sampleRate: number
    ): EQFilter[] {
        const bins = measured.length;
        const error = new Float32Array(bins);
        const filters: EQFilter[] = [];

        // 1. Calcular Error y Aplicar Coherencia
        for (let i = 0; i < bins; i++) {
            // Solo procesamos si la coherencia es aceptable (> 0.5)
            if (coherence[i] > 0.5) {
                error[i] = target[i] - measured[i];
            } else {
                error[i] = 0; // Ignorar zonas poco fiables
            }
        }

        // 2. Encontrar picos de error prominentes (Heurística simple)
        // Usamos una copia del error para ir "vaciando" picos procesados
        const errorCopy = new Float32Array(error);
        const maxFilters = 6;
        const binHz = (sampleRate / 2) / bins;

        for (let f = 0; f < maxFilters; f++) {
            let maxErr = 0;
            let peakIdx = -1;

            // Buscar el bin con mayor error absoluto
            for (let i = 0; i < bins; i++) {
                if (Math.abs(errorCopy[i]) > Math.abs(maxErr)) {
                    maxErr = errorCopy[i];
                    peakIdx = i;
                }
            }

            // Si no hay errores significativos, terminamos
            if (peakIdx === -1 || Math.abs(maxErr) < 1.0) break;

            // 3. Definir Ganancia con Muros de Seguridad
            let gain = maxErr;
            if (agnosticMode) {
                // Solo recortes (cortar picos de resonancia)
                gain = Math.min(0, gain);
            } else {
                // Boost máximo de +3 dB
                gain = Math.min(3, gain);
            }

            // Solo añadimos si la ganancia final es relevante
            if (Math.abs(gain) > 0.5) {
                filters.push({
                    frequency: Math.round(peakIdx * binHz),
                    gain: parseFloat(gain.toFixed(1)),
                    q: 2.0, // Valor inicial heurístico
                    type: 'peaking',
                    enabled: true
                });
            }

            // 4. "Vaciar" zona de influencia para no poner filtros solapados
            // Excluimos aprox. 1/2 octava alrededor del pico
            const exclusionWidth = Math.max(5, Math.floor(bins / 40)); 
            const start = Math.max(0, peakIdx - exclusionWidth);
            const end = Math.min(bins - 1, peakIdx + exclusionWidth);
            for (let i = start; i <= end; i++) {
                errorCopy[i] = 0;
            }
        }

        return filters;
    }
}
