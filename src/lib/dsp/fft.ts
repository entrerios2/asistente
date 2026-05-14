/**
 * Utilidades matemáticas para procesamiento de señales (DSP)
 * Implementación pura Radix-2 DIT (Decimation-In-Time).
 */

/**
 * Aplica una ventana de suavizado in-place para reducir el "spectral leakage".
 */
export function applyWindow(data: Float32Array, type: 'hanning' | 'blackman'): void {
    const N = data.length;
    for (let n = 0; n < N; n++) {
        if (type === 'hanning') {
            data[n] *= 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
        } else if (type === 'blackman') {
            data[n] *= 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (N - 1));
        }
    }
}

/**
 * Calcula la magnitud de un espectro complejo.
 */
export function magnitude(real: Float32Array, imag: Float32Array): Float32Array {
    const N = real.length;
    const mag = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }
    return mag;
}

/**
 * Inversión de bits para el algoritmo Radix-2.
 */
function bitReverse(n: number, bits: number): number {
    let reversed = 0;
    for (let i = 0; i < bits; i++) {
        reversed = (reversed << 1) | (n & 1);
        n >>= 1;
    }
    return reversed;
}

/**
 * Motor central de la FFT Radix-2 (Forward e Inverse).
 */
function coreFFT(real: Float32Array, imag: Float32Array, inverse: boolean): void {
    const N = real.length;
    const bits = Math.log2(N);

    // Reordenamiento Bit-reversal (In-place)
    for (let i = 0; i < N; i++) {
        const j = bitReverse(i, bits);
        if (j > i) {
            [real[i], real[j]] = [real[j], real[i]];
            [imag[i], imag[j]] = [imag[j], imag[i]];
        }
    }

    // Mariposas iterativas
    for (let step = 2; step <= N; step <<= 1) {
        const halfStep = step >> 1;
        const angle = (inverse ? 2 : -2) * Math.PI / step;
        const wStepReal = Math.cos(angle);
        const wStepImag = Math.sin(angle);

        for (let i = 0; i < N; i += step) {
            let wReal = 1;
            let wImag = 0;
            for (let j = 0; j < halfStep; j++) {
                const uReal = real[i + j];
                const uImag = imag[i + j];
                
                const vIdx = i + j + halfStep;
                const tReal = wReal * real[vIdx] - wImag * imag[vIdx];
                const tImag = wReal * imag[vIdx] + wImag * real[vIdx];

                real[i + j] = uReal + tReal;
                imag[i + j] = uImag + tImag;
                real[vIdx] = uReal - tReal;
                imag[vIdx] = uImag - tImag;

                const nextWReal = wReal * wStepReal - wImag * wStepImag;
                wImag = wReal * wStepImag + wImag * wStepReal;
                wReal = nextWReal;
            }
        }
    }

    // Si es inversa, dividir por N
    if (inverse) {
        for (let i = 0; i < N; i++) {
            real[i] /= N;
            imag[i] /= N;
        }
    }
}

/**
 * FFT Directa (Real to Complex).
 */
export function fft(input: Float32Array): { real: Float32Array; imag: Float32Array } {
    const N = input.length;
    const real = new Float32Array(input);
    const imag = new Float32Array(N);
    coreFFT(real, imag, false);
    return { real, imag };
}

/**
 * FFT Inversa (Complex to Real).
 * Retorna solo la parte real ya que se usa para señales físicas IR.
 */
export function ifft(realInput: Float32Array, imagInput: Float32Array): Float32Array {
    const real = new Float32Array(realInput);
    const imag = new Float32Array(imagInput);
    coreFFT(real, imag, true);
    return real;
}
