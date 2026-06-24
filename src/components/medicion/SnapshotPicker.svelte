<script lang="ts">
    import { traceManager, type Instantanea } from "$lib/stores/traceManager.svelte";

    let {
        mode = 'multi',
        selectedIds = $bindable<string[]>([]),
        onSelect,
        showOperations = false,
        operation = $bindable<'average' | 'min' | 'max'>('average'),
        onOperationChange,
        maxHeight = '200px',
    }: {
        mode?: 'single' | 'multi';
        selectedIds?: string[];
        onSelect?: (ids: string[]) => void;
        showOperations?: boolean;
        operation?: 'average' | 'min' | 'max';
        onOperationChange?: (op: 'average' | 'min' | 'max') => void;
        maxHeight?: string;
    } = $props();

    let filterUbicacion = $state<string | null>(null);
    let filterPosicion = $state<string | null>(null);

    // Collect unique tags from all snapshots
    let availableUbicaciones = $derived.by(() => {
        const set = new Set<string>();
        traceManager.instantaneas.forEach(s => {
            if (s.tags?.ubicacion) set.add(s.tags.ubicacion);
        });
        return [...set].sort();
    });

    let availablePosiciones = $derived.by(() => {
        const set = new Set<string>();
        traceManager.instantaneas.forEach(s => {
            if (s.tags?.posicion) set.add(s.tags.posicion);
        });
        return [...set].sort();
    });

    // Filter snapshots
    let filteredSnapshots = $derived.by(() => {
        return traceManager.instantaneas.filter(s => {
            if (filterUbicacion && s.tags?.ubicacion !== filterUbicacion) return false;
            if (filterPosicion && s.tags?.posicion !== filterPosicion) return false;
            return true;
        });
    });

    // Group by ubicación
    let groupedSnapshots = $derived.by(() => {
        const groups = new Map<string, Instantanea[]>();
        filteredSnapshots.forEach(s => {
            const key = s.tags?.ubicacion || 'Sin clasificar';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(s);
        });
        return groups;
    });

    let collapsedGroups = $state(new Set<string>());

    function toggleGroup(key: string) {
        const next = new Set(collapsedGroups);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        collapsedGroups = next;
    }

    function isSelected(id: string): boolean {
        return selectedIds.includes(id);
    }

    function toggleSelection(id: string) {
        if (mode === 'single') {
            selectedIds = [id];
            onSelect?.([id]);
        } else {
            if (isSelected(id)) {
                selectedIds = selectedIds.filter(i => i !== id);
            } else {
                selectedIds = [...selectedIds, id];
            }
            onSelect?.(selectedIds);
        }
    }

    function selectAllFiltered() {
        selectedIds = filteredSnapshots.map(s => s.id);
        onSelect?.(selectedIds);
    }

    function selectNone() {
        selectedIds = [];
        onSelect?.(selectedIds);
    }

    function handleOperationChange(op: 'average' | 'min' | 'max') {
        operation = op;
        onOperationChange?.(op);
    }

    let selectedCount = $derived(selectedIds.length);
</script>

