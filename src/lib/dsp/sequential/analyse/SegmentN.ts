import { computeSpectrum } from './utils';

export class SegmentN {
    static process(buffer: Float32Array, sampleRate: number) {
        const spec = computeSpectrum(buffer, sampleRate);
        if (!spec) {
            return {
                status: 'ERROR' as const,
                values: {} as Record<string, number | string>,
                message: 'Buffer demasiado corto para análisis FFT',
            };
        }

        return {
            status: 'PASS' as const,
            values: { bins: spec.bins } as Record<string, number | string>,
            message: `Espectro FFT de ${spec.fftSize} pts`,
            spectral: {
                frequencies: spec.frequencies,
                spectrum: spec.spectrum,
                sampleRate,
            },
        };
    }
}
