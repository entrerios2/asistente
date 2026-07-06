import { fft, magnitude } from '../../fft';

export class SegmentD {
    static process(buffer: Float32Array, sampleRate: number) {
        const signalFreq = 1000;
        const fftSize = 8192;
        const half = fftSize / 2;

        const result = fft(buffer);
        const mag = magnitude(result.real, result.imag);

        const fundamentalBin = Math.round((signalFreq / sampleRate) * fftSize);
        const harmonicCount = 5;

        let fundamentalEnergy = 0;
        if (fundamentalBin >= 0 && fundamentalBin < half) {
            fundamentalEnergy = mag[fundamentalBin];
        }

        let harmonicEnergy = 0;
        for (let h = 2; h <= harmonicCount; h++) {
            const bin = Math.round((signalFreq * h / sampleRate) * fftSize);
            if (bin >= 0 && bin < half) {
                harmonicEnergy += mag[bin];
            }
        }

        let noiseEnergy = 0;
        for (let i = 0; i < half; i++) {
            if (i !== fundamentalBin) {
                noiseEnergy += mag[i];
            }
        }

        const totalEnergy = fundamentalEnergy + harmonicEnergy + noiseEnergy;
        const thdn = totalEnergy > 0 ? (harmonicEnergy + noiseEnergy) / totalEnergy : 0;
        const thdnPercent = thdn * 100;
        const thdnDb = -20 * Math.log10(Math.max(thdn, 1e-12));

        let status: 'PASS' | 'WARN' | 'FAIL';
        let message: string;
        if (thdnDb > 40) {
            status = 'PASS';
            message = `THD+N: ${thdnDb.toFixed(1)}dB (${thdnPercent.toFixed(2)}%)`;
        } else if (thdnDb > 25) {
            status = 'WARN';
            message = `THD+N: ${thdnDb.toFixed(1)}dB (${thdnPercent.toFixed(2)}%) — revisar nivel de entrada`;
        } else {
            status = 'FAIL';
            message = `THD+N: ${thdnDb.toFixed(1)}dB (${thdnPercent.toFixed(2)}%) — posible saturación o ruido excesivo`;
        }

        const frequencies = new Float32Array(half);
        for (let k = 0; k < half; k++) {
            frequencies[k] = (k * sampleRate) / fftSize;
        }

        const h2 = new Float32Array(half);
        const h3 = new Float32Array(half);
        const h4 = new Float32Array(half);
        const h5 = new Float32Array(half);
        for (let h = 2; h <= 5; h++) {
            const bin = Math.round((signalFreq * h / sampleRate) * fftSize);
            if (bin >= 0 && bin < half) {
                const target = h === 2 ? h2 : h === 3 ? h3 : h === 4 ? h4 : h5;
                const magDb = 20 * Math.log10(Math.max(mag[bin], 1e-12));
                target[bin] = magDb;
            }
        }

        return {
            status,
            values: {
                thdnPercent: +thdnPercent.toFixed(2),
                thdnDb: +thdnDb.toFixed(1),
                fundamentalEnergy: +fundamentalEnergy.toFixed(3),
            },
            message,
            spectral: {
                frequencies,
                harmonics: { h2, h3, h4, h5 },
                sampleRate,
            },
        };
    }
}
