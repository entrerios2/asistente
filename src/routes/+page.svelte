<script lang="ts">
    import { onMount } from 'svelte';
    import Header from '../components/medicion/Header.svelte';
    import Sidebar from '../components/medicion/Sidebar.svelte';
    import ViewGrid from '../components/medicion/ViewGrid.svelte';
    import CaptureModal from '../components/medicion/CaptureModal.svelte';
    import { traceManager, UBICACION_COLORS, type InstantaneaTags } from '$lib/stores/traceManager.svelte';
    import { uiStore } from '$lib/stores/ui.svelte';
    import { mathOrchestrator } from '$lib/stores/mathOrchestrator.svelte';
    import { loadConfig, saveConfig, loadDefaults } from "$lib/utils/configPersistence";
    import { eqStore } from '$lib/stores/eqStore.svelte';
    import { targetTrace } from '$lib/stores/targetTrace.svelte';
    import { calibrationStore } from '$lib/stores/calibrationStore.svelte';
    import { base } from '$app/paths';

    // Extracted config application to share between sync and async paths
    function applyConfig(config: Partial<import('$lib/utils/configPersistence').PersistedConfig>) {
        if (config.layout) uiStore.setLayout(config.layout);
        if (config.themeMode) uiStore.setThemeMode(config.themeMode);
        if (config.audioInDevice) uiStore.audioInDevice = config.audioInDevice;
        if (config.audioOutDevice) uiStore.audioOutDevice = config.audioOutDevice;
        if (config.sampleRate) uiStore.sampleRate = config.sampleRate;
        if (config.fftSize) uiStore.fftSize = config.fftSize;
        if (config.dspBaseRate) uiStore.dspBaseRate = config.dspBaseRate;
        else if (config.dspUpdateRate) uiStore.dspBaseRate = config.dspUpdateRate; // legacy
        if (config.targetFpsMultiplier) uiStore.targetFpsMultiplier = config.targetFpsMultiplier;
        else if (config.targetFps !== undefined) {
            // legacy: infer multiplier from targetFps / base
            const inferred = Math.round(config.targetFps / uiStore.dspBaseRate);
            uiStore.targetFpsMultiplier = Math.max(1, Math.min(inferred, 4));
        }
        if (config.metricDecimation) {
            Object.assign(uiStore.metricDecimation, config.metricDecimation);
        }
        if (config.weightingType) uiStore.weightingType = config.weightingType as any;
        if (config.averagingType) uiStore.averagingType = config.averagingType as any;
        if (config.averagingDepth !== undefined) uiStore.averagingDepth = config.averagingDepth;
        if (config.averagingAlpha !== undefined) uiStore.averagingAlpha = config.averagingAlpha;
        if (config.besselSpeed) uiStore.besselSpeed = config.besselSpeed as any;
        if (config.ppoSmoothing !== undefined) uiStore.ppoSmoothing = config.ppoSmoothing;
        if (config.fftOverlap !== undefined) uiStore.fftOverlap = config.fftOverlap as any;
        if (config.windowType) uiStore.windowType = config.windowType as any;
        if (config.inputGain !== undefined) uiStore.inputGain = config.inputGain;
        if (config.displayOffset !== undefined) uiStore.displayOffset = config.displayOffset;
        if (config.polarity !== undefined) uiStore.polarity = config.polarity;
        if (config.inputFilter) uiStore.inputFilter = config.inputFilter as any;
        if (config.compensationDelayMs !== undefined) uiStore.compensationDelayMs = config.compensationDelayMs;
        if (config.autoDelayCompensation !== undefined) uiStore.autoDelayCompensation = config.autoDelayCompensation;
        if (config.refChannel !== undefined) uiStore.refChannel = config.refChannel;
        if (config.measChannel !== undefined) uiStore.measChannel = config.measChannel;
        if (config.generatorType) uiStore.generatorType = config.generatorType;
        if (config.genLevel !== undefined) uiStore.genLevel = config.genLevel;
        if (config.genRouting) uiStore.genRouting = config.genRouting as any;
        if (config.linkGeneratorToMeasurement !== undefined) uiStore.linkGeneratorToMeasurement = config.linkGeneratorToMeasurement;
        if (config.enableLeq !== undefined) uiStore.enableLeq = config.enableLeq;
        if (config.enableSourceWindow !== undefined) uiStore.enableSourceWindow = config.enableSourceWindow;
        if (config.sourceWindowWidthMs !== undefined) uiStore.sourceWindowWidthMs = config.sourceWindowWidthMs;
        if (config.sourceWindowOffsetMs !== undefined) uiStore.sourceWindowOffsetMs = config.sourceWindowOffsetMs;
        if (config.genFreq !== undefined) uiStore.genFreq = config.genFreq;
        if (config.autoSaveSnapshotOnStop !== undefined) uiStore.autoSaveSnapshotOnStop = config.autoSaveSnapshotOnStop;
        if (config.measurementMode) uiStore.measurementMode = config.measurementMode;
        if (config.leqWindowSeconds !== undefined) uiStore.leqWindowSeconds = config.leqWindowSeconds;
        if (config.averagingThresholdDb !== undefined) uiStore.averagingThresholdDb = config.averagingThresholdDb;
        if (config.showAdvanced !== undefined) uiStore.showAdvanced = config.showAdvanced;
        if (config.showMinorGrid !== undefined) uiStore.showMinorGrid = config.showMinorGrid;
        if (config.palette) uiStore.setPalette(config.palette);
        if (config.canvasTheme) uiStore.setCanvasTheme(config.canvasTheme);
        eqStore.loadFromConfig(config);
        targetTrace.loadFromConfig(config);
        calibrationStore.loadFromConfig(config);
        traceManager.loadFromConfig(config);
    }

    onMount(() => {
        // Cargar configuración: localStorage > /defaults.json > hardcoded
        const config = loadConfig();
        if (config) {
            applyConfig(config);
        } else {
            // No localStorage: try /defaults.json asynchronously
            loadDefaults(base).then((defaults) => {
                if (defaults) {
                    applyConfig(defaults);
                } else {
                    uiStore.setLayout('1x1');
                }
            });
        }

        // Hotkeys globales
        const handleKey = (e: KeyboardEvent) => {
            // No interceptar hotkeys cuando el usuario escribe en inputs
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.code === 'Space') {
                e.preventDefault();
                traceManager.captureInstantaneaFromLive('Captura manual', 'manual');
            } else if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                const snapshots = traceManager.instantaneas;
                if (snapshots[index]) {
                    traceManager.toggleVisibility(snapshots[index].id);
                }
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    });

    $effect(() => {
        saveConfig({
            _version: 5,
            layout: uiStore.layout,
            themeMode: uiStore.themeMode,
            audioInDevice: uiStore.audioInDevice,
            audioOutDevice: uiStore.audioOutDevice,
            sampleRate: uiStore.sampleRate,
            fftSize: uiStore.fftSize,
            dspUpdateRate: uiStore.dspBaseRate,
            dspBaseRate: uiStore.dspBaseRate,
            targetFpsMultiplier: uiStore.targetFpsMultiplier,
            metricDecimation: uiStore.metricDecimation,
            // DSP advanced
            weightingType: uiStore.weightingType,
            averagingType: uiStore.averagingType,
            averagingDepth: uiStore.averagingDepth,
            averagingAlpha: uiStore.averagingAlpha,
            besselSpeed: uiStore.besselSpeed,
            ppoSmoothing: uiStore.ppoSmoothing,
            fftOverlap: uiStore.fftOverlap,
            windowType: uiStore.windowType,
            inputGain: uiStore.inputGain,
            displayOffset: uiStore.displayOffset,
            polarity: uiStore.polarity,
            inputFilter: uiStore.inputFilter,
            compensationDelayMs: uiStore.compensationDelayMs,
            autoDelayCompensation: uiStore.autoDelayCompensation,
            refChannel: uiStore.refChannel,
            measChannel: uiStore.measChannel,
            generatorType: uiStore.generatorType,
            genLevel: uiStore.genLevel,
            genRouting: uiStore.genRouting,
            targetFps: uiStore.currentFps,
            linkGeneratorToMeasurement: uiStore.linkGeneratorToMeasurement,
            enableLeq: uiStore.enableLeq,
            enableSourceWindow: uiStore.enableSourceWindow,
            sourceWindowWidthMs: uiStore.sourceWindowWidthMs,
            sourceWindowOffsetMs: uiStore.sourceWindowOffsetMs,
            // uiStore v5
            genFreq: uiStore.genFreq,
            autoSaveSnapshotOnStop: uiStore.autoSaveSnapshotOnStop,
            measurementMode: uiStore.measurementMode,
            leqWindowSeconds: uiStore.leqWindowSeconds,
            averagingThresholdDb: uiStore.averagingThresholdDb,
            // UI preferences
            showAdvanced: uiStore.showAdvanced,
            showMinorGrid: uiStore.showMinorGrid,
            // Theme (v6)
            palette: uiStore.palette,
            canvasTheme: uiStore.canvasTheme,
            ...eqStore.toConfig(),
            ...targetTrace.toConfig(),
            ...calibrationStore.toConfig(),
            ...traceManager.toConfig(),
        });
    });
    // Detectar si estamos en modo Tauri (datos simulados)
    const isTauriMode = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

    // CaptureModal handlers (global, independiente del tab activo)
    let pendingCapture = $derived(traceManager.pendingCaptureForModal);

    async function handleModalSave(tags: InstantaneaTags, name: string, notes?: string) {
        if (!pendingCapture) return;
        const ins = traceManager.instantaneas.find(i => i.id === pendingCapture!.id);
        if (ins) {
            ins.tags = tags;
            ins.name = name;
            ins.notes = notes;
            ins.color = UBICACION_COLORS[tags.ubicacion || ''] || ins.color;
            try {
                const { saveInstantanea } = await import('$lib/utils/db');
                const serializedData: Record<string, ArrayBuffer> = {};
                for (const metric in ins.data) {
                    serializedData[metric] = new Float32Array(ins.data[metric]).buffer.slice(0);
                }
                const plainTags = ins.tags ? JSON.parse(JSON.stringify(ins.tags)) : undefined;
                const plainMeta = ins.metadata ? JSON.parse(JSON.stringify(ins.metadata)) : undefined;
                await saveInstantanea({
                    id: ins.id, name: ins.name, timestamp: ins.timestamp,
                    data: serializedData, visible: ins.visible, color: ins.color,
                    source: ins.source, metric: ins.metric, offsetY: ins.offsetY,
                    tags: plainTags, notes: ins.notes, sessionId: ins.sessionId, metadata: plainMeta,
                });
            } catch (e) {
                console.error('[Page] Error guardando tags:', e);
            }
        }
        traceManager.pendingCaptureForModal = null;
    }

    async function handleModalDiscard() {
        if (pendingCapture) {
            await traceManager.deleteInstantanea(pendingCapture.id);
        }
        traceManager.pendingCaptureForModal = null;
    }
