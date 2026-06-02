/**
 * Computador de nivel de presión sonora equivalente continuo (Leq).
 * Integra energía acústica en ventanas de tiempo configurables.
 */

export class LeqCalculator {
    private sampleRate: number;
    private windowSamples: number;
    private buffer: Float32Array;
    private writeIdx: number = 0;
    private count: number = 0;
    private sumOfSquares: number = 0;

    constructor(windowSeconds: number = 1, sampleRate: number = 48000) {
        this.sampleRate = sampleRate;
        this.windowSamples = Math.round(windowSeconds * sampleRate);
        this.buffer = new Float32Array(this.windowSamples);
    }

    /**
     * Agrega un bloque de audio y calcula el Leq en tiempo real.
     */
    public processBlock(block: Float32Array): number {
        const N = block.length;

        for (let i = 0; i < N; i++) {
            const sample = block[i];
            const sq = sample * sample;

            // Restar el elemento saliente del acumulador circular
            this.sumOfSquares -= this.buffer[this.writeIdx];
            
            // Guardar el nuevo elemento
            this.buffer[this.writeIdx] = sq;
            this.sumOfSquares += sq;

            this.writeIdx = (this.writeIdx + 1) % this.windowSamples;
            if (this.count < this.windowSamples) this.count++;
        }

        const avgSq = this.sumOfSquares / Math.max(1, this.count);
        // Conversión a dB con un nivel de referencia de presión sonora (ej. 20uPa / dBSPL calibrado)
        const rms = Math.sqrt(avgSq);
        return 20 * Math.log10(rms + 1e-12) + 94.0; // Calibrado para que 1.0 RMS = 94 dBSPL
    }

    public setWindowSeconds(seconds: number): void {
        const newSamples = Math.round(seconds * this.sampleRate);
        if (newSamples === this.windowSamples) return;

        this.windowSamples = newSamples;
        this.buffer = new Float32Array(newSamples);
        this.writeIdx = 0;
        this.count = 0;
        this.sumOfSquares = 0;
    }

    public reset(): void {
        this.writeIdx = 0;
        this.count = 0;
        this.sumOfSquares = 0;
        this.buffer.fill(0);
    }
}
