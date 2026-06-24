<script lang="ts">
    import { onMount } from "svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { calibrationStore } from "$lib/stores/calibrationStore.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";
    import { getAudioProvider } from "$lib/hal";
    import { eqStore } from "$lib/stores/eqStore.svelte";
    import { targetTrace } from "$lib/stores/targetTrace.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { exportConfig, importConfig, type PersistedConfig } from "$lib/utils/configPersistence";

    const provider = getAudioProvider();

    let inputDevices = $state<{ id: string; name: string; channels?: number }[]>([]);
    let outputDevices = $state<{ id: string; name: string; channels?: number }[]>([]);



    async function loadDevices() {
        try {
            // @ts-ignore
            if (provider.listDevices) {
                // @ts-ignore
                const devices = await provider.listDevices();
                inputDevices = devices
                    .filter((d: any) => d.direction === "input")
                    .map((d: any) => ({ id: d.id, name: d.name, channels: d.channels }));
                outputDevices = devices
                    .filter((d: any) => d.direction === "output")
                    .map((d: any) => ({ id: d.id, name: d.name, channels: d.channels }));
            } else if (
                navigator.mediaDevices &&
                navigator.mediaDevices.enumerateDevices
            ) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                inputDevices = devices
                    .filter((d) => d.kind === "audioinput")
                    .map((d) => ({
                        id: d.deviceId || "default",
                        name: d.label || "Micrófono del Sistema",
                        channels: 2
                    }));
                outputDevices = devices
                    .filter((d) => d.kind === "audiooutput")
                    .map((d) => ({
                        id: d.deviceId || "default",
                        name: d.label || "Altavoces del Sistema",
                        channels: 2
                    }));
            }
        } catch (e) {
            console.error("Error cargando dispositivos de audio:", e);
        }

        if (inputDevices.length === 0) {
            inputDevices = [
                {
                    id: "in-default",
                    name: "Micrófono de Sistema (Predeterminado)",
                    channels: 2
                },
                { id: "in-focusrite", name: "Focusrite Scarlett 2i2 USB In", channels: 2 },
                { id: "in-motu", name: "MOTU M2 Audio Interface In", channels: 2 },
                { id: "in-webcam", name: "Micrófono de Cámara Web USB", channels: 1 },
            ];
        }
        if (outputDevices.length === 0) {
            outputDevices = [
                {
                    id: "out-default",
                    name: "Altavoces de Sistema (Predeterminado)",
                    channels: 2
                },
                { id: "out-focusrite", name: "Focusrite Scarlett 2i2 USB Out", channels: 2 },
                { id: "out-motu", name: "MOTU M2 Audio Interface Out", channels: 2 },
                { id: "out-headphones", name: "Auriculares Estéreo Bluetooth", channels: 2 },
            ];
        }
    }

    onMount(async () => {
        await loadDevices();
    });


    const accentBg = 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] shadow';
    const inactiveBtn = 'text-[var(--text-muted)] hover:text-[var(--text-primary)]';

    // ─── Guardar/Abrir/Resetear ───
    let showResetModal = $state(false);
    let resetCategories = $state({
        hardware: false,
        dsp: false,
        generador: false,
        calibracion: false,
        eq: false,
        autoEQ: false,
        targetCurve: false,
        captura: false,
        pantalla: false,
    });

    function buildCurrentConfig(): PersistedConfig {
        return {
            _version: 5,
            layout: uiStore.layout,
            themeMode: uiStore.themeMode,
            audioInDevice: uiStore.audioInDevice,
            audioOutDevice: uiStore.audioOutDevice,
            sampleRate: uiStore.sampleRate,
            fftSize: uiStore.fftSize,
            dspUpdateRate: uiStore.dspUpdateRate,
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
            targetFps: uiStore.targetFps,
            linkGeneratorToMeasurement: uiStore.linkGeneratorToMeasurement,
            enableLeq: uiStore.enableLeq,
            enableSourceWindow: uiStore.enableSourceWindow,
            sourceWindowWidthMs: uiStore.sourceWindowWidthMs,
            sourceWindowOffsetMs: uiStore.sourceWindowOffsetMs,
            genFreq: uiStore.genFreq,
            autoSaveSnapshotOnStop: uiStore.autoSaveSnapshotOnStop,
            measurementMode: uiStore.measurementMode,
            leqWindowSeconds: uiStore.leqWindowSeconds,
            averagingThresholdDb: uiStore.averagingThresholdDb,
            showAdvanced: uiStore.showAdvanced,
            showMinorGrid: uiStore.showMinorGrid,
            palette: uiStore.palette,
            canvasTheme: uiStore.canvasTheme,
            ...eqStore.toConfig(),
            ...targetTrace.toConfig(),
            ...calibrationStore.toConfig(),
            ...traceManager.toConfig(),
        };
    }

    function handleSaveConfig() {
        const json = exportConfig(buildCurrentConfig());
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `asistente-config-${new Date().toISOString().slice(0, 10)}.ca.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleOpenConfig(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const json = evt.target?.result as string;
            const config = importConfig(json);
            if (!config) {
                alert('El archivo no es una configuración válida.');
                return;
            }
            // Aplicar a todos los stores
            const c = config as any;
            if (c.layout) uiStore.setLayout(c.layout);
            if (c.themeMode) uiStore.setThemeMode(c.themeMode);
            if (c.audioInDevice) uiStore.audioInDevice = c.audioInDevice;
            if (c.audioOutDevice) uiStore.audioOutDevice = c.audioOutDevice;
            if (c.sampleRate) uiStore.sampleRate = c.sampleRate;
            if (c.fftSize) uiStore.fftSize = c.fftSize;
            if (c.dspUpdateRate) uiStore.dspUpdateRate = c.dspUpdateRate;
            if (c.weightingType) uiStore.weightingType = c.weightingType;
            if (c.averagingType) uiStore.averagingType = c.averagingType;
            if (c.averagingDepth !== undefined) uiStore.averagingDepth = c.averagingDepth;
            if (c.averagingAlpha !== undefined) uiStore.averagingAlpha = c.averagingAlpha;
            if (c.besselSpeed) uiStore.besselSpeed = c.besselSpeed;
            if (c.ppoSmoothing !== undefined) uiStore.ppoSmoothing = c.ppoSmoothing;
            if (c.fftOverlap !== undefined) uiStore.fftOverlap = c.fftOverlap;
            if (c.windowType) uiStore.windowType = c.windowType;
            if (c.inputGain !== undefined) uiStore.inputGain = c.inputGain;
            if (c.displayOffset !== undefined) uiStore.displayOffset = c.displayOffset;
            if (c.polarity !== undefined) uiStore.polarity = c.polarity;
            if (c.inputFilter) uiStore.inputFilter = c.inputFilter;
            if (c.compensationDelayMs !== undefined) uiStore.compensationDelayMs = c.compensationDelayMs;
            if (c.autoDelayCompensation !== undefined) uiStore.autoDelayCompensation = c.autoDelayCompensation;
            if (c.refChannel !== undefined) uiStore.refChannel = c.refChannel;
            if (c.measChannel !== undefined) uiStore.measChannel = c.measChannel;
            if (c.generatorType) uiStore.generatorType = c.generatorType;
            if (c.genLevel !== undefined) uiStore.genLevel = c.genLevel;
            if (c.genRouting) uiStore.genRouting = c.genRouting;
            if (c.targetFps !== undefined) uiStore.targetFps = c.targetFps;
            if (c.linkGeneratorToMeasurement !== undefined) uiStore.linkGeneratorToMeasurement = c.linkGeneratorToMeasurement;
            if (c.enableLeq !== undefined) uiStore.enableLeq = c.enableLeq;
            if (c.enableSourceWindow !== undefined) uiStore.enableSourceWindow = c.enableSourceWindow;
            if (c.sourceWindowWidthMs !== undefined) uiStore.sourceWindowWidthMs = c.sourceWindowWidthMs;
            if (c.sourceWindowOffsetMs !== undefined) uiStore.sourceWindowOffsetMs = c.sourceWindowOffsetMs;
            if (c.genFreq !== undefined) uiStore.genFreq = c.genFreq;
            if (c.autoSaveSnapshotOnStop !== undefined) uiStore.autoSaveSnapshotOnStop = c.autoSaveSnapshotOnStop;
            if (c.measurementMode) uiStore.measurementMode = c.measurementMode;
            if (c.leqWindowSeconds !== undefined) uiStore.leqWindowSeconds = c.leqWindowSeconds;
            if (c.averagingThresholdDb !== undefined) uiStore.averagingThresholdDb = c.averagingThresholdDb;
            if (c.showAdvanced !== undefined) uiStore.showAdvanced = c.showAdvanced;
            if (c.showMinorGrid !== undefined) uiStore.showMinorGrid = c.showMinorGrid;
            if (c.palette) uiStore.setPalette(c.palette);
            if (c.canvasTheme) uiStore.setCanvasTheme(c.canvasTheme);
            eqStore.loadFromConfig(c);
            targetTrace.loadFromConfig(c);
            calibrationStore.loadFromConfig(c);
            traceManager.loadFromConfig(c);
        };
        reader.readAsText(file);
        // Reset input so same file can be loaded again
        (e.target as HTMLInputElement).value = '';
    }

    function applyReset() {
        const r = resetCategories;
        if (r.hardware) {
            uiStore.audioInDevice = '';
            uiStore.audioOutDevice = '';
            uiStore.refChannel = -1;
            uiStore.measChannel = 1;
        }
        if (r.dsp) {
            uiStore.sampleRate = 48000;
            uiStore.fftSize = 16384;
            uiStore.dspUpdateRate = 4;
            uiStore.weightingType = 'Z' as any;
            uiStore.averagingType = 'LPF' as any;
            uiStore.averagingDepth = 8;
            uiStore.averagingAlpha = 0.1;
            uiStore.besselSpeed = 'Slow' as any;
            uiStore.ppoSmoothing = 0;
            uiStore.fftOverlap = 50 as any;
            uiStore.windowType = 'Hann' as any;
            uiStore.inputFilter = 'None' as any;
            uiStore.compensationDelayMs = 0;
            uiStore.autoDelayCompensation = true;
            uiStore.enableLeq = false;
            uiStore.leqWindowSeconds = 10;
            uiStore.enableSourceWindow = false;
            uiStore.sourceWindowWidthMs = 10.0;
            uiStore.sourceWindowOffsetMs = 0.0;
            uiStore.averagingThresholdDb = -60;
            uiStore.inputGain = 0;
            uiStore.displayOffset = 0;
            uiStore.polarity = false;
        }
        if (r.generador) {
            uiStore.generatorType = 'pink';
            uiStore.genFreq = 1000;
            uiStore.genLevel = 0;
            uiStore.genRouting = 'Stereo' as any;
            uiStore.linkGeneratorToMeasurement = true;
        }
        if (r.calibracion) {
            calibrationStore.resetCalibration();
        }
        if (r.eq) {
            eqStore.resetEQ();
        }
        if (r.autoEQ) {
            eqStore.resetAutoEQ();
        }
        if (r.targetCurve) {
            targetTrace.resetToDefaults();
        }
        if (r.captura) {
            traceManager.resetCaptureConfig();
        }
        if (r.pantalla) {
            uiStore.setLayout('1x1');
            uiStore.setThemeMode('dark');
            uiStore.showMinorGrid = true;
            uiStore.showAdvanced = false;
            uiStore.targetFps = 30;
            uiStore.autoSaveSnapshotOnStop = false;
            uiStore.measurementMode = 'manual';
        }
        showResetModal = false;
        // Reset checkboxes
        resetCategories = { hardware: false, dsp: false, generador: false, calibracion: false, eq: false, autoEQ: false, targetCurve: false, captura: false, pantalla: false };
    }
</script>

{#snippet advIcon()}
    <span class="material-symbols-outlined text-[12px] text-[var(--text-muted)]" title="Control avanzado">tune</span>
{/snippet}

{#snippet sectionHeader(icon: string, iconColor: string, title: string)}
    <div class="flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--border-primary)_30%,transparent)] pb-2">
        <span class="material-symbols-outlined text-lg" style="color: {iconColor}">{icon}</span>
        <h3 class="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">{title}</h3>
    </div>
{/snippet}

<div
    class="flex-1 p-5 overflow-y-auto flex flex-col gap-5"
    id="panel-config"
>
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 1. HARDWARE DE AUDIO (BÁSICO) -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="flex flex-col gap-4 bg-[var(--bg-tertiary)]/40 border border-[color-mix(in_srgb,var(--border-primary)_50%,transparent)] rounded-xl p-4">
        {@render sectionHeader('speaker_group', 'var(--accent)', 'Hardware de audio')}

        <!-- Dispositivo de entrada -->
        <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Dispositivo de entrada</label>
            <select
                bind:value={uiStore.audioInDevice}
                class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
                {#each inputDevices as dev}
                    <option value={dev.id}>{dev.name}</option>
                {/each}
            </select>
        </div>

        <!-- Dispositivo de salida -->
        <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Dispositivo de salida</label>
            <select
                bind:value={uiStore.audioOutDevice}
                class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
                {#each outputDevices as dev}
                    <option value={dev.id}>{dev.name}</option>
                {/each}
            </select>
        </div>

        <!-- Routing dual-channel -->
        <div class="flex flex-col gap-3 pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)]">
            <span class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Routing dual-channel
            </span>

            <!-- Canal de referencia -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Canal de referencia</label>
                <div class="flex bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                    {#each [[-1, 'Loop'], [0, 'Canal 1 (L)'], [1, 'Canal 2 (R)']] as [val, label]}
                        <button
                            class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                   {uiStore.refChannel === val ? accentBg : inactiveBtn}"
                            onclick={() => uiStore.refChannel = val as number}
                        >
                            {label}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Canal de medición -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Canal de medición</label>
                <div class="flex bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                    {#each [[-1, 'Loop'], [0, 'Canal 1 (L)'], [1, 'Canal 2 (R)']] as [val, label]}
                        <button
                            class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                   {uiStore.measChannel === val ? accentBg : inactiveBtn}"
                            onclick={() => uiStore.measChannel = val as number}
                        >
                            {label}
                        </button>
                    {/each}
                </div>
            </div>
        </div>

        <!-- 🔧 AVANZADO: Calibración y ganancia -->
        {#if uiStore.showAdvanced}
            <div class="flex flex-col gap-3 pt-3 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)] transition-all duration-300">
                <div class="flex items-center gap-1.5">
                    {@render advIcon()}
                    <span class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Calibración y ganancia</span>
                </div>

                <!-- Archivo de calibración (.cal / .txt) -->
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Archivo de calibración (.cal / .txt)</label>
                    {#if calibrationStore.calibrationFilename}
                        <div class="flex items-center justify-between bg-[var(--bg-tertiary)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] px-3 py-2 rounded-md text-xs">
                            <span class="text-[var(--accent)] font-mono truncate">{calibrationStore.calibrationFilename}</span>
                            <button
                                class="text-red-400 hover:text-red-300 text-xs font-bold"
                                onclick={() => {
                                    calibrationStore.calibrationPoints = [];
                                    calibrationStore.calibrationFilename = '';
                                }}
                            >
                                Quitar
                            </button>
                        </div>
                    {:else}
                        <input
                            type="file"
                            accept=".cal,.txt"
                            class="hidden"
                            id="cal-file-input"
                            onchange={(e) => {
                                const file = e.currentTarget.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (evt) => {
                                        const txt = evt.target?.result as string;
                                        calibrationStore.loadCalibrationFile(txt, file.name);
                                    };
                                    reader.readAsText(file);
                                }
                            }}
                        />
                        <label
                            for="cal-file-input"
                            class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-gray-500 rounded-md px-3 py-2 text-xs text-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all"
                        >
                            Cargar curva de calibración
                        </label>
                    {/if}
                </div>

                <!-- Ganancia de entrada -->
                <div class="flex flex-col gap-1.5">
                    <div class="flex justify-between items-center text-[10px] font-bold text-[var(--text-muted)] uppercase">
                        <span>Ganancia de entrada</span>
                        <span class="text-[var(--accent)] font-mono">{uiStore.inputGain > 0 ? `+${uiStore.inputGain}` : uiStore.inputGain} dB</span>
                    </div>
                    <input
                        type="range" min="-20" max="20" step="0.5"
                        bind:value={uiStore.inputGain}
                        ondblclick={() => uiStore.inputGain = 0}
                        class="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full appearance-none cursor-pointer accent-[var(--accent)]"
                        title="Doble clic para reiniciar a 0dB"
                    />
                </div>

                <!-- Offset de visualización -->
                <div class="flex flex-col gap-1.5">
                    <div class="flex justify-between items-center text-[10px] font-bold text-[var(--text-muted)] uppercase">
                        <span>Offset de visualización</span>
                        <span class="text-[var(--accent)] font-mono">{uiStore.displayOffset > 0 ? `+${uiStore.displayOffset}` : uiStore.displayOffset} dB</span>
                    </div>
                    <input
                        type="range" min="-100" max="100" step="1"
                        bind:value={uiStore.displayOffset}
                        ondblclick={() => uiStore.displayOffset = 0}
                        class="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full appearance-none cursor-pointer accent-[var(--accent)]"
                        title="Doble clic para reiniciar a 0dB"
                    />
                </div>
            </div>
        {/if}
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 2. COMPENSACIÓN DE RETARDO (BÁSICO) + REINICIAR PROMEDIOS -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="flex flex-col gap-4 bg-[var(--bg-tertiary)]/40 border border-[color-mix(in_srgb,var(--border-primary)_50%,transparent)] rounded-xl p-4">
        {@render sectionHeader('timer', 'var(--accent-green)', 'Compensación de retardo')}

        <label class="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
            <input
                type="checkbox"
                bind:checked={uiStore.autoDelayCompensation}
                class="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
            />
            <span class="font-semibold select-none">Compensación automática de retardo</span>
        </label>
        {#if !uiStore.autoDelayCompensation}
            <div class="flex items-center gap-2 pl-6">
                <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-14">Retardo</span>
                <input
                    type="range" min="0" max="100" step="0.1"
                    bind:value={uiStore.compensationDelayMs}
                    ondblclick={() => uiStore.compensationDelayMs = 0}
                    class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                />
                <span class="text-[10px] font-mono text-[var(--accent)] w-14 text-right">
                    {uiStore.compensationDelayMs.toFixed(1)} ms
                </span>
            </div>
        {/if}

        <!-- Reiniciar promedios -->
        <button
            class="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer border
                   bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)] hover:text-[var(--text-primary)] hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
            onclick={() => mathOrchestrator.resetAveraging()}
            title="Reiniciar todos los promedios"
        >
            <span class="material-symbols-outlined text-sm">restart_alt</span> Reiniciar promedios
        </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 3. PROCESAMIENTO DSP 🔧 (TODO AVANZADO) -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    {#if uiStore.showAdvanced}
        <div class="flex flex-col gap-4 bg-[var(--bg-tertiary)]/40 border border-[color-mix(in_srgb,var(--border-primary)_50%,transparent)] rounded-xl p-4 transition-all duration-300">
            <div class="flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--border-primary)_30%,transparent)] pb-2">
                <span class="material-symbols-outlined text-[#ec4899] text-lg">tune</span>
                <h3 class="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Procesamiento DSP</h3>
                {@render advIcon()}
            </div>

            <!-- Ponderación -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Ponderación (weighting)</label>
                <div class="flex bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                    {#each ['Z', 'A', 'B', 'C'] as wt}
                        <button
                            class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                   {uiStore.weightingType === wt ? accentBg : inactiveBtn}"
                            onclick={() => uiStore.weightingType = wt as 'A' | 'B' | 'C' | 'Z'}
                        >
                            {wt}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Suavizado PPO -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Suavizado (PPO smoothing)</label>
                <div class="flex bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                    {#each [['0', 'Off'], ['1', '1'], ['3', '1/3'], ['6', '1/6'], ['12', '1/12'], ['24', '1/24'], ['48', '1/48']] as [val, label]}
                        <button
                            class="flex-1 py-1.5 text-[9px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                   {String(uiStore.ppoSmoothing) === val ? accentBg : inactiveBtn}"
                            onclick={() => uiStore.ppoSmoothing = Number(val)}
                        >
                            {label}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- FFT Overlap -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">FFT overlap</label>
                <div class="flex bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                    {#each [[0, '0%'], [50, '50%'], [75, '75%']] as [val, label]}
                        <button
                            class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                   {uiStore.fftOverlap === val ? accentBg : inactiveBtn}"
                            onclick={() => uiStore.fftOverlap = val as 0 | 50 | 75}
                        >
                            {label}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Promediado -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Promediado (averaging)</label>
                <div class="flex bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                    {#each [['None', 'Off'], ['FIFO', 'FIFO'], ['EMA', 'EMA'], ['LPF', 'Bessel']] as [val, label]}
                        <button
                            class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                   {uiStore.averagingType === val ? accentBg : inactiveBtn}"
                            onclick={() => uiStore.averagingType = val as 'None' | 'FIFO' | 'EMA' | 'LPF'}
                        >
                            {label}
                        </button>
                    {/each}
                </div>
                {#if uiStore.averagingType === 'FIFO'}
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-16">Profundidad</span>
                        <input
                            type="range" min="2" max="64" step="1"
                            bind:value={uiStore.averagingDepth}
                            ondblclick={() => uiStore.averagingDepth = 8}
                            class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                            title="Doble clic para reiniciar a 8"
                        />
                        <span class="text-[10px] font-mono text-[var(--accent)] w-8 text-right">{uiStore.averagingDepth}</span>
                    </div>
                {:else if uiStore.averagingType === 'EMA'}
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-16">Alpha</span>
                        <input
                            type="range" min="0.01" max="0.5" step="0.01"
                            bind:value={uiStore.averagingAlpha}
                            ondblclick={() => uiStore.averagingAlpha = 0.1}
                            class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                            title="Doble clic para reiniciar a 0.1"
                        />
                        <span class="text-[10px] font-mono text-[var(--accent)] w-10 text-right">{uiStore.averagingAlpha.toFixed(2)}</span>
                    </div>
                {:else if uiStore.averagingType === 'LPF'}
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-16">Velocidad</span>
                        <div class="flex flex-1 bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                            {#each [['Slow', '0.25 Hz'], ['Medium', '0.5 Hz'], ['Fast', '1 Hz']] as [val, label]}
                                <button
                                    class="flex-1 py-1 text-[9px] font-bold rounded transition-all cursor-pointer
                                           {uiStore.besselSpeed === val ? accentBg : inactiveBtn}"
                                    onclick={() => uiStore.besselSpeed = val as 'Slow' | 'Medium' | 'Fast'}
                                >
                                    {label}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
                {#if uiStore.averagingType !== 'None'}
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-16">Umbral</span>
                        <input
                            type="range" min="-120" max="-20" step="1"
                            bind:value={uiStore.averagingThresholdDb}
                            ondblclick={() => uiStore.averagingThresholdDb = -60}
                            class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                            title="Doble clic para reiniciar a -60 dBFS"
                        />
                        <span class="text-[10px] font-mono text-[var(--accent)] w-12 text-right">
                            {uiStore.averagingThresholdDb} dB
                        </span>
                    </div>
                {/if}
            </div>

            <!-- Polaridad -->
            <div class="flex items-center gap-2">
                <button
                    class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer border
                           {uiStore.polarity
                        ? 'bg-[#ef4444]/15 text-[var(--accent-red)] border-[#ef4444]/30'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)] hover:text-[var(--text-primary)]'}"
                    onclick={() => uiStore.polarity = !uiStore.polarity}
                    title="Inversión de polaridad del canal de medición"
                >
                    <span class="text-sm">⊘</span> Polaridad
                </button>
            </div>

            <!-- Filtro de entrada -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Filtro de entrada</label>
                <div class="flex bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                    {#each [['None', 'Off'], ['Notch1k', 'Notch 1k'], ['BP100', 'BP 100'], ['LP200', 'LP 200']] as [val, label]}
                        <button
                            class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                   {uiStore.inputFilter === val ? accentBg : inactiveBtn}"
                            onclick={() => uiStore.inputFilter = val as 'None' | 'Notch1k' | 'BP100' | 'LP200'}
                        >
                            {label}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Ventana -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Ventana (window)</label>
                <select
                    bind:value={uiStore.windowType}
                    class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                >
                    {#each ['Rectangular', 'Hann', 'Hamming', 'FlatTop', 'BlackmanHarris', 'HFT223D', 'Exponential'] as wType}
                        <option value={wType}>{wType}</option>
                    {/each}
                </select>
            </div>

            <!-- Ventana temporal (time gate) -->
            <div class="flex flex-col gap-2 pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)]">
                <label class="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                    <input
                        type="checkbox"
                        bind:checked={uiStore.enableSourceWindow}
                        class="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                    />
                    <span class="font-semibold select-none">Ventana temporal (time gate)</span>
                </label>
                {#if uiStore.enableSourceWindow}
                    <div class="flex flex-col gap-2 pl-6">
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-14">Ancho</span>
                            <input
                                type="range" min="0.5" max="50" step="0.5"
                                bind:value={uiStore.sourceWindowWidthMs}
                                ondblclick={() => uiStore.sourceWindowWidthMs = 10.0}
                                class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                            />
                            <span class="text-[10px] font-mono text-[var(--accent)] w-14 text-right">{uiStore.sourceWindowWidthMs.toFixed(1)} ms</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-14">Desplaz.</span>
                            <input
                                type="range" min="-20" max="20" step="0.1"
                                bind:value={uiStore.sourceWindowOffsetMs}
                                ondblclick={() => uiStore.sourceWindowOffsetMs = 0}
                                class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                            />
                            <span class="text-[10px] font-mono text-[var(--accent)] w-14 text-right">{uiStore.sourceWindowOffsetMs.toFixed(1)} ms</span>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Leq -->
            <div class="flex flex-col gap-2 pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)]">
                <label class="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                    <input
                        type="checkbox"
                        bind:checked={uiStore.enableLeq}
                        class="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                    />
                    <span class="font-semibold select-none">Leq (nivel equivalente)</span>
                </label>
                {#if uiStore.enableLeq}
                    <div class="flex items-center gap-2 pl-6">
                        <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-14">Ventana</span>
                        <input
                            type="range" min="1" max="60" step="1"
                            bind:value={uiStore.leqWindowSeconds}
                            ondblclick={() => uiStore.leqWindowSeconds = 10}
                            class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                        />
                        <span class="text-[10px] font-mono text-[var(--accent)] w-10 text-right">{uiStore.leqWindowSeconds} s</span>
                    </div>
                    <div class="flex items-center gap-2 pl-6">
                        <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-14">Valor</span>
                        <span class="text-sm font-mono font-bold text-[var(--accent)]">{uiStore.leqValue.toFixed(1)} dBSPL</span>
                    </div>
                {/if}
            </div>

            <!-- FPS, DSP Rate, FFT Size -->
            <div class="flex flex-col gap-2 pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)]">
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-16">Target FPS</span>
                    <input
                        type="range" min="5" max="60" step="5"
                        bind:value={uiStore.targetFps}
                        ondblclick={() => uiStore.targetFps = 30}
                        class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                        title="Doble clic para reiniciar a 30"
                    />
                    <span class="text-[10px] font-mono text-[var(--accent)] w-8 text-right">{uiStore.targetFps}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-16">DSP Rate</span>
                    <input
                        type="range" min="1" max="10" step="1"
                        bind:value={uiStore.dspUpdateRate}
                        ondblclick={() => uiStore.dspUpdateRate = 4}
                        class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                        title="Doble clic para reiniciar a 4 Hz"
                    />
                    <span class="text-[10px] font-mono text-[var(--accent)] w-10 text-right">{uiStore.dspUpdateRate} Hz</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-[var(--text-muted)] font-bold uppercase w-16">FFT Size</span>
                    <select
                        bind:value={uiStore.fftSize}
                        class="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                    >
                        {#each [2048, 4096, 8192, 16384, 32768] as size}
                            <option value={size}>{size}</option>
                        {/each}
                    </select>
                </div>
            </div>
        </div>
    {/if}

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 4. PANTALLA Y PREFERENCIAS (BÁSICO) + TOGGLE AVANZADO -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="flex flex-col gap-4 bg-[var(--bg-tertiary)]/40 border border-[color-mix(in_srgb,var(--border-primary)_50%,transparent)] rounded-xl p-4">
        {@render sectionHeader('grid_view', 'var(--accent-green)', 'Pantalla y preferencias')}

        <!-- Distribución de grilla (una sola línea compacta) -->
        <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Distribución de grilla</label>
            <div class="flex bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                {#each ["1x1", "1x2", "2x1", "2x2", "3x1", "3x2"] as layoutOpt}
                    <button
                        class="flex-1 py-1.5 text-[10px] font-mono font-bold rounded transition-all cursor-pointer min-h-[28px]
                               {uiStore.layout === layoutOpt ? accentBg : inactiveBtn}"
                        onclick={() => uiStore.setLayout(layoutOpt)}
                    >
                        {layoutOpt}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Tema visual -->
        <div class="flex justify-between items-center pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)]">
            <div class="flex flex-col gap-0.5">
                <span class="text-xs font-semibold text-[var(--text-primary)]">Tema visual</span>
                <span class="text-[10px] text-[var(--text-muted)]">Apariencia de la interfaz</span>
            </div>

            <div class="flex items-center bg-[var(--bg-tertiary)] border border-[var(--border-primary)] p-0.5 rounded-lg gap-0.5">
                {#each [
                    { mode: 'system' as const, icon: 'computer', label: 'Auto' },
                    { mode: 'light' as const, icon: 'light_mode', label: 'Claro' },
                    { mode: 'dark' as const, icon: 'dark_mode', label: 'Oscuro' },
                ] as opt}
                    <button
                        class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer
                               {uiStore.themeMode === opt.mode
                            ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
                        onclick={() => uiStore.setThemeMode(opt.mode)}
                    >
                        <span class="material-symbols-outlined text-[14px]">{opt.icon}</span>
                        {opt.label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Paleta de colores -->
        <div class="flex justify-between items-center pt-2 border-t" style="border-color: color-mix(in srgb, var(--border-primary) 30%, transparent)">
            <div class="flex flex-col gap-0.5">
                <span class="text-xs font-semibold" style="color: var(--text-primary)">Paleta de colores</span>
                <span class="text-[10px]" style="color: var(--text-muted)">Color de acento</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
                {#each [
                    { name: 'default', color: 'var(--accent)', label: 'Default' },
                    { name: 'midnight', color: '#6366f1', label: 'Midnight' },
                    { name: 'ocean', color: '#06b6d4', label: 'Ocean' },
                    { name: 'sunset', color: '#f97316', label: 'Sunset' },
                    { name: 'rose', color: '#e11d48', label: 'Rose' },
                    { name: 'forest', color: '#16a34a', label: 'Forest' },
                    { name: 'violet', color: '#8b5cf6', label: 'Violet' },
                    { name: 'slate', color: '#64748b', label: 'Slate' },
                    { name: 'amber', color: '#d97706', label: 'Amber' },
                    { name: 'neon', color: '#00ff41', label: 'Neon' },
                ] as pal}
                    <button
                        class="w-5 h-5 rounded-full cursor-pointer transition-all"
                        style="background: {pal.color}; box-shadow: {uiStore.palette === pal.name ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${pal.color}` : 'none'}; opacity: {uiStore.palette === pal.name ? 1 : 0.6};"
                        title={pal.label}
                        onclick={() => uiStore.setPalette(pal.name)}
                    ></button>
                {/each}
            </div>
        </div>

        <!-- Tema del cuadrante -->
        <div class="flex justify-between items-center pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)]">
            <div class="flex flex-col gap-0.5">
                <span class="text-xs font-semibold text-[var(--text-primary)]">Tema del cuadrante</span>
                <span class="text-[10px] text-[var(--text-muted)]">Independiente del tema UI</span>
            </div>

            <div class="flex items-center bg-[var(--bg-tertiary)] border border-[var(--border-primary)] p-0.5 rounded-lg gap-0.5">
                {#each [
                    { mode: 'auto' as const, icon: 'sync', label: 'Auto' },
                    { mode: 'light' as const, icon: 'light_mode', label: 'Claro' },
                    { mode: 'dark' as const, icon: 'dark_mode', label: 'Oscuro' },
                ] as opt}
                    <button
                        class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer
                               {uiStore.canvasTheme === opt.mode
                            ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
                        onclick={() => uiStore.setCanvasTheme(opt.mode)}
                    >
                        <span class="material-symbols-outlined text-[14px]">{opt.icon}</span>
                        {opt.label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- 🔧 AVANZADO: Líneas intermedias del grid -->
        {#if uiStore.showAdvanced}
            <div class="flex justify-between items-center pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)] transition-all duration-300">
                <div class="flex items-center gap-1.5">
                    {@render advIcon()}
                    <span class="text-xs font-semibold text-[var(--text-primary)]">Líneas intermedias del grid</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        bind:checked={uiStore.showMinorGrid}
                        class="sr-only peer"
                    />
                    <div class="w-9 h-5 bg-[var(--bg-elevated)] rounded-full peer peer-checked:bg-[var(--accent)] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
            </div>
        {/if}

        <!-- Toggle mostrar controles avanzados -->
        <div class="flex justify-between items-center pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)]">
            <div class="flex flex-col gap-0.5">
                <span class="text-xs font-semibold text-[var(--text-primary)]">Mostrar controles avanzados</span>
                <span class="text-[10px] text-[var(--text-muted)]">Configuración DSP, calibración, métricas globales</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    bind:checked={uiStore.showAdvanced}
                    class="sr-only peer"
                />
                <div class="w-9 h-5 bg-[var(--bg-elevated)] rounded-full peer peer-checked:bg-[var(--accent)] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 5. CONFIGURACIÓN (GUARDAR / ABRIR / RESETEAR) -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="flex flex-col gap-4 bg-[var(--bg-tertiary)]/40 border border-[color-mix(in_srgb,var(--border-primary)_50%,transparent)] rounded-xl p-4">
        {@render sectionHeader('settings', '#f59e0b', 'Configuración')}

        <div class="flex gap-2">
            <!-- Guardar -->
            <button
                class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold transition-all cursor-pointer border
                       bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)] hover:text-[var(--text-primary)] hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
                onclick={handleSaveConfig}
                title="Guardar toda la configuración como archivo .ca.json"
            >
                <span class="material-symbols-outlined text-sm">download</span>
                Guardar
            </button>

            <!-- Abrir -->
            <input type="file" accept=".ca.json,.json" class="hidden" id="config-file-input"
                onchange={handleOpenConfig} />
            <label
                for="config-file-input"
                class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold transition-all cursor-pointer border
                       bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)] hover:text-[var(--text-primary)] hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
                title="Abrir configuración desde archivo .ca.json"
            >
                <span class="material-symbols-outlined text-sm">upload</span>
                Abrir
            </label>

            <!-- Resetear -->
            <button
                class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold transition-all cursor-pointer border
                       bg-[var(--bg-tertiary)] text-[color-mix(in_srgb,var(--accent-red)_70%,transparent)] border-[#ef4444]/10 hover:text-[var(--accent-red)] hover:border-[#ef4444]/30"
                onclick={() => showResetModal = true}
                title="Resetear configuración a valores por defecto"
            >
                <span class="material-symbols-outlined text-sm">restart_alt</span>
                Resetear
            </button>
        </div>

        <span class="text-[9px] text-[var(--text-muted)] italic text-center">Los cambios se guardan automáticamente en el navegador.</span>
    </div>
</div>

<!-- MODAL RESETEAR -->
{#if showResetModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.6)" onclick={() => showResetModal = false}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="rounded-xl p-5 w-[320px] flex flex-col gap-4 shadow-[0_16px_48px_#000000]" style="background: var(--bg-surface, #1a1a2e); border: 1px solid var(--border-primary, #2a2a3e)" onclick={(e) => e.stopPropagation()}>
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[var(--accent-red)]">restart_alt</span>
                <h3 class="text-sm font-bold text-[var(--text-primary)]">Resetear a valores por defecto</h3>
            </div>
            <p class="text-[10px] text-[var(--text-muted)]">Seleccioná qué categorías querés resetear:</p>

            <div class="flex flex-col gap-1.5">
                {#each [
                    { key: 'hardware', label: 'Hardware de audio', desc: 'Dispositivos, routing, canales' },
                    { key: 'dsp', label: 'DSP', desc: 'Averaging, FFT, ventana, ponderación, ganancia' },
                    { key: 'generador', label: 'Generador', desc: 'Tipo, frecuencia, nivel, routing' },
                    { key: 'calibracion', label: 'Calibración', desc: 'Curva de micrófono' },
                    { key: 'eq', label: 'Ecualizador', desc: 'Tipo, bandas, filtros paramétricos' },
                    { key: 'autoEQ', label: 'AutoEQ', desc: 'Algoritmo, rangos, opciones avanzadas' },
                    { key: 'targetCurve', label: 'Curva objetivo', desc: 'Target trace' },
                    { key: 'captura', label: 'Captura', desc: 'Métricas, tag presets' },
                    { key: 'pantalla', label: 'Pantalla', desc: 'Layout, tema, grilla, FPS' },
                ] as item}
                    <label class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-white/5 transition-all">
                        <input type="checkbox" bind:checked={resetCategories[item.key as keyof typeof resetCategories]}
                            class="w-3.5 h-3.5 rounded accent-[#ef4444] cursor-pointer" />
                        <div class="flex flex-col">
                            <span class="text-[11px] font-semibold text-[var(--text-primary)]">{item.label}</span>
                            <span class="text-[9px] text-[var(--text-muted)]">{item.desc}</span>
                        </div>
                    </label>
                {/each}
            </div>

            <div class="flex gap-2 pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_30%,transparent)]">
                <button
                    class="flex-1 py-2 rounded-md text-[10px] font-bold cursor-pointer transition-all bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)] hover:text-[var(--text-primary)]"
                    onclick={() => showResetModal = false}
                >Cancelar</button>
                <button
                    class="flex-1 py-2 rounded-md text-[10px] font-bold cursor-pointer transition-all bg-[#ef4444]/15 text-[var(--accent-red)] border border-[#ef4444]/30 hover:bg-[#ef4444]/25
                           disabled:opacity-30"
                    disabled={!Object.values(resetCategories).some(v => v)}
                    onclick={applyReset}
                >Resetear selección</button>
            </div>
        </div>
    </div>
{/if}
