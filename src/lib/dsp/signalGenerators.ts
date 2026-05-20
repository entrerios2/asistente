/**
 * signalGenerators.ts — Motor DSP de síntesis de señales acústicas.
 *
 * Implementación fiel del pseudo-código documentado en
 * docs/documentacion_senales_y_metricas.md (PARTE 1, §1.1–§1.9).
 *
 * Todas las funciones rellenan Float32Array pre-alocados para evitar
 * asignaciones de memoria en los bucles internos.
 */

// ────────────────────────────────────────────────────────────────
// 1.1  Ruido Blanco (White Noise)
// ────────────────────────────────────────────────────────────────
/**
 * Genera ruido blanco con distribución uniforme entre -1.0 y 1.0.
 * Densidad espectral de potencia constante en todo el espectro.
 *
 * Ref: §1.1 — `Math.random() * 2.0 - 1.0`
 */
export function generateWhiteNoise(buffer: Float32Array, length: number): void {
    for (let i = 0; i < length; i++) {
        buffer[i] = Math.random() * 2.0 - 1.0;
    }
}

// ────────────────────────────────────────────────────────────────
// 1.2  Ruido Rosa (Pink Noise) — Algoritmo Voss-McCartney 6 polos
// ────────────────────────────────────────────────────────────────
/**
 * Genera ruido rosa con caída de 3 dB/octava.
 * Energía constante por banda de octava.
 *
 * Ref: §1.2 — Coeficientes exactos b0–b6 del pseudo-código.
 */
export function generatePinkNoise(buffer: Float32Array, length: number): void {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2.0 - 1.0;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        buffer[i] = pink * 0.11; // Atenuación de seguridad para evitar recortes
    }
}

// ────────────────────────────────────────────────────────────────
// 1.3  Ruido Marrón (Brown Noise) — Integrador con fuga
// ────────────────────────────────────────────────────────────────
/**
 * Genera ruido marrón (rojo) con caída de 6 dB/octava.
 * Integración de ruido blanco con factor de fuga (leak) para
 * evitar acumulación de componente de continua (DC offset).
 *
 * Ref: §1.3 — `(lastOut + (0.02 * white)) / 1.02`, ganancia `* 3.5`.
 */
export function generateBrownNoise(buffer: Float32Array, length: number): void {
    let lastOut = 0.0;

    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2.0 - 1.0;
        // El factor 1.02 actúa como sumidero (leak) para evitar DC offset
        const brown = (lastOut + (0.02 * white)) / 1.02;
        lastOut = brown;
        buffer[i] = brown * 3.5; // Compensación de ganancia
    }
}

// ────────────────────────────────────────────────────────────────
// 1.4  Music-Noise (Ruido Ponderado EIA-426-B)
// ────────────────────────────────────────────────────────────────

/**
 * Coeficientes biquad precalculados para sampleRate = 48000 Hz.
 * Dos etapas en cascada:
 *   - Etapa 1: High-pass Butterworth 2do orden @ 40 Hz
 *   - Etapa 2: Low-pass Butterworth 2do orden @ 5000 Hz (pendiente suave)
 */
interface BiquadCoeffs {
    b0: number; b1: number; b2: number;
    a1: number; a2: number;
}

function computeHighPassCoeffs(fc: number, sr: number): BiquadCoeffs {
    const omega = 2.0 * Math.PI * fc / sr;
    const cosW = Math.cos(omega);
    const sinW = Math.sin(omega);
    const alpha = sinW / (2.0 * 0.7071); // Q = 0.7071 (Butterworth)
    const a0 = 1.0 + alpha;
    return {
        b0: ((1.0 + cosW) / 2.0) / a0,
        b1: (-(1.0 + cosW)) / a0,
        b2: ((1.0 + cosW) / 2.0) / a0,
        a1: (-2.0 * cosW) / a0,
        a2: (1.0 - alpha) / a0
    };
}

