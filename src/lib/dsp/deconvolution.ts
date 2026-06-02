import { fft, ifft } from './fft';

/**
 * Algoritmo de deconvolución compleja en el dominio de la frecuencia.
 * IR = IFFT(FFT(salida) / (FFT(entrada) + regularization))
 * 
 * Escribe los resultados en buffers pre-asignados para Zero-Allocation.
 */
export function deconvolve(
    measReal: Float32Array,
    measImag: Float32Array,
    refReal: Float32Array,
    refImag: Float32Array,
    outIR: Float32Array,
    tempReal: Float32Array,
    tempImag: Float32Array,
    tempOutReal: Float32Array,
    tempOutImag: Float32Array
): void {
    const bins = measReal.length;
    const N = bins * 2;
    const regularization = 1e-10;

    // 1. División compleja en frecuencia H(f) = Y(f) / X(f)
    for (let k = 0; k < bins; k++) {
        const den = refReal[k] * refReal[k] + refImag[k] * refImag[k] + regularization;
        
        // H = (meas * conj(ref)) / den
        const hR = (measReal[k] * refReal[k] + measImag[k] * refImag[k]) / den;
        const hI = (measImag[k] * refReal[k] - measReal[k] * refImag[k]) / den;

        tempReal[k] = hR;
        tempImag[k] = hI;
    }

    // 2. Espectro simétrico hermítico para señal real
    for (let k = 1; k < bins; k++) {
        tempReal[N - k] = tempReal[k];
        tempImag[N - k] = -tempImag[k];
    }

    // 3. IFFT para volver al dominio del tiempo (IR)
    ifft(tempReal, tempImag, tempOutReal, tempOutImag);

    // 4. Copiar a salida
    outIR.set(tempOutReal);
}
