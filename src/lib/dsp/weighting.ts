import { peakingCoeffs, biquadResponse } from './biquad';

/**
 * Implementación de filtros de ponderación ANSI 1.43-1997.
 * Aplica curvas A, B, C y Z (lineal).
 */

export type WeightingType = 'A' | 'B' | 'C' | 'Z';

export function getWeightingGain(f: number, type: WeightingType): number {
    if (type === 'Z') return 0;

    const fSq = f * f;
    const f4 = fSq * fSq;

    if (type === 'A') {
        const num = 1.2589e13 * f4;
        const den = (fSq + 20.6 * 20.6) * 
                    Math.sqrt((fSq + 107.7 * 107.7) * (fSq + 737.9 * 737.9)) * 
                    (fSq + 12194 * 12194);
        return 20 * Math.log10(num / den) + 2.0;
    }

    if (type === 'C') {
        const num = 1.2589e13 * fSq;
        const den = (fSq + 20.6 * 20.6) * (fSq + 12194 * 12194);
        return 20 * Math.log10(num / den) + 0.06;
    }

    if (type === 'B') {
        const num = 1.2589e13 * fSq * f;
        const den = (fSq + 20.6 * 20.6) * Math.sqrt(fSq + 158.5 * 158.5) * (fSq + 12194 * 12194);
        return 20 * Math.log10(num / den) + 0.17;
    }

    return 0;
}
