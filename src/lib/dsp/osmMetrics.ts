import { fft, ifft } from './fft';
import { ComplexMath } from './math';

/**
 * osmMetrics.ts — Motor de procesamiento matemático de grado de ingeniería para
 * el cálculo en tiempo real de las 10 métricas de Open Sound Meter (OSM).
 *
 * Sigue estrictamente la PARTE 2 de docs/documentacion_senales_y_metricas.md.
 * Diseñado con buffers reciclados para minimizar la recolección de basura (GC).
 */

// Estructura de buffers pre-alocados para reciclar memoria
export interface MetricsBuffers {
    fftInputReal: Float32Array;
    fftInputImag: Float32Array;
    fftRefReal: Float32Array;
    fftRefImag: Float32Array;
    hReal: Float32Array;
    hImag: Float32Array;
}

/**
 * Crea una estructura de buffers temporales para evitar re-alocaciones en el bucle principal.
 */
export function createMetricsBuffers(fftSize: number): MetricsBuffers {
    return {
        fftInputReal: new Float32Array(fftSize),
        fftInputImag: new Float32Array(fftSize),
        fftRefReal: new Float32Array(fftSize),
        fftRefImag: new Float32Array(fftSize),
        hReal: new Float32Array(fftSize / 2),
        hImag: new Float32Array(fftSize / 2)
    };
}

/**
 * 2.2.1. Spectrum (Espectro RTA)
 * Muestra la magnitud espectral absoluta en dBFS de los datos temporales de entrada.
 *
 * Ref: §2.2.1 — `rta[k] = 20 * Math.log10(mag / (timeData.length / 2) + 1e-8)`
 */
export function calculateSpectrumRTA(timeData: Float32Array, output: Float32Array): void {
    const N = timeData.length;
    const half = N / 2;
    
    // Obtenemos FFT de la señal temporal
    const { real, imag } = fft(timeData);

    for (let k = 0; k < half; k++) {
        const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
        // Normalización por el tamaño del bloque (N/2) y escala dBFS
        output[k] = 20 * Math.log10(mag / half + 1e-8);
    }
}

/**
 * 2.2.2. Magnitude (Magnitud Relativa / Función de Transferencia H(f))
 * H(f) = Y(f) / X(f) en dB relativo.
 *
 * Ref: §2.2.2 — `magnitude[k] = 20 * Math.log10(Math.sqrt(hReal^2 + hImag^2) + 1e-8)`
 */
export function calculateMagnitude(
    inputReal: Float32Array,
    inputImag: Float32Array,
    refReal: Float32Array,
    refImag: Float32Array,
    output: Float32Array,
    tempHReal?: Float32Array,
    tempHImag?: Float32Array
): void {
    const bins = output.length;
    for (let k = 0; k < bins; k++) {
        const denominator = refReal[k] * refReal[k] + refImag[k] * refImag[k] + 1e-12;
        
        // TF: H(f) = Y(f) * conj(X(f)) / (|X(f)|^2)
        const hReal = (inputReal[k] * refReal[k] + inputImag[k] * refImag[k]) / denominator;
        const hImag = (inputImag[k] * refReal[k] - inputReal[k] * refImag[k]) / denominator;

        if (tempHReal) tempHReal[k] = hReal;
        if (tempHImag) tempHImag[k] = hImag;

        const mag = Math.sqrt(hReal * hReal + hImag * hImag);
        output[k] = 20 * Math.log10(mag + 1e-8);
    }
}

/**
 * 2.2.3. Phase (Fase)
 * Muestra el ángulo de fase en grados de la función de transferencia H(f).
 *
 * Ref: §2.2.3 — `phase[k] = Math.atan2(hImag, hReal) * (180.0 / Math.PI)`
 */
export function calculatePhase(
    inputReal: Float32Array,
    inputImag: Float32Array,
    refReal: Float32Array,
    refImag: Float32Array,
    output: Float32Array
): void {
    const bins = output.length;
    for (let k = 0; k < bins; k++) {
        const denominator = refReal[k] * refReal[k] + refImag[k] * refImag[k] + 1e-12;
        
        const hReal = (inputReal[k] * refReal[k] + inputImag[k] * refImag[k]) / denominator;
        const hImag = (inputImag[k] * refReal[k] - inputReal[k] * refImag[k]) / denominator;

        output[k] = Math.atan2(hImag, hReal) * (180.0 / Math.PI);
    }
}

/**
 * 2.2.4. Impulse (Respuesta al Impulso - IR)
 * Retorno directo al dominio del tiempo por transformada inversa de la función de transferencia H(f).
 *
 * Ref: §2.2.4 — `impulseData[i] = IFFT(fftTransferFunction)[i].real`
 *
 * Para realizar la IFFT Radix-2 de H(f) (que tiene N/2 bins), reconstruimos un espectro complejo simétrico
 * de tamaño N antes de aplicar la IFFT.
 */
