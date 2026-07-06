/**
 * Segmento A — Alignment Level
 * Seno 1kHz @ -18dBFS por 5 segundos.
 */
export function generateSignalA(sampleRate: number): Float32Array {
    const duration = 5;
    const samples = duration * sampleRate;
    const buf = new Float32Array(samples);
    const amp = Math.pow(10, -18 / 20);
    const phaseStep = (2 * Math.PI * 1000) / sampleRate;
    for (let i = 0; i < samples; i++) {
        buf[i] = amp * Math.sin(i * phaseStep);
    }
    return buf;
}
