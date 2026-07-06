import { generateLogSweep } from '../../signalGenerators';

/**
 * Segmento P — Phase & Coherence
 * Sweep logarítmico dual-canal ~15s.
 * (El análisis de fase/coherencia usa la captura de ambos canales.
 *  El buffer es mono; el enrutamiento estéreo se configura al reproducir.)
 */
export function generateSignalP(sampleRate: number): Float32Array {
    const duration = 15;
    const samples = duration * sampleRate;
    const buf = new Float32Array(samples);
    generateLogSweep(buf, samples, 40, 20000, duration, sampleRate);
    return buf;
}
