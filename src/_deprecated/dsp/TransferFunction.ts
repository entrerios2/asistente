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
     * Añade un snapshot (FFT) de la señal de referencia y la señal medida (Zero-allocation).
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

            // Gxy: Y * conj(X) — Inlined complex multiplication conjugate for extreme speed
            const crossR = mR * rR + mI * rI;
            const crossI = mI * rR - mR * rI;
            this.gxyReal[i] += crossR;
            this.gxyImag[i] += crossI;
        }
        this.snapshots++;
    }

    /**
     * Calcula la Magnitud (dB) y Fase (rad) de la Función de Transferencia H(f).
     * H(f) = E[Gxy] / E[Gxx]
     * Escribe directamente en los Float32Arrays pre-asignados si se proporcionan.
     * De lo contrario, retorna nuevos arrays para retrocompatibilidad.
     */
    calculateH(outMagnitude?: Float32Array, outPhase?: Float32Array): { magnitude: Float32Array; phase: Float32Array } {
        const magnitude = outMagnitude || new Float32Array(this.bins);
        const phase = outPhase || new Float32Array(this.bins);
        const snapshotsCount = this.snapshots || 1e-12;

        for (let i = 0; i < this.bins; i++) {
            const avgGxx = this.gxx[i] / snapshotsCount;
            const avgGxyR = this.gxyReal[i] / snapshotsCount;
            const avgGxyI = this.gxyImag[i] / snapshotsCount;

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
     * Escribe en el Float32Array 'outCoherence' si se proporciona, de lo contrario retorna uno nuevo para retrocompatibilidad.
     */
    calculateCoherence(outCoherence?: Float32Array): Float32Array {
        const coherence = outCoherence || new Float32Array(this.bins);
        const snapshotsCount = this.snapshots || 1e-12;

        for (let i = 0; i < this.bins; i++) {
            const avgGxx = this.gxx[i] / snapshotsCount;
            const avgGyy = this.gyy[i] / snapshotsCount;
            const avgGxyR = this.gxyReal[i] / snapshotsCount;
            const avgGxyI = this.gxyImag[i] / snapshotsCount;

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
