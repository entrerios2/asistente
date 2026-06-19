/**
 * Meter Store: Estado reactivo para los niveles de entrada y salida (VU Meters).
 * 
 * Tres canales semánticos:
 *  - refLevel:  nivel dBFS del canal de referencia (REF)
 *  - measLevel: nivel dBFS del canal de medición (MEAS)
 *  - outLevel:  nivel dBFS de la salida del generador (OUT)
 * 
 * Optimizado con Svelte 5 $state.raw para evitar proxying profundo
 * en actualizaciones de alto ratio.
 */

class MeterStore {
    refLevel  = $state(-60);   // dBFS canal referencia
    measLevel = $state(-60);   // dBFS canal medición
    outLevel  = $state(-60);   // dBFS salida generador

    // Retrocompatibilidad: getters para código existente que lea inLevels/outLevels
    get inLevels(): number[] {
        return [this.refLevel, this.measLevel];
    }

    get outLevels(): number[] {
        return [this.outLevel];
    }

    updateIn(levels: number[]) {
        // levels[0] = ref, levels[1] = meas (o solo levels[0] si es un solo canal)
        this.refLevel  = levels[0] ?? -60;
        this.measLevel = levels[1] ?? levels[0] ?? -60;
    }

    updateOut(levels: number[]) {
        this.outLevel = levels[0] ?? -60;
    }

    /** Reset a estado inactivo */
    reset() {
        this.refLevel  = -60;
        this.measLevel = -60;
        this.outLevel  = -60;
    }
}

export const meterStore = new MeterStore();
