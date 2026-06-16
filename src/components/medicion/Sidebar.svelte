<script lang="ts">
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { calibrationStore } from "$lib/stores/calibrationStore.svelte";
    import { getAudioProvider } from "$lib/hal";
    import { onMount, untrack } from "svelte";

    const provider = getAudioProvider();

    let statusText = $state("Listo para medir");
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
    let sampleRate = $state(48000);
    let selectedPreset = $state("all");
    let isOffline = $state(false);
    let downloadFormat = $state("wav");

    // --- ESTADOS DE ECUALIZACIÓN ---
    let eqType = $state(uiStore.eqType); // 'grafico' | 'parametrico' | 'tono'
    $effect(() => {
        uiStore.eqType = eqType;
    });
    $effect(() => {
        eqType = uiStore.eqType;
    });
    let showEQ = $state(true); // Switch Mostrar Ecualización
    let numGraphicBands = $state(10); // 5 | 10 | 15
    let isCalculatingAutoEQ = $state(false);

    interface GraphicBand {
        freq: number;
        gain: number;
    }
    let graphicBands = $state<GraphicBand[]>([
        { freq: 31, gain: 0 },
        { freq: 63, gain: 0 },
        { freq: 125, gain: 0 },
        { freq: 250, gain: 0 },
        { freq: 500, gain: 0 },
        { freq: 1000, gain: 0 },
        { freq: 2000, gain: 0 },
        { freq: 4000, gain: 0 },
        { freq: 8000, gain: 0 },
        { freq: 16000, gain: 0 },
    ]);

    let numParametricFilters = $state(4);
    interface ParametricFilter {
        id: number;
        freq: number;
        gain: number;
        q: number;
        type: string; // 'peaking' | 'lowpass' | 'highpass' | 'shelving' | 'notch' | 'bandpass'
        supportedTypes: string[];
        showConfig: boolean;
    }
    let parametricFilters = $state<ParametricFilter[]>([
        {
            id: 1,
            freq: 80,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: [
                "peaking",
                "lowpass",
                "highpass",
                "shelving",
                "notch",
                "bandpass",
            ],
            showConfig: false,
        },
        {
            id: 2,
            freq: 500,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking", "shelving", "notch"],
            showConfig: false,
        },
        {
            id: 3,
            freq: 2000,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking", "notch"],
            showConfig: false,
        },
        {
            id: 4,
            freq: 8000,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking", "lowpass", "shelving"],
            showConfig: false,
        },
        {
            id: 5,
            freq: 12000,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking", "lowpass"],
            showConfig: false,
        },
        {
            id: 6,
            freq: 16000,
            gain: 0,
            q: 1.0,
            type: "peaking",
            supportedTypes: ["peaking"],
            showConfig: false,
        },
    ]);

    let toneBass = $state(0);
    let toneMid = $state(0);
    let toneTreble = $state(0);

    // Sincronización reactiva con traceManager.eqBands
    $effect(() => {
        if (!showEQ) {
            traceManager.eqBands = [];
            return;
        }

        if (eqType === "grafico") {
            traceManager.eqBands = graphicBands.map((b) => ({
                freq: b.freq,
                gain: b.gain,
                q: 1.414,
                type: "peaking",
            }));
        } else if (eqType === "parametrico") {
            traceManager.eqBands = parametricFilters
                .slice(0, numParametricFilters)
                .map((f) => ({
                    freq: f.freq,
                    gain: f.gain,
                    q: f.q,
                    type: f.type,
                }));
        } else if (eqType === "tono") {
            traceManager.eqBands = [
                { freq: 100, gain: toneBass, q: 0.7, type: "peaking" },
                { freq: 1000, gain: toneMid, q: 0.7, type: "peaking" },
                { freq: 10000, gain: toneTreble, q: 0.7, type: "peaking" },
            ];
        }
    });

    // Ajustar número de bandas en modo gráfico
    $effect(() => {
        let freqs: number[] = [];
        if (numGraphicBands === 5) {
            freqs = [80, 250, 1000, 4000, 12000];
        } else if (numGraphicBands === 10) {
            freqs = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        } else if (numGraphicBands === 15) {
            freqs = [
                25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000,
                6300, 10000, 16000,
            ];
        }
        const currentGraphicBands = untrack(() => graphicBands);
        graphicBands = freqs.map((f) => {
            const prev = currentGraphicBands.find((b) => b.freq === f);
            return { freq: f, gain: prev ? prev.gain : 0 };
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
                parametricFilters
                    .slice(0, numParametricFilters)
                    .forEach((f) => {
                        f.gain = Math.round((Math.random() * 10 - 5) * 10) / 10;
                        f.q = Math.round((0.5 + Math.random() * 2) * 10) / 10;
                    });
            } else if (eqType === "tono") {
                toneBass = Math.round((Math.random() * 8 - 4) * 10) / 10;
                toneMid = Math.round((Math.random() * 6 - 3) * 10) / 10;
                toneTreble = Math.round((Math.random() * 8 - 4) * 10) / 10;
            }
            isCalculatingAutoEQ = false;
            statusText = "AutoEQ calculado con éxito";
        }, 1200);
    }

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

    // Control reactivo del generador en modo manual
    $effect(() => {
        if (uiStore.measurementMode === "manual") {
            provider.playGenerator(
                uiStore.generatorType as any,
                uiStore.genActive,
                uiStore.genFreq,
                uiStore.genLevel,
                uiStore.genRouting,
            );
        } else {
            // Si cambiamos de modo, apagamos el generador
            provider.playGenerator(
                uiStore.generatorType as any,
                false,
                uiStore.genFreq,
                uiStore.genLevel,
                uiStore.genRouting,
            );
            uiStore.genActive = false;
        }
    });

    // Puente reactivo: reaccionar a cambios en uiStore.isMeasuring sin escribirlo
    $effect(() => {
        const shouldMeasure = uiStore.isMeasuring;
        untrack(() => {
            if (shouldMeasure) {
                startMeasurement();
            } else {
                stopMeasurement();
            }
        });
    });

    function stopMeasurement() {
        statusText = "Medición cancelada";
        progress = 0;
        if (uiStore.measurementMode === "manual") {
            provider.stopCapture();
        }

        // Auto-guardar instantánea al detener (F27)
        if (uiStore.autoSaveSnapshotOnStop) {
            captureActiveLive();
        }

        // Apagar generador si está vinculado (F27)
        if (uiStore.linkGeneratorToMeasurement) {
            uiStore.genActive = false;
        }
    }

    async function startMeasurement() {
        // Encender generador si está vinculado (F27)
        if (uiStore.linkGeneratorToMeasurement && !uiStore.genActive) {
            uiStore.genActive = true;
        }

        progress = 0;
        statusText = "Iniciando captura...";
        try {
            if (uiStore.measurementMode === "manual") {
                // Inicializar trazo live en traceManager si no existe
                if (!traceManager.traces.some((t) => t.id === "live-1")) {
                    traceManager.addTrace({
                        id: "live-1",
                        name: "Micrófono en Vivo",
                        type: "live",
                        metric: "RTA",
                        data: new Float32Array(4096),
                        color: "#ff4444",
                        style: "solid",
                        visible: true,
                        offsetY: 0,
                        timestamp: Date.now(),
                        source: "manual",
                    });
                }

                await provider.startCapture({
                    onAudioData: () => {},
                    onFrequencyData: (data) => {
                        traceManager.updateLiveTrace("live-1", data);
                    },
                });
                statusText = "Medición en vivo activa";
            } else {
                statusText = "Ejecutando secuencia...";
                runSequentialSequence();
            }
        } catch (e) {
            console.error(e);
            uiStore.isMeasuring = false;
            statusText = "Error de captura";
        }
    }

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

        for (let i = 0; i < activeSegments.length; i++) {
            if (!uiStore.isMeasuring) break;
            const seg = activeSegments[i];
            statusText = `Midiendo: ${seg.name}...`;

            // Simular adquisición y procesamiento por segmento
            for (let p = 0; p <= 100; p += 20) {
                if (!uiStore.isMeasuring) break;
                progress = Math.round(
                    ((i + p / 100) / activeSegments.length) * 100,
                );
                await new Promise((r) => setTimeout(r, 200));
            }

            if (uiStore.isMeasuring) {
                // Resultado simulado para la UI
                seg.result = `${(Math.random() * 3 - 1.5).toFixed(1)} dB / ${(Math.random() * 10).toFixed(0)} ms`;
            }
        }

        if (uiStore.isMeasuring) {
            uiStore.isMeasuring = false;
            progress = 100;
            statusText = "Secuencia completada con éxito";
        }
    }

    function calculateDelay() {
        statusText = "Calculando retardo de canal...";
        setTimeout(() => {
            manualDelay = Math.round(10 + Math.random() * 25);
            statusText = `Retardo calculado: ${manualDelay} ms`;
        }, 1000);
    }

    function useCalculatedDelay() {
        statusText = `Retardo de ${manualDelay} ms aplicado`;
    }

    // --- LÓGICA PESTAÑAS INSTANTÁNEAS Y CONFIGURACIÓN ---
    let inputDevices = $state<{ id: string; name: string; channels?: number }[]>([]);
    let outputDevices = $state<{ id: string; name: string; channels?: number }[]>([]);
    let isInternalLoopback = $state(uiStore.referenceChannel === "Loopback");

    const activeInDevice = $derived(inputDevices.find(d => d.id === uiStore.audioInDevice));
    const inputChannelsCount = $derived(activeInDevice && activeInDevice.channels ? activeInDevice.channels : 2);

    const activeOutDevice = $derived(outputDevices.find(d => d.id === uiStore.audioOutDevice));
    const outputChannelsCount = $derived(activeOutDevice && activeOutDevice.channels ? activeOutDevice.channels : 2);

    $effect(() => {
        if (isInternalLoopback) {
            uiStore.referenceChannel = "Loopback";
        } else if (uiStore.referenceChannel === "Loopback") {
            uiStore.referenceChannel = "Input 1";
        }
    });

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

    function toggleInputChannel(index: number) {
        if (index >= uiStore.inChannels.length) {
            const newCh = [...uiStore.inChannels];
            while (newCh.length <= index) newCh.push(false);
            newCh[index] = !newCh[index];
            uiStore.inChannels = newCh;
        } else {
            uiStore.inChannels[index] = !uiStore.inChannels[index];
        }
    }

    function toggleOutputChannel(index: number) {
        if (index >= uiStore.outChannels.length) {
            const newCh = [...uiStore.outChannels];
            while (newCh.length <= index) newCh.push(false);
            newCh[index] = !newCh[index];
            uiStore.outChannels = newCh;
        } else {
            uiStore.outChannels[index] = !uiStore.outChannels[index];
        }
    }

    onMount(async () => {
        await loadDevices();

        const stored = localStorage.getItem("asistente_config");
        if (stored) {
            try {
                const config = JSON.parse(stored);
                if (config.layout) uiStore.setLayout(config.layout);
                if (config.isDarkMode !== undefined) {
                    uiStore.isDarkMode = config.isDarkMode;
                    document.documentElement.classList.toggle(
                        "dark",
                        config.isDarkMode,
                    );
                }
                if (config.audioInDevice)
                    uiStore.audioInDevice = config.audioInDevice;
                if (config.audioOutDevice)
                    uiStore.audioOutDevice = config.audioOutDevice;
                if (config.inChannels) uiStore.inChannels = config.inChannels;
                if (config.outChannels)
                    uiStore.outChannels = config.outChannels;
                if (config.referenceChannel) {
                    uiStore.referenceChannel = config.referenceChannel;
                    isInternalLoopback = config.referenceChannel === "Loopback";
                }
            } catch (e) {
                console.error("Error cargando configuración guardada:", e);
            }
        } else {
            uiStore.setLayout("1x1");
        }

        ensureMockSnapshots();
    });

    $effect(() => {
        const dataToSave = {
            layout: uiStore.layout,
            isDarkMode: uiStore.isDarkMode,
            audioInDevice: uiStore.audioInDevice,
            audioOutDevice: uiStore.audioOutDevice,
            inChannels: $state.snapshot(uiStore.inChannels),
            outChannels: $state.snapshot(uiStore.outChannels),
            referenceChannel: uiStore.referenceChannel,
        };
        localStorage.setItem("asistente_config", JSON.stringify(dataToSave));
    });

    // --- INSTANTÁNEAS (SNAPSHOTS) ---
    let sortOrder = $state<"desc" | "asc">("desc");
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

    function ensureMockSnapshots() {
        const existingSnaps = traceManager.instantaneas;
        if (existingSnaps.length === 0) {
            const dataLen = 4096;
            const curve1 = new Float32Array(dataLen);
            const curve2 = new Float32Array(dataLen);
            for (let i = 0; i < dataLen; i++) {
                const f = 20 * Math.pow(1000, i / dataLen);
                const baseDb = -30 - 10 * Math.log10(f / 100);
                const ripple1 =
                    5 *
                    Math.sin(Math.log2(f) * 2 * Math.PI) *
                    Math.cos(f / 3000);
                const ripple2 =
                    8 * Math.cos(Math.log10(f) * 4 * Math.PI) +
                    (f > 8000 ? -15 : 0);
                curve1[i] = Math.max(
                    -120,
                    Math.min(
                        10,
                        baseDb + ripple1 + (Math.random() * 1.5 - 0.75),
                    ),
                );
                curve2[i] = Math.max(
                    -120,
                    Math.min(
                        10,
                        baseDb + ripple2 - 5 + (Math.random() * 2 - 1),
                    ),
                );
            }

            traceManager.instantaneas.push({
                id: "snap-mock-1",
                name: "Respuesta Sala A - Monitor L",
                timestamp: Date.now() - 60000 * 5,
                data: {
                    "Magnitude": curve1,
                    "Phase": new Float32Array(dataLen).map((_, i) => -180 + (i / dataLen) * 360),
                    "Coherence": new Float32Array(dataLen).fill(0.95)
                },
                visible: true,
                color: "#a855f7",
                source: "manual",
                metric: "Magnitude",
                offsetY: 0
            });

            traceManager.instantaneas.push({
                id: "snap-mock-2",
                name: "Respuesta Sala A - Subwoofer",
                timestamp: Date.now() - 3600000 * 3,
                data: {
                    "Magnitude": curve2,
                    "Phase": new Float32Array(dataLen).map((_, i) => -180 + (i / dataLen) * 360),
                    "Coherence": new Float32Array(dataLen).fill(0.85)
                },
                visible: false,
                color: "#f59e0b",
                source: "secuencial",
                metric: "Magnitude",
                offsetY: -5
            });
        }
    }

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

