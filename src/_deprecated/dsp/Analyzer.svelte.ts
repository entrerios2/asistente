import { fft, magnitude, applyWindow } from './fft';

/**
 * Motor de análisis de audio en tiempo real.
 * Gestiona buffers circulares y procesamiento espectral.
 */
export class Analyzer {
    private fftSize: number;
    private buffer: Float32Array;
    private writePos: number = 0;
    
    // Estado reactivo de Svelte 5 para el espectro final
    public spectrum = $state(new Float32Array(0));
    
    constructor(fftSize: number = 2048) {
        this.fftSize = fftSize;
        this.buffer = new Float32Array(fftSize);
        this.spectrum = new Float32Array(fftSize / 2);
    }

    /**
     * Procesa un bloque de audio entrante.
     * Si el buffer se llena, dispara el cálculo de FFT.
     */
    public processChunk(data: Float32Array): void {
        for (let i = 0; i < data.length; i++) {
            this.buffer[this.writePos] = data[i];
            this.writePos++;

            if (this.writePos >= this.fftSize) {
                this.computeFFT();
                this.writePos = 0;
            }
        }
    }

    /**
     * Realiza el análisis espectral y normaliza a dBFS.
     */
    private computeFFT(): void {
        // Clonamos para no destruir el buffer original con la ventana
        const analysisBuffer = new Float32Array(this.buffer);
        
        // 1. Ventaneo (Hanning para análisis general)
        applyWindow(analysisBuffer, 'hanning');

        // 2. Transformada
        const { real, imag } = fft(analysisBuffer);

        // 3. Magnitud
        const mag = magnitude(real, imag);

        // 4. Normalización a dBFS y guardado en estado reactivo
        // Solo tomamos la primera mitad (Nyquist)
        const half = this.fftSize / 2;
        const dbSpectrum = new Float32Array(half);

        for (let i = 0; i < half; i++) {
            // §2.2.1: rta[k] = 20 * log10(mag / (N/2) + 1e-8)
            dbSpectrum[i] = 20 * Math.log10(mag[i] / half + 1e-8);
        }

        this.spectrum = dbSpectrum;
    }
}
