import { ComplexMath } from './math';

/**
 * Calculador de Función de Transferencia (H) y Coherencia (γ²).
 */
export class TransferFunction {
    private bins: number;
    private snapshots: number = 0;

    // Acumuladores para promediado (Densidades espectrales)
    private gxx: Float32Array; // Auto-espectro Referencia
    private gyy: Float32Array; // Auto-espectro Medición
    private gxyReal: Float32Array; // Espectro Cruzado (Real)
    private gxyImag: Float32Array; // Espectro Cruzado (Imag)

    constructor(bins: number) {
        this.bins = bins;
        this.gxx = new Float32Array(bins);
        this.gyy = new Float32Array(bins);
        this.gxyReal = new Float32Array(bins);
        this.gxyImag = new Float32Array(bins);
    }

    /**
     * Añade un snapshot (FFT) de la señal de referencia y la señal medida.
     */
    addSnapshot(refReal: Float32Array, refImag: Float32Array, measReal: Float32Array, measImag: Float32Array) {
        for (let i = 0; i < this.bins; i++) {
            const rR = refReal[i];
            const rI = refImag[i];
            const mR = measReal[i];
            const mI = measImag[i];

            // Gxx: X * conj(X) = |X|²
            this.gxx[i] += rR * rR + rI * rI;

            // Gyy: Y * conj(Y) = |Y|²
            this.gyy[i] += mR * mR + mI * mI;

            // Gxy: Y * conj(X)
            const [crossR, crossI] = ComplexMath.mulConjugate(mR, mI, rR, rI);
            this.gxyReal[i] += crossR;
            this.gxyImag[i] += crossI;
        }
        this.snapshots++;
    }

    /**
     * Calcula la Magnitud (dB) y Fase (rad) de la Función de Transferencia H(f).
     * H(f) = E[Gxy] / E[Gxx]
     */
    calculateH(): { magnitude: Float32Array; phase: Float32Array } {
        const magnitude = new Float32Array(this.bins);
        const phase = new Float32Array(this.bins);

        for (let i = 0; i < this.bins; i++) {
            const avgGxx = this.gxx[i] / this.snapshots;
            const avgGxyR = this.gxyReal[i] / this.snapshots;
            const avgGxyI = this.gxyImag[i] / this.snapshots;

            // H = Gxy / Gxx
            const hReal = avgGxyR / (avgGxx + 1e-12);
            const hImag = avgGxyI / (avgGxx + 1e-12);

            const mag = ComplexMath.abs(hReal, hImag);
            magnitude[i] = 20 * Math.log10(Math.max(mag, 1e-6));
            phase[i] = ComplexMath.phase(hReal, hImag);
        }

        return { magnitude, phase };
    }

    /**
     * Calcula la Coherencia γ²(f).
     * γ² = |E[Gxy]|² / (E[Gxx] * E[Gyy])
     */
    calculateCoherence(): Float32Array {
        const coherence = new Float32Array(this.bins);

        for (let i = 0; i < this.bins; i++) {
            const avgGxx = this.gxx[i] / this.snapshots;
            const avgGyy = this.gyy[i] / this.snapshots;
            const avgGxyR = this.gxyReal[i] / this.snapshots;
            const avgGxyI = this.gxyImag[i] / this.snapshots;

            const crossMagSq = avgGxyR * avgGxyR + avgGxyI * avgGxyI;
            const den = avgGxx * avgGyy;

            coherence[i] = den > 0 ? crossMagSq / den : 0;
            // Saturar a 1.0 por errores de precisión
            if (coherence[i] > 1.0) coherence[i] = 1.0;
        }

        return coherence;
    }

    reset() {
        this.snapshots = 0;
        this.gxx.fill(0);
        this.gyy.fill(0);
        this.gxyReal.fill(0);
        this.gxyImag.fill(0);
    }
}