function computeLowPassCoeffs(fc: number, sr: number): BiquadCoeffs {
    const omega = 2.0 * Math.PI * fc / sr;
    const cosW = Math.cos(omega);
    const sinW = Math.sin(omega);
    const alpha = sinW / (2.0 * 0.7071); // Q = 0.7071 (Butterworth)
    const a0 = 1.0 + alpha;
    return {
        b0: ((1.0 - cosW) / 2.0) / a0,
        b1: (1.0 - cosW) / a0,
        b2: ((1.0 - cosW) / 2.0) / a0,
        a1: (-2.0 * cosW) / a0,
        a2: (1.0 - alpha) / a0
    };
}

function applyBiquad(buffer: Float32Array, length: number, c: BiquadCoeffs): void {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < length; i++) {
        const x0 = buffer[i];
        const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
        x2 = x1; x1 = x0;
        y2 = y1; y1 = y0;
        buffer[i] = y0;
    }
}

/**
 * Genera Music-Noise: ruido rosa filtrado con perfil EIA-426-B.
 * Paso alto a 40 Hz + paso bajo con caída suave a partir de 5 kHz.
 *
 * Ref: §1.4 — `applyEIA426BFilter(pinkSample)`
 */
export function generateMusicNoise(buffer: Float32Array, length: number, sampleRate: number = 48000): void {
    // Paso 1: Generar ruido rosa como base
    generatePinkNoise(buffer, length);

    // Paso 2: Aplicar filtro EIA-426-B en cascada
    const hpCoeffs = computeHighPassCoeffs(40, sampleRate);
    const lpCoeffs = computeLowPassCoeffs(5000, sampleRate);

    applyBiquad(buffer, length, hpCoeffs);
    applyBiquad(buffer, length, lpCoeffs);
}

// ────────────────────────────────────────────────────────────────
// 1.5  Seno Continuo (Continuous Sine)
// ────────────────────────────────────────────────────────────────
/**
 * Genera tono sinusoidal puro de frecuencia fija.
 * Acumulador de fase con wrap a 2π.
 *
 * Ref: §1.5 — `phase += (2π * freq) / sampleRate; sin(phase)`
 */
export function generateSineBuffer(
    buffer: Float32Array,
    length: number,
    freq: number,
    sampleRate: number
): void {
    let phase = 0.0;
    const phaseStep = (2.0 * Math.PI * freq) / sampleRate;

    for (let i = 0; i < length; i++) {
        buffer[i] = Math.sin(phase);
        phase += phaseStep;
        if (phase >= 2.0 * Math.PI) phase -= 2.0 * Math.PI;
    }
}

// ────────────────────────────────────────────────────────────────
// 1.6  Sweep Logarítmico (Farina Sweep)
// ────────────────────────────────────────────────────────────────
/**
 * Genera barrido logarítmico (Farina) de f1 a f2 en `duration` segundos.
 * Fase integrada analíticamente para crecimiento exponencial.
 *
 * Ref: §1.6 — `sin(2π·f1·L·(e^(t/L) - 1))`, con `L = duration / ln(f2/f1)`
 */
export function generateLogSweep(
    buffer: Float32Array,
    length: number,
    f1: number,
    f2: number,
    duration: number,
    sampleRate: number
): void {
    const L = duration / Math.log(f2 / f1);

    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        // Fase integrada analíticamente para el crecimiento exponencial
        buffer[i] = Math.sin(2.0 * Math.PI * f1 * L * (Math.exp(t / L) - 1.0));
    }
}

// ────────────────────────────────────────────────────────────────
// 1.7  Burst (Ráfaga de Tono)
// ────────────────────────────────────────────────────────────────
/**
 * Genera ráfaga senoidal de duración acotada seguida de silencio.
 * Permite medir transitorios, tiempo de vuelo y reflexiones.
 *
 * Ref: §1.7 — Seno activo durante `burstDuration`, silencio el resto.
 *
 * @param burstDuration — Duración del burst en segundos (ej. 0.05 = 50ms)
 */
