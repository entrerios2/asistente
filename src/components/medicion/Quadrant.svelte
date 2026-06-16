<script lang="ts">
    import { onMount } from "svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { meterStore } from "$lib/stores/meterStore.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";

    import { targetTrace } from "$lib/stores/targetTrace.svelte";
    import { palettes, type PaletteType } from "$lib/dsp/colorPalettes";

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
        drawPhaseDelay
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
    let smoothing = $state(1 / 48);
    let showSelector = $state(false);

    let metricStyles = $state<Record<string, { color: string, lineWidth: number, lineDash: number[] }>>({
        "Spectrum": { color: "#a855f7", lineWidth: 1, lineDash: [] },
        "Magnitude": { color: "#ff4444", lineWidth: 1, lineDash: [] },
        "Phase": { color: "#d946ef", lineWidth: 1, lineDash: [] },
        "Coherence": { color: "#eab308", lineWidth: 1, lineDash: [] },
        "Group Delay": { color: "#10b981", lineWidth: 1, lineDash: [] },
        "Impulse": { color: "#3b82f6", lineWidth: 1, lineDash: [] },
        "Step": { color: "#f97316", lineWidth: 1, lineDash: [] },
        "Simulated Magnitude": { color: "#00ffff", lineWidth: 1, lineDash: [4, 4] },
    });

    let showAddDropdown = $state(false);
    let activeConfigMetric = $state<string | null>(null);
    let metricConfigs = $state<Record<string, any>>({
        "Spectrum": { modeY: "dB", sensorResistance: 10, smoothingPPO: 48, invertY: false, enableCoherence: false, coherenceThreshold: 0.5, yShift: 0 },
        "Magnitude": { modeY: "dB", sensorResistance: 10, smoothingPPO: 48, invertY: false, enableCoherence: false, coherenceThreshold: 0.5, yShift: 0 },
        "Simulated Magnitude": { modeY: "dB", sensorResistance: 10, smoothingPPO: 48, invertY: false, enableCoherence: false, coherenceThreshold: 0.5, yShift: 0 },
        "Phase": { unwrapMode: "±180", rotate: 0, range: 360, yShift: 0 },
        "Coherence": { cohType: "normal", showThresholdLine: false, thresholdColor: "#eab308", thresholdValue: 0.5, yShift: 0 },
        "Spectrogram": { palette: "Magma" as PaletteType },
    });

    let frequencyLUT = $state<Int32Array>(new Int32Array(0));
    let hoverMetric = $state<string | null>(null);
    let soloMetric = $state<string | null>(null);

    // Dimensiones reactivas del contenedor físico
    let containerWidth = $state(0);
    let containerHeight = $state(0);

    let cursorStyle = $derived.by(() => {
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

    let showZoomMenu = $state(false);
    let showLayerDropdown = $state(false);
    let showAddLayerMenu = $state(false);

    // Motor de interpolación
    const interpEngine = new InterpolationEngine();

    const quadrantLayers = $derived(traceManager.layers.filter(l => l.quadrantId === id));
    const activeLayer = $derived(quadrantLayers.find(l => l.id === uiStore.activeLayerId));
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

    // Visual coding: colores por tipo de métrica
    const METRIC_COLORS: Record<string, string> = {
        'Magnitude': '#ff4444',
        'Phase': '#d946ef',
        'Coherence': '#eab308',
        'Group Delay': '#3b82f6',
        'Impulse': '#14b8a6',
        'Step': '#10b981',
        'Spectrum': '#a855f7',
        'Scope': '#06b6d4',
        'Crest Factor': '#f97316',
    };

    $effect(() => {
        frequencyLUT = rebuildFrequencyLUT(containerWidth, interactionState, interpEngine.BINS);
    });

    let localLastVersion = 0;

    // Control de recalculo y throttling
    let dirty = $state(true);
    
    // Puente reactivo de Svelte 5 para marcar dirty = true
    // Sincronización desde el panel lateral hacia el cuadrante
    $effect(() => {
        const isSimulatingGlobal = uiStore.isSimulating;
        const hasPill = activeMetrics.includes("Simulated Magnitude");
        
        if (isSimulatingGlobal && !hasPill) {
            activeMetrics = [...activeMetrics, "Simulated Magnitude"];
        } else if (!isSimulatingGlobal && hasPill) {
            activeMetrics = activeMetrics.filter(m => m !== "Simulated Magnitude");
        }
    });

    // Sincronización desde el cuadrante hacia el panel lateral
    $effect(() => {
        const hasPill = activeMetrics.includes("Simulated Magnitude");
        if (hasPill !== uiStore.isSimulating) {
            uiStore.isSimulating = hasPill;
        }
    });

    $effect(() => {
        // Observar cambios en variables que alteran el cálculo
        JSON.stringify(traceManager.eqBands);
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
        return interpEngine.getMetricValueInterpolated(freq, dataArray);
    }

    // Ayudante de interpolación circular para el dominio del tiempo
    function getImpulseValueInterpolated(
        timeMs: number,
        impulseArray: Float32Array,
    ): number {
        return interpEngine.getImpulseValueInterpolated(timeMs, impulseArray);
    }

    // Definición de las 10 métricas de OSM
    const allMetrics = [
        {
            name: "Spectrum",
            type: "frequency",
            color: "#a855f7",
            label: "Spectrum [Absoluto]",
        },
        {
            name: "Magnitude",
            type: "frequency",
            color: "#ff4444",
            label: "Magnitude [Relativo]",
        },
        {
            name: "Simulated Magnitude",
            type: "frequency",
            color: "#00ffff",
            label: "Magnitud Simulada (EQ)",
        },
        {
            name: "Phase",
            type: "frequency",
            color: "#d946ef",
            label: "Phase [Fase]",
        },
        {
            name: "Coherence",
            type: "frequency",
            color: "#eab308",
            label: "Coherence",
        },
        {
            name: "Group Delay",
            type: "frequency",
            color: "#10b981",
            label: "Group Delay",
        },
        {
            name: "Spectrogram",
            type: "frequency",
            color: "#ec4899",
            label: "Spectrogram 2D",
        },
        {
            name: "Impulse",
            type: "time",
            color: "#3b82f6",
            label: "Impulse [Tiempo]",
        },
        {
            name: "Step",
            type: "time",
            color: "#f97316",
            label: "Step [Escalón]",
        },
        {
            name: "Level",
            type: "visual",
            color: "#06b6d4",
            label: "Level [VU]",
        },
        {
            name: "Numeric",
            type: "visual",
            color: "#14b8a6",
            label: "Numeric [HUD]",
        },
        {
            name: "Nyquist",
            type: "frequency",
            color: "#ffffff",
            label: "Nyquist Plot",
        },
        {
            name: "Scope",
            type: "time",
            color: "#00ff00",
            label: "Oscilloscope",
        },
        {
            name: "Phase Delay",
            type: "frequency",
            color: "#f43f5e",
            label: "Phase Delay",
        },
        {
            name: "Crest Factor",
            type: "frequency",
            color: "#60a5fa",
            label: "Crest Factor",
        },
    ];

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
        const binWidth = 24000 / BINS;
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

        const liveTrace = traceManager.traces.find((t) => t.id === "live-1");

        const currentVersion = mathOrchestrator.version;
        if (currentVersion !== localLastVersion) {
            localLastVersion = currentVersion;
            interpEngine.updateHistory();
        }

        // Realizar la interpolación temporal (Exponential Smoothing) a 60+ FPS
        // Si dirty es true, forzamos un snap instantáneo para que la UI responda de inmediato
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
        const hasLive = liveTrace && liveTrace.data && liveTrace.data.length > 0;
        const rawSpec = hasLive ? liveTrace.data : interpEngine.interpMagnitude;
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
                    const data = liveTrace.data;
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
                metricConfigs, interactionState, getPPOSmoothedValue
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
                let color = "#ff4444"; // Magnitud por defecto
                if (metric === "Phase") color = "#d946ef";
                else if (metric === "Coherence") color = "#eab308";
                else if (metric === "Spectrum") color = "#a855f7";
                else if (metric === "Group Delay") color = "#10b981";
                else if (metric === "Simulated Magnitude") color = "#00ffff";

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
                        customPPOSmooth
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
                        BINS
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
                let color = "#ff4444";
                if (metric === "Phase") color = "#d946ef";
                else if (metric === "Coherence") color = "#eab308";
                else if (metric === "Spectrum") color = "#a855f7";
                else if (metric === "Group Delay") color = "#10b981";
                else if (metric === "Simulated Magnitude") color = "#00ffff";

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
                            BINS
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
                            (idx: number, arr: Float32Array) => arr[idx]
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
                BINS
            );
        }

        if (activeMetrics.includes("Spectrum") && !hasTimeDomainActive) {
            const style = metricStyles["Spectrum"];
            drawSpectrumPath(
                ctx,
                liveTrace,
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
                BINS
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
                getPPOSmoothedValue
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
                getPPOSmoothedValue
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
                BINS
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
                liveTrace,
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
        interactionHandleMouseMove(e, interactionState, canvas, containerWidth, containerHeight, hasTimeDomainActive, activeMetrics, metricConfigs);
    }

    function handleMouseDown(e: MouseEvent) {
        interactionHandleMouseDown(e, interactionState, showSelector, settingsBtn);
    }

    function handleMouseUp() {
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

    function onLayerDragStart(e: DragEvent, layerId: string) {
        if (e.dataTransfer) {
            e.dataTransfer.setData("text/plain", layerId);
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
    style="cursor: {cursorStyle}; background: {uiStore.isDarkMode ? '#060608' : '#f8f8fa'}; touch-action: none;"
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
    <div class="quadrant-header flex items-center justify-between bg-[#08080a] border-b border-[#1a1a24] px-3 py-1.5 min-h-[40px]"
         onmousedown={(e) => e.stopPropagation()}
         onmouseup={(e) => e.stopPropagation()}
         onclick={(e) => e.stopPropagation()}
         onwheel={(e) => e.stopPropagation()}
         ondblclick={(e) => e.stopPropagation()}>
        <div class="quadrant-title-group flex items-center gap-3">
            
            <!-- Botón "+ Métrica" -->
            <div class="relative inline-block">
                <button
                    class="w-6 h-6 flex items-center justify-center rounded border border-[#222] text-[#00ff88] hover:bg-[#00ff88]/10 hover:border-[#00ff88]/30 transition-all cursor-pointer text-sm font-bold"
                    onclick={(e) => { e.stopPropagation(); showAddDropdown = !showAddDropdown; }}
                    title="Agregar Métrica"
                >
                    +
                </button>
                
                {#if showAddDropdown}
                    <!-- Backdrop para cerrar con un click fuera -->
                    <div class="fixed inset-0 z-40" onclick={() => showAddDropdown = false}></div>
                    
                    <div class="absolute left-0 mt-1 bg-[#0d0d12] border border-[#222] rounded-lg p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 min-w-[170px] flex flex-col gap-0.5 select-none"
                         onmousedown={(e) => e.stopPropagation()} onclick={(e) => e.stopPropagation()}>
                        {#each allMetrics as m}
                            {@const active = activeMetrics.includes(m.name)}
                            {@const disabled = isMetricDisabled(m.name)}
                            <button
                                class="w-full text-left px-2 py-1 rounded-md text-[11px] font-medium flex items-center justify-between transition-colors
                                       {active ? 'bg-[#00ff88]/10 text-[#00ff88] cursor-default' : disabled ? 'text-gray-600 cursor-not-allowed opacity-50' : 'text-gray-300 hover:bg-[#161622] hover:text-[#fff]'}"
                                onclick={() => {
                                    if (!active && !disabled) {
                                        toggleMetric(m.name);
                                        showAddDropdown = false;
                                    }
                                }}
                                disabled={disabled}
                            >
                                <span>{m.label}</span>
                                {#if active}
                                    <span class="material-symbols-outlined text-xs">done</span>
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Pills compactos de métricas (solo texto, clic = config) -->
            <div class="active-metrics-badges flex items-center gap-1">
                {#each activeMetrics as m}
                    {@const isHidden = metricConfigs[m]?.hidden}
                    <button
                        class="px-2 py-0.5 rounded text-[10px] font-semibold transition-all border cursor-pointer select-none
                               {soloMetric === m ? 'bg-[#00ff88]/20 border-[#00ff88] text-[#00ff88]'
                                : isHidden ? 'bg-[#0a0a0e] border-[#1a1a24] text-gray-600 opacity-50'
                                : 'bg-[#121216] border-[#222] text-gray-300 hover:border-[#444]'}
                               {isHidden ? 'line-through' : ''}"
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

        <!-- ETIQUETA DE CAPA ACTIVA + BOTÓN DE CAPAS CON BADGE -->
        <div class="flex items-center gap-1.5">
            <!-- Etiqueta de capa activa (siempre visible) -->
            {#if activeLayer}
                <span class="text-[9px] text-gray-400 truncate max-w-[80px]" title={activeLayer.name}>
                    {#if activeLayer.isCalculated}<span class="text-[#a855f7] font-mono">∑</span>{/if}
                    {activeLayer.name}
                </span>
            {/if}

            <div class="relative">
                <button
                    class="flex items-center justify-center w-8 h-8 rounded-lg border border-[#1a1a24] text-gray-400 hover:text-gray-200 transition-all cursor-pointer hover:bg-[#121216] relative"
                    onclick={(e) => { e.stopPropagation(); showLayerDropdown = !showLayerDropdown; }}
                    title="Gestionar Capas"
                >
                    <span class="material-symbols-outlined text-[16px]">layers</span>
                    {#if quadrantLayers.length > 0}
                        <span class="absolute -top-1 -right-1 bg-[#00ff88] text-black text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                            {quadrantLayers.filter(l => l.visible).length}
                        </span>
                    {/if}
                </button>

                {#if showLayerDropdown}
                    <div class="fixed inset-0 z-40" onclick={() => showLayerDropdown = false}></div>
                    <div class="absolute right-0 mt-1 bg-[#0c0c0e] border border-[#1a1a24] rounded-xl p-3 shadow-[0_10px_30px_#000] z-50 min-w-[200px] flex flex-col gap-1.5 select-none text-[11px]"
                         onmousedown={(e) => e.stopPropagation()}
                         onclick={(e) => e.stopPropagation()}
                         onwheel={(e) => e.stopPropagation()}>
                        <div class="flex items-center justify-between border-b border-[#1a1a24] pb-1.5 mb-1">
                            <span class="font-bold text-gray-300 text-[10px] uppercase tracking-wider">Capas</span>
                            <button onclick={() => showLayerDropdown = false} class="text-gray-500 hover:text-gray-300">
                                <span class="material-symbols-outlined text-xs">close</span>
                            </button>
                        </div>

                        {#each quadrantLayers as layer}
                            <div class="flex items-center justify-between gap-2 py-1 px-1 rounded hover:bg-[#121216] group"
                                 draggable="true"
                                 ondragstart={(e) => onLayerDragStart(e, layer.id)}>
                                <span class="text-[10px] truncate flex-1 cursor-pointer {layer.id === uiStore.activeLayerId ? 'text-[#00ff88] font-bold' : 'text-gray-300'}"
                                      onclick={() => uiStore.activeLayerId = layer.id}>
                                    {#if layer.isCalculated}<span class="text-[#a855f7] font-mono mr-1">∑</span>{/if}
                                    {layer.name}
                                </span>
                                <div class="flex items-center gap-0.5">
                                    <button class="p-0.5 text-gray-500 hover:text-white" onclick={() => layer.visible = !layer.visible}>
                                        <span class="material-symbols-outlined text-[13px]">{layer.visible ? 'visibility' : 'visibility_off'}</span>
                                    </button>
                                    <button class="p-0.5 text-gray-500 hover:text-red-400" onclick={() => traceManager.deleteLayer(layer.id)}>
                                        <span class="material-symbols-outlined text-[13px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        {/each}

                        <!-- Botón único "Agregar" con sub-menú desplegable -->
                        <div class="border-t border-[#1a1a24] pt-1.5 mt-1 relative">
                            <button
                                class="w-full text-left px-2 py-1.5 rounded text-[10px] text-[#00ff88] hover:bg-[#00ff88]/5 font-semibold flex items-center gap-1 cursor-pointer"
                                onclick={(e) => { e.stopPropagation(); showAddLayerMenu = !showAddLayerMenu; }}>
                                <span class="material-symbols-outlined text-[12px]">add</span>
                                Agregar capa
                                <span class="material-symbols-outlined text-[10px] ml-auto">expand_more</span>
                            </button>
                            {#if showAddLayerMenu}
                                <div class="absolute left-0 bottom-full mb-1 bg-[#0c0c0e] border border-[#1a1a24] rounded-lg shadow-lg z-50 min-w-[160px] py-1">
                                    <button
                                        class="w-full text-left px-3 py-1.5 text-[10px] text-[#00ff88] hover:bg-[#00ff88]/5 flex items-center gap-1.5 cursor-pointer"
                                        onclick={() => { traceManager.addLayer(`Capa ${traceManager.layers.length + 1}`, id, 'live'); showAddLayerMenu = false; showLayerDropdown = false; }}>
                                        <span class="material-symbols-outlined text-[12px]">add</span>
                                        Nueva Capa
                                    </button>
                                    <button
                                        class="w-full text-left px-3 py-1.5 text-[10px] text-[#a855f7] hover:bg-[#a855f7]/5 flex items-center gap-1.5 cursor-pointer"
                                        onclick={() => { traceManager.addCalculatedLayer('Avg', id, 'average'); showAddLayerMenu = false; showLayerDropdown = false; }}>
                                        <span class="material-symbols-outlined text-[12px]">functions</span>
                                        Capa Calculada
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <button
            bind:this={settingsBtn}
            class="settings-btn flex items-center justify-center w-8 h-8 rounded-lg border border-[#1a1a24] text-gray-400 hover:text-gray-200 transition-all cursor-pointer hover:bg-[#121216]"
            onclick={toggleSelector}
            title="Configuración Global del Gráfico"
        >
            <span class="material-symbols-outlined text-[16px]">settings</span>
        </button>
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
    <div class="absolute left-3 bottom-3 z-20 select-none">
        <div class="relative">
            {#if showZoomMenu}
                <div class="fixed inset-0 z-40" onclick={() => showZoomMenu = false}></div>
                <div class="absolute left-0 bottom-10 bg-[#0c0c0e] border border-[#1a1a24] rounded-lg p-1.5 shadow-xl z-50 min-w-[110px] flex flex-col gap-0.5">
                    {#each [
                        { mode: 'XY' as const, label: 'Libre (XY)', icon: 'open_with' },
                        { mode: 'X' as const, label: 'Solo Eje X', icon: 'swap_horiz' },
                        { mode: 'Y' as const, label: 'Solo Eje Y', icon: 'swap_vert' },
                    ] as opt}
                        <button class="px-3 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer text-left flex items-center gap-1.5
                                       {interactionState.zoomMode === opt.mode ? 'text-[#00ff88] bg-[#00ff88]/10' : 'text-gray-300 hover:text-white hover:bg-[#121216]'}"
                            onclick={() => { interactionState.zoomMode = opt.mode; showZoomMenu = false; }}>
                            <span class="material-symbols-outlined text-[14px]">{opt.icon}</span>
                            {opt.label}
                        </button>
                    {/each}
                    <div class="border-t border-[#1a1a24] my-0.5"></div>
                    <button class="px-3 py-1.5 text-[10px] font-bold text-[#00ff88] hover:bg-[#00ff88]/10 rounded transition-all cursor-pointer text-left"
                        onclick={() => { handleDoubleClick(); showZoomMenu = false; }}>Restaurar</button>
                </div>
            {/if}
            <button
                class="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0c0c0e] border border-[#1a1a24] text-gray-400 hover:text-white hover:border-[#00ff88] transition-all cursor-pointer shadow-lg opacity-40 hover:opacity-100"
                onclick={() => showZoomMenu = !showZoomMenu}
                title="Opciones de Zoom"
            >
                <span class="material-symbols-outlined text-[16px]">
                    {interactionState.zoomMode === 'X' ? 'swap_horiz' : interactionState.zoomMode === 'Y' ? 'swap_vert' : 'open_with'}
                </span>
            </button>
        </div>
    </div>

    <!-- POPOVER FLOTANTE ABSOLUTO OSM (CONFIGURACIÓN GLOBAL) -->
    {#if showSelector}
        <!-- Capturador de clics del fondo -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="popover-backdrop fixed inset-0 z-30"
            onclick={() => (showSelector = false)}
        ></div>

        <div class="selector-popover absolute right-[10px] top-[46px] bg-[#0c0c0e] border border-[#1a1a24] rounded-xl p-4 shadow-[0_10px_30px_#000000] z-50 min-w-[200px] flex flex-col gap-3 select-none text-[11px] text-gray-200"
             onmousedown={(e) => e.stopPropagation()}
             onmouseup={(e) => e.stopPropagation()}
             onmousemove={(e) => e.stopPropagation()}
             onclick={(e) => e.stopPropagation()}
             onwheel={(e) => e.stopPropagation()}>
            <div class="popover-header flex items-center justify-between border-b border-[#1a1a24] pb-1.5">
                <span class="popover-title font-bold text-gray-300">Configuración Global</span>
                <button
                    class="popover-close text-gray-500 hover:text-gray-300"
                    onclick={() => (showSelector = false)}
                >
                    <span class="material-symbols-outlined text-xs">close</span>
                </button>
            </div>

            <!-- FPS de Visualización -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">FPS de Visualización ({uiStore.targetFps})</span>
                <input
                    type="range"
                    min="0.5"
                    max="60"
                    step="1"
                    class="accent-[#00ff88]"
                    value={uiStore.targetFps}
                    oninput={(e) => {
                        uiStore.targetFps = parseFloat(e.currentTarget.value);
                    }}
                />
            </div>

            <!-- Suavizado Global -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Suavizado Temporal</span>
                <div class="smoothing-options flex gap-1 bg-[#121216] p-0.5 rounded border border-[#222]">
                    {#each [0, 1 / 3, 1 / 12, 1 / 48] as s}
                        <button
                            class="smoothing-btn flex-1 py-1 rounded text-[10px] font-semibold text-center transition-all cursor-pointer
                                   {smoothing === s ? 'bg-[#00ff88]/15 text-[#00ff88]' : 'text-gray-400 hover:text-white'}"
                            onclick={() => (smoothing = s)}
                        >
                            {s === 0 ? "Off" : `1/${Math.round(1 / s)}`}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Límites de Zoom y Reinicio -->
            <div class="divider border-t border-[#1a1a24] my-0.5"></div>

            <div class="flex flex-col gap-1.5">
                <div class="flex justify-between items-center text-gray-400">
                    <span>Límite Zoom In</span>
                    <span class="font-mono text-gray-300">80x</span>
                </div>
                <div class="flex justify-between items-center text-gray-400">
                    <span>Límite Zoom Out</span>
                    <span class="font-mono text-gray-300">0.1x</span>
                </div>
                
                <button
                    class="action-btn w-full flex items-center justify-center gap-1.5 mt-2 py-1.5 rounded-lg bg-[#121216] border border-[#222] hover:border-gray-500 text-gray-300 hover:text-white font-bold transition-all cursor-pointer"
                    onclick={handleDoubleClick}
                >
                    <span class="material-symbols-outlined text-xs">restart_alt</span> Reiniciar Vista
                </button>
            </div>
        </div>
    {/if}

    <!-- POPOVER DE CONFIGURACIÓN POR MÉTRICA (OSM PARIDAD) -->
    {#if activeConfigMetric}
        <!-- Backdrop para cerrar con un click fuera -->
        <div class="fixed inset-0 z-40" onclick={() => activeConfigMetric = null}></div>
        
        <div class="absolute top-[46px] left-[16px] bg-[#0c0c0e] border border-[#1a1a24] rounded-xl p-4 shadow-[0_10px_30px_#000000] z-50 min-w-[240px] flex flex-col gap-3 select-none text-[11px] text-gray-200"
             onmousedown={(e) => e.stopPropagation()}
             onmouseup={(e) => e.stopPropagation()}
             onmousemove={(e) => e.stopPropagation()}
             onclick={(e) => e.stopPropagation()}
             onwheel={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between border-b border-[#1a1a24] pb-1.5 mb-1">
                <span class="font-bold text-[#00ff88] uppercase tracking-wide">Config. {activeConfigMetric}</span>
                <button onclick={() => activeConfigMetric = null} class="text-gray-500 hover:text-gray-300">
                    <span class="material-symbols-outlined text-xs">close</span>
                </button>
            </div>
            
            {#if activeConfigMetric === "Magnitude" || activeConfigMetric === "Spectrum" || activeConfigMetric === "Simulated Magnitude"}
                <!-- Modo Y -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Modo Eje Y</span>
                    <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                            bind:value={metricConfigs[activeConfigMetric].modeY}>
                        <option value="dB">dB</option>
                        <option value="Linear">Linear</option>
                        <option value="Impedance">Impedance</option>
                    </select>
                </div>
                
                {#if metricConfigs[activeConfigMetric].modeY === "Impedance"}
                    <!-- Resistencia del sensor -->
                    <div class="flex flex-col gap-1">
                        <span class="text-gray-400 font-medium">Resistencia Sensor (Ω)</span>
                        <input type="number" class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white"
                               bind:value={metricConfigs[activeConfigMetric].sensorResistance} />
                    </div>
                {/if}
                
                <!-- Suavizado PPO -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Suavizado PPO (1/Oct)</span>
                    <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                            bind:value={metricConfigs[activeConfigMetric].smoothingPPO}>
                        <option value="1">1/1 Octava</option>
                        <option value="3">1/3 Octava</option>
                        <option value="6">1/6 Octava</option>
                        <option value="12">1/12 Octava</option>
                        <option value="24">1/24 Octava</option>
                        <option value="48">1/48 Octava</option>
                    </select>
                </div>
                
                <!-- Invertir Y / Activar coherencia -->
                <div class="flex flex-col gap-1.5 py-1">
                    <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                        <input type="checkbox" bind:checked={metricConfigs[activeConfigMetric].invertY} />
                        <span>Invertir Eje Y</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                        <input type="checkbox" bind:checked={metricConfigs[activeConfigMetric].enableCoherence} />
                        <span>Activar Coherencia</span>
                    </label>
                </div>
                
                {#if metricConfigs[activeConfigMetric].enableCoherence}
                    <div class="flex flex-col gap-1">
                        <span class="text-gray-400 font-medium">Umbral Coherencia ({metricConfigs[activeConfigMetric].coherenceThreshold})</span>
                        <input type="range" min="0" max="1" step="0.05" class="accent-[#00ff88]"
                               bind:value={metricConfigs[activeConfigMetric].coherenceThreshold} />
                    </div>
                {/if}
                
                <!-- Desplazamiento Y -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Desplazamiento Eje Y ({metricConfigs[activeConfigMetric].yShift}px)</span>
                    <input type="range" min="-300" max="300" step="5" class="accent-[#00ff88]"
                           bind:value={metricConfigs[activeConfigMetric].yShift} />
                </div>
            {/if}
            
            {#if activeConfigMetric === "Phase"}
                <!-- Envoltura -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Rango / Envoltura</span>
                    <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                            bind:value={metricConfigs["Phase"].unwrapMode}>
                        <option value="±180">±180º</option>
                        <option value="360">0..360º</option>
                    </select>
                </div>
                
                <!-- Rotación de Fase -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Ángulo de Rotación ({metricConfigs["Phase"].rotate}º)</span>
                    <input type="range" min="-360" max="360" step="5" class="accent-[#00ff88]"
                           bind:value={metricConfigs["Phase"].rotate} />
                </div>
                
                <!-- Rango angular -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Rango Angular ({metricConfigs["Phase"].range}º)</span>
                    <input type="range" min="90" max="720" step="30" class="accent-[#00ff88]"
                           bind:value={metricConfigs["Phase"].range} />
                </div>
                
                <!-- Desplazamiento Y -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Desplazamiento Eje Y ({metricConfigs["Phase"].yShift}px)</span>
                    <input type="range" min="-300" max="300" step="5" class="accent-[#00ff88]"
                           bind:value={metricConfigs["Phase"].yShift} />
                </div>
            {/if}
            
            {#if activeConfigMetric === "Coherence"}
                <!-- Tipo de Coherencia -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Tipo de Coherencia</span>
                    <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                            bind:value={metricConfigs["Coherence"].cohType}>
                        <option value="normal">Normal</option>
                        <option value="squared">Al Cuadrado (r²)</option>
                        <option value="SNR">Estimación SNR</option>
                    </select>
                </div>
                
                <!-- Línea de umbral -->
                <div class="flex flex-col gap-1.5 py-1">
                    <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                        <input type="checkbox" bind:checked={metricConfigs["Coherence"].showThresholdLine} />
                        <span>Mostrar línea de umbral</span>
                    </label>
                </div>
                
                {#if metricConfigs["Coherence"].showThresholdLine}
                    <div class="flex flex-col gap-2">
                        <div class="flex items-center justify-between">
                            <span class="text-gray-400">Color Umbral</span>
                            <input type="color" bind:value={metricConfigs["Coherence"].thresholdColor} class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-gray-400 font-medium">Valor Umbral ({metricConfigs["Coherence"].thresholdValue})</span>
                            <input type="range" min="0.05" max="0.95" step="0.05" class="accent-[#eab308]"
                                   bind:value={metricConfigs["Coherence"].thresholdValue} />
                        </div>
                    </div>
                {/if}
                
                <!-- Desplazamiento Y -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Desplazamiento Eje Y ({metricConfigs["Coherence"].yShift}px)</span>
                    <input type="range" min="-300" max="300" step="5" class="accent-[#00ff88]"
                           bind:value={metricConfigs["Coherence"].yShift} />
                </div>
            {/if}
            
            {#if activeConfigMetric === "Spectrogram"}
                <!-- Paleta de Colores -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Paleta de Colores</span>
                    <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                            bind:value={metricConfigs["Spectrogram"].palette}>
                        <option value="Magma">Magma</option>
                        <option value="Jet">Jet (Arcoíris)</option>
                        <option value="Hot">Hot (Térmico)</option>
                        <option value="Grayscale">Escala de Grises</option>
                    </select>
                </div>
            {/if}

            <!-- Editor de Estilos de Curva (Prompt 11) -->
            {#if activeConfigMetric && metricStyles[activeConfigMetric]}
                <div class="border-t border-[#1a1a24] pt-2 mt-1 flex flex-col gap-2">
                    <span class="text-gray-400 font-bold uppercase tracking-wider text-[8px]">Estilo de Curva</span>
                    
                    <!-- Color -->
                    <div class="flex items-center justify-between">
                        <span>Color</span>
                        <input type="color" bind:value={metricStyles[activeConfigMetric].color} class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                    </div>

                    <!-- Grosor -->
                    <div class="flex flex-col gap-1">
                        <div class="flex justify-between">
                            <span>Grosor</span>
                            <span class="font-mono">{metricStyles[activeConfigMetric].lineWidth}px</span>
                        </div>
                        <input type="range" min="1" max="5" step="0.2" class="accent-[#00ff88]"
                               bind:value={metricStyles[activeConfigMetric].lineWidth} />
                    </div>

                    <!-- Estilo de Trazo -->
                    <div class="flex flex-col gap-1">
                        <span>Estilo de Línea</span>
                        <div class="flex gap-1">
                            <button class="flex-1 py-1 text-center border rounded text-[9px] cursor-pointer {metricStyles[activeConfigMetric].lineDash.length === 0 ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]' : 'bg-[#121216] border-[#222]'}"
                                    onclick={() => metricStyles[activeConfigMetric!].lineDash = []}>
                                Sólido
                            </button>
                            <button class="flex-1 py-1 text-center border rounded text-[9px] cursor-pointer {metricStyles[activeConfigMetric].lineDash.join(',') === '8,4' ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]' : 'bg-[#121216] border-[#222]'}"
                                    onclick={() => metricStyles[activeConfigMetric!].lineDash = [8, 4]}>
                                Dashed
                            </button>
                            <button class="flex-1 py-1 text-center border rounded text-[9px] cursor-pointer {metricStyles[activeConfigMetric].lineDash.join(',') === '2,3' ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]' : 'bg-[#121216] border-[#222]'}"
                                    onclick={() => metricStyles[activeConfigMetric!].lineDash = [2, 3]}>
                                Dotted
                            </button>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Toggle Visibilidad de la Métrica -->
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-[#1a1a24]">
                <span class="text-[10px] text-gray-400">Visible en gráfico</span>
                <button
                    class="w-8 h-4 rounded-full transition-all cursor-pointer {metricConfigs[activeConfigMetric!]?.hidden ? 'bg-gray-700' : 'bg-[#00ff88]'}"
                    onclick={() => {
                        if (!metricConfigs[activeConfigMetric!]) metricConfigs[activeConfigMetric!] = {};
                        metricConfigs[activeConfigMetric!].hidden = !metricConfigs[activeConfigMetric!].hidden;
                    }}
                >
                    <div class="w-3 h-3 rounded-full bg-white shadow transition-transform {metricConfigs[activeConfigMetric!]?.hidden ? 'translate-x-0.5' : 'translate-x-4'}"></div>
                </button>
            </div>

            <!-- Botón Eliminar Métrica -->
            <button
                class="w-full mt-2 py-1.5 px-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                onclick={() => {
                    removeMetric(activeConfigMetric!);
                    activeConfigMetric = null;
                }}
            >
                <span class="material-symbols-outlined text-[12px]">delete</span>
                Eliminar {activeConfigMetric}
            </button>
        </div>
    {/if}
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

    .quadrant-id {
        font-family: "Outfit", sans-serif;
        font-size: 11px;
        font-weight: 800;
        color: #00ff88;
        letter-spacing: 0.05em;
        text-shadow: 0 0 10px rgba(0, 255, 136, 0.2);
    }

    .active-metrics-badges {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
    }

    .active-layers-badges {
        display: flex;
        gap: 6px;
    }

    .layer-badge-pill {
        transition: all 0.2s ease;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }

    .layer-badge-pill:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: #444;
    }

    .layer-pill-btn {
        opacity: 0.6;
        transition: all 0.2s ease;
    }

    .layer-pill-btn:hover {
        opacity: 1;
        transform: scale(1.1);
    }

    .metric-badge {
        font-family: "Outfit", sans-serif;
        font-size: 8px;
        font-weight: 700;
        padding: 1.5px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    /* Colores correspondientes de insignias */
    .badge-magnitude {
        background: rgba(255, 68, 68, 0.12);
        border: 1px solid rgba(255, 68, 68, 0.3);
        color: #ff4444;
    }
    .badge-spectrum {
        background: rgba(168, 85, 247, 0.12);
        border: 1px solid rgba(168, 85, 247, 0.3);
        color: #c084fc;
    }
    .badge-phase {
        background: rgba(217, 70, 239, 0.12);
        border: 1px solid rgba(217, 70, 239, 0.3);
        color: #f472b6;
    }
    .badge-coherence {
        background: rgba(234, 179, 8, 0.12);
        border: 1px solid rgba(234, 179, 8, 0.3);
        color: #facc15;
    }
    .badge-group-delay {
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #34d399;
    }
    .badge-spectrogram {
        background: rgba(236, 72, 153, 0.12);
        border: 1px solid rgba(236, 72, 153, 0.3);
        color: #f472b6;
    }
    .badge-impulse {
        background: rgba(59, 130, 246, 0.12);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #60a5fa;
    }
    .badge-step {
        background: rgba(249, 115, 22, 0.12);
        border: 1px solid rgba(249, 115, 22, 0.3);
        color: #fb923c;
    }
    .badge-level {
        background: rgba(6, 182, 212, 0.12);
        border: 1px solid rgba(6, 182, 212, 0.3);
        color: #22d3ee;
    }
    .badge-numeric {
        background: rgba(20, 184, 166, 0.12);
        border: 1px solid rgba(20, 184, 166, 0.3);
        color: #2dd4bf;
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

    /* Popover Flotante */
    .popover-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 40;
    }

    .selector-popover {
        position: absolute;
        top: 44px;
        right: 12px;
        width: 236px;
        background: #0e0e14;
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.85);
        z-index: 50;
    }

    .popover-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        padding-bottom: 6px;
    }

    .popover-title {
        font-family: "Outfit", sans-serif;
        font-size: 11px;
        font-weight: 700;
        color: #f3f4f6;
    }

    .popover-close {
        background: transparent;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .popover-close:hover {
        color: #fff;
    }

    .popover-section-label {
        font-family: "Outfit", sans-serif;
        font-size: 8px;
        color: #4b5563;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.08em;
        margin-bottom: 2px;
    }

    .metrics-checkbox-list {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-height: 240px;
        overflow-y: auto;
        padding-right: 2px;
    }

    /* Scrollbar personalizada para popover */
    .metrics-checkbox-list::-webkit-scrollbar {
        width: 3px;
    }
    .metrics-checkbox-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 1.5px;
    }

    .metric-checkbox-item {
        display: flex;
        align-items: center;
        padding: 5px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        background: rgba(255, 255, 255, 0.015);
        border: 1px solid rgba(255, 255, 255, 0.02);
        position: relative;
    }

    .metric-checkbox-item input {
        display: none; /* Esconder checkbox nativo */
    }

    .checkbox-custom {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        border: 1px solid rgba(255, 255, 255, 0.25);
        margin-right: 8px;
        display: inline-block;
        transition: all 0.15s ease;
        flex-shrink: 0;
    }

    .metric-name-text {
        font-family: "Inter", sans-serif;
        font-size: 10px;
        color: #9ca3af;
        transition: color 0.15s ease;
    }

    .metric-checkbox-item:hover:not(.disabled) {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.08);
    }

    .metric-checkbox-item:hover:not(.disabled) .metric-name-text {
        color: #fff;
    }

    .metric-checkbox-item.active .metric-name-text {
        color: #fff;
        font-weight: 600;
    }

    .metric-checkbox-item.disabled {
        opacity: 0.3;
        cursor: not-allowed;
        background: transparent;
    }

    .disabled-badge {
        position: absolute;
        right: 6px;
        font-family: "Outfit", sans-serif;
        font-size: 7px;
        font-weight: 800;
        background: rgba(239, 68, 68, 0.18);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444;
        padding: 0.5px 4px;
        border-radius: 3px;
        text-transform: uppercase;
    }

    .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
    }

    .popover-controls-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .smoothing-options {
        display: flex;
        gap: 3px;
        margin-top: 3px;
    }

    .smoothing-btn {
        flex: 1;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: #888;
        padding: 4px 0;
        border-radius: 5px;
        cursor: pointer;
        font-size: 8px;
        font-family: "Inter", sans-serif;
        transition: all 0.15s ease;
    }

    .smoothing-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ccc;
    }

    .smoothing-btn.active {
        background: #00ff88;
        color: #050507;
        border-color: #00ff88;
        font-weight: 700;
    }

    .action-btn {
        background: rgba(255, 255, 255, 0.05);
        color: #e5e7eb;
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 6px;
        border-radius: 6px;
        font-weight: 700;
        cursor: pointer;
        font-size: 9px;
        font-family: "Outfit", sans-serif;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.18);
        color: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .mini-style-edit-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        margin-left: auto;
        border-radius: 4px;
        transition: all 0.15s ease;
    }

    .mini-style-edit-btn:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
    }

    .style-customizer-panel {
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 2px;
        margin-bottom: 4px;
        box-sizing: border-box;
    }

    .customizer-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .customizer-label {
        font-family: "Outfit", sans-serif;
        font-size: 8px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        font-weight: 700;
    }

    .color-picker-input {
        background: transparent;
        border: none;
        width: 24px;
        height: 18px;
        cursor: pointer;
        padding: 0;
    }

    .width-slider {
        flex: 1;
        max-width: 90px;
        accent-color: #00ff88;
        height: 3px;
        cursor: pointer;
    }

    .style-toggle-buttons {
        display: flex;
        gap: 4px;
    }

    .style-toggle-btn {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: #888;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 7px;
        font-family: "Inter", sans-serif;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .style-toggle-btn.active {
        background: rgba(0, 255, 136, 0.12);
        border-color: #00ff88;
        color: #00ff88;
        font-weight: 700;
    }
</style>
