/**
 * Grid, axes, and crosshair renderers.
 * Extracted from canvasRenderers.ts for maintainability.
 */
import {
    valToX,
    valToY,
    xToVal,
    type InteractionState
} from '../canvasInteraction';
import { type MetricConfig } from '../quadrantState';
import { getCanvasTheme, CANVAS_FONT } from '../canvasTheme';

export function drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    hasTimeDomainActive: boolean,
    activeMetrics: string[],
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    _isDarkMode: boolean,
    showMinorGrid: boolean = true
) {
    const theme = getCanvasTheme();

    ctx.strokeStyle = theme.gridMajor;
    ctx.fillStyle = theme.label;
    ctx.font = CANVAS_FONT.label;

    // Vertical ticks (X axis)
    if (hasTimeDomainActive) {
        for (let t = -10; t <= 100; t += 10) {
            const x = valToX(t, width, hasTimeDomainActive, state);
            if (x >= 0 && x <= width) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
                ctx.fillText(`${t}ms`, x + 3, height - 6);
            }
        }
    } else {
        // Major decades: 100, 1k, 10k — prominent lines
        const majorFreqs = [100, 1000, 10000];
        ctx.strokeStyle = theme.gridMajor;
        majorFreqs.forEach((f) => {
            const x = valToX(f, width, hasTimeDomainActive, state);
            if (x >= 0 && x <= width) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        });

        // Labels at standard positions
        const labelFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        const majorSet = new Set([100, 1000, 10000]);
        ctx.fillStyle = theme.label;
        labelFreqs.forEach((f) => {
            const x = valToX(f, width, hasTimeDomainActive, state);
            if (x >= 0 && x <= width) {
                const isMajor = majorSet.has(f);
                let label: string;
                if (f >= 1000) {
                    label = isMajor ? `${f / 1000}kHz` : `${f / 1000}k`;
                } else {
                    label = isMajor ? `${f}Hz` : `${f}`;
                }
                ctx.fillText(label, x + 3, height - 6);
            }
        });

        // Minor grid lines: all other frequencies — solid 1px
        if (showMinorGrid) {
            ctx.save();
            ctx.strokeStyle = theme.gridMinor;
            ctx.lineWidth = 1;
            const minorFreqs = [
                20, 30, 40, 50, 60, 70, 80, 90,
                200, 300, 400, 500, 600, 700, 800, 900,
                2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
                15000, 20000,
            ];
            minorFreqs.forEach((f) => {
                const x = valToX(f, width, hasTimeDomainActive, state);
                if (x >= 0 && x <= width) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                    ctx.stroke();
                }
            });
            ctx.restore();
        }
    }

    // Horizontal ticks (Left Y axis)
    const mainMetric =
        activeMetrics.find(
            (m) => m !== "Phase" && m !== "Level" && m !== "Numeric",
        ) || activeMetrics[0];
    if (mainMetric && mainMetric !== "Spectrogram" && mainMetric !== "Nyquist") {
        let min = -60,
            max = 60,
            step = 10,
            unit = "dB";
        if (mainMetric === "Spectrum") {
            min = 20;
            max = 100;
            step = 10;
            unit = "dBSPL";
        } else if (mainMetric === "Coherence") {
            min = 0;
            max = 1;
            step = 0.2;
            unit = "";
        } else if (mainMetric === "Group Delay" || mainMetric === "Phase Delay") {
            min = -5;
            max = 25;
            step = 5;
            unit = "ms";
        } else if (mainMetric === "Impulse" || mainMetric === "Step" || mainMetric === "Scope") {
            min = -1;
            max = 1;
            step = 0.5;
            unit = "";
        } else if (mainMetric === "Crest Factor") {
            min = 0;
            max = 30;
            step = 5;
            unit = "dB";
        }

        for (let val = min; val <= max; val += step) {
            const y = valToY(val, height, mainMetric, metricConfigs, state);
            if (y >= 0 && y <= height) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
                ctx.fillText(
                    `${val.toFixed(mainMetric === "Coherence" ? 1 : 0)}${unit}`,
                    8,
                    y - 4,
                );
            }
        }
    }

    // Grid radial para Nyquist
    if (mainMetric === "Nyquist") {
        ctx.strokeStyle = theme.gridMajor;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRad = Math.min(width, height) / 2 * 0.9;

        for (let r = 0.2; r <= 1.0; r += 0.2) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, r * maxRad, 0, Math.PI * 2);
            ctx.stroke();
        }
        for (let a = 0; a < 360; a += 30) {
            const rad = a * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + Math.cos(rad) * maxRad, centerY + Math.sin(rad) * maxRad);
            ctx.stroke();
        }
    }

    // Horizontal ticks (Right secondary Y axis for Phase)
    if (activeMetrics.includes("Phase") && !hasTimeDomainActive) {
        ctx.fillStyle = "rgba(217, 70, 239, 0.75)";
        for (let val = -180; val <= 180; val += 60) {
            const y = valToY(val, height, "Phase", metricConfigs, state);
            if (y >= 0 && y <= height) {
                ctx.beginPath();
                ctx.strokeStyle = "rgba(217, 70, 239, 0.08)";
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
                ctx.fillText(`${val}°`, width - 35, y - 4);
            }
        }
    }

    // Horizontal ticks (Right secondary Y axis for Spectrum)
    if (activeMetrics.includes("Spectrum") && !hasTimeDomainActive) {
        ctx.fillStyle = "#a855f7";
        for (let val = -120; val <= 10; val += 20) {
            const y = valToY(val, height, "Spectrum", metricConfigs, state);
            if (y >= 0 && y <= height) {
                ctx.beginPath();
                ctx.strokeStyle = "rgba(168, 85, 247, 0.08)";
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
                ctx.fillText(`${val} dBSPL`, width - 40, y - 4);
            }
        }
    }

    // Eje Y Secundario (Historial de Tiempo para Espectrograma)
    if (activeMetrics.includes("Spectrogram") && !hasTimeDomainActive) {
        ctx.fillStyle = "#888";
        ctx.font = CANVAS_FONT.label;
        const timeLabels = [
            { yPct: 1.0, text: "0s" },
            { yPct: 0.75, text: "-2.5s" },
            { yPct: 0.5, text: "-5s" },
            { yPct: 0.25, text: "-7.5s" },
            { yPct: 0.0, text: "-10s" }
        ];
        timeLabels.forEach((lbl) => {
            let yPos = lbl.yPct * height;
            if (lbl.yPct === 1.0) yPos -= 6;
            if (lbl.yPct === 0.0) yPos += 12;
            ctx.fillText(lbl.text, width - 42, yPos);
        });
    }
}

