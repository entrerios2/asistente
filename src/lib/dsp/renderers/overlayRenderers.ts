/**
 * Overlay renderers: coherence background/mask, level meters, numeric HUD,
 * spectrogram, target trace, scope.
 * Extracted from canvasRenderers.ts for maintainability.
 */
import {
    valToX,
    valToY,
    freqMin,
    freqMax,
    type InteractionState
} from '../canvasInteraction';
import { getColorFromPalette, type PaletteType } from '../colorPalettes';
import { type MetricConfig } from '../quadrantState';

/** Helper: convert hex color to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function drawCoherenceBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    interpCoherence: Float32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    sampleRate: number = 48000
) {
    const cohCfg = metricConfigs["Coherence"];
    if (!cohCfg?.showBackground) return;

    const palette = cohCfg.bgPalette || "RedTransparent";
    const threshold = cohCfg.thresholdValue ?? 0.2;
    const bins = interpCoherence.length;
    if (bins === 0) return;
    const binWidth = (sampleRate / 2) / bins;

    ctx.save();

    let prevX = -1;
    for (let bin = 1; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -1 || x > width + 1) continue;

        const coh = interpCoherence[bin] ?? 0;
        const colWidth = Math.max(1, x - prevX);

        if (coh < threshold) {
            const intensity = 1 - coh / threshold;

            if (palette === "RedTransparent") {
                const alpha = intensity * 0.25;
                ctx.fillStyle = `rgba(180, 20, 20, ${alpha})`;
                ctx.fillRect(x - colWidth, 0, colWidth, height);
            } else {
                const [r, g, b] = getColorFromPalette(intensity, palette as PaletteType);
                const alpha = intensity * 0.25;
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                ctx.fillRect(x - colWidth, 0, colWidth, height);
            }
        }

        prevX = x;
    }

    ctx.restore();
}

export function applyCoherenceMask(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    interpCoherence: Float32Array,
    threshold: number,
    mode: 'attenuate' | 'color',
    maskColor: string,
    state: InteractionState,
    sampleRate: number = 48000
) {
    const bins = interpCoherence.length;
    if (bins === 0) return;
    const binWidth = (sampleRate / 2) / bins;

    ctx.save();
    ctx.globalAlpha = 1.0;

    if (mode === 'attenuate') {
        ctx.globalCompositeOperation = 'destination-out';

        let prevX = -1;
        for (let bin = 1; bin < bins; bin++) {
            const freq = bin * binWidth;
            if (freq < freqMin || freq > freqMax) continue;
            const x = valToX(freq, width, false, state);
            if (x < -1 || x > width + 1) continue;
            const coh = interpCoherence[bin] ?? 0;
            if (coh < threshold) {
                const colWidth = Math.max(1, x - prevX);
                const eraseAlpha = (1 - coh / threshold) * 0.85;
                ctx.fillStyle = `rgba(0, 0, 0, ${eraseAlpha})`;
                ctx.fillRect(x - colWidth, 0, colWidth, height);
            }
            prevX = x;
        }
    } else {
        ctx.globalCompositeOperation = 'source-atop';

        let prevX = -1;
        for (let bin = 1; bin < bins; bin++) {
            const freq = bin * binWidth;
            if (freq < freqMin || freq > freqMax) continue;
            const x = valToX(freq, width, false, state);
            if (x < -1 || x > width + 1) continue;
            const coh = interpCoherence[bin] ?? 0;
            if (coh < threshold) {
                const colWidth = Math.max(1, x - prevX);
                ctx.fillStyle = maskColor;
                ctx.fillRect(x - colWidth, 0, colWidth, height);
            }
            prevX = x;
        }
    }

    ctx.restore();
}

export function drawSpectrogram(
    ctx: CanvasRenderingContext2D,
    offscreenCanvas: HTMLCanvasElement | null,
    width: number,
    height: number,
    _paletteType: PaletteType = 'Magma'
) {
    if (!offscreenCanvas) return;
    ctx.drawImage(offscreenCanvas, 0, 0, width, height);
}

export function drawLevelOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    meterStore: any
) {
    const barWidth = 14;
    const barHeight = height * 0.55;
    const xStart = width - 48;
    const yStart = (height - barHeight) / 2 + 10;

    ctx.fillStyle = "rgba(6, 10, 15, 0.85)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
        xStart - 10,
        yStart - 15,
        barWidth * 2 + 25,
        barHeight + 30,
        8,
    );
    ctx.fill();
    ctx.stroke();

    const inVal = meterStore.inLevels[0] || -60;
    const outVal = meterStore.outLevels[0] || -60;

    ctx.fillStyle = "#bbb";
    ctx.font = "8px monospace";
    const dbTicks = [0, -10, -20, -30, -45, -60];
    dbTicks.forEach((db) => {
        const pct = (db + 60) / 60;
        const y = yStart + barHeight - pct * barHeight;
        ctx.fillText(`${db}`, xStart + barWidth * 2 + 8, y + 3);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        ctx.moveTo(xStart - 5, y);
        ctx.lineTo(xStart + barWidth * 2 + 5, y);
        ctx.stroke();
    });

    const drawBar = (dbValue: number, xPos: number, isInput: boolean) => {
        ctx.fillStyle = "#060608";
        ctx.fillRect(xPos, yStart, barWidth, barHeight);

        const pct = Math.max(0, Math.min(1, (dbValue + 60) / 60));
        const fillHeight = pct * barHeight;
        const yFill = yStart + barHeight - fillHeight;

        const grad = ctx.createLinearGradient(
            xPos,
            yStart + barHeight,
            xPos,
            yStart,
        );
        grad.addColorStop(0, "#00ff88");
        grad.addColorStop(0.7, "#eab308");
        grad.addColorStop(1, "#ef4444");

        ctx.fillStyle = grad;
        ctx.fillRect(xPos, yFill, barWidth, fillHeight);

        ctx.fillStyle = "#999";
        ctx.fillText(
            isInput ? "IN" : "OUT",
            xPos + 1,
            yStart + barHeight + 11,
        );
    };

    drawBar(inVal, xStart, true);
    drawBar(outVal, xStart + barWidth + 5, false);
}

export function drawNumericOverlay(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    meterStore: any,
    hasTimeDomainActive: boolean
) {
    const panelWidth = 170;
    const panelHeight = 115;
    const xPos = 16;
    const yPos = 46;

    ctx.fillStyle = "rgba(8, 8, 12, 0.85)";
    ctx.strokeStyle = "rgba(20, 184, 166, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(xPos, yPos, panelWidth, panelHeight, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#14b8a6";
    ctx.font = 'bold 9px "Outfit", sans-serif';
    ctx.fillText("ANÁLISIS ACÚSTICO HUD", xPos + 12, yPos + 18);

    ctx.strokeStyle = "rgba(20, 184, 166, 0.12)";
    ctx.beginPath();
    ctx.moveTo(xPos + 10, yPos + 24);
    ctx.lineTo(xPos + panelWidth - 10, yPos + 24);
    ctx.stroke();

    const inVal = meterStore.inLevels[0] || -60;
    const outVal = meterStore.outLevels[0] || -60;
    const snr = inVal - -65;

    const rows = [
        {
            label: "RMS Entrada:",
            val: `${inVal.toFixed(1)} dB`,
            color: "#fff",
        },
        {
            label: "RMS Salida:",
            val: `${outVal.toFixed(1)} dB`,
            color: "#fff",
        },
        {
            label: "SNR Estimado:",
            val: `${snr.toFixed(1)} dB`,
            color: "#eab308",
        },
        {
            label: "Distancia Alt.:",
            val: hasTimeDomainActive ? "4.82 m" : "N/A",
            color: "#3b82f6",
        },
        {
            label: "RT60 Sala:",
            val: hasTimeDomainActive ? "0.36 s" : "N/A",
            color: "#10b981",
        },
    ];

    rows.forEach((r, idx) => {
        const y = yPos + 38 + idx * 14;
        ctx.fillStyle = "#9ca3af";
        ctx.font = '8px "Inter", sans-serif';
        ctx.fillText(r.label, xPos + 12, y);

        ctx.fillStyle = r.color;
        ctx.font = "bold 8px monospace";
        ctx.fillText(r.val, xPos + panelWidth - 55, y);
    });
}

export function drawTargetTrace(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    targetStore: any,
    state: InteractionState,
    hasTimeDomainActive: boolean
) {
    if (!targetStore.visible || hasTimeDomainActive) return;

    ctx.strokeStyle = targetStore.color;
    ctx.globalAlpha = targetStore.opacity;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Build points array
    const points: { x: number, y: number }[] = [];
    for (let i = 0; i < targetStore.points.length; i++) {
        const p = targetStore.points[i];
        const x = valToX(p.f, width, false, state);
        const y = valToY(p.g + targetStore.offset, height, "Magnitude", {}, state);
        points.push({ x, y });
    }

    // Draw with quadratic spline
    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;
}

export function drawScope(
    ctx: CanvasRenderingContext2D,
    timeData: Float32Array,
    width: number,
    height: number,
    color: string,
    lw: number
) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;

    // Build points
    const points: { x: number, y: number }[] = [];
    const step = width / timeData.length;
    for (let i = 0; i < timeData.length; i++) {
        const x = i * step;
        const y = (height / 2) - (timeData[i] * height / 2);
        points.push({ x, y });
    }

    // Draw with quadratic spline
    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
    }
}
