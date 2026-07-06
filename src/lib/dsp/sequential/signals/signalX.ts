/**
 * Segmento X — Crosstalk
 * Seno 1kHz @ 0dBFS: 5s por canal (el enrutamiento L/R se configura al reproducir).
 * El buffer contiene una marcación para indicar el punto medio.
 */
export function generateSignalX(sampleRate: number): Float32Array {
    const partDuration = 5;
    const partSamples = partDuration * sampleRate;
    const totalSamples = partSamples * 2;
    const buf = new Float32Array(totalSamples);
    const phaseStep = (2 * Math.PI * 1000) / sampleRate;

    for (let i = 0; i < partSamples; i++) {
        buf[i] = Math.sin(i * phaseStep);      // L primero
    }
    for (let i = 0; i < partSamples; i++) {
        buf[partSamples + i] = Math.sin(i * phaseStep);  // R después
    }

    return buf;
}
