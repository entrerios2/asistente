<script lang="ts">
    import { onMount } from "svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { calibrationStore } from "$lib/stores/calibrationStore.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";
    import { getAudioProvider } from "$lib/hal";

    const provider = getAudioProvider();

    let inputDevices = $state<{ id: string; name: string; channels?: number }[]>([]);
    let outputDevices = $state<{ id: string; name: string; channels?: number }[]>([]);

    const activeInDevice = $derived(inputDevices.find(d => d.id === uiStore.audioInDevice));
    const inputChannelsCount = $derived(activeInDevice && activeInDevice.channels ? activeInDevice.channels : 2);

    const activeOutDevice = $derived(outputDevices.find(d => d.id === uiStore.audioOutDevice));
    const outputChannelsCount = $derived(activeOutDevice && activeOutDevice.channels ? activeOutDevice.channels : 2);

    async function loadDevices() {
        try {
            // @ts-ignore
            if (provider.listDevices) {
                // @ts-ignore
                const devices = await provider.listDevices();
                inputDevices = devices
                    .filter((d: any) => d.direction === "input")
                    .map((d: any) => ({ id: d.id, name: d.name, channels: d.channels }));
                outputDevices = devices
                    .filter((d: any) => d.direction === "output")
                    .map((d: any) => ({ id: d.id, name: d.name, channels: d.channels }));
            } else if (
                navigator.mediaDevices &&
                navigator.mediaDevices.enumerateDevices
            ) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                inputDevices = devices
                    .filter((d) => d.kind === "audioinput")
                    .map((d) => ({
                        id: d.deviceId || "default",
                        name: d.label || "Micrófono del Sistema",
                        channels: 2
                    }));
                outputDevices = devices
                    .filter((d) => d.kind === "audiooutput")
                    .map((d) => ({
                        id: d.deviceId || "default",
                        name: d.label || "Altavoces del Sistema",
                        channels: 2
                    }));
            }
        } catch (e) {
            console.error("Error cargando dispositivos de audio:", e);
        }

        if (inputDevices.length === 0) {
            inputDevices = [
                {
                    id: "in-default",
                    name: "Micrófono de Sistema (Predeterminado)",
                    channels: 2
                },
                { id: "in-focusrite", name: "Focusrite Scarlett 2i2 USB In", channels: 2 },
                { id: "in-motu", name: "MOTU M2 Audio Interface In", channels: 2 },
                { id: "in-webcam", name: "Micrófono de Cámara Web USB", channels: 1 },
            ];
        }
        if (outputDevices.length === 0) {
            outputDevices = [
                {
                    id: "out-default",
                    name: "Altavoces de Sistema (Predeterminado)",
                    channels: 2
                },
                { id: "out-focusrite", name: "Focusrite Scarlett 2i2 USB Out", channels: 2 },
                { id: "out-motu", name: "MOTU M2 Audio Interface Out", channels: 2 },
                { id: "out-headphones", name: "Auriculares Estéreo Bluetooth", channels: 2 },
            ];
        }
    }


    onMount(async () => {
        await loadDevices();
    });
</script>

<div
    class="flex-1 p-5 overflow-y-auto flex flex-col gap-5"
    id="panel-config"
