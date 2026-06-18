<script lang="ts">
    import type { InteractionState } from "$lib/dsp/canvasInteraction";

    let {
        interactionState = $bindable(),
        onDoubleClick
    }: {
        interactionState: InteractionState;
        onDoubleClick: () => void;
    } = $props();

    let showZoomMenu = $state(false);
</script>

<div class="absolute left-3 bottom-3 z-20 select-none">
    <div class="relative">
        {#if showZoomMenu}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="fixed inset-0 z-40" onclick={() => showZoomMenu = false}></div>
            <div class="absolute left-0 bottom-10 rounded-lg p-1.5 shadow-xl z-50 min-w-[110px] flex flex-col gap-0.5"
                 style="background: var(--bg-surface); border: 1px solid var(--border-primary)">
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
                <div class="border-t my-0.5" style="border-color: var(--border-primary)"></div>
                <button class="px-3 py-1.5 text-[10px] font-bold text-[#00ff88] hover:bg-[#00ff88]/10 rounded transition-all cursor-pointer text-left"
                    onclick={() => { onDoubleClick(); showZoomMenu = false; }}>Restaurar</button>
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
