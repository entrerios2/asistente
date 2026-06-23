<script lang="ts">
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";

    let { statusText = $bindable("Listo para medir") } = $props();

    let sortOrder = $state<'desc' | 'asc'>('desc');
    let editingId = $state<string | null>(null);
    let editingName = $state("");

    let sortedSnapshots = $derived.by(() => {
        return [...traceManager.instantaneas].sort((a, b) => {
            if (sortOrder === "desc") {
                return b.timestamp - a.timestamp;
            } else {
                return a.timestamp - b.timestamp;
            }
        });
    });



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

    function captureActiveLive() {
        traceManager.captureInstantanea(
            `Instantánea #${traceManager.instantaneas.length + 1}`
        );
        statusText = "Instantánea capturada con éxito";
    }
</script>

<div
    class="flex-1 p-5 overflow-y-auto flex flex-col gap-5"
    id="panel-snaps"
>
    <!-- Controles Superiores (Acciones Globales, Import/Export & Configuración) (Prompt 8) -->
    <div
        class="flex flex-col gap-3.5 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-xl p-4"
    >
        <div class="flex justify-between items-center">
            <div class="flex items-center gap-1.5">
                <span
                    class="material-symbols-outlined text-[#a855f7] text-lg"
                    >photo_album</span
                >
                <h3
                    class="text-xs font-bold text-gray-300 uppercase tracking-wider"
                >
                    Historial de Instantáneas
                </h3>
            </div>
            <span
                class="text-[10px] font-mono font-bold bg-[#a855f7]/15 text-[#a855f7] px-2 py-0.5 rounded-full"
            >
                {sortedSnapshots.length} instantáneas
            </span>
        </div>

        <!-- Botón capturar instantánea -->
        <button
            class="w-full min-h-[40px] bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all duration-300 border border-[#3b82f6]/20"
            onclick={captureActiveLive}
        >
            <span class="material-symbols-outlined text-sm">photo_camera</span>
            Capturar instantánea
        </button>

        <!-- 🔧 AVANZADO: Métricas a capturar en paralelo -->
        {#if uiStore.showAdvanced}
            <div class="flex flex-col gap-2 bg-[#121216]/40 border border-[#1a1a24]/30 rounded-lg p-3 select-none">
                <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[12px] text-gray-600">tune</span>
                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Métricas a capturar en paralelo:</span>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-1">
                    {#each Object.keys(traceManager.metricsToCapture) as metric}
                        <label class="flex items-center gap-1.5 text-[10px] text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                bind:checked={traceManager.metricsToCapture[metric]}
                                class="accent-[#3b82f6] scale-90"
                            />
                            <span>{metric === 'GroupDelay' ? 'Group Delay' : metric}</span>
                        </label>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- 🔧 AVANZADO: Importar, ordenación, cargar pruebas -->
        {#if uiStore.showAdvanced}
            <div class="flex flex-col gap-2.5 border-t border-[#1a1a24]/20 pt-2.5">
                <!-- Importar archivo local .snapshot.json -->
                <input
                    type="file"
                    accept=".snapshot.json"
                    class="hidden"
                    id="import-snap-input"
                    onchange={async (e) => {
                        const file = e.currentTarget.files?.[0];
                        if (file) {
                            const text = await file.text();
                            const imported = await traceManager.importInstantaneaFromJSON(text);
                            if (imported) {
                                statusText = "Instantánea importada con éxito";
                            } else {
                                statusText = "Error importando instantánea";
                            }
                        }
                    }}
                />
                <label
                    for="import-snap-input"
                    class="w-full bg-[#121216] border border-[#1a1a24] hover:border-gray-500 text-gray-300 hover:text-white rounded-lg py-2 text-xs font-semibold text-center cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                    <span class="material-symbols-outlined text-[12px] text-gray-600">tune</span>
                    <span class="material-symbols-outlined text-sm">upload_file</span>
                    Importar .snapshot.json
                </label>

                <!-- Ordenación -->
                <div class="flex justify-between items-center gap-3">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[12px] text-gray-600">tune</span>
                        <label class="text-[10px] text-gray-500 font-bold uppercase">Ordenar por fecha</label>
                    </div>
                    <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                        <button
                            class="px-2 py-1 text-[10px] font-semibold rounded transition-all cursor-pointer min-h-[24px]
                                   {sortOrder === 'desc'
                                ? 'bg-[#3b82f6] text-white shadow'
                                : 'text-gray-400 hover:text-gray-200'}"
                            onclick={() => (sortOrder = "desc")}
                        >
                            Recientes
                        </button>
                        <button
                            class="px-2 py-1 text-[10px] font-semibold rounded transition-all cursor-pointer min-h-[24px]
                                   {sortOrder === 'asc'
                                ? 'bg-[#3b82f6] text-white shadow'
                                : 'text-gray-400 hover:text-gray-200'}"
                            onclick={() => (sortOrder = "asc")}
                        >
                            Antiguos
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Lista de Capturas -->
    <div
        class="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1"
    >
        {#if sortedSnapshots.length === 0}
            <div
                class="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-[#1a1a24] rounded-xl bg-[#121216]/5 gap-3"
            >
                <span
                    class="material-symbols-outlined text-gray-600 text-3xl"
                    >add_photo_alternate</span
                >
                <div class="flex flex-col gap-1">
                    <p class="text-xs text-gray-300 font-semibold">
                        Sin instantáneas guardadas
                    </p>
                    <p class="text-[10px] text-gray-500">
                        Inicie una medición y capture una instantánea
                        para comenzar.
                    </p>
                </div>
            </div>
        {:else}
            <ul class="flex flex-col gap-3">
                {#each sortedSnapshots as snap (snap.id)}
                    <li
                        class="bg-[#121216]/30 border border-[#1a1a24]/50 rounded-xl p-3.5 flex flex-col gap-3 hover:border-gray-700/40 transition-all"
                    >
                        <!-- Cabecera del Item: Nombre editable / ojito / borrar -->
                        <div
                            class="flex justify-between items-start gap-2"
                        >
                            <div
                                class="flex items-center gap-2 flex-1 min-w-0"
                            >
                                <!-- Indicador de Color -->
                                <span
                                    class="w-3 h-3 rounded-full flex-shrink-0"
                                    style="background-color: {snap.color}"
                                ></span>

                                <!-- Editor Inline de Título -->
                                {#if editingId === snap.id}
                                    <input
                                        type="text"
                                        bind:value={editingName}
                                        onblur={() =>
                                            finishEditing(snap.id)}
                                        onkeydown={(e) =>
                                            handleKeyPress(
                                                e,
                                                snap.id,
                                            )}
                                        class="flex-1 bg-[#121216] border border-[#3b82f6] rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#3b82f6] font-semibold"
                                        autofocus
                                    />
                                {:else}
                                    <span
                                        class="text-xs font-semibold text-gray-200 truncate cursor-pointer hover:text-white flex-1"
                                        onclick={() =>
                                            startEditing(
                                                snap.id,
                                                snap.name,
                                            )}
                                        title="Haga clic para renombrar la instantánea"
                                    >
                                        {snap.name}
                                    </span>
                                {/if}
                            </div>

                            <!-- Acciones Rápidas (Ojito, Exportar y Borrar) (Prompt 8) -->
                            <div class="flex items-center gap-1">
                                <button
                                    class="w-7 h-7 rounded flex items-center justify-center transition-all cursor-pointer min-h-[28px] min-w-[28px]
                                           {snap.visible
                                        ? 'text-gray-300 hover:text-white hover:bg-white/5'
                                        : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'}"
                                    onclick={() =>
                                        (snap.visible =
                                            !snap.visible)}
                                    title={snap.visible
                                        ? "Ocultar curva"
                                        : "Mostrar curva"}
                                >
                                    <span
                                        class="material-symbols-outlined text-[18px]"
                                    >
                                        {snap.visible
                                            ? "visibility"
                                            : "visibility_off"}
                                    </span>
                                </button>
                                <button
                                    class="w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:text-[#00ff88] hover:bg-[#00ff88]/10 transition-all cursor-pointer min-h-[28px] min-w-[28px]"
                                    onclick={() =>
                                        traceManager.exportInstantaneaToJSON(
                                            snap.id,
                                        )}
                                    title="Descargar como .snapshot.json"
                                >
                                    <span
                                        class="material-symbols-outlined text-[18px]"
                                        >download</span
                                    >
                                </button>
                                <button
                                    class="w-7 h-7 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer min-h-[28px] min-w-[28px]"
                                    onclick={() =>
                                        traceManager.deleteInstantanea(
                                            snap.id,
                                        )}
                                    title="Eliminar instantánea"
                                >
                                    <span
                                        class="material-symbols-outlined text-[18px]"
                                        >delete</span
                                    >
                                </button>
                            </div>
                        </div>

                        <!-- Metadatos de la Captura -->
                        <div
                            class="flex items-center gap-3 text-[9px] text-gray-500 font-mono"
                        >
                            <span class="flex items-center gap-1">
                                <span
                                    class="material-symbols-outlined text-[11px]"
                                    >schedule</span
                                >
                                {new Date(
                                    snap.timestamp,
                                ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                })}
                            </span>
                            <span class="flex items-center gap-1">
                                <span
                                    class="material-symbols-outlined text-[11px]"
                                    >{snap.source === "manual"
                                        ? "touch_app"
                                        : "auto_mode"}</span
                                >
                                {snap.source === "manual"
                                    ? "Manual"
                                    : "Secuencial"}
                            </span>
                            {#if snap.metric}
                                <span
                                    class="bg-[#121216]/50 border border-white/5 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wide"
                                >
                                    {snap.metric}
                                </span>
                            {/if}
                        </div>

                        <!-- Slider de Desplazamiento Y (Y-Offset) -->
                        <div
                            class="flex flex-col gap-1 border-t border-[#1a1a24]/30 pt-2.5 mt-0.5"
                        >
                            <div
                                class="flex justify-between items-center text-[9px] text-gray-400"
                            >
                                <span class="font-medium"
                                    >Compensación Y (Y-Offset)</span
                                >
                                <span
                                    class="font-mono font-bold text-[#a855f7] cursor-pointer hover:text-white"
                                    ondblclick={() =>
                                        (snap.offsetY = 0)}
                                    title="Doble clic para restablecer a 0 dB"
                                >
                                    {snap.offsetY !== undefined && snap.offsetY > 0
                                        ? `+${snap.offsetY}`
                                        : snap.offsetY} dB
                                </span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span
                                    class="text-[8px] font-mono text-gray-600"
                                    >-50</span
                                >
                                <input
                                    type="range"
                                    min="-50"
                                    max="50"
                                    step="1"
                                    bind:value={snap.offsetY}
                                    class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#a855f7]"
                                />
                                <span
                                    class="text-[8px] font-mono text-gray-600"
                                    >+50</span
                                >
                            </div>
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</div>
