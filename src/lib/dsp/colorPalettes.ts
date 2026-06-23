/**
 * LUTs de paletas de colores para el espectrograma.
 * Cada paleta es un array de 256 colores RGB.
 */

export type PaletteType = 'Jet' | 'Magma' | 'Viridis' | 'Hot' | 'Grayscale';

const jet = new Uint8ClampedArray(256 * 3);
const magma = new Uint8ClampedArray(256 * 3);
const hot = new Uint8ClampedArray(256 * 3);
const grayscale = new Uint8ClampedArray(256 * 3);

// Inicializar Grayscale
for (let i = 0; i < 256; i++) {
    grayscale[i * 3] = i;
    grayscale[i * 3 + 1] = i;
    grayscale[i * 3 + 2] = i;
}

// Inicializar Jet (Aproximación)
for (let i = 0; i < 256; i++) {
    const v = i / 255;
    jet[i * 3] = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(v * 4 - 3))))) ;
    jet[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(v * 4 - 2))))) ;
    jet[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(v * 4 - 1))))) ;
}

// Inicializar Magma (Aproximación simplificada)
for (let i = 0; i < 256; i++) {
    const v = i / 255;
    magma[i * 3] = Math.round(255 * Math.pow(v, 1.2));
    magma[i * 3 + 1] = Math.round(255 * Math.pow(v, 2.0));
    magma[i * 3 + 2] = Math.round(255 * Math.pow(v, 0.5) * (1 - v) * 128 + 255 * Math.pow(v, 4));
}

// Inicializar Hot
for (let i = 0; i < 256; i++) {
    const v = i / 255;
    hot[i * 3] = Math.max(0, Math.min(255, Math.round(255 * Math.min(1, v * 3))));
    hot[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(255 * Math.max(0, Math.min(1, v * 3 - 1)))));
    hot[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(255 * Math.max(0, Math.min(1, v * 3 - 2)))));
}

// Inicializar Viridis (interpolación de puntos de control canónicos)
const viridis = new Uint8ClampedArray(256 * 3);
{
    // Canonical Viridis control points: [position, R, G, B]
    const stops: [number, number, number, number][] = [
        [0.00,  68,   1, 84],
        [0.13,  71,  44, 122],
        [0.25,  59,  81, 139],
        [0.38,  44, 113, 142],
        [0.50,  33, 144, 140],
        [0.63,  39, 173, 129],
        [0.75,  92, 200, 99],
        [0.88, 170, 220, 50],
        [1.00, 253, 231, 37],
    ];
    for (let i = 0; i < 256; i++) {
        const t = i / 255;
        // Find surrounding control points
        let lo = 0;
        for (let s = 0; s < stops.length - 1; s++) {
            if (t >= stops[s][0]) lo = s;
        }
        const hi = Math.min(lo + 1, stops.length - 1);
        const range = stops[hi][0] - stops[lo][0] || 1;
        const frac = (t - stops[lo][0]) / range;
        viridis[i * 3]     = Math.round(stops[lo][1] + frac * (stops[hi][1] - stops[lo][1]));
        viridis[i * 3 + 1] = Math.round(stops[lo][2] + frac * (stops[hi][2] - stops[lo][2]));
        viridis[i * 3 + 2] = Math.round(stops[lo][3] + frac * (stops[hi][3] - stops[lo][3]));
    }
}

export const palettes: Record<PaletteType, Uint8ClampedArray> = {
    Jet: jet,
    Magma: magma,
    Viridis: viridis,
    Hot: hot,
    Grayscale: grayscale
};

export function getColorFromPalette(v: number, type: PaletteType): [number, number, number] {
    const idx = Math.max(0, Math.min(255, Math.round(v * 255)));
    const p = palettes[type];
    return [p[idx * 3], p[idx * 3 + 1], p[idx * 3 + 2]];
}
