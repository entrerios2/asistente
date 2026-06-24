<script lang="ts">
    import { untrack } from "svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { targetTrace } from "$lib/stores/targetTrace.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";

    import { filterSvgIcons } from "$lib/icons/filterIcons";
    import { eqStore, type GraphicBand } from "$lib/stores/eqStore.svelte";
    import { filterTypeColors, filterTypeName } from "$lib/dsp/eqNodeIcons";
    import SnapshotPicker from "./SnapshotPicker.svelte";
    import { runAutoEQ, benchmarkAll, DEFAULT_CONFIG, type AutoEQConfig, type AutoEQResult, type BenchmarkResult } from "$lib/dsp/autoEQ";

    let {
        statusText = $bindable("Listo para medir")
    }: {
        statusText: string;
    } = $props();

    // --- Tab state ---
    let activeTab = $state<'simulacion' | 'calcular'>('simulacion');
    let showFilterDetail = $state(false);

    // --- Derived ---
    const deviationTarget = $derived(traceManager.getTargetCurve(mathOrchestrator.BINS, uiStore.sampleRate));
    const eqTypeLabel = $derived(
        eqStore.eqType === 'grafico'
            ? `Gráfico (${eqStore.graphicBands.length} bandas)`
            : `Paramétrico (${eqStore.parametricFilters.length} filtros)`
    );

    // --- Functions ---
    // computeDeviationWithEQ available for future use — currently called inline


    function generateGraphicBands(count: number): GraphicBand[] {
        const logMin = Math.log10(20);
        const logMax = Math.log10(20000);
        return Array.from({ length: count }, (_, i) => {
            const freq = Math.round(Math.pow(10, logMin + (i / (count - 1)) * (logMax - logMin)));
            return { freq, gain: 0 };
        });
    }

    $effect(() => {
        const count = eqStore.numGraphicBands;
        const currentGraphicBands = untrack(() => eqStore.graphicBands);
        const newBands = generateGraphicBands(count);
        eqStore.graphicBands = newBands.map((nb) => {
            const prev = currentGraphicBands.find((b) => Math.abs(b.freq - nb.freq) < 2);
            return { freq: nb.freq, gain: prev ? prev.gain : 0 };
        });
    });

    function buildAutoEQConfig(): AutoEQConfig {
        return {
            ...DEFAULT_CONFIG,
            algorithm: eqStore.autoEQAlgorithm,
            costDomain: eqStore.autoEQCostDomain,
            numFilters: eqStore.eqType === 'parametrico' ? eqStore.parametricFilters.length : eqStore.graphicBands.length,
            maxBoost: eqStore.autoEQMaxBoost,
            maxCut: eqStore.autoEQMaxCut,
            minQ: eqStore.autoEQMinQ,
            maxQ: eqStore.autoEQMaxQ,
            maxIterations: eqStore.autoEQMaxIterations,
            coherenceThreshold: eqStore.autoEQCoherenceThreshold,
            trebleAveraging: eqStore.autoEQTrebleAveraging,
            trebleFreq: eqStore.autoEQTrebleFreq,
            onlyCorrectPeaks: eqStore.autoEQOnlyCorrectPeaks,
            psoPopulation: eqStore.autoEQPSOPopulation,
            psoInertia: eqStore.autoEQPSOInertia,
            psoCognitive: eqStore.autoEQPSOCognitive,
            psoSocial: eqStore.autoEQPSOSocial,
            gaPopulation: eqStore.autoEQGAPopulation,
            gaMutationRate: eqStore.autoEQGAMutationRate,
            gaCrossoverRate: eqStore.autoEQGACrossoverRate,
            gaElitism: eqStore.autoEQGAElitism,
        };
    }

    function resolveMagnitudeSource(): { magnitude: Float32Array; coherence: Float32Array | null } {
        const bins = mathOrchestrator.BINS;
        if (eqStore.autoEQSourceType === 'live') {
            return { magnitude: mathOrchestrator.outputMagnitude, coherence: mathOrchestrator.outputCoherence };
        }
        if (eqStore.autoEQSourceType === 'snapshot') {
            const selected = traceManager.instantaneas.filter((s: any) => eqStore.autoEQSnapshotIds.includes(s.id));
            if (selected.length === 0) return { magnitude: mathOrchestrator.outputMagnitude, coherence: mathOrchestrator.outputCoherence };
            if (selected.length === 1) {
                return { magnitude: selected[0].data?.['Magnitude'] || new Float32Array(bins), coherence: selected[0].data?.['Coherence'] || null };
            }
            // Multiple snapshots → average/min/max
            const result = new Float32Array(bins);
            const cohResult = new Float32Array(bins);
            for (let i = 0; i < bins; i++) {
                const vals = selected.map((s: any) => s.data?.['Magnitude']?.[i] || 0);
                const cohVals = selected.map((s: any) => s.data?.['Coherence']?.[i] || 1);
                if (eqStore.autoEQCalcOperation === 'average') result[i] = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
                else if (eqStore.autoEQCalcOperation === 'min') result[i] = Math.min(...vals);
                else result[i] = Math.max(...vals);
                cohResult[i] = cohVals.reduce((a: number, b: number) => a + b, 0) / cohVals.length;
            }
            return { magnitude: result, coherence: cohResult };
        }
        const layer = traceManager.layers.find(l => l.id === eqStore.autoEQSourceLayer);
        if (layer?.data) return { magnitude: layer.data, coherence: null };
        return { magnitude: mathOrchestrator.outputMagnitude, coherence: mathOrchestrator.outputCoherence };
    }

    const algoDesc: Record<string, string> = {
        'greedy': 'Rápido — coloca filtros en picos de error (~100ms)',
        'nelder-mead': 'Preciso — optimización local desde Greedy (~500ms)',
        'pso': 'Global — enjambre de partículas (~2s)',
        'genetic': 'Robusto — evolución con mutación (~3s)',
        'all': 'Benchmark — ejecuta todos y compara (~5s)',
    };

    function handleRunAutoEQ() {
        eqStore.isCalculatingAutoEQ = true;
        eqStore.autoEQBenchmarkResults = null;
        eqStore.autoEQLastResult = null;
        eqStore.autoEQPreviewIndex = -1;
        statusText = "Calculando ecualización...";
        setTimeout(() => {
            try {
                const config = buildAutoEQConfig();
                const { magnitude, coherence } = resolveMagnitudeSource();
                const target = deviationTarget;
                const bins = mathOrchestrator.BINS;
                const sr = uiStore.sampleRate;
                if (eqStore.autoEQAlgorithm === 'all') {
                    const result = benchmarkAll(magnitude, target, coherence, bins, sr, config,
                        (algo, progress) => { eqStore.autoEQProgress = { algorithm: algo, progress }; });
                    eqStore.autoEQBenchmarkResults = result;
                    applyAutoEQResult(result.results[0].result);
                    statusText = `Cálculo completado en ${(result.totalTimeMs / 1000).toFixed(1)}s — mejor: ${result.best}`;
                } else {
                    const result = runAutoEQ(magnitude, target, coherence, bins, sr, config,
                        (algo, iter, _mse) => { eqStore.autoEQProgress = { algorithm: algo, progress: iter / config.maxIterations }; });
                    eqStore.autoEQLastResult = result;
                    applyAutoEQResult(result);
                    statusText = `Ecualización (${result.algorithm}) completada en ${result.timeMs.toFixed(0)}ms`;
                }
            } catch (e: any) { statusText = `Error: ${e.message}`; }
            eqStore.isCalculatingAutoEQ = false;
            eqStore.autoEQProgress = null;
        }, 50);
    }

    function applyAutoEQResult(result: AutoEQResult) {
        eqStore.eqType = 'parametrico';
        const existing = eqStore.parametricFilters;
        eqStore.parametricFilters = result.filters.map((f, i) => {
            // Preserve supportedTypes from existing filter config
            const prev = existing[i];
            const types = prev?.supportedTypes || ['peaking', 'low_shelf', 'high_shelf', 'notch'];
            // Ensure the assigned type is in supportedTypes
            const assignedType = types.includes(f.type) ? f.type : types[0];
            return {
                id: prev?.id || i + 1, freq: Math.round(f.fc), gain: Math.round(f.gain * 10) / 10,
                q: Math.round(f.q * 10) / 10, type: assignedType,
                supportedTypes: types, showConfig: false,
            };
        });
    }

    function applyBenchmarkResult(index: number) {
        const results = eqStore.autoEQBenchmarkResults as BenchmarkResult | null;
        if (!results || !results.results[index]) return;
        applyAutoEQResult(results.results[index].result);
        eqStore.autoEQPreviewIndex = index;
    }

    function formatTime(ms: number): string { return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`; }
    function devColor(rms: number): string { return rms > 6 ? 'var(--accent-red)' : rms > 3 ? 'var(--accent-yellow)' : 'var(--accent-green)'; }

    // --- EQ Presets ---
    const ALL_TYPES = ['peaking', 'lowpass', 'highpass', 'low_shelf', 'high_shelf', 'notch', 'bandpass'];
    type EQPreset = { label: string; desc: string; filters: Array<{ freq: number; type: string; supportedTypes: string[] }> };

    const eqPresets: EQPreset[] = [
        {
            label: 'Genérico 4 bandas',
            desc: '4 filtros full, todos los tipos',
            filters: [
                { freq: 100,  type: 'peaking', supportedTypes: ALL_TYPES },
                { freq: 500,  type: 'peaking', supportedTypes: ALL_TYPES },
                { freq: 2000, type: 'peaking', supportedTypes: ALL_TYPES },
                { freq: 8000, type: 'peaking', supportedTypes: ALL_TYPES },
            ],
        },
        {
            label: 'Genérico 6 bandas',
            desc: '6 filtros full, todos los tipos',
            filters: [
                { freq: 60,    type: 'peaking', supportedTypes: ALL_TYPES },
                { freq: 250,   type: 'peaking', supportedTypes: ALL_TYPES },
                { freq: 1000,  type: 'peaking', supportedTypes: ALL_TYPES },
                { freq: 3000,  type: 'peaking', supportedTypes: ALL_TYPES },
                { freq: 8000,  type: 'peaking', supportedTypes: ALL_TYPES },
                { freq: 14000, type: 'peaking', supportedTypes: ALL_TYPES },
            ],
        },
        {
            label: 'A&H QU-16',
            desc: '4 bandas: LF/HF shelf+peak, LM/HM peak',
            filters: [
                { freq: 100,  type: 'peaking', supportedTypes: ['peaking', 'low_shelf'] },
                { freq: 500,  type: 'peaking', supportedTypes: ['peaking'] },
                { freq: 2500, type: 'peaking', supportedTypes: ['peaking'] },
                { freq: 8000, type: 'peaking', supportedTypes: ['peaking', 'high_shelf'] },
            ],
        },
        {
            label: 'Behringer XR18',
            desc: '4 bandas full + HPF/LPF',
            filters: [
                { freq: 80,   type: 'peaking', supportedTypes: ['peaking', 'low_shelf', 'high_shelf', 'lowpass', 'highpass', 'notch'] },
                { freq: 500,  type: 'peaking', supportedTypes: ['peaking', 'low_shelf', 'high_shelf', 'lowpass', 'highpass', 'notch'] },
                { freq: 2000, type: 'peaking', supportedTypes: ['peaking', 'low_shelf', 'high_shelf', 'lowpass', 'highpass', 'notch'] },
                { freq: 8000, type: 'peaking', supportedTypes: ['peaking', 'low_shelf', 'high_shelf', 'lowpass', 'highpass', 'notch'] },
            ],
        },
        {
            label: 'Control de tono',
            desc: 'Graves / Medios / Agudos',
            filters: [
                { freq: 200,  type: 'low_shelf',  supportedTypes: ['low_shelf'] },
                { freq: 1000, type: 'peaking',     supportedTypes: ['peaking'] },
                { freq: 6000, type: 'high_shelf',  supportedTypes: ['high_shelf'] },
            ],
        },
    ];

    function applyPreset(preset: EQPreset) {
        eqStore.eqType = 'parametrico';
        eqStore.parametricFilters = preset.filters.map((f, i) => ({
            id: i + 1,
            freq: f.freq,
            gain: 0,
            q: 1.0,
            type: f.type,
            supportedTypes: [...f.supportedTypes],
            showConfig: false,
        }));
    }

    let showPresetMenu = $state(false);

</script>

<div class="flex-1 overflow-y-auto flex flex-col gap-0" id="panel-eq">

    <!-- ═══════ BARRA SUPERIOR ═══════ -->
    <div class="px-4 py-3 flex flex-col gap-2.5" style="background: var(--bg-tertiary);">
        <div class="flex gap-2">
            <!-- Toggle: Capa ecualizador visible -->
            <button
                class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[9px] font-semibold transition-all cursor-pointer"
                style="background: {eqStore.showEQ ? '#fbbf2412' : 'transparent'}; color: {eqStore.showEQ ? 'var(--accent-yellow)' : 'var(--text-muted)'}; border: 1px solid {eqStore.showEQ ? '#fbbf2430' : 'var(--border-primary)'}"
                onclick={() => eqStore.showEQ = !eqStore.showEQ}
            >
                <span class="material-symbols-outlined text-[12px]">{eqStore.showEQ ? 'visibility' : 'visibility_off'}</span>
                Capa ecualizador
            </button>
            <!-- Toggle: Simular respuesta -->
            <button
                class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[9px] font-semibold transition-all cursor-pointer"
                style="background: {eqStore.showSimulatedResponse ? '#00ffff12' : 'transparent'}; color: {eqStore.showSimulatedResponse ? 'var(--accent-cyan)' : 'var(--text-muted)'}; border: 1px solid {eqStore.showSimulatedResponse ? '#00ffff30' : 'var(--border-primary)'}; opacity: {eqStore.showEQ ? 1 : 0.4}"
                onclick={() => { if (eqStore.showEQ) eqStore.showSimulatedResponse = !eqStore.showSimulatedResponse; }}
                disabled={!eqStore.showEQ}
                title={eqStore.showEQ ? (eqStore.showSimulatedResponse ? 'Ocultar respuesta simulada' : 'Mostrar respuesta simulada') : 'Activar capa EQ primero'}
            >
                <span class="material-symbols-outlined text-[12px]">{eqStore.showSimulatedResponse ? 'visibility' : 'visibility_off'}</span>
                Simular respuesta
            </button>
        </div>
    </div>

    <!-- Tabs — pegados al contenido, sin borde intermedio -->
    <div class="flex px-4" style="background: var(--bg-tertiary); border-bottom: 1px solid var(--border-primary);">
        <button
            class="px-4 py-2 text-[10px] font-semibold transition-all cursor-pointer"
            style="background: {activeTab === 'simulacion' ? 'var(--bg-secondary)' : 'transparent'}; color: {activeTab === 'simulacion' ? 'var(--text-primary)' : 'var(--text-muted)'}; border: 1px solid {activeTab === 'simulacion' ? 'var(--border-primary)' : 'transparent'}; border-bottom: {activeTab === 'simulacion' ? '1px solid var(--bg-secondary)' : '1px solid transparent'}; border-radius: 6px 6px 0 0; margin-bottom: -1px; position: relative; z-index: 1;"
            onclick={() => activeTab = 'simulacion'}
        >Simulación</button>
        <button
            class="px-4 py-2 text-[10px] font-semibold transition-all cursor-pointer"
            style="background: {activeTab === 'calcular' ? 'var(--bg-secondary)' : 'transparent'}; color: {activeTab === 'calcular' ? 'var(--text-primary)' : 'var(--text-muted)'}; border: 1px solid {activeTab === 'calcular' ? 'var(--border-primary)' : 'transparent'}; border-bottom: {activeTab === 'calcular' ? '1px solid var(--bg-secondary)' : '1px solid transparent'}; border-radius: 6px 6px 0 0; margin-bottom: -1px; position: relative; z-index: 1;"
            onclick={() => activeTab = 'calcular'}
        >Calcular</button>
    </div>

    <!-- ═══════ TAB: SIMULACIÓN ═══════ -->
    {#if activeTab === 'simulacion'}
    <div class="flex flex-col gap-3 p-4" style="background: var(--bg-secondary);">


        <!-- Tipo de EQ -->
        <div class="flex flex-col gap-1.5">
            <span class="text-[9px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Tipo</span>
            <div class="flex p-0.5 rounded-lg gap-0.5" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
                <button
                    class="flex-1 px-3 py-2 rounded-md text-[10px] font-semibold transition-all cursor-pointer"
                    style="background: {eqStore.eqType === 'grafico' ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent'}; color: {eqStore.eqType === 'grafico' ? 'var(--accent)' : 'var(--text-muted)'}"
                    onclick={() => eqStore.eqType = 'grafico'}
                >Gráfico</button>
                <button
                    class="flex-1 px-3 py-2 rounded-md text-[10px] font-semibold transition-all cursor-pointer"
                    style="background: {eqStore.eqType === 'parametrico' ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent'}; color: {eqStore.eqType === 'parametrico' ? 'var(--accent)' : 'var(--text-muted)'}"
                    onclick={() => eqStore.eqType = 'parametrico'}
                >Paramétrico</button>
            </div>
        </div>

        <!-- Paramétrico: header con preset + agregar -->
        {#if eqStore.eqType === 'parametrico'}
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="text-[10px]" style="color: var(--text-secondary)">{eqStore.parametricFilters.length} filtro{eqStore.parametricFilters.length !== 1 ? 's' : ''}</span>
                    <!-- Preset selector -->
                    <div class="relative">
                        <button
                            class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold cursor-pointer transition-all"
                            style="color: var(--text-muted); background: transparent; border: 1px solid var(--border-primary)"
                            onclick={() => showPresetMenu = !showPresetMenu}
                            title="Cargar preset de EQ"
                        >
                            <span class="material-symbols-outlined text-[10px]">tune</span>
                            Preset
                        </button>
                        {#if showPresetMenu}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div class="fixed inset-0 z-40" onclick={() => showPresetMenu = false}></div>
                            <div class="absolute left-0 mt-1 rounded-lg shadow-[0_8px_24px_#000000] z-50 min-w-[200px] p-1.5 flex flex-col gap-0.5"
                                style="background: var(--bg-surface); border: 1px solid var(--border-primary)">
                                {#each eqPresets as preset}
                                    <button
                                        class="w-full text-left px-2.5 py-2 rounded-md text-[10px] cursor-pointer transition-all flex flex-col gap-0.5 hover:bg-white/5"
                                        style="color: var(--text-primary); background: transparent; border: none"
                                        onclick={() => { applyPreset(preset); showPresetMenu = false; }}
                                    >
                                        <span class="font-semibold">{preset.label}</span>
                                        <span class="text-[8px]" style="color: var(--text-muted)">{preset.desc}</span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
                <div class="flex gap-1.5">
                    <button
                        class="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold cursor-pointer"
                        style="color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 12%, transparent)"
                        onclick={() => {
                            const newId = eqStore.parametricFilters.length > 0 ? Math.max(...eqStore.parametricFilters.map(f => f.id)) + 1 : 1;
                            eqStore.parametricFilters = [...eqStore.parametricFilters, {
                                id: newId, type: 'peaking', freq: 1000, gain: 0, q: 1.0,
                                supportedTypes: ['peaking', 'lowpass', 'highpass', 'low_shelf', 'high_shelf', 'notch', 'bandpass'],
                                showConfig: false
                            }];
                        }}
                    >
                        <span class="material-symbols-outlined text-[11px]">add</span>
                        Agregar
                    </button>
                    <button
                        class="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold cursor-pointer"
                        style="color: var(--text-muted); background: transparent; border: 1px solid var(--border-primary)"
                        onclick={() => eqStore.parametricFilters.forEach(f => { f.gain = 0; f.freq = 1000; f.q = 1.0; })}
                    >Reset</button>
                </div>
            </div>
        {/if}

        <!-- Gráfico: selector de bandas -->
        {#if eqStore.eqType === 'grafico'}
            <div class="flex justify-between items-center">
                <span class="text-[10px]" style="color: var(--text-secondary)">{eqStore.graphicBands.length} bandas</span>
                <div class="flex items-center gap-1.5">
                    {#if eqStore.customBandCount}
                        <input type="number" min="3" max="31" bind:value={eqStore.numGraphicBands}
                            class="w-14 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)] text-center" />
                        <button class="text-[9px] cursor-pointer" style="color: var(--text-muted)" onclick={() => eqStore.customBandCount = false}>Presets</button>
                    {:else}
                        <select bind:value={eqStore.numGraphicBands} class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)]">
                            <option value={10}>1 oct (10)</option>
                            <option value={15}>2/3 oct (15)</option>
                            <option value={20}>1/2 oct (20)</option>
                            <option value={31}>1/3 oct (31)</option>
                        </select>
                        <button class="cursor-pointer" style="color: var(--text-muted)" onclick={() => eqStore.customBandCount = true} title="Personalizar">
                            <span class="material-symbols-outlined text-[12px]">tune</span>
                        </button>
                    {/if}
                    <button
                        class="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold cursor-pointer"
                        style="color: var(--text-muted); background: transparent; border: 1px solid var(--border-primary)"
                        onclick={() => eqStore.graphicBands.forEach(b => { b.gain = 0; })}
                    >Reset</button>
                </div>
            </div>
        {/if}

        <!-- Detalle de filtros (desplegable) -->
        <button
            class="flex items-center gap-1 text-[9px] font-semibold cursor-pointer self-start py-1"
            style="color: var(--text-muted); background: none; border: none"
            onclick={() => showFilterDetail = !showFilterDetail}
        >
            <span class="material-symbols-outlined text-[10px]">{showFilterDetail ? 'expand_more' : 'chevron_right'}</span>
            Detalle de filtros
        </button>

        {#if showFilterDetail}
            <!-- MODO GRÁFICO -->
            {#if eqStore.eqType === 'grafico'}
                <div class="flex flex-col gap-2 pl-2" style="border-left: 2px solid var(--border-primary)">
                    {#each eqStore.graphicBands as band}
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-mono w-12 text-right" style="color: var(--text-muted)">
                                {band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1).replace(".0", "")}k` : band.freq}
                            </span>
                            <input type="range" min="-12" max="12" step="0.5" bind:value={band.gain}
                                ondblclick={() => band.gain = 0} title="Doble clic para 0dB"
                                class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
                            <input type="number" bind:value={band.gain} min="-12" max="12" step="0.5"
                                class="w-11 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-center text-[10px] font-mono text-[var(--text-primary)] py-0.5" />
                        </div>
                    {/each}
                </div>

            <!-- MODO PARAMÉTRICO -->
            {:else}
                <div class="flex flex-col gap-2 pl-2" style="border-left: 2px solid var(--border-primary)">
                    {#each eqStore.parametricFilters as filter}
                        <div class="rounded-lg p-2.5 flex flex-col gap-2" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center gap-2">
                                    <span class="w-4 h-3" style="color: {filterTypeColors[filter.type] || '#888'}">
                                        {@html filterSvgIcons[filter.type] || ''}
                                    </span>
                                    <span class="text-[10px] font-bold" style="color: {filterTypeColors[filter.type] || '#888'}">#{filter.id}</span>
                                    <span class="text-[9px]" style="color: var(--text-muted)">{filterTypeName(filter.type)}</span>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button class="cursor-pointer transition-colors" style="color: {filter.showConfig ? 'var(--accent)' : 'var(--text-muted)'}"
                                        onclick={() => filter.showConfig = !filter.showConfig}
                                        title="Configurar tipos disponibles">
                                        <span class="material-symbols-outlined text-[13px]">settings</span>
                                    </button>
                                    <button class="cursor-pointer" style="color: var(--text-muted)"
                                        onclick={() => eqStore.parametricFilters = eqStore.parametricFilters.filter(f => f.id !== filter.id)}>
                                        <span class="material-symbols-outlined text-[13px]">close</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Config: supported types editor -->
                            {#if filter.showConfig}
                                <div class="flex flex-col gap-1.5 p-2 rounded" style="background: var(--bg-secondary); border: 1px solid var(--border-primary)">
                                    <span class="text-[8px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Tipos disponibles</span>
                                    <div class="flex flex-wrap gap-1">
                                        {#each ['peaking', 'lowpass', 'highpass', 'low_shelf', 'high_shelf', 'notch', 'bandpass'] as type}
                                            <label class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] cursor-pointer transition-all"
                                                style="background: {filter.supportedTypes.includes(type) ? (filterTypeColors[type] || '#888') + '15' : 'transparent'}; color: {filter.supportedTypes.includes(type) ? filterTypeColors[type] || '#888' : 'var(--text-muted)'}; border: 1px solid {filter.supportedTypes.includes(type) ? (filterTypeColors[type] || '#888') + '30' : 'var(--border-primary)'}">
                                                <input type="checkbox"
                                                    checked={filter.supportedTypes.includes(type)}
                                                    class="accent-[var(--accent)] scale-75"
                                                    onchange={() => {
                                                        if (filter.supportedTypes.includes(type)) {
                                                            if (filter.supportedTypes.length > 1) {
                                                                filter.supportedTypes = filter.supportedTypes.filter((t: string) => t !== type);
                                                                if (filter.type === type) filter.type = filter.supportedTypes[0];
                                                            }
                                                        } else {
                                                            filter.supportedTypes = [...filter.supportedTypes, type];
                                                        }
                                                    }}
                                                />
                                                <span class="w-3 h-2 inline-flex items-center">{@html filterSvgIcons[type] || ''}</span>
                                                {filterTypeName(type)}
                                            </label>
                                        {/each}
                                    </div>
                                </div>
                            {/if}

                            <!-- Type toggle -->
                            <div class="flex flex-wrap gap-0.5">
                                {#each filter.supportedTypes as type}
                                    <button class="px-1.5 py-0.5 rounded text-[8px] font-semibold transition-all cursor-pointer"
                                        style="background: {filter.type === type ? (filterTypeColors[type] || '#888') + '15' : 'transparent'}; color: {filter.type === type ? filterTypeColors[type] || '#888' : 'var(--text-muted)'}; border: 1px solid {filter.type === type ? (filterTypeColors[type] || '#888') + '30' : 'transparent'}"
                                        onclick={() => filter.type = type}
                                    >
                                        <span class="w-3 h-2 inline-flex items-center">{@html filterSvgIcons[type] || ''}</span>
                                    </button>
                                {/each}
                            </div>

                            <!-- Freq -->
                            <div class="flex gap-1 items-center">
                                <span class="text-[8px] w-6 font-bold uppercase" style="color: var(--text-muted)">Hz</span>
                                <input type="number" bind:value={filter.freq} min="20" max="20000"
                                    class="w-16 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-primary)]" />
                                <input type="range" min="0" max="1" step="0.001"
                                    value={(Math.log10(filter.freq || 20) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))}
                                    oninput={(e) => { const v = parseFloat(e.currentTarget.value); filter.freq = Math.round(Math.pow(10, Math.log10(20) + v * (Math.log10(20000) - Math.log10(20)))); }}
                                    ondblclick={() => filter.freq = 1000}
                                    class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" />
                            </div>

                            <!-- Gain (only for types with gain) -->
                            {#if ['peaking', 'low_shelf', 'high_shelf'].includes(filter.type)}
                                <div class="flex gap-1 items-center">
                                    <span class="text-[8px] w-6 font-bold uppercase" style="color: var(--text-muted)">dB</span>
                                    <input type="number" bind:value={filter.gain} min="-15" max="15" step="0.5"
                                        class="w-16 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-primary)]" />
                                    <input type="range" min="-15" max="15" step="0.5" bind:value={filter.gain}
                                        ondblclick={() => filter.gain = 0}
                                        class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
                                </div>
                            {/if}

                            <!-- Q -->
                            <div class="flex gap-1 items-center">
                                <span class="text-[8px] w-6 font-bold uppercase" style="color: var(--text-muted)">Q</span>
                                <input type="number" bind:value={filter.q} min="0.1" max="10" step="0.1"
                                    disabled={['lowpass', 'highpass'].includes(filter.type)}
                                    class="w-16 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-primary)] disabled:opacity-30" />
                                <input type="range" min="0.1" max="10" step="0.1" bind:value={filter.q}
                                    disabled={['lowpass', 'highpass'].includes(filter.type)}
                                    ondblclick={() => filter.q = 1.0}
                                    class="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)] disabled:opacity-30" />
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}

        <p class="text-[8px] italic" style="color: var(--text-muted)">
            Controla los filtros directamente en el cuadrante: arrastrá los nodos, usá scroll para Q.
        </p>
    </div>
    {/if}

    <!-- ═══════ TAB: CALCULAR ═══════ -->
    {#if activeTab === 'calcular'}
    <div class="flex flex-col gap-3 p-4" style="background: var(--bg-secondary);">

        <!-- Fuente de datos -->
        <div class="flex flex-col gap-2 rounded-lg p-3" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
            <span class="text-[9px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Fuente de datos</span>
            <div class="flex gap-1">
                {#each [{ value: 'live', label: 'Medición', icon: 'mic' }, { value: 'snapshot', label: 'Instantáneas', icon: 'camera' }, { value: 'calculated', label: 'Capas', icon: 'layers' }] as source}
                    <button class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-semibold transition-all cursor-pointer"
                        style="background: {eqStore.autoEQSourceType === source.value ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent'}; color: {eqStore.autoEQSourceType === source.value ? 'var(--accent)' : 'var(--text-muted)'}; border: 1px solid {eqStore.autoEQSourceType === source.value ? 'color-mix(in srgb, var(--accent) 19%, transparent)' : 'var(--border-primary)'}"
                        onclick={() => eqStore.autoEQSourceType = source.value as any}>
                        <span class="material-symbols-outlined text-[11px]">{source.icon}</span>
                        {source.label}
                    </button>
                {/each}
            </div>
            {#if eqStore.autoEQSourceType === 'snapshot'}
                <div class="mt-1">
                    <SnapshotPicker
                        mode="multi"
                        bind:selectedIds={eqStore.autoEQSnapshotIds}
                        onSelect={(ids) => eqStore.autoEQSnapshotIds = ids}
                        showOperations={true}
                        bind:operation={eqStore.autoEQCalcOperation}
                        onOperationChange={(op) => eqStore.autoEQCalcOperation = op}
                        maxHeight="200px"
                    />
                </div>
            {/if}
            {#if eqStore.autoEQSourceType === 'calculated'}
                <select class="w-full rounded-md text-xs py-1.5 px-2 mt-1" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)" bind:value={eqStore.autoEQSourceLayer}>
                    <option value="active">Capa activa</option>
                    {#each traceManager.layers as layer}<option value={layer.id}>{layer.name}</option>{/each}
                </select>
            {/if}
        </div>

        <!-- Configuración -->
        <div class="flex flex-col gap-2 rounded-lg p-3" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
            <span class="text-[9px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Configuración</span>

            <div class="flex flex-col gap-1">
                <label class="text-[8px] font-bold uppercase" style="color: var(--text-muted)">Algoritmo</label>
                <select class="w-full rounded-md text-xs py-1.5 px-2" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)"
                    bind:value={eqStore.autoEQAlgorithm}>
                    <option value="greedy">Greedy (rápido)</option>
                    <option value="nelder-mead">Nelder-Mead (preciso)</option>
                    <option value="pso">PSO (global)</option>
                    <option value="genetic">Genético (robusto)</option>
                    <option value="all">⭐ Benchmark (todos)</option>
                </select>
                <span class="text-[8px] italic" style="color: var(--text-muted)">{algoDesc[eqStore.autoEQAlgorithm] || ''}</span>
            </div>

            <div class="flex flex-col gap-1">
                <label class="text-[8px] font-bold uppercase" style="color: var(--text-muted)">Curva de referencia</label>
                <select class="w-full rounded-md text-xs py-1.5 px-2" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)"
                    value={targetTrace.name} onchange={(e) => targetTrace.applyPreset(e.currentTarget.value as any)}>
                    <option value="Flat">Flat (0dB)</option>
                    <option value="House">House curve</option>
                    <option value="BK">B&K cinema</option>
                    <option value="Harman">Harman 2019</option>
                    <option value="X-Curve">X-Curve</option>
                </select>
            </div>

            <div class="flex gap-2">
                <div class="flex-1 flex flex-col gap-0.5">
                    <label class="text-[8px] font-bold uppercase" style="color: var(--text-muted)">Dominio</label>
                    <select bind:value={eqStore.autoEQCostDomain} class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)]">
                        <option value="dB">dB</option>
                        <option value="energy">Energía</option>
                    </select>
                </div>
            </div>

            <!-- EQ type info -->
            <div class="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style="background: var(--bg-secondary); border: 1px solid var(--border-primary)">
                <span class="material-symbols-outlined text-[11px]" style="color: var(--text-muted)">equalizer</span>
                <span class="text-[9px]" style="color: var(--text-secondary)">Ecualizador: <strong>{eqTypeLabel}</strong></span>
            </div>

            <!-- Advanced toggle -->
            <button class="text-[8px] font-semibold self-start px-2 py-0.5 rounded cursor-pointer" style="color: var(--text-muted); background: transparent; border: none"
                onclick={() => eqStore.autoEQShowAdvanced = !eqStore.autoEQShowAdvanced}>
                {eqStore.autoEQShowAdvanced ? '▾' : '▸'} Avanzados
            </button>

            {#if eqStore.autoEQShowAdvanced}
                <div class="flex flex-col gap-2 pl-2" style="border-left: 2px solid var(--border-primary)">
                    <div class="grid grid-cols-2 gap-2">
                        <div class="flex flex-col gap-0.5">
                            <label class="text-[8px]" style="color: var(--text-muted)">Max boost (dB)</label>
                            <input type="number" min="0" max="18" step="1" bind:value={eqStore.autoEQMaxBoost} class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-0.5 text-[10px] text-[var(--text-primary)]" />
                        </div>
                        <div class="flex flex-col gap-0.5">
                            <label class="text-[8px]" style="color: var(--text-muted)">Max cut (dB)</label>
                            <input type="number" min="-30" max="0" step="1" bind:value={eqStore.autoEQMaxCut} class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-0.5 text-[10px] text-[var(--text-primary)]" />
                        </div>
                        <div class="flex flex-col gap-0.5">
                            <label class="text-[8px]" style="color: var(--text-muted)">Min Q</label>
                            <input type="number" min="0.1" max="2" step="0.1" bind:value={eqStore.autoEQMinQ} class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-0.5 text-[10px] text-[var(--text-primary)]" />
                        </div>
                        <div class="flex flex-col gap-0.5">
                            <label class="text-[8px]" style="color: var(--text-muted)">Max Q</label>
                            <input type="number" min="1" max="20" step="0.5" bind:value={eqStore.autoEQMaxQ} class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-0.5 text-[10px] text-[var(--text-primary)]" />
                        </div>
                        <div class="flex flex-col gap-0.5">
                            <label class="text-[8px]" style="color: var(--text-muted)">Coherencia mín</label>
                            <input type="number" min="0" max="1" step="0.05" bind:value={eqStore.autoEQCoherenceThreshold} class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-0.5 text-[10px] text-[var(--text-primary)]" />
                        </div>
                        <div class="flex flex-col gap-0.5">
                            <label class="text-[8px]" style="color: var(--text-muted)">Iteraciones</label>
                            <input type="number" min="50" max="1000" step="50" bind:value={eqStore.autoEQMaxIterations} class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-0.5 text-[10px] text-[var(--text-primary)]" />
                        </div>
                    </div>
                    <label class="flex items-center gap-2 text-[9px] cursor-pointer" style="color: var(--text-secondary)">
                        <input type="checkbox" bind:checked={eqStore.autoEQTrebleAveraging} class="accent-[var(--accent)] w-3 h-3" />
                        Treble averaging (>{eqStore.autoEQTrebleFreq}Hz)
                    </label>
                    <label class="flex items-center gap-2 text-[9px] cursor-pointer" style="color: var(--text-secondary)">
                        <input type="checkbox" bind:checked={eqStore.autoEQOnlyCorrectPeaks} class="accent-[var(--accent)] w-3 h-3" />
                        Solo corregir picos (no boost)
                    </label>
                </div>
            {/if}
        </div>

        <!-- Progress -->
        {#if eqStore.autoEQProgress}
            <div class="flex flex-col gap-1">
                <div class="flex justify-between text-[8px]" style="color: var(--text-muted)">
                    <span>{eqStore.autoEQProgress.algorithm}</span>
                    <span>{Math.round(eqStore.autoEQProgress.progress * 100)}%</span>
                </div>
                <div class="w-full h-1 rounded-full overflow-hidden" style="background: var(--bg-secondary)">
                    <div class="h-full rounded-full transition-all" style="width: {eqStore.autoEQProgress.progress * 100}%; background: var(--accent)"></div>
                </div>
            </div>
        {/if}

        <!-- Calcular button -->
        <button
            class="w-full min-h-[38px] rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
            style="background: #00ff8810; color: #00ff88; border: 1px solid #00ff8820"
            onclick={handleRunAutoEQ}
            disabled={!eqStore.showEQ || eqStore.isCalculatingAutoEQ}>
            <span class="material-symbols-outlined text-sm">{eqStore.isCalculatingAutoEQ ? "sync" : "auto_awesome"}</span>
            {eqStore.isCalculatingAutoEQ ? "Calculando..." : eqStore.autoEQAlgorithm === 'all' ? "Benchmark (todos)" : "Calcular ecualización"}
        </button>

        <!-- Benchmark Results -->
        {#if eqStore.autoEQBenchmarkResults}
            {@const benchResults = eqStore.autoEQBenchmarkResults as BenchmarkResult}
            <div class="flex flex-col gap-2 rounded-lg p-3" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Comparación</span>
                    <span class="text-[8px] font-mono" style="color: var(--text-muted)">{formatTime(benchResults.totalTimeMs)}</span>
                </div>
                <table class="w-full text-[8px]" style="color: var(--text-secondary)">
                    <thead>
                        <tr class="border-b" style="border-color: var(--border-primary)">
                            <th class="text-left py-1 font-semibold" style="color: var(--text-muted)">Algo.</th>
                            <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">RMS</th>
                            <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">±3dB</th>
                            <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">Mejora</th>
                            <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">⏱</th>
                            <th class="text-center py-1" style="color: var(--text-muted)"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each benchResults.results as entry, idx}
                            <tr class="border-b cursor-pointer hover:bg-white/5 transition-all"
                                style="border-color: var(--border-primary); {eqStore.autoEQPreviewIndex === idx ? 'background: color-mix(in srgb, var(--accent) 6%, transparent)' : ''}"
                                onclick={() => eqStore.autoEQPreviewIndex = idx}>
                                <td class="py-1.5 font-semibold">
                                    {#if idx === 0}<span title="Recomendado">⭐</span>{/if}
                                    {entry.algorithm === 'nelder-mead' ? 'NM' : entry.algorithm === 'genetic' ? 'GA' : entry.algorithm.toUpperCase()}
                                </td>
                                <td class="text-right py-1.5 font-mono" style="color: {devColor(entry.metrics.rms)}">{entry.metrics.rms.toFixed(1)}</td>
                                <td class="text-right py-1.5 font-mono">{entry.metrics.percentWithin3dB.toFixed(0)}%</td>
                                <td class="text-right py-1.5 font-mono" style="color: {entry.improvement > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
                                    {entry.improvement > 0 ? '+' : ''}{entry.improvement.toFixed(0)}%
                                </td>
                                <td class="text-right py-1.5 font-mono" style="color: var(--text-muted)">{formatTime(entry.result.timeMs)}</td>
                                <td class="text-center py-1.5">
                                    <button class="px-1.5 py-0.5 rounded text-[7px] font-bold cursor-pointer" style="color: #00ff88; background: #00ff8810; border: 1px solid #00ff8820"
                                        onclick={(e) => { e.stopPropagation(); applyBenchmarkResult(idx); }}>Usar</button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
    {/if}
</div>

