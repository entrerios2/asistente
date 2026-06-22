import {
    drawCoherenceBackground,
    applyCoherenceMask,
    drawGrid,
    drawSpectrogram,
    drawLevelOverlay,
    drawNumericOverlay,
    drawCrosshair,
    drawMetricPath,
    drawSpectrumPath,
    drawTimeDomainPath,
    drawSimulatedMagnitudePath,
    drawPhasePath,
    drawNyquistPath,
    drawTargetTrace,
    drawScope,
    drawCrestFactor,
    drawPhaseDelay,
    drawEQOverlayPath
} from './canvasRenderers';
import {
    freqMin,
    freqMax,
    valToX,
    valToY,
    type InteractionState,
} from './canvasInteraction';
import type { MetricConfig, MetricStyle } from './quadrantState';
import type { InterpolationEngine } from './interpolationEngine';
import type { MeasurementLayer, Instantanea } from '../stores/traceManager.svelte';
import { uiStore } from '../stores/ui.svelte';

const maxHistory = 100;

export interface DrawParams {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;

    // Métricas y configuración
    activeMetrics: string[];
    hasTimeDomainActive: boolean;
    metricConfigs: Record<string, MetricConfig>;
    metricStyles: Record<string, MetricStyle>;
    interactionState: InteractionState;
    isDarkMode: boolean;
    sampleRate: number;
    BINS: number;

    // Buffers de interpolación
    interpEngine: InterpolationEngine;
    liveData: Float32Array | null;
    frequencyLUT: Int32Array;
    smoothedMagnitude: Float32Array;
    smoothedSpectrum: Float32Array;

    // Callbacks
    getPPOSmoothedValue: (bin: number, arr: Float32Array, ppo: number) => number;
    getMetricValueInterpolated: (freq: number, arr: Float32Array) => number;
    getImpulseValueInterpolated: (timeMs: number, arr: Float32Array) => number;
    getMetricAlpha: (metric: string) => number;
    getEQResponseCached: (freq: number) => number;

    // Capas y snapshots
    myLayers: MeasurementLayer[];
    quadrantLayers: MeasurementLayer[];
    instantaneas: Instantanea[];

    // EQ overlay
    showEQOverlay: boolean;
    eqBands: { freq: number; gain: number; q: number; type: string }[];
    hoveringEQNode: number | null;
    draggingEQNode: number | null;

    // Spectrogram
    offscreenCanvas: HTMLCanvasElement | null;
    offscreenCtx: CanvasRenderingContext2D | null;
    spectrogramLUT_RGBA: Uint8ClampedArray;
    spectrogramFrameCountRef: { value: number };
    initOffscreenCanvas: () => void;
    spectrogramDbHistory: Float32Array[];
    sharedImageData: ImageData | null;

    // Target & meter overlays
    targetTrace: any;
    meterStore: any;

    // Nyquist
    hReal: Float32Array;
    hImag: Float32Array;
    outputCrestFactor: Float32Array;

    // Canvas dimensions for EQ node positioning
    containerWidth: number;
    containerHeight: number;

    // Custom PPO smoothing
    customPPOSmooth: (idx: number, arr: Float32Array) => number;
}

