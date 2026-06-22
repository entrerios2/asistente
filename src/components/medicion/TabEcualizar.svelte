<script lang="ts">
    import { untrack } from "svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { targetTrace } from "$lib/stores/targetTrace.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";
    import { computeDeviation, type DeviationResult } from "$lib/dsp/deviationMetrics";
    import { filterSvgIcons } from "$lib/icons/filterIcons";
    import { eqStore, type GraphicBand } from "$lib/stores/eqStore.svelte";
    import { runAutoEQ, benchmarkAll, DEFAULT_CONFIG, type AutoEQConfig, type AutoEQResult, type BenchmarkResult } from "$lib/dsp/autoEQ";

    let {
        statusText = $bindable("Listo para medir")
    }: {
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
            numFilters: eqStore.autoEQNumFilters,
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
        statusText = "Calculando AutoEQ...";
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
                    statusText = `Benchmark completado en ${(result.totalTimeMs / 1000).toFixed(1)}s — mejor: ${result.best}`;
                } else {
                    const result = runAutoEQ(magnitude, target, coherence, bins, sr, config,
                        (algo, iter, _mse) => { eqStore.autoEQProgress = { algorithm: algo, progress: iter / config.maxIterations }; });
                    eqStore.autoEQLastResult = result;
                    applyAutoEQResult(result);
                    statusText = `AutoEQ (${result.algorithm}) completado en ${result.timeMs.toFixed(0)}ms`;
                }
            } catch (e: any) { statusText = `Error: ${e.message}`; }
            eqStore.isCalculatingAutoEQ = false;
            eqStore.autoEQProgress = null;
        }, 50);
    }

    function applyAutoEQResult(result: AutoEQResult) {
        eqStore.eqType = 'parametrico';
        eqStore.parametricFilters = result.filters.map((f, i) => ({
            id: i + 1, freq: Math.round(f.fc), gain: Math.round(f.gain * 10) / 10,
            q: Math.round(f.q * 10) / 10, type: f.type,
            supportedTypes: ['peaking', 'low_shelf', 'high_shelf', 'notch'], showConfig: false,
        }));
    }

    function applyBenchmarkResult(index: number) {
        const results = eqStore.autoEQBenchmarkResults as BenchmarkResult | null;
        if (!results || !results.results[index]) return;
        applyAutoEQResult(results.results[index].result);
        eqStore.autoEQPreviewIndex = index;
    }

    function formatTime(ms: number): string { return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`; }
    function devColor(rms: number): string { return rms > 6 ? '#ff4444' : rms > 3 ? '#fbbf24' : '#00ff88'; }
    function impArrow(before: number, after: number, lower = true): string { return lower ? (after < before ? '↓' : after > before ? '↑' : '') : (after > before ? '↑' : after < before ? '↓' : ''); }
    function impColor(before: number, after: number, lower = true): string { return lower ? (after < before ? '#00ff88' : after > before ? '#ff4444' : 'var(--text-muted)') : (after > before ? '#00ff88' : after < before ? '#ff4444' : 'var(--text-muted)'); }
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
                    bind:checked={eqStore.showEQ}
                    class="accent-[#fbbf24] w-3.5 h-3.5 cursor-pointer"
                />
                <span class="text-[10px] font-semibold" style="color: {eqStore.showEQ ? '#fbbf24' : 'var(--text-muted)'}">
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

    <!-- Sección: Fuente de Datos (G2) -->
    <div class="flex flex-col gap-2 rounded-lg p-3"
         style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
        <span class="text-[9px] font-bold uppercase tracking-wider"
              style="color: var(--text-muted)">Fuente de datos</span>
        <div class="flex gap-1">
            {#each [{ value: 'live', label: 'Live', icon: 'mic' }, { value: 'snapshot', label: 'Snapshots', icon: 'camera' }, { value: 'calculated', label: 'Capa', icon: 'layers' }] as source}
                <button class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-semibold transition-all cursor-pointer"
                    style="background: {eqStore.autoEQSourceType === source.value ? '#3b82f610' : 'transparent'}; color: {eqStore.autoEQSourceType === source.value ? '#3b82f6' : 'var(--text-muted)'}; border: 1px solid {eqStore.autoEQSourceType === source.value ? '#3b82f630' : 'var(--border-primary)'}"
                    onclick={() => eqStore.autoEQSourceType = source.value as any}>
                    <span class="material-symbols-outlined text-[11px]">{source.icon}</span>
                    {source.label}
                </button>
            {/each}
        </div>
        {#if eqStore.autoEQSourceType === 'snapshot'}
            <div class="flex flex-col gap-1 mt-1">
                {#if traceManager.instantaneas.length === 0}
                    <span class="text-[9px] italic" style="color: var(--text-muted)">No hay snapshots</span>
                {:else}
                    <div class="max-h-[100px] overflow-y-auto flex flex-col gap-0.5">
                        {#each traceManager.instantaneas as snap}
                            <label class="flex items-center gap-2 text-[10px] cursor-pointer py-0.5 px-1 rounded hover:bg-white/5" style="color: var(--text-secondary)">
                                <input type="checkbox" checked={eqStore.autoEQSnapshotIds.includes(snap.id)}
                                    onchange={() => { eqStore.autoEQSnapshotIds = eqStore.autoEQSnapshotIds.includes(snap.id) ? eqStore.autoEQSnapshotIds.filter(id => id !== snap.id) : [...eqStore.autoEQSnapshotIds, snap.id]; }}
                                    class="accent-[#3b82f6] w-3 h-3" />
                                <span class="w-2 h-2 rounded-full" style="background: {snap.color || '#888'}"></span>
                                {snap.name || snap.id}
                            </label>
                        {/each}
                    </div>
                    {#if eqStore.autoEQSnapshotIds.length > 1}
                        <div class="flex gap-1 mt-1">
                            <span class="text-[8px] font-bold uppercase" style="color: var(--text-muted)">Op:</span>
                            {#each ['average', 'min', 'max'] as op}
                                <button class="px-2 py-0.5 rounded text-[8px] font-semibold cursor-pointer"
                                    style="background: {eqStore.autoEQCalcOperation === op ? '#3b82f610' : 'transparent'}; color: {eqStore.autoEQCalcOperation === op ? '#3b82f6' : 'var(--text-muted)'}; border: 1px solid {eqStore.autoEQCalcOperation === op ? '#3b82f630' : 'transparent'}"
                                    onclick={() => eqStore.autoEQCalcOperation = op as any}
                                >{op === 'average' ? 'Promedio' : op === 'min' ? 'Mínimo' : 'Máximo'}</button>
                            {/each}
                        </div>
                    {/if}
                {/if}
            </div>
        {/if}
        {#if eqStore.autoEQSourceType === 'calculated'}
            <select class="w-full rounded-md text-xs py-1.5 px-2 mt-1" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)" bind:value={eqStore.autoEQSourceLayer}>
                <option value="active">Capa activa</option>
                {#each traceManager.layers as layer}<option value={layer.id}>{layer.name}</option>{/each}
            </select>
        {/if}
    </div>

    <!-- Sección: AutoEQ (D6) -->
    <div class="flex flex-col gap-2 rounded-lg p-3"
         style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
        <span class="text-[9px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">AutoEQ</span>

        <div class="flex flex-col gap-1">
            <label class="text-[9px] font-bold uppercase" style="color: var(--text-muted)">Curva de referencia</label>
            <select class="w-full rounded-md text-xs py-1.5 px-2" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)"
                value={targetTrace.name} onchange={(e) => targetTrace.applyPreset(e.currentTarget.value as any)}>
                <option value="Flat">Flat (0dB)</option>
                <option value="House">House curve</option>
                <option value="BK">B&K cinema</option>
                <option value="Harman">Harman 2019</option>
                <option value="X-Curve">X-Curve</option>
            </select>
        </div>

        <div class="flex flex-col gap-1">
            <label class="text-[9px] font-bold uppercase" style="color: var(--text-muted)">Algoritmo</label>
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

        <div class="flex gap-2">
            <div class="flex-1 flex flex-col gap-1">
                <label class="text-[8px] font-bold uppercase" style="color: var(--text-muted)">Filtros</label>
                <input type="number" min="1" max="20" bind:value={eqStore.autoEQNumFilters}
                    class="w-full bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200 text-center" />
            </div>
            <div class="flex-1 flex flex-col gap-1">
                <label class="text-[8px] font-bold uppercase" style="color: var(--text-muted)">Dominio</label>
                <select bind:value={eqStore.autoEQCostDomain} class="w-full bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200">
                    <option value="dB">dB</option>
                    <option value="energy">Energía</option>
                </select>
            </div>
        </div>

        <button class="text-[8px] font-semibold self-start px-2 py-0.5 rounded cursor-pointer" style="color: var(--text-muted); background: transparent; border: none"
            onclick={() => eqStore.autoEQShowAdvanced = !eqStore.autoEQShowAdvanced}>
            {eqStore.autoEQShowAdvanced ? '▾' : '▸'} Avanzados
        </button>

        {#if eqStore.autoEQShowAdvanced}
            <div class="flex flex-col gap-2 pl-2 border-l-2" style="border-color: var(--border-primary)">
                <div class="grid grid-cols-2 gap-2">
                    <div class="flex flex-col gap-0.5">
                        <label class="text-[8px]" style="color: var(--text-muted)">Max boost (dB)</label>
                        <input type="number" min="0" max="18" step="1" bind:value={eqStore.autoEQMaxBoost} class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-0.5 text-[10px] text-gray-200" />
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <label class="text-[8px]" style="color: var(--text-muted)">Max cut (dB)</label>
                        <input type="number" min="-30" max="0" step="1" bind:value={eqStore.autoEQMaxCut} class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-0.5 text-[10px] text-gray-200" />
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <label class="text-[8px]" style="color: var(--text-muted)">Min Q</label>
                        <input type="number" min="0.1" max="2" step="0.1" bind:value={eqStore.autoEQMinQ} class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-0.5 text-[10px] text-gray-200" />
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <label class="text-[8px]" style="color: var(--text-muted)">Max Q</label>
                        <input type="number" min="1" max="20" step="0.5" bind:value={eqStore.autoEQMaxQ} class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-0.5 text-[10px] text-gray-200" />
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <label class="text-[8px]" style="color: var(--text-muted)">Coherencia mín</label>
                        <input type="number" min="0" max="1" step="0.05" bind:value={eqStore.autoEQCoherenceThreshold} class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-0.5 text-[10px] text-gray-200" />
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <label class="text-[8px]" style="color: var(--text-muted)">Iteraciones</label>
                        <input type="number" min="50" max="1000" step="50" bind:value={eqStore.autoEQMaxIterations} class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-0.5 text-[10px] text-gray-200" />
                    </div>
                </div>
                <label class="flex items-center gap-2 text-[9px] cursor-pointer" style="color: var(--text-secondary)">
                    <input type="checkbox" bind:checked={eqStore.autoEQTrebleAveraging} class="accent-[#3b82f6] w-3 h-3" />
                    Treble averaging (>{eqStore.autoEQTrebleFreq}Hz)
                </label>
                <label class="flex items-center gap-2 text-[9px] cursor-pointer" style="color: var(--text-secondary)">
                    <input type="checkbox" bind:checked={eqStore.autoEQOnlyCorrectPeaks} class="accent-[#3b82f6] w-3 h-3" />
                    Solo corregir picos (no boost)
                </label>
            </div>
        {/if}

        {#if eqStore.autoEQProgress}
            <div class="flex flex-col gap-1">
                <div class="flex justify-between text-[8px]" style="color: var(--text-muted)">
                    <span>{eqStore.autoEQProgress.algorithm}</span>
                    <span>{Math.round(eqStore.autoEQProgress.progress * 100)}%</span>
                </div>
                <div class="w-full h-1 rounded-full overflow-hidden" style="background: var(--bg-secondary)">
                    <div class="h-full rounded-full transition-all" style="width: {eqStore.autoEQProgress.progress * 100}%; background: #3b82f6"></div>
                </div>
            </div>
        {/if}

        <button
            class="w-full min-h-[38px] bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 border border-[#00ff88]/20 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
            onclick={handleRunAutoEQ}
            disabled={!eqStore.showEQ || eqStore.isCalculatingAutoEQ}>
            <span class="material-symbols-outlined text-sm">{eqStore.isCalculatingAutoEQ ? "sync" : "auto_awesome"}</span>
            {eqStore.isCalculatingAutoEQ ? "Calculando..." : eqStore.autoEQAlgorithm === 'all' ? "Benchmark (todos)" : "Calcular AutoEQ"}
        </button>
    </div>

    <!-- Benchmark Results (D8 UI) -->
    {#if eqStore.autoEQBenchmarkResults}
        {@const benchResults = eqStore.autoEQBenchmarkResults as BenchmarkResult}
        <div class="flex flex-col gap-2 rounded-lg p-3" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
            <div class="flex justify-between items-center">
                <span class="text-[9px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Comparación de algoritmos</span>
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
                            style="border-color: var(--border-primary); {eqStore.autoEQPreviewIndex === idx ? 'background: #3b82f610' : ''}"
                            onclick={() => eqStore.autoEQPreviewIndex = idx}>
                            <td class="py-1.5 font-semibold">
                                {#if idx === 0}<span title="Recomendado">⭐</span>{/if}
                                {entry.algorithm === 'nelder-mead' ? 'NM' : entry.algorithm === 'genetic' ? 'GA' : entry.algorithm.toUpperCase()}
                            </td>
                            <td class="text-right py-1.5 font-mono" style="color: {devColor(entry.metrics.rms)}">{entry.metrics.rms.toFixed(1)}</td>
                            <td class="text-right py-1.5 font-mono">{entry.metrics.percentWithin3dB.toFixed(0)}%</td>
                            <td class="text-right py-1.5 font-mono" style="color: {entry.improvement > 0 ? '#00ff88' : '#ff4444'}">
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

    <!-- Scorecard (H3) -->
    <div class="flex flex-col gap-1.5 rounded-lg p-3"
         style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
        <span class="text-[9px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Evaluación del EQ</span>
        <table class="w-full text-[9px]" style="color: var(--text-secondary)">
            <thead>
                <tr class="border-b" style="border-color: var(--border-primary)">
                    <th class="text-left py-1 font-semibold" style="color: var(--text-muted)">Métrica</th>
                    <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">Antes</th>
                    <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">Después</th>
                    <th class="text-center py-1 w-4"></th>
                </tr>
            </thead>
            <tbody>
                {#each traceManager.layers.filter(l => l.visible && l.data && l.data.length > 0).slice(0, 1) as layer}
                    {@const orig = computeDeviation(layer.data, deviationTarget, mathOrchestrator.outputCoherence, mathOrchestrator.BINS, uiStore.sampleRate)}
                    {@const eqd = computeDeviationWithEQ(layer.data, deviationTarget, mathOrchestrator.outputCoherence, mathOrchestrator.BINS)}
                    <tr class="border-b" style="border-color: var(--border-primary)">
                        <td class="py-1">RMS (dB)</td>
                        <td class="text-right py-1 font-mono">{orig.rms.toFixed(1)}</td>
                        <td class="text-right py-1 font-mono" style="color: {devColor(eqd.rms)}">{eqd.rms.toFixed(1)}</td>
                        <td class="text-center py-1" style="color: {impColor(orig.rms, eqd.rms)}">{impArrow(orig.rms, eqd.rms)}</td>
                    </tr>
                    <tr class="border-b" style="border-color: var(--border-primary)">
                        <td class="py-1">Peak (dB)</td>
                        <td class="text-right py-1 font-mono">{orig.peak.toFixed(1)}</td>
                        <td class="text-right py-1 font-mono">{eqd.peak.toFixed(1)}</td>
                        <td class="text-center py-1" style="color: {impColor(orig.peak, eqd.peak)}">{impArrow(orig.peak, eqd.peak)}</td>
                    </tr>
                    <tr class="border-b" style="border-color: var(--border-primary)">
                        <td class="py-1">WMSE</td>
                        <td class="text-right py-1 font-mono">{orig.weightedMSE.toFixed(1)}</td>
                        <td class="text-right py-1 font-mono">{eqd.weightedMSE.toFixed(1)}</td>
                        <td class="text-center py-1" style="color: {impColor(orig.weightedMSE, eqd.weightedMSE)}">{impArrow(orig.weightedMSE, eqd.weightedMSE)}</td>
                    </tr>
                    <tr class="border-b" style="border-color: var(--border-primary)">
                        <td class="py-1">±3dB (%)</td>
                        <td class="text-right py-1 font-mono">{orig.percentWithin3dB.toFixed(0)}%</td>
                        <td class="text-right py-1 font-mono" style="color: {eqd.percentWithin3dB > 80 ? '#00ff88' : eqd.percentWithin3dB > 50 ? '#fbbf24' : '#ff4444'}">{eqd.percentWithin3dB.toFixed(0)}%</td>
                        <td class="text-center py-1" style="color: {impColor(orig.percentWithin3dB, eqd.percentWithin3dB, false)}">{impArrow(orig.percentWithin3dB, eqd.percentWithin3dB, false)}</td>
                    </tr>
                    <tr class="border-b" style="border-color: var(--border-primary)">
                        <td class="py-1">±6dB (%)</td>
                        <td class="text-right py-1 font-mono">{orig.percentWithin6dB.toFixed(0)}%</td>
                        <td class="text-right py-1 font-mono">{eqd.percentWithin6dB.toFixed(0)}%</td>
                        <td class="text-center py-1" style="color: {impColor(orig.percentWithin6dB, eqd.percentWithin6dB, false)}">{impArrow(orig.percentWithin6dB, eqd.percentWithin6dB, false)}</td>
                    </tr>
                    <tr>
                        <td class="py-1">Bias (dB)</td>
                        <td class="text-right py-1 font-mono">{orig.meanDeviation > 0 ? '+' : ''}{orig.meanDeviation.toFixed(1)}</td>
                        <td class="text-right py-1 font-mono">{eqd.meanDeviation > 0 ? '+' : ''}{eqd.meanDeviation.toFixed(1)}</td>
                        <td class="text-center py-1" style="color: {impColor(Math.abs(orig.meanDeviation), Math.abs(eqd.meanDeviation))}">{impArrow(Math.abs(orig.meanDeviation), Math.abs(eqd.meanDeviation))}</td>
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
                       {eqStore.eqType === 'grafico' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'hover:text-gray-300'}"
                style="{eqStore.eqType !== 'grafico' ? 'color: var(--text-muted)' : ''}"
                onclick={() => eqStore.eqType = 'grafico'}>
                Gráfico
            </button>
            <button
                class="flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer
                       {eqStore.eqType === 'parametrico' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'hover:text-gray-300'}"
                style="{eqStore.eqType !== 'parametrico' ? 'color: var(--text-muted)' : ''}"
                onclick={() => eqStore.eqType = 'parametrico'}>
                Paramétrico
            </button>
        </div>
    </div>

    <!-- MODO GRÁFICO -->
    {#if eqStore.eqType === "grafico"}
        <div class="flex flex-col gap-4">
            <div class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5">
                <label class="text-xs text-gray-400">Bandas</label>
                {#if eqStore.customBandCount}
                    <div class="flex items-center gap-1">
                        <input
                            type="number"
                            min="3"
                            max="31"
                            bind:value={eqStore.numGraphicBands}
                            class="w-14 bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200 text-center"
                        />
                        <button
                            class="text-[9px] text-gray-500 hover:text-white cursor-pointer"
                            onclick={() => eqStore.customBandCount = false}
                        >Presets</button>
                    </div>
                {:else}
                    <div class="flex items-center gap-1">
                        <select
                            bind:value={eqStore.numGraphicBands}
                            class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
                        >
                            <option value={10}>1 oct (10)</option>
                            <option value={15}>2/3 oct (15)</option>
                            <option value={20}>1/2 oct (20)</option>
                            <option value={31}>1/3 oct (31)</option>
                        </select>
                        <button
                            class="text-[9px] text-gray-500 hover:text-white cursor-pointer px-1"
                            onclick={() => eqStore.customBandCount = true}
                            title="Número personalizado de bandas"
                        >
                            <span class="material-symbols-outlined text-[12px]">tune</span>
                        </button>
                    </div>
                {/if}
            </div>

            <div class="flex flex-col gap-2.5">
                {#each eqStore.graphicBands as band}
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
    {#if eqStore.eqType === "parametrico"}
        <div class="flex flex-col gap-3">
            <div class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5">
                <label class="text-xs text-gray-400">{eqStore.parametricFilters.length} filtro{eqStore.parametricFilters.length !== 1 ? 's' : ''}</label>
                <button
                    class="text-[9px] text-red-400/60 hover:text-red-400 cursor-pointer"
                    onclick={() => eqStore.parametricFilters.forEach(f => { f.gain = 0; f.freq = 1000; f.q = 1.0; })}
                    title="Resetear todos los filtros"
                >Resetear</button>
            </div>
            <div class="flex flex-col gap-3">
                {#each eqStore.parametricFilters as filter}
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
                                    onclick={() => eqStore.parametricFilters = eqStore.parametricFilters.filter(f => f.id !== filter.id)}
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
                    const newId = eqStore.parametricFilters.length > 0 ? Math.max(...eqStore.parametricFilters.map(f => f.id)) + 1 : 1;
                    eqStore.parametricFilters = [...eqStore.parametricFilters, {
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
