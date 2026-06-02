/**
 * Utilidades matemáticas para procesamiento de señales (DSP)
 * Implementación pura Radix-2 DIT (Decimation-In-Time).
 */

let webfftInstance: any = null;

// Intento de carga dinámica de WebFFT para aceleración por hardware si está disponible
if (typeof window !== 'undefined') {
    // @ts-ignore
    const webfftPkg = 'web' + 'fft';
    import(/* @vite-ignore */ webfftPkg)
        .then((module) => {
            if (module && module.default) {
                webfftInstance = new module.default(8192);
            }
        })
        .catch(() => {
            // WebFFT no disponible, se usará Radix-2 local
        });
}

const windowLUTCache: Record<string, Float32Array> = {};

function getWindowLUT(size: number, type: 'hanning' | 'blackman'): Float32Array {
    const key = `${size}_${type}`;
    if (!windowLUTCache[key]) {
        const lut = new Float32Array(size);
        for (let n = 0; n < size; n++) {
            if (type === 'hanning') {
                lut[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (size - 1)));
            } else if (type === 'blackman') {
                lut[n] = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (size - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (size - 1));
            } else {
                lut[n] = 1.0;
            }
        }
        windowLUTCache[key] = lut;
    }
    return windowLUTCache[key];
}

/**
 * Aplica una ventana de suavizado in-place usando LUTs pre-calculadas para evitar Math.cos().
 */
export function applyWindow(data: Float32Array, type: 'hanning' | 'blackman'): void {
    const N = data.length;
    const lut = getWindowLUT(N, type);
    for (let n = 0; n < N; n++) {
        data[n] *= lut[n];
    }
}

/**
 * Calcula la magnitud de un espectro complejo y escribe directamente en el buffer de salida 'outMag' si se proporciona.
 * De lo contrario, crea y retorna un nuevo array de magnitudes para retrocompatibilidad.
 */
export function magnitude(real: Float32Array, imag: Float32Array, outMag?: Float32Array): Float32Array {
    const N = real.length;
    const m = outMag || new Float32Array(N);
    for (let i = 0; i < N; i++) {
        m[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }
    return m;
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
            const tempReal = real[i];
            const tempImag = imag[i];
            real[i] = real[j];
            imag[i] = imag[j];
            real[j] = tempReal;
            imag[j] = tempImag;
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
 * FFT Directa escribiendo directamente en buffers de salida pre-asignados si se proporcionan.
 * De lo contrario, crea y retorna nuevos Float32Arrays para retrocompatibilidad.
 */
export function fft(input: Float32Array, outReal?: Float32Array, outImag?: Float32Array): { real: Float32Array, imag: Float32Array } {
    const N = input.length;
    const r = outReal || new Float32Array(N);
    const i = outImag || new Float32Array(N);
    r.set(input);
    i.fill(0);
    coreFFT(r, i, false);
    return { real: r, imag: i };
}

/**
 * FFT Inversa escribiendo directamente en buffers de salida pre-asignados si se proporcionan.
 * De lo contrario, crea y retorna nuevos Float32Arrays para retrocompatibilidad.
 */
export function ifft(realInput: Float32Array, imagInput: Float32Array, outReal?: Float32Array, outImag?: Float32Array): Float32Array {
    const N = realInput.length;
    const r = outReal || new Float32Array(N);
    const i = outImag || new Float32Array(N);
    r.set(realInput);
    i.set(imagInput);
    coreFFT(r, i, true);
    return r;
}
