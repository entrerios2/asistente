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

// Pre-allocated coordinate buffers to avoid GC pressure (max 8192 bins)
const MAX_POINTS = 8192;
let _xs = new Float64Array(MAX_POINTS);
let _ys = new Float64Array(MAX_POINTS);

function ensureCapacity(size: number) {
    if (_xs.length < size) {
        const newSize = Math.max(_xs.length * 2, size);
        _xs = new Float64Array(newSize);
        _ys = new Float64Array(newSize);
    }
}

// Pre-allocated ETC buffer (reused across frames)
let _etcBuffer: Float32Array | null = null;
let _etcBufferSize = 0;

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
    ensureCapacity(dataArray.length);
    let pointCount = 0;
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
        _xs[pointCount] = x;
        _ys[pointCount] = y;
        pointCount++;
    }

    // Single Path2D with quadratic spline — coherence masking handled externally
    if (pointCount > 1) {
        const path = new Path2D();
        path.moveTo(_xs[0], _ys[0]);
        for (let i = 1; i < pointCount - 1; i++) {
            const midX = (_xs[i] + _xs[i + 1]) / 2;
            const midY = (_ys[i] + _ys[i + 1]) / 2;
            path.quadraticCurveTo(_xs[i], _ys[i], midX, midY);
        }
        path.lineTo(_xs[pointCount - 1], _ys[pointCount - 1]);
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
    ensureCapacity(dataArray.length);
    let pointCount = 0;
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
        _xs[pointCount] = x;
        _ys[pointCount] = y;
        pointCount++;
    }

    // Single Path2D with quadratic spline — coherence masking handled externally
    if (pointCount > 1) {
        const path = new Path2D();
        path.moveTo(_xs[0], _ys[0]);
        for (let i = 1; i < pointCount - 1; i++) {
            const midX = (_xs[i] + _xs[i + 1]) / 2;
            const midY = (_ys[i] + _ys[i + 1]) / 2;
            path.quadraticCurveTo(_xs[i], _ys[i], midX, midY);
        }
        path.lineTo(_xs[pointCount - 1], _ys[pointCount - 1]);
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
        if (!_etcBuffer || _etcBufferSize !== data.length) {
            _etcBuffer = new Float32Array(data.length);
            _etcBufferSize = data.length;
        }
        const etcData = _etcBuffer;
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
    const numPoints = 350;
    ensureCapacity(numPoints);
    let pointCount = 0;
    for (let i = 0; i < numPoints; i++) {
        const t = timeMin + (i / (numPoints - 1)) * (timeMax - timeMin);
        const x = valToX(t, width, hasTimeDomainActive, state);
        const val = getImpulseValueInterpolated(t, data);
        const y = valToY(val, height, metricType, metricConfigs || {}, state);

        if (x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50) {
            _xs[pointCount] = x;
            _ys[pointCount] = y;
            pointCount++;
        }
    }

    // Draw with quadratic spline
    if (pointCount > 1) {
        const path = new Path2D();
        path.moveTo(_xs[0], _ys[0]);
        for (let i = 1; i < pointCount - 1; i++) {
            const midX = (_xs[i] + _xs[i + 1]) / 2;
            const midY = (_ys[i] + _ys[i + 1]) / 2;
            path.quadraticCurveTo(_xs[i], _ys[i], midX, midY);
        }
        path.lineTo(_xs[pointCount - 1], _ys[pointCount - 1]);
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

    ensureCapacity(bins);
    let pointCount = 0;
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
        _xs[pointCount] = x;
        _ys[pointCount] = y;
        pointCount++;
    }

    if (pointCount > 1) {
        const path = new Path2D();
        path.moveTo(_xs[0], _ys[0]);
        for (let i = 1; i < pointCount - 1; i++) {
            const midX = (_xs[i] + _xs[i + 1]) / 2;
            const midY = (_ys[i] + _ys[i + 1]) / 2;
            path.quadraticCurveTo(_xs[i], _ys[i], midX, midY);
        }
        path.lineTo(_xs[pointCount - 1], _ys[pointCount - 1]);
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
    ensureCapacity(hReal.length);
    let pointCount = 0;
    for (let k = 0; k < hReal.length; k++) {
        const x = centerX + hReal[k] * maxRad;
        const y = centerY - hImag[k] * maxRad;
        _xs[pointCount] = x;
        _ys[pointCount] = y;
        pointCount++;
    }

    // Draw with quadratic spline
    if (pointCount > 1) {
        const path = new Path2D();
        path.moveTo(_xs[0], _ys[0]);
        for (let i = 1; i < pointCount - 1; i++) {
            const midX = (_xs[i] + _xs[i + 1]) / 2;
            const midY = (_ys[i] + _ys[i + 1]) / 2;
            path.quadraticCurveTo(_xs[i], _ys[i], midX, midY);
        }
        path.lineTo(_xs[pointCount - 1], _ys[pointCount - 1]);
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
    const magCfg = metricConfigs["Magnitude"] || { enableCoherence: false };

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
    ensureCapacity(bins);
    const binWidth = (sampleRate / 2) / bins;

    // We will store all point coordinates in _xs and _ys consecutively.
    // To identify segments, we keep track of where each segment starts and its length.
    let pointCount = 0;
    const segStarts: number[] = [];
    const segLengths: number[] = [];
    let currentSegStart = 0;
    let currentSegLen = 0;
    let lastY = 0;

    for (let bin = 0; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        // Coherence masking
        if (interpCoherence && magCfg.enableCoherence && interpCoherence[bin] < (metricConfigs["Coherence"]?.thresholdValue ?? 0.2)) {
            if (currentSegLen > 0) {
                segStarts.push(currentSegStart);
                segLengths.push(currentSegLen);
                currentSegLen = 0;
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
        if (currentSegLen > 0 && Math.abs(y - lastY) > height * 0.65) {
            segStarts.push(currentSegStart);
            segLengths.push(currentSegLen);
            currentSegStart = pointCount;
            currentSegLen = 0;
        }

        _xs[pointCount] = x;
        _ys[pointCount] = y;
        if (currentSegLen === 0) {
            currentSegStart = pointCount;
        }
        pointCount++;
        currentSegLen++;
        lastY = y;
    }
    if (currentSegLen > 0) {
        segStarts.push(currentSegStart);
        segLengths.push(currentSegLen);
    }

    // Draw each segment with quadratic spline
    const path = new Path2D();
    for (let s = 0; s < segStarts.length; s++) {
        const start = segStarts[s];
        const len = segLengths[s];
        if (len < 2) {
            if (len === 1) {
                path.moveTo(_xs[start], _ys[start]);
                path.lineTo(_xs[start] + 0.5, _ys[start]);
            }
            continue;
        }
        path.moveTo(_xs[start], _ys[start]);
        for (let i = 1; i < len - 1; i++) {
            const idx = start + i;
            const midX = (_xs[idx] + _xs[idx + 1]) / 2;
            const midY = (_ys[idx] + _ys[idx + 1]) / 2;
            path.quadraticCurveTo(_xs[idx], _ys[idx], midX, midY);
        }
        const endIdx = start + len - 1;
        path.lineTo(_xs[endIdx], _ys[endIdx]);
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
    ensureCapacity(width);
    let pointCount = 0;

    for (let x = 0; x < width; x++) {
        const binIndex = frequencyLUT[x];
        if (binIndex === undefined) continue;

        const val = crestFactorData[binIndex];
        const y = valToY(val, height, "Crest Factor", {}, state);
        _xs[pointCount] = x;
        _ys[pointCount] = y;
        pointCount++;
    }

    // Draw with quadratic spline
    if (pointCount > 1) {
        const path = new Path2D();
        path.moveTo(_xs[0], _ys[0]);
        for (let i = 1; i < pointCount - 1; i++) {
            const midX = (_xs[i] + _xs[i + 1]) / 2;
            const midY = (_ys[i] + _ys[i + 1]) / 2;
            path.quadraticCurveTo(_xs[i], _ys[i], midX, midY);
        }
        path.lineTo(_xs[pointCount - 1], _ys[pointCount - 1]);
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
    ensureCapacity(bins);
    let pointCount = 0;

    for (let bin = 1; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        const phaseRad = (phaseData[bin] * Math.PI) / 180;
        const phaseDelayMs = (-phaseRad / (2 * Math.PI * freq)) * 1000;
        const clampedDelay = Math.max(-5, Math.min(25, phaseDelayMs));

        const y = valToY(clampedDelay, height, 'Phase Delay', metricConfigs, state);
        _xs[pointCount] = x;
        _ys[pointCount] = y;
        pointCount++;
    }

    // Draw with quadratic spline
    if (pointCount > 1) {
        const path = new Path2D();
        path.moveTo(_xs[0], _ys[0]);
        for (let i = 1; i < pointCount - 1; i++) {
            const midX = (_xs[i] + _xs[i + 1]) / 2;
            const midY = (_ys[i] + _ys[i + 1]) / 2;
            path.quadraticCurveTo(_xs[i], _ys[i], midX, midY);
        }
        path.lineTo(_xs[pointCount - 1], _ys[pointCount - 1]);
        ctx.stroke(path);
    }
}
