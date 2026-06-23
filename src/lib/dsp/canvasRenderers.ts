import {
    valToX,
    valToY,
    xToVal,
    yToVal,
    timeMin,
    timeMax,
    dbMin,
    dbMax,
    freqMin,
    freqMax,
    type InteractionState
} from './canvasInteraction';
import { palettes, getColorFromPalette, type PaletteType } from './colorPalettes';
import { type MetricConfig } from './quadrantState';


/**
 * Draws coherence as a background overlay on the quadrant.
 * Uses the configured bgPalette to color by coherence value.
 */
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

        // Only paint below threshold — transparent above
        if (coh < threshold) {
            // Intensity proportional to how far below threshold (0 → max, threshold → 0)
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

/**
 * Applies coherence mask to curves drawn on an offscreen canvas.
 * - 'attenuate': uses destination-out to erase/fade curves where coh < threshold
 * - 'color': uses source-atop to repaint curves with chosen color where coh < threshold
 */
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
    ctx.globalAlpha = 1.0; // Reset — may have inherited reduced alpha from layer loop

    if (mode === 'attenuate') {
        // destination-out: erases existing pixels proportionally
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
        // Color mode: source-atop paints the chosen color ONLY on existing curve pixels
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
                // Full color replacement where coherence is low
                ctx.fillStyle = maskColor;
                ctx.fillRect(x - colWidth, 0, colWidth, height);
            }
            prevX = x;
        }
    }

    ctx.restore(); // Restores globalCompositeOperation and globalAlpha
}

