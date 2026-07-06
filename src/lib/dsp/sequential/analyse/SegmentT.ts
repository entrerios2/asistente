import { computeTransferFunction, computeImpulseResponse, computeGroupDelay, computePhaseDelay } from './utils';

export class SegmentT {
    static process(refBuffer: Float32Array, measBuffer: Float32Array, sampleRate: number) {
        const tf = computeTransferFunction(refBuffer, measBuffer, sampleRate);
        if (!tf) {
            return {
                status: 'ERROR' as const,
                values: {} as Record<string, number | string>,
                message: 'Buffer demasiado corto para análisis FFT',
            };
        }

        const impulse = computeImpulseResponse(tf.hReal, tf.hImag, tf.fftSize);
        const groupDelay = computeGroupDelay(tf.hReal, tf.hImag, sampleRate, tf.fftSize);
        const phaseRad = new Float32Array(tf.phase.length);
        for (let i = 0; i < tf.phase.length; i++) phaseRad[i] = tf.phase[i] * Math.PI / 180;
        const phaseDelay = computePhaseDelay(phaseRad, tf.frequencies);

        return {
            status: 'PASS' as const,
            values: { bins: tf.bins, windows: tf.numWindows } as Record<string, number | string>,
            message: `FFT de ${tf.fftSize} pts, ${tf.numWindows} ventanas`,
            spectral: {
                frequencies: tf.frequencies,
                impulse,
                groupDelay,
                phaseDelay,
                sampleRate,
            },
        };
    }
}
