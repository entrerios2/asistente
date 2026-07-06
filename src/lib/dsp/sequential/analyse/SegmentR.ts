import { fft, magnitude } from '../../fft';

const WINDOW_SIZE = 2048;
const RISE_THRESHOLD = 6;
const MIN_FEEDBACK_DB = -40;

export class SegmentR {
    static process(buffer: Float32Array, sampleRate: number) {
        const durationSec = buffer.length / sampleRate;
        const totalWindows = Math.floor(buffer.length / WINDOW_SIZE);
        if (totalWindows < 2) {
            return { status: 'ERROR' as const, values: {}, message: 'Buffer demasiado corto para análisis' };
        }

        let prevEnergies: number[] = [];
        let feedbackWindow = -1;

        for (let w = 0; w < totalWindows; w++) {
            const start = w * WINDOW_SIZE;
            const chunk = buffer.slice(start, start + WINDOW_SIZE);
            const result = fft(chunk);
            const magArr = magnitude(result.real, result.imag);
            const half = magArr.length;

            const bandEnergies: number[] = [];
            const bands: [number, number][] = [
                [0, 5], [5, 10], [10, 20], [20, 40], [40, 80], [80, 160],
                [160, 320], [320, 640], [640, 1280], [1280, 2560],
                [2560, 5120], [5120, 10240],
            ];

            for (const [lo, hi] of bands) {
                const loBin = Math.round((lo / sampleRate) * WINDOW_SIZE);
                const hiBin = Math.min(Math.round((hi / sampleRate) * WINDOW_SIZE), half - 1);
                let energy = 0;
                for (let b = loBin; b <= hiBin; b++) {
                    if (b >= 0 && b < half) energy += magArr[b];
                }
                bandEnergies.push(energy);
            }

            if (prevEnergies.length > 0) {
                let maxRiseDb = -Infinity;
                for (let i = 0; i < bandEnergies.length; i++) {
                    const prev = Math.max(prevEnergies[i], 1e-12);
                    const curr = Math.max(bandEnergies[i], 1e-12);
                    const riseDb = 20 * Math.log10(curr / prev);
                    if (riseDb > maxRiseDb) maxRiseDb = riseDb;
                }

                if (maxRiseDb > RISE_THRESHOLD) {
                    const gainDb = -30 + 30 * (w / totalWindows);
                    if (gainDb > MIN_FEEDBACK_DB) {
                        feedbackWindow = w;
                        break;
                    }
                }
            }

            prevEnergies = bandEnergies;
        }

        if (feedbackWindow >= 0) {
            const gainAtFeedback = -30 + 30 * (feedbackWindow / totalWindows);
            return {
                status: 'FAIL' as const,
                values: { feedbackGainDb: +gainAtFeedback.toFixed(1) },
                message: `Feedback detectado a ${gainAtFeedback.toFixed(1)}dBFS`,
            };
        }

        return {
            status: 'PASS' as const,
            values: {},
            message: `Sin feedback detectado en rampa de -30 a 0dBFS (${durationSec.toFixed(0)}s)`,
        };
    }
}
