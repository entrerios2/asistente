<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { eqStore } from "$lib/stores/eqStore.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { meterStore } from "$lib/stores/meterStore.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";

    import { targetTrace } from "$lib/stores/targetTrace.svelte";
    import { palettes, type PaletteType } from "$lib/dsp/colorPalettes";
    import {
        allMetrics,
        defaultMetricStyles,
        defaultMetricConfigs,
        type MetricConfig,
    } from "$lib/dsp/quadrantState";

    import ZoomControls from "./ZoomControls.svelte";

    import MetricConfigPopover from "./MetricConfigPopover.svelte";
    import AddMetricDropdown from "./AddMetricDropdown.svelte";
    import LayerPanel from "./LayerPanel.svelte";

    import { InterpolationEngine } from "$lib/dsp/interpolationEngine";
    import { drawQuadrant } from "$lib/dsp/quadrantDraw";
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
        valToX,
        valToY,
        xToVal,
        yToVal,
        type InteractionState,
    } from "$lib/dsp/canvasInteraction";



    interface Props {
        id: string;
    }

    let { id }: Props = $props();

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;

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


    let metricStyles = $state<
        Record<string, { color: string; lineWidth: number; lineDash: number[] }>
    >(JSON.parse(JSON.stringify(defaultMetricStyles)));

    let activeConfigMetric = $state<string | null>(null);
    let popoverAnchorRect = $state<{ top: number; left: number } | null>(null);
    let metricConfigs = $state<Record<string, MetricConfig>>(
        JSON.parse(JSON.stringify(defaultMetricConfigs)),
    );

    let frequencyLUT = $state<Int32Array>(new Int32Array(0));
    let hoverMetric = $state<string | null>(null);
    let soloMetric = $state<string | null>(null);

    // Dimensiones reactivas del contenedor físico
    let containerWidth = $state(0);
    let containerHeight = $state(0);

    let cursorStyle = $derived.by(() => {
        if (draggingEQNode !== null) return "grabbing";
        if (hoveringEQNode !== null) return "grab";
        if (interactionState.isDragging) return "grabbing";
        const mX = interactionState.mouseX;
        const mY = interactionState.mouseY;
        if (mX <= 45) return "ns-resize";
        if (mY >= containerHeight - 25) return "ew-resize";
        return "crosshair";
    });

    // Zoom & Pan state
    let interactionState = $state<InteractionState>({
        zoomX: 1,
        zoomY: 0.7,
        zoomMode: "XY" as const,
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
        showCrosshair: false,
    });

    // Motor de interpolación
    const interpEngine = new InterpolationEngine();

    const quadrantLayers = $derived(
        traceManager.layers.filter((l) => l.quadrantId === id),
    );
    const myLayers = $derived(
        traceManager.layers.filter((l) => l.quadrantId === id && l.visible),
    );



    $effect(() => {
        frequencyLUT = rebuildFrequencyLUT(
            containerWidth,
            interactionState,
            interpEngine.BINS,
            uiStore.sampleRate,
        );
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
                activeMetrics = activeMetrics.filter(
                    (m) => m !== "Simulated Magnitude",
                );
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
    let spectrogramFrameCount = { value: 0 };
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
        return interpEngine.getMetricValueInterpolated(
            freq,
            dataArray,
            uiStore.sampleRate,
        );
    }

    // Ayudante de interpolación circular para el dominio del tiempo
    function getImpulseValueInterpolated(
        timeMs: number,
        impulseArray: Float32Array,
    ): number {
        return interpEngine.getImpulseValueInterpolated(
            timeMs,
            impulseArray,
            uiStore.sampleRate,
        );
    }

    // Lógica reactiva derivada para exclusiones Cartesianas
    const hasTimeDomainActive = $derived(
        activeMetrics.includes("Impulse") ||
            activeMetrics.includes("Step") ||
            activeMetrics.includes("Scope"),
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

    function getPPOSmoothedValue(
        binIndex: number,
        dataArray: Float32Array,
        ppo: number,
    ): number {
        if (ppo >= 48) return dataArray[binIndex];

        const octaveFraction = 1 / ppo;
        const binWidth = uiStore.sampleRate / 2 / BINS;
        const freq = binIndex * binWidth || 1e-6;

        const f_start = freq * Math.pow(2, -octaveFraction / 2);
        const f_end = freq * Math.pow(2, octaveFraction / 2);

        const k_start = Math.max(0, Math.round(f_start / binWidth));
        const k_end = Math.min(
            dataArray.length - 1,
            Math.round(f_end / binWidth),
        );

        let sum = 0;
        let count = 0;
        for (let k = k_start; k <= k_end; k++) {
            sum += dataArray[k];
            count++;
        }
        return count > 0 ? sum / count : dataArray[binIndex];
    }

    // CORE DRAW ENGINE
    // Pre-cached references para evitar crear objetos nuevos en cada frame
    let _cachedCtx: CanvasRenderingContext2D | null = null;
    const _identitySmooth = (idx: number, arr: Float32Array) => arr[idx];
    const _boundGetEQResponse = mathOrchestrator.getEQResponseCached.bind(mathOrchestrator);
    const _boundGetEQPhase = mathOrchestrator.getEQPhaseCached.bind(mathOrchestrator);

    function draw() {
        if (!canvas) return;
        if (!_cachedCtx) _cachedCtx = canvas.getContext("2d");
        const ctx = _cachedCtx;
        if (!ctx) return;
        if (canvas.width === 0 || canvas.height === 0) return;

        // Detectar context loss
        if (typeof ctx.isContextLost === 'function' && ctx.isContextLost()) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        // Aplicar transformación en cada frame (defensivo contra resets por resize)
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // Envolver todo en try/catch para evitar que errores transitorios
        // (ej. buffers con tamaño inesperado durante resize/init) congelen el render loop
        try {
            // Actualizar capas calculadas antes de dibujar
            traceManager.updateCalculatedLayers();

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
                    smoothedMagnitude[i] = getPPOSmoothedValue(
                        i,
                        interpEngine.interpMagnitude,
                        magPPO,
                    );
                }
            } else {
                // Guard: source may be larger than BINS (e.g., worker sends different FFT size)
                if (interpEngine.interpMagnitude.length > BINS) {
                    smoothedMagnitude.set(interpEngine.interpMagnitude.subarray(0, BINS));
                } else {
                    smoothedMagnitude.set(interpEngine.interpMagnitude);
                }
            }

            const specPPO = metricConfigs["Spectrum"]?.smoothingPPO || 48;
            const hasLive = liveData && liveData.length > 0;
            const rawSpec = hasLive ? liveData : interpEngine.interpMagnitude;
            if (activeMetrics.includes("Spectrum") && specPPO < 48) {
                const loopLen = Math.min(BINS, rawSpec.length);
                for (let i = 0; i < loopLen; i++) {
                    smoothedSpectrum[i] = getPPOSmoothedValue(i, rawSpec, specPPO);
                }
            } else {
                // Guard: rawSpec (liveData) may be larger than BINS
                if (rawSpec.length > BINS) {
                    smoothedSpectrum.set(rawSpec.subarray(0, BINS));
                } else {
                    smoothedSpectrum.set(rawSpec);
                }
            }

            drawQuadrant({
                ctx,
                width,
                height,
                activeMetrics,
                hasTimeDomainActive,
                metricConfigs,
                metricStyles,
                interactionState,
                isDarkMode: uiStore.isDarkMode,
                sampleRate: uiStore.sampleRate,
                BINS,
                interpEngine,
                liveData,
                frequencyLUT,
                smoothedMagnitude,
                smoothedSpectrum,
                getPPOSmoothedValue,
                getMetricValueInterpolated,
                getImpulseValueInterpolated,
                getMetricAlpha,
                getEQResponseCached: _boundGetEQResponse,
                getEQPhaseCached: _boundGetEQPhase,
                myLayers,
                quadrantLayers,
                instantaneas: traceManager.instantaneas,
                showEQOverlay,
                eqBands: eqStore.activeBands,
                hoveringEQNode,
                draggingEQNode,
                offscreenCanvas,
                offscreenCtx,
                spectrogramLUT_RGBA,
                spectrogramFrameCountRef: spectrogramFrameCount,
                initOffscreenCanvas,
                spectrogramDbHistory,
                sharedImageData,
                targetTrace,
                meterStore,
                hReal: mathOrchestrator.hReal,
                hImag: mathOrchestrator.hImag,
                outputCrestFactor: mathOrchestrator.outputCrestFactor,
                containerWidth: width,
                containerHeight: height,
                customPPOSmooth: _identitySmooth,
            });
        } catch {
            // Error silencioso — evitar crash del render loop
        }
    }

    // GESTORES DE EVENTOS DELEGADOS (PAN & ZOOM)
    function handleWheel(e: WheelEvent) {
        interactionHandleWheel(
            e,
            interactionState,
            canvas,
            containerWidth,
            containerHeight,
            activeMetrics,
            metricConfigs,
            hasTimeDomainActive,
        );
    }

    function handleMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Hit-test nodos EQ (solo si overlay visible y hay bandas)
        if (
            showEQOverlay &&
            draggingEQNode === null &&
            eqStore.activeBands.length > 0
        ) {
            let found = -1;
            const bands = eqStore.activeBands;
            for (let i = 0; i < bands.length; i++) {
                const nx = valToX(
                    bands[i].freq,
                    containerWidth,
                    false,
                    interactionState,
                );
                const gain = mathOrchestrator.getEQResponseCached(
                    bands[i].freq,
                );
                const ny = valToY(
                    gain,
                    containerHeight,
                    "Magnitude",
                    metricConfigs,
                    interactionState,
                );
                const dx = mouseX - nx;
                const dy = mouseY - ny;
                if (dx * dx + dy * dy < 144) {
                    found = i;
                    break;
                } // 144 = 12^2, evita sqrt
            }
            hoveringEQNode = found >= 0 ? found : null;
        } else if (!showEQOverlay) {
            hoveringEQNode = null;
        }

        // Drag activo de nodo EQ
        if (draggingEQNode !== null) {
            const freq = xToVal(
                mouseX,
                containerWidth,
                false,
                interactionState,
            );
            const gain = yToVal(
                mouseY,
                containerHeight,
                "Magnitude",
                interactionState,
            );
            const clampedFreq = Math.max(20, Math.min(20000, Math.round(freq)));
            const clampedGain = Math.max(
                -30,
                Math.min(30, parseFloat(gain.toFixed(1))),
            );
            // C1 fix: in graphic mode, only allow gain changes (freq is fixed)
            if (eqStore.eqType === 'grafico') {
                eqStore.updateBand(draggingEQNode, "gain", clampedGain);
            } else {
                eqStore.updateBand(draggingEQNode, "freq", clampedFreq);
                eqStore.updateBand(draggingEQNode, "gain", clampedGain);
            }
        }

        interactionHandleMouseMove(
            e,
            interactionState,
            canvas,
            containerWidth,
            containerHeight,
            hasTimeDomainActive,
            activeMetrics,
            metricConfigs,
        );
    }

    function handleMouseDown(e: MouseEvent) {
        if (showEQOverlay && hoveringEQNode !== null) {
            draggingEQNode = hoveringEQNode;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        interactionHandleMouseDown(
            e,
            interactionState,
        );
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
            metricConfigs,
        );
    }

    function handleTouchStart(e: TouchEvent) {
        e.preventDefault();
        interactionHandleTouchStart(e, interactionState);
    }

    function handleTouchMove(e: TouchEvent) {
        e.preventDefault();
        interactionHandleTouchMove(
            e,
            interactionState,
            canvas,
            activeMetrics,
            metricConfigs,
        );
    }

    function handleTouchEnd() {
        interactionHandleTouchEnd(
            interactionState,
            containerWidth,
            containerHeight,
            hasTimeDomainActive,
            activeMetrics,
            metricConfigs,
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



    function onLayerDrop(e: DragEvent) {
        e.preventDefault();
        if (e.dataTransfer) {
            const layerId = e.dataTransfer.getData("text/plain");
            if (layerId) {
                traceManager.moveLayer(layerId, id);
            }
        }
    }

    export function loadInstantaneaIntoLayer(
        layerId: string,
        instId: string,
        metric: string,
    ) {
        const inst = traceManager.instantaneas.find((i) => i.id === instId);
        if (inst && inst.data[metric]) {
            traceManager.setLayerSource(layerId, "snapshot", inst.data[metric]);
        }
    }

    onMount(() => {
        // Inicializar con una capa por defecto si no existen capas para este cuadrante
        if (
            traceManager.layers.filter((l) => l.quadrantId === id).length === 0
        ) {
            traceManager.addLayer(
                `Capa ${traceManager.layers.length + 1}`,
                id,
                "live",
            );
        }

        // Inicializar canvas con dimensiones correctas ANTES del primer draw
        if (container && canvas) {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            containerWidth = rect.width;
            containerHeight = rect.height;
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
        }

        // Observer del redimensionamiento físico del cuadrante
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                containerWidth = width;
                containerHeight = height;
                // Redimensionar canvas buffer inmediatamente (no esperar $effect)
                if (canvas) {
                    const dpr = window.devicePixelRatio || 1;
                    const targetW = Math.round(width * dpr);
                    const targetH = Math.round(height * dpr);
                    if (canvas.width !== targetW || canvas.height !== targetH) {
                        canvas.width = targetW;
                        canvas.height = targetH;
                        canvas.style.width = `${width}px`;
                        canvas.style.height = `${height}px`;
                    }
                }
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

    // NOTA: El canvas se redimensiona directamente en el ResizeObserver callback (onMount).
    // NO usar $effect para resize — causa clear implícito del canvas en Chrome Android.
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
    ondragover={(e) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
    }}
    ondragenter={(e) => {
        e.preventDefault();
        e.currentTarget.style.outline = "2px solid #00ff88";
    }}
    ondragleave={(e) => {
        e.currentTarget.style.outline = "none";
    }}
    ondrop={(e) => {
        e.preventDefault();
        e.currentTarget.style.outline = "none";
        onLayerDrop(e);
    }}
>
    <!-- CABECERA PREMIUM DE CADA CUADRANTE -->
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
        class="quadrant-header flex items-center gap-2 border-b border-[#1a1a24] px-3 py-1.5 min-h-[40px]"
        style="background: var(--bg-primary)"
        onmousedown={(e) => e.stopPropagation()}
        onmouseup={(e) => e.stopPropagation()}
        onclick={(e) => e.stopPropagation()}
        onwheel={(e) => e.stopPropagation()}
        ondblclick={(e) => e.stopPropagation()}
    >
        <div class="quadrant-title-group flex items-center gap-3">
            <!-- Botón "+ Métrica" -->
            <AddMetricDropdown
                {allMetrics}
                bind:activeMetrics
                {isMetricDisabled}
                onToggleMetric={toggleMetric}
            />

            <!-- Pills compactos de métricas (solo texto, clic = config) -->
            <div class="active-metrics-badges flex items-center gap-1">
                {#each activeMetrics as m}
                    {@const isHidden = metricConfigs[m]?.hidden}
                    {@const mStyle = metricStyles[m] || {
                        color: "#888",
                        lineWidth: 1,
                        lineDash: [],
                    }}
                    {@const hasDash = mStyle.lineDash.length > 0}
                    <button
                        class="relative px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer select-none
                               {isHidden ? 'opacity-30 line-through' : ''}"
                        style="color: {soloMetric === m ? '#000' : 'white'};
                               background: {soloMetric === m
                            ? mStyle.color
                            : mStyle.color + '15'};
                               border: 1.5px {hasDash
                            ? 'dashed'
                            : 'solid'} {mStyle.color}{isHidden ? '40' : '80'};"
                        onmouseenter={() => (hoverMetric = m)}
                        onmouseleave={() => (hoverMetric = null)}
                        onclick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            popoverAnchorRect = { top: rect.bottom + 4, left: rect.left };
                            activeConfigMetric = activeConfigMetric === m ? null : m;
                        }}
                        ondblclick={() =>
                            (soloMetric = soloMetric === m ? null : m)}
                        title="{isHidden
                            ? '(Oculta) '
                            : ''}Clic: configurar · Doble clic: modo solo"
                    >
                        {m}
                        {#if metricConfigs[m]?.smoothingPPO || metricConfigs[m]?.modeY || metricConfigs[m]?.invertY || metricConfigs[m]?.enableCoherence || metricConfigs[m]?.yShift}
                            <span class="absolute -top-0.5 -right-0.5 w-[5px] h-[5px] rounded-full bg-[#3b82f6]" title="Tiene configuración personalizada"></span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        <!-- ETIQUETA DE CAPA ACTIVA + BOTÓN DE CAPAS CON BADGE (CON ML-AUTO Y BOTÓN SETTINGS INTEGRADO) -->
        <div class="flex items-center gap-1.5 ml-auto">
            <LayerPanel quadrantId={id} {quadrantLayers} bind:showEQOverlay />
        </div>
    </div>

    <!-- CANVAS DEL GRÁFICO -->
    <canvas bind:this={canvas} style="cursor: {cursorStyle}"></canvas>

    <!-- WATERMARK ID DEL CUADRANTE -->
    <span
        class="absolute bottom-2 right-3 text-[108px] font-black pointer-events-none select-none leading-none"
        style="color: {uiStore.isDarkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.08)'};
                 -webkit-text-stroke: 1.5px {uiStore.isDarkMode
            ? 'rgba(255,255,255,0.15)'
            : 'rgba(0,0,0,0.15)'};"
    >
        {id.replace(/[qQ]-?/g, "")}
    </span>

    <!-- BOTÓN ÚNICO DE ZOOM CON MENÚ -->
    <ZoomControls bind:interactionState onDoubleClick={handleDoubleClick} />



    <!-- POPOVER DE CONFIGURACIÓN POR MÉTRICA (OSM PARIDAD) -->
    <MetricConfigPopover
        bind:activeConfigMetric
        bind:metricConfigs
        bind:metricStyles
        bind:anchorRect={popoverAnchorRect}
        onClose={() => (activeConfigMetric = null)}
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

</style>

