/**
 * Utilidades matemáticas para procesamiento de señales (DSP)
 * Implementación pura Radix-2 DIT (Decimation-In-Time).
 */

/**
 * Aplica una ventana de suavizado in-place para reducir el "spectral leakage".
 * @param data Buffer de audio a modificar.
 * @param type Tipo de ventana ('hanning' o 'blackman').
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
 * FFT Radix-2 DIT Iterativa.
 * @param input Float32Array de tamaño potencia de 2.
 */
export function fft(input: Float32Array): { real: Float32Array; imag: Float32Array } {
    const N = input.length;
    const bits = Math.log2(N);

    if (!Number.isInteger(bits)) {
        throw new Error("FFT: El tamaño del buffer debe ser potencia de 2.");
    }

    const real = new Float32Array(N);
    const imag = new Float32Array(N);

    // Reordenamiento Bit-reversal
    for (let i = 0; i < N; i++) {
        const j = bitReverse(i, bits);
        real[j] = input[i];
    }

    // Mariposas iterativas
    for (let step = 2; step <= N; step <<= 1) {
        const halfStep = step >> 1;
        const angle = -(2 * Math.PI) / step;
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

    return { real, imag };
}
