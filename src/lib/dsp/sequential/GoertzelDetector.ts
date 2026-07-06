/**
 * Implementación pura del algoritmo de Goertzel para detección de frecuencias específicas.
 */
export class GoertzelDetector {
    private coeff: number;
    private q1: number = 0;
    private q2: number = 0;

    /**
     * @param targetFrequency Frecuencia a detectar (Hz).
     * @param sampleRate Frecuencia de muestreo (Hz).
     * @param blockSize Tamaño del bloque de procesamiento (N).
     */
    constructor(
        private targetFrequency: number,
        private sampleRate: number,
        private blockSize: number
    ) {
        const k = Math.round((blockSize * targetFrequency) / sampleRate);
        const omega = (2 * Math.PI * k) / blockSize;
        this.coeff = 2 * Math.cos(omega);
    }

    /**
     * Procesa un bloque de muestras y devuelve la magnitud (energía) detectada.
     * @param samples Array de muestras en punto flotante [-1, 1].
     */
    processBlock(samples: Float32Array): number {
        this.q1 = 0;
        this.q2 = 0;

        for (let i = 0; i < samples.length; i++) {
            const q0 = this.coeff * this.q1 - this.q2 + samples[i];
            this.q2 = this.q1;
            this.q1 = q0;
        }

        // Cálculo de la magnitud al cuadrado (energía relativa)
        const magnitudeSq = this.q1 * this.q1 + this.q2 * this.q2 - this.q1 * this.q2 * this.coeff;
        return magnitudeSq;
    }
}
