/**
 * Segmento A: Normalización y Calibración de Nivel.
 * Mide el nivel de un tono de referencia y calcula el factor de compensación.
 */
export class SegmentA {
    /**
     * Calcula el factor de ganancia necesario para normalizar el nivel.
     * @param buffer Bloque de audio capturado (tono de 1kHz).
     * @returns Objeto con el RMS y el factor de compensación en dB.
     */
    static process(buffer: Float32Array) {
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
            sumSq += buffer[i] * buffer[i];
        }
        
        const rms = Math.sqrt(sumSq / buffer.length);
        
        // Evitamos log(0)
        const safeRms = Math.max(rms, 0.00001);
        
        // Calculamos el offset en dB para llevar este nivel a una referencia interna (ej. 1.0 peak)
        // dB = 20 * log10(Ref / Medido)
        const dbOffset = 20 * Math.log10(1.0 / safeRms);

        console.info(`SegmentA: RMS = ${rms.toFixed(5)}, Offset sugerido = ${dbOffset.toFixed(2)} dB`);

        return {
            rms,
            dbOffset,
            gainFactor: 1.0 / safeRms
        };
    }
}
