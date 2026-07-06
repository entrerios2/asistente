import { fft, magnitude } from '../../fft';

const THIRD_OCTAVE_FREQS = [
    20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400,
    500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000,
    6300, 8000, 10000, 12500, 16000, 20000,
];

export class SegmentM {
    static process(buffer: Float32Array, sampleRate: number) {
        const fftSize = 1 << Math.floor(Math.log2(buffer.length));
        if (fftSize < 64) {
            return {
                status: 'ERROR' as const,
                values: {} as Record<string, number | string>,
                message: 'Buffer demasiado corto para análisis FFT',
            };
        }
        const half = fftSize / 2;

        const result = fft(buffer);
        const mag = magnitude(result.real, result.imag);

        const binWidth = sampleRate / fftSize;
        const freqCount = THIRD_OCTAVE_FREQS.length;
        const freqs = new Float32Array(freqCount);
        const levels = new Float32Array(freqCount);

        const values: Record<string, number | string> = {};
        let worstDelta = 0;
        let worstBand = '';

        for (let b = 0; b < freqCount; b++) {
            const centerFreq = THIRD_OCTAVE_FREQS[b];
            freqs[b] = centerFreq;

            const lower = centerFreq / Math.pow(2, 1 / 6);
            const upper = centerFreq * Math.pow(2, 1 / 6);
            const binLow = Math.max(0, Math.round(lower / binWidth));
            const binHigh = Math.min(half - 1, Math.round(upper / binWidth));

            let sumSq = 0;
            for (let k = binLow; k <= binHigh; k++) {
                sumSq += mag[k] * mag[k];
            }
            const rms = Math.sqrt(sumSq / (binHigh - binLow + 1));
            const levelDb = 20 * Math.log10(Math.max(rms, 1e-12));

            levels[b] = levelDb;

            const expectedDb = -18;
            const delta = levelDb - expectedDb;
            values[`${centerFreq}Hz`] = delta.toFixed(1);

            if (Math.abs(delta) > Math.abs(worstDelta)) {
                worstDelta = delta;
                worstBand = `${centerFreq}Hz`;
            }
        }

        const absDelta = Math.abs(worstDelta);
        let status: 'PASS' | 'WARN' | 'FAIL';
        let message: string;
        if (absDelta < 3) {
            status = 'PASS';
            message = `Respuesta plana (peor desviación ${worstDelta.toFixed(1)}dB en ${worstBand})`;
        } else if (absDelta < 6) {
            status = 'WARN';
            message = `Desviación moderada (${worstDelta.toFixed(1)}dB en ${worstBand})`;
        } else {
            status = 'FAIL';
            message = `Desviación severa (${worstDelta.toFixed(1)}dB en ${worstBand})`;
        }

        return {
            status,
            values: { ...values, worstDelta: +worstDelta.toFixed(1), worstBand },
            message,
            spectral: {
                frequencies: freqs,
                octaveBands: { frequencies: freqs, levels },
                sampleRate,
            },
        };
    }
}
