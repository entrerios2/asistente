import { generateLogSweep } from '../../signalGenerators';

/**
 * Segmento F — Frequency Response (Fast)
 * Sweep logarítmico 40Hz–20kHz ~15s.
 */
export function generateSignalF(sampleRate: number): Float32Array {
    const duration = 15;
    const samples = duration * sampleRate;
    const buf = new Float32Array(samples);
    generateLogSweep(buf, samples, 40, 20000, duration, sampleRate);
    return buf;
}
