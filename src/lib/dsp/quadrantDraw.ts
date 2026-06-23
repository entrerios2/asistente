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
    drawEQOverlayPath,
    drawEQPhaseOverlayPath,
    drawIndividualFilterCurve
} from './canvasRenderers';
import { getCoeffsForType } from './biquad';
import { filterTypeColors, filterTypeName, drawFilterIcon } from './eqNodeIcons';
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

// Cached offscreen canvas for coherence masking (reused across frames)
let _maskCanvas: HTMLCanvasElement | null = null;
let _maskCtx: CanvasRenderingContext2D | null = null;

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
    getEQPhaseCached: (freq: number) => number;

    // Capas y snapshots
    myLayers: MeasurementLayer[];
    quadrantLayers: MeasurementLayer[];
    instantaneas: Instantanea[];

    // EQ overlay
    showEQOverlay: boolean;
    eqBands: { freq: number; gain: number; q: number; type: string }[];
    hoveringEQNode: number | null;
    draggingEQNode: number | null;
    selectedEQNode: number | null;

    // EQ score badge
    eqScoreBadge: {
        before: { rms: number; peak: number; percentWithin3dB: number; percentWithin6dB: number; meanDeviation: number };
        after: { rms: number; peak: number; percentWithin3dB: number; percentWithin6dB: number; meanDeviation: number };
    } | null;
    eqScoreHover: boolean;

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

        const dashPattern = LAYER_DASHES[li % LAYER_DASHES.length];
        const isActive = layer.id === uiStore.activeLayerId;
        const lineWidth = isActive ? 1.8 : 1;
        let alpha = isActive ? 1.0 : 0.75;

        // Estilo especial para capas calculadas
        if (layer.isCalculated) {
            alpha = 0.9;
        }

        // Fase 2d: Capas snapshot con multiMetricData — dibujar cada métrica activa
        if (layer.sourceType === 'snapshot' && layer.multiMetricData) {
            // Obtener offsetY de la instantánea origen
            const snapOrigin = layer.instantaneaId
                ? p.instantaneas.find((s: any) => s.id === layer.instantaneaId)
                : null;
            const offsetY = snapOrigin?.offsetY || 0;
            const snapColor = layer.color || '#888';
            const snapDash = layer.dashPattern || dashPattern;

            p.activeMetrics.forEach((metric) => {
                if (p.metricConfigs[metric]?.hidden) return;
                if (p.hasTimeDomainActive && !["Impulse", "Step"].includes(metric)) return;
                if (!p.hasTimeDomainActive && ["Impulse", "Step"].includes(metric)) return;
                if (metric === "Coherence" && p.metricConfigs["Coherence"]?.showLine === false) return;

                const bufferToDraw = layer.multiMetricData![metric];
                if (!bufferToDraw || bufferToDraw.length === 0) return;

                p.ctx.globalAlpha = alpha * p.getMetricAlpha(metric);

                // Aplicar offsetY: crear buffer ajustado si hay offset
                let adjustedBuffer = bufferToDraw;
                if (offsetY !== 0 && metric !== "Phase" && metric !== "Coherence") {
                    adjustedBuffer = new Float32Array(bufferToDraw.length);
                    for (let i = 0; i < bufferToDraw.length; i++) {
                        adjustedBuffer[i] = bufferToDraw[i] + offsetY;
                    }
                }

                if (metric === "Phase") {
                    drawPhasePath(
                        p.ctx, p.width, p.height,
                        { color: snapColor, lineWidth, lineDash: snapDash },
                        p.frequencyLUT, adjustedBuffer, p.metricConfigs,
                        p.interactionState, p.interpEngine.interpCoherence
                    );
                } else if (metric === "Simulated Magnitude") {
                    drawSimulatedMagnitudePath(
                        p.ctx, p.width, p.height,
                        { color: snapColor, lineWidth, lineDash: snapDash },
                        p.frequencyLUT, p.interpEngine.interpCoherence,
                        adjustedBuffer, p.metricConfigs, p.interactionState,
                        (idx: number, arr: Float32Array) => arr[idx],
                        p.getEQResponseCached, p.BINS, p.sampleRate
                    );
                } else {
                    drawMetricPath(
                        p.ctx, adjustedBuffer, p.width, p.height,
                        snapColor, lineWidth, snapDash, metric,
                        p.frequencyLUT, p.interpEngine.interpCoherence,
                        p.metricConfigs, p.interactionState,
                        (idx: number, arr: Float32Array) => arr[idx],
                        p.sampleRate
                    );
                }
            });

            p.ctx.globalAlpha = 1.0;
            continue; // Ya dibujamos todas las métricas, no caer al drawMetricPath genérico
        }

        // Capas no-live sin multiMetricData (calculated, etc.)
        if (layer.data.length === 0) continue;

        const metricForColor = p.activeMetrics[0] || 'Magnitude';
        const color = METRIC_COLORS[metricForColor] || '#ff4444';

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
    // Cached at module level to avoid creating a new canvas element every frame
    if (needsCoherenceMask) {
        if (!_maskCanvas) {
            _maskCanvas = document.createElement('canvas');
        }
        if (_maskCanvas.width !== Math.round(p.width) || _maskCanvas.height !== Math.round(p.height)) {
            _maskCanvas.width = Math.round(p.width);
            _maskCanvas.height = Math.round(p.height);
            _maskCtx = _maskCanvas.getContext('2d');
        }
        // Clear previous frame's content
        if (_maskCtx) {
            _maskCtx.clearRect(0, 0, _maskCanvas.width, _maskCanvas.height);
        }
    }
    const maskCanvas = needsCoherenceMask ? _maskCanvas : null;
    const maskCtx = needsCoherenceMask ? _maskCtx : null;

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
        // Precompute biquad coefficients for analytical curve evaluation
        const bandCoeffs: number[][] = [];
        for (const band of p.eqBands) {
            if (band.gain !== 0 || ['lowpass', 'highpass', 'notch', 'bandpass'].includes(band.type)) {
                bandCoeffs.push(getCoeffsForType(band.type, band.freq, band.gain, band.q, p.sampleRate));
            }
        }

        drawEQOverlayPath(
            p.ctx, p.width, p.height,
            { color: '#fbbf24', lineWidth: 2, lineDash: [] },
            p.metricConfigs, p.interactionState,
            p.getEQResponseCached,
            p.BINS,
            p.sampleRate,
            bandCoeffs
        );

        // B3: Draw EQ phase overlay when Phase metric is visible
        if (p.activeMetrics.includes('Phase')) {
            drawEQPhaseOverlayPath(
                p.ctx, p.width, p.height,
                p.metricConfigs, p.interactionState,
                p.getEQPhaseCached,
                p.BINS,
                p.sampleRate
            );
        }

        // P1b: Ghost curve of active (hovered/dragged/selected) filter
        const bands = p.eqBands;
        const activeFilterIdx = p.draggingEQNode ?? p.hoveringEQNode ?? p.selectedEQNode;
        if (activeFilterIdx !== null && activeFilterIdx >= 0 && activeFilterIdx < bands.length) {
            const activeBand = bands[activeFilterIdx];
            const activeColor = filterTypeColors[activeBand.type] || '#fbbf24';
            const coeffs = getCoeffsForType(activeBand.type, activeBand.freq, activeBand.gain, activeBand.q, p.sampleRate);
            drawIndividualFilterCurve(
                p.ctx, p.width, p.height, coeffs, activeColor,
                p.metricConfigs, p.interactionState, p.BINS, p.sampleRate
            );
        }

        // P6a: Drag guides — 0dB line + vertical freq line
        if (p.draggingEQNode !== null && p.draggingEQNode >= 0 && p.draggingEQNode < bands.length) {
            const dragBand = bands[p.draggingEQNode];
            // 0dB horizontal reference
            const zeroY = valToY(0, p.containerHeight, "Magnitude", p.metricConfigs, p.interactionState);
            p.ctx.setLineDash([4, 4]);
            p.ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            p.ctx.lineWidth = 1;
            p.ctx.beginPath();
            p.ctx.moveTo(0, zeroY);
            p.ctx.lineTo(p.width, zeroY);
            p.ctx.stroke();

            // Vertical freq line
            const dragX = valToX(dragBand.freq, p.containerWidth, false, p.interactionState);
            p.ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            p.ctx.beginPath();
            p.ctx.moveTo(dragX, 0);
            p.ctx.lineTo(dragX, p.height);
            p.ctx.stroke();
            p.ctx.setLineDash([]);
        }

        // P2c+P3a: Draw filter nodes with type color + icon + enriched tooltip
        for (let i = 0; i < bands.length; i++) {
            const band = bands[i];
            const color = filterTypeColors[band.type] || '#fbbf24';
            const x = valToX(band.freq, p.containerWidth, false, p.interactionState);
            // Fix: position node at band's individual gain, not total EQ response
            const y = valToY(band.gain, p.containerHeight, "Magnitude", p.metricConfigs, p.interactionState);

            const isHovered = p.hoveringEQNode === i;
            const isDragging = p.draggingEQNode === i;
            const isActive = isHovered || isDragging;
            const radius = isDragging ? 18 : isHovered ? 15 : 11;

            // Glow
            if (isActive) {
                p.ctx.shadowColor = color;
                p.ctx.shadowBlur = isDragging ? 14 : 10;
            }

            // Circle background
            p.ctx.beginPath();
            p.ctx.arc(x, y, radius, 0, Math.PI * 2);
            p.ctx.fillStyle = isActive ? color : `${color}cc`;
            p.ctx.fill();
            p.ctx.strokeStyle = '#ffffff';
            p.ctx.lineWidth = isActive ? 2 : 1.5;
            p.ctx.stroke();
            p.ctx.shadowBlur = 0;

            // Draw type icon inside the node
            drawFilterIcon(p.ctx, x, y, radius, band.type, '#ffffff');

            // P3a: Enriched tooltip on hover/drag
            if (isActive) {
                const typeName = filterTypeName(band.type);
                const freqLabel = band.freq >= 1000 ? `${(band.freq/1000).toFixed(1)}k` : `${band.freq}`;
                const gainLabel = `${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)}dB`;
                const qLabel = `Q: ${band.q.toFixed(1)}`;

                const line1 = `#${i + 1} ${typeName}`;
                const line2 = `${freqLabel}Hz  ${gainLabel}`;
                const line3 = qLabel;

                p.ctx.font = '600 9px system-ui, sans-serif';
                const w1 = p.ctx.measureText(line1).width;
                const w2 = p.ctx.measureText(line2).width;
                const w3 = p.ctx.measureText(line3).width;
                const maxW = Math.max(w1, w2, w3) + 16;
                const tooltipH = 42;

                // Position: above node, adaptive if near top
                let tooltipX = x - maxW / 2;
                let tooltipY = y - radius - tooltipH - 6;
                if (tooltipY < 4) tooltipY = y + radius + 6;
                if (tooltipX < 2) tooltipX = 2;
                if (tooltipX + maxW > p.width - 2) tooltipX = p.width - maxW - 2;

                // Background
                p.ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
                const r2 = 4;
                p.ctx.beginPath();
                p.ctx.moveTo(tooltipX + r2, tooltipY);
                p.ctx.lineTo(tooltipX + maxW - r2, tooltipY);
                p.ctx.quadraticCurveTo(tooltipX + maxW, tooltipY, tooltipX + maxW, tooltipY + r2);
                p.ctx.lineTo(tooltipX + maxW, tooltipY + tooltipH - r2);
                p.ctx.quadraticCurveTo(tooltipX + maxW, tooltipY + tooltipH, tooltipX + maxW - r2, tooltipY + tooltipH);
                p.ctx.lineTo(tooltipX + r2, tooltipY + tooltipH);
                p.ctx.quadraticCurveTo(tooltipX, tooltipY + tooltipH, tooltipX, tooltipY + tooltipH - r2);
                p.ctx.lineTo(tooltipX, tooltipY + r2);
                p.ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + r2, tooltipY);
                p.ctx.closePath();
                p.ctx.fill();
                p.ctx.strokeStyle = `${color}40`;
                p.ctx.lineWidth = 1;
                p.ctx.stroke();

                // Text
                p.ctx.textAlign = 'left';
                p.ctx.fillStyle = color;
                p.ctx.font = '600 9px system-ui, sans-serif';
                p.ctx.fillText(line1, tooltipX + 8, tooltipY + 13);
                p.ctx.fillStyle = '#e0e0e0';
                p.ctx.font = '9px system-ui, sans-serif';
                p.ctx.fillText(line2, tooltipX + 8, tooltipY + 25);
                p.ctx.fillStyle = '#999';
                p.ctx.fillText(line3, tooltipX + 8, tooltipY + 37);
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

    // 5b. EQ Score Badge (bottom-left corner when EQ overlay active)
    if (p.showEQOverlay && p.eqScoreBadge && p.eqBands.length > 0) {
        drawEQScoreBadge(p.ctx, p.eqScoreBadge, p.eqScoreHover);
    }

    // 6. Retícula Crosshair Interactiva (suppressed when interacting with EQ nodes)
    if (p.interactionState.showCrosshair && p.hoveringEQNode === null && p.draggingEQNode === null) {
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

// ── EQ Score Badge ──────────────────────────────────────────────
// Badge position constants
export const EQ_BADGE_X = 8;
export const EQ_BADGE_Y_OFFSET = 40; // from bottom
export const EQ_BADGE_W_COMPACT = 90;
export const EQ_BADGE_H_COMPACT = 24;
export const EQ_BADGE_W_EXPANDED = 170;
export const EQ_BADGE_H_EXPANDED = 120;

type ScoreData = {
    before: { rms: number; peak: number; percentWithin3dB: number; percentWithin6dB: number; meanDeviation: number };
    after: { rms: number; peak: number; percentWithin3dB: number; percentWithin6dB: number; meanDeviation: number };
};

function rmsColor(rms: number): string {
    return rms > 5 ? '#ff4444' : rms > 2 ? '#fbbf24' : '#00ff88';
}

function drawEQScoreBadge(
    ctx: CanvasRenderingContext2D,
    score: ScoreData,
    expanded: boolean
): void {
    const x = EQ_BADGE_X;
    const y = ctx.canvas.height - EQ_BADGE_Y_OFFSET;

    ctx.save();

    if (!expanded) {
        // ── Compact badge ──
        const w = EQ_BADGE_W_COMPACT;
        const h = EQ_BADGE_H_COMPACT;
        const bx = x;
        const by = y - h;

        // Background
        ctx.fillStyle = 'rgba(10, 10, 16, 0.85)';
        ctx.beginPath();
        ctx.roundRect(bx, by, w, h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // RMS value
        const rmsVal = score.after.rms;
        const color = rmsColor(rmsVal);

        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('RMS', bx + 6, by + h / 2);

        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(`${rmsVal.toFixed(1)}`, bx + 34, by + h / 2);

        ctx.font = '9px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText('dB', bx + 62, by + h / 2);

        // Improvement arrow
        if (score.before.rms !== score.after.rms) {
            const improved = score.after.rms < score.before.rms;
            ctx.fillStyle = improved ? '#00ff88' : '#ff4444';
            ctx.font = '11px system-ui, sans-serif';
            ctx.fillText(improved ? '↓' : '↑', bx + w - 14, by + h / 2);
        }
    } else {
        // ── Expanded badge ──
        const w = EQ_BADGE_W_EXPANDED;
        const h = EQ_BADGE_H_EXPANDED;
        const bx = x;
        const by = y - h;

        // Background
        ctx.fillStyle = 'rgba(10, 10, 16, 0.92)';
        ctx.beginPath();
        ctx.roundRect(bx, by, w, h, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Header
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Evaluación EQ', bx + 8, by + 6);

        // Column headers
        const colMetric = bx + 8;
        const colBefore = bx + 70;
        const colAfter = bx + 110;
        const colArrow = bx + 150;
        let rowY = by + 22;
        const rowH = 16;

        ctx.font = '8px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText('Métrica', colMetric, rowY);
        ctx.textAlign = 'right';
        ctx.fillText('Antes', colBefore + 20, rowY);
        ctx.fillText('Después', colAfter + 20, rowY);
        ctx.textAlign = 'left';
        rowY += rowH;

        // Separator
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.moveTo(bx + 6, rowY - 4);
        ctx.lineTo(bx + w - 6, rowY - 4);
        ctx.stroke();

        // Rows
        const rows: [string, number, number, boolean][] = [
            ['RMS (dB)', score.before.rms, score.after.rms, true],
            ['Peak (dB)', score.before.peak, score.after.peak, true],
            ['±3dB (%)', score.before.percentWithin3dB, score.after.percentWithin3dB, false],
            ['±6dB (%)', score.before.percentWithin6dB, score.after.percentWithin6dB, false],
            ['Bias (dB)', Math.abs(score.before.meanDeviation), Math.abs(score.after.meanDeviation), true],
        ];

        ctx.font = '9px system-ui, sans-serif';
        for (const [label, before, after, lowerIsBetter] of rows) {
            // Metric name
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText(label, colMetric, rowY);

            // Before value
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            const bStr = label.includes('%') ? `${before.toFixed(0)}%` : before.toFixed(1);
            ctx.fillText(bStr, colBefore + 20, rowY);

            // After value (colored)
            const afterColor = rmsColor(after);
            ctx.fillStyle = label.includes('%')
                ? (after > 80 ? '#00ff88' : after > 50 ? '#fbbf24' : '#ff4444')
                : afterColor;
            const aStr = label.includes('%') ? `${after.toFixed(0)}%` : after.toFixed(1);
            ctx.fillText(aStr, colAfter + 20, rowY);

            // Arrow
            const improved = lowerIsBetter ? after < before : after > before;
            const worsened = lowerIsBetter ? after > before : after < before;
            if (improved || worsened) {
                ctx.fillStyle = improved ? '#00ff88' : '#ff4444';
                ctx.textAlign = 'left';
                ctx.fillText(improved ? (lowerIsBetter ? '↓' : '↑') : (lowerIsBetter ? '↑' : '↓'), colArrow, rowY);
            }

            rowY += rowH;
        }
    }

    ctx.restore();
}
