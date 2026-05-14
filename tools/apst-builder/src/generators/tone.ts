/**
 * Genera una onda senoidal pura.
 * @param frequency Frecuencia en Hz.
 * @param durationSec Duración en segundos.
 * @param sampleRate Frecuencia de muestreo (ej. 48000).
 */
export function generateTone(frequency: number, durationSec: number, sampleRate: number): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
        buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }
    
    return buffer;
}