<aside
    class="w-[380px] h-full bg-[#0a0a0c] border-r border-[#1a1a24]/50 flex flex-col text-gray-200 select-none"
>
    <!-- CABECERA DE PESTAÑAS Y CONTROL (PROMPT 11) -->
    <div class="flex items-center bg-[#050507] border-b border-[#1a1a24]/50 px-2 py-1.5 gap-0.5 h-[60px] flex-shrink-0">
        <nav class="flex-1 flex items-center gap-0.5">
            {#each [
                { id: 'medicion', icon: 'podcasts', label: 'Med' },
                { id: 'eq', icon: 'cadence', label: 'EQ' },
                { id: 'snaps', icon: 'photo_camera', label: 'Inst' },
                { id: 'config', icon: 'settings', label: 'Cfg' },
            ] as tab}
                <button
                    class="flex-1 h-[48px] rounded-lg flex flex-col items-center justify-center transition-all duration-200 cursor-pointer gap-0.5
                           {uiStore.activeTab === tab.id
                        ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
                    onclick={() => (uiStore.activeTab = tab.id)}
                    title={tab.label}
                >
                    <span class="material-symbols-outlined text-[20px]">{tab.icon}</span>
                    <span class="text-[8px] font-bold uppercase tracking-wider leading-none">{tab.label}</span>
                </button>
            {/each}
        </nav>
    </div>

    <!-- Contenido Principal del Sidebar -->
    <div class="flex-1 h-full overflow-hidden flex flex-col bg-[#0a0a0c]">
        {#if uiStore.activeTab === "medicion"}
            <div
                class="flex-1 p-5 overflow-y-auto flex flex-col gap-5"
                id="panel-medicion"
            >
                <!-- Selector de Modo (Segmented Control) -->
                <div
                    class="flex bg-[#121216] p-1 rounded-lg border border-[#1a1a24]/50"
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
                        <!-- AUTOMATIZACIÓN DE MEDICIÓN (F27) -->
                        <div class="flex flex-col gap-2 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-xl p-3 mt-3">
                            <div class="flex items-center gap-2 border-b border-[#1a1a24]/30 pb-1.5">
                                <span class="material-symbols-outlined text-[#a855f7] text-sm">bolt</span>
                                <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Automatización</h3>
                            </div>

                            <label class="flex items-center gap-2.5 cursor-pointer group py-1">
                                <input
                                    type="checkbox"
                                    bind:checked={uiStore.autoSaveSnapshotOnStop}
                                    class="w-4 h-4 rounded accent-[#a855f7] cursor-pointer"
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
                                    class="w-4 h-4 rounded accent-[#a855f7] cursor-pointer"
                                />
                                <div class="flex flex-col">
                                    <span class="text-xs text-gray-200 font-semibold group-hover:text-white transition-colors select-none">
                                        Vincular Generador al medir
                                    </span>
                                    <span class="text-[9px] text-gray-500">
                                        Enciende/apaga el generador junto con la medición
                                    </span>
                                </div>
                            </label>
                        </div>

                        <!-- Dropdown Generador -->
                        <div class="flex flex-col gap-1.5">
                            <label
                                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                                >Generador</label
                            >
                            <select
                                bind:value={uiStore.generatorType}
                                class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#3b82f6]"
                            >
                                <option value="pink">Ruido Rosa</option>
                                <option value="white">Ruido Blanco</option>
                                <option value="brown">Ruido Brown</option>
                                <option value="music">Music-noise</option>
                                <option value="sine">Seno continuo</option>
                                <option value="sweep">Sweep logarítmico</option>
                                <option value="burst">Burst</option>
                                <option value="sinburst">SinBurst</option>
                                <option value="mls">MLS+</option>
                            </select>
                        </div>

                        <!-- Opciones Dinámicas Reactivas -->
                        <div
                            class="bg-[#121216]/50 border border-[#1a1a24]/30 rounded-lg p-3 flex flex-col gap-3"
                        >
                            {#if uiStore.generatorType === "sine"}
                                <div class="flex flex-col gap-1">
                                    <label
                                        class="text-[10px] font-bold text-gray-500 uppercase"
                                        >Frecuencia (Hz)</label
                                    >
                                    <input
                                        type="number"
                                        bind:value={uiStore.genFreq}
                                        min="10"
                                        max="22000"
                                        class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[#3b82f6]"
                                    />
                                </div>
                            {:else if uiStore.generatorType === "sweep"}
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="flex flex-col gap-1">
                                        <label
                                            class="text-[10px] font-bold text-gray-500 uppercase"
                                            >Inicio (Hz)</label
                                        >
                                        <input
                                            type="number"
                                            bind:value={sweepF1}
                                            class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                                        />
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label
                                            class="text-[10px] font-bold text-gray-500 uppercase"
                                            >Fin (Hz)</label
                                        >
                                        <input
                                            type="number"
                                            bind:value={sweepF2}
                                            class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                                        />
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label
                                        class="text-[10px] font-bold text-gray-500 uppercase"
                                        >Duración (seg)</label
                                    >
                                    <input
                                        type="number"
                                        bind:value={sweepDuration}
                                        class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                                    />
                                </div>
                            {:else if uiStore.generatorType === "burst" || uiStore.generatorType === "sinburst"}
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="flex flex-col gap-1">
                                        <label
                                            class="text-[10px] font-bold text-gray-500 uppercase"
                                            >Duración (ms)</label
                                        >
                                        <input
                                            type="number"
                                            bind:value={burstDuration}
                                            class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                                        />
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label
                                            class="text-[10px] font-bold text-gray-500 uppercase"
                                            >Período (ms)</label
                                        >
                                        <input
                                            type="number"
                                            bind:value={burstPeriod}
                                            class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                                        />
                                    </div>
                                </div>
                            {:else if uiStore.generatorType === "mls"}
                                <div class="flex flex-col gap-1">
                                    <label
                                        class="text-[10px] font-bold text-gray-500 uppercase"
                                        >Orden MLS</label
                                    >
                                    <select
                                        bind:value={mlsOrder}
                                        class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200"
                                    >
                                        {#each Array.from({ length: 7 }, (_, i) => i + 10) as order}
                                            <option value={order}
                                                >Nivel {order} ({Math.pow(
                                                    2,
                                                    order,
                                                ) - 1} pts)</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            {:else}
                                <span class="text-xs text-gray-500 italic"
                                    >No se requieren parámetros dinámicos para
                                    esta señal.</span
                                >
                            {/if}

                            <!-- Ruteo de Salida -->
                            <div class="flex flex-col gap-1">
                                <label
                                    class="text-[10px] font-bold text-gray-500 uppercase"
                                    >Canal de Salida</label
                                >
                                <select
                                    bind:value={uiStore.genRouting}
                                    class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1.5 text-xs text-gray-200"
                                >
                                    <option value="Stereo">Estéreo</option>
                                    <option value="L">Solo Izquierdo (L)</option>
                                    <option value="R">Solo Derecho (R)</option>
                                </select>
                            </div>
                        </div>

                        <!-- Slider Nivel -->
                        <div class="flex flex-col gap-1.5">
                            <div class="flex justify-between items-center">
                                <label
                                    class="text-[10px] font-bold text-gray-500 uppercase"
                                    >Nivel de Señal</label
                                >
                                <span
                                    class="text-xs font-mono font-bold text-[#3b82f6]"
                                    >{uiStore.genLevel} dBFS</span
                                >
                            </div>
                            <input
                                type="range"
                                min="-60"
                                max="10"
                                bind:value={uiStore.genLevel}
                                class="w-full h-1.5 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                            />
                        </div>

                        <!-- Botones de Generar / Detener -->
                        <div class="flex gap-2">
                            <button
                                class="flex-1 min-h-[44px] bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981]/25 border border-[#10b981]/30 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
                                onclick={() => (uiStore.genActive = true)}
                            >
                                <span class="material-symbols-outlined text-sm"
                                    >volume_up</span
                                >
                                Generar
                            </button>
                            <button
                                class="flex-1 min-h-[44px] bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25 border border-[#ef4444]/30 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
                                onclick={() => (uiStore.genActive = false)}
                            >
                                <span class="material-symbols-outlined text-sm"
                                    >volume_mute</span
                                >
                                Detener
                            </button>
                        </div>

                        <div class="border-t border-[#1a1a24]/30 my-2"></div>

                        <!-- Sección Retardo -->
                        <div class="flex flex-col gap-2">
                            <label
                                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                                >Alineación de Retardo</label
                            >
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
                                    bind:value={sampleRate}
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
                                    <option value="custom">Personalizado</option
                                    >
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
        {:else if uiStore.activeTab === "eq"}
            <div
                class="flex-1 p-5 overflow-y-auto flex flex-col gap-5"
                id="panel-eq"
            >
                <!-- Controles Superiores -->
                <div
                    class="flex flex-col gap-3 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-lg p-4"
                >
                    <div class="flex justify-between items-center">
                        <label
                            class="text-xs font-semibold text-gray-300 cursor-pointer"
                            for="eq-toggle"
                        >
                            Habilitar Ecualización
                        </label>
                        <input
                            id="eq-toggle"
                            type="checkbox"
                            bind:checked={showEQ}
                            class="accent-[#00ff88] w-4 h-4 cursor-pointer"
                        />
                    </div>

                    <button
                        class="w-full min-h-[38px] bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 border border-[#00ff88]/20 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                        onclick={runAutoEQ}
                        disabled={!showEQ || isCalculatingAutoEQ}
                    >
                        <span class="material-symbols-outlined text-sm"
                            >{isCalculatingAutoEQ
                                ? "sync"
                                : "auto_awesome"}</span
                        >
                        {isCalculatingAutoEQ
                            ? "Procesando AutoEQ..."
                            : "Calcular Ecualización (AutoEQ)"}
                    </button>
                </div>

                {#if showEQ}
                    <!-- Selector de Tipo de Ecualizador -->
                    <div class="flex flex-col gap-1.5">
                        <label
                            class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                            >Tipo de Ecualizador</label
                        >
                        <select
                            bind:value={eqType}
                            class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#3b82f6]"
                        >
                            <option value="grafico">Ecualizador Gráfico</option>
                            <option value="parametrico"
                                >Ecualizador Paramétrico</option
                            >
                            <option value="tono">Control de Tono</option>
                        </select>
                    </div>

                    <!-- MODO GRÁFICO -->
                    {#if eqType === "grafico"}
                        <div class="flex flex-col gap-4">
                            <div
                                class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5"
                            >
                                <label class="text-xs text-gray-400"
                                    >Cantidad de bandas</label
                                >
                                <select
                                    bind:value={numGraphicBands}
                                    class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
                                >
                                    <option value={5}>5 Bandas</option>
                                    <option value={10}>10 Bandas</option>
                                    <option value={15}>15 Bandas</option>
                                </select>
                            </div>

                            <div
                                class="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1"
                            >
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
                            <div
                                class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5"
                            >
                                <label class="text-xs text-gray-400"
                                    >Cantidad de filtros</label
                                >
                                <select
                                    bind:value={numParametricFilters}
                                    class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200"
                                >
                                    {#each Array.from({ length: 6 }, (_, i) => i + 1) as fNum}
                                        <option value={fNum}
                                            >{fNum}
                                            {fNum === 1
                                                ? "Filtro"
                                                : "Filtros"}</option
                                        >
                                    {/each}
                                </select>
                            </div>

                            <div
                                class="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1"
                            >
                                {#each parametricFilters.slice(0, numParametricFilters) as filter}
                                    <div
                                        class="border border-[#1a1a24] bg-[#121216]/20 rounded-lg p-3 flex flex-col gap-3"
                                    >
                                        <div
                                            class="flex justify-between items-center"
                                        >
                                            <span
                                                class="text-xs font-bold text-[#3b82f6]"
                                                >Filtro {filter.id}</span
                                            >

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
                                                        {#each ["peaking", "lowpass", "highpass", "shelving", "notch", "bandpass"] as type}
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
                                                                                        (
                                                                                            t,
                                                                                        ) =>
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
                                                                {type ===
                                                                "peaking"
                                                                    ? "Campana"
                                                                    : type ===
                                                                        "lowpass"
                                                                      ? "Paso Bajo"
                                                                      : type ===
                                                                          "highpass"
                                                                        ? "Paso Alto"
                                                                        : type ===
                                                                            "shelving"
                                                                          ? "Shelving"
                                                                          : type ===
                                                                              "notch"
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
                                            <div
                                                class="flex flex-col gap-1 col-span-2"
                                            >
                                                <label
                                                    class="text-[9px] text-gray-500 font-bold uppercase"
                                                    >Tipo de Filtro</label
                                                >
                                                <select
                                                    bind:value={filter.type}
                                                    class="w-full bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200"
                                                >
                                                    {#each filter.supportedTypes as type}
                                                        <option value={type}>
                                                            {type === "peaking"
                                                                ? "Campana (Peaking)"
                                                                : type ===
                                                                    "lowpass"
                                                                  ? "Paso Bajo (Lowpass)"
                                                                  : type ===
                                                                      "highpass"
                                                                    ? "Paso Alto (Highpass)"
                                                                    : type ===
                                                                        "shelving"
                                                                      ? "Shelving"
                                                                      : type ===
                                                                          "notch"
                                                                        ? "Notch"
                                                                        : "Paso Banda (Bandpass)"}
                                                        </option>
                                                    {/each}
                                                </select>
                                            </div>

                                            <!-- Frecuencia (Prompt 7) -->
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

                                            <!-- Q (ancho de banda) (Prompt 7) -->
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

                                            <!-- Ganancia (Solo si es peaking/shelving) (Prompt 7) -->
                                            {#if ["peaking", "shelving"].includes(filter.type)}
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
                        </div>
                    {/if}

                    <!-- MODO TONO -->
                    {#if eqType === "tono"}
                        <div
                            class="flex flex-col gap-4 bg-[#121216]/20 border border-[#1a1a24] rounded-lg p-4"
                        >
                            <div class="flex flex-col gap-1.5">
                                <div
                                    class="flex justify-between text-xs font-bold text-gray-300"
                                >
                                    <span>Graves (Bass)</span>
                                    <span class="font-mono text-[#3b82f6]"
                                        >{toneBass} dB</span
                                    >
                                </div>
                                <input
                                    type="range"
                                    min="-12"
                                    max="12"
                                    step="0.5"
                                    bind:value={toneBass}
                                    class="w-full h-1.5 bg-[#121216] appearance-none cursor-pointer accent-[#3b82f6] rounded-full"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <div
                                    class="flex justify-between text-xs font-bold text-gray-300"
                                >
                                    <span>Medios (Mid)</span>
                                    <span class="font-mono text-[#3b82f6]"
                                        >{toneMid} dB</span
                                    >
                                </div>
                                <input
                                    type="range"
                                    min="-12"
                                    max="12"
                                    step="0.5"
                                    bind:value={toneMid}
                                    class="w-full h-1.5 bg-[#121216] appearance-none cursor-pointer accent-[#3b82f6] rounded-full"
                                />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <div
                                    class="flex justify-between text-xs font-bold text-gray-300"
                                >
                                    <span>Agudos (Treble)</span>
                                    <span class="font-mono text-[#3b82f6]"
                                        >{toneTreble} dB</span
                                    >
                                </div>
                                <input
                                    type="range"
                                    min="-12"
                                    max="12"
                                    step="0.5"
                                    bind:value={toneTreble}
                                    class="w-full h-1.5 bg-[#121216] appearance-none cursor-pointer accent-[#3b82f6] rounded-full"
                                />
                            </div>
                        </div>
                    {/if}
                {:else}
                    <div
                        class="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-[#1a1a24] rounded-lg bg-[#121216]/5"
                    >
                        <span
                            class="material-symbols-outlined text-gray-600 text-3xl mb-2"
                            >equalizer</span
                        >
                        <p class="text-xs text-gray-500">
                            Active el switch superior para habilitar el
                            procesamiento de ecualización y simular la curva
                            predictiva.
                        </p>
                    </div>
                {/if}

                <!-- BOTÓN ANCLADO AL FONDO -->
                <div
                    class="mt-auto pt-4 border-t border-[#1a1a24]/50 flex flex-col gap-2"
                >
                    <button
                        class="w-full min-h-[48px] border transition-all duration-300 rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg
                               {uiStore.isSimulating
                            ? 'bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border-[#3b82f6]/30 text-[#3b82f6]'
                            : 'bg-transparent hover:bg-white/5 border-white/10 text-gray-400'}"
                        onclick={() =>
                            (uiStore.isSimulating = !uiStore.isSimulating)}
                    >
                        <span class="material-symbols-outlined"
                            >{uiStore.isSimulating
                                ? "analytics"
                                : "insights"}</span
                        >
                        {uiStore.isSimulating
                            ? "Detener Simulación"
                            : "Simular Respuesta"}
                    </button>
                </div>
            </div>
        {:else if uiStore.activeTab === "snaps"}
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

                    <!-- Configuración de métricas a capturar en paralelo -->
                    <div class="flex flex-col gap-2 bg-[#121216]/40 border border-[#1a1a24]/30 rounded-lg p-3 select-none">
                        <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Métricas a capturar en paralelo:</span>
                        <div class="grid grid-cols-2 gap-2 mt-1">
                            {#each Object.keys(traceManager.metricsToCapture) as metric}
                                <label class="flex items-center gap-1.5 text-[10px] text-gray-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        bind:checked={traceManager.metricsToCapture[metric]}
                                        class="accent-[#a855f7] scale-90"
                                    />
                                    <span>{metric === 'GroupDelay' ? 'Group Delay' : metric}</span>
                                </label>
                            {/each}
                        </div>
                    </div>

                    <!-- Botón Capturar Instantánea Rápida -->
                    <button
                        class="w-full min-h-[40px] bg-gradient-to-r from-[#a855f7] to-[#8b5cf6] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all duration-300 border border-[#a855f7]/20"
                        onclick={captureActiveLive}
                    >
                        <span class="material-symbols-outlined text-sm"
                            >photo_camera</span
                        >
                        Capturar Instantánea
                    </button>

                    <!-- Importar archivo local .snapshot.json (Prompt 8) -->
                    <div class="flex flex-col gap-1.5 border-t border-[#1a1a24]/20 pt-2.5">
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
                            <span class="material-symbols-outlined text-sm">upload_file</span>
                            Importar .snapshot.json
                        </label>
                    </div>

                    <!-- Ordenación y Configuración -->
                    <div
                        class="flex justify-between items-center gap-3 pt-2 border-t border-[#1a1a24]/20"
                    >
                        <label
                            class="text-[10px] text-gray-500 font-bold uppercase"
                            >Ordenar por fecha</label
                        >
                        <div
                            class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40"
                        >
                            <button
                                class="px-2 py-1 text-[10px] font-semibold rounded transition-all cursor-pointer min-h-[24px]
                                       {sortOrder === 'desc'
                                    ? 'bg-[#a855f7] text-white shadow'
                                    : 'text-gray-400 hover:text-gray-200'}"
                                onclick={() => (sortOrder = "desc")}
                            >
                                Recientes
                            </button>
                            <button
                                class="px-2 py-1 text-[10px] font-semibold rounded transition-all cursor-pointer min-h-[24px]
                                       {sortOrder === 'asc'
                                    ? 'bg-[#a855f7] text-white shadow'
                                    : 'text-gray-400 hover:text-gray-200'}"
                                onclick={() => (sortOrder = "asc")}
                            >
                                Antiguos
                            </button>
                        </div>
                    </div>
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
                                    Mida una señal y captúrela, o haga clic
                                    abajo para restaurar datos simulados de
                                    referencia.
                                </p>
                            </div>
                            <button
                                class="min-h-[32px] px-3 bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20 hover:bg-[#a855f7]/20 rounded-md text-[10px] font-bold cursor-pointer transition-all"
                                onclick={ensureMockSnapshots}
                            >
                                Cargar Curvas de Prueba
                            </button>
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
                                                    traceManager.removeTrace(
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
        {:else if uiStore.activeTab === "config"}
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

                    <!-- Promediado Complejo -->
                    <div class="flex flex-col gap-1.5">
                        <label
                            class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                            >Promediado (Averaging)</label
                        >
                        <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
                            {#each ['None', 'FIFO', 'LPF'] as avgType}
                                <button
                                    class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                                           {uiStore.averagingType === avgType
                                        ? 'bg-[#ec4899]/15 text-[#ec4899] shadow'
                                        : 'text-gray-500 hover:text-gray-300'}"
                                    onclick={() => uiStore.averagingType = avgType as 'None' | 'FIFO' | 'LPF'}
                                >
                                    {avgType}
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
                        {:else if uiStore.averagingType === 'LPF'}
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
                        {/if}
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

                    <!-- Habilitar Canales de Entrada -->
                    <div class="flex flex-col gap-1.5">
                        <label
                            class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                            >Canales de Entrada Activos</label
                        >
                        <div class="grid grid-cols-4 gap-2">
                            {#each Array.from({ length: inputChannelsCount }) as _, chIdx}
                                <button
                                    class="py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer min-h-[36px]
                                           {uiStore.inChannels[chIdx]
                                        ? 'bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6] shadow'
                                        : 'bg-[#121216] border-[#1a1a24] text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
                                    onclick={() => toggleInputChannel(chIdx)}
                                >
                                    CH {chIdx + 1}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <!-- Habilitar Canales de Salida -->
                    <div class="flex flex-col gap-1.5">
                        <label
                            class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                            >Canales de Salida Activos</label
                        >
                        <div class="grid grid-cols-4 gap-2">
                            {#each Array.from({ length: outputChannelsCount }) as _, chIdx}
                                <button
                                    class="py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer min-h-[36px]
                                           {uiStore.outChannels[chIdx]
                                        ? 'bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6] shadow'
                                        : 'bg-[#121216] border-[#1a1a24] text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
                                    onclick={() => toggleOutputChannel(chIdx)}
                                >
                                    CH {chIdx + 1}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <!-- Canal de Referencia & Loopback -->
                    <div
                        class="grid grid-cols-2 gap-3 pt-2 border-t border-[#1a1a24]/20 items-center"
                    >
                        <div class="flex flex-col gap-1.5">
                            <label
                                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                                >Canal de Referencia</label
                            >
                            <select
                                bind:value={uiStore.referenceChannel}
                                disabled={isInternalLoopback}
                                class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-[#3b82f6] disabled:opacity-40"
                            >
                                <option value="Input 1">Entrada 1 (L)</option>
                                <option value="Input 2">Entrada 2 (R)</option>
                                <option value="Input 3">Entrada 3</option>
                                <option value="Input 4">Entrada 4</option>
                                <option value="Loopback"
                                    >Loopback interno</option
                                >
                            </select>
                        </div>

                        <div class="flex flex-col gap-1.5 justify-end h-full">
                            <label
                                class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer py-2"
                            >
                                <input
                                    type="checkbox"
                                    bind:checked={isInternalLoopback}
                                    class="w-4 h-4 rounded border-[#1a1a24] bg-[#121216] text-[#3b82f6] accent-[#3b82f6] cursor-pointer"
                                />
                                <span class="font-semibold select-none"
                                    >Loopback interno</span
                                >
                            </label>
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
                                    <!-- Representación miniatura ultra-precisa de la grilla [filas]x[columnas] -->
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
                            <span class="text-xs font-semibold text-gray-300"
                                >Tema Visual</span
                            >
                            <span class="text-[10px] text-gray-500"
                                >Alterna entre Modo Oscuro y Claro</span
                            >
                        </div>

                        <!-- Custom Theme Selector Toggle -->
                        <button
                            class="flex items-center gap-1.5 bg-[#121216] border border-[#1a1a24] p-1 rounded-lg cursor-pointer transition-all duration-200 min-h-[32px]"
                            onclick={() => uiStore.toggleTheme()}
                        >
                            <span
                                class="p-1 rounded-md flex items-center justify-center transition-all duration-200
                                         {!uiStore.isDarkMode
                                    ? 'bg-amber-500/10 text-amber-500 font-bold'
                                    : 'text-gray-500'}"
                                title="Modo Claro"
                            >
                                <span
                                    class="material-symbols-outlined text-[16px]"
                                    >light_mode</span
                                >
                            </span>
                            <span
                                class="p-1 rounded-md flex items-center justify-center transition-all duration-200
                                         {uiStore.isDarkMode
                                    ? 'bg-[#3b82f6]/10 text-[#3b82f6] font-bold'
                                    : 'text-gray-500'}"
                                title="Modo Oscuro"
                            >
                                <span
                                    class="material-symbols-outlined text-[16px]"
                                    >dark_mode</span
                                >
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</aside>
