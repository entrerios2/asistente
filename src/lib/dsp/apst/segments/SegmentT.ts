import { fft } from '../../fft';
import { ComplexMath } from '../../math';

/**
 * Segmento T: Alineamiento Temporal (Time Alignment).
 * Calcula el retardo (delay) entre una señal de referencia y una capturada.
 */
export class SegmentT {
    /**
     * @param refBuffer Buffer de referencia (original).
     * @param measBuffer Buffer capturado (micrófono).
     * @param sampleRate Frecuencia de muestreo.
     * @returns Objeto con delayMs e impulseResponse.
     */
    static process(refBuffer: Float32Array, measBuffer: Float32Array, sampleRate: number) {
        const N = refBuffer.length;
        const epsilon = 1e-12;

        // a) Calcular FFT de referencia (X) y medición (Y)
        const X = fft(refBuffer);
        const Y = fft(measBuffer);

        // b) Calcular Función de Transferencia H(f) = Y(f) * conj(X(f)) / (|X(f)|² + epsilon)
        const hReal = new Float32Array(N);
        const hImag = new Float32Array(N);

        for (let i = 0; i < N; i++) {
            const magX2 = X.real[i] * X.real[i] + X.imag[i] * X.imag[i] + epsilon;
            const [numReal, numImag] = ComplexMath.mulConjugate(Y.real[i], Y.imag[i], X.real[i], X.imag[i]);
            hReal[i] = numReal / magX2;
            hImag[i] = numImag / magX2;
        }

        // c) Calcular IFFT(H) para obtener la IR
        // Truco: IFFT(H) = conj(FFT(conj(H))) / N
        // conj(H) = hReal, -hImag
        const hConjImag = hImag.map(v => -v);
        const fftOfConj = fft(hReal, hConjImag);
        
        // IR = conj(fftOfConj) / N. Como el resultado debe ser real (IR física), tomamos la parte real.
        const ir = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            ir[i] = fftOfConj.real[i] / N;
        }

        // d) Buscar el índice del pico máximo absoluto en la primera mitad
        let peakIdx = 0;
        let maxVal = -1;
        for (let i = 0; i < N / 2; i++) {
            const absVal = Math.abs(ir[i]);
            if (absVal > maxVal) {
                maxVal = absVal;
                peakIdx = i;
            }
        }

        // e) Retornar delay en ms y la IR
        const delayMs = (peakIdx / sampleRate) * 1000;

        return {
            delayMs: parseFloat(delayMs.toFixed(3)),
            ir: ir
        };
    }
}
