import { fft, magnitude } from '../../fft';

const THIRD_OCTAVE_FREQS = [
    20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400,
    500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000,
    6300, 8000, 10000, 12500, 16000, 20000,
];

const TONE_DURATION = 0.5;

const FFT_SIZE = 8192;

function rmsBlock(buf: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
}

export class SegmentM {
    static process(buffer: Float32Array, sampleRate: number) {
        const toneSamples = Math.round(TONE_DURATION * sampleRate);
        const values: Record<string, number | string> = {};
        let worstDelta = 0;
        let worstBand = '';

        for (let b = 0; b < THIRD_OCTAVE_FREQS.length; b++) {
            const start = b * toneSamples;
            const end = start + toneSamples;
            if (end > buffer.length) break;

            const chunk = buffer.slice(start, end);
            const rms = rmsBlock(chunk);
            const expectedFreq = THIRD_OCTAVE_FREQS[b];

            const fftResult = fft(chunk);
            const magArr = magnitude(fftResult.real, fftResult.imag);
            const binFreq = (expectedFreq / sampleRate) * FFT_SIZE;
            const binIdx = Math.round(binFreq);
            const mag = binIdx < magArr.length ? magArr[binIdx] : 0;
            const magDb = 20 * Math.log10(Math.max(mag, 1e-12));

            const expectedDb = -18;
            const delta = magDb - expectedDb;
            values[`${expectedFreq}Hz`] = delta.toFixed(1);

            if (Math.abs(delta) > Math.abs(worstDelta)) {
                worstDelta = delta;
                worstBand = `${expectedFreq}Hz`;
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

        return { status, values: { ...values, worstDelta: +worstDelta.toFixed(1), worstBand }, message };
    }
}
