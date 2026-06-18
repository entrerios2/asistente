<script lang="ts">
    import type { Metric } from "$lib/dsp/quadrantState";

    let {
        allMetrics,
        activeMetrics = $bindable(),
        isMetricDisabled,
        onToggleMetric
    }: {
        allMetrics: Metric[];
        activeMetrics: string[];
        isMetricDisabled: (name: string) => boolean;
        onToggleMetric: (name: string) => void;
    } = $props();

    let showAddDropdown = $state(false);
</script>

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
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="fixed inset-0 z-40" onclick={() => showAddDropdown = false}></div>
        
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="absolute left-0 mt-1 rounded-lg p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 min-w-[170px] flex flex-col gap-0.5 select-none"
             style="background: var(--bg-surface); border: 1px solid var(--border-primary)"
             onmousedown={(e) => e.stopPropagation()} onclick={(e) => e.stopPropagation()}>
            {#each allMetrics as m}
                {@const active = activeMetrics.includes(m.name)}
                {@const disabled = isMetricDisabled(m.name)}
                <button
                    class="w-full text-left px-2 py-1 rounded-md text-[11px] font-medium flex items-center justify-between transition-colors
                           {active ? 'bg-[#00ff88]/10 text-[#00ff88] cursor-default' : disabled ? 'text-gray-600 cursor-not-allowed opacity-50' : 'text-gray-300 hover:bg-[#161622] hover:text-[#fff]'}"
                    onclick={() => {
                        if (!active && !disabled) {
                            onToggleMetric(m.name);
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
