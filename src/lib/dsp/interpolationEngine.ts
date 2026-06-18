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

    public prevMagnitude: Float32Array;
    public prevPhase: Float32Array;
    public prevCoherence: Float32Array;
    public prevGroupDelay: Float32Array;

    constructor() {
        this.interpMagnitude = new Float32Array(this.BINS);
        this.interpPhase = new Float32Array(this.BINS);
        this.interpCoherence = new Float32Array(this.BINS);
        this.interpGroupDelay = new Float32Array(this.BINS);
        this.interpImpulse = new Float32Array(this.FFT_SIZE);
        this.interpStep = new Float32Array(this.FFT_SIZE);

        this.prevMagnitude = new Float32Array(this.BINS);
        this.prevPhase = new Float32Array(this.BINS);
        this.prevCoherence = new Float32Array(this.BINS);
        this.prevGroupDelay = new Float32Array(this.BINS);

        this.reset();
    }

    public reset() {
        for (let i = 0; i < this.BINS; i++) {
            this.interpMagnitude[i] = -50;
            this.interpPhase[i] = 0;
            this.interpCoherence[i] = 0.98;
            this.interpGroupDelay[i] = 0;

            this.prevMagnitude[i] = -50;
            this.prevPhase[i] = 0;
            this.prevCoherence[i] = 0.98;
            this.prevGroupDelay[i] = 0;
        }
        for (let i = 0; i < this.FFT_SIZE; i++) {
            this.interpImpulse[i] = 0;
            this.interpStep[i] = 0;
        }
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
        const timeElapsed = now - mathOrchestrator.lastMathTime;
        // If no new data for >2 intervals, freeze display (don't decay to stale data)
        if (!snap && timeElapsed > throttleMs * 2) return;
        const t = snap ? 1.0 : Math.max(0, Math.min(1.0, timeElapsed / throttleMs));

        for (let i = 0; i < this.BINS; i++) {
            this.interpMagnitude[i] = this.prevMagnitude[i] * (1 - t) + mathOrchestrator.outputMagnitude[i] * t;
            this.interpPhase[i] = this.prevPhase[i] * (1 - t) + mathOrchestrator.outputPhase[i] * t;
            this.interpCoherence[i] = this.prevCoherence[i] * (1 - t) + mathOrchestrator.outputCoherence[i] * t;
            this.interpGroupDelay[i] = this.prevGroupDelay[i] * (1 - t) + mathOrchestrator.outputGroupDelay[i] * t;
        }


        const factor = snap ? 1.0 : this.SMOOTHING_FACTOR;
        for (let i = 0; i < this.FFT_SIZE; i++) {
            this.interpImpulse[i] +=
                (mathOrchestrator.outputImpulse[i] - this.interpImpulse[i]) * factor;
            this.interpStep[i] +=
                (mathOrchestrator.outputStep[i] - this.interpStep[i]) * factor;
        }
    }

    public updateHistory() {
        this.prevMagnitude.set(this.interpMagnitude);
        this.prevPhase.set(this.interpPhase);
        this.prevCoherence.set(this.interpCoherence);
        this.prevGroupDelay.set(this.interpGroupDelay);
    }
}
