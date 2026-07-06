/**
 * Segmento N — Noise Floor
 * Silencio por 12 segundos (el header FSK arma al analizador, luego silencio).
 */
export function generateSignalN(sampleRate: number): Float32Array {
    const duration = 12;
    return new Float32Array(duration * sampleRate);
}
