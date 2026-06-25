/**
 * Metric path renderers: Magnitude, Spectrum, Phase, Time domain (Impulse/Step),
 * Simulated Magnitude, Nyquist, Crest Factor, Phase Delay.
 * Extracted from canvasRenderers.ts for maintainability.
 */
import {
    valToX,
    valToY,
    timeMin,
    timeMax,
    freqMin,
    freqMax,
    type InteractionState
} from '../canvasInteraction';
import { type MetricConfig } from '../quadrantState';

export function drawMetricPath(
    ctx: CanvasRenderingContext2D,
    dataArray: Float32Array,
    width: number,
    height: number,
    color: string,
    lw: number,
    lineDash: number[],
    metricType: string,
    _frequencyLUT: Int32Array,
    _interpCoherence: Float32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    getPPOSmoothedValue: (binIndex: number, dataArray: Float32Array, ppo: number) => number,
    sampleRate: number = 48000
) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(lineDash || []);
    
    const cfg = metricConfigs[metricType];

    // Construir array de puntos (un punto por bin FFT visible)
    const points: {x: number, y: number}[] = [];
    const binWidth = (sampleRate / 2) / dataArray.length;

    for (let bin = 0; bin < dataArray.length; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        let val = (cfg && cfg.smoothingPPO)
            ? getPPOSmoothedValue(bin, dataArray, cfg.smoothingPPO ?? 48)
            : dataArray[bin];

        // Coherence transformations
        if (metricType === "Coherence") {
            const cohCfg = metricConfigs["Coherence"] || { cohType: "normal" };
            if (cohCfg.cohType === "squared") {
                val = val * val;
            } else if (cohCfg.cohType === "SNR") {
                val = 10 * Math.log10(val / (1 - val + 1e-6));
            }
        }

        // Mode Y transformations for Magnitude/Spectrum
        if (cfg && (metricType === "Magnitude" || metricType === "Spectrum")) {
            if (cfg.modeY === "Linear") {
                val = Math.pow(10, val / 20);
            } else if (cfg.modeY === "Impedance") {
                val = Math.pow(10, val / 20) * (cfg.sensorResistance || 10);
            }
        }

        const y = valToY(val, height, metricType, metricConfigs, state) + (cfg?.yShift || 0);
        points.push({ x, y });
    }

    // Single Path2D with quadratic spline — coherence masking handled externally
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }

    ctx.setLineDash([]);

    // Coherence horizontal threshold line
    if (metricType === "Coherence") {
        const cohCfg = metricConfigs["Coherence"];
        if (cohCfg && cohCfg.showThresholdLine) {
            const thY = valToY(cohCfg.thresholdValue ?? 0.5, height, "Coherence", metricConfigs, state);
            ctx.strokeStyle = cohCfg.thresholdColor || "#eab308";
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(0, thY);
            ctx.lineTo(width, thY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

export function drawSpectrumPath(
    ctx: CanvasRenderingContext2D,
    liveData: Float32Array | null,
    width: number,
    height: number,
    color: string,
    lw: number,
    lineDash: number[],
    _frequencyLUT: Int32Array,
    _interpCoherence: Float32Array,
    interpMagnitude: Float32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    getPPOSmoothedValue: (binIndex: number, dataArray: Float32Array, ppo: number) => number,
    _bins: number,
    sampleRate: number = 48000
) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(lineDash || []);
    
    const cfg = metricConfigs["Spectrum"] || { modeY: "dB", smoothingPPO: 48 };

    const hasLive = liveData && liveData.length > 0;
    const dataArray = hasLive ? liveData : interpMagnitude;
    const offset = hasLive ? 0 : 68;

    // Construir array de puntos
    const points: {x: number, y: number}[] = [];
    const binWidth = (sampleRate / 2) / dataArray.length;

    for (let bin = 0; bin < dataArray.length; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        // Smooth using PPO
        let val = getPPOSmoothedValue(bin, hasLive ? dataArray : interpMagnitude, cfg.smoothingPPO ?? 48) + (hasLive ? 0 : offset);

        // Mode Y transformations
        if (cfg.modeY === "Linear") {
            val = Math.pow(10, val / 20);
        } else if (cfg.modeY === "Impedance") {
            val = Math.pow(10, val / 20) * (cfg.sensorResistance || 10);
        }

        const y = valToY(val, height, "Spectrum", metricConfigs, state) + (cfg.yShift || 0);
        points.push({ x, y });
    }

    // Single Path2D with quadratic spline — coherence masking handled externally
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }

    ctx.setLineDash([]);
}

export function drawTimeDomainPath(
    ctx: CanvasRenderingContext2D,
    dataArray: Float32Array,
    width: number,
    height: number,
    color: string,
    lw: number,
    lineDash: number[],
    metricType: string,
    state: InteractionState,
    getImpulseValueInterpolated: (timeMs: number, impulseArray: Float32Array) => number,
    hasTimeDomainActive: boolean,
    metricConfigs?: Record<string, MetricConfig>
) {
    let data = dataArray;
    // ETC mode: Energy Time Curve (dB display of impulse)
    if (metricType === "Impulse" && metricConfigs?.["Impulse"]?.modeY === 'ETC') {
        const etcData = new Float32Array(data.length);
        let peakVal = 0;
        for (let i = 0; i < data.length; i++) {
            const absVal = Math.abs(data[i]);
            if (absVal > peakVal) peakVal = absVal;
        }
        const peakRef = 20 * Math.log10(peakVal + 1e-12);
        for (let i = 0; i < data.length; i++) {
            etcData[i] = 20 * Math.log10(Math.abs(data[i]) + 1e-12) - peakRef;
        }
        data = etcData;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(lineDash || []);
    // Build points array
    const points: { x: number, y: number }[] = [];
    const numPoints = 350;
    for (let i = 0; i < numPoints; i++) {
        const t = timeMin + (i / (numPoints - 1)) * (timeMax - timeMin);
        const x = valToX(t, width, hasTimeDomainActive, state);
        const val = getImpulseValueInterpolated(t, data);
        const y = valToY(val, height, metricType, metricConfigs || {}, state);

        if (x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50) {
            points.push({ x, y });
        }
    }

    // Draw with quadratic spline
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }
    ctx.setLineDash([]);
}

export function drawSimulatedMagnitudePath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: { color: string, lineWidth: number, lineDash: number[] },
    _frequencyLUT: Int32Array,
    _interpCoherence: Float32Array,
    interpMagnitude: Float32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    getPPOSmoothedValue: (binIndex: number, dataArray: Float32Array, ppo: number) => number,
    getEQResponseCached: (f: number) => number,
    bins: number,
    sampleRate: number = 48000
) {
    ctx.setLineDash(style.lineDash || []);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    
    const cfg = metricConfigs["Simulated Magnitude"] || { modeY: "dB", smoothingPPO: 48 };

    const sr = sampleRate;
    const binWidth = sr / 2 / bins;

    const points: {x: number, y: number}[] = [];
    let prevX = -100;

    for (let bin = 0; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;
        if (x - prevX < 2 && prevX > -100) continue;
        prevX = x;

        let val = getPPOSmoothedValue(bin, interpMagnitude, cfg.smoothingPPO ?? 48);
        const f = freq || 1e-6;
        val = val + getEQResponseCached(f);

        if (cfg.modeY === "Linear") {
            val = Math.pow(10, val / 20);
        } else if (cfg.modeY === "Impedance") {
            val = Math.pow(10, val / 20) * (cfg.sensorResistance || 10);
        }

        const y = valToY(val, height, "Simulated Magnitude", metricConfigs, state) + (cfg.yShift || 0);
        points.push({ x, y });
    }

    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }

    ctx.setLineDash([]);
}

