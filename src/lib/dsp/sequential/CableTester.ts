import { Orchestrator } from './Orchestrator';
import { SegmentV } from './segments/SegmentV';
import { SegmentP } from './segments/SegmentP';
import { SegmentN } from './segments/SegmentN';
import { SegmentX } from './segments/SegmentX';

export type CableDiagnosis = 'OK' | 'ROTO' | 'POLARIDAD_INVERTIDA' | 'CALIDAD_POBRE' | 'ERROR_DESCONOCIDO';

export interface CableTestResult {
    diagnosis: CableDiagnosis;
    score: number; // 1-10
    details: {
        snr: number;
        attenuation: number;
        thd: number;
    };
}

/**
 * CableTester: Utilidad para diagnóstico de cables en loopback.
 */
export class CableTester {
    constructor(private orchestrator: Orchestrator) {}

    /**
     * Ejecuta una prueba de cable completa (V P N X).
     * @param refBuffer Buffer de referencia.
     * @param measBuffer Buffer capturado.
     */
    async testCable(refBuffer: Float32Array, measBuffer: Float32Array): Promise<CableTestResult> {
        try {
            console.info('CableTester: Iniciando prueba completa (V P N X)...');

            // 1. Ejecutar secuencia extendida
            await this.orchestrator.runSequence("V P N X");

            // 2. Diagnóstico de Integridad (V)
            const vResult = SegmentV.process(measBuffer);
            if (vResult === 'ERROR_NO_AUDIO') {
                return this.createResult('ROTO', 0, 0, -100, 100);
            }

            // 3. Diagnóstico de Polaridad (P)
            const isInverted = SegmentP.process(refBuffer, measBuffer);
            
            // 4. Diagnóstico de Ruido (N)
            // Asumimos que el orquestador provee los segmentos. Aquí simplificamos.
            const nResult = SegmentN.process(measBuffer, 1.0); // 1.0 como ref nominal
            
            // 5. Diagnóstico de Crosstalk (X)
            const xResult = SegmentX.process(measBuffer, 1.0);

            // 6. Cálculo de Score (Simulando THD por ahora)
            const dummyThd = 0.05; 
            const score = this.calculateCableScore(xResult.attenuationDb, nResult.snr, dummyThd);

            let diagnosis: CableDiagnosis = 'OK';
            if (isInverted) diagnosis = 'POLARIDAD_INVERTIDA';
            else if (score < 4) diagnosis = 'CALIDAD_POBRE';

            return this.createResult(diagnosis, score, nResult.snr, xResult.attenuationDb, dummyThd);

        } catch (error) {
            console.error('CableTester: Error durante la prueba:', error);
            return this.createResult('ERROR_DESCONOCIDO', 0, 0, 0, 0);
        }
    }

    /**
     * Calcula un score de 1 a 10 basado en parámetros de calidad.
     * @param attenuation Atenuación de crosstalk (dB).
     * @param snr Relación señal/ruido (dB).
     * @param thd Distorsión armónica total (%).
     */
    calculateCableScore(attenuation: number, snr: number, thd: number): number {
        // Normalización:
        // Attenuation: -80dB o menos -> 10, -40dB -> 1
        const sAtt = Math.max(1, Math.min(10, ((attenuation + 40) / -40) * 9 + 1));
        
        // SNR: 60dB o más -> 10, 20dB -> 1
        const sSnr = Math.max(1, Math.min(10, ((snr - 20) / 40) * 9 + 1));
        
        // THD: 0.01% o menos -> 10, 1% -> 1
        const sThd = Math.max(1, Math.min(10, ((1 - thd) / 0.99) * 9 + 1));

        // Pesos: Attenuation (40%), SNR (40%), THD (20%)
        const finalScore = (sAtt * 0.4) + (sSnr * 0.4) + (sThd * 0.2);
        
        return parseFloat(finalScore.toFixed(1));
    }

    private createResult(diagnosis: CableDiagnosis, score: number, snr: number, attenuation: number, thd: number): CableTestResult {
        return {
            diagnosis,
            score,
            details: { snr, attenuation, thd }
        };
    }
}