</script>

<div class="app-layout">
    <Header />
    {#if mathOrchestrator.workerError}
        <div style="background: #dc2626; color: white; padding: 8px 16px; font-size: 12px; text-align: center; font-weight: 600;">
            ⚠️ {mathOrchestrator.workerError}
        </div>
    {/if}
    {#if isTauriMode}
        <div style="background: #d97706; color: white; padding: 6px 16px; font-size: 11px; text-align: center; font-weight: 600;">
            ⚠️ Modo Tauri: datos de audio simulados — backend nativo no implementado
        </div>
    {/if}
    <div class="app-container" style="position: relative;">
        {#if uiStore.showSidebar}
            <div class="sidebar-wrapper transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0" style="width: 380px; transition: width 300ms ease, opacity 300ms ease;">
                <Sidebar />
            </div>
        {/if}
        
        <!-- BOTÓN FLOTANTE COLAPSAR/ABRIR SIDEBAR -->
        <button
            class="absolute z-40 w-5 h-12 flex items-center justify-center
                   bg-[#8B0000] border border-[#a00000] rounded-r-lg
                   text-white hover:bg-[#a00000]
                   transition-all duration-300 cursor-pointer shadow-lg"
            style="top: 50%; transform: translateY(-50%); left: {uiStore.showSidebar ? '380px' : '0px'};"
            onclick={() => uiStore.showSidebar = !uiStore.showSidebar}
            title="{uiStore.showSidebar ? 'Colapsar' : 'Abrir'} Panel"
        >
            <span class="material-symbols-outlined text-[14px]">
                {uiStore.showSidebar ? 'chevron_left' : 'chevron_right'}
            </span>
        </button>
        
        <main class="main-viewport">
            <ViewGrid />
        </main>
    </div>
</div>

{#if pendingCapture}
    <CaptureModal
        instantanea={pendingCapture}
        onSave={handleModalSave}
        onDiscard={handleModalDiscard}
    />
{/if}

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        background-color: var(--bg-primary);
        overflow: hidden;
        font-family: 'Inter', -apple-system, sans-serif;
    }

    .app-layout {
        display: flex;
        flex-direction: column;
        width: 100vw;
        height: 100vh;  /* fallback */
        height: 100dvh; /* preferido */
        overflow: hidden;
    }

    .app-container {
        display: flex;
        flex: 1;
        overflow: hidden;
        background: var(--bg-secondary);
    }

    .main-viewport {
        flex: 1;
        height: 100%;
        position: relative;
        overflow: hidden;
    }

    @media (max-width: 768px) {
        .app-container {
            flex-direction: column;
        }

        .sidebar-wrapper {
            width: 100% !important;
            max-height: 45dvh;
            overflow-y: auto;
        }

        .main-viewport {
            flex: 1;
            min-height: 40dvh;
            height: auto;
        }
    }
</style>
