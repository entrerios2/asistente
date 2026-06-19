<script lang="ts">
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";

    import TabMedicion from "./TabMedicion.svelte";
    import TabEcualizar from "./TabEcualizar.svelte";
    import TabInstantaneas from "./TabInstantaneas.svelte";
    import TabConfig from "./TabConfig.svelte";

    let statusText = $state("Listo para medir");

    const snapCount = $derived(traceManager.instantaneas.length);
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
                    class="relative flex-1 h-[48px] rounded-lg flex flex-col items-center justify-center transition-all duration-200 cursor-pointer gap-0.5
                           {uiStore.activeTab === tab.id
                        ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
                    onclick={() => (uiStore.activeTab = tab.id)}
                    title={tab.label}
                >
                    <span class="material-symbols-outlined text-[20px]">{tab.icon}</span>
                    <span class="text-[7px] font-bold uppercase tracking-wider leading-none">{tab.label}</span>
                    {#if tab.id === 'snaps' && snapCount > 0}
                        <span class="absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-[#3b82f6] text-white text-[8px] font-bold rounded-full px-1">
                            {snapCount}
                        </span>
                    {/if}
                </button>
            {/each}
        </nav>
    </div>

    <!-- Contenido Principal del Sidebar -->
    <div class="flex-1 h-full overflow-hidden flex flex-col" style="background: var(--bg-secondary)">
        {#if uiStore.activeTab === "medicion"}
            <TabMedicion bind:statusText />
        {:else if uiStore.activeTab === "eq"}
            <TabEcualizar bind:statusText />
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
