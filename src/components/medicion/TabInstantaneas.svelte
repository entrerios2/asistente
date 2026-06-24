<script lang="ts">
    import { traceManager, UBICACION_COLORS, type Instantanea } from "$lib/stores/traceManager.svelte";

    let { statusText = $bindable("Listo para medir") } = $props();

    let sortOrder = $state<'newest' | 'oldest' | 'name-az' | 'name-za'>('newest');
    let groupBy = $state<'ubicacion' | 'posicion' | 'etiqueta' | 'none'>('none');
    let editingId = $state<string | null>(null);
    let editingName = $state("");

    let expandedId = $state<string | null>(null);
    let collapsedGroups = $state(new Set<string>());
    let confirmDeleteId = $state<string | null>(null);
    let confirmDeleteAll = $state(false);

    // Delete dialog
    let showDeleteDialog = $state(false);

    // Import dialog
    let pendingImportSnapshots = $state<Instantanea[] | null>(null);

    // Export dialog
    let showExportDialog = $state(false);

    // Filters
    let filterUbicacion = $state<string>('');
    let filterPosicion = $state<string>('');
    let filterCustom = $state<string>('');

    let availableUbicaciones = $derived.by(() => {
        const set = new Set<string>();
        traceManager.instantaneas.forEach(s => { if (s.tags?.ubicacion) set.add(s.tags.ubicacion); });
        return [...set].sort();
    });
    let availablePosiciones = $derived.by(() => {
        const set = new Set<string>();
        traceManager.instantaneas.forEach(s => { if (s.tags?.posicion) set.add(s.tags.posicion); });
        return [...set].sort();
    });
    let availableCustomTags = $derived.by(() => {
        const set = new Set<string>();
        traceManager.instantaneas.forEach(s => { s.tags?.custom?.forEach(t => set.add(t)); });
        return [...set].sort();
    });

    let sortedSnapshots = $derived.by(() => {
        let list = [...traceManager.instantaneas];
        if (filterUbicacion) list = list.filter(s => s.tags?.ubicacion === filterUbicacion);
        if (filterPosicion) list = list.filter(s => s.tags?.posicion === filterPosicion);
        if (filterCustom) list = list.filter(s => s.tags?.custom?.includes(filterCustom));
        switch (sortOrder) {
            case 'newest': return list.sort((a, b) => b.timestamp - a.timestamp);
            case 'oldest': return list.sort((a, b) => a.timestamp - b.timestamp);
            case 'name-az': return list.sort((a, b) => a.name.localeCompare(b.name));
            case 'name-za': return list.sort((a, b) => b.name.localeCompare(a.name));
            default: return list;
        }
    });

    // Group by selected criterion
    let groupedSnapshots = $derived.by(() => {
        const groups = new Map<string, Instantanea[]>();
        if (groupBy === 'none') {
            groups.set('Todas', sortedSnapshots);
        } else {
            sortedSnapshots.forEach(s => {
                let key: string;
                switch (groupBy) {
                    case 'ubicacion': key = s.tags?.ubicacion || 'Sin clasificar'; break;
                    case 'posicion': key = s.tags?.posicion || 'Sin clasificar'; break;
                    case 'etiqueta':
                        if (s.tags?.custom?.length) {
                            s.tags.custom.forEach(t => {
                                if (!groups.has(t)) groups.set(t, []);
                                groups.get(t)!.push(s);
                            });
                            return; // already added
                        }
                        key = 'Sin etiqueta';
                        break;
                    default: key = 'Todas';
                }
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(s);
            });
        }
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
                persistSnap(ins);
            }
        }
        editingId = null;
    }

    function setSnapNotes(snap: Instantanea, notes: string) {
        snap.notes = notes || undefined;
        persistSnap(snap);
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
        const hasActiveFilters = filterUbicacion || filterPosicion || filterCustom;
        if (hasActiveFilters && sortedSnapshots.length < traceManager.instantaneas.length) {
            showDeleteDialog = true;
        } else {
            if (confirmDeleteAll) {
                const ids = traceManager.instantaneas.map(s => s.id);
                ids.forEach(id => traceManager.deleteInstantanea(id));
                confirmDeleteAll = false;
            } else {
                confirmDeleteAll = true;
                setTimeout(() => { confirmDeleteAll = false; }, 3000);
            }
        }
    }

    function deleteFiltered() {
        sortedSnapshots.forEach(s => traceManager.deleteInstantanea(s.id));
        showDeleteDialog = false;
    }

    function deleteAll() {
        traceManager.instantaneas.map(s => s.id).forEach(id => traceManager.deleteInstantanea(id));
        showDeleteDialog = false;
    }

    // --- Tag editing ---
    function setSnapTag(snap: Instantanea, category: 'ubicacion' | 'posicion', value: string) {
        if (!snap.tags) snap.tags = { custom: [] };
        // Toggle: si es el mismo, quitar
        if (snap.tags[category] === value) {
            snap.tags[category] = undefined;
        } else {
            snap.tags[category] = value;
        }
        snap.color = UBICACION_COLORS[snap.tags.ubicacion || ''] || snap.color;
        persistSnap(snap);
    }

    function addSnapCustomTag(snap: Instantanea, tag: string) {
        const trimmed = tag.trim();
        if (!trimmed) return;
        if (!snap.tags) snap.tags = { custom: [] };
        if (!snap.tags.custom.includes(trimmed)) {
            snap.tags.custom = [...snap.tags.custom, trimmed];
            persistSnap(snap);
        }
    }

    function removeSnapCustomTag(snap: Instantanea, tag: string) {
        if (!snap.tags) return;
        snap.tags.custom = snap.tags.custom.filter(t => t !== tag);
        persistSnap(snap);
    }

    async function persistSnap(snap: Instantanea) {
        try {
            const { saveInstantanea } = await import("$lib/utils/db");
            // Deep-clone all fields to strip Svelte 5 proxies
            const serializedData: Record<string, ArrayBuffer> = {};
            for (const metric in snap.data) {
                serializedData[metric] = new Float32Array(snap.data[metric]).buffer.slice(0);
            }
            const plainTags = snap.tags ? JSON.parse(JSON.stringify(snap.tags)) : undefined;
            const plainMeta = snap.metadata ? JSON.parse(JSON.stringify(snap.metadata)) : undefined;
            await saveInstantanea({
                id: snap.id,
                name: snap.name,
                timestamp: snap.timestamp,
                data: serializedData,
                visible: snap.visible,
                color: snap.color,
                source: snap.source,
                metric: snap.metric,
                offsetY: snap.offsetY,
                tags: plainTags,
                notes: snap.notes,
                sessionId: snap.sessionId,
                metadata: plainMeta,
            });
        } catch (e) {
            console.error('[TabInstantaneas] Error persistiendo:', e);
        }
    }

    async function captureActiveLive() {
        // captureInstantanea sets pendingCaptureForModal automatically
        // Modal is rendered globally in +page.svelte
        await traceManager.captureInstantanea();
    }

    async function handleOpenFile(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = traceManager.parseSnapshotsFile(text);
            if (parsed.length === 0) {
                statusText = "Archivo sin instantáneas válidas";
                return;
            }
            // Si no hay existentes, agregar directo
            if (traceManager.instantaneas.length === 0) {
                await traceManager.importSnapshots(parsed, false);
                statusText = `${parsed.length} instantánea${parsed.length > 1 ? 's' : ''} importada${parsed.length > 1 ? 's' : ''}`;
            } else {
                // Mostrar diálogo para elegir reemplazar o agregar
                pendingImportSnapshots = parsed;
            }
        } catch (err) {
            console.error('[TabInstantaneas] Error abriendo archivo:', err);
            statusText = "Error al abrir archivo";
        }
        // Reset input para poder abrir el mismo archivo otra vez
        input.value = '';
    }

    async function confirmImport(replaceAll: boolean) {
        if (!pendingImportSnapshots) return;
        await traceManager.importSnapshots(pendingImportSnapshots, replaceAll);
        const count = pendingImportSnapshots.length;
        statusText = replaceAll
            ? `${count} instantánea${count > 1 ? 's' : ''} cargada${count > 1 ? 's' : ''} (anteriores reemplazadas)`
            : `${count} instantánea${count > 1 ? 's' : ''} agregada${count > 1 ? 's' : ''}`;
        pendingImportSnapshots = null;
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
            Capturar
        </button>
    </div>

    <!-- Filtros + Sort/Group -->
    <div class="flex flex-wrap gap-1.5 items-center">
        {#if availableUbicaciones.length > 0}
            <select class="bg-[#0d0d14] border border-[#2a2a3a] rounded-md px-2 py-1 text-[9px] text-gray-300 focus:outline-none focus:border-[#3b82f6] cursor-pointer min-h-[24px]"
                style="color-scheme: dark;"
                bind:value={filterUbicacion}>
                <option value="">Ubicación</option>
                {#each availableUbicaciones as ub}<option value={ub}>{ub}</option>{/each}
            </select>
        {/if}
        {#if availablePosiciones.length > 0}
            <select class="bg-[#0d0d14] border border-[#2a2a3a] rounded-md px-2 py-1 text-[9px] text-gray-300 focus:outline-none focus:border-[#3b82f6] cursor-pointer min-h-[24px]"
                style="color-scheme: dark;"
                bind:value={filterPosicion}>
                <option value="">Posición</option>
                {#each availablePosiciones as pos}<option value={pos}>{pos}</option>{/each}
            </select>
        {/if}
        {#if availableCustomTags.length > 0}
            <select class="bg-[#0d0d14] border border-[#2a2a3a] rounded-md px-2 py-1 text-[9px] text-gray-300 focus:outline-none focus:border-[#3b82f6] cursor-pointer min-h-[24px]"
                style="color-scheme: dark;"
                bind:value={filterCustom}>
                <option value="">Etiqueta</option>
                {#each availableCustomTags as tag}<option value={tag}>{tag}</option>{/each}
            </select>
        {/if}
        {#if filterUbicacion || filterPosicion || filterCustom}
            <button class="text-[9px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors px-1"
                onclick={() => { filterUbicacion = ''; filterPosicion = ''; filterCustom = ''; }}>Limpiar</button>
        {/if}
        <!-- Spacer -->
        <div class="flex-1"></div>
        <!-- Sort icon-only -->
        <div class="relative flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-all" title="Ordenar">
            <span class="material-symbols-outlined text-[14px] text-gray-500 pointer-events-none">sort</span>
            <select class="absolute inset-0 opacity-0 cursor-pointer text-[9px]"
                style="color-scheme: dark;"
                bind:value={sortOrder}>
                <option value="newest">⬇ Recientes</option>
                <option value="oldest">⬆ Antiguos</option>
                <option value="name-az">A→Z</option>
                <option value="name-za">Z→A</option>
            </select>
        </div>
        <!-- Group icon-only -->
        <div class="relative flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-all" title="Agrupar">
            <span class="material-symbols-outlined text-[14px] text-gray-500 pointer-events-none">workspaces</span>
            <select class="absolute inset-0 opacity-0 cursor-pointer text-[9px]"
                style="color-scheme: dark;"
                bind:value={groupBy}>
                <option value="ubicacion">Ubicación</option>
                <option value="posicion">Posición</option>
                <option value="etiqueta">Etiqueta</option>
                <option value="none">Sin agrupar</option>
            </select>
        </div>
    </div>

    <!-- Lista agrupada por ubicación -->
    <div class="flex-1 flex flex-col gap-0.5 min-h-0 overflow-y-auto pr-0.5">
        {#if sortedSnapshots.length === 0}
            <div class="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-[#2a2a3a] rounded-xl gap-2">
                <span class="material-symbols-outlined text-gray-600 text-2xl">add_photo_alternate</span>
                <p class="text-[10px] text-gray-500">{traceManager.instantaneas.length === 0 ? 'Capture una instantánea para comenzar' : 'No hay resultados para estos filtros'}</p>
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
                        <!-- Card -->
                        <div class="bg-[#0d0d14]/50 border border-[#2a2a3a]/40 rounded-lg ml-2 transition-all
                                    {expandedId === snap.id ? 'border-gray-600/50' : 'hover:border-gray-600/40'}"
                        >
                            <!-- Main row - clickable to expand -->
                            <button class="w-full flex items-center gap-2 px-3 py-2 group min-h-[36px] cursor-pointer bg-transparent border-none text-left"
                                onclick={() => toggleExpand(snap.id)}>
                                <!-- Color dot -->
                                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: {snap.color}"></span>

                                <!-- Name + inline tags -->
                                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <span class="text-[10px] font-semibold text-gray-200 truncate">{snap.name}</span>
                                    {#if snap.tags?.posicion || (snap.tags?.custom && snap.tags.custom.length > 0)}
                                        <div class="flex gap-1 flex-wrap">
                                            {#if snap.tags?.posicion}
                                                <span class="text-[8px] font-semibold px-1.5 py-0.5 rounded-sm bg-white/5 text-gray-400">{snap.tags.posicion}</span>
                                            {/if}
                                            {#each snap.tags?.custom || [] as tag}
                                                <span class="text-[8px] px-1.5 py-0.5 rounded-sm bg-[#a855f7]/10 text-[#a855f7]/70 italic">{tag}</span>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>

                                <!-- Time -->
                                <span class="text-[9px] font-mono text-gray-600 flex-shrink-0">
                                    {new Date(snap.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>

                                <!-- Visibility toggle -->
                                <span class="w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer
                                               {snap.visible ? 'text-gray-400 hover:text-white' : 'text-gray-700 hover:text-gray-400'}"
                                    onclick={(e) => { e.stopPropagation(); traceManager.toggleVisibility(snap.id); }}>
                                    <span class="material-symbols-outlined text-[14px]">{snap.visible ? "visibility" : "visibility_off"}</span>
                                </span>

                                <!-- Expand indicator -->
                                <span class="material-symbols-outlined text-[12px] text-gray-600 transition-transform
                                             {expandedId === snap.id ? 'rotate-180' : ''}">expand_more</span>
                            </button>

                            <!-- Expanded section -->
                            {#if expandedId === snap.id}
                                <div class="px-3 pb-3 pt-1 flex flex-col gap-2 border-t border-[#2a2a3a]/30">
                                    <!-- Editable name -->
                                    <div class="flex items-center gap-1.5">
                                        {#if editingId === snap.id}
                                            <input type="text" bind:value={editingName}
                                                onblur={() => finishEditing(snap.id)}
                                                onkeydown={(e) => handleKeyPress(e, snap.id)}
                                                class="flex-1 bg-[#0d0d14] border border-[#3b82f6] rounded px-2 py-1 text-[10px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#3b82f6] font-semibold"
                                                autofocus />
                                        {:else}
                                            <button class="flex-1 text-[10px] font-semibold text-gray-200 hover:text-white text-left cursor-pointer bg-transparent border-none p-0 truncate"
                                                onclick={() => startEditing(snap.id, snap.name)} title="Clic para renombrar">
                                                <span class="material-symbols-outlined text-[10px] text-gray-600 mr-1">edit</span>
                                                {snap.name}
                                            </button>
                                        {/if}
                                    </div>

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

                                    <!-- Editable Tags -->
                                    <div class="flex flex-col gap-1.5">
                                        <span class="text-[9px] text-gray-500 font-semibold">Ubicación</span>
                                        <div class="flex gap-1 flex-wrap">
                                            {#each traceManager.tagPresets.ubicacion as ub}
                                                <button
                                                    class="px-1.5 py-0.5 rounded-sm text-[8px] font-semibold cursor-pointer transition-all border
                                                           {snap.tags?.ubicacion === ub
                                                                ? 'border-transparent text-white'
                                                                : 'bg-transparent border-[#2a2a3a] text-gray-600 hover:text-gray-400'}"
                                                    style={snap.tags?.ubicacion === ub ? `background-color: ${UBICACION_COLORS[ub] || '#3b82f6'}` : ''}
                                                    onclick={() => setSnapTag(snap, 'ubicacion', ub)}
                                                >{ub}</button>
                                            {/each}
                                        </div>
                                        <span class="text-[9px] text-gray-500 font-semibold">Posición</span>
                                        <div class="flex gap-1 flex-wrap">
                                            {#each traceManager.tagPresets.posicion as pos}
                                                <button
                                                    class="px-1.5 py-0.5 rounded-sm text-[8px] font-semibold cursor-pointer transition-all border
                                                           {snap.tags?.posicion === pos
                                                                ? 'bg-[#3b82f6] border-transparent text-white'
                                                                : 'bg-transparent border-[#2a2a3a] text-gray-600 hover:text-gray-400'}"
                                                    onclick={() => setSnapTag(snap, 'posicion', pos)}
                                                >{pos}</button>
                                            {/each}
                                        </div>
                                        <span class="text-[9px] text-gray-500 font-semibold">Etiquetas</span>
                                        <div class="flex gap-1 flex-wrap">
                                            {#each snap.tags?.custom || [] as tag}
                                                <span class="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[8px] font-semibold bg-[#a855f7]/10 text-[#a855f7]">
                                                    {tag}
                                                    <button class="text-[#a855f7]/40 hover:text-white cursor-pointer text-[9px] leading-none"
                                                        onclick={() => removeSnapCustomTag(snap, tag)}>×</button>
                                                </span>
                                            {/each}
                                            <input type="text" placeholder="+"
                                                class="w-14 bg-transparent border border-dashed border-[#2a2a3a] rounded-sm px-1 py-0.5 text-[8px] text-gray-500 placeholder:text-gray-700 focus:outline-none focus:border-[#a855f7]"
                                                onkeydown={(e) => { if (e.key === 'Enter') { addSnapCustomTag(snap, (e.currentTarget as HTMLInputElement).value); (e.currentTarget as HTMLInputElement).value = ''; } }} />
                                        </div>
                                    </div>

                                    <!-- Notes -->
                                    <div class="flex flex-col gap-1">
                                        <span class="text-[9px] text-gray-500 font-semibold">Notas</span>
                                        <textarea
                                            class="bg-[#0d0d14] border border-[#2a2a3a] rounded-md px-2 py-1.5 text-[9px] text-gray-300 placeholder:text-gray-700
                                                   focus:outline-none focus:border-[#3b82f6] resize-none min-h-[40px]"
                                            placeholder="Agregar nota..."
                                            value={snap.notes || ''}
                                            onblur={(e) => setSnapNotes(snap, (e.currentTarget as HTMLTextAreaElement).value)}
                                        ></textarea>
                                    </div>

                                    <!-- Metrics pills -->
                                    <div class="flex flex-col gap-1">
                                        <span class="text-[9px] text-gray-500 font-semibold">Métricas</span>
                                        <div class="flex gap-1 flex-wrap">
                                            {#each Object.keys(snap.data) as metric}
                                                <span class="text-[8px] font-mono px-1.5 py-0.5 rounded-sm bg-[#0d0d14] border border-[#2a2a3a] text-gray-400">{metric}</span>
                                            {/each}
                                        </div>
                                    </div>

                                    <!-- Metadata -->
                                    <div class="flex items-center gap-2 text-[9px] text-gray-600 font-mono">
                                        <span>{new Date(snap.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                                        <span>·</span>
                                        <span>{snap.source === "manual" ? "Manual" : "Secuencial"}</span>
                                    </div>

                                    <!-- Action buttons -->
                                    <div class="flex gap-2">
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

    <!-- Footer -->
    <div class="flex items-center justify-between pt-2 border-t border-[#2a2a3a]/30 flex-shrink-0 gap-1">
        <span class="text-[9px] text-gray-500 flex-shrink-0">
            {sortedSnapshots.length}{sortedSnapshots.length !== traceManager.instantaneas.length ? `/${traceManager.instantaneas.length}` : ''}
            · {visibleCount} vis
        </span>
        <div class="flex items-center gap-1">
            <input type="file" accept=".snapshots.json,.snapshot.json" class="hidden" id="open-snap-input"
                onchange={handleOpenFile}
            />
            <button
                class="flex items-center justify-center w-6 h-6 rounded text-gray-600 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
                title="Guardar"
                onclick={() => {
                    const hasActiveFilters = filterUbicacion || filterPosicion || filterCustom;
                    if (hasActiveFilters && sortedSnapshots.length < traceManager.instantaneas.length) {
                        showExportDialog = true;
                    } else {
                        traceManager.exportAllInstantaneas();
                    }
                }}
                disabled={traceManager.instantaneas.length === 0}
            >
                <span class="material-symbols-outlined text-[14px]">save</span>
            </button>
            <label for="open-snap-input"
                class="flex items-center justify-center w-6 h-6 rounded text-gray-600 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
                title="Abrir">
                <span class="material-symbols-outlined text-[14px]">folder_open</span>
            </label>
            <button
                class="flex items-center justify-center w-6 h-6 rounded cursor-pointer transition-all
                       {confirmDeleteAll
                            ? 'text-red-400 bg-red-500/20'
                            : 'text-gray-600 hover:text-red-400 hover:bg-white/5'}"
                title={confirmDeleteAll ? '¿Seguro? Clic para confirmar' : 'Borrar todo'}
                onclick={requestDeleteAll}
                disabled={traceManager.instantaneas.length === 0}
            >
                <span class="material-symbols-outlined text-[14px]">delete_sweep</span>
            </button>
            <button
                class="flex items-center justify-center w-6 h-6 rounded text-gray-600 hover:text-[#3b82f6] hover:bg-white/5 cursor-pointer transition-all"
                title="Compartir"
                onclick={async () => {
                    if (traceManager.instantaneas.length === 0) return;
                    try {
                        const jsonStr = JSON.stringify({ _version: 1, snapshots: traceManager.instantaneas.map(ins => {
                            const d: Record<string, number[]> = {};
                            for (const m in ins.data) d[m] = Array.from(ins.data[m]);
                            return { id: ins.id, name: ins.name, timestamp: ins.timestamp, visible: ins.visible, color: ins.color, source: ins.source, metric: ins.metric, offsetY: ins.offsetY, tags: ins.tags, notes: ins.notes, sessionId: ins.sessionId, metadata: ins.metadata, data: d };
                        })}, null, 2);
                        const file = new File([jsonStr], `instantaneas_${new Date().toISOString().slice(0,10)}.snapshots.json`, { type: 'application/json' });
                        if (navigator.canShare?.({ files: [file] })) {
                            await navigator.share({ files: [file], title: 'Instantáneas' });
                        } else {
                            // Fallback: copiar al clipboard
                            await navigator.clipboard.writeText(jsonStr);
                            statusText = 'Datos copiados al portapapeles';
                        }
                    } catch (err: any) {
                        if (err?.name !== 'AbortError') {
                            traceManager.exportAllInstantaneas();
                        }
                    }
                }}
                disabled={traceManager.instantaneas.length === 0}
            >
                <span class="material-symbols-outlined text-[14px]">share</span>
            </button>
        </div>
    </div>
</div>

<!-- Import mode dialog -->
{#if pendingImportSnapshots}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
        style="z-index: 100;"
        role="dialog"
        aria-modal="true"
        aria-label="Importar instantáneas"
        onclick={(e) => { if (e.target === e.currentTarget) pendingImportSnapshots = null; }}
    >
        <div class="bg-[#16161e] border border-[#2a2a3a] rounded-2xl shadow-2xl w-[340px] max-w-[90vw] p-5 flex flex-col gap-4">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[#3b82f6] text-xl">folder_open</span>
                <h2 class="text-sm font-bold text-gray-200">Abrir instantáneas</h2>
            </div>
            <p class="text-xs text-gray-400">
                El archivo contiene <strong class="text-gray-200">{pendingImportSnapshots.length}</strong> instantánea{pendingImportSnapshots.length !== 1 ? 's' : ''}.
                Ya tenés <strong class="text-gray-200">{traceManager.instantaneas.length}</strong> en memoria.
            </p>
            <div class="flex flex-col gap-2">
                <button
                    class="w-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8]
                           text-white rounded-lg py-2.5 text-xs font-bold cursor-pointer transition-all shadow-lg min-h-[36px]
                           flex items-center justify-center gap-1.5"
                    onclick={() => confirmImport(false)}
                >
                    <span class="material-symbols-outlined text-sm">add</span>
                    Agregar a las existentes
                </button>
                <button
                    class="w-full bg-[#0d0d14] border border-[#2a2a3a] hover:border-orange-500/40
                           text-gray-400 hover:text-orange-400 rounded-lg py-2.5 text-xs font-semibold cursor-pointer
                           transition-all min-h-[36px] flex items-center justify-center gap-1.5"
                    onclick={() => confirmImport(true)}
                >
                    <span class="material-symbols-outlined text-sm">swap_horiz</span>
                    Reemplazar todas
                </button>
            </div>
            <button
                class="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors text-center"
                onclick={() => pendingImportSnapshots = null}
            >
                Cancelar
            </button>
        </div>
    </div>
{/if}

<!-- Export selection dialog -->
{#if showExportDialog}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
        style="z-index: 100;"
        onclick={(e) => { if (e.target === e.currentTarget) showExportDialog = false; }}
        role="dialog"
        aria-modal="true"
    >
        <div class="bg-[#16161e] border border-[#2a2a3a] rounded-2xl shadow-2xl w-[340px] max-w-[90vw] p-5 flex flex-col gap-4">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[#3b82f6] text-xl">save</span>
                <h2 class="text-sm font-bold text-gray-200">Guardar instantáneas</h2>
            </div>
            <p class="text-xs text-gray-400">
                Tenés filtros activos. ¿Qué querés guardar?
            </p>
            <div class="flex flex-col gap-2">
                <button
                    class="w-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8]
                           text-white rounded-lg py-2.5 text-xs font-bold cursor-pointer transition-all shadow-lg min-h-[36px]
                           flex items-center justify-center gap-1.5"
                    onclick={() => { traceManager.exportInstantaneas(sortedSnapshots); showExportDialog = false; }}
                >
                    <span class="material-symbols-outlined text-sm">filter_alt</span>
                    Selección ({sortedSnapshots.length})
                </button>
                <button
                    class="w-full bg-[#0d0d14] border border-[#2a2a3a] hover:border-gray-500
                           text-gray-400 hover:text-white rounded-lg py-2.5 text-xs font-semibold cursor-pointer
                           transition-all min-h-[36px] flex items-center justify-center gap-1.5"
                    onclick={() => { traceManager.exportAllInstantaneas(); showExportDialog = false; }}
                >
                    <span class="material-symbols-outlined text-sm">select_all</span>
                    Todas ({traceManager.instantaneas.length})
                </button>
            </div>
            <button
                class="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors text-center"
                onclick={() => showExportDialog = false}
            >
                Cancelar
            </button>
        </div>
    </div>
{/if}

<!-- Delete selection dialog -->
{#if showDeleteDialog}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
        style="z-index: 100;"
        onclick={(e) => { if (e.target === e.currentTarget) showDeleteDialog = false; }}
        role="dialog"
        aria-modal="true"
    >
        <div class="bg-[#16161e] border border-[#2a2a3a] rounded-2xl shadow-2xl w-[340px] max-w-[90vw] p-5 flex flex-col gap-4">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-red-400 text-xl">delete_sweep</span>
                <h2 class="text-sm font-bold text-gray-200">Borrar instantáneas</h2>
            </div>
            <p class="text-xs text-gray-400">
                Tenés filtros activos. ¿Qué querés borrar?
            </p>
            <div class="flex flex-col gap-2">
                <button
                    class="w-full bg-red-500/20 border border-red-500/30 hover:bg-red-500/30
                           text-red-400 rounded-lg py-2.5 text-xs font-bold cursor-pointer transition-all min-h-[36px]
                           flex items-center justify-center gap-1.5"
                    onclick={deleteFiltered}
                >
                    <span class="material-symbols-outlined text-sm">filter_alt</span>
                    Selección ({sortedSnapshots.length})
                </button>
                <button
                    class="w-full bg-[#0d0d14] border border-[#2a2a3a] hover:border-red-500/40
                           text-gray-400 hover:text-red-400 rounded-lg py-2.5 text-xs font-semibold cursor-pointer
                           transition-all min-h-[36px] flex items-center justify-center gap-1.5"
                    onclick={deleteAll}
                >
                    <span class="material-symbols-outlined text-sm">select_all</span>
                    Todas ({traceManager.instantaneas.length})
                </button>
            </div>
            <button
                class="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors text-center"
                onclick={() => showDeleteDialog = false}
            >
                Cancelar
            </button>
        </div>
    </div>
{/if}
