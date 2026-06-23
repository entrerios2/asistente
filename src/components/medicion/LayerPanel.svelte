<script lang="ts">
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import SnapshotPicker from "./SnapshotPicker.svelte";

    let {
        quadrantId,
        quadrantLayers,
        showEQOverlay,
        onToggleEQ
    }: {
        quadrantId: string;
        quadrantLayers: any[];
        showEQOverlay: boolean;
        onToggleEQ?: () => void;
    } = $props();

    let showLayerDropdown = $state(false);
    let showAddLayerMenu = $state(false);
    let showSnapshotPicker = $state(false);
    let snapshotPickerIds = $state<string[]>([]);

    const activeLayer = $derived(quadrantLayers.find(l => l.id === uiStore.activeLayerId));

    function onLayerDragStart(e: DragEvent, layerId: string) {
        if (e.dataTransfer) {
            e.dataTransfer.setData("text/plain", layerId);
        }
    }

    function toggleEQ() {
        if (onToggleEQ) onToggleEQ();
    }
</script>

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
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="fixed inset-0 z-40" onclick={() => showLayerDropdown = false}></div>
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="absolute right-0 mt-1 rounded-xl p-3 shadow-[0_10px_30px_#000] z-50 min-w-[200px] flex flex-col gap-1.5 select-none text-[11px]"
                  style="background: var(--bg-surface); border: 1px solid var(--border-primary)"
                  onmousedown={(e) => e.stopPropagation()}
                  onclick={(e) => e.stopPropagation()}
                  onwheel={(e) => e.stopPropagation()}>
                <div class="flex items-center justify-between border-b pb-1.5 mb-1" style="border-color: var(--border-primary)">
                    <span class="font-bold text-gray-300 text-[10px] uppercase tracking-wider">Capas</span>
                    <button onclick={() => showLayerDropdown = false} class="text-gray-500 hover:text-gray-300">
                        <span class="material-symbols-outlined text-xs">close</span>
                    </button>
                </div>

                <!-- Capa fija de EQ (siempre presente) -->
                <div class="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]"
                     style="background: {showEQOverlay ? '#fbbf2410' : 'transparent'}">
                    <button
                        class="w-4 h-4 flex items-center justify-center cursor-pointer"
                        onclick={toggleEQ}
                        title={showEQOverlay ? 'Ocultar ecualizador' : 'Mostrar ecualizador'}>
                        <span class="material-symbols-outlined text-[12px]" style="color: {showEQOverlay ? '#fbbf24' : 'var(--text-muted)'}">
                            {showEQOverlay ? 'visibility' : 'visibility_off'}
                        </span>
                    </button>
                    <span class="material-symbols-outlined text-[12px]" style="color: #fbbf24">equalizer</span>
                    <span class="font-semibold" style="color: {showEQOverlay ? '#fbbf24' : 'var(--text-muted)'}">Ecualizador</span>
                </div>
                <div class="border-t my-0.5" style="border-color: var(--border-primary)"></div>

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
                <div class="border-t pt-1.5 mt-1 relative" style="border-color: var(--border-primary)">
                    <button
                        class="w-full text-left px-2 py-1.5 rounded text-[10px] text-[#00ff88] hover:bg-[#00ff88]/5 font-semibold flex items-center gap-1 cursor-pointer"
                        onclick={(e) => { e.stopPropagation(); showAddLayerMenu = !showAddLayerMenu; }}>
                        <span class="material-symbols-outlined text-[12px]">add</span>
                        Agregar capa
                        <span class="material-symbols-outlined text-[10px] ml-auto">expand_more</span>
                    </button>
                    {#if showAddLayerMenu}
                        <div class="absolute left-0 bottom-full mb-1 rounded-lg shadow-lg z-50 min-w-[180px] py-1"
                             style="background: var(--bg-surface); border: 1px solid var(--border-primary)">
                            <button
                                class="w-full text-left px-3 py-1.5 text-[10px] text-[#00ff88] hover:bg-[#00ff88]/5 flex items-center gap-1.5 cursor-pointer"
                                onclick={() => { traceManager.addLayer(`Capa ${traceManager.layers.length + 1}`, quadrantId, 'live'); showAddLayerMenu = false; showLayerDropdown = false; }}>
                                <span class="material-symbols-outlined text-[12px]">podcasts</span>
                                Medición
                            </button>
                            <div class="relative">
                                <button
                                    class="w-full text-left px-3 py-1.5 text-[10px] text-[#3b82f6] hover:bg-[#3b82f6]/5 flex items-center gap-1.5 cursor-pointer"
                                    onclick={(e) => { e.stopPropagation(); showSnapshotPicker = !showSnapshotPicker; }}>
                                    <span class="material-symbols-outlined text-[12px]">photo_camera</span>
                                    Instantánea
                                    <span class="material-symbols-outlined text-[10px] ml-auto">{showSnapshotPicker ? 'expand_less' : 'expand_more'}</span>
                                </button>
                                {#if showSnapshotPicker}
                                    <div class="bg-[#0a0a0e] border-t py-1 px-1" style="border-color: var(--border-primary)">
                                        <SnapshotPicker
                                            mode="single"
                                            bind:selectedIds={snapshotPickerIds}
                                            onSelect={(ids) => {
                                                if (ids.length > 0) {
                                                    const snap = traceManager.instantaneas.find(s => s.id === ids[0]);
                                                    if (snap) {
                                                        traceManager.addSnapshotLayer(snap, quadrantId);
                                                    }
                                                    snapshotPickerIds = [];
                                                    showSnapshotPicker = false;
                                                    showAddLayerMenu = false;
                                                    showLayerDropdown = false;
                                                }
                                            }}
                                            maxHeight="120px"
                                        />
                                    </div>
                                {/if}
                            </div>
                            <div class="flex flex-col">
                                <span class="px-3 py-1.5 text-[10px] text-[#a855f7] flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-[12px]">functions</span>
                                    Calculada
                                </span>
                                <div class="flex gap-0.5 px-3 pb-1.5">
                                    {#each [['average', 'Promedio'], ['min', 'Mínimo'], ['max', 'Máximo']] as [op, label]}
                                        <button
                                            class="flex-1 px-1.5 py-1 text-[9px] font-semibold rounded bg-[#a855f7]/5 text-[#a855f7]/70 hover:bg-[#a855f7]/15 hover:text-[#a855f7] cursor-pointer transition-all min-h-[24px]"
                                            onclick={() => { traceManager.addCalculatedLayer(label, quadrantId, op as any); showAddLayerMenu = false; showLayerDropdown = false; }}>
                                            {label}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>
