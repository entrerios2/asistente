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

export const palettes: Record<PaletteType, Uint8ClampedArray> = {
    Jet: jet,
    Magma: magma,
    Viridis: magma, // Placeholder for Viridis
    Hot: hot,
    Grayscale: grayscale
};

export function getColorFromPalette(v: number, type: PaletteType): [number, number, number] {
    const idx = Math.max(0, Math.min(255, Math.round(v * 255)));
    const p = palettes[type];
    return [p[idx * 3], p[idx * 3 + 1], p[idx * 3 + 2]];
}
