<script lang="ts">
    import { uiStore } from '$lib/stores/ui.svelte';
    import { traceManager } from '$lib/stores/traceManager.svelte';
    import { getAudioProvider } from '$lib/hal';
    import { onMount, untrack } from 'svelte';

    const provider = getAudioProvider();

    let activeTab = $state('medicion'); // 'medicion' | 'eq' | 'snaps' | 'config'

    // Estado global de medición
    let mode = $state('manual'); // 'manual' | 'secuencial'
    let isMeasuring = $state(false);
    let isCapturing = $state(false);
    let statusText = $state('Listo para medir');
    let progress = $state(0);

    // --- MODO MANUAL ---
    let generatorType = $state('pink'); // 'pink' | 'white' | 'brown' | 'music-noise' | 'sine' | 'sweep' | 'burst' | 'sinburst' | 'mls'
    let genActive = $state(false);
    let genFreq = $state(1000);
    let genLevel = $state(0);
    let genRouting = $state<'L' | 'R' | 'Stereo'>('Stereo');
    let manualDelay = $state(0); // en ms

    // Opciones del Sweep
    let sweepF1 = $state(20);
    let sweepF2 = $state(20000);
    let sweepDuration = $state(5);

    // Opciones del Burst
    let burstDuration = $state(500);
    let burstPeriod = $state(1000);

    // Opciones del MLS
    let mlsOrder = $state(15);

    // --- MODO SECUENCIAL ---
    let sampleRate = $state(48000);
    let selectedPreset = $state('all');
    let isOffline = $state(false);
    let downloadFormat = $state('wav');

    // --- ESTADOS DE ECUALIZACIÓN ---
    let eqType = $state('grafico'); // 'grafico' | 'parametrico' | 'tono'
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
        { freq: 16000, gain: 0 }
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
        { id: 1, freq: 80, gain: 0, q: 1.0, type: 'peaking', supportedTypes: ['peaking', 'lowpass', 'highpass', 'shelving', 'notch', 'bandpass'], showConfig: false },
        { id: 2, freq: 500, gain: 0, q: 1.0, type: 'peaking', supportedTypes: ['peaking', 'shelving', 'notch'], showConfig: false },
        { id: 3, freq: 2000, gain: 0, q: 1.0, type: 'peaking', supportedTypes: ['peaking', 'notch'], showConfig: false },
        { id: 4, freq: 8000, gain: 0, q: 1.0, type: 'peaking', supportedTypes: ['peaking', 'lowpass', 'shelving'], showConfig: false },
        { id: 5, freq: 12000, gain: 0, q: 1.0, type: 'peaking', supportedTypes: ['peaking', 'lowpass'], showConfig: false },
        { id: 6, freq: 16000, gain: 0, q: 1.0, type: 'peaking', supportedTypes: ['peaking'], showConfig: false }
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

        if (eqType === 'grafico') {
            traceManager.eqBands = graphicBands.map(b => ({
                freq: b.freq,
                gain: b.gain,
                q: 1.414,
                type: 'peaking'
            }));
        } else if (eqType === 'parametrico') {
            traceManager.eqBands = parametricFilters.slice(0, numParametricFilters).map(f => ({
                freq: f.freq,
                gain: f.gain,
                q: f.q,
                type: f.type
            }));
        } else if (eqType === 'tono') {
            traceManager.eqBands = [
                { freq: 100, gain: toneBass, q: 0.7, type: 'peaking' },
                { freq: 1000, gain: toneMid, q: 0.7, type: 'peaking' },
                { freq: 10000, gain: toneTreble, q: 0.7, type: 'peaking' }
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
            freqs = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];
        }
        const currentGraphicBands = untrack(() => graphicBands);
        graphicBands = freqs.map(f => {
            const prev = currentGraphicBands.find(b => b.freq === f);
            return { freq: f, gain: prev ? prev.gain : 0 };
        });
    });


    function runAutoEQ() {
        isCalculatingAutoEQ = true;
        statusText = 'Calculando curva de corrección AutoEQ...';
        setTimeout(() => {
            if (eqType === 'grafico') {
                graphicBands.forEach(b => {
                    b.gain = Math.round((Math.random() * 12 - 6) * 10) / 10;
                });
            } else if (eqType === 'parametrico') {
                parametricFilters.slice(0, numParametricFilters).forEach(f => {
                    f.gain = Math.round((Math.random() * 10 - 5) * 10) / 10;
                    f.q = Math.round((0.5 + Math.random() * 2) * 10) / 10;
                });
            } else if (eqType === 'tono') {
                toneBass = Math.round((Math.random() * 8 - 4) * 10) / 10;
                toneMid = Math.round((Math.random() * 6 - 3) * 10) / 10;
                toneTreble = Math.round((Math.random() * 8 - 4) * 10) / 10;
            }
            isCalculatingAutoEQ = false;
            statusText = 'AutoEQ calculado con éxito';
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
        { id: 'V', name: 'Ganancia de Entrada (V)', desc: 'Calibración de Ganancia e Impedancia de Entrada', checked: true },
        { id: 'A', name: 'Respuesta Tonal (A)', desc: 'Espectro de Ruido Rosa e Integridad Acústica', checked: true },
        { id: 'M', name: 'Graves profundos (M)', desc: 'Brown Noise para análisis de Subwoofers', checked: true },
        { id: 'N', name: 'Altas Frecuencias (N)', desc: 'Ruido Blanco para respuesta de Brillo', checked: true },
        { id: 'F', name: 'Barrido Logarítmico (F)', desc: 'Sweep de Frecuencia y Respuesta al Impulso', checked: true },
        { id: 'P', name: 'Alineación de Fase (P)', desc: 'Fase Acústica y Polaridad de Altavoces', checked: true },
        { id: 'T', name: 'Decaimiento RT60 (T)', desc: 'Tiempo de Decaimiento y Reverberación Acústica', checked: true },
        { id: 'D', name: 'Distorsión Armónica (D)', desc: 'THD por Frecuencia', checked: true },
        { id: 'X', name: 'Separación Estéreo (X)', desc: 'Diafonía (Crosstalk) entre canales izquierdo/derecho', checked: true },
        { id: 'R', name: 'Reflexiones de Sala (R)', desc: 'Reflexiones Tempranas e Impulso Secundario', checked: true }
    ]);

    // Aplicar preset
    $effect(() => {
        if (selectedPreset === 'all') {
            segments.forEach(s => s.checked = true);
        } else if (selectedPreset === 'fast') {
            segments.forEach(s => s.checked = ['V', 'A', 'F'].includes(s.id));
        } else if (selectedPreset === 'bass') {
            segments.forEach(s => s.checked = ['V', 'M', 'P'].includes(s.id));
        }
    });

    // Control reactivo del generador en modo manual
    $effect(() => {
        if (mode === 'manual') {
            // @ts-ignore
            provider.playGenerator(generatorType, genActive, genFreq, genLevel, genRouting);
        } else {
            // Si cambiamos de modo, apagamos el generador
            // @ts-ignore
            provider.playGenerator(generatorType, false, genFreq, genLevel, genRouting);
            genActive = false;
        }
    });

    async function toggleMeasurement() {
        if (isMeasuring) {
            isMeasuring = false;
            statusText = 'Medición cancelada';
            progress = 0;
            if (mode === 'manual') {
                provider.stopCapture();
                isCapturing = false;
            }
        } else {
            isMeasuring = true;
            progress = 0;
            statusText = 'Iniciando captura...';
            try {
                if (mode === 'manual') {
                    // Inicializar trazo live en traceManager si no existe
                    if (!traceManager.traces.some(t => t.id === 'live-1')) {
                        traceManager.addTrace({
                            id: 'live-1',
                            name: 'Micrófono en Vivo',
                            type: 'live',
                            metric: 'RTA',
                            data: new Float32Array(4096),
                            color: '#ff4444',
                            style: 'solid',
                            visible: true,
                            offsetY: 0,
                            timestamp: Date.now(),
                            source: 'manual'
                        });
                    }

                    await provider.startCapture({
                        onAudioData: () => {},
                        onFrequencyData: (data) => {
                            traceManager.updateLiveTrace('live-1', data);
                        }
                    });
                    isCapturing = true;
                    statusText = 'Medición en vivo activa';
                } else {
                    statusText = 'Ejecutando secuencia...';
                    runSequentialSequence();
                }
            } catch (e) {
                console.error(e);
                isMeasuring = false;
                statusText = 'Error de captura';
            }
        }
    }

    async function runSequentialSequence() {
        const activeSegments = segments.filter(s => s.checked);
        if (activeSegments.length === 0) {
            isMeasuring = false;
            statusText = 'Seleccione al menos un segmento';
            return;
        }

        // Limpiar resultados anteriores
        activeSegments.forEach(s => s.result = undefined);

        for (let i = 0; i < activeSegments.length; i++) {
            if (!isMeasuring) break;
            const seg = activeSegments[i];
            statusText = `Midiendo: ${seg.name}...`;

            // Simular adquisición y procesamiento por segmento
            for (let p = 0; p <= 100; p += 20) {
                if (!isMeasuring) break;
                progress = Math.round(((i + p / 100) / activeSegments.length) * 100);
                await new Promise(r => setTimeout(r, 200));
            }

            if (isMeasuring) {
                // Resultado simulado para la UI
                seg.result = `${(Math.random() * 3 - 1.5).toFixed(1)} dB / ${(Math.random() * 10).toFixed(0)} ms`;
            }
        }

        if (isMeasuring) {
            isMeasuring = false;
            progress = 100;
            statusText = 'Secuencia completada con éxito';
        }
    }

    function calculateDelay() {
        statusText = 'Calculando retardo de canal...';
        setTimeout(() => {
            manualDelay = Math.round(10 + Math.random() * 25);
            statusText = `Retardo calculado: ${manualDelay} ms`;
        }, 1000);
    }

    function useCalculatedDelay() {
        statusText = `Retardo de ${manualDelay} ms aplicado`;
    }
</script>

<aside class="w-[380px] h-full bg-[#0a0a0c] border-r border-[#1a1a24]/50 flex flex-row text-gray-200 select-none">
    <!-- Pestañas Laterales -->
    <nav class="w-[60px] bg-[#050507] border-r border-[#1a1a24]/50 flex flex-col items-center py-4 gap-2">
        <button
            class="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px]
                   {activeTab === 'medicion' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
            onclick={() => activeTab = 'medicion'}
            title="Medición"
        >
            <span class="material-symbols-outlined text-[22px]">cadence</span>
        </button>

        <button
            class="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px]
                   {activeTab === 'eq' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
            onclick={() => activeTab = 'eq'}
            title="Ecualización"
        >
            <span class="material-symbols-outlined text-[22px]">instant_mix</span>
        </button>

        <button
            class="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px]
                   {activeTab === 'snaps' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
            onclick={() => activeTab = 'snaps'}
            title="Instantáneas"
        >
            <span class="material-symbols-outlined text-[22px]">screenshot_frame_2</span>
        </button>

        <button
            class="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px]
                   {activeTab === 'config' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
            onclick={() => activeTab = 'config'}
            title="Configuración"
        >
            <span class="material-symbols-outlined text-[22px]">settings</span>
        </button>
    </nav>

    <!-- Contenido Principal del Sidebar -->
    <div class="flex-1 h-full overflow-hidden flex flex-col bg-[#0a0a0c]">
        {#if activeTab === 'medicion'}
            <div class="flex-1 p-5 overflow-y-auto flex flex-col gap-5" id="panel-medicion">
                <!-- Selector de Modo (Segmented Control) -->
                <div class="flex bg-[#121216] p-1 rounded-lg border border-[#1a1a24]/50">
                    <button 
                        class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px]
                               {mode === 'manual' ? 'bg-[#3b82f6] text-white shadow' : 'text-gray-400 hover:text-gray-200'}"
                        onclick={() => { mode = 'manual'; if (isMeasuring) toggleMeasurement(); }}
                    >
                        Manual
                    </button>
                    <button 
                        class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px]
                               {mode === 'secuencial' ? 'bg-[#3b82f6] text-white shadow' : 'text-gray-400 hover:text-gray-200'}"
                        onclick={() => { mode = 'secuencial'; if (isMeasuring) toggleMeasurement(); }}
                    >
                        Secuencial
                    </button>
                </div>

                <!-- CONTENIDO MODO MANUAL -->
                {#if mode === 'manual'}
                    <div class="flex flex-col gap-4">
                        <!-- Dropdown Generador -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Generador</label>
                            <select 
                                bind:value={generatorType}
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
                        <div class="bg-[#121216]/50 border border-[#1a1a24]/30 rounded-lg p-3 flex flex-col gap-3">
                            {#if generatorType === 'sine'}
                                <div class="flex flex-col gap-1">
                                    <label class="text-[10px] font-bold text-gray-500 uppercase">Frecuencia (Hz)</label>
                                    <input 
                                        type="number" 
                                        bind:value={genFreq} 
                                        min="10" 
                                        max="22000"
                                        class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[#3b82f6]"
                                    />
                                </div>
                            {:else if generatorType === 'sweep'}
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="flex flex-col gap-1">
                                        <label class="text-[10px] font-bold text-gray-500 uppercase">Inicio (Hz)</label>
                                        <input type="number" bind:value={sweepF1} class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200" />
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="text-[10px] font-bold text-gray-500 uppercase">Fin (Hz)</label>
                                        <input type="number" bind:value={sweepF2} class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200" />
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="text-[10px] font-bold text-gray-500 uppercase">Duración (seg)</label>
                                    <input type="number" bind:value={sweepDuration} class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200" />
                                </div>
                            {:else if generatorType === 'burst' || generatorType === 'sinburst'}
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="flex flex-col gap-1">
                                        <label class="text-[10px] font-bold text-gray-500 uppercase">Duración (ms)</label>
                                        <input type="number" bind:value={burstDuration} class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200" />
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="text-[10px] font-bold text-gray-500 uppercase">Período (ms)</label>
                                        <input type="number" bind:value={burstPeriod} class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200" />
                                    </div>
                                </div>
                            {:else if generatorType === 'mls'}
                                <div class="flex flex-col gap-1">
                                    <label class="text-[10px] font-bold text-gray-500 uppercase">Orden MLS</label>
                                    <select bind:value={mlsOrder} class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1 text-sm text-gray-200">
                                        {#each Array.from({length: 7}, (_, i) => i + 10) as order}
                                            <option value={order}>Nivel {order} ({Math.pow(2, order) - 1} pts)</option>
                                        {/each}
                                    </select>
                                </div>
                            {:else}
                                <span class="text-xs text-gray-500 italic">No se requieren parámetros dinámicos para esta señal.</span>
                            {/if}

                            <!-- Ruteo de Salida -->
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Canal de Salida</label>
                                <select 
                                    bind:value={genRouting}
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
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Nivel de Señal</label>
                                <span class="text-xs font-mono font-bold text-[#3b82f6]">{genLevel} dBFS</span>
                            </div>
                            <input 
                                type="range" 
                                min="-60" 
                                max="10" 
                                bind:value={genLevel}
                                class="w-full h-1.5 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                            />
                        </div>

                        <!-- Botones de Generar / Detener -->
                        <div class="flex gap-2">
                            <button 
                                class="flex-1 min-h-[44px] bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981]/25 border border-[#10b981]/30 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
                                onclick={() => genActive = true}
                            >
                                <span class="material-symbols-outlined text-sm">volume_up</span>
                                Generar
                            </button>
                            <button 
                                class="flex-1 min-h-[44px] bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25 border border-[#ef4444]/30 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
                                onclick={() => genActive = false}
                            >
                                <span class="material-symbols-outlined text-sm">volume_mute</span>
                                Detener
                            </button>
                        </div>

                        <div class="border-t border-[#1a1a24]/30 my-2"></div>

                        <!-- Sección Retardo -->
                        <div class="flex flex-col gap-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Alineación de Retardo</label>
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
                {#if mode === 'secuencial'}
                    <div class="flex flex-col gap-4">
                        <div class="grid grid-cols-2 gap-2">
                            <!-- Dropdown Tasa de Muestreo -->
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Tasa (kHz)</label>
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
                                <label class="text-[10px] font-bold text-gray-500 uppercase">Presets APST</label>
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
                            <label class="text-[10px] font-bold text-gray-500 uppercase">Segmentos de Medición</label>
                            <div class="border border-[#1a1a24] rounded-lg bg-[#121216]/20 max-h-[220px] overflow-y-auto">
                                <table class="w-full border-collapse">
                                    <tbody>
                                        {#each segments as seg}
                                            <tr class="border-b border-[#1a1a24]/30 hover:bg-[#121216]/30 transition-colors">
                                                <td class="p-2 w-8 text-center align-middle">
                                                    <input 
                                                        type="checkbox" 
                                                        bind:checked={seg.checked}
                                                        onclick={() => selectedPreset = 'custom'}
                                                        class="accent-[#3b82f6] cursor-pointer"
                                                    />
                                                </td>
                                                <td class="p-2 align-middle">
                                                    <div class="flex flex-col">
                                                        <span class="text-xs font-semibold text-gray-300 cursor-help" title={seg.desc}>
                                                            {seg.name}
                                                        </span>
                                                        {#if seg.result}
                                                            <div class="text-[10px] font-mono text-[#10b981] mt-0.5 bg-[#10b981]/5 px-1.5 py-0.5 rounded border border-[#10b981]/10 w-fit">
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
                        <div class="flex flex-col gap-3 bg-[#121216]/30 border border-[#1a1a24]/30 rounded-lg p-3">
                            <div class="flex justify-between items-center">
                                <label class="text-xs font-semibold text-gray-300 cursor-pointer" for="offline-toggle">
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
                                <div class="flex gap-2 items-center pt-2 border-t border-[#1a1a24]/20">
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
                                        <span class="material-symbols-outlined text-sm">download</span>
                                        Descargar Seq
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}

                <!-- FOOTER ANCLADO GLOBAL A LA PESTAÑA -->
                <div class="mt-auto pt-4 border-t border-[#1a1a24]/50 flex flex-col gap-2">
                    {#if mode === 'secuencial' && isMeasuring}
                        <!-- Barra de Progreso en Modo Secuencial -->
                        <div class="w-full bg-[#121216] rounded-full h-2.5 overflow-hidden border border-white/5">
                            <div class="bg-gradient-to-r from-[#3b82f6] to-[#00ff88] h-full transition-all duration-300" style="width: {progress}%"></div>
                        </div>
                        <div class="flex justify-between text-[10px] font-mono text-gray-500">
                            <span>PROGRESO SECUENCIA</span>
                            <span class="text-[#3b82f6] font-bold">{progress}%</span>
                        </div>
                    {/if}

                    <button 
                        class="w-full min-h-[48px] bg-gradient-to-r transition-all duration-300 text-white rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg
                               {isMeasuring ? 'from-[#ef4444] to-[#dc2626] hover:opacity-90' : 'from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8]'}"
                        onclick={toggleMeasurement}
                    >
                        <span class="material-symbols-outlined">{isMeasuring ? 'stop' : 'podcast'}</span>
                        {isMeasuring ? 'Detener Medición' : 'Medir / Iniciar'}
                    </button>
                    
                    <span class="text-center text-[10px] text-gray-500 font-mono italic">
                        {statusText}
                    </span>
                </div>
            </div>
        {:else if activeTab === 'eq'}
            <div class="flex-1 p-5 overflow-y-auto flex flex-col gap-5" id="panel-eq">
                <!-- Controles Superiores -->
                <div class="flex flex-col gap-3 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-lg p-4">
                    <div class="flex justify-between items-center">
                        <label class="text-xs font-semibold text-gray-300 cursor-pointer" for="eq-toggle">
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
                        <span class="material-symbols-outlined text-sm">{isCalculatingAutoEQ ? 'sync' : 'auto_awesome'}</span>
                        {isCalculatingAutoEQ ? 'Procesando AutoEQ...' : 'Calcular Ecualización (AutoEQ)'}
                    </button>
                </div>

                {#if showEQ}
                    <!-- Selector de Tipo de Ecualizador -->
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tipo de Ecualizador</label>
                        <select 
                            bind:value={eqType}
                            class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#3b82f6]"
                        >
                            <option value="grafico">Ecualizador Gráfico</option>
                            <option value="parametrico">Ecualizador Paramétrico</option>
                            <option value="tono">Control de Tono</option>
                        </select>
                    </div>

                    <!-- MODO GRÁFICO -->
                    {#if eqType === 'grafico'}
                        <div class="flex flex-col gap-4">
                            <div class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5">
                                <label class="text-xs text-gray-400">Cantidad de bandas</label>
                                <select 
                                    bind:value={numGraphicBands}
                                    class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
                                >
                                    <option value={5}>5 Bandas</option>
                                    <option value={10}>10 Bandas</option>
                                    <option value={15}>15 Bandas</option>
                                </select>
                            </div>

                            <div class="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                                {#each graphicBands as band}
                                    <div class="flex items-center gap-2">
                                        <span class="text-[11px] font-mono w-14 text-right text-gray-400">
                                            {band.freq >= 1000 ? `${(band.freq/1000).toFixed(1).replace('.0', '')}k` : band.freq} Hz
                                        </span>
                                        <input 
                                            type="range" 
                                            min="-12" 
                                            max="12" 
                                            step="0.5" 
                                            bind:value={band.gain} 
                                            ondblclick={() => band.gain = 0}
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
                    {#if eqType === 'parametrico'}
                        <div class="flex flex-col gap-3">
                            <div class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5">
                                <label class="text-xs text-gray-400">Cantidad de filtros</label>
                                <select 
                                    bind:value={numParametricFilters}
                                    class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200"
                                >
                                    {#each Array.from({length: 6}, (_, i) => i + 1) as fNum}
                                        <option value={fNum}>{fNum} {fNum === 1 ? 'Filtro' : 'Filtros'}</option>
                                    {/each}
                                </select>
                            </div>

                            <div class="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                                {#each parametricFilters.slice(0, numParametricFilters) as filter}
                                    <div class="border border-[#1a1a24] bg-[#121216]/20 rounded-lg p-3 flex flex-col gap-3">
                                        <div class="flex justify-between items-center">
                                            <span class="text-xs font-bold text-[#3b82f6]">Filtro {filter.id}</span>
                                            
                                            <!-- Configuración del Filtro (tipos soportados) -->
                                            <div class="relative">
                                                <button 
                                                    class="bg-[#121216] hover:bg-[#1a1a24] text-[10px] text-gray-400 px-2 py-1 rounded border border-[#1a1a24] flex items-center gap-1 cursor-pointer"
                                                    onclick={() => filter.showConfig = !filter.showConfig}
                                                >
                                                    <span class="material-symbols-outlined text-[12px]">settings</span>
                                                    Filtros
                                                </button>
                                                {#if filter.showConfig}
                                                    <div class="absolute right-0 top-7 bg-[#1a1a24] border border-[#2a2a35] rounded-md p-2.5 z-50 shadow-2xl flex flex-col gap-1.5 w-40">
                                                        <span class="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tipos Soportados</span>
                                                        {#each ['peaking', 'lowpass', 'highpass', 'shelving', 'notch', 'bandpass'] as type}
                                                            <label class="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={filter.supportedTypes.includes(type)}
                                                                    onclick={() => {
                                                                        if (filter.supportedTypes.includes(type)) {
                                                                            if (filter.supportedTypes.length > 1) {
                                                                                filter.supportedTypes = filter.supportedTypes.filter(t => t !== type);
                                                                                if (filter.type === type) filter.type = filter.supportedTypes[0];
                                                                            }
                                                                        } else {
                                                                            filter.supportedTypes = [...filter.supportedTypes, type];
                                                                        }
                                                                    }}
                                                                    class="accent-[#3b82f6]"
                                                                />
                                                                {type === 'peaking' ? 'Campana' : type === 'lowpass' ? 'Paso Bajo' : type === 'highpass' ? 'Paso Alto' : type === 'shelving' ? 'Shelving' : type === 'notch' ? 'Notch' : 'Paso Banda'}
                                                            </label>
                                                        {/each}
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-2 gap-2">
                                            <!-- Tipo Activo -->
                                            <div class="flex flex-col gap-1 col-span-2">
                                                <label class="text-[9px] text-gray-500 font-bold uppercase">Tipo de Filtro</label>
                                                <select 
                                                    bind:value={filter.type} 
                                                    class="w-full bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200"
                                                >
                                                    {#each filter.supportedTypes as type}
                                                        <option value={type}>
                                                            {type === 'peaking' ? 'Campana (Peaking)' : type === 'lowpass' ? 'Paso Bajo (Lowpass)' : type === 'highpass' ? 'Paso Alto (Highpass)' : type === 'shelving' ? 'Shelving' : type === 'notch' ? 'Notch' : 'Paso Banda (Bandpass)'}
                                                        </option>
                                                    {/each}
                                                </select>
                                            </div>

                                            <!-- Frecuencia -->
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[9px] text-gray-500 font-bold uppercase">Frecuencia (Hz)</label>
                                                <input type="number" bind:value={filter.freq} min="20" max="20000" class="w-full bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs font-mono" />
                                            </div>

                                            <!-- Q (ancho de banda) -->
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[9px] text-gray-500 font-bold uppercase">Q (Factor)</label>
                                                <input 
                                                    type="number" 
                                                    bind:value={filter.q} 
                                                    min="0.1" 
                                                    max="10" 
                                                    step="0.1" 
                                                    disabled={['lowpass', 'highpass'].includes(filter.type)}
                                                    class="w-full bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs font-mono disabled:opacity-30" 
                                                />
                                            </div>

                                            <!-- Ganancia (Solo si es peaking/shelving) -->
                                            {#if ['peaking', 'shelving'].includes(filter.type)}
                                                <div class="flex flex-col gap-1 col-span-2 mt-1">
                                                    <div class="flex justify-between items-center text-[9px] text-gray-500 font-bold uppercase">
                                                        <span>Ganancia</span>
                                                        <span class="text-[#00ff88]">{filter.gain} dB</span>
                                                    </div>
                                                    <input type="range" min="-15" max="15" step="0.5" bind:value={filter.gain} class="w-full h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- MODO TONO -->
                    {#if eqType === 'tono'}
                        <div class="flex flex-col gap-4 bg-[#121216]/20 border border-[#1a1a24] rounded-lg p-4">
                            <div class="flex flex-col gap-1.5">
                                <div class="flex justify-between text-xs font-bold text-gray-300">
                                    <span>Graves (Bass)</span>
                                    <span class="font-mono text-[#3b82f6]">{toneBass} dB</span>
                                </div>
                                <input type="range" min="-12" max="12" step="0.5" bind:value={toneBass} class="w-full h-1.5 bg-[#121216] appearance-none cursor-pointer accent-[#3b82f6] rounded-full" />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <div class="flex justify-between text-xs font-bold text-gray-300">
                                    <span>Medios (Mid)</span>
                                    <span class="font-mono text-[#3b82f6]">{toneMid} dB</span>
                                </div>
                                <input type="range" min="-12" max="12" step="0.5" bind:value={toneMid} class="w-full h-1.5 bg-[#121216] appearance-none cursor-pointer accent-[#3b82f6] rounded-full" />
                            </div>

                            <div class="flex flex-col gap-1.5">
                                <div class="flex justify-between text-xs font-bold text-gray-300">
                                    <span>Agudos (Treble)</span>
                                    <span class="font-mono text-[#3b82f6]">{toneTreble} dB</span>
                                </div>
                                <input type="range" min="-12" max="12" step="0.5" bind:value={toneTreble} class="w-full h-1.5 bg-[#121216] appearance-none cursor-pointer accent-[#3b82f6] rounded-full" />
                            </div>
                        </div>
                    {/if}
                {:else}
                    <div class="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-[#1a1a24] rounded-lg bg-[#121216]/5">
                        <span class="material-symbols-outlined text-gray-600 text-3xl mb-2">equalizer</span>
                        <p class="text-xs text-gray-500">Active el switch superior para habilitar el procesamiento de ecualización y simular la curva predictiva.</p>
                    </div>
                {/if}

                <!-- BOTÓN ANCLADO AL FONDO -->
                <div class="mt-auto pt-4 border-t border-[#1a1a24]/50 flex flex-col gap-2">
                    <button 
                        class="w-full min-h-[48px] border transition-all duration-300 rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg
                               {uiStore.isSimulating ? 'bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-transparent hover:bg-white/5 border-white/10 text-gray-400'}"
                        onclick={() => uiStore.isSimulating = !uiStore.isSimulating}
                    >
                        <span class="material-symbols-outlined">{uiStore.isSimulating ? 'analytics' : 'insights'}</span>
                        {uiStore.isSimulating ? 'Detener Simulación' : 'Simular Respuesta'}
                    </button>
                </div>
            </div>

        {:else if activeTab === 'snaps'}
            <div class="flex-1 p-6 overflow-y-auto flex flex-col gap-6" id="panel-snaps">
                <!-- Contenido de Instantáneas -->
            </div>
        {:else if activeTab === 'config'}
            <div class="flex-1 p-6 overflow-y-auto flex flex-col gap-6" id="panel-config">
                <!-- Contenido de Configuración -->
            </div>
        {/if}
    </div>
</aside>
