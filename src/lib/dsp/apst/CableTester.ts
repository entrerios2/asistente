import { Orchestrator } from './Orchestrator';
import { SegmentV } from './segments/SegmentV';
import { SegmentP } from './segments/SegmentP';

export type CableDiagnosis = 'OK' | 'ROTO' | 'POLARIDAD_INVERTIDA' | 'ERROR_DESCONOCIDO';

/**
 * CableTester: Utilidad para diagnóstico de cables en loopback.
 */
export class CableTester {
    constructor(private orchestrator: Orchestrator) {}

    /**
     * Ejecuta una prueba de cable completa.
     * @param refBuffer Buffer de referencia para la prueba de polaridad.
     * @param measBuffer Buffer que se llenará con la captura (simulado o real).
     */
    async testCable(refBuffer: Float32Array, measBuffer: Float32Array): Promise<CableDiagnosis> {
        try {
            console.info('CableTester: Iniciando prueba de loopback...');

            // 1. Ejecutar secuencia de verificación y polaridad
            // En una implementación real, el orquestador llenaría el measBuffer
            await this.orchestrator.runSequence("V P");

            // 2. Diagnóstico de Integridad (V)
            const vResult = SegmentV.process(measBuffer);
            if (vResult === 'ERROR_NO_AUDIO') {
                return 'ROTO';
            }

            // 3. Diagnóstico de Polaridad (P)
            const isInverted = SegmentP.process(refBuffer, measBuffer);
            if (isInverted) {
                return 'POLARIDAD_INVERTIDA';
            }

            return 'OK';

        } catch (error) {
            console.error('CableTester: Error durante la prueba:', error);
            return 'ERROR_DESCONOCIDO';
        }
    }
}
