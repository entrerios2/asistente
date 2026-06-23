<script lang="ts">
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";

    let { statusText = $bindable("Listo para medir") } = $props();
    let progress = $state(0);

    // Opciones del Sweep
    let sweepF1 = $state(20);
    let sweepF2 = $state(20000);
    let sweepDuration = $state(5);

    // Opciones del Burst
    let burstDuration = $state(500);
    let burstPeriod = $state(1000);

    // Opciones del MLS
    let mlsOrder = $state(15);
    let manualDelay = $state(0); // en ms

    // --- MODO SECUENCIAL ---
    let selectedPreset = $state("all");
    let isOffline = $state(false);
    let downloadFormat = $state("wav");

    interface Segment {
        id: string;
        name: string;
        desc: string;
        checked: boolean;
        result?: string;
    }

    let segments = $state<Segment[]>([
        {
            id: "V",
            name: "Ganancia de Entrada (V)",
            desc: "Calibración de Ganancia e Impedancia de Entrada",
            checked: true,
        },
        {
            id: "A",
            name: "Respuesta Tonal (A)",
            desc: "Espectro de Ruido Rosa e Integridad Acústica",
            checked: true,
        },
        {
            id: "M",
            name: "Graves profundos (M)",
            desc: "Brown Noise para análisis de Subwoofers",
            checked: true,
        },
        {
            id: "N",
            name: "Altas Frecuencias (N)",
            desc: "Ruido Blanco para respuesta de Brillo",
            checked: true,
        },
        {
            id: "F",
            name: "Barrido Logarítmico (F)",
            desc: "Sweep de Frecuencia y Respuesta al Impulso",
            checked: true,
        },
        {
            id: "P",
            name: "Alineación de Fase (P)",
            desc: "Fase Acústica y Polaridad de Altavoces",
            checked: true,
        },
        {
            id: "T",
            name: "Decaimiento RT60 (T)",
            desc: "Tiempo de Decaimiento y Reverberación Acústica",
            checked: true,
        },
        {
            id: "D",
            name: "Distorsión Armónica (D)",
            desc: "THD por Frecuencia",
            checked: true,
        },
        {
            id: "X",
            name: "Separación Estéreo (X)",
            desc: "Diafonía (Crosstalk) entre canales izquierdo/derecho",
            checked: true,
        },
        {
            id: "R",
            name: "Reflexiones de Sala (R)",
            desc: "Reflexiones Tempranas e Impulso Secundario",
            checked: true,
        },
    ]);

    // Aplicar preset
    $effect(() => {
        if (selectedPreset === "all") {
            segments.forEach((s) => (s.checked = true));
        } else if (selectedPreset === "fast") {
            segments.forEach(
                (s) => (s.checked = ["V", "A", "F"].includes(s.id)),
            );
        } else if (selectedPreset === "bass") {
            segments.forEach(
                (s) => (s.checked = ["V", "M", "P"].includes(s.id)),
            );
        }
    });

    // Wrapper para uso desde botones del Sidebar (toggle seguro)
    async function toggleMeasurement() {
        uiStore.isMeasuring = !uiStore.isMeasuring;
    }

    async function runSequentialSequence() {
        const activeSegments = segments.filter((s) => s.checked);
        if (activeSegments.length === 0) {
            uiStore.isMeasuring = false;
            statusText = "Seleccione al menos un segmento";
            return;
        }

        // Limpiar resultados anteriores
        activeSegments.forEach((s) => (s.result = undefined));

        // Marcar todos como pendientes — módulo APST no implementado aún
        for (const seg of activeSegments) {
            seg.result = "⚠️ Pendiente de implementación";
        }

        uiStore.isMeasuring = false;
        progress = 0;
        statusText = "Secuencia no implementada — requiere módulo APST";
    }

    function calculateDelay() {
        statusText = "⚠️ Cálculo de retardo no implementado — requiere módulo APST";
    }

    function useCalculatedDelay() {
        statusText = `Retardo de ${manualDelay} ms aplicado`;
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
    id="panel-medicion"
>
    <!-- Selector de Modo (Segmented Control) -->
    <div
        class="flex p-1 rounded-lg border"
        style="background: var(--bg-tertiary); border-color: var(--border-primary)"
    >
        <button
            class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px]
                   {uiStore.measurementMode === 'manual'
                ? 'bg-[#3b82f6] text-white shadow'
                : 'text-gray-400 hover:text-gray-200'}"
            onclick={() => {
                uiStore.measurementMode = "manual";
                if (uiStore.isMeasuring) toggleMeasurement();
            }}
        >
            Manual
        </button>
        <button
            class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px]
                   {uiStore.measurementMode === 'secuencial'
                ? 'bg-[#3b82f6] text-white shadow'
                : 'text-gray-400 hover:text-gray-200'}"
            onclick={() => {
                uiStore.measurementMode = "secuencial";
                if (uiStore.isMeasuring) toggleMeasurement();
            }}
        >
            Secuencial
        </button>
    </div>

    <!-- CONTENIDO MODO MANUAL -->
    {#if uiStore.measurementMode === "manual"}
        <div class="flex flex-col gap-4">
            <!-- ETIQUETAS INFORMATIVAS (modo básico) -->
            {#if !uiStore.showAdvanced}
                <div class="flex flex-wrap items-center gap-2 text-xs text-gray-400 px-1">
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px] text-gray-500">music_note</span>
                        <span class="text-gray-300 font-medium">
                            {uiStore.generatorType === 'pink' ? 'Ruido rosa' :
                             uiStore.generatorType === 'white' ? 'Ruido blanco' :
                             uiStore.generatorType === 'brown' ? 'Ruido brown' :
                             uiStore.generatorType === 'music' ? 'Music-noise' :
                             uiStore.generatorType === 'sine' ? `Seno ${uiStore.genFreq} Hz` :
                             uiStore.generatorType === 'sweep' ? 'Sweep logarítmico' :
                             uiStore.generatorType === 'burst' ? 'Burst' :
                             uiStore.generatorType === 'sinburst' ? 'SinBurst' :
                             uiStore.generatorType === 'mls' ? 'MLS+' : uiStore.generatorType}
                        </span>
                    </span>
                    <span class="text-gray-600">&bull;</span>
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px] text-gray-500">timer</span>
                        <span class="text-gray-300 font-medium">
                            Retardo: {uiStore.autoDelayCompensation ? 'automático' : `${uiStore.compensationDelayMs.toFixed(1)} ms manual`}
                        </span>
                    </span>
                </div>
            {/if}

            <!-- 🔧 AVANZADO: Automatización -->
            {#if uiStore.showAdvanced}
                <div class="flex flex-col gap-2 border rounded-xl p-3" style="background: var(--bg-tertiary); opacity: 0.8; border-color: var(--border-primary)">
                    <div class="flex items-center gap-2 border-b pb-1.5" style="border-color: var(--border-primary)">
                        <span class="material-symbols-outlined text-[12px] text-gray-600">tune</span>
                        <span class="material-symbols-outlined text-[#a855f7] text-sm">bolt</span>
                        <h3 class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Automatización</h3>
                    </div>

                    <label class="flex items-center gap-2.5 cursor-pointer group py-1">
                        <input
                            type="checkbox"
                            bind:checked={uiStore.autoSaveSnapshotOnStop}
                            class="w-4 h-4 rounded accent-[#3b82f6] cursor-pointer"
                        />
                        <div class="flex flex-col">
                            <span class="text-xs text-gray-200 font-semibold group-hover:text-white transition-colors select-none">
                                Auto-guardar al detener
                            </span>
                            <span class="text-[9px] text-gray-500">
                                Guarda instantánea automática al pulsar Detener
                            </span>
                        </div>
                    </label>

                    <label class="flex items-center gap-2.5 cursor-pointer group py-1">
                        <input
                            type="checkbox"
                            bind:checked={uiStore.linkGeneratorToMeasurement}
                            class="w-4 h-4 rounded accent-[#3b82f6] cursor-pointer"
                        />
                        <div class="flex flex-col">
                            <span class="text-xs text-gray-200 font-semibold group-hover:text-white transition-colors select-none">
                                Vincular generador al medir
                            </span>
                            <span class="text-[9px] text-gray-500">
                                Enciende/apaga el generador junto con la medición
                            </span>
                        </div>
                    </label>
                </div>
            {/if}

            <!-- 🔧 AVANZADO: Generador -->
            {#if uiStore.showAdvanced}
                <div class="flex flex-col gap-1.5">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[12px] text-gray-600">tune</span>
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Generador</label>
                    </div>
                    <select
                        bind:value={uiStore.generatorType}
                        class="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#3b82f6]"
                        style="background: var(--bg-tertiary); border-color: var(--border-primary); color: var(--text-primary)"
                    >
                        <option value="pink">Ruido rosa</option>
                        <option value="white">Ruido blanco</option>
                        <option value="brown">Ruido brown</option>
                        <option value="music">Music-noise</option>
                        <option value="sine">Seno continuo</option>
                        <option value="sweep">Sweep logarítmico</option>
                        <option value="burst">Burst</option>
                        <option value="sinburst">SinBurst</option>
                        <option value="mls">MLS+</option>
                    </select>
                </div>

                <!-- Opciones dinámicas -->
                <div
                    class="border rounded-lg p-3 flex flex-col gap-3"
                    style="background: var(--bg-tertiary); border-color: var(--border-primary)"
                >
                    {#if uiStore.generatorType === "sine"}
                        <div class="flex flex-col gap-1">
                            <label class="text-[10px] font-bold text-gray-500 uppercase">Frecuencia (Hz)</label>
                            <input
                                type="number"
                                bind:value={uiStore.genFreq}
                                min="10" max="22000"
                                class="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#3b82f6]"
                                style="background: var(--bg-tertiary); border-color: var(--border-primary); color: var(--text-primary)"
                            />
                        </div>
                    {:else if uiStore.generatorType === "sweep"}
                        <div class="grid grid-cols-2 gap-2">
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Inicio (Hz)</label>
                                <input type="number" bind:value={sweepF1}
                                    class="w-full border rounded-md px-2 py-1 text-sm"
                                    style="background: var(--bg-tertiary); border-color: var(--border-primary); color: var(--text-primary)"
                                />
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Fin (Hz)</label>
                                <input type="number" bind:value={sweepF2}
                                    class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                                />
                            </div>
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-[10px] font-bold text-gray-500 uppercase">Duración (seg)</label>
                            <input type="number" bind:value={sweepDuration}
                                class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                            />
                        </div>
                    {:else if uiStore.generatorType === "burst" || uiStore.generatorType === "sinburst"}
                        <div class="grid grid-cols-2 gap-2">
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Duración (ms)</label>
                                <input type="number" bind:value={burstDuration}
                                    class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                                />
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Período (ms)</label>
                                <input type="number" bind:value={burstPeriod}
                                    class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                                />
                            </div>
                        </div>
                    {:else if uiStore.generatorType === "mls"}
                        <div class="flex flex-col gap-1">
                            <label class="text-[10px] font-bold text-gray-500 uppercase">Orden MLS</label>
                            <select bind:value={mlsOrder}
                                class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                            >
                                {#each Array.from({ length: 7 }, (_, i) => i + 10) as order}
                                    <option value={order}>Nivel {order} ({Math.pow(2, order) - 1} pts)</option>
                                {/each}
                            </select>
                        </div>
                    {:else}
                        <span class="text-xs text-gray-500 italic">No se requieren parámetros dinámicos para esta señal.</span>
                    {/if}

                    <!-- Canal de salida (toggle buttons) -->
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-bold text-gray-500 uppercase">Canal de salida</label>
                        <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                            {#each [['Stereo', 'Estéreo'], ['L', 'Solo L'], ['R', 'Solo R']] as [val, label]}
                                <button
                                    class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                           {uiStore.genRouting === val
                                        ? 'bg-[#3b82f6]/15 text-[#3b82f6] shadow'
                                        : 'text-gray-500 hover:text-gray-300'}"
                                    onclick={() => uiStore.genRouting = val as 'L' | 'R' | 'Stereo'}
                                >
                                    {label}
                                </button>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- Slider nivel -->
                <div class="flex flex-col gap-1.5">
                    <div class="flex justify-between items-center">
                        <label class="text-[10px] font-bold text-gray-500 uppercase">Nivel de señal</label>
                        <span class="text-xs font-mono font-bold text-[#3b82f6]">{uiStore.genLevel} dBFS</span>
                    </div>
                    <input
                        type="range" min="-60" max="10"
                        bind:value={uiStore.genLevel}
                        class="w-full h-1.5 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                    />
                </div>

                <!-- Botones generar/detener -->
                <div class="flex gap-2">
                    <button
                        class="flex-1 min-h-[44px] bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981]/25 border border-[#10b981]/30 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
                        onclick={() => (uiStore.genActive = true)}
                    >
                        <span class="material-symbols-outlined text-sm">volume_up</span>
                        Generar
                    </button>
                    <button
                        class="flex-1 min-h-[44px] bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25 border border-[#ef4444]/30 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
                        onclick={() => (uiStore.genActive = false)}
                    >
                        <span class="material-symbols-outlined text-sm">volume_mute</span>
                        Detener
                    </button>
                </div>

                <div class="border-t border-[#1a1a24]/30 my-2"></div>

                <!-- Sección retardo manual -->
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[12px] text-gray-600">tune</span>
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Alineación de retardo</label>
                    </div>
                    <div class="flex gap-2 items-center">
                        <input
                            type="number"
                            bind:value={manualDelay}
                            min="0"
                            class="w-24 bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1.5 text-sm font-mono text-center"
                            placeholder="ms"
                        />
                        <span class="text-xs text-gray-500">ms</span>
                        <button
                            class="flex-1 min-h-[36px] bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 border border-[#3b82f6]/20 rounded-md text-xs font-semibold cursor-pointer"
                            onclick={calculateDelay}
                        >
                            Calcular
                        </button>
                        <button
                            class="flex-1 min-h-[36px] bg-[#1a1a24] hover:bg-[#252530] rounded-md text-xs font-semibold text-gray-300 border border-white/5 cursor-pointer"
                            onclick={useCalculatedDelay}
                        >
                            Usar
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    {/if}

    <!-- CONTENIDO MODO SECUENCIAL -->
    {#if uiStore.measurementMode === "secuencial"}
        <div class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-2">
                <!-- Dropdown Tasa de Muestreo -->
                <div class="flex flex-col gap-1">
                    <label
                        class="text-[10px] font-bold text-gray-500 uppercase"
                        >Tasa (kHz)</label
                    >
                    <select
                        bind:value={uiStore.sampleRate}
                        class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1.5 text-xs text-gray-200"
                    >
                        <option value={44100}>44.1 kHz</option>
                        <option value={48000}>48.0 kHz</option>
                        <option value={96000}>96.0 kHz</option>
                        <option value={192000}>192.0 kHz</option>
                    </select>
                </div>

                <!-- Selector de Presets -->
                <div class="flex flex-col gap-1">
                    <label
                        class="text-[10px] font-bold text-gray-500 uppercase"
                        >Presets APST</label
                    >
                    <select
                        bind:value={selectedPreset}
                        class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1.5 text-xs text-gray-200"
                    >
                        <option value="custom">Personalizado</option>
                        <option value="all">Completo</option>
                        <option value="fast">Rápido</option>
                        <option value="bass">Análisis Sub</option>
                    </select>
                </div>
            </div>

            <!-- Tabla de Segmentos Compacta -->
            <div class="flex flex-col gap-1">
                <label
                    class="text-[10px] font-bold text-gray-500 uppercase"
                    >Segmentos de Medición</label
                >
                <div
                    class="border border-[#1a1a24] rounded-lg bg-[#121216]/20 max-h-[220px] overflow-y-auto"
                >
                    <table class="w-full border-collapse">
                        <tbody>
                            {#each segments as seg}
                                <tr
                                    class="border-b border-[#1a1a24]/30 hover:bg-[#121216]/30 transition-colors"
                                >
                                    <td
                                        class="p-2 w-8 text-center align-middle"
                                    >
                                        <input
                                            type="checkbox"
                                            bind:checked={
                                                seg.checked
                                            }
                                            onclick={() =>
                                                (selectedPreset =
                                                    "custom")}
                                            class="accent-[#3b82f6] cursor-pointer"
                                        />
                                    </td>
                                    <td class="p-2 align-middle">
                                        <div class="flex flex-col">
                                            <span
                                                class="text-xs font-semibold text-gray-300 cursor-help"
                                                title={seg.desc}
                                            >
                                                {seg.name}
                                            </span>
                                            {#if seg.result}
                                                <div
                                                    class="text-[10px] font-mono text-[#10b981] mt-0.5 bg-[#10b981]/5 px-1.5 py-0.5 rounded border border-[#10b981]/10 w-fit"
                                                >
                                                    Resultado: {seg.result}
                                                </div>
                                            {/if}
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modo Offline / Descargar -->
            <div
                class="flex flex-col gap-3 bg-[#121216]/30 border border-[#1a1a24]/30 rounded-lg p-3"
            >
                <div class="flex justify-between items-center">
                    <label
                        class="text-xs font-semibold text-gray-300 cursor-pointer"
                        for="offline-toggle"
                    >
                        Modo Offline (Solo Generación)
                    </label>
                    <input
                        id="offline-toggle"
                        type="checkbox"
                        bind:checked={isOffline}
                        class="accent-[#3b82f6] w-4 h-4 cursor-pointer"
                    />
                </div>

                {#if isOffline}
                    <div
                        class="flex gap-2 items-center pt-2 border-t border-[#1a1a24]/20"
                    >
                        <select
                            bind:value={downloadFormat}
                            class="bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1.5 text-xs text-gray-200 w-24"
                        >
                            <option value="wav">WAV</option>
                            <option value="flac">FLAC</option>
                        </select>
                        <button
                            class="flex-1 min-h-[36px] bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow"
                        >
                            <span
                                class="material-symbols-outlined text-sm"
                                >download</span
                            >
                            Descargar Seq
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- FOOTER ANCLADO GLOBAL A LA PESTAÑA -->
    <div
        class="mt-auto pt-4 border-t border-[#1a1a24]/50 flex flex-col gap-2"
    >
        {#if uiStore.measurementMode === "secuencial" && uiStore.isMeasuring}
            <!-- Barra de Progreso en Modo Secuencial -->
            <div
                class="w-full bg-[#121216] rounded-full h-2.5 overflow-hidden border border-white/5"
            >
                <div
                    class="bg-gradient-to-r from-[#3b82f6] to-[#00ff88] h-full transition-all duration-300"
                    style="width: {progress}%"
                ></div>
            </div>
            <div
                class="flex justify-between text-[10px] font-mono text-gray-500"
            >
                <span>PROGRESO SECUENCIA</span>
                <span class="text-[#3b82f6] font-bold"
                    >{progress}%</span
                >
            </div>
        {/if}

        <button
            class="w-full min-h-[48px] bg-gradient-to-r transition-all duration-300 text-white rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg
                   {uiStore.isMeasuring
                ? 'from-[#ef4444] to-[#dc2626] hover:opacity-90'
                : 'from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8]'}"
            onclick={toggleMeasurement}
        >
            <span class="material-symbols-outlined"
                >{uiStore.isMeasuring ? "stop" : "podcasts"}</span
            >
            {uiStore.isMeasuring ? "Detener Medición" : "Medir / Iniciar"}
        </button>

        <span
            class="text-center text-[10px] text-gray-500 font-mono italic"
        >
            {statusText}
        </span>
    </div>
</div>
