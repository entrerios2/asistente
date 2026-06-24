<script lang="ts">
    import { traceManager, UBICACION_COLORS, type Instantanea, type InstantaneaTags } from "$lib/stores/traceManager.svelte";

    let {
        instantanea,
        onSave,
        onDiscard,
    }: {
        instantanea: Instantanea;
        onSave: (tags: InstantaneaTags, name: string, notes?: string) => void;
        onDiscard: () => void;
    } = $props();

    let selectedUbicacion = $state<string | undefined>(traceManager.lastUsedTags.ubicacion);
    let selectedPosicion = $state<string | undefined>(traceManager.lastUsedTags.posicion);
    let customTags = $state<string[]>([]);
    let newCustomTag = $state("");
    let notes = $state("");
    let editedName = $state(instantanea.name);

    // Custom tag inputs for presets
    let showAddUbicacion = $state(false);
    let showAddPosicion = $state(false);
    let newUbicacionValue = $state("");
    let newPosicionValue = $state("");

    // Close confirmation
    let showCloseConfirm = $state(false);

    // Auto-update name when tags change
    $effect(() => {
        editedName = traceManager.generateSnapName({
            ubicacion: selectedUbicacion,
            posicion: selectedPosicion,
        });
    });

    function handleSave() {
        const tags: InstantaneaTags = {
            ubicacion: selectedUbicacion,
            posicion: selectedPosicion,
            custom: customTags.filter(t => t.trim()),
        };
        traceManager.lastUsedTags = {
            ubicacion: selectedUbicacion,
            posicion: selectedPosicion,
        };
        onSave(tags, editedName, notes.trim() || undefined);
    }

    function handleCloseRequest() {
        showCloseConfirm = true;
    }

    function handleConfirmDiscard() {
        onDiscard();
    }

    function handleConfirmSave() {
        handleSave();
    }

    function cancelCloseConfirm() {
        showCloseConfirm = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === "Escape") {
            e.preventDefault();
            if (showCloseConfirm) cancelCloseConfirm();
            else handleCloseRequest();
        }
    }

    function toggleUbicacion(value: string) {
        selectedUbicacion = selectedUbicacion === value ? undefined : value;
    }

    function togglePosicion(value: string) {
        selectedPosicion = selectedPosicion === value ? undefined : value;
    }

    function addCustomUbicacion() {
        if (newUbicacionValue.trim()) {
            traceManager.addTagPreset('ubicacion', newUbicacionValue);
            selectedUbicacion = newUbicacionValue.trim();
            newUbicacionValue = "";
        }
        showAddUbicacion = false;
    }

    function addCustomPosicion() {
        if (newPosicionValue.trim()) {
            traceManager.addTagPreset('posicion', newPosicionValue);
            selectedPosicion = newPosicionValue.trim();
            newPosicionValue = "";
        }
        showAddPosicion = false;
    }

    function addCustomTag() {
        const trimmed = newCustomTag.trim();
        if (trimmed && !customTags.includes(trimmed)) {
            customTags = [...customTags, trimmed];
        }
        newCustomTag = "";
    }

    function removeCustomTag(tag: string) {
        customTags = customTags.filter(t => t !== tag);
    }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 bg-[var(--bg-deep)]/60 backdrop-blur-sm flex items-center justify-center"
    style="z-index: 100;"
    onclick={(e) => { if (e.target === e.currentTarget) handleCloseRequest(); }}
    role="dialog"
    aria-modal="true"
    aria-label="Etiquetar instantánea"
