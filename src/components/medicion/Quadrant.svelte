<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { meterStore } from "$lib/stores/meterStore.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";

    import { targetTrace } from "$lib/stores/targetTrace.svelte";
    import { palettes, type PaletteType } from "$lib/dsp/colorPalettes";
    import { allMetrics, defaultMetricStyles, defaultMetricConfigs } from "$lib/dsp/quadrantState";

    import ZoomControls from "./ZoomControls.svelte";
    import GlobalConfigPopover from "./GlobalConfigPopover.svelte";
    import MetricConfigPopover from "./MetricConfigPopover.svelte";
    import AddMetricDropdown from "./AddMetricDropdown.svelte";
    import LayerPanel from "./LayerPanel.svelte";

    import { InterpolationEngine } from "$lib/dsp/interpolationEngine";
    import {
        handleWheel as interactionHandleWheel,
        handleMouseMove as interactionHandleMouseMove,
        handleMouseDown as interactionHandleMouseDown,
        handleMouseUp as interactionHandleMouseUp,
        handleTouchStart as interactionHandleTouchStart,
        handleTouchMove as interactionHandleTouchMove,
        handleTouchEnd as interactionHandleTouchEnd,
        handleDoubleClick as interactionHandleDoubleClick,
        rebuildFrequencyLUT,
        freqMin,
        freqMax,
        valToX,
        valToY,
        xToVal,
        yToVal,
        type InteractionState
    } from "$lib/dsp/canvasInteraction";

    import {
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
    } from "$lib/dsp/canvasRenderers";


    interface Props {
        id: string;
    }

    let { id }: Props = $props();

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    let settingsBtn: HTMLButtonElement;

    // Lista de métricas activas
    let activeMetrics = $state<string[]>(["Magnitude"]);
    $effect(() => {
        const req = uiStore.simulatedMagnitudeRequest;
        if (req > 0) {
            untrack(() => {
                if (!activeMetrics.includes("Simulated Magnitude")) {
                    activeMetrics = [...activeMetrics, "Simulated Magnitude"];
                }
            });
        }
    });
    let showEQOverlay = $state(false);
    let draggingEQNode = $state<number | null>(null);
    let hoveringEQNode = $state<number | null>(null);
    let smoothing = $state(1 / 48);
    let showSelector = $state(false);

    let metricStyles = $state<Record<string, { color: string, lineWidth: number, lineDash: number[] }>>(
        JSON.parse(JSON.stringify(defaultMetricStyles))
    );

    let activeConfigMetric = $state<string | null>(null);
    let metricConfigs = $state<Record<string, any>>(
        JSON.parse(JSON.stringify(defaultMetricConfigs))
    );

    let frequencyLUT = $state<Int32Array>(new Int32Array(0));
    let hoverMetric = $state<string | null>(null);
    let soloMetric = $state<string | null>(null);

    // Dimensiones reactivas del contenedor físico
    let containerWidth = $state(0);
    let containerHeight = $state(0);

    let cursorStyle = $derived.by(() => {
        if (draggingEQNode !== null) return 'grabbing';
        if (hoveringEQNode !== null) return 'grab';
        if (interactionState.isDragging) return 'grabbing';
        const mX = interactionState.mouseX;
        const mY = interactionState.mouseY;
        if (mX <= 45) return 'ns-resize';
        if (mY >= containerHeight - 25) return 'ew-resize';
        return 'crosshair';
    });

    // Zoom & Pan state
    let interactionState = $state<InteractionState>({
        zoomX: 1,
        zoomY: 0.7,
        zoomMode: 'XY' as const,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        lastMouseX: 0,
        lastMouseY: 0,
        touchStartDist: 0,
        touchStartScaleX: 1,
        touchStartScaleY: 1,
        isPinching: false,
        mouseX: 0,
        mouseY: 0,
        showCrosshair: false
    });



    // Motor de interpolación
    const interpEngine = new InterpolationEngine();

    const quadrantLayers = $derived(traceManager.layers.filter(l => l.quadrantId === id));
    const myLayers = $derived(
        traceManager.layers.filter(l => l.quadrantId === id && l.visible)
    );

    // Visual coding: dash patterns por índice de capa
    const LAYER_DASHES: number[][] = [
        [],          // Capa 1: sólida
        [8, 4],      // Capa 2: guiones
        [2, 3],      // Capa 3: puntos
        [8, 3, 2, 3] // Capa 4: guión-punto
    ];

    // Visual coding: colores por tipo de métrica (derivados de allMetrics)
    const METRIC_COLORS: Record<string, string> = Object.fromEntries(
        allMetrics.map(m => [m.name, m.color])
    );

    $effect(() => {
        frequencyLUT = rebuildFrequencyLUT(containerWidth, interactionState, interpEngine.BINS, uiStore.sampleRate);
    });

    let localLastVersion = 0;

    // Control de recalculo y throttling
    let dirty = $state(true);
    
    // Puente reactivo de Svelte 5 para marcar dirty = true
    // Sincronización desde el panel lateral hacia el cuadrante
    // Sincronización bidireccional global ↔ local de Simulated Magnitude
    // Usamos untrack para evitar que el effect se re-dispare por su propia escritura
    $effect(() => {
        const isSimulatingGlobal = uiStore.isSimulating;
        untrack(() => {
            const hasPill = activeMetrics.includes("Simulated Magnitude");
            if (isSimulatingGlobal && !hasPill) {
                activeMetrics = [...activeMetrics, "Simulated Magnitude"];
            } else if (!isSimulatingGlobal && hasPill) {
                activeMetrics = activeMetrics.filter(m => m !== "Simulated Magnitude");
            }
        });
    });

    $effect(() => {
        // Observar cambios en variables que alteran el cálculo DSP completo
        activeMetrics.join(",");
        uiStore.isMeasuring;
        uiStore.isSimulating;
        dirty = true;
    });

    // Caché e historial del espectrograma optimizado
    const maxHistory = 100;
    let spectrogramFrameCount = 0;
    let offscreenCanvas: HTMLCanvasElement | null = null;
    let offscreenCtx: CanvasRenderingContext2D | null = null;

    // Precomputar LUT de colores en formato RGBA numérico para optimización extrema con ImageData
    const spectrogramLUT_RGBA = $derived.by(() => {
        const paletteName = metricConfigs["Spectrogram"]?.palette || "Magma";
        const paletteData = palettes[paletteName as PaletteType];
        const lut = new Uint8ClampedArray(256 * 3);
        if (paletteData) {
            lut.set(paletteData);
        }
        return lut;
    });

    const smoothedMagnitude = new Float32Array(interpEngine.BINS);
    const smoothedSpectrum = new Float32Array(interpEngine.BINS);
    let sharedImageData: ImageData | null = null;

    let spectrogramDbHistory = $state<Float32Array[]>([]);

    function initOffscreenCanvas() {
        if (typeof document === "undefined") return;
        offscreenCanvas = document.createElement("canvas");
        const w = Math.round(containerWidth) || 800;
        offscreenCanvas.width = w;
        offscreenCanvas.height = maxHistory;
        offscreenCtx = offscreenCanvas.getContext("2d");
        if (offscreenCtx) {
            offscreenCtx.fillStyle = "#000000";
            offscreenCtx.fillRect(0, 0, w, maxHistory);
            sharedImageData = offscreenCtx.createImageData(w, 1);
        } else {
            sharedImageData = null;
        }
        spectrogramDbHistory = [];
    }

    const BINS = interpEngine.BINS;

    // Ayudante de interpolación de frecuencia logarítmica para los buffers de bins
    function getMetricValueInterpolated(
        freq: number,
        dataArray: Float32Array,
    ): number {
        return interpEngine.getMetricValueInterpolated(freq, dataArray, uiStore.sampleRate);
    }

    // Ayudante de interpolación circular para el dominio del tiempo
    function getImpulseValueInterpolated(
        timeMs: number,
        impulseArray: Float32Array,
    ): number {
        return interpEngine.getImpulseValueInterpolated(timeMs, impulseArray, uiStore.sampleRate);
    }



    // Lógica reactiva derivada para exclusiones Cartesianas
    const hasTimeDomainActive = $derived(
        activeMetrics.includes("Impulse") || activeMetrics.includes("Step") || activeMetrics.includes("Scope"),
    );
    const hasFreqDomainActive = $derived(
        activeMetrics.some((m) =>
            [
                "Spectrum",
                "Magnitude",
                "Simulated Magnitude",
                "Phase",
                "Coherence",
                "Group Delay",
                "Spectrogram",
            ].includes(m),
        ),
    );

    function isMetricDisabled(name: string): boolean {
        if (
            [
                "Spectrum",
                "Magnitude",
                "Simulated Magnitude",
                "Phase",
                "Coherence",
                "Group Delay",
                "Spectrogram",
            ].includes(name)
        ) {
            if (hasTimeDomainActive) return true;
        }
        if (["Impulse", "Step"].includes(name)) {
            if (hasFreqDomainActive) return true;
        }
        return false;
    }

    function toggleMetric(name: string) {
        if (isMetricDisabled(name)) return;
        if (activeMetrics.includes(name)) {
            activeMetrics = activeMetrics.filter((m) => m !== name);
        } else {
            activeMetrics.push(name);
        }
    }

    function removeMetric(name: string) {
        activeMetrics = activeMetrics.filter((m) => m !== name);
    }

    function getPPOSmoothedValue(binIndex: number, dataArray: Float32Array, ppo: number): number {
        if (ppo >= 48) return dataArray[binIndex];
        
        const octaveFraction = 1 / ppo;
        const binWidth = (uiStore.sampleRate / 2) / BINS;
        const freq = binIndex * binWidth || 1e-6;
        
        const f_start = freq * Math.pow(2, -octaveFraction / 2);
        const f_end = freq * Math.pow(2, octaveFraction / 2);
        
        const k_start = Math.max(0, Math.round(f_start / binWidth));
        const k_end = Math.min(dataArray.length - 1, Math.round(f_end / binWidth));
        
        let sum = 0;
        let count = 0;
        for (let k = k_start; k <= k_end; k++) {
            sum += dataArray[k];
            count++;
        }
        return count > 0 ? sum / count : dataArray[binIndex];
    }



    // CORE DRAW ENGINE
    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        ctx.clearRect(0, 0, width, height);

        // Actualizar capas calculadas antes de dibujar
        traceManager.updateCalculatedLayers();

        // 1. Renderizado de Espectrograma 2D (Fondo)
        if (activeMetrics.includes("Spectrogram") && !hasTimeDomainActive) {
            drawSpectrogram(ctx, offscreenCanvas, width, height);
        }

        // 2. Dibujar Grilla de Fondo (encima)
        drawGrid(ctx, width, height, hasTimeDomainActive, activeMetrics, metricConfigs, interactionState, uiStore.isDarkMode);

        const liveData = traceManager.liveFrequencyData;

        const currentVersion = mathOrchestrator.version;
        if (currentVersion !== localLastVersion) {
            localLastVersion = currentVersion;
            interpEngine.updateHistory();
        }

        // Interpolación temporal a 60+ FPS (suaviza transiciones entre resultados del worker)
        interpEngine.interpolateBuffers(dirty, mathOrchestrator);
        if (dirty) {
            dirty = false;
        }


        // Pre-suavizar las curvas para esta animación a 60FPS (incluyendo las transiciones de interpolación)
        const magPPO = metricConfigs["Magnitude"]?.smoothingPPO || 48;
        if (activeMetrics.includes("Magnitude") && magPPO < 48) {
            for (let i = 0; i < BINS; i++) {
                smoothedMagnitude[i] = getPPOSmoothedValue(i, interpEngine.interpMagnitude, magPPO);
            }
        } else {
            smoothedMagnitude.set(interpEngine.interpMagnitude);
        }

        const specPPO = metricConfigs["Spectrum"]?.smoothingPPO || 48;
        const hasLive = liveData && liveData.length > 0;
        const rawSpec = hasLive ? liveData : interpEngine.interpMagnitude;
        if (activeMetrics.includes("Spectrum") && specPPO < 48) {
            for (let i = 0; i < BINS; i++) {
                smoothedSpectrum[i] = getPPOSmoothedValue(i, rawSpec, specPPO);
            }
        } else {
            smoothedSpectrum.set(rawSpec);
        }

        // Alimentar buffer de Espectrograma en vivo optimizado con offscreen canvas
        if (
            hasLive &&
            activeMetrics.includes("Spectrogram") &&
            !hasTimeDomainActive
        ) {
            spectrogramFrameCount++;
            if (spectrogramFrameCount % 3 === 0) {
                const w = Math.round(width) || 800;
                if (!offscreenCanvas || offscreenCanvas.width !== w) {
                    initOffscreenCanvas();
                }
                if (offscreenCtx && offscreenCanvas && sharedImageData) {
                    // Desplazar el espectrograma existente 1 píxel hacia arriba
                    offscreenCtx.drawImage(
                        offscreenCanvas,
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
                    const pixels = sharedImageData.data;
                    const data = liveData;
                    const yRow = maxHistory - 1;
                    const logMin = Math.log10(freqMin);
                    const logMax = Math.log10(freqMax);

                    const dbRow = new Float32Array(w);
                    for (let x = 0; x < w; x++) {
                        const logFreq = (x / w) * (logMax - logMin) + logMin;
                        const freq = Math.pow(10, logFreq);
                        const val = getMetricValueInterpolated(freq, data);
                        dbRow[x] = val;

                        const db = Math.max(-60, Math.min(15, val));
                        const norm = (db + 60) / 75;
                        const lutIdx = Math.max(
                            0,
                            Math.min(255, Math.floor(norm * 255)),
                        );

                        const rIdx = lutIdx * 3;
                        const pixelIdx = x * 4;
                        pixels[pixelIdx] = spectrogramLUT_RGBA[rIdx];
                        pixels[pixelIdx + 1] = spectrogramLUT_RGBA[rIdx + 1];
                        pixels[pixelIdx + 2] = spectrogramLUT_RGBA[rIdx + 2];
                        pixels[pixelIdx + 3] = 255; // Opacidad total
                    }

                    offscreenCtx.putImageData(sharedImageData, 0, yRow);

                    spectrogramDbHistory.push(dbRow);
                    if (spectrogramDbHistory.length > maxHistory) {
                        spectrogramDbHistory.shift();
                    }
                }
            }
        }

        // NUEVO: Dibujar capas adicionales (no-live) de este cuadrante
        for (let li = 0; li < myLayers.length; li++) {
            const layer = myLayers[li];
            if (layer.isMeasuring) continue; // La capa live se dibuja aparte con el pipeline principal
            if (layer.data.length === 0) continue;

            const dashPattern = LAYER_DASHES[li % LAYER_DASHES.length];
            const isActive = layer.id === uiStore.activeLayerId;
            const lineWidth = isActive ? 1.8 : 1;
            let alpha = isActive ? 1.0 : 0.75;

            // Determinar la métrica principal para el color
            const metricForColor = activeMetrics[0] || 'Magnitude';
            const color = METRIC_COLORS[metricForColor] || '#ff4444';

            // Estilo especial para capas calculadas
            if (layer.isCalculated) {
                alpha = 0.9;
                ctx.setLineDash([4, 2, 1, 2]); // Trazo distintivo
            }

            ctx.globalAlpha = alpha;
            drawMetricPath(
                ctx, layer.data, width, height,
                color, lineWidth, layer.isCalculated ? [4, 2, 1, 2] : dashPattern,
                metricForColor, frequencyLUT, interpEngine.interpCoherence,
                metricConfigs, interactionState, getPPOSmoothedValue, uiStore.sampleRate
            );
            ctx.globalAlpha = 1.0;
            if (layer.isCalculated) {
                ctx.setLineDash([]);
            }
        }

        // 3. Renderizar las curvas de todas las capas de medición de este cuadrante (Prompt 6)
        quadrantLayers.forEach((layer, index) => {
            if (!layer.visible) return;
            if (!layer.isMeasuring) return; // La capa no-live ya se dibuja en el bloque anterior

            // Determinar estilos visuales basados en la posición de la capa
            const isActive = layer.id === uiStore.activeLayerId;
            const lw = isActive ? 1.8 : 1;
            const op = isActive ? 1.0 : 0.75;
            
            // Estilo de línea (lineDash) según el índice de capa secundaria
            let lineDash: number[] = [];
            if (!isActive) {
                if (index === 1) lineDash = [8, 4]; // Capa 2 discontinua
                else if (index === 2) lineDash = [2, 3]; // Capa 3 punteada
                else lineDash = [6, 3, 2, 3]; // Capa 4+ alternada
            }

            ctx.globalAlpha = op;

            // Para cada métrica activa en este cuadrante, dibujamos los datos de la capa
            activeMetrics.forEach((metric) => {
                if (metricConfigs[metric]?.hidden) return;
                if (hasTimeDomainActive && !["Impulse", "Step"].includes(metric)) return;
                if (!hasTimeDomainActive && ["Impulse", "Step"].includes(metric)) return;

                // Aplicar Hover Focus y Solo Mode (Prompt 11)
                ctx.globalAlpha = op * getMetricAlpha(metric);

                // Color reservado para la métrica
                const color = metricStyles[metric]?.color || METRIC_COLORS[metric] || '#ff4444';

                const isLive = layer.isMeasuring;
                
                if (metric === "Magnitude" || metric === "Spectrum" || metric === "Coherence" || metric === "Group Delay") {
                    let bufferToDraw = layer.data;
                    let customPPOSmooth = (idx: number, arr: Float32Array) => arr[idx];

                    if (isLive) {
                        if (metric === "Magnitude") {
                            bufferToDraw = smoothedMagnitude;
                        } else if (metric === "Spectrum") {
                            bufferToDraw = smoothedSpectrum;
                        } else if (metric === "Coherence") {
                            bufferToDraw = interpEngine.interpCoherence;
                        } else if (metric === "Group Delay") {
                            bufferToDraw = interpEngine.interpGroupDelay;
                        }
                    }

                    drawMetricPath(
                        ctx,
                        bufferToDraw,
                        width,
                        height,
                        color,
                        lw,
                        lineDash,
                        metric,
                        frequencyLUT,
                        interpEngine.interpCoherence,
                        metricConfigs,
                        interactionState,
                        customPPOSmooth,
                        uiStore.sampleRate
                    );
                }

                if (metric === "Simulated Magnitude") {
                    const rawBuffer = isLive ? smoothedMagnitude : layer.data;
                    drawSimulatedMagnitudePath(
                        ctx,
                        width,
                        height,
                        { color, lineWidth: lw, lineDash },
                        frequencyLUT,
                        interpEngine.interpCoherence,
                        rawBuffer,
                        metricConfigs,
                        interactionState,
                        (idx: number, arr: Float32Array) => arr[idx],
                        mathOrchestrator.getEQResponseCached.bind(mathOrchestrator),
                        BINS,
                        uiStore.sampleRate
                    );
                }

                if (metric === "Phase") {
                    const rawBuffer = isLive ? interpEngine.interpPhase : layer.data;
                    drawPhasePath(
                        ctx,
                        width,
                        height,
                        { color, lineWidth: lw, lineDash },
                        frequencyLUT,
                        rawBuffer,
                        metricConfigs,
                        interactionState,
                        interpEngine.interpCoherence
                    );
                }
            });

            ctx.globalAlpha = 1.0; // Restablecer opacidad
        });

        // 3.5. Renderizar curvas de las Instantáneas globales que estén visibles (Prompt 8)
        traceManager.instantaneas.forEach((snap) => {
            if (!snap.visible) return;

            // Estilo para instantáneas en segundo plano: delgadas y discontinuas
            const lw = 1.3;
            const op = 0.75;
            ctx.globalAlpha = op;

            activeMetrics.forEach((metric) => {
                if (metricConfigs[metric]?.hidden) return;
                if (hasTimeDomainActive && !["Impulse", "Step"].includes(metric)) return;
                if (!hasTimeDomainActive && ["Impulse", "Step"].includes(metric)) return;

                // Aplicar Hover Focus y Solo Mode (Prompt 11) en instantáneas
                ctx.globalAlpha = op * getMetricAlpha(metric);

                // Color reservado para la métrica
                const color = metricStyles[metric]?.color || METRIC_COLORS[metric] || '#ff4444';

                // Extraer el buffer específico de esta métrica desde la instantánea multimétrica
                const bufferToDraw = snap.data[metric];

                if (bufferToDraw && bufferToDraw.length > 0) {
                    if (metric === "Phase") {
                        drawPhasePath(
                            ctx,
                            width,
                            height,
                            { color, lineWidth: lw, lineDash: [6, 4] },
                            frequencyLUT,
                            bufferToDraw,
                            metricConfigs,
                            interactionState,
                            interpEngine.interpCoherence
                        );
                    } else if (metric === "Simulated Magnitude") {
                        drawSimulatedMagnitudePath(
                            ctx,
                            width,
                            height,
                            { color, lineWidth: lw, lineDash: [6, 4] },
                            frequencyLUT,
                            interpEngine.interpCoherence,
                            bufferToDraw,
                            metricConfigs,
                            interactionState,
                            (idx: number, arr: Float32Array) => arr[idx],
                            mathOrchestrator.getEQResponseCached.bind(mathOrchestrator),
                            BINS,
                            uiStore.sampleRate
                        );
                    } else {
                        drawMetricPath(
                            ctx,
                            bufferToDraw,
                            width,
                            height,
                            color,
                            lw,
                            [6, 4],
                            metric,
                            frequencyLUT,
                            interpEngine.interpCoherence,
                            metricConfigs,
                            interactionState,
                            (idx: number, arr: Float32Array) => arr[idx],
                            uiStore.sampleRate
                        );
                    }
                }
            });

            ctx.globalAlpha = 1.0;
        });

        // 4. Renderizar métricas que no son capas o son globales (Impulse, Step)
        if (activeMetrics.includes("Impulse") && hasTimeDomainActive) {
            const style = metricStyles["Impulse"];
            drawTimeDomainPath(
                ctx,
                interpEngine.interpImpulse,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Impulse",
                interactionState,
                getImpulseValueInterpolated,
                hasTimeDomainActive
            );
        }

        if (activeMetrics.includes("Step") && hasTimeDomainActive) {
            const style = metricStyles["Step"];
            drawTimeDomainPath(
                ctx,
                interpEngine.interpStep,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Step",
                interactionState,
                getImpulseValueInterpolated,
                hasTimeDomainActive
            );
        }

        if (activeMetrics.includes("Simulated Magnitude") && !hasTimeDomainActive && frequencyLUT.length > 0) {
            const style = metricStyles["Simulated Magnitude"] || { color: "#00ffff", lineWidth: 1.5, lineDash: [4, 4] };
            drawSimulatedMagnitudePath(
                ctx,
                width,
                height,
                style,
                frequencyLUT,
                interpEngine.interpCoherence,
                smoothedMagnitude,
                metricConfigs,
                interactionState,
                (idx: number, arr: Float32Array) => arr[idx],
                mathOrchestrator.getEQResponseCached.bind(mathOrchestrator),
                BINS,
                uiStore.sampleRate
            );
        }

        if (activeMetrics.includes("Spectrum") && !hasTimeDomainActive) {
            const style = metricStyles["Spectrum"];
            drawSpectrumPath(
                ctx,
                liveData,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                frequencyLUT,
                interpEngine.interpCoherence,
                smoothedSpectrum,
                metricConfigs,
                interactionState,
                (idx: number, arr: Float32Array) => arr[idx],
                BINS,
                uiStore.sampleRate
            );
        }

        if (activeMetrics.includes("Phase") && !hasTimeDomainActive && frequencyLUT.length > 0) {
            const style = metricStyles["Phase"];
            drawPhasePath(
                ctx,
                width,
                height,
                style,
                frequencyLUT,
                interpEngine.interpPhase,
                metricConfigs,
                interactionState,
                interpEngine.interpCoherence
            );
        }

        if (activeMetrics.includes("Coherence") && !hasTimeDomainActive) {
            const style = metricStyles["Coherence"];
            drawMetricPath(
                ctx,
                interpEngine.interpCoherence,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Coherence",
                frequencyLUT,
                interpEngine.interpCoherence,
                metricConfigs,
                interactionState,
                getPPOSmoothedValue,
                uiStore.sampleRate
            );
        }

        if (activeMetrics.includes("Group Delay") && !hasTimeDomainActive) {
            const style = metricStyles["Group Delay"];
            drawMetricPath(
                ctx,
                interpEngine.interpGroupDelay,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Group Delay",
                frequencyLUT,
                interpEngine.interpCoherence,
                metricConfigs,
                interactionState,
                getPPOSmoothedValue,
                uiStore.sampleRate
            );
        }

        if (activeMetrics.includes("Impulse") && hasTimeDomainActive) {
            const style = metricStyles["Impulse"];
            drawTimeDomainPath(
                ctx,
                interpEngine.interpImpulse,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Impulse",
                interactionState,
                getImpulseValueInterpolated,
                hasTimeDomainActive
            );
        }

        if (activeMetrics.includes("Step") && hasTimeDomainActive) {
            const style = metricStyles["Step"];
            drawTimeDomainPath(
                ctx,
                interpEngine.interpStep,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Step",
                interactionState,
                getImpulseValueInterpolated,
                hasTimeDomainActive
            );
        }

        if (activeMetrics.includes("Scope") && hasTimeDomainActive) {
            drawScope(ctx, interpEngine.interpImpulse, width, height, "#00ff00", 2);
        }

        if (activeMetrics.includes("Nyquist") && !hasTimeDomainActive) {
            drawNyquistPath(ctx, mathOrchestrator.hReal, mathOrchestrator.hImag, width, height, "#ffffff", 2);
        }

        if (activeMetrics.includes("Phase Delay") && !hasTimeDomainActive) {
            drawPhaseDelay(
                ctx,
                interpEngine.interpPhase,
                width,
                height,
                '#06b6d4',
                1.5,
                frequencyLUT,
                metricConfigs,
                interactionState,
                BINS,
                uiStore.sampleRate
            );
        }

        if (activeMetrics.includes("Crest Factor") && !hasTimeDomainActive) {
            drawCrestFactor(
                ctx,
                mathOrchestrator.outputCrestFactor,
                width,
                height,
                frequencyLUT,
                interactionState,
                "#60a5fa"
            );
        }

        // Draw Target Trace overlay if active (Prompt 10)
        drawTargetTrace(ctx, width, height, targetTrace, interactionState, hasTimeDomainActive);

        if (showEQOverlay && traceManager.eqBands.length > 0) {
            drawEQOverlayPath(
                ctx, width, height,
                { color: '#fbbf24', lineWidth: 2, lineDash: [] },
                metricConfigs, interactionState,
                mathOrchestrator.getEQResponseCached.bind(mathOrchestrator),
                mathOrchestrator.BINS,
                uiStore.sampleRate
            );

            // Dibujar nodos de filtros
            const bands = traceManager.eqBands;
            for (let i = 0; i < bands.length; i++) {
                const band = bands[i];
                const x = valToX(band.freq, containerWidth, false, interactionState);
                const gain = mathOrchestrator.getEQResponseCached(band.freq);
                const y = valToY(gain, containerHeight, "Magnitude", metricConfigs, interactionState);

                const isHovered = hoveringEQNode === i;
                const isDragging = draggingEQNode === i;
                const radius = isDragging ? 8 : isHovered ? 7 : 5;

                ctx.shadowColor = '#fbbf24';
                ctx.shadowBlur = isDragging ? 12 : isHovered ? 8 : 0;

                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = isDragging ? '#fbbf24' : isHovered ? '#fcd34d' : '#f59e0b';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.shadowBlur = 0;

                if (isHovered || isDragging) {
                    ctx.font = '10px monospace';
                    ctx.fillStyle = '#fbbf24';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        `${band.freq >= 1000 ? (band.freq/1000).toFixed(1)+'k' : band.freq}Hz`,
                        x, y - radius - 12
                    );
                    ctx.fillText(
                        `${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)}dB`,
                        x, y - radius - 2
                    );
                }
            }
        }

        // 4. Overlays Especiales
        if (activeMetrics.includes("Level")) {
            drawLevelOverlay(ctx, width, height, meterStore);
        }

        if (activeMetrics.includes("Numeric")) {
            drawNumericOverlay(ctx, width, height, meterStore, hasTimeDomainActive);
        }

        // 5. Retícula Crosshair Interactiva
        if (interactionState.showCrosshair) {
            drawCrosshair(
                ctx,
                width,
                height,
                interactionState,
                hasTimeDomainActive,
                activeMetrics,
                interpEngine.interpMagnitude,
                interpEngine.interpPhase,
                interpEngine.interpCoherence,
                interpEngine.interpImpulse,
                interpEngine.interpStep,
                spectrogramDbHistory,
                liveData,
                getMetricValueInterpolated,
                getImpulseValueInterpolated
            );
        }
    }

    // GESTORES DE EVENTOS DELEGADOS (PAN & ZOOM)
    function handleWheel(e: WheelEvent) {
        interactionHandleWheel(e, interactionState, canvas, containerWidth, containerHeight, activeMetrics, metricConfigs, hasTimeDomainActive);
    }

    function handleMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Hit-test nodos EQ (solo si overlay visible y hay bandas)
        if (showEQOverlay && draggingEQNode === null && traceManager.eqBands.length > 0) {
            let found = -1;
            const bands = traceManager.eqBands;
            for (let i = 0; i < bands.length; i++) {
                const nx = valToX(bands[i].freq, containerWidth, false, interactionState);
                const gain = mathOrchestrator.getEQResponseCached(bands[i].freq);
                const ny = valToY(gain, containerHeight, "Magnitude", metricConfigs, interactionState);
                const dx = mouseX - nx;
                const dy = mouseY - ny;
                if (dx*dx + dy*dy < 144) { found = i; break; } // 144 = 12^2, evita sqrt
            }
            hoveringEQNode = found >= 0 ? found : null;
        } else if (!showEQOverlay) {
            hoveringEQNode = null;
        }

        // Drag activo de nodo EQ
        if (draggingEQNode !== null) {
            const freq = xToVal(mouseX, containerWidth, false, interactionState);
            const gain = yToVal(mouseY, containerHeight, "Magnitude", interactionState);
            const clampedFreq = Math.max(20, Math.min(20000, Math.round(freq)));
            const clampedGain = Math.max(-30, Math.min(30, parseFloat(gain.toFixed(1))));
            traceManager.updateEQBand(draggingEQNode, 'freq', clampedFreq);
            traceManager.updateEQBand(draggingEQNode, 'gain', clampedGain);
        }

        interactionHandleMouseMove(e, interactionState, canvas, containerWidth, containerHeight, hasTimeDomainActive, activeMetrics, metricConfigs);
    }

    function handleMouseDown(e: MouseEvent) {
        if (showEQOverlay && hoveringEQNode !== null) {
            draggingEQNode = hoveringEQNode;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        interactionHandleMouseDown(e, interactionState, showSelector, settingsBtn);
    }

    function handleMouseUp() {
        if (draggingEQNode !== null) {
            draggingEQNode = null;
            return;
        }
        interactionHandleMouseUp(
            interactionState,
            containerWidth,
            containerHeight,
            hasTimeDomainActive,
            activeMetrics,
            metricConfigs
        );
    }

    function handleTouchStart(e: TouchEvent) {
        e.preventDefault();
        interactionHandleTouchStart(e, interactionState);
    }

    function handleTouchMove(e: TouchEvent) {
        e.preventDefault();
        interactionHandleTouchMove(e, interactionState, canvas, activeMetrics, metricConfigs);
    }

    function handleTouchEnd() {
        interactionHandleTouchEnd(
            interactionState,
            containerWidth,
            containerHeight,
            hasTimeDomainActive,
            activeMetrics,
            metricConfigs
        );
    }

    function handleDoubleClick() {
        interactionHandleDoubleClick(interactionState);
    }



    function getMetricAlpha(metric: string): number {
        if (soloMetric) {
            return soloMetric === metric ? 1.0 : 0.2;
        }
        if (hoverMetric) {
            return hoverMetric === metric ? 1.0 : 0.15;
        }
        return 1.0;
    }

    function toggleSelector(e: MouseEvent) {
        e.stopPropagation();
        showSelector = !showSelector;
    }

    function onLayerDrop(e: DragEvent) {
        e.preventDefault();
        if (e.dataTransfer) {
            const layerId = e.dataTransfer.getData("text/plain");
            if (layerId) {
                traceManager.moveLayer(layerId, id);
            }
        }
    }


    export function loadInstantaneaIntoLayer(layerId: string, instId: string, metric: string) {
        const inst = traceManager.instantaneas.find(i => i.id === instId);
        if (inst && inst.data[metric]) {
            traceManager.setLayerSource(layerId, 'snapshot', inst.data[metric]);
        }
    }

    onMount(() => {
        // Inicializar con una capa por defecto si no existen capas para este cuadrante
        if (traceManager.layers.filter(l => l.quadrantId === id).length === 0) {
            traceManager.addLayer(`Capa ${traceManager.layers.length + 1}`, id, 'live');
        }

        // Observer del redimensionamiento físico del cuadrante
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                containerWidth = width;
                containerHeight = height;
            }
        });

        if (container) observer.observe(container);

        // Bucle continuo de animación con límite de FPS
        let animationId: number;
        let lastDrawTime = performance.now();
        function renderLoop() {
            animationId = requestAnimationFrame(renderLoop);
            const now = performance.now();
            const interval = 1000 / uiStore.targetFps;
            const elapsed = now - lastDrawTime;
            
            if (elapsed >= interval) {
                lastDrawTime = now - (elapsed % interval);
                draw();
            }
        }
        renderLoop();

        return () => {
            observer.disconnect();
            cancelAnimationFrame(animationId);
            mathOrchestrator.unregisterQuadrant(id);
        };
    });

    $effect(() => {
        mathOrchestrator.registerQuadrantMetrics(id, activeMetrics);
    });

    // Ajustar canvas reactivamente multiplicándolo por dpr para nitidez absoluta
    $effect(() => {
        if (canvas && containerWidth > 0 && containerHeight > 0) {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = containerWidth * dpr;
            canvas.height = containerHeight * dpr;
            canvas.style.width = `${containerWidth}px`;
            canvas.style.height = `${containerHeight}px`;

            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.resetTransform();
                ctx.scale(dpr, dpr);
            }
        }
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="quadrant-container"
    style="cursor: {cursorStyle}; background: var(--bg-primary); touch-action: none;"
    bind:this={container}
    onmousemove={handleMouseMove}
    onmousedown={handleMouseDown}
    onmouseup={handleMouseUp}
    onmouseleave={() => {
        interactionState.showCrosshair = false;
        handleMouseUp();
    }}
    onwheel={handleWheel}
    ondblclick={handleDoubleClick}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    ondragover={(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; }}
    ondragenter={(e) => { e.preventDefault(); e.currentTarget.style.outline = '2px solid #00ff88'; }}
    ondragleave={(e) => { e.currentTarget.style.outline = 'none'; }}
    ondrop={(e) => {
        e.preventDefault();
        e.currentTarget.style.outline = 'none';
        onLayerDrop(e);
    }}
>
    <!-- CABECERA PREMIUM DE CADA CUADRANTE -->
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="quadrant-header flex items-center gap-2 border-b border-[#1a1a24] px-3 py-1.5 min-h-[40px]"
         style="background: var(--bg-primary)"
         onmousedown={(e) => e.stopPropagation()}
         onmouseup={(e) => e.stopPropagation()}
         onclick={(e) => e.stopPropagation()}
         onwheel={(e) => e.stopPropagation()}
         ondblclick={(e) => e.stopPropagation()}>
        <div class="quadrant-title-group flex items-center gap-3">
            
            <!-- Botón "+ Métrica" -->
            <AddMetricDropdown
                allMetrics={allMetrics}
                bind:activeMetrics={activeMetrics}
                isMetricDisabled={isMetricDisabled}
                onToggleMetric={toggleMetric}
            />

            <!-- Pills compactos de métricas (solo texto, clic = config) -->
            <div class="active-metrics-badges flex items-center gap-1">
                {#each activeMetrics as m}
                    {@const isHidden = metricConfigs[m]?.hidden}
                    {@const mStyle = metricStyles[m] || { color: '#888', lineWidth: 1, lineDash: [] }}
                    {@const hasDash = mStyle.lineDash.length > 0}
                    <button
                        class="px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer select-none
                               {isHidden ? 'opacity-30 line-through' : ''}"
                        style="color: {soloMetric === m ? '#000' : 'white'};
                               background: {soloMetric === m ? mStyle.color : mStyle.color + '15'};
                               border: 1.5px {hasDash ? 'dashed' : 'solid'} {mStyle.color}{isHidden ? '40' : '80'};"
                        onmouseenter={() => (hoverMetric = m)}
                        onmouseleave={() => (hoverMetric = null)}
                        onclick={() => activeConfigMetric = activeConfigMetric === m ? null : m}
                        ondblclick={() => (soloMetric = soloMetric === m ? null : m)}
                        title="{isHidden ? '(Oculta) ' : ''}Clic: configurar · Doble clic: modo solo"
                    >
                        {m}
                    </button>
                {/each}
            </div>
        </div>

        <!-- ETIQUETA DE CAPA ACTIVA + BOTÓN DE CAPAS CON BADGE (CON ML-AUTO Y BOTÓN SETTINGS INTEGRADO) -->
        <div class="flex items-center gap-1.5 ml-auto">
            <LayerPanel
                quadrantId={id}
                quadrantLayers={quadrantLayers}
                bind:showEQOverlay={showEQOverlay}
            />

            <!-- Botón settings (MOVIDO AQUÍ) -->
            <button
                bind:this={settingsBtn}
                class="settings-btn flex items-center justify-center w-8 h-8 rounded-lg border border-[#1a1a24] text-gray-400 hover:text-gray-200 transition-all cursor-pointer hover:bg-[#121216]"
                onclick={toggleSelector}
                title="Configuración Global del Gráfico"
            >
                <span class="material-symbols-outlined text-[16px]">settings</span>
            </button>
        </div>
    </div>

    <!-- CANVAS DEL GRÁFICO -->
    <canvas bind:this={canvas} style="cursor: {cursorStyle}"></canvas>

    <!-- WATERMARK ID DEL CUADRANTE -->
    <span class="absolute bottom-2 right-3 text-[108px] font-black pointer-events-none select-none leading-none"
          style="color: {uiStore.isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
                 -webkit-text-stroke: 1.5px {uiStore.isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};">
        {id.replace(/[qQ]-?/g, '')}
    </span>



    <!-- BOTÓN ÚNICO DE ZOOM CON MENÚ -->
    <ZoomControls
        bind:interactionState={interactionState}
        onDoubleClick={handleDoubleClick}
    />

    <!-- POPOVER FLOTANTE ABSOLUTO OSM (CONFIGURACIÓN GLOBAL) -->
    <GlobalConfigPopover
        show={showSelector}
        bind:smoothing={smoothing}
        onClose={() => showSelector = false}
        onResetView={handleDoubleClick}
    />

    <!-- POPOVER DE CONFIGURACIÓN POR MÉTRICA (OSM PARIDAD) -->
    <MetricConfigPopover
        bind:activeConfigMetric={activeConfigMetric}
        bind:metricConfigs={metricConfigs}
        bind:metricStyles={metricStyles}
        onClose={() => activeConfigMetric = null}
        onRemoveMetric={removeMetric}
    />
</div>

<style>
    .quadrant-container {
        position: relative;
        background: #060608;
        border: 1px solid rgba(255, 255, 255, 0.04);
        overflow: hidden;
        cursor: crosshair;
        width: 100%;
        height: 100%;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    canvas {
        display: block;
        width: 100%;
        height: 100%;
        background: transparent;
    }

    /* Cabecera Premium */
    .quadrant-header {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 38px;
        background: #0c0c10;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        z-index: 30;
        box-sizing: border-box;
    }

    .quadrant-title-group {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .active-metrics-badges {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
    }

    .settings-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #9ca3af;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .settings-btn:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(255, 255, 255, 0.18);
        color: #fff;
    }
</style>
