/**
 * Segmento N: Análisis de Ruido de Fondo (Noise Floor).
 * Evalúa la relación señal/ruido para garantizar la validez de la medición.
 */
export class SegmentN {
    private static MIN_SNR_DB = 15;

    /**
     * @param noiseBuffer Audio capturado durante el periodo de silencio.
     * @param signalRms RMS de la señal de referencia obtenido en el Segmento A.
     * @returns "OK" o "ERROR_LOW_SNR".
     */
    static process(noiseBuffer: Float32Array, signalRms: number): { status: 'OK' | 'ERROR_LOW_SNR', snr: number } {
        let sumSq = 0;
        for (let i = 0; i < noiseBuffer.length; i++) {
            sumSq += noiseBuffer[i] * noiseBuffer[i];
        }
        
        const noiseRms = Math.sqrt(sumSq / noiseBuffer.length);
        const safeNoiseRms = Math.max(noiseRms, 0.000001);

        // SNR (dB) = 20 * log10(Señal / Ruido)
        const snr = 20 * Math.log10(signalRms / safeNoiseRms);

        console.info(`SegmentN: Noise RMS = ${noiseRms.toFixed(6)}, SNR = ${snr.toFixed(2)} dB`);

        return {
            status: snr >= this.MIN_SNR_DB ? 'OK' : 'ERROR_LOW_SNR',
            snr
        };
    }
}
