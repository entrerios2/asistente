<script lang="ts">
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { onMount } from "svelte";

    import TabMedicion from "./TabMedicion.svelte";
    import TabEcualizar from "./TabEcualizar.svelte";
    import TabInstantaneas from "./TabInstantaneas.svelte";
    import TabConfig from "./TabConfig.svelte";

    // --- ESTADOS DE ECUALIZACIÓN (PERSISTENTES EN SIDEBAR) ---
    let eqType = $state<'grafico' | 'parametrico'>(uiStore.eqType); // 'grafico' | 'parametrico'
    $effect(() => {
        uiStore.eqType = eqType;
    });
    $effect(() => {
        eqType = uiStore.eqType;
    });
    let showEQ = $state(true); // Switch Mostrar Ecualización
    let numGraphicBands = $state(10); // 5 | 10 | 15
    let customBandCount = $state(false);
    let isCalculatingAutoEQ = $state(false);
    let autoEQSourceLayer = $state<string>('active');

    interface GraphicBand {
        freq: number;
        gain: number;
    }
    let graphicBands = $state<GraphicBand[]>([
        { freq: 31, gain: 0 },
        { freq: 63, gain: 0 },
        { freq: 125, gain: 0 },
        { freq: 250, gain: 0 },
        { freq: 500, gain: 0 },
        { freq: 1000, gain: 0 },
        { freq: 2000, gain: 0 },
        { freq: 4000, gain: 0 },
        { freq: 8000, gain: 0 },
        { freq: 16000, gain: 0 },
    ]);

    interface ParametricFilter {
        id: number;
        freq: number;
        gain: number;
        q: number;
        type: string; // 'peaking' | 'lowpass' | 'highpass' | ...
        supportedTypes: string[];
        showConfig: boolean;
    }
    let parametricFilters = $state<ParametricFilter[]>([
        {
            id: 1,
            freq: 80,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: [
                "peaking",
                "lowpass",
                "highpass",
                "low_shelf",
                "high_shelf",
                "notch",
                "bandpass",
            ],
            showConfig: false,
        },
        {
            id: 2,
            freq: 500,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking", "low_shelf", "high_shelf", "notch"],
            showConfig: false,
        },
        {
            id: 3,
            freq: 2000,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking", "notch"],
            showConfig: false,
        },
        {
            id: 4,
            freq: 8000,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking", "lowpass", "low_shelf", "high_shelf"],
            showConfig: false,
        },
        {
            id: 5,
            freq: 12000,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking", "lowpass"],
            showConfig: false,
        },
        {
            id: 6,
            freq: 16000,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking"],
            showConfig: false,
        },
    ]);

    // Sincronización reactiva con traceManager.eqBands
    $effect(() => {
        if (!showEQ) {
            traceManager.eqBands = [];
            return;
        }

        if (eqType === "grafico") {
            traceManager.eqBands = graphicBands.map((b) => ({
                freq: b.freq,
                gain: b.gain,
                q: 1.414,
                type: "peaking",
            }));
        } else if (eqType === "parametrico") {
            traceManager.eqBands = parametricFilters
                .map((f) => ({
                    freq: f.freq,
                    gain: f.gain,
                    q: f.q,
                    type: f.type,
                }));
        }
    });

    onMount(async () => {
        const stored = localStorage.getItem("asistente_config");
        if (stored) {
            try {
                const config = JSON.parse(stored);
                if (config.layout) uiStore.setLayout(config.layout);
                if (config.themeMode) {
                    uiStore.setThemeMode(config.themeMode);
                } else if (config.isDarkMode !== undefined) {
                    uiStore.setThemeMode(config.isDarkMode ? 'dark' : 'light');
                }
                if (config.audioInDevice)
                    uiStore.audioInDevice = config.audioInDevice;
                if (config.audioOutDevice)
                    uiStore.audioOutDevice = config.audioOutDevice;
                if (config.inChannels) uiStore.inChannels = config.inChannels;
                if (config.outChannels)
                    uiStore.outChannels = config.outChannels;
                if (config.referenceChannel) {
                    uiStore.referenceChannel = config.referenceChannel;
                }
            } catch (e) {
                console.error("Error cargando configuración guardada:", e);
            }
        } else {
            uiStore.setLayout("1x1");
        }
    });

    $effect(() => {
        const dataToSave = {
            layout: uiStore.layout,
            themeMode: uiStore.themeMode,
            audioInDevice: uiStore.audioInDevice,
            audioOutDevice: uiStore.audioOutDevice,
            inChannels: $state.snapshot(uiStore.inChannels),
            outChannels: $state.snapshot(uiStore.outChannels),
            referenceChannel: uiStore.referenceChannel,
        };
        localStorage.setItem("asistente_config", JSON.stringify(dataToSave));
    });

    let statusText = $state("Listo para medir");