>
    <div
        class="bg-[var(--bg-tertiary)] border border-[var(--bg-elevated)] rounded-2xl shadow-2xl w-[380px] max-w-[90vw] p-5 flex flex-col gap-4"
        onkeydown={handleKeydown}
    >
        {#if showCloseConfirm}
            <div class="flex flex-col gap-3 items-center py-2">
                <span class="material-symbols-outlined text-[#fbbf24] text-2xl">help</span>
                <p class="text-xs text-[var(--text-primary)] text-center">¿Qué querés hacer con esta instantánea?</p>
                <div class="flex gap-2 w-full">
                    <button
                        class="flex-1 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] hover:from-[var(--accent-hover)] hover:to-[var(--accent-hover)]
                               text-white rounded-lg py-2.5 text-xs font-bold cursor-pointer transition-all shadow-lg min-h-[36px]
                               flex items-center justify-center gap-1.5"
                        onclick={handleConfirmSave}
                    >
                        <span class="material-symbols-outlined text-sm">save</span>
                        Guardar
                    </button>
                    <button
                        class="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20
                               text-red-400 rounded-lg py-2.5 text-xs font-bold cursor-pointer transition-all min-h-[36px]
                               flex items-center justify-center gap-1.5"
                        onclick={handleConfirmDiscard}
                    >
                        <span class="material-symbols-outlined text-sm">delete</span>
                        Descartar
                    </button>
                </div>
                <button
                    class="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                    onclick={cancelCloseConfirm}
                >Cancelar</button>
            </div>
        {:else}
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[var(--accent-green)] text-xl">check_circle</span>
                    <h2 class="text-sm font-bold text-[var(--text-primary)]">Instantánea capturada</h2>
                </div>
                <button
                    class="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 cursor-pointer transition-all"
                    onclick={handleCloseRequest}
                    title="Cerrar"
                >
                    <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>

            <!-- Name -->
            <div class="flex flex-col gap-1.5">
                <label for="snap-name" class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Nombre</label>
                <input id="snap-name" type="text" bind:value={editedName}
                    class="bg-[var(--bg-deep)] border border-[var(--bg-elevated)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition-all"
                    autofocus />
            </div>

            <!-- Ubicación (single select) -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Ubicación</label>
                <div class="flex flex-wrap gap-1.5">
                    {#each traceManager.tagPresets.ubicacion as ub}
                        <button
                            class="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border min-h-[28px]
                                   {selectedUbicacion === ub
                                        ? 'border-transparent text-white shadow-lg'
                                        : 'bg-[var(--bg-deep)] border-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-gray-600'}"
                            style={selectedUbicacion === ub ? `background-color: ${UBICACION_COLORS[ub] || 'var(--accent)'}` : ''}
                            onclick={() => toggleUbicacion(ub)}
                        >{ub}</button>
                    {/each}
                    {#if showAddUbicacion}
                        <div class="flex items-center gap-1">
                            <input type="text" bind:value={newUbicacionValue} placeholder="Nuevo..."
                                class="bg-[var(--bg-deep)] border border-[color-mix(in_srgb,var(--accent)_50%,transparent)] rounded-lg px-2 py-1 text-[10px] text-[var(--text-primary)] w-20
                                       focus:outline-none focus:border-[var(--accent)]"
                                onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addCustomUbicacion(); } else if (e.key === 'Escape') { e.stopPropagation(); showAddUbicacion = false; } }}
                                autofocus />
                            <button class="text-[var(--accent)] text-[10px] font-bold cursor-pointer hover:text-[var(--text-primary)] transition-colors" onclick={addCustomUbicacion}>✓</button>
                        </div>
                    {:else}
                        <button class="px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg-deep)] border border-dashed border-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-gray-500 cursor-pointer transition-all min-h-[28px]"
                            onclick={() => { showAddUbicacion = true; }}>+</button>
                    {/if}
                </div>
            </div>

            <!-- Posición (single select) -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Posición</label>
                <div class="flex flex-wrap gap-1.5">
                    {#each traceManager.tagPresets.posicion as pos}
                        <button
                            class="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border min-h-[28px]
                                   {selectedPosicion === pos
                                        ? 'bg-[var(--accent)] border-transparent text-white shadow-lg'
                                        : 'bg-[var(--bg-deep)] border-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-gray-600'}"
                            onclick={() => togglePosicion(pos)}
                        >{pos}</button>
                    {/each}
                    {#if showAddPosicion}
                        <div class="flex items-center gap-1">
                            <input type="text" bind:value={newPosicionValue} placeholder="Nuevo..."
                                class="bg-[var(--bg-deep)] border border-[color-mix(in_srgb,var(--accent)_50%,transparent)] rounded-lg px-2 py-1 text-[10px] text-[var(--text-primary)] w-20
                                       focus:outline-none focus:border-[var(--accent)]"
                                onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addCustomPosicion(); } else if (e.key === 'Escape') { e.stopPropagation(); showAddPosicion = false; } }}
                                autofocus />
                            <button class="text-[var(--accent)] text-[10px] font-bold cursor-pointer hover:text-[var(--text-primary)] transition-colors" onclick={addCustomPosicion}>✓</button>
                        </div>
                    {:else}
                        <button class="px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg-deep)] border border-dashed border-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-gray-500 cursor-pointer transition-all min-h-[28px]"
                            onclick={() => { showAddPosicion = true; }}>+</button>
                    {/if}
                </div>
            </div>

            <!-- Etiquetas libres -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Etiquetas</label>
                {#if customTags.length > 0}
                    <div class="flex flex-wrap gap-1.5">
                        {#each customTags as tag}
                            <span class="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/20">
                                {tag}
                                <button class="text-[#a855f7]/50 hover:text-[var(--text-primary)] cursor-pointer transition-colors text-[10px] leading-none"
                                    onclick={() => removeCustomTag(tag)}>×</button>
                            </span>
                        {/each}
                    </div>
                {/if}
                <div class="flex gap-1.5">
                    <input
                        type="text"
                        bind:value={newCustomTag}
                        placeholder="Ej: post-EQ, referencia, cliente..."
                        class="flex-1 bg-[var(--bg-deep)] border border-[var(--bg-elevated)] rounded-lg px-3 py-1.5 text-[10px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                               focus:outline-none focus:border-[#a855f7] focus:ring-1 focus:ring-[#a855f7]/30 transition-all"
                        onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addCustomTag(); } }}
                    />
                    <button
                        class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] hover:bg-[#a855f7]/20 cursor-pointer transition-all min-h-[28px]"
                        onclick={addCustomTag}
                        disabled={!newCustomTag.trim()}
                    >+</button>
                </div>
            </div>

            <!-- Notas -->
            <div class="flex flex-col gap-1.5">
                <label for="snap-notes" class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Notas</label>
                <textarea
                    id="snap-notes"
                    bind:value={notes}
                    placeholder="Agregar nota..."
                    class="bg-[var(--bg-deep)] border border-[var(--bg-elevated)] rounded-lg px-3 py-2 text-[10px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                           focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition-all resize-none min-h-[40px]"
                ></textarea>
            </div>

            <!-- Métricas a capturar (collapsible) -->
            <details class="group">
                <summary class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer select-none flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
                    <span class="material-symbols-outlined text-[12px] transition-transform group-open:rotate-90">chevron_right</span>
                    Métricas a capturar
                </summary>
                <div class="grid grid-cols-2 gap-1.5 mt-2 pl-4">
                    {#each Object.keys(traceManager.metricsToCapture) as metric}
                        <label class="flex items-center gap-1.5 text-[10px] text-[var(--text-primary)] cursor-pointer">
                            <input type="checkbox" bind:checked={traceManager.metricsToCapture[metric]} class="accent-[var(--accent)] scale-90" />
                            <span>{metric === 'GroupDelay' ? 'Group Delay' : metric}</span>
                        </label>
                    {/each}
                </div>
            </details>

            <!-- Save -->
            <div class="flex gap-2 pt-1">
                <button
                    class="flex-1 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] hover:from-[var(--accent-hover)] hover:to-[var(--accent-hover)]
                           text-white rounded-lg py-2.5 text-xs font-bold cursor-pointer transition-all shadow-lg min-h-[36px]
                           flex items-center justify-center gap-1.5"
                    onclick={handleSave}
                >
                    <span class="material-symbols-outlined text-sm">save</span>
                    Guardar
                </button>
            </div>

            <div class="flex justify-center gap-4 text-[9px] text-[var(--text-muted)]">
                <span><kbd class="bg-[var(--bg-deep)] px-1.5 py-0.5 rounded border border-[var(--bg-elevated)] font-mono">Enter</kbd> Guardar</span>
                <span><kbd class="bg-[var(--bg-deep)] px-1.5 py-0.5 rounded border border-[var(--bg-elevated)] font-mono">Esc</kbd> Cerrar</span>
            </div>
        {/if}
    </div>
</div>
