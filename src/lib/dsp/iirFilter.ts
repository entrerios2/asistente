/**
 * IIR Biquad Filter — Direct Form II Transposed
 * For pre-FFT input filtering in the DSP worker.
 * Coefficients match OSM's notch.cpp, bandpass.cpp, lowpassfilter.cpp.
 */

export class BiquadIIR {
    private b0: number;
    private b1: number;
    private b2: number;
    private a1: number;
    private a2: number;
    private z1 = 0;
    private z2 = 0;

    constructor(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number) {
        // Normalizar por a0
        this.b0 = b0 / a0;
        this.b1 = b1 / a0;
        this.b2 = b2 / a0;
        this.a1 = a1 / a0;
        this.a2 = a2 / a0;
    }

    /** Procesa un buffer in-place */
    process(buffer: Float32Array): void {
        for (let i = 0; i < buffer.length; i++) {
            const x = buffer[i];
            const y = this.b0 * x + this.z1;
            this.z1 = this.b1 * x - this.a1 * y + this.z2;
            this.z2 = this.b2 * x - this.a2 * y;
            buffer[i] = y;
        }
    }

    reset(): void {
        this.z1 = 0;
        this.z2 = 0;
    }
}

/**
 * Notch filter (como OSM notch.cpp)
 * Rechaza una frecuencia específica.
 */
export function createNotch(frequency: number, q: number, sampleRate: number): BiquadIIR {
    const w0 = 2 * Math.PI * frequency / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);

    const b0 = 1;
    const b1 = -2 * Math.cos(w0);
    const b2 = 1;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w0);
    const a2 = 1 - alpha;

    return new BiquadIIR(b0, b1, b2, a0, a1, a2);
}

/**
 * Bandpass filter (como OSM bandpass.cpp)
 * Pasa una banda centrada en frequency.
 */
export function createBandpass(frequency: number, q: number, sampleRate: number): BiquadIIR {
    const w0 = 2 * Math.PI * frequency / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);

    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w0);
    const a2 = 1 - alpha;

    return new BiquadIIR(b0, b1, b2, a0, a1, a2);
}

/**
 * Lowpass filter (como OSM lowpassfilter.cpp)
 * Pasa frecuencias por debajo de frequency.
 */
export function createLowpass(frequency: number, q: number, sampleRate: number): BiquadIIR {
    const w0 = 2 * Math.PI * frequency / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cosW0 = Math.cos(w0);

    const b0 = (1 - cosW0) / 2;
    const b1 = 1 - cosW0;
    const b2 = (1 - cosW0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha;

    return new BiquadIIR(b0, b1, b2, a0, a1, a2);
}

/** Presets de OSM */
export type InputFilterType = 'None' | 'Notch1k' | 'BP100' | 'LP200';

export function createInputFilter(type: InputFilterType, sampleRate: number): BiquadIIR | null {
    switch (type) {
        case 'Notch1k': return createNotch(1000, 10, sampleRate);
        case 'BP100':   return createBandpass(100, 1, sampleRate);
        case 'LP200':   return createLowpass(200, 0.7071, sampleRate);  // Q=1/√2 para Butterworth
        default:        return null;
    }
}
