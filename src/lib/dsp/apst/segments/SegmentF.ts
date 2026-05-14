import { fft, magnitude, applyWindow } from '../../fft';

/**
 * Segmento F: Respuesta en Frecuencia.
 * Calcula la magnitud espectral de una captura acústica (ej. Log-Sweep).
 */
export class SegmentF {
    /**
     * @param buffer Bloque de audio capturado (potencia de 2).
     * @returns Array con la magnitud en dB para cada bin de frecuencia.
     */
    static process(buffer: Float32Array): Float32Array {
        // 1. Clonamos el buffer para no modificar el original al aplicar ventana
        const data = new Float32Array(buffer);
        
        // 2. Aplicamos ventana para mejorar la precisión espectral
        applyWindow(data, 'hanning');

        // 3. Ejecutamos la FFT
        const { real, imag } = fft(data);

        // 4. Calculamos magnitud
        const mag = magnitude(real, imag);

        // 5. Convertimos a escala logarítmica (dB)
        const dbMag = new Float32Array(mag.length / 2); // Solo la mitad positiva (Nyquist)
        for (let i = 0; i < dbMag.length; i++) {
            dbMag[i] = 20 * Math.log10(Math.max(mag[i], 1e-6));
        }

        return dbMag;
    }
}
