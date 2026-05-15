<script lang="ts">
    import { onMount } from 'svelte';
    import { getAudioProvider } from '$lib/hal';
    import { Orchestrator, type OrchestratorEvent } from '$lib/dsp/apst/Orchestrator';
    import { Player } from '$lib/dsp/apst/Player';
    import { fade, slide } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import { traceManager } from '$lib/stores/traceManager.svelte';
    import { uiStore } from '$lib/stores/ui.svelte';

    const provider = getAudioProvider();
    const player = new Player(provider);
    const orchestrator = new Orchestrator(player, provider);

    let activeTab = $state('medicion'); // 'medicion' | 'eq' | 'snaps' | 'config'
    let medicionSubTab = $state('secuencial'); // 'secuencial' | 'manual'
    let secuencialMode = $state('live'); // 'live' | 'offline'

    let orchestratorEvent = $state<OrchestratorEvent>({ state: 'IDLE' });
    let selectedSequence = $state('Completa (VANFP)');
    let errorToast = $state<string | null>(null);

    // Segmentos APST
    const allSegments = [
        { id: 'V', name: 'Ganancia', info: 'Verificación de niveles' },
        { id: 'A', name: 'Alineación', info: 'Sincronización temporal' },
        { id: 'M', name: 'Mute', info: 'Silencio de control' },
        { id: 'N', name: 'Nivel', info: 'Calibración de SPL' },
        { id: 'F', name: 'Frecuencia', info: 'Respuesta en frecuencia' },
        { id: 'P', name: 'Polaridad', info: 'Fase absoluta' },
        { id: 'T', name: 'THD', info: 'Distorsión armónica' },
        { id: 'D', name: 'Delay', info: 'Cálculo de propagación' },
        { id: 'X', name: 'Crosstalk', info: 'Separación de canales' },
        { id: 'R', name: 'Ruido', info: 'Piso de ruido ambiente' }
    ];
    let selectedSegments = $state<string[]>(['V', 'A', 'N', 'F', 'P']);

    // Generador Manual (OSM Style)
    let generatorType = $state('pink');
    let genFreq = $state(1000);
    let genLevel = $state(-20);
    let genRouting = $state<'L' | 'R' | 'Stereo'>('Stereo');
    let genActive = $state(false);
    let genCycles = $state(4);
    let genPeriod = $state(1);
    let delayMs = $state(0);

    // Ecualización
    let eqType = $state('param'); // 'param' | 'graph'

    // Dispositivos
    let inDevices = $state<MediaDeviceInfo[]>([]);
    let outDevices = $state<MediaDeviceInfo[]>([]);
    
    onMount(async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            inDevices = allDevices.filter(d => d.kind === 'audioinput');
            outDevices = allDevices.filter(d => d.kind === 'audiooutput');

            if (inDevices.length > 0 && !uiStore.audioInDevice) uiStore.audioInDevice = inDevices[0].deviceId;
            if (outDevices.length > 0 && !uiStore.audioOutDevice) uiStore.audioOutDevice = outDevices[0].deviceId;
        } catch (e) {
            console.error('Error:', e);
        }
    });

    orchestrator.subscribe(e => orchestratorEvent = e);

    $effect(() => {
        // @ts-ignore
        provider.playGenerator(generatorType, genActive, genFreq, genLevel, genRouting);
    });

    function toggleSegment(id: string) {
        if (selectedSegments.includes(id)) {
            selectedSegments = selectedSegments.filter(s => s !== id);
        } else {
            selectedSegments = [...selectedSegments, id];
        }
        // Lógica de presets automáticos
        const joined = selectedSegments.sort().join('');
        if (joined === 'AFNPV') selectedSequence = 'Completa (VANFP)';
        else if (joined === 'V') selectedSequence = 'Verificación (V)';
        else if (joined === 'F') selectedSequence = 'Respuesta (F)';
        else selectedSequence = 'Personalizada';
    }

    async function startMeasurement() {
        await provider.startCapture({
            onAudioData: () => {},
            onFrequencyData: (data) => traceManager.updateLiveTrace('live-1', data)
        });
        await orchestrator.runSequence(selectedSegments.join(' '));
    }

    function calculateEQ() {
        console.log("Calculando ecualización óptima...");
        traceManager.eqBands.forEach(b => {
            b.gain = parseFloat((Math.random() * 10 - 5).toFixed(1));
            b.q = parseFloat((Math.random() * 2 + 0.5).toFixed(2));
        });
    }

    const downloadTable = [
        { fmt: 'WAV', type: 'Normal', rate: '48kHz' },
        { fmt: 'WAV', type: 'Sub', rate: '48kHz' },
        { fmt: 'FLAC', type: 'Normal', rate: '96kHz' }
    ];

    function calculateDelay() {
        const simulatedDelay = (Math.random() * 90 + 10).toFixed(2);
        delayMs = parseFloat(simulatedDelay);
    }

    async function toggleGenerator() {
        genActive = !genActive;
        if (genActive) {
            await provider.startCapture({
                onAudioData: () => {},
                onFrequencyData: (data) => traceManager.updateLiveTrace('live-1', data)
            });
        }
    }

    // Instantáneas Logic
    let snapSortBy = $state('date');
    const sortedSnapshots = $derived(
        [...traceManager.snapshots].sort((a, b) => {
            if (snapSortBy === 'date') return b.timestamp - a.timestamp;
            return a.source.localeCompare(b.source);
        })
    );

    const gridOptions = [['1x1', '1x2', '1x3'], ['2x1', '2x2', '2x3']];
