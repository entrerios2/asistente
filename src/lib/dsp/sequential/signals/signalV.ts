import { generateFSKRotation } from '../FSKHeader';

/**
 * Segmento V — Path Audit
 * 5 headers FSK + seno 1kHz @ -18dBFS (2s) + silencio (3s)
 */
export function generateSignalV(sampleRate: number): Float32Array {
    const fskRotation = generateFSKRotation('V', 5, sampleRate, 'HF');

    const pilotDuration = 2;
    const silenceDuration = 3;
    const pilotSamples = pilotDuration * sampleRate;
    const silenceSamples = silenceDuration * sampleRate;

    const totalSamples = fskRotation.length + pilotSamples + silenceSamples;
    const buf = new Float32Array(totalSamples);

    let offset = 0;
    buf.set(fskRotation, offset);
    offset += fskRotation.length;

    const amp = Math.pow(10, -18 / 20);
    const phaseStep = (2 * Math.PI * 1000) / sampleRate;
    for (let i = 0; i < pilotSamples; i++) {
        buf[offset + i] = amp * Math.sin(i * phaseStep);
    }
    offset += pilotSamples;

    // silence is already zero-initialized

    return buf;
}
