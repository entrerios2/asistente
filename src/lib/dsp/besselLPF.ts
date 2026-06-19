/**
 * Bessel Low Pass Filter 5th order — direct port from OSM bessellpf.h
 * Copyright (C) 2018 Pavel Smokotnin (GPL-3.0)
 *
 * Pre-calculated coefficients for 3 discrete frequencies.
 * Operates on complex values (real + imag) per bin.
 * 
 * @url http://www-users.cs.york.ac.uk/~fisher/cgi-bin/mkfscript
 */

export type BesselFrequency = 'Slow' | 'Medium' | 'Fast';

const ORDER = 5;

// Coefficients from OSM bessellpf.h (pre-warped for DSP update rate)
const COEFFICIENTS: Record<BesselFrequency, { gain: number; k: number[] }> = {
    Slow: {   // 0.25 Hz
        gain: 1.327313202e+05,
        k: [0.4600089841, -2.6653917847, 6.2006547950, -7.2408808951, 4.2453678122],
    },
    Medium: { // 0.5 Hz
        gain: 5.908173436e+03,
        k: [0.2116396822, -1.3993115731, 3.7525227570, -5.1097576527, 3.5394905611],
    },
    Fast: {   // 1.0 Hz
        gain: 3.508023803e+02,
        k: [0.0448577871, -0.3690099172, 1.2719460080, -2.3219218420, 2.2829085146],
    },
};

/**
 * Single-channel Bessel LPF instance (for one bin).
 * OSM uses a circular buffer of ORDER+1 = 6 elements.
 */
class BesselFilter {
    private gain: number;
    private k: number[];
    private x: number[] = [0, 0, 0, 0, 0, 0]; // input history
    private y: number[] = [0, 0, 0, 0, 0, 0]; // output history
    private p = 3; // circular pointer

    constructor(freq: BesselFrequency) {
        const c = COEFFICIENTS[freq];
        this.gain = c.gain;
        this.k = c.k;
    }

    private ptr(i: number): number {
        let idx = this.p + i;
        if (idx > 5) idx -= 6;
        return idx;
    }

    process(v: number): number {
        if (v !== v) return this.y[this.ptr(5)]; // NaN guard

        this.p = this.ptr(1);

        const p5 = this.ptr(5);
        this.x[p5] = v / this.gain;

        this.y[p5] =
            (this.x[this.ptr(0)] * 1)
            + (this.x[this.ptr(1)] * 5)
            + (this.x[this.ptr(2)] * 10)
            + (this.x[this.ptr(3)] * 10)
            + (this.x[this.ptr(4)] * 5)
            + (this.x[p5] * 1)

            + (this.y[this.ptr(0)] * this.k[0])
            + (this.y[this.ptr(1)] * this.k[1])
            + (this.y[this.ptr(2)] * this.k[2])
            + (this.y[this.ptr(3)] * this.k[3])
            + (this.y[this.ptr(4)] * this.k[4]);

        return this.y[p5];
    }

    reset(): void {
        this.x.fill(0);
        this.y.fill(0);
    }
}

/**
 * Bank of Bessel LPFs for averaging complex H(f) data.
 * One pair of filters (real + imag) per bin.
 */
export class BesselAveraging {
    private filtersReal: BesselFilter[];
    private filtersImag: BesselFilter[];
    private bins: number;
    private currentFreq: BesselFrequency;

    constructor(bins: number, freq: BesselFrequency = 'Medium') {
        this.bins = bins;
        this.currentFreq = freq;
        this.filtersReal = Array.from({ length: bins }, () => new BesselFilter(freq));
        this.filtersImag = Array.from({ length: bins }, () => new BesselFilter(freq));
    }

    setFrequency(freq: BesselFrequency): void {
        if (freq === this.currentFreq) return;
        this.currentFreq = freq;
        // Recreate filters with new coefficients
        this.filtersReal = Array.from({ length: this.bins }, () => new BesselFilter(freq));
        this.filtersImag = Array.from({ length: this.bins }, () => new BesselFilter(freq));
    }

    /**
     * Process one frame of complex H(f) data.
     * Writes smoothed output to outReal/outImag.
     */
    process(
        inReal: Float32Array, inImag: Float32Array,
        outReal: Float32Array, outImag: Float32Array,
    ): void {
        for (let k = 0; k < this.bins; k++) {
            outReal[k] = this.filtersReal[k].process(inReal[k]);
            outImag[k] = this.filtersImag[k].process(inImag[k]);
        }
    }

    reset(): void {
        for (let k = 0; k < this.bins; k++) {
            this.filtersReal[k].reset();
            this.filtersImag[k].reset();
        }
    }
}
