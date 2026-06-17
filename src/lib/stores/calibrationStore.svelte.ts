/**
 * Calibration Store: Gestión del estado global de calibración acústica y filtros EQ.
 * Implementado con runas de Svelte 5 ($state, $derived).
 */

import { peakingCoeffs, lowShelfCoeffs, highShelfCoeffs, lowpassCoeffs, highpassCoeffs, notchCoeffs, bandpassCoeffs, biquadResponse } from '../dsp/biquad';

export interface EQFilter {
    frequency: number;
    gain: number; // en dB
    q: number;
    type: 'peaking' | 'highshelf' | 'lowshelf' | 'high_shelf' | 'low_shelf' | 'lowpass' | 'highpass' | 'notch' | 'bandpass';
    enabled: boolean;
}

export interface CalibrationPoint {
    frequency: number;
    gain: number;
}

export class CalibrationStore {
    // Estado base reactivo
    measuredCurve = $state<Float32Array>(new Float32Array(1024));
    targetCurve = $state<Float32Array>(new Float32Array(1024));
    suggestedFilters = $state<EQFilter[]>([]);
    agnosticMode = $state<boolean>(false);
    sampleRate = $state<number>(48000);

    // Curva de calibración de micrófono cargada de archivos (.cal / .txt)
    calibrationPoints = $state<CalibrationPoint[]>([]);
    calibrationFilename = $state<string>('');

    predictedCurve = $derived.by(() => {
        const result = new Float32Array(this.measuredCurve.length);
        const bins = this.measuredCurve.length;

        for (let i = 0; i < bins; i++) {
            const freq = (i * (this.sampleRate / 2)) / bins || 1e-6;
            
            // Sumamos el impacto de todos los biquads activos en cascada
            let totalFilterGain = 0;
            for (const filter of this.suggestedFilters) {
                if (filter.enabled) {
                    totalFilterGain += this.calculateFilterGainAt(filter, freq);
                }
            }

            result[i] = this.measuredCurve[i] + totalFilterGain;
        }
        return result;
    });

    /**
     * Respuesta aislada de los filtros en cascada.
     */
    filterResponseCurve = $derived.by(() => {
        const result = new Float32Array(this.measuredCurve.length);
        const bins = this.measuredCurve.length;

        for (let i = 0; i < bins; i++) {
            const freq = (i * (this.sampleRate / 2)) / bins || 1e-6;
            
            let totalFilterGain = 0;
            for (const filter of this.suggestedFilters) {
                if (filter.enabled) {
                    totalFilterGain += this.calculateFilterGainAt(filter, freq);
                }
            }

            result[i] = totalFilterGain;
        }
        return result;
    });

    /**
     * Helper para obtener los coeficientes de un filtro biquad.
     */
    getCoefficients(filter: EQFilter): number[] | null {
        const fc = filter.frequency;
        const G = filter.gain;
        const Q = filter.q;
        const fs = this.sampleRate;

        switch (filter.type) {
            case 'peaking':                        return peakingCoeffs(fc, G, Q, fs);
            case 'lowshelf':   case 'low_shelf':   return lowShelfCoeffs(fc, G, Q, fs);
            case 'highshelf':  case 'high_shelf':  return highShelfCoeffs(fc, G, Q, fs);
            case 'lowpass':                        return lowpassCoeffs(fc, G, Q, fs);
            case 'highpass':                       return highpassCoeffs(fc, G, Q, fs);
            case 'notch':                          return notchCoeffs(fc, G, Q, fs);
            case 'bandpass':                       return bandpassCoeffs(fc, G, Q, fs);
            default:                               return null;
        }
    }

    /**
     * Calcula la ganancia analítica en dB de un filtro específico para una frecuencia dada utilizando biquads RBJ.
     */
    calculateFilterGainAt(filter: EQFilter, f: number): number {
        const coeffs = this.getCoefficients(filter);
        if (!coeffs) return 0;
        const [magDb] = biquadResponse(coeffs, f, this.sampleRate);
        return magDb;
    }

    /**
     * Calcula la fase compleja acumulada de todos los biquads activos.
     */
    getFilterPhaseAt(freq: number): number {
        let totalPhase = 0;
        for (const filter of this.suggestedFilters) {
            if (filter.enabled) {
                const coeffs = this.getCoefficients(filter);
                if (coeffs) {
                    const [_, phaseRad] = biquadResponse(coeffs, freq, this.sampleRate);
                    totalPhase += phaseRad;
                }
            }
        }
        return totalPhase;
    }

    /**
     * Parsea un archivo de calibración (.cal / .txt) con pares Frecuencia \t Ganancia.
     */
    loadCalibrationFile(content: string, filename: string): void {
        const points: CalibrationPoint[] = [];
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.startsWith('#') || cleanLine.startsWith('*') || cleanLine.startsWith(';')) continue;
            
            // Separar por cualquier espacio en blanco o tabulaciones
            const parts = cleanLine.split(/\s+/);
            if (parts.length >= 2) {
                const freq = parseFloat(parts[0].replace(',', '.'));
                const gain = parseFloat(parts[1].replace(',', '.'));
                if (!isNaN(freq) && !isNaN(gain)) {
                    points.push({ frequency: freq, gain });
                }
            }
        }
        points.sort((a, b) => a.frequency - b.frequency);
        this.calibrationPoints = points;
        this.calibrationFilename = filename;
    }

    /**
     * Realiza una interpolación logarítmica para obtener la compensación en dB en caliente.
     */
    getCalibrationGainAt(freq: number): number {
        const pts = this.calibrationPoints;
        if (pts.length === 0) return 0;
        if (freq <= pts[0].frequency) return pts[0].gain;
        if (freq >= pts[pts.length - 1].frequency) return pts[pts.length - 1].gain;

        let low = 0;
        let high = pts.length - 1;
        while (high - low > 1) {
            const mid = (low + high) >> 1;
            if (pts[mid].frequency > freq) {
                high = mid;
            } else {
                low = mid;
            }
        }

        const f0 = pts[low].frequency;
        const g0 = pts[low].gain;
        const f1 = pts[high].frequency;
        const g1 = pts[high].gain;

        const logF = Math.log10(freq);
        const logF0 = Math.log10(f0);
        const logF1 = Math.log10(f1);

        const t = (logF - logF0) / (logF1 - logF0 || 1);
        return g0 * (1 - t) + g1 * t;
    }

    // Acciones para modificar el estado
    setMeasuredCurve(data: Float32Array) {
        this.measuredCurve = data;
    }

    addFilter(filter: EQFilter) {
        this.suggestedFilters.push(filter);
    }

    removeFilter(index: number) {
        this.suggestedFilters.splice(index, 1);
    }

    toggleAgnosticMode() {
        this.agnosticMode = !this.agnosticMode;
    }

    reset() {
        this.suggestedFilters = [];
        this.measuredCurve.fill(0);
        this.calibrationPoints = [];
        this.calibrationFilename = '';
        this.agnosticMode = false;
    }
}

// Instancia única (Singleton) para toda la aplicación
export const calibrationStore = new CalibrationStore();
