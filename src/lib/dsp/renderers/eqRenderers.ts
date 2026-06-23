/**
 * EQ overlay renderers: total EQ curve, phase overlay, individual filter curves.
 * Extracted from canvasRenderers.ts for maintainability.
 */
import {
    valToX,
    valToY,
    freqMin,
    freqMax,
    type InteractionState
} from '../canvasInteraction';
import { type MetricConfig } from '../quadrantState';

// ── Shared log-frequency LUT for EQ curve rendering ──
// ~400 points log-spaced 20Hz–20kHz: smooth at low freqs, lightweight vs 8192 bins
const EQ_CURVE_POINTS = 400;
let _eqFreqLUT: Float32Array | null = null;
let _eqFreqLUTSr = 0;
let _eqFreqLUTBins = 0;

function getEqFreqLUT(bins: number, sampleRate: number): Float32Array {
    if (_eqFreqLUT && _eqFreqLUTSr === sampleRate && _eqFreqLUTBins === bins) return _eqFreqLUT;
    const lut = new Float32Array(EQ_CURVE_POINTS);
    const logMin = Math.log10(freqMin);
    const logMax = Math.log10(freqMax);
    for (let i = 0; i < EQ_CURVE_POINTS; i++) {
        lut[i] = Math.pow(10, logMin + (i / (EQ_CURVE_POINTS - 1)) * (logMax - logMin));
    }
    _eqFreqLUT = lut;
    _eqFreqLUTSr = sampleRate;
    _eqFreqLUTBins = bins;
    return lut;
}

export function drawEQOverlayPath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: { color: string, lineWidth: number, lineDash: number[] },
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    getEQResponseCached: (f: number) => number,
    bins: number,
    sampleRate: number = 48000,
    bandCoeffs?: number[][]
) {
    ctx.setLineDash(style.lineDash || []);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;

    const freqs = getEqFreqLUT(bins, sampleRate);
    const TWO_PI = 2 * Math.PI;
    const useAnalytic = bandCoeffs && bandCoeffs.length > 0;

    const xs = new Float64Array(EQ_CURVE_POINTS);
    const ys = new Float64Array(EQ_CURVE_POINTS);
    let count = 0;

    for (let i = 0; i < EQ_CURVE_POINTS; i++) {
        const freq = freqs[i];
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        let val: number;
        if (useAnalytic) {
            const w = TWO_PI * freq / sampleRate;
            const cosW = Math.cos(w);
            const sinW = Math.sin(w);
            const cos2W = 2 * cosW * cosW - 1;
            const sin2W = 2 * sinW * cosW;
            let totalRe = 1.0, totalIm = 0.0;
            for (let b = 0; b < bandCoeffs!.length; b++) {
                const c = bandCoeffs![b];
                const nR = c[0] + c[1] * cosW + c[2] * cos2W;
                const nI = -(c[1] * sinW + c[2] * sin2W);
                const dR = c[3] + c[4] * cosW + c[5] * cos2W;
                const dI = -(c[4] * sinW + c[5] * sin2W);
                const dMagSq = dR * dR + dI * dI + 1e-20;
                const hRe = (nR * dR + nI * dI) / dMagSq;
                const hIm = (nI * dR - nR * dI) / dMagSq;
                const newRe = totalRe * hRe - totalIm * hIm;
                const newIm = totalRe * hIm + totalIm * hRe;
                totalRe = newRe;
                totalIm = newIm;
            }
            val = 10 * Math.log10(totalRe * totalRe + totalIm * totalIm + 1e-20);
        } else {
            val = getEQResponseCached(freq);
        }

        const y = valToY(val, height, "Magnitude", metricConfigs, state);
        xs[count] = x;
        ys[count] = y;
        count++;
    }

    if (count > 1) {
        const path = new Path2D();
        path.moveTo(xs[0], ys[0]);
        for (let i = 1; i < count; i++) {
            const cpx = (xs[i - 1] + xs[i]) / 2;
            path.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i]);
        }
        ctx.stroke(path);

        // Fill under curve to 0dB
        const zeroY = valToY(0, height, "Magnitude", metricConfigs, state);
        const fillPath = new Path2D();
        fillPath.moveTo(xs[0], zeroY);
        for (let i = 0; i < count; i++) fillPath.lineTo(xs[i], ys[i]);
        fillPath.lineTo(xs[count - 1], zeroY);
        fillPath.closePath();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
        ctx.fill(fillPath);
    }

    ctx.setLineDash([]);
}

