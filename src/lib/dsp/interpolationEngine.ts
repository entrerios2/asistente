export class InterpolationEngine {
    public BINS = 4096;
    public FFT_SIZE = 8192;
    public SMOOTHING_FACTOR = 0.15;

    public interpMagnitude: Float32Array;
    public interpPhase: Float32Array;
    public interpCoherence: Float32Array;
    public interpGroupDelay: Float32Array;
    public interpImpulse: Float32Array;
    public interpStep: Float32Array;
    public interpCrestFactor: Float32Array;
    public interpHReal: Float32Array;
    public interpHImag: Float32Array;
    public interpSpectrum: Float32Array;

    public prevMagnitude: Float32Array;
    public prevPhase: Float32Array;
    public prevCoherence: Float32Array;
    public prevGroupDelay: Float32Array;
    public prevCrestFactor: Float32Array;
    public prevHReal: Float32Array;
    public prevHImag: Float32Array;
    public prevSpectrum: Float32Array;

    // Timestamp de cuando se guardó el snapshot previo (para cálculo de intervalo real)
    public historyTime: number = 0;

    constructor() {
        this.interpMagnitude = new Float32Array(this.BINS);
        this.interpPhase = new Float32Array(this.BINS);
        this.interpCoherence = new Float32Array(this.BINS);
        this.interpGroupDelay = new Float32Array(this.BINS);
        this.interpImpulse = new Float32Array(this.FFT_SIZE);
        this.interpStep = new Float32Array(this.FFT_SIZE);
        this.interpCrestFactor = new Float32Array(this.BINS);
        this.interpHReal = new Float32Array(this.BINS);
        this.interpHImag = new Float32Array(this.BINS);
        this.interpSpectrum = new Float32Array(this.BINS);

        this.prevMagnitude = new Float32Array(this.BINS);
        this.prevPhase = new Float32Array(this.BINS);
        this.prevCoherence = new Float32Array(this.BINS);
        this.prevGroupDelay = new Float32Array(this.BINS);
        this.prevCrestFactor = new Float32Array(this.BINS);
        this.prevHReal = new Float32Array(this.BINS);
        this.prevHImag = new Float32Array(this.BINS);
        this.prevSpectrum = new Float32Array(this.BINS);

        this.reset();
    }

    public reset() {
        for (let i = 0; i < this.BINS; i++) {
            this.interpMagnitude[i] = -50;
            this.interpPhase[i] = 0;
            this.interpCoherence[i] = 0.98;
            this.interpGroupDelay[i] = 0;
            this.interpCrestFactor[i] = 0;
            this.interpHReal[i] = 0;
            this.interpHImag[i] = 0;
            this.interpSpectrum[i] = -120;

            this.prevMagnitude[i] = -50;
            this.prevPhase[i] = 0;
            this.prevCoherence[i] = 0.98;
            this.prevGroupDelay[i] = 0;
            this.prevCrestFactor[i] = 0;
            this.prevHReal[i] = 0;
            this.prevHImag[i] = 0;
            this.prevSpectrum[i] = -120;
        }
        for (let i = 0; i < this.FFT_SIZE; i++) {
            this.interpImpulse[i] = 0;
            this.interpStep[i] = 0;
        }
        this.historyTime = 0;
    }

    public getMetricValueInterpolated(freq: number, dataArray: Float32Array, sampleRate: number = 48000): number {
        const bins = dataArray.length;
        const idx = (freq * bins) / (sampleRate / 2);
        const i0 = Math.max(0, Math.min(bins - 1, Math.floor(idx)));
        const i1 = Math.max(0, Math.min(bins - 1, Math.ceil(idx)));
        const frac = idx - i0;
        return dataArray[i0] * (1 - frac) + dataArray[i1] * frac;
    }

    public getImpulseValueInterpolated(timeMs: number, impulseArray: Float32Array, sampleRate: number = 48000): number {
        const size = impulseArray.length;
        const sampleIdx = (timeMs / 1000) * sampleRate;

        let idx = sampleIdx;
        if (idx < 0) {
            idx += size;
        }
        idx = Math.max(0, Math.min(size - 1, idx));

        const i0 = Math.floor(idx);
        const i1 = (i0 + 1) % size;
        const frac = idx - i0;
        return impulseArray[i0] * (1 - frac) + impulseArray[i1] * frac;
    }

    public interpolateBuffers(snap: boolean, mathOrchestrator: any) {
        const now = performance.now();
        const throttleMs = mathOrchestrator.throttleMs;
        const timeSinceNew = now - mathOrchestrator.lastMathTime;

        // If no new data for >2 intervals, freeze display (don't decay to stale data)
        if (!snap && timeSinceNew > throttleMs * 2) return;

        // Calcular t basado en intervalo real entre resultados
        const realInterval = this.historyTime > 0
            ? Math.max(mathOrchestrator.lastMathTime - this.historyTime, throttleMs)
            : throttleMs;
        const tLinear = snap ? 1.0 : Math.min(1.0, timeSinceNew / realInterval);

        // Ease-out cuadrático: respuesta rápida al inicio, desaceleración suave
        const t = 1 - (1 - tLinear) * (1 - tLinear);

        // Guard: ensure loop bounds don't exceed actual array sizes
        const freqLen = Math.min(
            this.BINS,
            mathOrchestrator.outputMagnitude?.length ?? this.BINS,
            mathOrchestrator.outputPhase?.length ?? this.BINS,
            mathOrchestrator.outputCoherence?.length ?? this.BINS,
            mathOrchestrator.outputGroupDelay?.length ?? this.BINS,
            mathOrchestrator.outputCrestFactor?.length ?? this.BINS,
            mathOrchestrator.outputSpectrum?.length ?? this.BINS,
            mathOrchestrator.hReal?.length ?? this.BINS,
            mathOrchestrator.hImag?.length ?? this.BINS,
        );
        for (let i = 0; i < freqLen; i++) {
            this.interpMagnitude[i] = this.prevMagnitude[i] * (1 - t) + mathOrchestrator.outputMagnitude[i] * t;
            this.interpPhase[i] = this.prevPhase[i] * (1 - t) + mathOrchestrator.outputPhase[i] * t;
            this.interpCoherence[i] = this.prevCoherence[i] * (1 - t) + mathOrchestrator.outputCoherence[i] * t;
            this.interpGroupDelay[i] = this.prevGroupDelay[i] * (1 - t) + mathOrchestrator.outputGroupDelay[i] * t;
            this.interpCrestFactor[i] = this.prevCrestFactor[i] * (1 - t) + (mathOrchestrator.outputCrestFactor?.[i] ?? 0) * t;
            this.interpHReal[i] = this.prevHReal[i] * (1 - t) + (mathOrchestrator.hReal?.[i] ?? 0) * t;
            this.interpHImag[i] = this.prevHImag[i] * (1 - t) + (mathOrchestrator.hImag?.[i] ?? 0) * t;
            this.interpSpectrum[i] = this.prevSpectrum[i] * (1 - t) + (mathOrchestrator.outputSpectrum?.[i] ?? -120) * t;
        }

        const factor = snap ? 1.0 : this.SMOOTHING_FACTOR;
        const timeLen = Math.min(
            this.FFT_SIZE,
            mathOrchestrator.outputImpulse?.length ?? this.FFT_SIZE,
            mathOrchestrator.outputStep?.length ?? this.FFT_SIZE,
        );
        for (let i = 0; i < timeLen; i++) {
            this.interpImpulse[i] +=
                (mathOrchestrator.outputImpulse[i] - this.interpImpulse[i]) * factor;
            this.interpStep[i] +=
                (mathOrchestrator.outputStep[i] - this.interpStep[i]) * factor;
        }
    }

    public updateHistory() {
        this.historyTime = performance.now();
        this.prevMagnitude.set(this.interpMagnitude);
        this.prevPhase.set(this.interpPhase);
        this.prevCoherence.set(this.interpCoherence);
        this.prevGroupDelay.set(this.interpGroupDelay);
        this.prevCrestFactor.set(this.interpCrestFactor);
        this.prevHReal.set(this.interpHReal);
        this.prevHImag.set(this.interpHImag);
        this.prevSpectrum.set(this.interpSpectrum);
    }
}