export function drawCrosshair(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: InteractionState,
    hasTimeDomainActive: boolean,
    activeMetrics: string[],
    interpMagnitude: Float32Array,
    interpPhase: Float32Array,
    interpCoherence: Float32Array,
    interpImpulse: Float32Array,
    interpStep: Float32Array,
    spectrogramDbHistory: Float32Array[],
    liveData: Float32Array | null,
    getMetricValueInterpolated: (freq: number, dataArray: Float32Array) => number,
    getImpulseValueInterpolated: (timeMs: number, impulseArray: Float32Array) => number
) {
    const theme = getCanvasTheme();
    ctx.strokeStyle = theme.crosshair;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(state.mouseX, 0);
    ctx.lineTo(state.mouseX, height);
    ctx.moveTo(0, state.mouseY);
    ctx.lineTo(width, state.mouseY);
    ctx.stroke();
    ctx.setLineDash([]);

    const xVal = xToVal(state.mouseX, width, hasTimeDomainActive, state);

    // Calcular cantidad de filas dinámicas
    let numRows = 0;
    let showSpectrogramHover = false;
    let spectrogramTime = 0;
    let spectrogramVal = -120;

    if (hasTimeDomainActive) {
        if (activeMetrics.includes("Impulse")) numRows++;
        if (activeMetrics.includes("Step")) numRows++;
    } else {
        if (activeMetrics.includes("Magnitude")) numRows++;
        if (activeMetrics.includes("Spectrum")) numRows++;
        if (activeMetrics.includes("Phase")) numRows++;
        if (activeMetrics.includes("Coherence")) numRows++;
        if (activeMetrics.includes("Spectrogram") && spectrogramDbHistory.length > 0) {
            showSpectrogramHover = true;
            numRows += 2;
            const historyLine = Math.max(0, Math.min(spectrogramDbHistory.length - 1, Math.floor((state.mouseY / height) * spectrogramDbHistory.length)));
            const pixelX = Math.max(0, Math.min(width - 1, Math.round(state.mouseX)));
            spectrogramVal = spectrogramDbHistory[historyLine]?.[pixelX] ?? -120;
            spectrogramTime = -10 + (state.mouseY / height) * 10;
        }
    }

    ctx.fillStyle = theme.tooltipBg;
    ctx.strokeStyle = theme.tooltipBorder;

    const labelWidth = 145;
    const labelHeight = 22 + numRows * 12;
    let lx = state.mouseX + 12;
    let ly = state.mouseY - labelHeight - 12;

    if (lx + labelWidth > width) lx = state.mouseX - labelWidth - 12;
    if (ly < 0) ly = state.mouseY + 12;

    ctx.beginPath();
    ctx.roundRect(lx, ly, labelWidth, labelHeight, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme.tooltipText;
    ctx.font = CANVAS_FONT.tooltipBold;

    if (hasTimeDomainActive) {
        ctx.fillText(`Tiempo: ${xVal.toFixed(2)} ms`, lx + 8, ly + 14);
        ctx.fillStyle = theme.tooltipText;
        ctx.font = CANVAS_FONT.tooltip;

        let rowIdx = 0;
        if (activeMetrics.includes("Impulse")) {
            const val = getImpulseValueInterpolated(xVal, interpImpulse);
            ctx.fillText(
                `Impulso: ${val.toFixed(3)}`,
                lx + 8,
                ly + 28 + rowIdx * 12,
            );
            rowIdx++;
        }
        if (activeMetrics.includes("Step")) {
            const val = getImpulseValueInterpolated(xVal, interpStep);
            ctx.fillText(
                `Escalón: ${val.toFixed(3)}`,
                lx + 8,
                ly + 28 + rowIdx * 12,
            );
        }
    } else {
        ctx.fillText(`Frec: ${xVal.toFixed(1)} Hz`, lx + 8, ly + 14);
        ctx.font = CANVAS_FONT.tooltip;

        let rowIdx = 0;
        if (activeMetrics.includes("Magnitude")) {
            const val = getMetricValueInterpolated(xVal, interpMagnitude);
            ctx.fillStyle = "#ff4444";
            ctx.fillText(
                `Magnitud: ${val.toFixed(1)} dB`,
                lx + 8,
                ly + 28 + rowIdx * 12,
            );
            rowIdx++;
        }
        if (activeMetrics.includes("Spectrum")) {
            const val = getMetricValueInterpolated(
                xVal,
                liveData && liveData.length > 0
                    ? liveData
                    : interpMagnitude,
            );
            const offset =
                liveData && liveData.length > 0
                    ? 0
                    : 68;
            ctx.fillStyle = "#a855f7";
            ctx.fillText(
                `Espectro: ${(val + offset).toFixed(1)} dBSPL`,
                lx + 8,
                ly + 28 + rowIdx * 12,
            );
            rowIdx++;
        }
        if (activeMetrics.includes("Phase")) {
            const val = getMetricValueInterpolated(xVal, interpPhase);
            ctx.fillStyle = "#d946ef";
            ctx.fillText(
                `Fase: ${val.toFixed(0)}°`,
                lx + 8,
                ly + 28 + rowIdx * 12,
            );
            rowIdx++;
        }
        if (activeMetrics.includes("Coherence")) {
            const val = getMetricValueInterpolated(xVal, interpCoherence);
            ctx.fillStyle = "#eab308";
            ctx.fillText(
                `Coherencia: ${val.toFixed(2)}`,
                lx + 8,
                ly + 28 + rowIdx * 12,
            );
            rowIdx++;
        }
        if (showSpectrogramHover) {
            ctx.fillStyle = "#ec4899";
            ctx.fillText(
                `Tiempo: ${spectrogramTime.toFixed(1)} s`,
                lx + 8,
                ly + 28 + rowIdx * 12,
            );
            rowIdx++;
            ctx.fillText(
                `Espectrog.: ${spectrogramVal.toFixed(1)} dB`,
                lx + 8,
                ly + 28 + rowIdx * 12,
            );
            rowIdx++;
        }
    }
}