export function generateBurst(
    buffer: Float32Array,
    length: number,
    freq: number,
    burstDuration: number,
    sampleRate: number
): void {
    const burstSamples = Math.round(burstDuration * sampleRate);

    for (let i = 0; i < length; i++) {
        if (i < burstSamples) {
            const t = i / sampleRate;
            buffer[i] = Math.sin(2.0 * Math.PI * freq * t);
        } else {
            buffer[i] = 0.0; // Estado de silencio
        }
    }
}

// ────────────────────────────────────────────────────────────────
// 1.8  SinBurst (Ráfaga con Ventana de Hann)
// ────────────────────────────────────────────────────────────────
/**
 * Genera ráfaga senoidal multiplicada por ventana de Hann.
 * Suaviza flancos de ataque/liberación para evitar clicks de alta frecuencia.
 *
 * Ref: §1.8 — `sin(2π·f·t) × 0.5·(1 - cos(2π·relativeT))`
 *
 * @param burstDuration — Duración del burst en segundos (ej. 0.05 = 50ms)
 */
export function generateSinBurst(
    buffer: Float32Array,
    length: number,
    freq: number,
    burstDuration: number,
    sampleRate: number
): void {
    const burstSamples = Math.round(burstDuration * sampleRate);

    for (let i = 0; i < length; i++) {
        if (i < burstSamples) {
            const t = i / sampleRate;
            const relativeT = i / burstSamples;
            // Ventana de Hann para suavizar flancos
            const window = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * relativeT));
            buffer[i] = Math.sin(2.0 * Math.PI * freq * t) * window;
        } else {
            buffer[i] = 0.0;
        }
    }
}

// ────────────────────────────────────────────────────────────────
// 1.9  MLS+ (Secuencia de Longitud Máxima — LFSR Galois)
// ────────────────────────────────────────────────────────────────

/**
 * Tabla de polinomios primitivos (taps) para LFSR Galois de orden N.
 * Cada valor es la máscara XOR para el registro de desplazamiento.
 * Solo se necesitan órdenes 10–18 para audio práctico.
 */
const MLS_TAPS: Record<number, number> = {
    10: 0x240,    // x^10 + x^7
    11: 0x500,    // x^11 + x^9
    12: 0xE08,    // x^12 + x^11 + x^10 + x^4
    13: 0x1C80,   // x^13 + x^12 + x^11 + x^8
    14: 0x3802,   // x^14 + x^13 + x^12 + x^2
    15: 0x6000,   // x^15 + x^14
    16: 0xD008,   // x^16 + x^15 + x^13 + x^4
    17: 0x12000,  // x^17 + x^14
    18: 0x20400,  // x^18 + x^11
};

/**
 * Genera Secuencia de Longitud Máxima (MLS) mediante LFSR Galois.
 * La autocorrelación periódica de la secuencia es un impulso de Dirac.
 *
 * Ref: §1.9 — `register >>>= 1; if (bit) register ^= taps;`
 *
 * @param bits — Orden del LFSR (10–18). Default: 16 (65535 muestras ≈ 1.37s @ 48kHz)
 * @returns Float32Array de longitud 2^N - 1 con valores +1.0 / -1.0
 */
export function generateMLS(bits: number = 16): Float32Array {
    if (bits < 10 || bits > 18) {
        throw new Error(`MLS: orden ${bits} fuera de rango. Use 10–18.`);
    }

    const taps = MLS_TAPS[bits];
    const size = (1 << bits) - 1; // 2^N - 1 muestras
    const buffer = new Float32Array(size);
    let register = 1; // Semilla de inicio

    for (let i = 0; i < size; i++) {
        const bit = register & 1;
        buffer[i] = bit ? 1.0 : -1.0;
        register = register >>> 1;
        if (bit) register = register ^ taps;
    }

    return buffer;
}
