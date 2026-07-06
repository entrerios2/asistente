import { generatePinkNoise } from '../../signalGenerators';

/**
 * Segmento R — Feedback Margin
 * Ruido rosa con rampa de ganancia lineal creciente durante ~15s.
 * La ganancia va de -30dBFS a 0dBFS.
 */
export function generateSignalR(sampleRate: number): Float32Array {
    const duration = 15;
    const samples = duration * sampleRate;
    const buf = new Float32Array(samples);

    generatePinkNoise(buf, samples, sampleRate);

    const gainStart = Math.pow(10, -30 / 20);
    const gainEnd = Math.pow(10, 0 / 20);
    for (let i = 0; i < samples; i++) {
        const t = i / samples;
        const gain = gainStart + (gainEnd - gainStart) * t;
        buf[i] *= gain;
    }

    return buf;
}