</script>

<aside
    class="w-[380px] h-full border-r flex flex-col select-none"
    style="background: var(--bg-secondary); border-color: var(--border-primary); color: var(--text-primary)"
>
    <!-- CABECERA DE PESTAÑAS Y CONTROL (PROMPT 11) -->
    <div class="flex items-center border-b px-2 py-1.5 gap-0.5 h-[60px] flex-shrink-0" style="background: var(--bg-primary); border-color: var(--border-primary)">
        <nav class="flex-1 flex items-center gap-0.5">
            {#each [
                { id: 'medicion', icon: 'podcasts', label: 'MEDIR' },
                { id: 'eq', icon: 'cadence', label: 'ECUALIZAR' },
                { id: 'snaps', icon: 'photo_camera', label: 'INSTANTÁNEA' },
                { id: 'config', icon: 'settings', label: 'CONFIG' },
            ] as tab}
                <button
                    class="flex-1 h-[48px] rounded-lg flex flex-col items-center justify-center transition-all duration-200 cursor-pointer gap-0.5
                           {uiStore.activeTab === tab.id
                        ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
                    onclick={() => (uiStore.activeTab = tab.id)}
                    title={tab.label}
                >
                    <span class="material-symbols-outlined text-[20px]">{tab.icon}</span>
                    <span class="text-[7px] font-bold uppercase tracking-wider leading-none">{tab.label}</span>
                </button>
            {/each}
        </nav>
    </div>

    <!-- Contenido Principal del Sidebar -->
    <div class="flex-1 h-full overflow-hidden flex flex-col" style="background: var(--bg-secondary)">
        {#if uiStore.activeTab === "medicion"}
            <TabMedicion bind:statusText />
        {:else if uiStore.activeTab === "eq"}
            <TabEcualizar
                bind:showEQ
                bind:eqType
                bind:numGraphicBands
                bind:customBandCount
                bind:isCalculatingAutoEQ
                bind:autoEQSourceLayer
                bind:graphicBands
                bind:parametricFilters
                bind:statusText
            />
        {:else if uiStore.activeTab === "snaps"}
            <TabInstantaneas bind:statusText />
        {:else if uiStore.activeTab === "config"}
            <TabConfig />
        {/if}
    </div>
</aside>

<style>
    /* Theme overrides for Sidebar */
    aside :global(.bg-\[\#121216\]) {
        background-color: var(--bg-tertiary) !important;
    }
    aside :global(.bg-\[\#121216\]\/5) {
        background-color: color-mix(in srgb, var(--bg-tertiary) 5%, transparent) !important;
    }
    aside :global(.bg-\[\#121216\]\/20) {
        background-color: color-mix(in srgb, var(--bg-tertiary) 20%, transparent) !important;
    }
    aside :global(.bg-\[\#121216\]\/30) {
        background-color: color-mix(in srgb, var(--bg-tertiary) 30%, transparent) !important;
    }
    aside :global(.bg-\[\#121216\]\/40) {
        background-color: color-mix(in srgb, var(--bg-tertiary) 40%, transparent) !important;
    }
    aside :global(.bg-\[\#0c0c0e\]) {
        background-color: var(--bg-surface) !important;
    }
    aside :global(.border-\[\#1a1a24\]) {
        border-color: var(--border-primary) !important;
    }
    aside :global(.border-\[\#1a1a24\]\/20) {
        border-color: color-mix(in srgb, var(--border-primary) 20%, transparent) !important;
    }
    aside :global(.border-\[\#1a1a24\]\/30) {
        border-color: color-mix(in srgb, var(--border-primary) 30%, transparent) !important;
    }
    aside :global(.border-\[\#1a1a24\]\/40) {
        border-color: color-mix(in srgb, var(--border-primary) 40%, transparent) !important;
    }
    aside :global(.border-\[\#1a1a24\]\/50) {
        border-color: color-mix(in srgb, var(--border-primary) 50%, transparent) !important;
    }
    aside :global(.border-t) {
        border-top-color: var(--border-primary) !important;
    }
    aside :global(.border-b) {
        border-bottom-color: var(--border-primary) !important;
    }
    aside :global(.text-gray-200) {
        color: var(--text-primary) !important;
    }
    aside :global(.text-gray-500) {
        color: var(--text-muted) !important;
    }
</style>