</script>

<aside class="sidebar">
    <div class="tabs-vertical">
        <button class:active={activeTab === 'medicion'} onclick={() => activeTab = 'medicion'} title="Medición">
            <span class="material-symbols-outlined">graphic_eq</span>
        </button>
        <button class:active={activeTab === 'eq'} onclick={() => activeTab = 'eq'} title="Ecualización">
            <span class="material-symbols-outlined">equalizer</span>
        </button>
        <button class:active={activeTab === 'snaps'} onclick={() => activeTab = 'snaps'} title="Instantáneas">
            <span class="material-symbols-outlined">screenshot_frame_2</span>
        </button>
        <button class:active={activeTab === 'config'} onclick={() => activeTab = 'config'} title="Configuración">
            <span class="material-symbols-outlined">settings</span>
        </button>
    </div>

    <div class="sidebar-main">
        <div class="tab-content">
            {#if activeTab === 'medicion'}
                <div class="panel" in:fade>
                    <header class="panel-header">
                        <div class="segmented-control">
                            <button class:active={medicionSubTab === 'secuencial'} onclick={() => medicionSubTab = 'secuencial'}>
                                <span class="material-symbols-outlined">lists</span>
                                Secuencial
                            </button>
                            <button class:active={medicionSubTab === 'manual'} onclick={() => medicionSubTab = 'manual'}>
                                <span class="material-symbols-outlined">hearing</span>
                                Manual
                            </button>
                        </div>
                    </header>

                    {#if medicionSubTab === 'secuencial'}
                        <section class="section">
                            <div class="segmented-control mini mb-4">
                                <button class:active={secuencialMode === 'live'} onclick={() => secuencialMode = 'live'}>En vivo</button>
                                <button class:active={secuencialMode === 'offline'} onclick={() => secuencialMode = 'offline'}>Offline</button>
                            </div>

                            {#if secuencialMode === 'live'}
                                <div class="field">
                                    <label>Preset de secuencia</label>
                                    <select class="select-full" bind:value={selectedSequence}>
                                        <option>Completa (VANFP)</option>
                                        <option>Verificación (V)</option>
                                        <option>Respuesta (F)</option>
                                        <option>Personalizada</option>
                                    </select>
                                </div>
                                <button class="btn-primary w-full" onclick={startMeasurement}>
                                    Iniciar medición
                                </button>
                            {:else}
                                <div class="offline-controls">
                                    <button class="btn-outline w-full mb-4">
                                        <span class="material-symbols-outlined">play_arrow</span>
                                        Escuchar
                                    </button>
                                    <table class="download-table">
                                        <thead>
                                            <tr><th>Fmt</th><th>Tipo</th><th>Rate</th><th></th></tr>
                                        </thead>
                                        <tbody>
                                            {#each downloadTable as d}
                                                <tr>
                                                    <td>{d.fmt}</td>
                                                    <td>{d.type}</td>
                                                    <td>{d.rate}</td>
                                                    <td><button class="icon-btn"><span class="material-symbols-outlined">download</span></button></td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            {/if}

                            <div class="divider"></div>
                            
                            <label class="section-label">Segmentos APST</label>
                            <div class="segments-grid">
                                {#each allSegments as seg}
                                    <button 
                                        class="segment-chip" 
                                        class:selected={selectedSegments.includes(seg.id)}
                                        onclick={() => toggleSegment(seg.id)}
                                        title={seg.info}
                                    >
                                        <span class="seg-id">{seg.id}</span>
                                        <span class="material-symbols-outlined info-icon">info</span>
                                    </button>
                                {/each}
                            </div>
                        </section>
                    {:else}
                        <section class="section">
                            <div class="field">
                                <label>Generador</label>
                                <select class="select-full" bind:value={generatorType}>
                                    <option value="pink">Ruido rosa</option>
                                    <option value="white">Ruido blanco</option>
                                    <option value="brown">Ruido Brown</option>
                                    <option value="music">Music-noise</option>
                                    <option value="sine">Seno continuo</option>
                                    <option value="sweep">Sweep logarítmico</option>
                                    <option value="burst">Burst</option>
                                    <option value="sinburst">SinBurst</option>
                                    <option value="mls">MLS+</option>
                                </select>
                            </div>

                            <div class="osm-inputs-grid">
                                {#if ['sine', 'burst', 'sinburst'].includes(generatorType)}
                                    <div class="field" transition:slide>
                                        <label>Freq (Hz)</label>
                                        <input type="number" class="input-full" bind:value={genFreq} />
                                    </div>
                                {/if}
                                {#if ['burst', 'sinburst'].includes(generatorType)}
                                    <div class="field" transition:slide>
                                        <label>Ciclos</label>
                                        <input type="number" class="input-full" bind:value={genCycles} />
                                    </div>
                                    <div class="field" transition:slide>
                                        <label>Periodo (s)</label>
                                        <input type="number" step="0.1" class="input-full" bind:value={genPeriod} />
                                    </div>
                                {/if}
                                <div class="field">
                                    <label>Nivel (dBFS)</label>
                                    <input type="number" step="0.1" class="input-full" bind:value={genLevel} />
                                </div>
                            </div>

                            <div class="field">
                                <label>Retardo (ms)</label>
                                <div class="input-with-action">
                                    <input type="number" step="0.01" class="input-full" bind:value={delayMs} />
                                    <button class="btn-action" onclick={calculateDelay}>Find</button>
                                </div>
                            </div>

                            <div class="button-group dual mt-4">
                                <button class="btn-toggle" class:active={genActive} onclick={toggleGenerator}>
                                    Generador
                                </button>
                                <button class="btn-outline">Escuchar</button>
                            </div>
                        </section>
                    {/if}
                </div>

            {:else if activeTab === 'eq'}
                <div class="panel" in:fade>
                    <header class="panel-header">
                        <h2>Ecualización</h2>
                    </header>

                    <section class="section">
                        <label class="section-label">Tipo de EQ</label>
                        <select class="select-full mb-4" bind:value={eqType}>
                            <option value="param">Paramétrico</option>
                            <option value="graph">Gráfico (31 bandas)</option>
                        </select>

                        <div class="eq-playground">
                            {#each traceManager.eqBands as band, i}
                                <div class="eq-band-card">
                                    <div class="band-header">
                                        <span class="band-idx">Banda {i+1}</span>
                                        <span class="band-freq">{band.freq}Hz</span>
                                    </div>
                                    <div class="band-controls">
                                        <div class="ctrl">
                                            <label>G (dB)</label>
                                            <input type="range" min="-18" max="18" step="0.1" bind:value={band.gain} />
                                            <input type="number" step="0.1" bind:value={band.gain} />
                                        </div>
                                        {#if eqType === 'param'}
                                            <div class="ctrl">
                                                <label>Q</label>
                                                <input type="range" min="0.1" max="10" step="0.1" bind:value={band.q} />
                                                <input type="number" step="0.1" bind:value={band.q} />
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>

                        <button class="btn-primary w-full mt-6" onclick={calculateEQ}>
                            Calcular ecualización
                        </button>
                    </section>
                </div>

            {:else if activeTab === 'snaps'}
                <div class="panel" in:fade>
                    <header class="panel-header">
                        <h2>Instantáneas</h2>
                        <span class="badge">{sortedSnapshots.length}</span>
                    </header>

                    <div class="snapshot-list">
                        {#each sortedSnapshots as snap (snap.id)}
                            <div class="snap-item" animate:flip={{ duration: 200 }}>
                                <div class="snap-main">
                                    <span class="material-symbols-outlined source-icon">
                                        {snap.source === 'manual' ? 'mouse' : 'auto_mode'}
                                    </span>
                                    <div class="snap-info">
                                        <span class="snap-name">{snap.name}</span>
                                        <span class="snap-meta">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div class="snap-actions">
                                        <button onclick={() => traceManager.toggleVisibility(snap.id)}>
                                            <span class="material-symbols-outlined">
                                                {snap.visible ? 'visibility' : 'visibility_off'}
                                            </span>
                                        </button>
                                        <button onclick={() => traceManager.removeTrace(snap.id)} class="delete">
                                            <span class="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                </div>
                                <div class="snap-controls">
                                    <input 
                                        type="range" min="-20" max="20" step="0.5" 
                                        value={snap.offsetY} 
                                        oninput={(e) => traceManager.setYOffset(snap.id, parseFloat((e.target as HTMLInputElement).value))} 
                                    />
                                    <span>{snap.offsetY} dB</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

            {:else if activeTab === 'config'}
                <div class="panel" in:fade>
                    <header class="panel-header">
                        <h2>Configuración</h2>
                    </header>

                    <section class="section">
                        <label class="section-label">Audio IN</label>
                        <select class="select-full mb-2" bind:value={uiStore.audioInDevice}>
                            {#each inDevices as device}
                                <option value={device.deviceId}>{device.label}</option>
                            {/each}
                        </select>
                        
                        <div class="checkbox-group mb-4">
                            <label class="check-item">
                                <input type="checkbox" bind:checked={uiStore.inChannels[0]} /> Ch 1
                            </label>
                            <label class="check-item">
                                <input type="checkbox" bind:checked={uiStore.inChannels[1]} /> Ch 2
                            </label>
                        </div>

                        <div class="field">
                            <label>Canal de Referencia</label>
                            <select class="select-full" bind:value={uiStore.referenceChannel}>
                                <option>Loopback</option>
                                <option value={0}>Canal 1</option>
                                <option value={1}>Canal 2</option>
                            </select>
                        </div>
                    </section>

                    <section class="section">
                        <label class="section-label">Audio OUT</label>
                        <select class="select-full mb-2" bind:value={uiStore.audioOutDevice}>
                            {#each outDevices as device}
                                <option value={device.deviceId}>{device.label}</option>
                            {/each}
                        </select>

                        <div class="checkbox-group">
                            <label class="check-item">
                                <input type="checkbox" bind:checked={uiStore.outChannels[0]} /> Ch 1
                            </label>
                            <label class="check-item">
                                <input type="checkbox" bind:checked={uiStore.outChannels[1]} /> Ch 2
                            </label>
                        </div>
                    </section>

                    <section class="section">
                        <label class="section-label">Visualización</label>
                        <label>Distribución de cuadrícula</label>
                        <div class="grid-selector">
                            {#each gridOptions as row}
                                <div class="grid-row">
                                    {#each row as opt}
                                        <button 
                                            class:active={uiStore.layout === opt}
                                            onclick={() => uiStore.setLayout(opt)}
                                        >
                                            <div class="grid-preview layout-{opt}"></div>
                                            <span>{opt}</span>
                                        </button>
                                    {/each}
                                </div>
                            {/each}
                        </div>
                    </section>

                    <section class="section">
                        <label class="section-label">Interfaz</label>
                        <button class="btn-theme" onclick={() => uiStore.toggleTheme()}>
                            <span class="material-symbols-outlined">
                                {uiStore.isDarkMode ? 'light_mode' : 'dark_mode'}
                            </span>
                            {uiStore.isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
                        </button>
                    </section>
                </div>
            {/if}
        </div>
    </div>
</aside>

<style>
    .sidebar {
        width: 380px;
        height: 100%;
        background: #0f0f12;
        display: flex;
        border-right: 1px solid rgba(255, 255, 255, 0.05);
        color: #e0e0e0;
        font-family: 'Inter', sans-serif;
    }

    .tabs-vertical {
        width: 60px;
        background: #050507;
        display: flex;
        flex-direction: column;
        border-right: 1px solid rgba(255, 255, 255, 0.05);
    }

    .tabs-vertical button {
        height: 60px;
        background: transparent;
        border: none;
        color: #444;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .tabs-vertical button.active {
        color: #3b82f6;
        background: rgba(59, 130, 246, 0.1);
    }

    .sidebar-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }

    .panel-header h2 {
        font-size: 1.1rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: 0;
    }

    .segmented-control {
        display: flex;
        background: #000;
        padding: 4px;
        border-radius: 10px;
        gap: 2px;
        width: 100%;
    }

    .segmented-control button {
        flex: 1;
        background: transparent;
        border: none;
        color: #666;
        padding: 10px;
        border-radius: 8px;
        font-size: 0.75rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .segmented-control button.active {
        background: #1a1a20;
        color: #fff;
    }

    .segmented-control.mini button {
        padding: 6px;
        font-size: 0.7rem;
    }

    .section {
        margin-bottom: 2.5rem;
    }

    .section-label {
        display: block;
        font-size: 0.65rem;
        font-weight: 900;
        color: #3b82f6;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 1rem;
    }

    .field {
        margin-bottom: 1.2rem;
    }

    .field label {
        display: block;
        font-size: 0.7rem;
        color: #666;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        font-weight: 800;
    }

    .select-full, .input-full {
        width: 100%;
        background: #1a1a20;
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: #fff;
        padding: 10px;
        border-radius: 8px;
        font-size: 0.85rem;
        outline: none;
    }

    .select-full:focus, .input-full:focus {
        border-color: #3b82f6;
    }

    .btn-primary {
        background: #3b82f6;
        color: #fff;
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-weight: 800;
        cursor: pointer;
        text-transform: uppercase;
        transition: transform 0.1s;
    }

    .btn-primary:active { transform: scale(0.98); }

    .btn-outline {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        padding: 12px;
        border-radius: 8px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
    }

    .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.05);
        margin: 2rem 0;
    }

    .segments-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
    }

    .segment-chip {
        aspect-ratio: 1;
        background: #1a1a20;
        border: 1px solid transparent;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #444;
        position: relative;
        transition: all 0.2s;
    }

    .segment-chip.selected {
        background: rgba(0, 255, 136, 0.1);
        border-color: #00ff88;
        color: #00ff88;
    }

    .seg-id {
        font-size: 0.9rem;
        font-weight: 900;
    }

    .info-icon {
        font-size: 0.7rem;
        position: absolute;
        top: 4px;
        right: 4px;
        opacity: 0.3;
    }

    .osm-inputs-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .input-with-action {
        display: flex;
        gap: 4px;
    }

    .btn-action {
        background: #333;
        border: none;
        color: #fff;
        padding: 0 12px;
        border-radius: 8px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
    }

    .button-group.dual {
        display: grid;
        grid-template-columns: 1.5fr 1fr;
        gap: 8px;
    }

    .btn-toggle {
        background: transparent;
        border: 1px solid #3b82f6;
        color: #3b82f6;
        border-radius: 8px;
        font-weight: 800;
        text-transform: uppercase;
        cursor: pointer;
    }

    .btn-toggle.active {
        background: #ef4444;
        border-color: #ef4444;
        color: #fff;
    }

    .download-table {
        width: 100%;
        font-size: 0.75rem;
        border-collapse: collapse;
        margin-top: 1rem;
    }

    .download-table th {
        text-align: left;
        color: #666;
        padding: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .download-table td {
        padding: 8px;
        color: #ccc;
    }

    .icon-btn {
        background: transparent;
        border: none;
        color: #3b82f6;
        cursor: pointer;
        padding: 4px;
    }

    .eq-playground {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .eq-band-card {
        background: #1a1a20;
        border-radius: 12px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.02);
    }

    .band-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .band-idx { font-weight: 800; color: #3b82f6; font-size: 0.7rem; text-transform: uppercase; }
    .band-freq { font-family: monospace; font-size: 0.8rem; color: #fff; }

    .band-controls {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .ctrl {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .ctrl label { font-size: 0.65rem; color: #666; width: 40px; font-weight: 900; }
    .ctrl input[type="range"] { flex: 1; accent-color: #3b82f6; height: 4px; }
    .ctrl input[type="number"] { width: 45px; background: #000; border: none; color: #fff; padding: 4px; font-size: 0.7rem; text-align: center; border-radius: 4px; }

    /* Snapshots */
    .snapshot-list { display: flex; flex-direction: column; gap: 8px; }
    .snap-item { background: #1a1a20; border-radius: 10px; padding: 10px; }
    .snap-main { display: flex; align-items: center; gap: 10px; }
    .snap-info { flex: 1; }
    .snap-name { display: block; font-size: 0.8rem; font-weight: 700; color: #fff; }
    .snap-meta { font-size: 0.65rem; color: #555; }
    .snap-actions { display: flex; gap: 4px; }
    .snap-actions button { background: transparent; border: none; color: #444; cursor: pointer; padding: 4px; }
    .snap-actions button:hover { color: #fff; }
    .snap-actions button.delete:hover { color: #ef4444; }
    .snap-controls { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.03); }
    .snap-controls input { flex: 1; accent-color: #3b82f6; height: 4px; }
    .snap-controls span { font-size: 0.7rem; font-family: monospace; color: #3b82f6; min-width: 35px; text-align: right; }

    /* Grid Selector */
    .grid-selector { display: flex; flex-direction: column; gap: 8px; }
    .grid-row { display: flex; gap: 8px; }
    .grid-selector button { flex: 1; background: #1a1a20; border: 1px solid rgba(255, 255, 255, 0.03); padding: 12px; border-radius: 8px; color: #555; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .grid-selector button.active { border-color: #3b82f6; color: #fff; background: rgba(59, 130, 246, 0.05); }
    .grid-preview { width: 24px; height: 16px; border: 1px solid currentColor; display: grid; gap: 1px; }
    .grid-preview.layout-1x1 { grid-template-columns: 1fr; }
    .grid-preview.layout-1x2 { grid-template-columns: 1fr 1fr; }
    .grid-preview.layout-1x3 { grid-template-columns: 1fr 1fr 1fr; }
    .grid-preview.layout-2x1 { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
    .grid-preview.layout-2x2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
    .grid-preview.layout-2x3 { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; }

    .checkbox-group {
        display: flex;
        gap: 12px;
        margin-top: 8px;
    }

    .check-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: #aaa;
        cursor: pointer;
    }

    .check-item input {
        accent-color: #3b82f6;
    }

    .btn-theme { width: 100%; padding: 12px; background: #1a1a20; border: 1px solid rgba(255, 255, 255, 0.05); color: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 700; cursor: pointer; }

    .w-full { width: 100%; }
    .mb-4 { margin-bottom: 1rem; }
    .mt-4 { margin-top: 1rem; }
    .mt-6 { margin-top: 1.5rem; }
</style>
