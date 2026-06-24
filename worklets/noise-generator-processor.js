/**
 * NoiseGeneratorProcessor — AudioWorklet for real-time noise generation.
 * 
 * Generates white, pink, brown, and music-noise in real time, sample by sample,
 * without buffer loops. This eliminates the audible periodicity of pre-rendered buffers.
 * 
 * Messages:
 *   port.postMessage({ type: 'white'|'pink'|'brown'|'music-noise', sampleRate: number })
 *   port.postMessage({ type: 'stop' })
 */
class NoiseGeneratorProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.noiseType = 'pink';
        this.running = true;
        this.sr = 48000;

        // Pink noise state (Voss-McCartney / Paul Kellet)
        this.b0 = 0; this.b1 = 0; this.b2 = 0;
        this.b3 = 0; this.b4 = 0; this.b5 = 0; this.b6 = 0;
        // Pink coefficients (computed once on type change)
        this.c0 = 0.99886; this.c1 = 0.99332; this.c2 = 0.96900;
        this.c3 = 0.86650; this.c4 = 0.55000; this.c5 = 0.7616;

        // Brown noise state
        this.lastOut = 0.0;

        // Music-noise biquad states (HP + LP cascade)
        this.hpX1 = 0; this.hpX2 = 0; this.hpY1 = 0; this.hpY2 = 0;
        this.lpX1 = 0; this.lpX2 = 0; this.lpY1 = 0; this.lpY2 = 0;
        // Music-noise biquad coefficients
        this.hp = null;
        this.lp = null;

        this.port.onmessage = (e) => {
            if (e.data.type === 'stop') {
                this.running = false;
                return;
            }
            this.noiseType = e.data.type || 'pink';
            this.sr = e.data.sampleRate || 48000;
            this._resetState();
        };
    }

    _resetState() {
        this.b0 = 0; this.b1 = 0; this.b2 = 0;
        this.b3 = 0; this.b4 = 0; this.b5 = 0; this.b6 = 0;
        this.lastOut = 0.0;
        this.hpX1 = 0; this.hpX2 = 0; this.hpY1 = 0; this.hpY2 = 0;
        this.lpX1 = 0; this.lpX2 = 0; this.lpY1 = 0; this.lpY2 = 0;

        // Recompute pink coefficients for current sample rate
        const srRatio = 48000 / this.sr;
        this.c0 = Math.pow(0.99886, srRatio);
        this.c1 = Math.pow(0.99332, srRatio);
        this.c2 = Math.pow(0.96900, srRatio);
        this.c3 = Math.pow(0.86650, srRatio);
        this.c4 = Math.pow(0.55000, srRatio);
        this.c5 = Math.pow(0.7616, srRatio);

        // Recompute music-noise biquad coefficients
        if (this.noiseType === 'music-noise') {
            this.hp = this._computeHP(40, this.sr);
            this.lp = this._computeLP(5000, this.sr);
        }
    }

    _computeHP(fc, sr) {
        const omega = 2.0 * Math.PI * fc / sr;
        const cosW = Math.cos(omega);
        const sinW = Math.sin(omega);
        const alpha = sinW / (2.0 * 0.7071);
        const a0 = 1.0 + alpha;
        return {
            b0: ((1.0 + cosW) / 2.0) / a0,
            b1: (-(1.0 + cosW)) / a0,
            b2: ((1.0 + cosW) / 2.0) / a0,
            a1: (-2.0 * cosW) / a0,
            a2: (1.0 - alpha) / a0
        };
    }

    _computeLP(fc, sr) {
        const omega = 2.0 * Math.PI * fc / sr;
        const cosW = Math.cos(omega);
        const sinW = Math.sin(omega);
        const alpha = sinW / (2.0 * 0.7071);
        const a0 = 1.0 + alpha;
        return {
            b0: ((1.0 - cosW) / 2.0) / a0,
            b1: (1.0 - cosW) / a0,
            b2: ((1.0 - cosW) / 2.0) / a0,
            a1: (-2.0 * cosW) / a0,
            a2: (1.0 - alpha) / a0
        };
    }

    _white() {
        return Math.random() * 2.0 - 1.0;
    }

    _pink() {
        const white = this._white();
        this.b0 = this.c0 * this.b0 + white * 0.0555179;
        this.b1 = this.c1 * this.b1 + white * 0.0750759;
        this.b2 = this.c2 * this.b2 + white * 0.1538520;
        this.b3 = this.c3 * this.b3 + white * 0.3104856;
        this.b4 = this.c4 * this.b4 + white * 0.5329522;
        this.b5 = -this.c5 * this.b5 - white * 0.0168980;
        const pink = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
        this.b6 = white * 0.115926;
        return pink * 0.11;
    }

    _brown() {
        const white = this._white();
        this.lastOut = (this.lastOut + 0.02 * white) / 1.02;
        return this.lastOut * 3.5;
    }

    _musicNoise() {
        // Pink noise → HP filter → LP filter
        let sample = this._pink();

        // HP biquad
        if (this.hp) {
            const c = this.hp;
            const y = c.b0 * sample + c.b1 * this.hpX1 + c.b2 * this.hpX2 - c.a1 * this.hpY1 - c.a2 * this.hpY2;
            this.hpX2 = this.hpX1; this.hpX1 = sample;
            this.hpY2 = this.hpY1; this.hpY1 = y;
            sample = y;
        }

        // LP biquad
        if (this.lp) {
            const c = this.lp;
            const y = c.b0 * sample + c.b1 * this.lpX1 + c.b2 * this.lpX2 - c.a1 * this.lpY1 - c.a2 * this.lpY2;
            this.lpX2 = this.lpX1; this.lpX1 = sample;
            this.lpY2 = this.lpY1; this.lpY1 = y;
            sample = y;
        }

        return sample;
    }

    process(_inputs, outputs) {
        if (!this.running) return false;
        const output = outputs[0];
        if (!output || !output[0]) return true;

        const channel = output[0];
        const len = channel.length;

        switch (this.noiseType) {
            case 'white':
                for (let i = 0; i < len; i++) channel[i] = this._white();
                break;
            case 'pink':
                for (let i = 0; i < len; i++) channel[i] = this._pink();
                break;
            case 'brown':
                for (let i = 0; i < len; i++) channel[i] = this._brown();
                break;
            case 'music-noise':
                for (let i = 0; i < len; i++) channel[i] = this._musicNoise();
                break;
            default:
                for (let i = 0; i < len; i++) channel[i] = this._pink();
        }

        // Copy mono to all channels
        for (let ch = 1; ch < output.length; ch++) {
            output[ch].set(channel);
        }

        return true;
    }
}

registerProcessor('noise-generator-processor', NoiseGeneratorProcessor);
