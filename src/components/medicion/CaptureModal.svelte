<script lang="ts">
    import { traceManager, UBICACION_COLORS, type Instantanea, type InstantaneaTags } from "$lib/stores/traceManager.svelte";

    let {
        instantanea,
        onSave,
        onDiscard,
    }: {
        instantanea: Instantanea;
        onSave: (tags: InstantaneaTags, name: string) => void;
        onDiscard: () => void;
    } = $props();

    let selectedUbicacion = $state<string | undefined>(traceManager.lastUsedTags.ubicacion);
    let selectedPosicion = $state<string | undefined>(traceManager.lastUsedTags.posicion);
    let customNote = $state("");
    let editedName = $state(instantanea.name);

    // Custom tag inputs
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
            custom: customNote.trim() ? [customNote.trim()] : [],
        };
        // Update sticky tags
        traceManager.lastUsedTags = {
            ubicacion: selectedUbicacion,
            posicion: selectedPosicion,
        };
        onSave(tags, editedName);
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
            if (showCloseConfirm) {
                cancelCloseConfirm();
            } else {
                handleCloseRequest();
            }
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
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
    style="z-index: 100;"
    onclick={(e) => { if (e.target === e.currentTarget) handleCloseRequest(); }}
    role="dialog"
    aria-modal="true"
    aria-label="Etiquetar instantánea"
>
    <!-- Modal -->
    <div
        class="bg-[#16161e] border border-[#2a2a3a] rounded-2xl shadow-2xl w-[380px] max-w-[90vw] p-5 flex flex-col gap-4"
        onkeydown={handleKeydown}
    >
        {#if showCloseConfirm}
            <!-- Close confirmation dialog -->
            <div class="flex flex-col gap-3 items-center py-2">
                <span class="material-symbols-outlined text-[#fbbf24] text-2xl">help</span>
                <p class="text-xs text-gray-300 text-center">¿Qué querés hacer con esta instantánea?</p>
                <div class="flex gap-2 w-full">
                    <button
                        class="flex-1 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8]
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
                    class="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
                    onclick={cancelCloseConfirm}
                >
                    Cancelar
                </button>
            </div>
        {:else}
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[#00ff88] text-xl">check_circle</span>
                    <h2 class="text-sm font-bold text-gray-200">Instantánea capturada</h2>
                </div>
                <button
                    class="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/5 cursor-pointer transition-all"
                    onclick={handleCloseRequest}
                    title="Cerrar"
                >
                    <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>

            <!-- Name input -->
            <div class="flex flex-col gap-1.5">
                <label for="snap-name" class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nombre</label>
                <input
                    id="snap-name"
                    type="text"
                    bind:value={editedName}
                    class="bg-[#0d0d14] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs text-gray-200
                           focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30 transition-all"
                    autofocus
                />
            </div>

            <!-- Ubicación tags -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ubicación</label>
                <div class="flex flex-wrap gap-1.5">
                    {#each traceManager.tagPresets.ubicacion as ub}
                        <button
                            class="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border min-h-[28px]
                                   {selectedUbicacion === ub
                                        ? 'border-transparent text-white shadow-lg'
                                        : 'bg-[#0d0d14] border-[#2a2a3a] text-gray-400 hover:text-gray-200 hover:border-gray-600'}"
                            style={selectedUbicacion === ub ? `background-color: ${UBICACION_COLORS[ub] || '#3b82f6'}` : ''}
                            onclick={() => toggleUbicacion(ub)}
                        >
                            {ub}
                        </button>
                    {/each}
                    <!-- Add custom ubicacion -->
                    {#if showAddUbicacion}
                        <div class="flex items-center gap-1">
                            <input
                                type="text"
                                bind:value={newUbicacionValue}
                                placeholder="Nuevo..."
                                class="bg-[#0d0d14] border border-[#3b82f6]/50 rounded-lg px-2 py-1 text-[10px] text-gray-200 w-20
                                       focus:outline-none focus:border-[#3b82f6]"
                                onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addCustomUbicacion(); } else if (e.key === 'Escape') { e.stopPropagation(); showAddUbicacion = false; } }}
                                autofocus
                            />
                            <button class="text-[#3b82f6] text-[10px] font-bold cursor-pointer hover:text-white transition-colors" onclick={addCustomUbicacion}>✓</button>
                        </div>
                    {:else}
                        <button
                            class="px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-[#0d0d14] border border-dashed border-[#2a2a3a] text-gray-600 hover:text-gray-400 hover:border-gray-500 cursor-pointer transition-all min-h-[28px]"
                            onclick={() => { showAddUbicacion = true; }}
                        >+</button>
                    {/if}
                </div>
            </div>

            <!-- Posición tags -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Posición</label>
                <div class="flex flex-wrap gap-1.5">
                    {#each traceManager.tagPresets.posicion as pos}
                        <button
                            class="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border min-h-[28px]
                                   {selectedPosicion === pos
                                        ? 'bg-[#3b82f6] border-transparent text-white shadow-lg'
                                        : 'bg-[#0d0d14] border-[#2a2a3a] text-gray-400 hover:text-gray-200 hover:border-gray-600'}"
                            onclick={() => togglePosicion(pos)}
                        >
                            {pos}
                        </button>
                    {/each}
                    <!-- Add custom posicion -->
                    {#if showAddPosicion}
                        <div class="flex items-center gap-1">
                            <input
                                type="text"
                                bind:value={newPosicionValue}
                                placeholder="Nuevo..."
                                class="bg-[#0d0d14] border border-[#3b82f6]/50 rounded-lg px-2 py-1 text-[10px] text-gray-200 w-20
                                       focus:outline-none focus:border-[#3b82f6]"
                                onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addCustomPosicion(); } else if (e.key === 'Escape') { e.stopPropagation(); showAddPosicion = false; } }}
                                autofocus
                            />
                            <button class="text-[#3b82f6] text-[10px] font-bold cursor-pointer hover:text-white transition-colors" onclick={addCustomPosicion}>✓</button>
                        </div>
                    {:else}
                        <button
                            class="px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-[#0d0d14] border border-dashed border-[#2a2a3a] text-gray-600 hover:text-gray-400 hover:border-gray-500 cursor-pointer transition-all min-h-[28px]"
                            onclick={() => { showAddPosicion = true; }}
                        >+</button>
                    {/if}
                </div>
            </div>

            <!-- Notas -->
            <div class="flex flex-col gap-1.5">
                <label for="snap-note" class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notas (opcional)</label>
                <input
                    id="snap-note"
                    type="text"
                    bind:value={customNote}
                    placeholder="Agregar nota..."
                    class="bg-[#0d0d14] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600
                           focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/30 transition-all"
                />
            </div>

            <!-- Save button -->
            <div class="flex gap-2 pt-1">
                <button
                    class="flex-1 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8]
                           text-white rounded-lg py-2.5 text-xs font-bold cursor-pointer transition-all shadow-lg min-h-[36px]
                           flex items-center justify-center gap-1.5"
                    onclick={handleSave}
                >
                    <span class="material-symbols-outlined text-sm">save</span>
                    Guardar
                </button>
            </div>

            <!-- Keyboard hints -->
            <div class="flex justify-center gap-4 text-[9px] text-gray-600">
                <span><kbd class="bg-[#0d0d14] px-1.5 py-0.5 rounded border border-[#2a2a3a] font-mono">Enter</kbd> Guardar</span>
                <span><kbd class="bg-[#0d0d14] px-1.5 py-0.5 rounded border border-[#2a2a3a] font-mono">Esc</kbd> Cerrar</span>
            </div>
        {/if}
    </div>
</div>