<div class="flex flex-col gap-2 text-xs">
    <!-- Filters -->
    {#if availableUbicaciones.length > 0 || availablePosiciones.length > 0}
        <div class="flex gap-2 items-center flex-wrap">
            {#if availableUbicaciones.length > 0}
                <select
                    class="bg-[var(--bg-deep)] border border-[var(--bg-elevated)] rounded-md px-2 py-1 text-[10px] text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--accent)] min-h-[24px]"
                    onchange={(e) => { filterUbicacion = e.currentTarget.value || null; }}
                >
                    <option value="">Ubicación</option>
                    {#each availableUbicaciones as ub}
                        <option value={ub} selected={filterUbicacion === ub}>{ub}</option>
                    {/each}
                </select>
            {/if}
            {#if availablePosiciones.length > 0}
                <select
                    class="bg-[var(--bg-deep)] border border-[var(--bg-elevated)] rounded-md px-2 py-1 text-[10px] text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--accent)] min-h-[24px]"
                    onchange={(e) => { filterPosicion = e.currentTarget.value || null; }}
                >
                    <option value="">Posición</option>
                    {#each availablePosiciones as pos}
                        <option value={pos} selected={filterPosicion === pos}>{pos}</option>
                    {/each}
                </select>
            {/if}
        </div>
    {/if}

    <!-- Grouped list -->
    <div class="overflow-y-auto flex flex-col gap-0.5" style="max-height: {maxHeight}">
        {#if filteredSnapshots.length === 0}
            <div class="text-[10px] text-[var(--text-muted)] italic py-3 text-center">
                Sin instantáneas{filterUbicacion || filterPosicion ? ' con estos filtros' : ''}
            </div>
        {:else}
            {#each [...groupedSnapshots.entries()] as [groupName, snaps]}
                <!-- Group header -->
                <button
                    class="flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] font-bold text-[var(--text-secondary)]
                           hover:bg-white/5 cursor-pointer transition-all min-h-[24px]"
                    onclick={() => toggleGroup(groupName)}
                >
                    <span class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[12px]">
                            {collapsedGroups.has(groupName) ? 'chevron_right' : 'expand_more'}
                        </span>
                        {groupName}
                    </span>
                    <span class="text-[9px] text-[var(--text-muted)] font-mono">{snaps.length}</span>
                </button>

                {#if !collapsedGroups.has(groupName)}
                    {#each snaps as snap}
                        <button
                            class="flex items-center gap-2 px-2 py-1.5 ml-3 rounded-md transition-all cursor-pointer min-h-[28px]
                                   {isSelected(snap.id)
                                        ? 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)]'
                                        : 'hover:bg-white/5 border border-transparent'}"
                            onclick={() => toggleSelection(snap.id)}
                        >
                            <!-- Checkbox/Radio -->
                            {#if mode === 'multi'}
                                <span class="material-symbols-outlined text-[14px] {isSelected(snap.id) ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}">
                                    {isSelected(snap.id) ? 'check_box' : 'check_box_outline_blank'}
                                </span>
                            {:else}
                                <span class="material-symbols-outlined text-[14px] {isSelected(snap.id) ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}">
                                    {isSelected(snap.id) ? 'radio_button_checked' : 'radio_button_unchecked'}
                                </span>
                            {/if}

                            <!-- Color dot -->
                            <span
                                class="w-2 h-2 rounded-full flex-shrink-0"
                                style="background-color: {snap.color}"
                            ></span>

                            <!-- Name + time -->
                            <span class="flex-1 text-left truncate text-[10px] text-[var(--text-primary)]">
                                {snap.tags?.posicion || snap.name}
                            </span>
                            <span class="text-[9px] text-[var(--text-muted)] font-mono flex-shrink-0">
                                {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </button>
                    {/each}
                {/if}
            {/each}
        {/if}
    </div>

    <!-- Footer: count + select all/none -->
    {#if mode === 'multi' && filteredSnapshots.length > 0}
        <div class="flex items-center justify-between px-1 pt-1 border-t border-[var(--bg-elevated)]/50">
            <span class="text-[9px] text-[var(--text-muted)]">
                {selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}
            </span>
            <div class="flex gap-2">
                <button
                    class="text-[9px] text-[var(--accent)] hover:text-[#60a5fa] cursor-pointer font-semibold min-h-[20px]"
                    onclick={selectAllFiltered}
                >
                    Todas
                </button>
                <button
                    class="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer font-semibold min-h-[20px]"
                    onclick={selectNone}
                >
                    Ninguna
                </button>
            </div>
        </div>
    {/if}

    <!-- Operation selector -->
    {#if showOperations && selectedCount > 1}
        <div class="flex items-center gap-2 px-1">
            <span class="text-[9px] text-[var(--text-muted)]">Operación:</span>
            <div class="flex bg-[var(--bg-deep)] p-0.5 rounded-md border border-[var(--bg-elevated)]/40">
                {#each [['average', 'Promedio'], ['min', 'Mínimo'], ['max', 'Máximo']] as [op, label]}
                    <button
                        class="px-2 py-0.5 text-[9px] font-semibold rounded transition-all cursor-pointer min-h-[20px]
                               {operation === op
                                    ? 'bg-[var(--accent)] text-white shadow'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                        onclick={() => handleOperationChange(op as 'average' | 'min' | 'max')}
                    >
                        {label}
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>
