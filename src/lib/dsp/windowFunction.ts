/**
 * Funciones de ventana avanzadas con corrección de ganancia (amplitud y energía).
 */

export type WindowType = 'Rectangular' | 'Hann' | 'Hamming' | 'FlatTop' | 'BlackmanHarris' | 'HFT223D' | 'Exponential';

export class WindowFunction {
    private cache: Record<string, Float32Array> = {};

    private getWindow(size: number, type: WindowType): Float32Array {
        const key = `${size}_${type}`;
        if (!this.cache[key]) {
            const win = new Float32Array(size);
            let sumAmp = 0;
            let sumEnergy = 0;

            for (let n = 0; n < size; n++) {
                let w_n = 1.0;
                const phi = (2 * Math.PI * n) / (size - 1);

                if (type === 'Hann') {
                    w_n = 0.5 * (1 - Math.cos(phi));
                } else if (type === 'Hamming') {
                    w_n = 0.54 - 0.46 * Math.cos(phi);
                } else if (type === 'FlatTop') {
                    w_n = 1.0 - 1.93 * Math.cos(phi) + 1.29 * Math.cos(2 * phi) - 0.388 * Math.cos(3 * phi) + 0.0322 * Math.cos(4 * phi);
                } else if (type === 'BlackmanHarris') {
                    w_n = 0.35875 - 0.48829 * Math.cos(phi) + 0.14128 * Math.cos(2 * phi) - 0.01168 * Math.cos(3 * phi);
                } else if (type === 'HFT223D') {
                    // Ventana HFT223D — 10 coeficientes (Heinzel et al., OSM)
                    w_n = 1.0
                        - 1.98298997309 * Math.cos(phi)
                        + 1.75556083063 * Math.cos(2 * phi)
                        - 1.19037717712 * Math.cos(3 * phi)
                        + 0.56155440797 * Math.cos(4 * phi)
                        - 0.17296769663 * Math.cos(5 * phi)
                        + 0.03233247087 * Math.cos(6 * phi)
                        - 0.00324954578 * Math.cos(7 * phi)
                        + 0.00013801040 * Math.cos(8 * phi)
                        - 0.00000132725 * Math.cos(9 * phi);
                } else if (type === 'Exponential') {
                    const tau = size / 5.0; // constante de tiempo
                    w_n = Math.exp(-n / tau);
                }

                win[n] = w_n;
                sumAmp += w_n;
                sumEnergy += w_n * w_n;
            }

            // Factores de corrección
            const cg = sumAmp / size; // Gain correction (Amplitud)

            // Normalización in-place en la caché según el factor requerido
            for (let n = 0; n < size; n++) {
                win[n] /= cg; // Corregir amplitud por defecto
            }

            this.cache[key] = win;
        }
        return this.cache[key];
    }

    public apply(data: Float32Array, type: WindowType): void {
        if (type === 'Rectangular') return;
        const size = data.length;
        const win = this.getWindow(size, type);
        for (let n = 0; n < size; n++) {
            data[n] *= win[n];
        }
    }
}
