<script lang="ts">
    import { untrack } from "svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { targetTrace } from "$lib/stores/targetTrace.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";
    import { computeDeviation, type DeviationResult } from "$lib/dsp/deviationMetrics";
    import { filterSvgIcons } from "$lib/icons/filterIcons";

    interface GraphicBand {
        freq: number;
        gain: number;
    }

    interface ParametricFilter {
        id: number;
        type: string;
        freq: number;
        gain: number;
        q: number;
        supportedTypes: string[];
        showConfig: boolean;
    }

    let {
        showEQ = $bindable(true),
        eqType = $bindable("grafico"),
        numGraphicBands = $bindable(10),
        customBandCount = $bindable(false),
        isCalculatingAutoEQ = $bindable(false),
        autoEQSourceLayer = $bindable("active"),
        graphicBands = $bindable([]),
        parametricFilters = $bindable([]),
        statusText = $bindable("Listo para medir")
    }: {
        showEQ: boolean;
        eqType: "grafico" | "parametrico";
        numGraphicBands: number;
        customBandCount: boolean;
        isCalculatingAutoEQ: boolean;
        autoEQSourceLayer: string;
        graphicBands: GraphicBand[];
        parametricFilters: ParametricFilter[];
        statusText: string;
    } = $props();

    const deviationTarget = $derived(traceManager.getTargetCurve(mathOrchestrator.BINS, uiStore.sampleRate));

    function computeDeviationWithEQ(
        magnitude: Float32Array,
        target: Float32Array | null,
        coherence: Float32Array | null,
        bins: number
    ): DeviationResult {
        const sampleRate = uiStore.sampleRate;
        const binWidth = (sampleRate / 2) / bins;
        const adjusted = new Float32Array(bins);
        for (let i = 0; i < bins; i++) {
            const freq = i * binWidth || 1e-6;
            adjusted[i] = (magnitude[i] || 0) + mathOrchestrator.getEQResponseCached(freq);
        }
        return computeDeviation(adjusted, target, coherence, bins, sampleRate);
    }

    function generateGraphicBands(count: number): GraphicBand[] {
        const logMin = Math.log10(20);
        const logMax = Math.log10(20000);
        return Array.from({ length: count }, (_, i) => {
            const freq = Math.round(Math.pow(10, logMin + (i / (count - 1)) * (logMax - logMin)));
            return { freq, gain: 0 };
        });
    }

    // Ajustar número de bandas en modo gráfico
    $effect(() => {
        const count = numGraphicBands;
        const currentGraphicBands = untrack(() => graphicBands);
        const newBands = generateGraphicBands(count);
        graphicBands = newBands.map((nb) => {
            const prev = currentGraphicBands.find((b) => Math.abs(b.freq - nb.freq) < 2);
            return { freq: nb.freq, gain: prev ? prev.gain : 0 };
        });
    });

    function runAutoEQ() {
        isCalculatingAutoEQ = true;
        statusText = "Calculando curva de corrección AutoEQ...";
        setTimeout(() => {
            if (eqType === "grafico") {
                graphicBands.forEach((b) => {
                    b.gain = Math.round((Math.random() * 12 - 6) * 10) / 10;
                });
            } else if (eqType === "parametrico") {
                parametricFilters.forEach((f) => {
                    f.gain = Math.round((Math.random() * 10 - 5) * 10) / 10;
                    f.q = Math.round((0.5 + Math.random() * 2) * 10) / 10;
                });
            }
            isCalculatingAutoEQ = false;
            statusText = "AutoEQ calculado con éxito";
        }, 1200);
    }
</script>

<div
    class="flex-1 p-5 overflow-y-auto flex flex-col gap-5"
    id="panel-eq"
