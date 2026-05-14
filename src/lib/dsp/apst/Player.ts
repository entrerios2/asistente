import { base } from '$app/paths';
import type { AudioProvider } from '../../hal/types';

/**
 * APST Player: Orquestador de alto nivel para la reproducción de secuencias acústicas.
 */
export class Player {
    constructor(private hal: AudioProvider) {}

    /**
     * Reproduce una secuencia pre-generada basada en su nombre y parámetros técnicos.
     * 
     * @param sequenceName Nombre base de la secuencia (ej. 'tone_1k', 'sweep_lin').
     * @param sampleRate Frecuencia de muestreo (ej. 44100, 48000).
     * @param type Tipo de fidelidad ('HF' para High Fidelity, 'LF' para Low Fidelity/Compressed).
     */
    async playSequence(sequenceName: string, sampleRate: number, type: 'HF' | 'LF'): Promise<void> {
        if (!this.hal.playSample) {
            console.warn('El AudioProvider actual no soporta la reproducción de samples.');
            return;
        }

        // Construcción de la URL siguiendo el estándar del APST Builder
        // Formato esperado: /audio/secuencias/tone_1k_HF_48000.wav
        const url = `${base}/audio/secuencias/${sequenceName}_${type}_${sampleRate}.wav`;

        console.info(`APST Player: Iniciando reproducción de ${url}`);
        
        try {
            await this.hal.playSample(url);
            console.info(`APST Player: Reproducción finalizada.`);
        } catch (error) {
            console.error(`APST Player: Error al reproducir la secuencia:`, error);
            throw error;
        }
    }
}
