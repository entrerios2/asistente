<script lang="ts">
    import { uiStore } from "$lib/stores/ui.svelte";

    let {
        show,
        smoothing = $bindable(),
        onClose,
        onSmoothingChange,
        onResetView
    }: {
        show: boolean;
        smoothing: number;
        onClose: () => void;
        onSmoothingChange?: (s: number) => void;
        onResetView: () => void;
    } = $props();

    function setSmoothing(s: number) {
        smoothing = s;
        if (onSmoothingChange) {
            onSmoothingChange(s);
        }
    }
</script>

{#if show}
    <!-- Capturador de clics del fondo -->
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
        class="popover-backdrop fixed inset-0 z-30"
        onclick={onClose}
    ></div>

    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="selector-popover absolute right-[10px] top-[46px] rounded-xl p-4 shadow-[0_10px_30px_#000000] z-50 min-w-[200px] flex flex-col gap-3 select-none text-[11px] text-gray-200"
         style="background: var(--bg-surface); border: 1px solid var(--border-primary)"
         onmousedown={(e) => e.stopPropagation()}
         onmouseup={(e) => e.stopPropagation()}
         onmousemove={(e) => e.stopPropagation()}
         onclick={(e) => e.stopPropagation()}
         onwheel={(e) => e.stopPropagation()}>
        <div class="popover-header flex items-center justify-between border-b pb-1.5" style="border-color: var(--border-primary)">
            <span class="popover-title font-bold text-gray-300">Configuración Global</span>
            <button
                class="popover-close text-gray-500 hover:text-gray-300"
                onclick={onClose}
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
                        onclick={() => setSmoothing(s)}
                    >
                        {s === 0 ? "Off" : `1/${Math.round(1 / s)}`}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Límites de Zoom y Reinicio -->
        <div class="divider border-t my-0.5" style="border-color: var(--border-primary)"></div>

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
                onclick={onResetView}
            >
                <span class="material-symbols-outlined text-xs">restart_alt</span> Reiniciar Vista
            </button>
        </div>
    </div>
{/if}