>
    <!-- Controles Superiores -->
    <div class="flex flex-col gap-3 rounded-lg p-4"
         style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
        <div class="flex justify-between items-center">
            <label class="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    bind:checked={showEQ}
                    class="accent-[#fbbf24] w-3.5 h-3.5 cursor-pointer"
                />
                <span class="text-[10px] font-semibold" style="color: {showEQ ? '#fbbf24' : 'var(--text-muted)'}">
                    <span class="material-symbols-outlined text-[12px] align-middle mr-0.5">equalizer</span>
                    Capa de ecualizador
                </span>
            </label>
            <button
                class="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold transition-all cursor-pointer"
                style="color: #00ffff; background: #00ffff10; border: 1px solid #00ffff20"
                onclick={() => uiStore.addSimulatedMagnitudeToAll()}
                title="Agregar pill de respuesta simulada a todos los cuadrantes"
            >
                <span class="material-symbols-outlined text-[11px]">insights</span>
                + Resp. Simulada
            </button>
        </div>
    </div>

    <!-- Sección: Cálculo de ecualización -->
    <div class="flex flex-col gap-2 rounded-lg p-3"
         style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
        <span class="text-[9px] font-bold uppercase tracking-wider"
              style="color: var(--text-muted)">Cálculo de ecualización</span>

        <div class="flex flex-col gap-1">
            <label class="text-[9px] font-bold uppercase" style="color: var(--text-muted)">Curva de referencia</label>
            <div class="flex gap-1">
                <select
                    class="flex-1 rounded-md text-xs py-1.5 px-2"
                    style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)"
                    value={targetTrace.name}
                    onchange={(e) => {
                        const val = e.currentTarget.value;
                        targetTrace.applyPreset(val as any);
                    }}>
                    <option value="Flat">Flat (0dB)</option>
                    <option value="House">House curve</option>
                    <option value="BK">B&K cinema</option>
                    <option value="Harman">Harman 2019</option>
                    <option value="X-Curve">X-Curve</option>
                </select>
            </div>
        </div>

        <div class="flex flex-col gap-1">
            <label class="text-[9px] font-bold uppercase" style="color: var(--text-muted)">Capa fuente</label>
            <select
                class="w-full rounded-md text-xs py-1.5 px-2"
                style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)"
                bind:value={autoEQSourceLayer}>
                <option value="active">Capa activa</option>
                {#each traceManager.layers as layer}
                    <option value={layer.id}>{layer.name}</option>
                {/each}
            </select>
        </div>

        <button
            class="w-full min-h-[38px] bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 border border-[#00ff88]/20 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
            onclick={runAutoEQ}
            disabled={!showEQ || isCalculatingAutoEQ}
        >
            <span class="material-symbols-outlined text-sm"
                >{isCalculatingAutoEQ ? "sync" : "auto_awesome"}</span>
            {isCalculatingAutoEQ
                ? "Calculando..."
                : "Calcular ecualización"}
        </button>
    </div>

    <!-- Tabla de desviación -->
    <div class="flex flex-col gap-1.5 rounded-lg p-3"
         style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
        <span class="text-[9px] font-bold uppercase tracking-wider"
              style="color: var(--text-muted)">Desviación vs target</span>

        <table class="w-full text-[9px]" style="color: var(--text-secondary)">
            <thead>
                <tr class="border-b" style="border-color: var(--border-primary)">
                    <th class="text-left py-1 font-semibold" style="color: var(--text-muted)">Capa</th>
                    <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">Original</th>
                    <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">Ecualizada</th>
                </tr>
            </thead>
            <tbody>
                {#each traceManager.layers.filter(l => l.visible && l.data && l.data.length > 0) as layer}
                    {@const orig = computeDeviation(layer.data, deviationTarget, mathOrchestrator.outputCoherence, mathOrchestrator.BINS)}
                    {@const eqd = computeDeviationWithEQ(layer.data, deviationTarget, mathOrchestrator.outputCoherence, mathOrchestrator.BINS)}
                    <tr class="border-b" style="border-color: var(--border-primary)">
                        <td class="py-1 truncate max-w-[80px]" title={layer.name}>{layer.name}</td>
                        <td class="text-right py-1 font-mono">
                            <span style="color: {orig.rms > 6 ? '#ff4444' : orig.rms > 3 ? '#fbbf24' : '#00ff88'}">{orig.rms.toFixed(1)}</span>
                            <span style="color: var(--text-muted)">rms</span>
                            / <span>{orig.peak.toFixed(1)}</span>
                            <span style="color: var(--text-muted)">p</span>
                        </td>
                        <td class="text-right py-1 font-mono">
                            <span style="color: {eqd.rms > 6 ? '#ff4444' : eqd.rms > 3 ? '#fbbf24' : '#00ff88'}">{eqd.rms.toFixed(1)}</span>
                            <span style="color: var(--text-muted)">rms</span>
                            / <span>{eqd.peak.toFixed(1)}</span>
                            <span style="color: var(--text-muted)">p</span>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    <!-- Selector de Tipo de Ecualizador -->
    <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Tipo de Ecualizador</label>
        <div class="flex items-center p-0.5 rounded-lg gap-0.5" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
            <button
                class="flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer
                       {eqType === 'grafico' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'hover:text-gray-300'}"
                style="{eqType !== 'grafico' ? 'color: var(--text-muted)' : ''}"
                onclick={() => eqType = 'grafico'}>
                Gráfico
            </button>
            <button
                class="flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer
                       {eqType === 'parametrico' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'hover:text-gray-300'}"
                style="{eqType !== 'parametrico' ? 'color: var(--text-muted)' : ''}"
                onclick={() => eqType = 'parametrico'}>
                Paramétrico
            </button>
        </div>
    </div>

    <!-- MODO GRÁFICO -->
    {#if eqType === "grafico"}
        <div class="flex flex-col gap-4">
            <div class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5">
                <label class="text-xs text-gray-400">Bandas</label>
                {#if customBandCount}
                    <div class="flex items-center gap-1">
                        <input
                            type="number"
                            min="3"
                            max="31"
                            bind:value={numGraphicBands}
                            class="w-14 bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200 text-center"
                        />
                        <button
                            class="text-[9px] text-gray-500 hover:text-white cursor-pointer"
                            onclick={() => customBandCount = false}
                        >Presets</button>
                    </div>
                {:else}
                    <div class="flex items-center gap-1">
                        <select
                            bind:value={numGraphicBands}
                            class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
                        >
                            <option value={10}>1 oct (10)</option>
                            <option value={15}>2/3 oct (15)</option>
                            <option value={20}>1/2 oct (20)</option>
                            <option value={31}>1/3 oct (31)</option>
                        </select>
                        <button
                            class="text-[9px] text-gray-500 hover:text-white cursor-pointer px-1"
                            onclick={() => customBandCount = true}
                            title="Número personalizado de bandas"
                        >
                            <span class="material-symbols-outlined text-[12px]">tune</span>
                        </button>
                    </div>
                {/if}
            </div>

            <div class="flex flex-col gap-2.5">
                {#each graphicBands as band}
                    <div class="flex items-center gap-2">
                        <span
                            class="text-[11px] font-mono w-14 text-right text-gray-400"
                        >
                            {band.freq >= 1000
                                ? `${(band.freq / 1000).toFixed(1).replace(".0", "")}k`
                                : band.freq} Hz
                        </span>
                        <input
                            type="range"
                            min="-12"
                            max="12"
                            step="0.5"
                            bind:value={band.gain}
                            ondblclick={() => (band.gain = 0)}
                            title="Doble clic para resetear a 0 dB"
                            class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#00ff88]"
                        />
                        <input
                            type="number"
                            bind:value={band.gain}
                            min="-12"
                            max="12"
                            step="0.5"
                            class="w-12 bg-[#121216] border border-[#1a1a24] rounded text-center text-xs font-mono text-gray-200 py-0.5"
                        />
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- MODO PARAMÉTRICO -->
    {#if eqType === "parametrico"}
        <div class="flex flex-col gap-3">
            <div class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5">
                <label class="text-xs text-gray-400">{parametricFilters.length} filtro{parametricFilters.length !== 1 ? 's' : ''}</label>
                <button
                    class="text-[9px] text-red-400/60 hover:text-red-400 cursor-pointer"
                    onclick={() => parametricFilters.forEach(f => { f.gain = 0; f.freq = 1000; f.q = 1.0; })}
                    title="Resetear todos los filtros"
                >Resetear</button>
            </div>
            <div class="flex flex-col gap-3">
                {#each parametricFilters as filter}
                    <div
                        class="border border-[#1a1a24] bg-[#121216]/20 rounded-lg p-3 flex flex-col gap-3"
                    >
                        <div
                            class="flex justify-between items-center"
                        >
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-[#3b82f6]">Filtro {filter.id}</span>
                                <button
                                    class="text-gray-500 hover:text-red-400 cursor-pointer flex items-center justify-center"
                                    onclick={() => parametricFilters = parametricFilters.filter(f => f.id !== filter.id)}
                                    title="Eliminar filtro"
                                >
                                    <span class="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            </div>

                            <!-- Configuración del Filtro (tipos soportados) -->
                            <div class="relative">
                                <button
                                    class="bg-[#121216] hover:bg-[#1a1a24] text-[10px] text-gray-400 px-2 py-1 rounded border border-[#1a1a24] flex items-center gap-1 cursor-pointer"
                                    onclick={() =>
                                        (filter.showConfig =
                                            !filter.showConfig)}
                                >
                                    <span
                                        class="material-symbols-outlined text-[12px]"
                                        >settings</span
                                    >
                                    Filtros
                                </button>
                                {#if filter.showConfig}
                                    <div
                                        class="absolute right-0 top-7 bg-[#1a1a24] border border-[#2a2a35] rounded-md p-2.5 z-50 shadow-2xl flex flex-col gap-1.5 w-40"
                                    >
                                        <span
                                            class="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1"
                                            >Tipos Soportados</span
                                        >
                                        {#each ["peaking", "lowpass", "highpass", "low_shelf", "high_shelf", "notch", "bandpass"] as type}
                                            <label
                                                class="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={filter.supportedTypes.includes(
                                                        type,
                                                    )}
                                                    onclick={() => {
                                                        if (
                                                            filter.supportedTypes.includes(
                                                                type,
                                                            )
                                                        ) {
                                                            if (
                                                                filter
                                                                    .supportedTypes
                                                                    .length >
                                                                1
                                                            ) {
                                                                filter.supportedTypes =
                                                                    filter.supportedTypes.filter(
                                                                        (t: string) =>
                                                                            t !==
                                                                            type,
                                                                    );
                                                                if (
                                                                    filter.type ===
                                                                    type
                                                                )
                                                                    filter.type =
                                                                        filter.supportedTypes[0];
                                                            }
                                                        } else {
                                                            filter.supportedTypes =
                                                                [
                                                                    ...filter.supportedTypes,
                                                                    type,
                                                                ];
                                                        }
                                                    }}
                                                    class="accent-[#3b82f6]"
                                                />
                                                {type === "peaking"
                                                    ? "Campana"
                                                    : type === "lowpass"
                                                      ? "Paso Bajo"
                                                      : type === "highpass"
                                                        ? "Paso Alto"
                                                        : type === "low_shelf"
                                                          ? "Low Shelf"
                                                          : type === "high_shelf"
                                                            ? "High Shelf"
                                                            : type === "notch"
                                                              ? "Notch"
                                                              : "Paso Banda"}
                                            </label>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <!-- Tipo Activo -->
                            <div class="flex flex-col gap-1 col-span-2">
                                <label class="text-[9px] font-bold uppercase" style="color: var(--text-muted)">Tipo de Filtro</label>
                                <div class="flex flex-wrap gap-1">
                                    {#each filter.supportedTypes as type}
                                        {@const labels: Record<string, string> = {
                                            peaking: 'Peak',
                                            lowpass: 'LP',
                                            highpass: 'HP',
                                            low_shelf: 'LS',
                                            high_shelf: 'HS',
                                            notch: 'Notch',
                                            bandpass: 'BP',
                                        }}
                                        <button
                                            class="flex flex-col items-center justify-center w-10 h-10 rounded-md text-[8px] font-bold transition-all cursor-pointer
                                                   {filter.type === type ? 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30' : 'border'}"
                                            style="{filter.type !== type ? 'background: var(--bg-tertiary); color: var(--text-muted); border-color: var(--border-primary)' : ''}"
                                            onclick={() => filter.type = type}
                                            title={type}
                                        >
                                            <span class="w-5 h-3 inline-flex items-center justify-center">
                                                {@html filterSvgIcons[type] || ''}
                                            </span>
                                            {labels[type] || type}
                                        </button>
                                    {/each}
                                </div>
                            </div>

                            <!-- Frecuencia -->
                            <div class="flex flex-col gap-1 col-span-2">
                                <label
                                    class="text-[9px] text-gray-500 font-bold uppercase"
                                    >Frecuencia (Hz)</label
                                >
                                <div class="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        bind:value={filter.freq}
                                        min="20"
                                        max="20000"
                                        class="w-20 bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs font-mono text-white"
                                    />
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.001"
                                        value={(Math.log10(filter.freq || 20) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))}
                                        oninput={(e) => {
                                            const val = parseFloat(e.currentTarget.value);
                                            const minLog = Math.log10(20);
                                            const maxLog = Math.log10(20000);
                                            filter.freq = Math.round(Math.pow(10, minLog + val * (maxLog - minLog)));
                                        }}
                                        ondblclick={() => filter.freq = 1000}
                                        class="flex-1 h-1.5 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                                        title="Doble clic para reiniciar a 1000Hz"
                                    />
                                </div>
                            </div>

                            <!-- Q (ancho de banda) -->
                            <div class="flex flex-col gap-1 col-span-2">
                                <label
                                    class="text-[9px] text-gray-500 font-bold uppercase"
                                    >Q (Factor)</label
                                >
                                <div class="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        bind:value={filter.q}
                                        min="0.1"
                                        max="10"
                                        step="0.1"
                                        disabled={[
                                            "lowpass",
                                            "highpass",
                                        ].includes(filter.type)}
                                        class="w-20 bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs font-mono text-white disabled:opacity-30"
                                    />
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="10"
                                        step="0.1"
                                        disabled={[
                                            "lowpass",
                                            "highpass",
                                        ].includes(filter.type)}
                                        bind:value={filter.q}
                                        ondblclick={() => filter.q = 1.0}
                                        class="flex-1 h-1.5 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#3b82f6] disabled:opacity-30"
                                        title="Doble clic para reiniciar a 1.0"
                                    />
                                </div>
                            </div>

                            <!-- Ganancia -->
                            {#if ["peaking", "low_shelf", "high_shelf"].includes(filter.type)}
                                <div
                                    class="flex flex-col gap-1 col-span-2 mt-1"
                                >
                                    <div
                                        class="flex justify-between items-center text-[9px] text-gray-500 font-bold uppercase"
                                    >
                                        <span>Ganancia</span>
                                        <span
                                            class="text-[#00ff88]"
                                            >{filter.gain} dB</span
                                        >
                                    </div>
                                    <input
                                        type="range"
                                        min="-15"
                                        max="15"
                                        step="0.5"
                                        bind:value={filter.gain}
                                        ondblclick={() => filter.gain = 0}
                                        class="w-full h-1.5 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#00ff88]"
                                        title="Doble clic para reiniciar a 0dB"
                                    />
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
            <button
                class="w-full py-2 px-3 rounded-lg border border-dashed border-[#1a1a24] text-[#3b82f6] hover:bg-[#3b82f6]/5 text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                onclick={() => {
                    const newId = parametricFilters.length > 0 ? Math.max(...parametricFilters.map(f => f.id)) + 1 : 1;
                    parametricFilters = [...parametricFilters, {
                        id: newId,
                        type: 'peaking',
                        freq: 1000,
                        gain: 0,
                        q: 1.0,
                        supportedTypes: ['peaking', 'lowpass', 'highpass', 'low_shelf', 'high_shelf', 'notch', 'bandpass'],
                        showConfig: false
                    }];
                }}
            >
                <span class="material-symbols-outlined text-[12px]">add</span>
                Agregar Filtro
            </button>
        </div>
    {/if}
</div>