export function drawQuadrant(p: DrawParams): void {
    // 1. Renderizado de Espectrograma 2D (Fondo)
    if (p.activeMetrics.includes("Spectrogram") && !p.hasTimeDomainActive) {
        drawSpectrogram(p.ctx, p.offscreenCanvas, p.width, p.height);
    }

    // 2. Dibujar Grilla de Fondo (encima)
    drawGrid(p.ctx, p.width, p.height, p.hasTimeDomainActive, p.activeMetrics, p.metricConfigs, p.interactionState, p.isDarkMode, uiStore.showMinorGrid);


    // 2.5. Coherence background overlay — solo si Coherence es métrica activa
    const cohCfg = p.metricConfigs["Coherence"];
    if (!p.hasTimeDomainActive && p.activeMetrics.includes("Coherence") && cohCfg?.showBackground) {
        drawCoherenceBackground(
            p.ctx, p.width, p.height,
            p.interpEngine.interpCoherence,
            p.metricConfigs,
            p.interactionState,
            p.sampleRate
        );
    }

    // Alimentar buffer de Espectrograma en vivo optimizado con offscreen canvas
    if (
        p.liveData && p.liveData.length > 0 &&
        p.activeMetrics.includes("Spectrogram") &&
        !p.hasTimeDomainActive
    ) {
        p.spectrogramFrameCountRef.value++;
        if (p.spectrogramFrameCountRef.value % 3 === 0) {
            const w = Math.round(p.width) || 800;
            if (!p.offscreenCanvas || p.offscreenCanvas.width !== w) {
                p.initOffscreenCanvas();
            }
            if (p.offscreenCtx && p.offscreenCanvas && p.sharedImageData) {
                // Desplazar el espectrograma existente 1 píxel hacia arriba
                p.offscreenCtx.drawImage(
                    p.offscreenCanvas,
                    0,
                    1,
                    w,
                    maxHistory - 1,
                    0,
                    0,
                    w,
                    maxHistory - 1,
                );

                // Dibujar la nueva fila en el extremo inferior usando ImageData pre-alocado para aceleración directa
                const pixels = p.sharedImageData.data;
                const data = p.liveData;
                const yRow = maxHistory - 1;
                const logMin = Math.log10(freqMin);
                const logMax = Math.log10(freqMax);

                const dbRow = new Float32Array(w);
                for (let x = 0; x < w; x++) {
                    const logFreq = (x / w) * (logMax - logMin) + logMin;
                    const freq = Math.pow(10, logFreq);
                    const val = p.getMetricValueInterpolated(freq, data);
                    dbRow[x] = val;

                    const db = Math.max(-60, Math.min(15, val));
                    const norm = (db + 60) / 75;
                    const lutIdx = Math.max(
                        0,
                        Math.min(255, Math.floor(norm * 255)),
                    );

                    const rIdx = lutIdx * 3;
                    const pixelIdx = x * 4;
                    pixels[pixelIdx] = p.spectrogramLUT_RGBA[rIdx];
                    pixels[pixelIdx + 1] = p.spectrogramLUT_RGBA[rIdx + 1];
                    pixels[pixelIdx + 2] = p.spectrogramLUT_RGBA[rIdx + 2];
                    pixels[pixelIdx + 3] = 255; // Opacidad total
                }

                p.offscreenCtx.putImageData(p.sharedImageData, 0, yRow);

                p.spectrogramDbHistory.push(dbRow);
                if (p.spectrogramDbHistory.length > maxHistory) {
                    p.spectrogramDbHistory.shift();
                }
            }
        }
    }

    // NUEVO: Dibujar capas adicionales (no-live) de este cuadrante
    const LAYER_DASHES = [
        [],           // Capa 1: Sólido
        [8, 4],       // Capa 2: Discontinuo largo
        [2, 3],       // Capa 3: Puntos
        [6, 3, 2, 3], // Capa 4: Trazo-punto
    ];
    const METRIC_COLORS: Record<string, string> = {
        "Spectrum": "#a855f7",
        "Magnitude": "#ff4444",
        "Phase": "#d946ef",
        "Coherence": "#eab308",
        "Group Delay": "#10b981",
        "Impulse": "#3b82f6",
        "Step": "#f97316",
    };

    for (let li = 0; li < p.myLayers.length; li++) {
        const layer = p.myLayers[li];
        if (layer.isMeasuring) continue; // La capa live se dibuja aparte con el pipeline principal
        if (layer.data.length === 0) continue;

        const dashPattern = LAYER_DASHES[li % LAYER_DASHES.length];
        const isActive = layer.id === uiStore.activeLayerId;
        const lineWidth = isActive ? 1.8 : 1;
        let alpha = isActive ? 1.0 : 0.75;

        // Determinar la métrica principal para el color
        const metricForColor = p.activeMetrics[0] || 'Magnitude';
        const color = METRIC_COLORS[metricForColor] || '#ff4444';

        // Estilo especial para capas calculadas
        if (layer.isCalculated) {
            alpha = 0.9;
            p.ctx.setLineDash([4, 2, 1, 2]); // Trazo distintivo
        }

        p.ctx.globalAlpha = alpha;
        drawMetricPath(
            p.ctx, layer.data, p.width, p.height,
            color, lineWidth, layer.isCalculated ? [4, 2, 1, 2] : dashPattern,
            metricForColor, p.frequencyLUT, p.interpEngine.interpCoherence,
            p.metricConfigs, p.interactionState, p.getPPOSmoothedValue, p.sampleRate
        );
        p.ctx.globalAlpha = 1.0;
        if (layer.isCalculated) {
            p.ctx.setLineDash([]);
        }
    }

    // 3. Renderizar las curvas de todas las capas de medición de este cuadrante (Prompt 6)
    // Check if any metric needs coherence masking
    const needsCoherenceMask = !p.hasTimeDomainActive && p.activeMetrics.some(m => {
        const cfg = p.metricConfigs[m];
        return cfg?.enableCoherence && m !== "Coherence";
    });

    // If coherence masking is needed, prepare an offscreen canvas for masked metrics
    let maskCanvas: HTMLCanvasElement | null = null;
    let maskCtx: CanvasRenderingContext2D | null = null;

    if (needsCoherenceMask) {
        maskCanvas = document.createElement('canvas');
        maskCanvas.width = p.width;
        maskCanvas.height = p.height;
        maskCtx = maskCanvas.getContext('2d');
    }


    p.quadrantLayers.forEach((layer, index) => {
        if (!layer.visible) return;
        if (!layer.isMeasuring) return; // La capa no-live ya se dibuja en el bloque anterior

        // Determinar estilos visuales basados en la posición de la capa
        const isActive = layer.id === uiStore.activeLayerId;
        const isLive = layer.isMeasuring;
        const op = isActive ? 1.0 : 0.75;
        
        // Estilo de línea según capa:
        // - Capa live activa: usa metricStyles del usuario
        // - Capas secundarias: dash por índice + lineWidth fijo
        let layerLineDash: number[] = [];
        let layerLineWidth = isActive ? 1.8 : 1;
        if (!isActive) {
            if (index === 1) layerLineDash = [8, 4];
            else if (index === 2) layerLineDash = [2, 3];
            else layerLineDash = [6, 3, 2, 3];
        }

        // Para cada métrica activa en este cuadrante, dibujamos los datos de la capa
        p.activeMetrics.forEach((metric) => {
            if (p.metricConfigs[metric]?.hidden) return;
            if (p.hasTimeDomainActive && !["Impulse", "Step"].includes(metric)) return;
            if (!p.hasTimeDomainActive && ["Impulse", "Step"].includes(metric)) return;

            // Skip Coherence line if showLine is false
            if (metric === "Coherence" && p.metricConfigs["Coherence"]?.showLine === false) return;

            // Per-metric context: metrics with enableCoherence → offscreen, others → main canvas
            const metricCfg = p.metricConfigs[metric];
            const metricNeedsMask = needsCoherenceMask && maskCtx && metricCfg?.enableCoherence && metric !== "Coherence";
            const ctx = metricNeedsMask ? maskCtx! : p.ctx;

            // Aplicar Hover Focus y Solo Mode (Prompt 11)
            ctx.globalAlpha = op * p.getMetricAlpha(metric);

            // Color y estilos: metricStyles del usuario para capa activa, sistema de capas para secundarias
            const mStyle = p.metricStyles[metric];
            const color = mStyle?.color || METRIC_COLORS[metric] || '#ff4444';
            const lw = (isActive && mStyle) ? mStyle.lineWidth : layerLineWidth;
            const lineDash = (isActive && mStyle) ? mStyle.lineDash : layerLineDash;

            // Spectrum usa drawSpectrumPath (lógica especial: liveData, bins, offset +68)
            if (metric === "Spectrum") {
                drawSpectrumPath(
                    ctx,
                    isLive ? p.liveData : null,
                    p.width,
                    p.height,
                    color,
                    lw,
                    lineDash,
                    p.frequencyLUT,
                    p.interpEngine.interpCoherence,
                    isLive ? p.smoothedSpectrum : layer.data as unknown as Float32Array,
                    p.metricConfigs,
                    p.interactionState,
                    p.getPPOSmoothedValue,
                    p.BINS,
                    p.sampleRate
                );
                return;
            }

            if (metric === "Magnitude" || metric === "Coherence" || metric === "Group Delay") {
                let bufferToDraw = layer.data;
                // Magnitude is pre-smoothed in Quadrant.svelte → noop PPO to avoid double smoothing
                // Coherence/GroupDelay are raw → use real PPO
                let ppoFn = p.getPPOSmoothedValue;

                if (isLive) {
                    if (metric === "Magnitude") {
                        bufferToDraw = p.smoothedMagnitude;
                        ppoFn = (idx: number, arr: Float32Array) => arr[idx];
                    } else if (metric === "Coherence") {
                        bufferToDraw = p.interpEngine.interpCoherence;
                    } else if (metric === "Group Delay") {
                        bufferToDraw = p.interpEngine.interpGroupDelay;
                    }
                }

                drawMetricPath(
                    ctx,
                    bufferToDraw,
                    p.width,
                    p.height,
                    color,
                    lw,
                    lineDash,
                    metric,
                    p.frequencyLUT,
                    p.interpEngine.interpCoherence,
                    p.metricConfigs,
                    p.interactionState,
                    ppoFn,
                    p.sampleRate
                );
            }

            if (metric === "Simulated Magnitude") {
                const rawBuffer = isLive ? p.smoothedMagnitude : layer.data;
                // smoothedMagnitude is pre-smoothed → noop PPO for live
                const simPpoFn = isLive
                    ? (idx: number, arr: Float32Array) => arr[idx]
                    : p.getPPOSmoothedValue;
                drawSimulatedMagnitudePath(
                    ctx,
                    p.width,
                    p.height,
                    { color, lineWidth: lw, lineDash },
                    p.frequencyLUT,
                    p.interpEngine.interpCoherence,
                    rawBuffer,
                    p.metricConfigs,
                    p.interactionState,
                    simPpoFn,
                    p.getEQResponseCached,
                    p.BINS,
                    p.sampleRate
                );
            }

            if (metric === "Phase") {
                const rawBuffer = isLive ? p.interpEngine.interpPhase : layer.data;
                drawPhasePath(
                    ctx,
                    p.width,
                    p.height,
                    { color, lineWidth: lw, lineDash },
                    p.frequencyLUT,
                    rawBuffer,
                    p.metricConfigs,
                    p.interactionState,
                    p.interpEngine.interpCoherence
                );
            }
        });

        p.ctx.globalAlpha = 1.0; // Restablecer opacidad
    });


    // Apply coherence mask and composite back to main canvas
    if (needsCoherenceMask && maskCtx && maskCanvas) {
        // Find the first metric with enableCoherence to get its config
        const cohMetric = p.activeMetrics.find(m => p.metricConfigs[m]?.enableCoherence && m !== "Coherence");
        if (cohMetric) {
            const cfg = p.metricConfigs[cohMetric]!;
            applyCoherenceMask(
                maskCtx,
                p.width,
                p.height,
                p.interpEngine.interpCoherence,
                cfg.coherenceThreshold ?? 0.2,
                cfg.coherenceMode || 'attenuate',
                cfg.coherenceColor || '#666666',
                p.interactionState,
                p.sampleRate
            );
        }
        // Composite the masked result onto the main canvas
        p.ctx.drawImage(maskCanvas, 0, 0);
    }


    // 3.5. Renderizar curvas de las Instantáneas globales que estén visibles (Prompt 8)
    p.instantaneas.forEach((snap) => {
        if (!snap.visible) return;

        // Estilo para instantáneas en segundo plano: delgadas y discontinuas
        const lw = 1.3;
        const op = 0.75;
        p.ctx.globalAlpha = op;

        p.activeMetrics.forEach((metric) => {
            if (p.metricConfigs[metric]?.hidden) return;
            if (p.hasTimeDomainActive && !["Impulse", "Step"].includes(metric)) return;
            if (!p.hasTimeDomainActive && ["Impulse", "Step"].includes(metric)) return;

            // Aplicar Hover Focus y Solo Mode (Prompt 11) en instantáneas
            p.ctx.globalAlpha = op * p.getMetricAlpha(metric);

            // Color reservado para la métrica
            const color = p.metricStyles[metric]?.color || METRIC_COLORS[metric] || '#ff4444';

            // Extraer el buffer específico de esta métrica desde la instantánea multimétrica
            const bufferToDraw = snap.data[metric];

            if (bufferToDraw && bufferToDraw.length > 0) {
                if (metric === "Phase") {
                    drawPhasePath(
                        p.ctx,
                        p.width,
                        p.height,
                        { color, lineWidth: lw, lineDash: [6, 4] },
                        p.frequencyLUT,
                        bufferToDraw,
                        p.metricConfigs,
                        p.interactionState,
                        p.interpEngine.interpCoherence
                    );
                } else if (metric === "Simulated Magnitude") {
                    drawSimulatedMagnitudePath(
                        p.ctx,
                        p.width,
                        p.height,
                        { color, lineWidth: lw, lineDash: [6, 4] },
                        p.frequencyLUT,
                        p.interpEngine.interpCoherence,
                        bufferToDraw,
                        p.metricConfigs,
                        p.interactionState,
                        (idx: number, arr: Float32Array) => arr[idx],
                        p.getEQResponseCached,
                        p.BINS,
                        p.sampleRate
                    );
                } else {
                    drawMetricPath(
                        p.ctx,
                        bufferToDraw,
                        p.width,
                        p.height,
                        color,
                        lw,
                        [6, 4],
                        metric,
                        p.frequencyLUT,
                        p.interpEngine.interpCoherence,
                        p.metricConfigs,
                        p.interactionState,
                        (idx: number, arr: Float32Array) => arr[idx],
                        p.sampleRate
                    );
                }
            }
        });

        p.ctx.globalAlpha = 1.0;
    });


    // Bloques standalone para métricas que NO están en el layer loop

    if (p.activeMetrics.includes("Impulse") && p.hasTimeDomainActive) {
        const style = p.metricStyles["Impulse"];
        drawTimeDomainPath(
            p.ctx,
            p.interpEngine.interpImpulse,
            p.width,
            p.height,
            style.color,
            style.lineWidth,
            style.lineDash,
            "Impulse",
            p.interactionState,
            p.getImpulseValueInterpolated,
            p.hasTimeDomainActive,
            p.metricConfigs
        );
    }

    if (p.activeMetrics.includes("Step") && p.hasTimeDomainActive) {
        const style = p.metricStyles["Step"];
        drawTimeDomainPath(
            p.ctx,
            p.interpEngine.interpStep,
            p.width,
            p.height,
            style.color,
            style.lineWidth,
            style.lineDash,
            "Step",
            p.interactionState,
            p.getImpulseValueInterpolated,
            p.hasTimeDomainActive,
            p.metricConfigs
        );
    }

    if (p.activeMetrics.includes("Scope") && p.hasTimeDomainActive) {
        drawScope(p.ctx, p.interpEngine.interpImpulse, p.width, p.height, "#00ff00", 2);
    }

    if (p.activeMetrics.includes("Nyquist") && !p.hasTimeDomainActive) {
        drawNyquistPath(p.ctx, p.hReal, p.hImag, p.width, p.height, "#ffffff", 2);
    }

    if (p.activeMetrics.includes("Phase Delay") && !p.hasTimeDomainActive) {
        drawPhaseDelay(
            p.ctx,
            p.interpEngine.interpPhase,
            p.width,
            p.height,
            '#06b6d4',
            1.5,
            p.frequencyLUT,
            p.metricConfigs,
            p.interactionState,
            p.BINS,
            p.sampleRate
        );
    }

    if (p.activeMetrics.includes("Crest Factor") && !p.hasTimeDomainActive) {
        drawCrestFactor(
            p.ctx,
            p.outputCrestFactor,
            p.width,
            p.height,
            p.frequencyLUT,
            p.interactionState,
            "#60a5fa"
        );
    }

    // Draw Target Trace overlay if active (Prompt 10)
    drawTargetTrace(p.ctx, p.width, p.height, p.targetTrace, p.interactionState, p.hasTimeDomainActive);

    if (p.showEQOverlay && p.eqBands.length > 0) {
        drawEQOverlayPath(
            p.ctx, p.width, p.height,
            { color: '#fbbf24', lineWidth: 2, lineDash: [] },
            p.metricConfigs, p.interactionState,
            p.getEQResponseCached,
            p.BINS,
            p.sampleRate
        );

        // Dibujar nodos de filtros
        const bands = p.eqBands;
        for (let i = 0; i < bands.length; i++) {
            const band = bands[i];
            const x = valToX(band.freq, p.containerWidth, false, p.interactionState);
            const gain = p.getEQResponseCached(band.freq);
            const y = valToY(gain, p.containerHeight, "Magnitude", p.metricConfigs, p.interactionState);

            const isHovered = p.hoveringEQNode === i;
            const isDragging = p.draggingEQNode === i;
            const radius = isDragging ? 8 : isHovered ? 7 : 5;

            p.ctx.shadowColor = '#fbbf24';
            p.ctx.shadowBlur = isDragging ? 12 : isHovered ? 8 : 0;

            p.ctx.beginPath();
            p.ctx.arc(x, y, radius, 0, Math.PI * 2);
            p.ctx.fillStyle = isDragging ? '#fbbf24' : isHovered ? '#fcd34d' : '#f59e0b';
            p.ctx.fill();
            p.ctx.strokeStyle = '#ffffff';
            p.ctx.lineWidth = 1.5;
            p.ctx.stroke();
            p.ctx.shadowBlur = 0;

            if (isHovered || isDragging) {
                p.ctx.font = '10px monospace';
                p.ctx.fillStyle = '#fbbf24';
                p.ctx.textAlign = 'center';
                p.ctx.fillText(
                    `${band.freq >= 1000 ? (band.freq/1000).toFixed(1)+'k' : band.freq}Hz`,
                    x, y - radius - 12
                );
                p.ctx.fillText(
                    `${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)}dB`,
                    x, y - radius - 2
                );
            }
        }
    }

    // 4. Overlays Especiales
    if (p.activeMetrics.includes("Level")) {
        drawLevelOverlay(p.ctx, p.width, p.height, p.meterStore);
    }

    // 5. Overlays Numéricos
    if (p.activeMetrics.includes("Numeric")) {
        drawNumericOverlay(p.ctx, p.width, p.height, p.meterStore, p.hasTimeDomainActive);
    }

    // 6. Retícula Crosshair Interactiva
    if (p.interactionState.showCrosshair) {
        drawCrosshair(
            p.ctx,
            p.width,
            p.height,
            p.interactionState,
            p.hasTimeDomainActive,
            p.activeMetrics,
            p.interpEngine.interpMagnitude,
            p.interpEngine.interpPhase,
            p.interpEngine.interpCoherence,
            p.interpEngine.interpImpulse,
            p.interpEngine.interpStep,
            p.spectrogramDbHistory,
            p.liveData,
            p.getMetricValueInterpolated,
            p.getImpulseValueInterpolated
        );
    }
}
