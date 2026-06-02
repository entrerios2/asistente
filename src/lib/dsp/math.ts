/**
 * Utilidades matemáticas para operaciones con números complejos sobre Float32Arrays.
 */
export class ComplexMath {
    /**
     * Multiplica dos números complejos: (a + bi) * (c + di).
     */
    static mul(aReal: number, aImag: number, bReal: number, bImag: number): [number, number];
    static mul(aReal: number, aImag: number, bReal: number, bImag: number, out: Float32Array, offset?: number): void;
    static mul(aReal: number, aImag: number, bReal: number, bImag: number, out?: Float32Array, offset: number = 0): [number, number] | void {
        const r = aReal * bReal - aImag * bImag;
        const i = aReal * bImag + aImag * bReal;
        if (out) {
            out[offset] = r;
            out[offset + 1] = i;
            return;
        }
        return [r, i];
    }

    /**
     * Multiplica un número complejo por el conjugado de otro: (a + bi) * (c - di).
     */
    static mulConjugate(aReal: number, aImag: number, bReal: number, bImag: number): [number, number];
    static mulConjugate(aReal: number, aImag: number, bReal: number, bImag: number, out: Float32Array, offset?: number): void;
    static mulConjugate(aReal: number, aImag: number, bReal: number, bImag: number, out?: Float32Array, offset: number = 0): [number, number] | void {
        const realVal = aReal * bReal + aImag * bImag;
        const imagVal = aImag * bReal - aReal * bImag;
        if (out) {
            out[offset] = realVal;
            out[offset + 1] = imagVal;
            return;
        }
        return [realVal, imagVal];
    }

    /**
     * Calcula la magnitud (módulo) de un número complejo.
     */
    static abs(real: number, imag: number): number {
        return Math.sqrt(real * real + imag * imag);
    }

    /**
     * Calcula el ángulo (fase) en radianes de un número complejo.
     */
    static phase(real: number, imag: number): number {
        return Math.atan2(imag, real);
    }

    /**
     * Operación de división compleja: (a + bi) / (c + di).
     */
    static div(aReal: number, aImag: number, bReal: number, bImag: number): [number, number];
    static div(aReal: number, aImag: number, bReal: number, bImag: number, out: Float32Array, offset?: number): void;
    static div(aReal: number, aImag: number, bReal: number, bImag: number, out?: Float32Array, offset: number = 0): [number, number] | void {
        const den = bReal * bReal + bImag * bImag || 1e-12;
        const r = (aReal * bReal + aImag * bImag) / den;
        const i = (aImag * bReal - aReal * bImag) / den;
        if (out) {
            out[offset] = r;
            out[offset + 1] = i;
            return;
        }
        return [r, i];
    }

    /**
     * Valida y restringe un valor de frecuencia dentro del rango audible humano (20Hz - 20kHz).
     */
    static sanitizeFrequency(freq: number): number {
        if (isNaN(freq) || typeof freq !== 'number') return 1000;
        return Math.max(20, Math.min(20000, freq));
    }

    /**
     * Valida y restringe un valor de ganancia (dB) dentro de un rango seguro (-100dB a +24dB).
     */
    static sanitizeGain(gain: number): number {
        if (isNaN(gain) || typeof gain !== 'number') return 0;
        return Math.max(-100, Math.min(24, gain));
    }

    /**
     * Valida y restringe un valor de factor Q (calidad de filtro).
     */
    static sanitizeQ(q: number): number {
        if (isNaN(q) || typeof q !== 'number') return 1.0;
        return Math.max(0.1, Math.min(50, q));
    }
}
