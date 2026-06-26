<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { eqStore } from "$lib/stores/eqStore.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { meterStore } from "$lib/stores/meterStore.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";
    import { targetTrace } from "$lib/stores/targetTrace.svelte";
    import { palettes, type PaletteType } from "$lib/dsp/colorPalettes";
    import { allMetrics, defaultMetricStyles, defaultMetricConfigs, type MetricConfig } from "$lib/dsp/quadrantState";
    import { InterpolationEngine } from "$lib/dsp/interpolationEngine";
    import { EQ_BADGE_X, EQ_BADGE_Y_OFFSET, EQ_BADGE_W_COMPACT, EQ_BADGE_H_COMPACT, EQ_BADGE_W_EXPANDED, EQ_BADGE_H_EXPANDED } from "$lib/dsp/quadrantDraw";
    import { computeEQScoreBadge } from "$lib/dsp/deviationMetrics";
    import { executeDraw, initCanvasAndLoop } from "$lib/stores/useRenderLoop";
    import { getPPOSmoothedValue as _ppoSmooth, isMetricDisabled as _isMetricDisabled, getMetricAlpha as _getMetricAlpha } from "$lib/dsp/quadrantHelpers";
    import { handleEQWheel, handleEQMouseMove, handleEQMouseDown, handleEQMouseUp, type EQContext } from "$lib/dsp/eqInteractionHandlers";
    import { SpectrogramManager } from "$lib/dsp/spectrogramManager";
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
        type InteractionState,
    } from "$lib/dsp/canvasInteraction";

    import ZoomControls from "./ZoomControls.svelte";
    import EQNodePopover from "./EQNodePopover.svelte";
    import MetricConfigPopover from "./MetricConfigPopover.svelte";
    import AddMetricDropdown from "./AddMetricDropdown.svelte";
    import LayerPanel from "./LayerPanel.svelte";



    interface Props {
        id: string;
    }

    let { id }: Props = $props();

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;

    // Lista de métricas activas
    let activeMetrics = $state<string[]>(["Magnitude"]);
    $effect(() => {
        const show = eqStore.showSimulatedResponse;
        untrack(() => {
            const has = activeMetrics.includes("Simulated Magnitude");
            if (show && !has) {
                activeMetrics = [...activeMetrics, "Simulated Magnitude"];
            } else if (!show && has) {
                activeMetrics = activeMetrics.filter(m => m !== "Simulated Magnitude");
            }
        });
    });
    let showEQOverlay = $derived(eqStore.showEQ && eqStore.activeBands.length > 0);
    let draggingEQNode = $state<number | null>(null);
    let hoveringEQNode = $state<number | null>(null);
    let selectedEQNode = $state<number | null>(null);

    let eqScoreHover = $state(false);

    // Compute deviation before/after EQ for badge
    const deviationTarget = $derived(traceManager.getTargetCurve(mathOrchestrator.BINS, uiStore.sampleRate));
    const eqScoreBadge = $derived.by(() => {
        void mathOrchestrator.version;
        void eqStore.activeBandsVersion;
        if (!showEQOverlay || eqStore.activeBands.length === 0) return null;
        return computeEQScoreBadge(
            mathOrchestrator.outputMagnitude, mathOrchestrator.outputCoherence,
            deviationTarget, mathOrchestrator.BINS, uiStore.sampleRate,
            mathOrchestrator.getEQResponseCached.bind(mathOrchestrator),
        );
    });

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

    // Spectrogram state encapsulated in manager
    const spectroMgr = new SpectrogramManager();

    // Precomputar LUT de colores para el espectrograma
    const spectrogramLUT_RGBA = $derived.by(() => {
        const paletteName = metricConfigs["Spectrogram"]?.palette || "Magma";
        const paletteData = palettes[paletteName as PaletteType];
        const lut = new Uint8ClampedArray(256 * 3);
        if (paletteData) lut.set(paletteData);
        return lut;
    });

    const smoothedMagnitude = new Float32Array(interpEngine.BINS);
    const smoothedSpectrum = new Float32Array(interpEngine.BINS);

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
        return _isMetricDisabled(name, hasTimeDomainActive, hasFreqDomainActive);
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

    const getPPOSmoothedValue = (bin: number, data: Float32Array, ppo: number) =>
        _ppoSmooth(bin, data, ppo, uiStore.sampleRate, BINS);
    const getMetricAlpha = (metric: string) => _getMetricAlpha(metric, soloMetric, hoverMetric);

    // CORE DRAW ENGINE
    let _cachedCtx: CanvasRenderingContext2D | null = null;
    const _boundGetEQResponse = mathOrchestrator.getEQResponseCached.bind(mathOrchestrator);
    const _boundGetEQPhase = mathOrchestrator.getEQPhaseCached.bind(mathOrchestrator);

    /** Build EQ context snapshot for interaction handlers */
    function getEQContext(): EQContext {
        return {
            showEQOverlay, eqType: eqStore.eqType, activeBands: eqStore.activeBands,
            hoveringEQNode, draggingEQNode, eqScoreHover, eqScoreBadge,
            containerWidth, containerHeight, metricConfigs, interactionState,
            badgeX: EQ_BADGE_X, badgeYOffset: EQ_BADGE_Y_OFFSET,
            badgeWCompact: EQ_BADGE_W_COMPACT, badgeHCompact: EQ_BADGE_H_COMPACT,
            badgeWExpanded: EQ_BADGE_W_EXPANDED, badgeHExpanded: EQ_BADGE_H_EXPANDED,
        };
    }

    /** Apply EQ interaction result to component state */
    function applyEQResult(r: ReturnType<typeof handleEQMouseMove>) {
        if (r.hoveringEQNode !== undefined) hoveringEQNode = r.hoveringEQNode;
        if (r.draggingEQNode !== undefined) draggingEQNode = r.draggingEQNode;
        if (r.selectedEQNode !== undefined) selectedEQNode = r.selectedEQNode;
        if (r.eqScoreHover !== undefined) eqScoreHover = r.eqScoreHover;

        if (r.bandUpdates) {
            for (const u of r.bandUpdates) eqStore.updateBand(u.index, u.field, u.value);
        }
    }

    function draw() {
        const result = executeDraw({
            canvas, cachedCtx: _cachedCtx,
            activeMetrics, hasTimeDomainActive, metricConfigs, metricStyles, interactionState,
            isDarkMode: uiStore.isDarkMode, sampleRate: uiStore.sampleRate, BINS, interpEngine,
            localLastVersion, dirty, smoothedMagnitude, smoothedSpectrum,
            getPPOSmoothedValue, getMetricValueInterpolated, getImpulseValueInterpolated, getMetricAlpha,
            getEQResponseCached: _boundGetEQResponse, getEQPhaseCached: _boundGetEQPhase,
            mathOrchestratorRef: mathOrchestrator,
            showEQOverlay,
            refreshEQCache: () => mathOrchestrator.refreshEQCache(),
            updateCalculatedLayers: () => traceManager.updateCalculatedLayers(),
            orchestratorVersion: mathOrchestrator.version,
            liveData: interpEngine.interpSpectrum, frequencyLUT,
            myLayers, quadrantLayers, instantaneas: traceManager.instantaneas,
            eqBands: eqStore.activeBands, hoveringEQNode, draggingEQNode, selectedEQNode,
            eqScoreBadge, eqScoreHover,
            offscreenCanvas: spectroMgr.offscreenCanvas, offscreenCtx: spectroMgr.offscreenCtx,
            spectrogramLUT_RGBA, spectrogramFrameCountRef: spectroMgr.frameCount,
            initOffscreenCanvas: () => spectroMgr.init(containerWidth),
            spectrogramDbHistory: spectroMgr.dbHistory, sharedImageData: spectroMgr.sharedImageData,
            targetTrace, meterStore,
            hReal: interpEngine.interpHReal, hImag: interpEngine.interpHImag,
            outputCrestFactor: interpEngine.interpCrestFactor,
        });
        if (result) { localLastVersion = result.localLastVersion; dirty = result.dirty; _cachedCtx = result.cachedCtx; }
    }

    // ── EVENT HANDLERS ──
    function handleWheel(e: WheelEvent) {
        const r = handleEQWheel(e.deltaY, getEQContext());
        if (r?.consumed) { e.preventDefault(); e.stopPropagation(); applyEQResult(r); return; }
        interactionHandleWheel(e, interactionState, canvas, containerWidth, containerHeight, activeMetrics, metricConfigs, hasTimeDomainActive);
    }

    function handleMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        applyEQResult(handleEQMouseMove(mx, my, e.shiftKey, e.ctrlKey, getEQContext()));
        interactionHandleMouseMove(e, interactionState, canvas, containerWidth, containerHeight, hasTimeDomainActive, activeMetrics, metricConfigs);
    }

    function handleMouseDown(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const r = handleEQMouseDown(e.clientX - rect.left, e.clientY - rect.top, getEQContext());
        if (r?.consumed) { applyEQResult(r); e.preventDefault(); e.stopPropagation(); return; }
        if (r) applyEQResult(r); // close popover on click outside
        interactionHandleMouseDown(e, interactionState);
    }

    function handleMouseUp() {
        const r = handleEQMouseUp(getEQContext());
        if (r?.consumed) { applyEQResult(r); return; }
        interactionHandleMouseUp(interactionState, containerWidth, containerHeight, hasTimeDomainActive, activeMetrics, metricConfigs);
    }

    function handleTouchStart(e: TouchEvent) { e.preventDefault(); interactionHandleTouchStart(e, interactionState); }
    function handleTouchMove(e: TouchEvent) { e.preventDefault(); interactionHandleTouchMove(e, interactionState, canvas, activeMetrics, metricConfigs); }
    function handleTouchEnd() { interactionHandleTouchEnd(interactionState, containerWidth, containerHeight, hasTimeDomainActive, activeMetrics, metricConfigs); }
    function handleDoubleClick() {
        // If hovering an EQ node, toggle mute instead of resetting zoom
        if (showEQOverlay && hoveringEQNode !== null && eqStore.eqType === 'parametrico') {
            eqStore.toggleMute(hoveringEQNode);
            return;
        }
        interactionHandleDoubleClick(interactionState);
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
        // Inicializar capa por defecto si no existen capas para este cuadrante
        if (traceManager.layers.filter((l) => l.quadrantId === id).length === 0) {
            traceManager.addLayer(`Capa ${traceManager.layers.length + 1}`, id, "live");
        }

        const cleanupLoop = initCanvasAndLoop(
            container, canvas, draw,
            () => uiStore.targetFps,
            (w, h) => { containerWidth = w; containerHeight = h; },
        );

        return () => { cleanupLoop(); mathOrchestrator.unregisterQuadrant(id); };
    });

    $effect(() => { mathOrchestrator.registerQuadrantMetrics(id, activeMetrics); });
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
                            <span class="absolute -top-0.5 -right-0.5 w-[5px] h-[5px] rounded-full bg-[var(--accent)]" title="Tiene configuración personalizada"></span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        <!-- ETIQUETA DE CAPA ACTIVA + BOTÓN DE CAPAS CON BADGE (CON ML-AUTO Y BOTÓN SETTINGS INTEGRADO) -->
        <div class="flex items-center gap-1.5 ml-auto">
            <LayerPanel quadrantId={id} {quadrantLayers} {showEQOverlay} onToggleEQ={() => eqStore.showEQ = !eqStore.showEQ} />
        </div>
    </div>

    <!-- CANVAS DEL GRÁFICO -->
    <canvas bind:this={canvas} style="cursor: {cursorStyle}"></canvas>

    <!-- WATERMARK ID DEL CUADRANTE -->
    <span
        class="absolute bottom-2 right-3 text-[108px] font-black pointer-events-none select-none leading-none"
        style="color: color-mix(in srgb, var(--accent) 12%, transparent);
                 -webkit-text-stroke: 1.5px color-mix(in srgb, var(--accent) 20%, transparent);"
    >
        {id.replace(/[qQ]-?/g, "")}
    </span>

    <!-- BOTÓN ÚNICO DE ZOOM CON MENÚ -->
    <ZoomControls bind:interactionState onDoubleClick={handleDoubleClick} />



    <!-- P4c: EQ Node Popover (bottom-anchored) -->
    {#if selectedEQNode !== null && showEQOverlay && eqStore.activeBands[selectedEQNode]}
        <EQNodePopover
            nodeIndex={selectedEQNode}
            {containerWidth}
            onClose={() => selectedEQNode = null}
        />
    {/if}

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
        background: var(--canvas-bg);
        border: 1px solid var(--canvas-grid);
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
        background: var(--bg-deep, #0c0c10);
        border-bottom: 1px solid var(--canvas-grid);
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

