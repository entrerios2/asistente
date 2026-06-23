<script lang="ts">
    import { traceManager, type Instantanea, type InstantaneaTags } from "$lib/stores/traceManager.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import CaptureModal from "./CaptureModal.svelte";

    let { statusText = $bindable("Listo para medir") } = $props();

    let sortOrder = $state<'desc' | 'asc'>('desc');
    let editingId = $state<string | null>(null);
    let editingName = $state("");
    let pendingCapture = $derived(traceManager.pendingCaptureForModal);
    let expandedId = $state<string | null>(null);
    let collapsedGroups = $state(new Set<string>());
    let confirmDeleteId = $state<string | null>(null);
    let confirmDeleteAll = $state(false);

    let sortedSnapshots = $derived.by(() => {
        return [...traceManager.instantaneas].sort((a, b) => {
            if (sortOrder === "desc") {
                return b.timestamp - a.timestamp;
            } else {
                return a.timestamp - b.timestamp;
            }
        });
    });

    // Group by ubicación
    let groupedSnapshots = $derived.by(() => {
        const groups = new Map<string, Instantanea[]>();
        sortedSnapshots.forEach(s => {
            const key = s.tags?.ubicacion || 'Sin clasificar';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(s);
        });
        return groups;
    });

    let visibleCount = $derived(traceManager.instantaneas.filter(s => s.visible).length);

    function toggleGroup(key: string) {
        const next = new Set(collapsedGroups);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        collapsedGroups = next;
    }

    function startEditing(id: string, currentName: string) {
        editingId = id;
        editingName = currentName;
    }

    function finishEditing(id: string) {
        if (editingId === id && editingName.trim()) {
            const ins = traceManager.instantaneas.find((i) => i.id === id);
            if (ins) {
                ins.name = editingName.trim();
            }
        }
        editingId = null;
    }

    function handleKeyPress(e: KeyboardEvent, id: string) {
        if (e.key === "Enter") {
            finishEditing(id);
        } else if (e.key === "Escape") {
            editingId = null;
        }
    }

    function toggleExpand(id: string) {
        expandedId = expandedId === id ? null : id;
    }

    function requestDelete(id: string) {
        if (confirmDeleteId === id) {
            traceManager.deleteInstantanea(id);
            confirmDeleteId = null;
            if (expandedId === id) expandedId = null;
        } else {
            confirmDeleteId = id;
            setTimeout(() => { if (confirmDeleteId === id) confirmDeleteId = null; }, 3000);
        }
    }

    function requestDeleteAll() {
        if (confirmDeleteAll) {
            const ids = traceManager.instantaneas.map(s => s.id);
            ids.forEach(id => traceManager.deleteInstantanea(id));
            confirmDeleteAll = false;
        } else {
            confirmDeleteAll = true;
            setTimeout(() => { confirmDeleteAll = false; }, 3000);
        }
    }

    async function captureActiveLive() {
        // captureInstantanea sets pendingCaptureForModal automatically
        await traceManager.captureInstantanea();
    }

    async function handleModalSave(tags: InstantaneaTags, name: string) {
        if (!pendingCapture) return;
        const ins = traceManager.instantaneas.find(i => i.id === pendingCapture!.id);
        if (ins) {
            ins.tags = tags;
            ins.name = name;
            ins.color = (await import("$lib/stores/traceManager.svelte")).UBICACION_COLORS[tags.ubicacion || ''] || ins.color;
            try {
                const { saveInstantanea } = await import("$lib/utils/db");
                const serializedData: Record<string, ArrayBufferLike> = {};
                for (const metric in ins.data) {
                    serializedData[metric] = ins.data[metric].buffer;
                }
                await saveInstantanea({
                    id: ins.id, name: ins.name, timestamp: ins.timestamp,
                    data: serializedData, visible: ins.visible, color: ins.color,
                    source: ins.source, metric: ins.metric, offsetY: ins.offsetY,
                    tags: ins.tags, sessionId: ins.sessionId, metadata: ins.metadata,
                });
            } catch (e) {
                console.error('[TabInstantaneas] Error guardando tags:', e);
            }
        }
        statusText = "Instantánea capturada con éxito";
        traceManager.pendingCaptureForModal = null;
    }

    async function handleModalDiscard() {
        if (pendingCapture) {
            await traceManager.deleteInstantanea(pendingCapture.id);
        }
        statusText = "Instantánea descartada";
        traceManager.pendingCaptureForModal = null;
    }