export function drawNyquistPath(
    ctx: CanvasRenderingContext2D,
    hReal: Float32Array,
    hImag: Float32Array,
    width: number,
    height: number,
    color: string,
    lw: number
) {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRad = Math.min(width, height) / 2 * 0.9;

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    // Build points
    const points: { x: number, y: number }[] = [];
    for (let k = 0; k < hReal.length; k++) {
        const x = centerX + hReal[k] * maxRad;
        const y = centerY - hImag[k] * maxRad;
        points.push({ x, y });
    }

    // Draw with quadratic spline
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }
}

export function drawPhasePath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: { color: string, lineWidth: number, lineDash: number[] },
    _frequencyLUT: Int32Array,
    interpPhase: Float32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    interpCoherence?: Float32Array,
    sampleRate: number = 48000
) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    ctx.setLineDash(style.lineDash || []);
    
    const cfg = metricConfigs["Phase"] || { rotate: 0, unwrapMode: "±180", yShift: 0 };
    const magCfg = metricConfigs["Magnitude"] || { enableCoherence: false, coherenceThreshold: 0.5 };

    // Phase unwrap mode
    const phaseMode = cfg.unwrapMode || '±180';
    let phaseToRender = interpPhase;

    if (phaseMode === 'Unwrap') {
        const unwrapped = new Float32Array(interpPhase.length);
        unwrapped[0] = interpPhase[0];
        let accumulated = interpPhase[0];
        for (let k = 1; k < interpPhase.length; k++) {
            let diff = interpPhase[k] - interpPhase[k - 1];
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            accumulated += diff;
            unwrapped[k] = accumulated;
        }
        phaseToRender = unwrapped;
    }

    // Build points array with decimation (bin-based like drawMetricPath)
    const bins = interpPhase.length;
    const binWidth = (sampleRate / 2) / bins;

    // Collect segments (break on coherence gaps or phase wrapping jumps)
    const segments: { x: number, y: number }[][] = [];
    let currentSeg: { x: number, y: number }[] = [];
    let lastY = 0;

    for (let bin = 0; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        // Coherence masking
        if (interpCoherence && magCfg.enableCoherence && interpCoherence[bin] < (magCfg.coherenceThreshold ?? 0.5)) {
            if (currentSeg.length > 0) {
                segments.push(currentSeg);
                currentSeg = [];
            }
            continue;
        }

        let val = phaseToRender[bin];
        
        // Rotar fase
        val = val + (cfg.rotate || 0);
        
        // Envoltura/Unwrap mode
        if (cfg.unwrapMode === "360") {
            val = ((val % 360) + 360) % 360;
        } else if (cfg.unwrapMode === "Unwrap") {
            // No wrapping
        } else {
            val = (val + 180) % 360;
            if (val < 0) val += 360;
            val -= 180;
        }

        const y = valToY(val, height, "Phase", metricConfigs, state) + (cfg.yShift || 0);

        // Break segment on large Y jumps (phase wrapping)
        if (currentSeg.length > 0 && Math.abs(y - lastY) > height * 0.65) {
            segments.push(currentSeg);
            currentSeg = [];
        }

        currentSeg.push({ x, y });
        lastY = y;
    }
    if (currentSeg.length > 0) segments.push(currentSeg);

    // Draw each segment with quadratic spline
    const path = new Path2D();
    for (const seg of segments) {
        if (seg.length < 2) {
            if (seg.length === 1) {
                path.moveTo(seg[0].x, seg[0].y);
                path.lineTo(seg[0].x + 0.5, seg[0].y);
            }
            continue;
        }
        path.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length - 1; i++) {
            const midX = (seg[i].x + seg[i + 1].x) / 2;
            const midY = (seg[i].y + seg[i + 1].y) / 2;
            path.quadraticCurveTo(seg[i].x, seg[i].y, midX, midY);
        }
        path.lineTo(seg[seg.length - 1].x, seg[seg.length - 1].y);
    }
    ctx.stroke(path);
    ctx.setLineDash([]);
}