/**
 * B1+B2: Draw the EQ filter phase response overlay on the Phase Y-axis.
 * Uses the precomputed phase cache from mathOrchestrator.
 */
export function drawEQPhaseOverlayPath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    getEQPhaseCached: (f: number) => number,
    bins: number,
    sampleRate: number = 48000
) {
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;

    const path = new Path2D();
    const freqs = getEqFreqLUT(bins, sampleRate);
    let started = false;

    for (let i = 0; i < EQ_CURVE_POINTS; i++) {
        const freq = freqs[i];
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        const phaseRad = getEQPhaseCached(freq);
        const phaseDeg = phaseRad * (180 / Math.PI);
        const y = valToY(phaseDeg, height, "Phase", metricConfigs, state);

        if (!started) { path.moveTo(x, y); started = true; }
        else { path.lineTo(x, y); }
    }

    if (started) {
        ctx.stroke(path);
    }

    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
}

/**
 * P1: Draw the response curve of a single biquad filter (ghost curve).
 * Shows the individual contribution of the hovered/dragged filter.
 */
export function drawIndividualFilterCurve(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    coeffs: number[],
    color: string,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    bins: number,
    sampleRate: number = 48000
) {
    const [b0, b1, b2, _a0, a1, a2] = coeffs;
    const TWO_PI = 2 * Math.PI;
    const freqs = getEqFreqLUT(bins, sampleRate);

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    const xs = new Float64Array(EQ_CURVE_POINTS);
    const ys = new Float64Array(EQ_CURVE_POINTS);
    let count = 0;

    for (let i = 0; i < EQ_CURVE_POINTS; i++) {
        const freq = freqs[i];
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        const w = TWO_PI * freq / sampleRate;
        const cosW = Math.cos(w);
        const sinW = Math.sin(w);
        const cos2W = 2 * cosW * cosW - 1;
        const sin2W = 2 * sinW * cosW;

        const nR = b0 + b1 * cosW + b2 * cos2W;
        const nI = -(b1 * sinW + b2 * sin2W);
        const dR = 1 + a1 * cosW + a2 * cos2W;
        const dI = -(a1 * sinW + a2 * sin2W);
        const nSq = nR * nR + nI * nI;
        const dSq = dR * dR + dI * dI + 1e-20;
        const val = 10 * Math.log10(nSq / dSq);

        const y = valToY(val, height, "Magnitude", metricConfigs, state);

        xs[count] = x;
        ys[count] = y;
        count++;
    }

    if (count > 1) {
        const path = new Path2D();
        path.moveTo(xs[0], ys[0]);
        for (let i = 1; i < count; i++) {
            const cpx = (xs[i - 1] + xs[i]) / 2;
            path.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i]);
        }
        ctx.stroke(path);

        // Subtle fill
        ctx.globalAlpha = 0.06;
        const zeroY = valToY(0, height, "Magnitude", metricConfigs, state);
        const fillPath = new Path2D();
        fillPath.moveTo(xs[0], zeroY);
        for (let i = 0; i < count; i++) fillPath.lineTo(xs[i], ys[i]);
        fillPath.lineTo(xs[count - 1], zeroY);
        fillPath.closePath();
        ctx.fillStyle = color;
        ctx.fill(fillPath);
    }

    ctx.globalAlpha = 1.0;
}
