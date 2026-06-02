/**
 * Algoritmo para recortar la respuesta al impulso en el dominio del tiempo o frecuencia (Time Windowing).
 * Permite silenciar rebotes, reflexiones secundarias y ruido en el suelo.
 */

export function applySourceWindow(
    data: Float32Array,
    widthMs: number,
    offsetMs: number,
    sampleRate: number = 48000
): void {
    const N = data.length;
    const centerSample = Math.round((offsetMs / 1000) * sampleRate);
    const halfWindowSamples = Math.round(((widthMs / 2) / 1000) * sampleRate);

    const start = Math.max(0, centerSample - halfWindowSamples);
    const end = Math.min(N - 1, centerSample + halfWindowSamples);

    // Fade in/out de 10% de la ventana para transiciones suaves y evitar clicks espectrales (Tukey windowing)
    const fadeSamples = Math.round(halfWindowSamples * 0.2);

    for (let i = 0; i < N; i++) {
        if (i < start || i > end) {
            data[i] = 0;
        } else {
            // Aplicar rampas Tukey suaves
            if (i < start + fadeSamples) {
                const norm = (i - start) / fadeSamples;
                const weight = 0.5 * (1 - Math.cos(norm * Math.PI));
                data[i] *= weight;
            } else if (i > end - fadeSamples) {
                const norm = (end - i) / fadeSamples;
                const weight = 0.5 * (1 - Math.cos(norm * Math.PI));
                data[i] *= weight;
            }
        }
    }
}
