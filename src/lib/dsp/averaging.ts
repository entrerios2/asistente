/**
 * Implementación de promediado complejo avanzado (FIFO y LPF).
 * Permite suavizar magnitud y fase de forma coherente.
 */

export class ComplexAveraging {
    private depth: number;
    private bins: number;
    private bufferReal: Float32Array[];
    private bufferImag: Float32Array[];
    private writeIdx: number = 0;
    private count: number = 0;

    // Para LPF (Bessel 5to orden simplificado o exponencial por bin)
    private lpfReal: Float32Array;
    private lpfImag: Float32Array;
    private lastValidReal: Float32Array;
    private lastValidImag: Float32Array;

    constructor(bins: number, depth: number = 16) {
        this.bins = bins;
        this.depth = depth;
        this.bufferReal = Array.from({ length: depth }, () => new Float32Array(bins));
        this.bufferImag = Array.from({ length: depth }, () => new Float32Array(bins));
        this.lpfReal = new Float32Array(bins);
        this.lpfImag = new Float32Array(bins);
        this.lastValidReal = new Float32Array(bins);
        this.lastValidImag = new Float32Array(bins);
    }

    public processFIFO(inReal: Float32Array, inImag: Float32Array, outReal: Float32Array, outImag: Float32Array, thresholdDb?: number): void {
        // Amplitude thresholding: descartar bins debajo del umbral
        if (thresholdDb !== undefined && thresholdDb > -120) {
            for (let i = 0; i < this.bins; i++) {
                const mag = Math.sqrt(inReal[i] * inReal[i] + inImag[i] * inImag[i]);
                const db = 20 * Math.log10(mag + 1e-12);
                if (db < thresholdDb) {
                    inReal[i] = this.lastValidReal[i];
                    inImag[i] = this.lastValidImag[i];
                } else {
                    this.lastValidReal[i] = inReal[i];
                    this.lastValidImag[i] = inImag[i];
                }
            }
        }

        this.bufferReal[this.writeIdx].set(inReal);
        this.bufferImag[this.writeIdx].set(inImag);
        this.writeIdx = (this.writeIdx + 1) % this.depth;
        if (this.count < this.depth) this.count++;

        outReal.fill(0);
        outImag.fill(0);

        for (let d = 0; d < this.count; d++) {
            for (let i = 0; i < this.bins; i++) {
                outReal[i] += this.bufferReal[d][i];
                outImag[i] += this.bufferImag[d][i];
            }
        }

        for (let i = 0; i < this.bins; i++) {
            outReal[i] /= this.count;
            outImag[i] /= this.count;
        }
    }

    public processLPF(inReal: Float32Array, inImag: Float32Array, outReal: Float32Array, outImag: Float32Array, alpha: number): void {
        for (let i = 0; i < this.bins; i++) {
            this.lpfReal[i] += (inReal[i] - this.lpfReal[i]) * alpha;
            this.lpfImag[i] += (inImag[i] - this.lpfImag[i]) * alpha;
            outReal[i] = this.lpfReal[i];
            outImag[i] = this.lpfImag[i];
        }
    }

    public setDepth(newDepth: number) {
        if (newDepth === this.depth) return;
        this.depth = Math.max(1, Math.min(64, newDepth));
        this.bufferReal = Array.from({ length: this.depth }, () => new Float32Array(this.bins));
        this.bufferImag = Array.from({ length: this.depth }, () => new Float32Array(this.bins));
        this.lastValidReal = new Float32Array(this.bins);
        this.lastValidImag = new Float32Array(this.bins);
        this.writeIdx = 0;
        this.count = 0;
    }

    public reset() {
        this.writeIdx = 0;
        this.count = 0;
        this.lpfReal.fill(0);
        this.lpfImag.fill(0);
        this.lastValidReal.fill(0);
        this.lastValidImag.fill(0);
    }
}
