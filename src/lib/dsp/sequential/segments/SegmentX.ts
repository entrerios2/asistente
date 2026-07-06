/**
 * Segmento X: Análisis de Diafonía (Crosstalk).
 * Evalúa el sangrado de señal entre canales.
 */
export class SegmentX {
    /**
     * @param buffer Audio capturado en el canal que debería estar en silencio.
     * @param referenceRms RMS de la señal en el canal activo (de referencia).
     * @returns Atenuación del crosstalk en dB.
     */
    static process(buffer: Float32Array, referenceRms: number): { attenuationDb: number } {
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
            sumSq += buffer[i] * buffer[i];
        }
        
        const bleedRms = Math.sqrt(sumSq / buffer.length);
        const safeBleedRms = Math.max(bleedRms, 0.000001);
        const safeReferenceRms = Math.max(referenceRms, 0.000001);

        // Crosstalk (dB) = 20 * log10(Sangrado / Referencia)
        // Usualmente se expresa como un valor negativo (ej. -60 dB)
        const attenuationDb = 20 * Math.log10(safeBleedRms / safeReferenceRms);

        console.info(`SegmentX: Bleed RMS = ${bleedRms.toFixed(6)}, Attenuation = ${attenuationDb.toFixed(2)} dB`);

        return {
            attenuationDb
        };
    }
}
