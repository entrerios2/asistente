import { computeTransferFunction } from './utils';

export class SegmentX {
    static process(refBuffer: Float32Array, measBuffer: Float32Array, sampleRate: number) {
        const tf = computeTransferFunction(refBuffer, measBuffer, sampleRate);
        if (!tf) {
            return {
                status: 'ERROR' as const,
                values: {} as Record<string, number | string>,
                message: 'Buffer demasiado corto para análisis FFT',
            };
        }

        const avgMag = tf.magnitude.reduce((a, b) => a + b, 0) / tf.magnitude.length;

        let status: 'PASS' | 'WARN' | 'FAIL';
        let message: string;
        if (avgMag < -40) {
            status = 'PASS';
            message = `Aislamiento promedio: ${avgMag.toFixed(1)} dB`;
        } else if (avgMag < -20) {
            status = 'WARN';
            message = `Aislamiento promedio: ${avgMag.toFixed(1)} dB — revisar canales`;
        } else {
            status = 'FAIL';
            message = `Aislamiento promedio: ${avgMag.toFixed(1)} dB — posible fuga entre canales`;
        }

        return {
            status,
            values: { avgIsolationDb: +avgMag.toFixed(1) } as Record<string, number | string>,
            message,
            spectral: {
                frequencies: tf.frequencies,
                magnitude: tf.magnitude,
                sampleRate,
            },
        };
    }
}