/** Helper: convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


export function drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    hasTimeDomainActive: boolean,
    activeMetrics: string[],
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    isDarkMode: boolean,
    showMinorGrid: boolean = true
) {
    const theme = isDarkMode ? {
        gridLine: 'rgba(255, 255, 255, 0.04)',
        gridLineMajor: 'rgba(255, 255, 255, 0.08)',
        gridLineMinor: 'rgba(255, 255, 255, 0.025)',
        axisLabel: 'rgba(255, 255, 255, 0.35)',
        axisLine: '#333',
        background: '#060608',
    } : {
        gridLine: 'rgba(0, 0, 0, 0.06)',
        gridLineMajor: 'rgba(0, 0, 0, 0.12)',
        gridLineMinor: 'rgba(0, 0, 0, 0.04)',
        axisLabel: 'rgba(0, 0, 0, 0.55)',
        axisLine: '#999',
        background: '#f8f8fa',
    };

    ctx.strokeStyle = theme.gridLineMajor;
    ctx.fillStyle = theme.axisLabel;
    ctx.font = "9px monospace";

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
        ctx.strokeStyle = theme.gridLineMajor;
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
        ctx.fillStyle = theme.axisLabel;
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
            ctx.strokeStyle = theme.gridLineMinor;
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
        ctx.strokeStyle = theme.gridLineMajor;
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
        ctx.font = "9px monospace";
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

export function drawSpectrogram(
    ctx: CanvasRenderingContext2D,
    offscreenCanvas: HTMLCanvasElement | null,
    width: number,
    height: number,
    paletteType: PaletteType = 'Magma'
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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
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
            numRows += 2; // Añadimos tiempo e intensidad del espectrograma
            const historyLine = Math.max(0, Math.min(spectrogramDbHistory.length - 1, Math.floor((state.mouseY / height) * spectrogramDbHistory.length)));
            const pixelX = Math.max(0, Math.min(width - 1, Math.round(state.mouseX)));
            spectrogramVal = spectrogramDbHistory[historyLine]?.[pixelX] ?? -120;
            spectrogramTime = -10 + (state.mouseY / height) * 10;
        }
    }

    ctx.fillStyle = "rgba(8, 8, 12, 0.95)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";

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

    ctx.fillStyle = "#fff";
    ctx.font = 'bold 8px "Outfit", sans-serif';

    if (hasTimeDomainActive) {
        ctx.fillText(`Tiempo: ${xVal.toFixed(2)} ms`, lx + 8, ly + 14);
        ctx.fillStyle = "#9ca3af";
        ctx.font = "8px monospace";

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
        ctx.font = "8px monospace";

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

export function drawMetricPath(
    ctx: CanvasRenderingContext2D,
    dataArray: Float32Array,
    width: number,
    height: number,
    color: string,
    lw: number,
    lineDash: number[],
    metricType: string,
    frequencyLUT: Int32Array,
    interpCoherence: Float32Array,
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
    frequencyLUT: Int32Array,
    interpCoherence: Float32Array,
    interpMagnitude: Float32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    getPPOSmoothedValue: (binIndex: number, dataArray: Float32Array, ppo: number) => number,
    bins: number,
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
        // Encontrar pico para referencia 0 dB
        let peakVal = 0;
        for (let i = 0; i < data.length; i++) {
            const absVal = Math.abs(data[i]);
            if (absVal > peakVal) peakVal = absVal;
        }
        const peakRef = 20 * Math.log10(peakVal + 1e-12);
        for (let i = 0; i < data.length; i++) {
            etcData[i] = 20 * Math.log10(Math.abs(data[i]) + 1e-12) - peakRef;
        }
        // Usar etcData para el renderizado con eje Y en dB (-60 a 0)
        data = etcData;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(lineDash || []);
    ctx.beginPath();
    let first = true;
    const numPoints = 350;
    for (let i = 0; i < numPoints; i++) {
        const t = timeMin + (i / (numPoints - 1)) * (timeMax - timeMin);
        const x = valToX(t, width, hasTimeDomainActive, state);
        const val = getImpulseValueInterpolated(t, data);
        const y = valToY(val, height, metricType, metricConfigs || {}, state);

        if (x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50) {
            if (first) {
                ctx.moveTo(x, y);
                first = false;
            } else {
                ctx.lineTo(x, y);
            }
        }
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

export function drawSimulatedMagnitudePath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: { color: string, lineWidth: number, lineDash: number[] },
    frequencyLUT: Int32Array,
    interpCoherence: Float32Array,
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

    // Pixel-distance based decimation: adapts to log scale
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

    // Single Path2D — coherence masking handled externally
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            path.lineTo(points[i].x, points[i].y);
        }
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
    ctx.beginPath();
    let first = true;

    for (let k = 0; k < hReal.length; k++) {
        const x = centerX + hReal[k] * maxRad;
        const y = centerY - hImag[k] * maxRad;

        if (first) {
            ctx.moveTo(x, y);
            first = false;
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
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

    ctx.beginPath();
    let first = true;
    for (let i = 0; i < targetStore.points.length; i++) {
        const p = targetStore.points[i];
        const x = valToX(p.f, width, false, state);
        const y = valToY(p.g + targetStore.offset, height, "Magnitude", {}, state);

        if (first) {
            ctx.moveTo(x, y);
            first = false;
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
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
    ctx.beginPath();
    const step = width / timeData.length;
    for (let i = 0; i < timeData.length; i++) {
        const x = i * step;
        const y = (height / 2) - (timeData[i] * height / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

export function drawPhasePath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: { color: string, lineWidth: number, lineDash: number[] },
    frequencyLUT: Int32Array,
    interpPhase: Float32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    interpCoherence?: Float32Array
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

    const path = new Path2D();
    let lastY = 0;
    let first = true;

    for (let x = 0; x < width; x++) {
        const binIndex = frequencyLUT[x];
        if (binIndex === undefined) continue;

        // Masking by coherence (Prompt 11 parity)
        if (interpCoherence && magCfg.enableCoherence && interpCoherence[binIndex] < (magCfg.coherenceThreshold ?? 0.5)) {
            first = true;
            continue;
        }

        let val = phaseToRender[binIndex];
        
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

        if (first) {
            path.moveTo(x, y);
            first = false;
        } else {
            if (Math.abs(y - lastY) > height * 0.65) {
                path.moveTo(x, y); // Salto circular sin dibujar línea vertical de descarte
            } else {
                path.lineTo(x, y);
            }
        }
        lastY = y;
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
    ctx.beginPath();
    let first = true;

    for (let x = 0; x < width; x++) {
        const binIndex = frequencyLUT[x];
        if (binIndex === undefined) continue;

        const val = crestFactorData[binIndex];
        const y = valToY(val, height, "Crest Factor", {}, state);

        if (first) {
            ctx.moveTo(x, y);
            first = false;
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
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
    ctx.beginPath();
    let first = true;
    const sr = sampleRate;
    const binWidth = sr / 2 / bins;

    for (let x = 0; x < width; x++) {
        const binIndex = frequencyLUT[x];
        if (binIndex === undefined || binIndex < 1) continue;

        const freq = binIndex * binWidth || 1e-6;
        const phaseRad = (phaseData[binIndex] * Math.PI) / 180;

        // Phase Delay = -φ(f) / (2πf), convertido a ms
        const phaseDelayMs = (-phaseRad / (2 * Math.PI * freq)) * 1000;

        // Clamp para evitar valores absurdos en bajas frecuencias
        const clampedDelay = Math.max(-5, Math.min(25, phaseDelayMs));

        const y = valToY(clampedDelay, height, 'Phase Delay', metricConfigs, state);

        if (first) {
            ctx.moveTo(x, y);
            first = false;
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
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
    sampleRate: number = 48000
) {
    ctx.setLineDash(style.lineDash || []);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;

    const path = new Path2D();
    const sr = sampleRate;
    const binWidth = sr / 2 / bins;

    // Pixel-distance based decimation: skip bins closer than 2px (adapts to log scale)
    let pointCount = 0;
    let prevX = -100;

    // First pass: stroke path
    let started = false;

    // Collect points for fill
    const xs: number[] = [];
    const ys: number[] = [];

    for (let bin = 1; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;
        // Skip if less than 2px apart (at high freqs many bins map to same pixel)
        if (x - prevX < 2 && prevX > -100) continue;
        prevX = x;

        const val = getEQResponseCached(freq);
        const y = valToY(val, height, "Magnitude", metricConfigs, state);

        if (!started) {
            path.moveTo(x, y);
            started = true;
        } else {
            path.lineTo(x, y);
        }
        xs.push(x);
        ys.push(y);
        pointCount++;
    }

    if (pointCount > 0) {
        ctx.stroke(path);

        // Fill semitransparente bajo la curva hasta 0dB
        const zeroY = valToY(0, height, "Magnitude", metricConfigs, state);
        if (pointCount > 1) {
            const fillPath = new Path2D();
            fillPath.moveTo(xs[0], zeroY);
            for (let i = 0; i < pointCount; i++) fillPath.lineTo(xs[i], ys[i]);
            fillPath.lineTo(xs[pointCount - 1], zeroY);
            fillPath.closePath();
            ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
            ctx.fill(fillPath);
        }
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
    const binWidth = sampleRate / 2 / bins;
    let started = false;
    let prevX = -100;

    for (let bin = 1; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;
        if (x - prevX < 2 && prevX > -100) continue;
        prevX = x;

        // Phase in radians → degrees for display on Phase axis
        const phaseRad = getEQPhaseCached(freq);
        const phaseDeg = phaseRad * (180 / Math.PI);
        const y = valToY(phaseDeg, height, "Phase", metricConfigs, state);

        if (!started) {
            path.moveTo(x, y);
            started = true;
        } else {
            path.lineTo(x, y);
        }
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
    const binWidth = sampleRate / 2 / bins;
    const TWO_PI = 2 * Math.PI;

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    const path = new Path2D();
    const xs: number[] = [];
    const ys: number[] = [];
    let started = false;
    let prevX = -100;

    for (let bin = 1; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;
        if (x - prevX < 2 && prevX > -100) continue;
        prevX = x;

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

        if (!started) { path.moveTo(x, y); started = true; }
        else { path.lineTo(x, y); }
        xs.push(x);
        ys.push(y);
    }

    if (xs.length > 1) {
        ctx.stroke(path);

        // Subtle fill
        ctx.globalAlpha = 0.06;
        const zeroY = valToY(0, height, "Magnitude", metricConfigs, state);
        const fillPath = new Path2D();
        fillPath.moveTo(xs[0], zeroY);
        for (let i = 0; i < xs.length; i++) fillPath.lineTo(xs[i], ys[i]);
        fillPath.lineTo(xs[xs.length - 1], zeroY);
        fillPath.closePath();
        ctx.fillStyle = color;
        ctx.fill(fillPath);
    }

    ctx.globalAlpha = 1.0;
}