export function drawCrestFactor(
    ctx: CanvasRenderingContext2D,
    crestFactorData: Float32Array,
    width: number,
    height: number,
    frequencyLUT: Int32Array,
    state: InteractionState,
    color: string
) {
    if (frequencyLUT.length === 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    // Build points with decimation
    const points: { x: number, y: number }[] = [];

    for (let x = 0; x < width; x++) {
        const binIndex = frequencyLUT[x];
        if (binIndex === undefined) continue;

        const val = crestFactorData[binIndex];
        const y = valToY(val, height, "Crest Factor", {}, state);
        points.push({ x, y });
    }

    // Draw with quadratic spline
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }
}

export function drawPhaseDelay(
    ctx: CanvasRenderingContext2D,
    phaseData: Float32Array,
    width: number,
    height: number,
    color: string,
    lw: number,
    frequencyLUT: Int32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    bins: number,
    sampleRate: number = 48000
) {
    if (frequencyLUT.length === 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const sr = sampleRate;
    const binWidth = sr / 2 / bins;

    // Build points array with decimation
    const points: { x: number, y: number }[] = [];

    for (let bin = 1; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        const phaseRad = (phaseData[bin] * Math.PI) / 180;
        const phaseDelayMs = (-phaseRad / (2 * Math.PI * freq)) * 1000;
        const clampedDelay = Math.max(-5, Math.min(25, phaseDelayMs));

        const y = valToY(clampedDelay, height, 'Phase Delay', metricConfigs, state);
        points.push({ x, y });
    }

    // Draw with quadratic spline
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }
}
