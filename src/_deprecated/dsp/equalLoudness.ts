/**
 * Implementación de curvas de igual volumen (Equal Loudness Contours) ISO 226:2003.
 * Retorna el nivel de presión sonora compensado en dBSPL para un nivel de fones (Phons) dado.
 */

// Parámetros de interpolación ISO 226:2003
const ISO_FREQS = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500];
const ISO_AF = [0.532, 0.506, 0.480, 0.455, 0.432, 0.409, 0.387, 0.367, 0.349, 0.330, 0.315, 0.301, 0.288, 0.276, 0.267, 0.259, 0.253, 0.250, 0.246, 0.244, 0.243, 0.243, 0.243, 0.242, 0.242, 0.245, 0.254, 0.271, 0.301];
const ISO_LU = [-31.6, -27.2, -23.0, -19.1, -15.9, -13.0, -10.3, -8.1, -6.2, -4.5, -3.1, -2.0, -1.1, -0.4, 0.0, 0.3, 0.5, 0.0, -2.7, -4.1, -1.0, 1.7, 2.5, 1.2, -2.1, -7.1, -11.2, -10.7, -3.1];
const ISO_TF = [78.5, 68.7, 59.5, 51.1, 44.0, 37.5, 31.5, 26.5, 22.1, 17.9, 14.4, 11.4, 8.6, 6.2, 4.4, 3.0, 1.6, 2.4, 3.5, 1.7, -1.3, -4.2, -6.0, -5.4, -1.5, 3.7, 7.5, 11.3, 11.6];

export function getEqualLoudnessContour(phons: number, bins: number, fs: number, outArray: Float32Array): void {
    const nyquist = fs / 2;

    for (let i = 0; i < bins; i++) {
        const freq = (i * nyquist) / bins || 1e-6;
        
        // Encontrar segmento en frecuencias ISO
        let idx = 0;
        if (freq <= ISO_FREQS[0]) {
            idx = 0;
        } else if (freq >= ISO_FREQS[ISO_FREQS.length - 1]) {
            idx = ISO_FREQS.length - 2;
        } else {
            while (idx < ISO_FREQS.length - 1 && ISO_FREQS[idx + 1] < freq) {
                idx++;
            }
        }

        // Interpolación logarítmica
        const f0 = ISO_FREQS[idx];
        const f1 = ISO_FREQS[idx + 1];
        const t = (Math.log10(freq) - Math.log10(f0)) / (Math.log10(f1) - Math.log10(f0));

        const af = ISO_AF[idx] * (1 - t) + ISO_AF[idx + 1] * t;
        const lu = ISO_LU[idx] * (1 - t) + ISO_LU[idx + 1] * t;
        const tf = ISO_TF[idx] * (1 - t) + ISO_TF[idx + 1] * t;

        // Fórmula ISO 226:2003
        const lp = (10 / af) * Math.log10(Math.pow(10, 0.025 * phons) - 1.15 + Math.pow(10, 0.025 * (tf - lu))) + lu;
        outArray[i] = isNaN(lp) ? 0 : lp;
    }
}
