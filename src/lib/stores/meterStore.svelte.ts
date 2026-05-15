/**
 * Meter Store: Estado reactivo para los niveles de entrada y salida (VU Meters).
 */

class MeterStore {
    inLevels = $state([ -60, -60 ]); // dBFS por canal
    outLevels = $state([ -60, -60 ]);

    updateIn(levels: number[]) {
        this.inLevels = levels;
    }

    updateOut(levels: number[]) {
        this.outLevels = levels;
    }
}

export const meterStore = new MeterStore();
