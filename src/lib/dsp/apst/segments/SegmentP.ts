import { TransferFunction } from '../../TransferFunction';
import { fft } from '../../fft';

/**
 * Segmento P: Detección de Polaridad.
 * Compara la señal de referencia con la medida para detectar inversiones (180°).
 */
export class SegmentP {
    /**
     * @param refBuffer Audio original (Referencia).
     * @param measBuffer Audio capturado (Medición).
     * @returns true si la polaridad está invertida, false si es correcta.
     */
    static process(refBuffer: Float32Array, measBuffer: Float32Array): boolean {
        const N = refBuffer.length;
        const tf = new TransferFunction(N);

        // 1. Obtener espectros
        const specRef = fft(refBuffer);
        const specMeas = fft(measBuffer);

        // 2. Alimentar Función de Transferencia
        tf.addSnapshot(specRef.real, specRef.imag, specMeas.real, specMeas.imag);

        // 3. Obtener Fase
        const { phase } = tf.calculateH();

        // 4. Analizar fase en el rango de bajas frecuencias (donde la polaridad es más clara)
        // Tomamos los primeros bins (excluyendo el DC en el índice 0)
        let phaseSum = 0;
        const count = Math.min(10, Math.floor(N / 4)); 
        for (let i = 1; i <= count; i++) {
            phaseSum += phase[i];
        }
        
        const avgPhase = phaseSum / count;
        const avgPhaseDeg = (avgPhase * 180) / Math.PI;

        console.info(`SegmentP: Fase promedio detectada = ${avgPhaseDeg.toFixed(2)}°`);

        // Si la fase está cerca de 180° o -180°, hay inversión.
        // Umbral de tolerancia: 90° a 270° (o -90° a -270°)
        const absPhaseDeg = Math.abs(avgPhaseDeg);
        return absPhaseDeg > 90 && absPhaseDeg < 270;
    }
}
