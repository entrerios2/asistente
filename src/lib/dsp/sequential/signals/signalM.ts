/**
 * Segmento M — Mic Profile Verification
 * Sweeptones de tercio de octava: 31 bandas de 20Hz a 20kHz.
 * Cada tono dura ~0.5s.
 */
const THIRD_OCTAVE_FREQS: number[] = [
    20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400,
    500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000,
    6300, 8000, 10000, 12500, 16000, 20000,
];

export function generateSignalM(sampleRate: number): Float32Array {
    const toneDuration = 0.5;
    const toneSamples = Math.round(toneDuration * sampleRate);
    const totalSamples = THIRD_OCTAVE_FREQS.length * toneSamples;
    const buf = new Float32Array(totalSamples);
    const amp = Math.pow(10, -18 / 20);

    for (let b = 0; b < THIRD_OCTAVE_FREQS.length; b++) {
        const freq = THIRD_OCTAVE_FREQS[b];
        const phaseStep = (2 * Math.PI * freq) / sampleRate;
        const offset = b * toneSamples;
        for (let i = 0; i < toneSamples; i++) {
            buf[offset + i] = amp * Math.sin(i * phaseStep);
        }
    }

    return buf;
}
