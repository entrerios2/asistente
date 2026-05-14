/**
 * Segmento V: Verificación de Integridad Acústica.
 * Confirma que el audio está llegando al micrófono con suficiente energía.
 */
export class SegmentV {
    private static THRESHOLD = 0.01;

    /**
     * @param buffer Bloque de audio capturado (Float32Array).
     * @returns "OK" si hay señal, "ERROR_NO_AUDIO" si el nivel es demasiado bajo.
     */
    static process(buffer: Float32Array): 'OK' | 'ERROR_NO_AUDIO' {
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
            sumSq += buffer[i] * buffer[i];
        }
        
        const rms = Math.sqrt(sumSq / buffer.length);
        console.info(`SegmentV: RMS detectado = ${rms.toFixed(5)}`);

        return rms >= this.THRESHOLD ? 'OK' : 'ERROR_NO_AUDIO';
    }
}
