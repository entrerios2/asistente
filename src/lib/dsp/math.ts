/**
 * Utilidades matemáticas para operaciones con números complejos sobre Float32Arrays.
 */
export class ComplexMath {
    /**
     * Multiplica dos números complejos: (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
     */
    static mul(aReal: number, aImag: number, bReal: number, bImag: number): [number, number] {
        return [
            aReal * bReal - aImag * bImag,
            aReal * bImag + aImag * bReal
        ];
    }

    /**
     * Multiplica un número complejo por el conjugado de otro: (a + bi) * (c - di)
     */
    static mulConjugate(aReal: number, aImag: number, bReal: number, bImag: number): [number, number] {
        return [
            aReal * bReal + aImag * bImag,
            aImag * bReal - aReal * bImag
        ];
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
     * Operación de división compleja: (a + bi) / (c + di)
     */
    static div(aReal: number, aImag: number, bReal: number, bImag: number): [number, number] {
        const den = bReal * bReal + bImag * bImag;
        return [
            (aReal * bReal + aImag * bImag) / den,
            (aImag * bReal - aReal * bImag) / den
        ];
    }
}
