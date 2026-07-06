import { generateMLS } from '../../signalGenerators';

/**
 * Segmento T — Time Alignment
 * MLS orden 16 (~1.37s) + silencio (~3.6s) para cubrir la ventana de captura de la IR.
 * Total ~5s.
 */
export function generateSignalT(sampleRate: number): Float32Array {
    const mlsBuffer = generateMLS(16);
    const mlsSamples = mlsBuffer.length;
    const paddingDuration = 3.6;
    const paddingSamples = Math.round(paddingDuration * sampleRate);
    const totalSamples = mlsSamples + paddingSamples;

    const buf = new Float32Array(totalSamples);
    buf.set(mlsBuffer, 0);
    // padding is already zeroed
    return buf;
}
