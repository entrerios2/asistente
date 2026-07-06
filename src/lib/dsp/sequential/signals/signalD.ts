/**
 * Segmento D — Distortion THD+N
 * Seno 1kHz @ 0dBFS (4s) + @ -6dBFS (4s).
 */
export function generateSignalD(sampleRate: number): Float32Array {
    const partDuration = 4;
    const partSamples = partDuration * sampleRate;
    const totalSamples = partSamples * 2;
    const buf = new Float32Array(totalSamples);
    const phaseStep = (2 * Math.PI * 1000) / sampleRate;

    for (let i = 0; i < partSamples; i++) {
        buf[i] = Math.sin(i * phaseStep);
    }

    const amp6 = Math.pow(10, -6 / 20);
    for (let i = 0; i < partSamples; i++) {
        buf[partSamples + i] = amp6 * Math.sin(i * phaseStep);
    }

    return buf;
}