export function calculateImpulseResponse(
    hReal: Float32Array,
    hImag: Float32Array,
    output: Float32Array,
    tempReal?: Float32Array,
    tempImag?: Float32Array
): void {
    const bins = hReal.length;
    const N = bins * 2;
    
    // Usamos los buffers temporales si son válidos para evitar GC, de lo contrario fallback a new Float32Array
    const fullReal = (tempReal && tempReal.length >= N) ? tempReal : new Float32Array(N);
    const fullImag = (tempImag && tempImag.length >= N) ? tempImag : new Float32Array(N);

    // Espectro simétrico hermítico para señal real
    for (let k = 0; k < bins; k++) {
        fullReal[k] = hReal[k];
        fullImag[k] = hImag[k];
    }
    // Componentes conjugadas simétricas
    for (let k = 1; k < bins; k++) {
        fullReal[N - k] = hReal[k];
        fullImag[N - k] = -hImag[k];
    }

    // Calculamos IFFT compleja y extraemos la parte real
    const timeData = ifft(fullReal, fullImag);
    
    // Escribimos en el buffer de salida
    for (let i = 0; i < N; i++) {
        output[i] = timeData[i];
    }
}

/**
 * 2.2.5. Step (Respuesta al Escalón)
 * Integral temporal de la respuesta al impulso.
 *
 * Ref: §2.2.5 — Suma acumulada de la respuesta al impulso.
 */
export function calculateStepResponse(impulseResponse: Float32Array, output: Float32Array): void {
    let cumulativeSum = 0.0;
    const N = impulseResponse.length;
    // Escalamiento del paso de integración
    const dt = 1.0 / 48000.0; 
    for (let i = 0; i < N; i++) {
        cumulativeSum += impulseResponse[i] * dt * 1000.0; // Escalado conveniente
        output[i] = cumulativeSum;
    }
}

/**
 * 2.2.6. Coherence (Coherencia)
 * Evalúa la consistencia estadística lineal entre la referencia y la medición.
 *
 * Ref: §2.2.6 — `coherence[k] = |E[Gxy]|^2 / (E[Gxx] * E[Gyy])`
 */
export function calculateCoherence(
    gxx: Float32Array,
    gyy: Float32Array,
    gxyReal: Float32Array,
    gxyImag: Float32Array,
    output: Float32Array
): void {
    const bins = output.length;
    for (let k = 0; k < bins; k++) {
        const crossMagnitudeSq = gxyReal[k] * gxyReal[k] + gxyImag[k] * gxyImag[k];
        const denominator = gxx[k] * gyy[k] + 1e-12;
        let coh = crossMagnitudeSq / denominator;
        if (coh > 1.0) coh = 1.0;
        if (coh < 0.0) coh = 0.0;
        output[k] = coh;
    }
}

/**
 * 2.2.7. Group Delay (Retardo de Grupo)
 * Derivada negativa de la fase respecto a la frecuencia angular.
 *
 * Ref: §2.2.7 — `groupDelay[k] = (-dPhase / dOmega) * 1000.0`
 */
export function calculateGroupDelay(
    phaseRadians: Float32Array,
    freqStep: number,
    output: Float32Array
): void {
    const bins = output.length;
    output[0] = 0.0;
    const dOmega = 2.0 * Math.PI * freqStep;

    for (let k = 1; k < bins; k++) {
        let dPhase = phaseRadians[k] - phaseRadians[k - 1];
        
        // Corrección de fase (unwrap en el cálculo de diferencias)
        while (dPhase > Math.PI) dPhase -= 2.0 * Math.PI;
        while (dPhase < -Math.PI) dPhase += 2.0 * Math.PI;

        output[k] = (-dPhase / dOmega) * 1000.0; // Conversión a milisegundos
    }
}

/**
 * 2.2.9. Level (Nivel de Entrada/Salida)
 * Calcula los niveles absolutos Peak y RMS de un buffer temporal de audio.
 *
 * Ref: §2.2.9 — RMS y Peak en dBFS
 */
export function processSignalLevel(buffer: Float32Array): { peakDb: number; rmsDb: number } {
    let maxVal = 0.0;
    let sumOfSquares = 0.0;
    const N = buffer.length;

    for (let i = 0; i < N; i++) {
        const val = Math.abs(buffer[i]);
        if (val > maxVal) maxVal = val;
        sumOfSquares += buffer[i] * buffer[i];
    }

    const peakDb = 20 * Math.log10(maxVal + 1e-9);
    const rmsDb = 20 * Math.log10(Math.sqrt(sumOfSquares / Math.max(1, N)) + 1e-9);
    return { peakDb, rmsDb };
}

/**
 * 2.2.10. Numeric (Valores Numéricos / SNR)
 * Calcula la relación señal/ruido estimada a partir del RMS de señal y ruido de fondo.
 *
 * Ref: §2.2.10
 */
export function calculateSNR(signalRMS: number, noiseFloorRMS: number): string {
    const snr = 20 * Math.log10(signalRMS / (noiseFloorRMS + 1e-12));
    return snr.toFixed(2) + " dB";
}

/**
 * 2.2.8. Spectrogram (Espectrograma - Cola circular)
 * Cola circular tipo FIFO para retener los espectros históricos RTA y mapear
 * los valores espectrales bidimensionales.
 */
export class SpectrogramQueue {
    private queue: Float32Array[] = [];
    private maxHistory: number;
    private bins: number;

    constructor(bins: number, maxHistory: number = 100) {
        this.bins = bins;
        this.maxHistory = maxHistory;
    }

    public push(spectrum: Float32Array): void {
        const copy = new Float32Array(spectrum);
        this.queue.push(copy);
        if (this.queue.length > this.maxHistory) {
            this.queue.shift();
        }
    }

    public getHistory(): Float32Array[] {
        return this.queue;
    }

    public get length(): number {
        return this.queue.length;
    }

    public clear(): void {
        this.queue = [];
    }
}
