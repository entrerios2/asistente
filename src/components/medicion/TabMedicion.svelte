<script lang="ts">
    import { uiStore } from "$lib/stores/ui.svelte";
    import { sequentialStore } from "$lib/stores/sequentialStore.svelte";


    let { statusText = $bindable("Listo para medir") } = $props();


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

    // Reactive: sidebar's Medir/Detener toggle → start/stop sequence
    let seqStarted = $state(false);
    $effect(() => {
        if (uiStore.measurementMode !== 'secuencial') {
            seqStarted = false;
            return;
        }
        if (uiStore.isMeasuring && !seqStarted) {
            seqStarted = true;
            const tokens = segments.filter(s => s.checked).map(s => s.id);
            sequentialStore.runSequence(tokens).finally(() => {
                seqStarted = false;
                uiStore.isMeasuring = false;
            });
        } else if (!uiStore.isMeasuring && seqStarted) {
            sequentialStore.stopSequence();
            seqStarted = false;
        }
    });

    function resultClass(status: string): string {
        if (status === 'PASS') return 'bg-[#10b981]/5 border-[#10b981]/10 text-[#10b981]';
        if (status === 'WARN') return 'bg-[#eab308]/5 border-[#eab308]/10 text-[#eab308]';
        return 'bg-[#ef4444]/5 border-[#ef4444]/10 text-[#ef4444]';
    }

    function calculateDelay() {
        if (uiStore.measurementMode === 'secuencial' && !sequentialStore.isRunning) {
            statusText = "Ejecutando segmento T para cálculo de retardo...";
            sequentialStore.runSequence(['T']).finally(() => {
                statusText = "Cálculo de retardo completado";
            });
        } else {
            statusText = "⚠️ Detenga la medición actual para calcular retardo";
        }
    }

    function useCalculatedDelay() {
        statusText = `Retardo de ${manualDelay} ms aplicado`;
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
                ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
            onclick={() => {
                uiStore.measurementMode = "manual";
                if (uiStore.isMeasuring) {
                    sequentialStore.stopSequence();
                    uiStore.isMeasuring = false;
                }
            }}
        >
            Manual
        </button>
        <button
            class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px]
                   {uiStore.measurementMode === 'secuencial'
                ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
            onclick={() => {
                uiStore.measurementMode = "secuencial";
                if (uiStore.isMeasuring) {
                    sequentialStore.stopSequence();
                    uiStore.isMeasuring = false;
                }
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
                <div class="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] px-1">
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px] text-[var(--text-muted)]">music_note</span>
                        <span class="text-[var(--text-primary)] font-medium">
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
                    <span class="text-[var(--text-muted)]">&bull;</span>
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px] text-[var(--text-muted)]">timer</span>
                        <span class="text-[var(--text-primary)] font-medium">
                            Retardo: {uiStore.autoDelayCompensation ? 'automático' : `${uiStore.compensationDelayMs.toFixed(1)} ms manual`}
                        </span>
                    </span>
                </div>
            {/if}

            <!-- 🔧 AVANZADO: Automatización -->
            {#if uiStore.showAdvanced}
                <div class="flex flex-col gap-2 border rounded-xl p-3" style="background: var(--bg-tertiary); opacity: 0.8; border-color: var(--border-primary)">
                    <div class="flex items-center gap-2 border-b pb-1.5" style="border-color: var(--border-primary)">
                        <span class="material-symbols-outlined text-[12px] text-[var(--text-muted)]">tune</span>
                        <span class="material-symbols-outlined text-[#a855f7] text-sm">bolt</span>
                        <h3 class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Automatización</h3>
                    </div>

                    <label class="flex items-center gap-2.5 cursor-pointer group py-1">
                        <input
                            type="checkbox"
                            bind:checked={uiStore.autoSaveSnapshotOnStop}
                            class="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                        />
                        <div class="flex flex-col">
                            <span class="text-xs text-[var(--text-primary)] font-semibold group-hover:text-[var(--text-primary)] transition-colors select-none">
                                Auto-guardar al detener
                            </span>
                            <span class="text-[9px] text-[var(--text-muted)]">
                                Guarda instantánea automática al pulsar Detener
                            </span>
                        </div>
                    </label>

                    <label class="flex items-center gap-2.5 cursor-pointer group py-1">
                        <input
                            type="checkbox"
                            bind:checked={uiStore.linkGeneratorToMeasurement}
                            class="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                        />
                        <div class="flex flex-col">
                            <span class="text-xs text-[var(--text-primary)] font-semibold group-hover:text-[var(--text-primary)] transition-colors select-none">
                                Vincular generador al medir
                            </span>
                            <span class="text-[9px] text-[var(--text-muted)]">
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
                        <span class="material-symbols-outlined text-[12px] text-[var(--text-muted)]">tune</span>
                        <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Generador</label>
                    </div>
                    <select
                        bind:value={uiStore.generatorType}
                        class="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
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
                            <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase">Frecuencia (Hz)</label>
                            <input
                                type="number"
                                bind:value={uiStore.genFreq}
                                min="10" max="22000"
                                class="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                                style="background: var(--bg-tertiary); border-color: var(--border-primary); color: var(--text-primary)"
                            />
                        </div>
                    {:else if uiStore.generatorType === "sweep"}
                        <div class="grid grid-cols-2 gap-2">
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase">Inicio (Hz)</label>
                                <input type="number" bind:value={sweepF1}
                                    class="w-full border rounded-md px-2 py-1 text-sm"
                                    style="background: var(--bg-tertiary); border-color: var(--border-primary); color: var(--text-primary)"
                                />
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase">Fin (Hz)</label>
                                <input type="number" bind:value={sweepF2}
                                    class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)]"
                                />
                            </div>
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase">Duración (seg)</label>
                            <input type="number" bind:value={sweepDuration}
                                class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)]"
                            />
                        </div>
                    {:else if uiStore.generatorType === "burst" || uiStore.generatorType === "sinburst"}
                        <div class="grid grid-cols-2 gap-2">
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase">Duración (ms)</label>
                                <input type="number" bind:value={burstDuration}
                                    class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)]"
                                />
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase">Período (ms)</label>
                                <input type="number" bind:value={burstPeriod}
                                    class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)]"
                                />
                            </div>
                        </div>
                    {:else if uiStore.generatorType === "mls"}
                        <div class="flex flex-col gap-1">
                            <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase">Orden MLS</label>
                            <select bind:value={mlsOrder}
                                class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)]"
                            >
                                {#each Array.from({ length: 7 }, (_, i) => i + 10) as order}
                                    <option value={order}>Nivel {order} ({Math.pow(2, order) - 1} pts)</option>
                                {/each}
                            </select>
                        </div>
                    {:else}
                        <span class="text-xs text-[var(--text-muted)] italic">No se requieren parámetros dinámicos para esta señal.</span>
                    {/if}

                    <!-- Canal de salida (toggle buttons) -->
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase">Canal de salida</label>
                        <div class="flex bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[color-mix(in_srgb,var(--border-primary)_40%,transparent)]">
                            {#each [['Stereo', 'Estéreo'], ['L', 'Solo L'], ['R', 'Solo R']] as [val, label]}
                                <button
                                    class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                           {uiStore.genRouting === val
                                        ? 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] shadow'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
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
                        <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase">Nivel de señal</label>
                        <span class="text-xs font-mono font-bold text-[var(--accent)]">{uiStore.genLevel} dBFS</span>
                    </div>
                    <input
                        type="range" min="-60" max="10"
                        bind:value={uiStore.genLevel}
                        class="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                    />
                </div>

                <!-- Botón generar/detener toggle -->
                <button
                    class="w-full min-h-[44px] rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer border
                           {uiStore.genActive
                        ? 'bg-[#ef4444]/15 text-[var(--accent-red)] hover:bg-[#ef4444]/25 border-[#ef4444]/30'
                        : 'bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981]/25 border-[#10b981]/30'}"
                    onclick={() => uiStore.genActive = !uiStore.genActive}
                >
                    <span class="material-symbols-outlined text-sm">{uiStore.genActive ? 'volume_mute' : 'volume_up'}</span>
                    {uiStore.genActive ? 'Detener generador' : 'Generar'}
                </button>

                <div class="border-t border-[color-mix(in_srgb,var(--border-primary)_30%,transparent)] my-2"></div>

                <!-- Sección retardo manual -->
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[12px] text-[var(--text-muted)]">tune</span>
                        <label class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Alineación de retardo</label>
                    </div>
                    <div class="flex gap-2 items-center">
                        <input
                            type="number"
                            bind:value={manualDelay}
                            min="0"
                            class="w-24 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1.5 text-sm font-mono text-center"
                            placeholder="ms"
                        />
                        <span class="text-xs text-[var(--text-muted)]">ms</span>
                        <button
                            class="flex-1 min-h-[36px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] rounded-md text-xs font-semibold cursor-pointer"
                            onclick={calculateDelay}
                        >
                            Calcular
                        </button>
                        <button
                            class="flex-1 min-h-[36px] bg-[#1a1a24] hover:bg-[#252530] rounded-md text-xs font-semibold text-[var(--text-primary)] border border-white/5 cursor-pointer"
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
                        class="text-[10px] font-bold text-[var(--text-muted)] uppercase"
                        >Tasa (kHz)</label
                    >
                    <select
                        bind:value={uiStore.sampleRate}
                        class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
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
                        class="text-[10px] font-bold text-[var(--text-muted)] uppercase"
                        >Presets</label
                    >
                    <select
                        bind:value={selectedPreset}
                        class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
                    >
                        <option value="custom">Personalizado</option>
                        <option value="all">Completo</option>
                        <option value="fast">Rápido</option>
                        <option value="bass">Análisis Sub</option>
                    </select>
                </div>
            </div>

            <!-- Progreso -->
            {#if sequentialStore.isRunning || sequentialStore.progress > 0}
                <div class="flex flex-col gap-1">
                    <div class="flex justify-between text-[10px] text-[var(--text-muted)]">
                        <span>Progreso: {sequentialStore.progress}%</span>
                        {#if sequentialStore.currentSegment}
                            <span>Segmento: {sequentialStore.currentSegment}</span>
                        {/if}
                    </div>
                    <div class="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                            class="h-full rounded-full transition-all duration-300"
                            style="width: {sequentialStore.progress}%; background: var(--accent)"
                        ></div>
                    </div>
                </div>
            {/if}

            <!-- Tabla de Segmentos Compacta -->
            <div class="flex flex-col gap-1">
                <label
                    class="text-[10px] font-bold text-[var(--text-muted)] uppercase"
                    >Segmentos de Medición</label
                >
                <div
                    class="border border-[var(--border-primary)] rounded-lg bg-[var(--bg-tertiary)]/20 max-h-[220px] overflow-y-auto"
                >
                    <table class="w-full border-collapse">
                        <tbody>
                            {#each segments as seg}
                                {@const storeResult = sequentialStore.results[seg.id]}
                                <tr
                                    class="border-b border-[color-mix(in_srgb,var(--border-primary)_30%,transparent)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
                                >
                                    <td
                                        class="p-2 w-8 text-center align-middle"
                                    >
                                        <input
                                            type="checkbox"
                                            bind:checked={
                                                seg.checked
                                            }
                                            disabled={sequentialStore.isRunning}
                                            onclick={() =>
                                                (selectedPreset =
                                                    "custom")}
                                            class="accent-[var(--accent)] cursor-pointer"
                                        />
                                    </td>
                                    <td class="p-2 align-middle">
                                        <div class="flex items-center gap-2">
                                            {#if sequentialStore.currentSegment === seg.id}
                                                <span class="material-symbols-outlined text-sm text-[var(--accent)] animate-pulse">graphic_eq</span>
                                            {/if}
                                            <div class="flex flex-col">
                                                <span
                                                    class="text-xs font-semibold text-[var(--text-primary)] cursor-help"
                                                    title={seg.desc}
                                                >
                                                    {seg.name}
                                                </span>
                                                {#if storeResult}
                                                    <div
                                                        class="text-[10px] font-mono mt-0.5 px-1.5 py-0.5 rounded border w-fit {resultClass(storeResult.status)}"
                                                    >
                                                        {storeResult.message || storeResult.status}
                                                    </div>
                                                {/if}
                                            </div>
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
                class="flex flex-col gap-3 bg-[var(--bg-tertiary)]/30 border border-[color-mix(in_srgb,var(--border-primary)_30%,transparent)] rounded-lg p-3"
            >
                <div class="flex justify-between items-center">
                    <label
                        class="text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                        for="offline-toggle"
                    >
                        Modo Offline (Solo Generación)
                    </label>
                    <input
                        id="offline-toggle"
                        type="checkbox"
                        bind:checked={isOffline}
                        class="accent-[var(--accent)] w-4 h-4 cursor-pointer"
                    />
                </div>

                {#if isOffline}
                    <div
                        class="flex gap-2 items-center pt-2 border-t border-[color-mix(in_srgb,var(--border-primary)_20%,transparent)]"
                    >
                        <select
                            bind:value={downloadFormat}
                            class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)] w-24"
                        >
                            <option value="wav">WAV</option>
                            <option value="flac">FLAC</option>
                        </select>
                        <button
                            class="flex-1 min-h-[36px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow"
                            onclick={() => {
                                const tokens = segments.filter(s => s.checked).map(s => s.id);
                                sequentialStore.downloadSequence(tokens, downloadFormat as 'wav' | 'flac');
                            }}
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

</div>

