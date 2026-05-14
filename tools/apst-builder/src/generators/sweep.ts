/**
 * Genera un barrido senoidal logarítmico (Log Sweep/Chirp).
 * @param startFreq Frecuencia inicial en Hz.
 * @param endFreq Frecuencia final en Hz.
 * @param durationSec Duración en segundos.
 * @param sampleRate Frecuencia de muestreo.
 */
export function generateLogSweep(
    startFreq: number, 
    endFreq: number, 
    durationSec: number, 
    sampleRate: number
): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);
    
    const L = durationSec / Math.log(endFreq / startFreq);
    
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Fase instantánea para un barrido logarítmico
        const phase = 2 * Math.PI * startFreq * L * (Math.exp(t / L) - 1);
        buffer[i] = Math.sin(phase);
    }
    
    return buffer;
}