>
    <!-- CARGADOR DE CALIBRACIÓN Y GANANCIA (PROMPT 7) -->
    <div
        class="flex flex-col gap-4 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-xl p-4"
    >
        <div
            class="flex items-center gap-2 border-b border-[#1a1a24]/30 pb-2"
        >
            <span
                class="material-symbols-outlined text-[#00ff88] text-lg"
                >settings_voice</span
            >
            <h3
                class="text-xs font-bold text-gray-300 uppercase tracking-wider"
            >
                Calibración y Ganancia
            </h3>
        </div>

        <!-- Archivo de Calibración (.cal / .txt) -->
        <div class="flex flex-col gap-1.5">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >Archivo de Calibración (.cal / .txt)</label
            >
            {#if calibrationStore.calibrationFilename}
                <div class="flex items-center justify-between bg-[#121216] border border-[#00ff88]/20 px-3 py-2 rounded-md text-xs">
                    <span class="text-[#00ff88] font-mono truncate">{calibrationStore.calibrationFilename}</span>
                    <button
                        class="text-red-400 hover:text-red-300 text-xs font-bold"
                        onclick={() => {
                            calibrationStore.calibrationPoints = [];
                            calibrationStore.calibrationFilename = '';
                        }}
                    >
                        Quitar
                    </button>
                </div>
            {:else}
                <input
                    type="file"
                    accept=".cal,.txt"
                    class="hidden"
                    id="cal-file-input"
                    onchange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                                const txt = evt.target?.result as string;
                                calibrationStore.loadCalibrationFile(txt, file.name);
                            };
                            reader.readAsText(file);
                        }
                    }}
                />
                <label
                    for="cal-file-input"
                    class="w-full bg-[#121216] border border-[#1a1a24] hover:border-gray-500 rounded-md px-3 py-2 text-xs text-center text-gray-400 hover:text-white cursor-pointer transition-all"
                >
                    Cargar Curva de Calibración
                </label>
            {/if}
        </div>

        <!-- Slider Ganancia de Entrada -->
        <div class="flex flex-col gap-1.5">
            <div class="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase">
                <span>Ganancia de Entrada</span>
                <span class="text-[#3b82f6] font-mono">{uiStore.inputGain > 0 ? `+${uiStore.inputGain}` : uiStore.inputGain} dB</span>
            </div>
            <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                bind:value={uiStore.inputGain}
                ondblclick={() => uiStore.inputGain = 0}
                class="w-full h-1.5 bg-[#121216] rounded-full appearance-none cursor-pointer accent-[#3b82f6]"
                title="Doble clic para reiniciar a 0dB"
            />
        </div>

        <!-- Slider Offset de Visualización -->
        <div class="flex flex-col gap-1.5">
            <div class="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase">
                <span>Offset de Visualización</span>
                <span class="text-[#eab308] font-mono">{uiStore.displayOffset > 0 ? `+${uiStore.displayOffset}` : uiStore.displayOffset} dB</span>
            </div>
            <input
                type="range"
                min="-100"
                max="100"
                step="1"
                bind:value={uiStore.displayOffset}
                ondblclick={() => uiStore.displayOffset = 0}
                class="w-full h-1.5 bg-[#121216] rounded-full appearance-none cursor-pointer accent-[#eab308]"
                title="Doble clic para reiniciar a 0dB"
            />
        </div>
    </div>

    <!-- PROCESAMIENTO DSP AVANZADO -->
    <div
        class="flex flex-col gap-4 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-xl p-4"
    >
        <div
            class="flex items-center gap-2 border-b border-[#1a1a24]/30 pb-2"
        >
            <span
                class="material-symbols-outlined text-[#ec4899] text-lg"
                >tune</span
            >
            <h3
                class="text-xs font-bold text-gray-300 uppercase tracking-wider"
            >
                Procesamiento DSP
            </h3>
        </div>

        <!-- Ponderación de Frecuencia -->
        <div class="flex flex-col gap-1.5">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >Ponderación (Weighting)</label
            >
            <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                {#each ['Z', 'A', 'B', 'C'] as wt}
                    <button
                        class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                               {uiStore.weightingType === wt
                            ? 'bg-[#ec4899]/15 text-[#ec4899] shadow'
                            : 'text-gray-500 hover:text-gray-300'}"
                        onclick={() => uiStore.weightingType = wt as 'A' | 'B' | 'C' | 'Z'}
                    >
                        {wt}
                    </button>
                {/each}
            </div>
        </div>

        <!-- PPO Smoothing -->
        <div class="flex flex-col gap-1.5">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >Suavizado (PPO Smoothing)</label
            >
            <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                {#each [['0', 'Off'], ['1', '1'], ['3', '1/3'], ['6', '1/6'], ['12', '1/12'], ['24', '1/24'], ['48', '1/48']] as [val, label]}
                    <button
                        class="flex-1 py-1.5 text-[9px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                               {String(uiStore.ppoSmoothing) === val
                            ? 'bg-[#8b5cf6]/15 text-[#8b5cf6] shadow'
                            : 'text-gray-500 hover:text-gray-300'}"
                        onclick={() => uiStore.ppoSmoothing = Number(val)}
                    >
                        {label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- FFT Overlap -->
        <div class="flex flex-col gap-1.5">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >FFT Overlap</label
            >
            <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                {#each [[0, '0%'], [50, '50%'], [75, '75%']] as [val, label]}
                    <button
                        class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                               {uiStore.fftOverlap === val
                            ? 'bg-[#f59e0b]/15 text-[#f59e0b] shadow'
                            : 'text-gray-500 hover:text-gray-300'}"
                        onclick={() => uiStore.fftOverlap = val as 0 | 50 | 75}
                    >
                        {label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Promediado Complejo -->
        <div class="flex flex-col gap-1.5">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >Promediado (Averaging)</label
            >
            <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                {#each [['None', 'Off'], ['FIFO', 'FIFO'], ['EMA', 'EMA'], ['LPF', 'Bessel']] as [val, label]}
                    <button
                        class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                               {uiStore.averagingType === val
                            ? 'bg-[#ec4899]/15 text-[#ec4899] shadow'
                            : 'text-gray-500 hover:text-gray-300'}"
                        onclick={() => uiStore.averagingType = val as 'None' | 'FIFO' | 'EMA' | 'LPF'}
                    >
                        {label}
                    </button>
                {/each}
            </div>
            {#if uiStore.averagingType === 'FIFO'}
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Depth</span>
                    <input
                        type="range" min="2" max="64" step="1"
                        bind:value={uiStore.averagingDepth}
                        ondblclick={() => uiStore.averagingDepth = 16}
                        class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                        title="Doble clic para reiniciar a 16"
                    />
                    <span class="text-[10px] font-mono text-[#ec4899] w-8 text-right">{uiStore.averagingDepth}</span>
                </div>
            {:else if uiStore.averagingType === 'EMA'}
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Alpha</span>
                    <input
                        type="range" min="0.01" max="0.5" step="0.01"
                        bind:value={uiStore.averagingAlpha}
                        ondblclick={() => uiStore.averagingAlpha = 0.1}
                        class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                        title="Doble clic para reiniciar a 0.1"
                    />
                    <span class="text-[10px] font-mono text-[#ec4899] w-10 text-right">{uiStore.averagingAlpha.toFixed(2)}</span>
                </div>
            {:else if uiStore.averagingType === 'LPF'}
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Speed</span>
                    <div class="flex flex-1 bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                        {#each [['Slow', '0.25 Hz'], ['Medium', '0.5 Hz'], ['Fast', '1 Hz']] as [val, label]}
                            <button
                                class="flex-1 py-1 text-[9px] font-bold rounded transition-all cursor-pointer
                                       {uiStore.besselSpeed === val
                                    ? 'bg-[#ec4899]/15 text-[#ec4899] shadow'
                                    : 'text-gray-500 hover:text-gray-300'}"
                                onclick={() => uiStore.besselSpeed = val as 'Slow' | 'Medium' | 'Fast'}
                            >
                                {label}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
            {#if uiStore.averagingType !== 'None'}
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Thresh</span>
                    <input
                        type="range" min="-120" max="-20" step="1"
                        bind:value={uiStore.averagingThresholdDb}
                        ondblclick={() => uiStore.averagingThresholdDb = -60}
                        class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                        title="Doble clic para reiniciar a -60 dBFS"
                    />
                    <span class="text-[10px] font-mono text-[#ec4899] w-12 text-right">
                        {uiStore.averagingThresholdDb} dB
                    </span>
                </div>
            {/if}
        </div>

        <!-- Polarity + Reset Average -->
        <div class="flex items-center gap-2">
            <button
                class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer border
                       {uiStore.polarity
                    ? 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                    : 'bg-[#121216] text-gray-500 border-[#1a1a24]/40 hover:text-gray-300'}"
                onclick={() => uiStore.polarity = !uiStore.polarity}
                title="Inversión de polaridad del canal de medición"
            >
                <span class="text-sm">⊘</span> Polarity
            </button>
            <button
                class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer border
                       bg-[#121216] text-gray-500 border-[#1a1a24]/40 hover:text-gray-300 hover:border-[#ec4899]/30"
                onclick={() => mathOrchestrator.resetAveraging()}
                title="Reiniciar todos los promedios (FIFO + Complex Averaging)"
            >
                <span class="material-symbols-outlined text-sm">restart_alt</span> Reset Avg
            </button>
        </div>

        <!-- Input Filter (como OSM) -->
        <div class="flex flex-col gap-1.5">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >Input Filter</label
            >
            <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                {#each [['None', 'Off'], ['Notch1k', 'Notch 1k'], ['BP100', 'BP 100'], ['LP200', 'LP 200']] as [val, label]}
                    <button
                        class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                               {uiStore.inputFilter === val
                            ? 'bg-[#ec4899]/15 text-[#ec4899] shadow'
                            : 'text-gray-500 hover:text-gray-300'}"
                        onclick={() => uiStore.inputFilter = val as 'None' | 'Notch1k' | 'BP100' | 'LP200'}
                    >
                        {label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Función de Ventana -->
        <div class="flex flex-col gap-1.5">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >Ventana (Window)</label
            >
            <select
                bind:value={uiStore.windowType}
                class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-[#ec4899]"
            >
                {#each ['Rectangular', 'Hann', 'Hamming', 'FlatTop', 'BlackmanHarris', 'HFT223D', 'Exponential'] as wType}
                    <option value={wType}>{wType}</option>
                {/each}
            </select>
        </div>

        <!-- Source Windowing (Time Gate) -->
        <div class="flex flex-col gap-2 pt-2 border-t border-[#1a1a24]/20">
            <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                    type="checkbox"
                    bind:checked={uiStore.enableSourceWindow}
                    class="w-4 h-4 rounded accent-[#ec4899] cursor-pointer"
                />
                <span class="font-semibold select-none">Source Window (Time Gate)</span>
            </label>
            {#if uiStore.enableSourceWindow}
                <div class="flex flex-col gap-2 pl-6">
                    <div class="flex items-center gap-2">
                        <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Width</span>
                        <input
                            type="range" min="0.5" max="50" step="0.5"
                            bind:value={uiStore.sourceWindowWidthMs}
                            ondblclick={() => uiStore.sourceWindowWidthMs = 10.0}
                            class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                        />
                        <span class="text-[10px] font-mono text-[#ec4899] w-14 text-right">{uiStore.sourceWindowWidthMs.toFixed(1)} ms</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Offset</span>
                        <input
                            type="range" min="-20" max="20" step="0.1"
                            bind:value={uiStore.sourceWindowOffsetMs}
                            ondblclick={() => uiStore.sourceWindowOffsetMs = 0}
                            class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                        />
                        <span class="text-[10px] font-mono text-[#ec4899] w-14 text-right">{uiStore.sourceWindowOffsetMs.toFixed(1)} ms</span>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Leq (Nivel Equivalente Continuo) -->
        <div class="flex flex-col gap-2 pt-2 border-t border-[#1a1a24]/20">
            <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                    type="checkbox"
                    bind:checked={uiStore.enableLeq}
                    class="w-4 h-4 rounded accent-[#ec4899] cursor-pointer"
                />
                <span class="font-semibold select-none">Leq (Nivel Equivalente)</span>
            </label>
            {#if uiStore.enableLeq}
                <div class="flex items-center gap-2 pl-6">
                    <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Ventana</span>
                    <input
                        type="range" min="1" max="60" step="1"
                        bind:value={uiStore.leqWindowSeconds}
                        ondblclick={() => uiStore.leqWindowSeconds = 10}
                        class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                    />
                    <span class="text-[10px] font-mono text-[#ec4899] w-10 text-right">{uiStore.leqWindowSeconds} s</span>
                </div>
                <div class="flex items-center gap-2 pl-6">
                    <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Valor</span>
                    <span class="text-sm font-mono font-bold text-[#00ff88]">{uiStore.leqValue.toFixed(1)} dBSPL</span>
                </div>
            {/if}
        </div>

        <!-- FPS y DSP Rate -->
        <div class="flex flex-col gap-2 pt-2 border-t border-[#1a1a24]/20">
            <div class="flex items-center gap-2">
                <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Target FPS</span>
                <input
                    type="range" min="5" max="60" step="5"
                    bind:value={uiStore.targetFps}
                    ondblclick={() => uiStore.targetFps = 30}
                    class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                    title="Doble clic para reiniciar a 30"
                />
                <span class="text-[10px] font-mono text-[#ec4899] w-8 text-right">{uiStore.targetFps}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[9px] text-gray-500 font-bold uppercase w-16">DSP Rate</span>
                <input
                    type="range" min="1" max="10" step="1"
                    bind:value={uiStore.dspUpdateRate}
                    ondblclick={() => uiStore.dspUpdateRate = 2}
                    class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                    title="Doble clic para reiniciar a 2 Hz"
                />
                <span class="text-[10px] font-mono text-[#ec4899] w-10 text-right">{uiStore.dspUpdateRate} Hz</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[9px] text-gray-500 font-bold uppercase w-16">FFT Size</span>
                <select
                    bind:value={uiStore.fftSize}
                    class="flex-1 bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200"
                >
                    {#each [2048, 4096, 8192, 16384, 32768] as size}
                        <option value={size}>{size}</option>
                    {/each}
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Overlap</span>
                <select
                    bind:value={uiStore.fftOverlap}
                    class="flex-1 bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200"
                >
                    <option value={0}>0% (Sin overlap)</option>
                    <option value={0.5}>50%</option>
                    <option value={0.75}>75%</option>
                </select>
            </div>

            <!-- Delay Compensation -->
            <div class="flex flex-col gap-2 pt-2 border-t border-[#1a1a24]/20">
                <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                        type="checkbox"
                        bind:checked={uiStore.autoDelayCompensation}
                        class="w-4 h-4 rounded accent-[#ec4899] cursor-pointer"
                    />
                    <span class="font-semibold select-none">Auto Delay Compensation</span>
                </label>
                {#if !uiStore.autoDelayCompensation}
                    <div class="flex items-center gap-2 pl-6">
                        <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Delay</span>
                        <input
                            type="range" min="0" max="100" step="0.1"
                            bind:value={uiStore.compensationDelayMs}
                            ondblclick={() => uiStore.compensationDelayMs = 0}
                            class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                        />
                        <span class="text-[10px] font-mono text-[#ec4899] w-14 text-right">
                            {uiStore.compensationDelayMs.toFixed(1)} ms
                        </span>
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <!-- AUDIO HARDWARE CARD -->
    <div
        class="flex flex-col gap-4 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-xl p-4"
    >
        <div
            class="flex items-center gap-2 border-b border-[#1a1a24]/30 pb-2"
        >
            <span
                class="material-symbols-outlined text-[#3b82f6] text-lg"
                >speaker_group</span
            >
            <h3
                class="text-xs font-bold text-gray-300 uppercase tracking-wider"
            >
                Hardware de Audio
            </h3>
        </div>

        <!-- Dispositivo de Entrada -->
        <div class="flex flex-col gap-1.5">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >Dispositivo de Entrada</label
            >
            <select
                bind:value={uiStore.audioInDevice}
                class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#3b82f6]"
            >
                {#each inputDevices as dev}
                    <option value={dev.id}>{dev.name}</option>
                {/each}
            </select>
        </div>

        <!-- Dispositivo de Salida -->
        <div class="flex flex-col gap-1.5">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >Dispositivo de Salida</label
            >
            <select
                bind:value={uiStore.audioOutDevice}
                class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#3b82f6]"
            >
                {#each outputDevices as dev}
                    <option value={dev.id}>{dev.name}</option>
                {/each}
            </select>
        </div>
        <!-- Routing Dual-Channel -->
        <div class="flex flex-col gap-3 pt-2 border-t border-[#1a1a24]/20">
            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Routing Dual-Channel
            </span>

            <!-- Canal de Referencia -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Canal de Referencia
                </label>
                <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                    {#each [[-1, 'Loop'], [0, 'Canal 1 (L)'], [1, 'Canal 2 (R)']] as [val, label]}
                        <button
                            class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                   {uiStore.refChannel === val
                                ? 'bg-[#3b82f6]/15 text-[#3b82f6] shadow'
                                : 'text-gray-500 hover:text-gray-300'}"
                            onclick={() => uiStore.refChannel = val as number}
                        >
                            {label}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Canal de Medición -->
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Canal de Medición
                </label>
                <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                    {#each [[0, 'Canal 1 (L)'], [1, 'Canal 2 (R)']] as [val, label]}
                        <button
                            class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                   {uiStore.measChannel === val
                                ? 'bg-[#3b82f6]/15 text-[#3b82f6] shadow'
                                : 'text-gray-500 hover:text-gray-300'}"
                            onclick={() => uiStore.measChannel = val as number}
                        >
                            {label}
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    </div>

    <!-- PANTALLA Y SISTEMA CARD -->
    <div
        class="flex flex-col gap-4 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-xl p-4"
    >
        <div
            class="flex items-center gap-2 border-b border-[#1a1a24]/30 pb-2"
        >
            <span
                class="material-symbols-outlined text-[#00ff88] text-lg"
                >grid_view</span
            >
            <h3
                class="text-xs font-bold text-gray-300 uppercase tracking-wider"
            >
                Pantalla y Preferencias
            </h3>
        </div>

        <!-- Grilla Predeterminada -->
        <div class="flex flex-col gap-2">
            <label
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                >Distribución de Grilla por Defecto</label
            >
            <div class="grid grid-cols-3 gap-2">
                {#each ["1x1", "1x2", "2x1", "2x2", "3x1", "3x2"] as layoutOpt}
                    <button
                        class="flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer min-h-[56px] group
                               {uiStore.layout === layoutOpt
                            ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]'
                            : 'bg-[#121216] border-[#1a1a24] text-gray-400 hover:text-gray-200'}"
                        onclick={() => uiStore.setLayout(layoutOpt)}
                    >
                        <!-- Representación miniatura de la grilla -->
                        <div
                            class="grid gap-[2px] w-6 h-4 mb-1.5 opacity-60 group-hover:opacity-100 transition-opacity"
                            style="grid-template-rows: repeat({parseInt(
                                layoutOpt.split('x')[0],
                            )}, minmax(0, 1fr)); grid-template-columns: repeat({parseInt(
                                layoutOpt.split('x')[1],
                            )}, minmax(0, 1fr));"
                        >
                            {#each Array.from( { length: parseInt(layoutOpt.split("x")[0]) * parseInt(layoutOpt.split("x")[1]) }, ) as _}
                                <div
                                    class="bg-current rounded-[1px] w-full h-full"
                                ></div>
                            {/each}
                        </div>
                        <span
                            class="text-[10px] font-mono font-bold"
                            >{layoutOpt}</span
                        >
                    </button>
                {/each}
            </div>
        </div>

        <!-- Switch de Modo Oscuro -->
        <div
            class="flex justify-between items-center pt-2 border-t border-[#1a1a24]/20"
        >
            <div class="flex flex-col gap-0.5">
                <span class="text-xs font-semibold text-gray-300">Tema Visual</span>
                <span class="text-[10px] text-gray-500">Apariencia de la interfaz</span>
            </div>

            <div class="flex items-center bg-[#121216] border border-[#1a1a24] p-0.5 rounded-lg gap-0.5">
                {#each [
                    { mode: 'system' as const, icon: 'computer', label: 'Auto' },
                    { mode: 'light' as const, icon: 'light_mode', label: 'Claro' },
                    { mode: 'dark' as const, icon: 'dark_mode', label: 'Oscuro' },
                ] as opt}
                    <button
                        class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer
                               {uiStore.themeMode === opt.mode
                            ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
                            : 'text-gray-500 hover:text-gray-300'}"
                        onclick={() => uiStore.setThemeMode(opt.mode)}
                    >
                        <span class="material-symbols-outlined text-[14px]">{opt.icon}</span>
                        {opt.label}
                    </button>
                {/each}
            </div>
        </div>
    </div>
</div>