</script>

<div
    class="flex-1 p-4 overflow-y-auto flex flex-col gap-3"
    id="panel-snaps"
>
    <!-- Toolbar compacto -->
    <div class="flex flex-col gap-2.5">
        <!-- Botón capturar -->
        <button
            class="w-full min-h-[40px] bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all duration-300 border border-[#3b82f6]/20"
            onclick={captureActiveLive}
        >
            <span class="material-symbols-outlined text-sm">photo_camera</span>
            Capturar instantánea
        </button>

        <!-- 🔧 AVANZADO: Métricas a capturar -->
        {#if uiStore.showAdvanced}
            <div class="flex flex-col gap-2 bg-[#121216]/40 border border-[#1a1a24]/30 rounded-lg p-3 select-none">
                <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[12px] text-gray-600">tune</span>
                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Métricas a capturar:</span>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-1">
                    {#each Object.keys(traceManager.metricsToCapture) as metric}
                        <label class="flex items-center gap-1.5 text-[10px] text-gray-300 cursor-pointer">
                            <input type="checkbox" bind:checked={traceManager.metricsToCapture[metric]} class="accent-[#3b82f6] scale-90" />
                            <span>{metric === 'GroupDelay' ? 'Group Delay' : metric}</span>
                        </label>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- 🔧 AVANZADO: Importar + Ordenación -->
        {#if uiStore.showAdvanced}
            <div class="flex items-center gap-2">
                <input type="file" accept=".snapshot.json" class="hidden" id="import-snap-input"
                    onchange={async (e) => {
                        const file = e.currentTarget.files?.[0];
                        if (file) {
                            const text = await file.text();
                            const imported = await traceManager.importInstantaneaFromJSON(text);
                            statusText = imported ? "Instantánea importada" : "Error importando";
                        }
                    }}
                />
                <label for="import-snap-input"
                    class="flex-1 bg-[#0d0d14] border border-[#2a2a3a] hover:border-gray-500 text-gray-400 hover:text-white rounded-lg py-1.5 text-[10px] font-semibold text-center cursor-pointer transition-all flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">upload_file</span>
                    Importar
                </label>
                <div class="flex bg-[#0d0d14] p-0.5 rounded-md border border-[#2a2a3a]/40">
                    <button class="px-2 py-1 text-[9px] font-semibold rounded transition-all cursor-pointer min-h-[24px]
                                   {sortOrder === 'desc' ? 'bg-[#3b82f6] text-white shadow' : 'text-gray-400 hover:text-gray-200'}"
                        onclick={() => (sortOrder = "desc")}>Recientes</button>
                    <button class="px-2 py-1 text-[9px] font-semibold rounded transition-all cursor-pointer min-h-[24px]
                                   {sortOrder === 'asc' ? 'bg-[#3b82f6] text-white shadow' : 'text-gray-400 hover:text-gray-200'}"
                        onclick={() => (sortOrder = "asc")}>Antiguos</button>
                </div>
            </div>
        {/if}
    </div>

    <!-- Lista agrupada por ubicación -->
    <div class="flex-1 flex flex-col gap-0.5 min-h-0 overflow-y-auto pr-0.5">
        {#if sortedSnapshots.length === 0}
            <div class="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-[#2a2a3a] rounded-xl gap-2">
                <span class="material-symbols-outlined text-gray-600 text-2xl">add_photo_alternate</span>
                <p class="text-[10px] text-gray-500">Capture una instantánea para comenzar</p>
            </div>
        {:else}
            {#each [...groupedSnapshots.entries()] as [groupName, snaps]}
                <!-- Group header -->
                <button
                    class="flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] font-bold text-gray-400
                           hover:bg-white/5 cursor-pointer transition-all min-h-[26px] mt-1 first:mt-0"
                    onclick={() => toggleGroup(groupName)}
                >
                    <span class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[12px]">
                            {collapsedGroups.has(groupName) ? 'chevron_right' : 'expand_more'}
                        </span>
                        {groupName}
                    </span>
                    <span class="text-[9px] text-gray-600 font-mono">{snaps.length}</span>
                </button>

                {#if !collapsedGroups.has(groupName)}
                    {#each snaps as snap (snap.id)}
                        <!-- Compact card -->
                        <div class="bg-[#0d0d14]/50 border border-[#2a2a3a]/40 rounded-lg ml-2 transition-all
                                    {expandedId === snap.id ? 'border-gray-600/50' : 'hover:border-gray-600/40'}"
                        >
                            <!-- Main row (~36px) -->
                            <div class="flex items-center gap-2 px-3 py-2 group min-h-[36px]">
                                <!-- Color dot -->
                                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: {snap.color}"></span>

                                <!-- Name + inline tags -->
                                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                                    {#if editingId === snap.id}
                                        <input type="text" bind:value={editingName}
                                            onblur={() => finishEditing(snap.id)}
                                            onkeydown={(e) => handleKeyPress(e, snap.id)}
                                            class="bg-[#0d0d14] border border-[#3b82f6] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#3b82f6] font-semibold w-full"
                                            autofocus />
                                    {:else}
                                        <button class="text-[10px] font-semibold text-gray-200 truncate hover:text-white text-left cursor-pointer bg-transparent border-none p-0"
                                            onclick={() => startEditing(snap.id, snap.name)} title="Clic para renombrar">
                                            {snap.name}
                                        </button>
                                    {/if}
                                    {#if snap.tags?.posicion || (snap.tags?.custom && snap.tags.custom.length > 0)}
                                        <div class="flex gap-1 flex-wrap">
                                            {#if snap.tags?.posicion}
                                                <span class="text-[8px] font-semibold px-1.5 py-0.5 rounded-sm bg-white/5 text-gray-400">{snap.tags.posicion}</span>
                                            {/if}
                                            {#each snap.tags?.custom || [] as tag}
                                                <span class="text-[8px] px-1.5 py-0.5 rounded-sm bg-white/5 text-gray-500 italic">{tag}</span>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>

                                <!-- Time -->
                                <span class="text-[9px] font-mono text-gray-600 flex-shrink-0">
                                    {new Date(snap.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>

                                <!-- Visibility toggle (always visible) -->
                                <button class="w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer
                                               {snap.visible ? 'text-gray-400 hover:text-white' : 'text-gray-700 hover:text-gray-400'}"
                                    onclick={() => traceManager.toggleVisibility(snap.id)} title={snap.visible ? "Ocultar" : "Mostrar"}>
                                    <span class="material-symbols-outlined text-[14px]">{snap.visible ? "visibility" : "visibility_off"}</span>
                                </button>

                                <!-- Expand toggle -->
                                <button class="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-gray-300 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                    onclick={() => toggleExpand(snap.id)} title="Expandir">
                                    <span class="material-symbols-outlined text-[14px]">{expandedId === snap.id ? 'expand_less' : 'more_horiz'}</span>
                                </button>
                            </div>

                            <!-- Expanded section -->
                            {#if expandedId === snap.id}
                                <div class="px-3 pb-3 pt-1 flex flex-col gap-2 border-t border-[#2a2a3a]/30">
                                    <!-- Y-Offset slider -->
                                    <div class="flex items-center gap-2">
                                        <span class="text-[9px] text-gray-500 flex-shrink-0">Y-Offset</span>
                                        <input type="range" min="-50" max="50" step="1" bind:value={snap.offsetY}
                                            class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#a855f7]" />
                                        <span class="text-[9px] font-mono font-bold text-[#a855f7] cursor-pointer w-10 text-right"
                                            ondblclick={() => (snap.offsetY = 0)} title="Doble clic para resetear">
                                            {snap.offsetY !== undefined && snap.offsetY > 0 ? `+${snap.offsetY}` : snap.offsetY} dB
                                        </span>
                                    </div>

                                    <!-- Tags pills -->
                                    {#if snap.tags?.ubicacion || snap.tags?.posicion}
                                        <div class="flex gap-1 flex-wrap">
                                            {#if snap.tags?.ubicacion}
                                                <span class="text-[8px] font-semibold px-1.5 py-0.5 rounded-sm" style="background: {snap.color}20; color: {snap.color}">{snap.tags.ubicacion}</span>
                                            {/if}
                                            {#if snap.tags?.posicion}
                                                <span class="text-[8px] font-semibold px-1.5 py-0.5 rounded-sm bg-white/5 text-gray-400">{snap.tags.posicion}</span>
                                            {/if}
                                        </div>
                                    {/if}

                                    <!-- Metadata -->
                                    <div class="flex items-center gap-2 text-[9px] text-gray-600 font-mono">
                                        <span>{new Date(snap.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                                        <span>·</span>
                                        <span>{snap.source === "manual" ? "Manual" : "Secuencial"}</span>
                                        {#if snap.metric}
                                            <span class="bg-[#121216]/50 border border-white/5 px-1 py-0.5 rounded text-[8px] uppercase">{snap.metric}</span>
                                        {/if}
                                    </div>

                                    <!-- Action buttons -->
                                    <div class="flex gap-2">
                                        <button class="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-semibold
                                                       bg-[#0d0d14] border border-[#2a2a3a] text-gray-400 hover:text-[#00ff88] hover:border-[#00ff88]/30 cursor-pointer transition-all min-h-[28px]"
                                            onclick={() => traceManager.exportInstantaneaToJSON(snap.id)}>
                                            <span class="material-symbols-outlined text-[12px]">download</span>
                                            Exportar
                                        </button>
                                        <button class="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-semibold cursor-pointer transition-all min-h-[28px]
                                                       {confirmDeleteId === snap.id
                                                            ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                                                            : 'bg-[#0d0d14] border border-[#2a2a3a] text-gray-500 hover:text-red-400 hover:border-red-500/30'}"
                                            onclick={() => requestDelete(snap.id)}>
                                            <span class="material-symbols-outlined text-[12px]">delete</span>
                                            {confirmDeleteId === snap.id ? '¿Seguro?' : 'Eliminar'}
                                        </button>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                {/if}
            {/each}
        {/if}
    </div>

    <!-- Footer de resumen -->
    {#if sortedSnapshots.length > 0}
        <div class="flex items-center justify-between pt-2 border-t border-[#2a2a3a]/30 flex-shrink-0">
            <span class="text-[9px] text-gray-500">
                {sortedSnapshots.length} instantánea{sortedSnapshots.length !== 1 ? 's' : ''} · {visibleCount} visible{visibleCount !== 1 ? 's' : ''}
            </span>
            <button class="text-[9px] font-semibold cursor-pointer transition-all min-h-[20px] px-2 py-0.5 rounded
                           {confirmDeleteAll
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'text-gray-600 hover:text-red-400'}"
                onclick={requestDeleteAll}>
                {confirmDeleteAll ? '¿Seguro? Clic para confirmar' : 'Borrar todo'}
            </button>
        </div>
    {/if}
</div>

{#if pendingCapture}
    <CaptureModal
        instantanea={pendingCapture}
        onSave={handleModalSave}
        onDiscard={handleModalDiscard}
    />
{/if}
