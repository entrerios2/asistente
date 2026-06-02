/**
 * Meter Store: Estado reactivo para los niveles de entrada y salida (VU Meters).
 * Optimizado con Svelte 5 $state.raw para evitar proxying profundo en actualizaciones de alto ratio.
 */

class MeterStore {
    inLevels = $state.raw([ -60, -60 ]); // dBFS por canal
    outLevels = $state.raw([ -60, -60 ]);

    updateIn(levels: number[]) {
        this.inLevels = levels;
    }

    updateOut(levels: number[]) {
        this.outLevels = levels;
    }
}

export const meterStore = new MeterStore();
