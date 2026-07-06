import { computeTransferFunction } from './utils';

export class SegmentP {
    static process(refBuffer: Float32Array, measBuffer: Float32Array, sampleRate: number) {
        const tf = computeTransferFunction(refBuffer, measBuffer, sampleRate);
        if (!tf) {
            return {
                status: 'ERROR' as const,
                values: {} as Record<string, number | string>,
                message: 'Buffer demasiado corto para análisis FFT',
            };
        }

        const avgPhase = tf.phase.reduce((a, b) => a + b, 0) / tf.phase.length;
        const absPhase = Math.abs(avgPhase);

        let status: 'PASS' | 'WARN' | 'FAIL';
        let message: string;
        if (absPhase < 90) {
            status = 'PASS';
            message = `Fase promedio: ${avgPhase.toFixed(1)}° — polaridad correcta`;
        } else if (absPhase < 150) {
            status = 'WARN';
            message = `Fase promedio: ${avgPhase.toFixed(1)}° — revisar polaridad`;
        } else {
            status = 'FAIL';
            message = `Fase promedio: ${avgPhase.toFixed(1)}° — polaridad invertida`;
        }

        return {
            status,
            values: { avgPhaseDeg: +avgPhase.toFixed(1) } as Record<string, number | string>,
            message,
            spectral: {
                frequencies: tf.frequencies,
                phase: tf.phase,
                coherence: tf.coherence,
                sampleRate,
            },
        };
    }
}
