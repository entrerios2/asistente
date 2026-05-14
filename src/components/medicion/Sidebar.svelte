<script lang="ts">
    import { getAudioProvider } from '$lib/hal';
    import { Orchestrator, type OrchestratorEvent } from '$lib/dsp/apst/Orchestrator';
    import { Player } from '$lib/dsp/apst/Player';
    import { fade, slide } from 'svelte/transition';
    import { traceManager } from '$lib/stores/traceManager.svelte';

    const provider = getAudioProvider();
    const player = new Player(provider);
    const orchestrator = new Orchestrator(player, provider);

    let activeTab = $state('secuencial'); // 'secuencial' | 'manual'
    let orchestratorEvent = $state<OrchestratorEvent>({ state: 'IDLE' });
    let isCollapsed = $state(true);
    let selectedSequence = $state('Completa (VANFP)');
    let errorToast = $state<string | null>(null);

    // Estado del generador manual
    let generatorType = $state<'pink' | 'white' | 'sweep' | 'sine'>('pink');
    let genFreq = $state(1000);
    let genLevel = $state(-20);
    let genRouting = $state<'L' | 'R' | 'Stereo'>('Stereo');
    let genActive = $state(false);
    let delayMs = $state(0);

    orchestrator.subscribe((event) => {
        orchestratorEvent = event;
        if (event.state === 'ABORTADO') {
            errorToast = event.message || 'Error en la secuencia';
        }
    });

    $effect(() => {
        // Invocación reactiva del generador
        provider.playGenerator(generatorType, genActive, genFreq, genLevel, genRouting);
    });

    const sequenceSteps = ['V', 'A', 'N', 'F', 'P', 'X'];
    const stepNames: Record<string, string> = {
        'V': 'Verificación de ganancia',
        'A': 'Alineación temporal',
        'N': 'Nivel de referencia',
        'F': 'Respuesta en frecuencia',
        'P': 'Polaridad',
        'X': 'Diafonía (Crosstalk)'
    };

    function translateState(state: string) {
        switch (state) {
            case 'IDLE': return 'Estado: En espera';
            case 'RUNNING': return 'Estado: Ejecutando';
            case 'RECORDING': return 'Estado: Grabando';
            case 'ABORTADO': return 'Estado: Error';
            default: return `Estado: ${state}`;
        }
    }

    async function startLocal() {
        try {
            errorToast = null;
            await provider.startCapture({ 
                onAudioData: () => {},
                onFrequencyData: (data) => traceManager.updateLiveTrace('live-1', data)
            });
            await orchestrator.runSequence("V A N F P X");
        } catch (e) {
            console.error(e);
        }
    }

    function downloadWav() {
        const link = document.createElement('a');
        link.href = '/signals/apst_full_sequence_48k.wav';
        link.download = 'apst_full_sequence_48k.wav';
        link.click();
    }

    function calculateDelay() {
        console.log("Iniciando cálculo de retardo (Simulación)...");
        // Simulamos un retardo aleatorio entre 10 y 100ms
        const simulatedDelay = (Math.random() * 90 + 10).toFixed(2);
        delayMs = parseFloat(simulatedDelay);
        console.log(`Retardo detectado: ${delayMs} ms`);
    }

    async function toggleGenerator() {
        genActive = !genActive;
        // Al encender manualmente, nos aseguramos de que el motor esté listo
        if (genActive) {
            await provider.startCapture({
                onAudioData: () => {},
                onFrequencyData: (data) => traceManager.updateLiveTrace('live-1', data)
            });
        }
    }
</script>

<aside class="sidebar" class:collapsed={isCollapsed}>
    <button class="mobile-toggle" onclick={() => isCollapsed = !isCollapsed}>
        {isCollapsed ? '↑ Controles' : '↓ Cerrar'}
    </button>

    <div class="tabs">
        <button class:active={activeTab === 'secuencial'} onclick={() => activeTab = 'secuencial'}>Secuencial</button>
        <button class:active={activeTab === 'manual'} onclick={() => activeTab = 'manual'}>Manual</button>
    </div>

    <div class="tab-content">
        {#if activeTab === 'secuencial'}
            <div class="secuencial-tab" in:fade>
                <select class="sequence-selector" bind:value={selectedSequence}>
                    <option>Completa (VANFP)</option>
                    <option>Verificación de ganancia (V)</option>
                    <option>Respuesta (F)</option>
                </select>

                <div class="status-card">
                    <span class="state-label">{translateState(orchestratorEvent.state)}</span>
                    {#if orchestratorEvent.message}
                        <p class="state-msg">{orchestratorEvent.message}</p>
                    {/if}
                </div>

                <div class="steps-list">
                    {#each sequenceSteps as step}
                        <div class="step-item" class:active={orchestratorEvent.currentHeader === step}>
                            <div class="step-info">
                                <span class="step-icon">
                                    {orchestratorEvent.currentHeader === step ? '📡' : '○'}
                                </span>
                                <span class="step-name">{step} - {stepNames[step]}</span>
                            </div>
                            <span class="numeric-result">
                                {orchestratorEvent.currentHeader === step ? '+3.2 dB' : 'N/A'}
                            </span>
                        </div>
                    {/each}
                </div>

                <div class="split-button">
                    <button class="btn-main" onclick={startLocal}>Iniciar</button>
                    <button class="btn-sub text-sub" onclick={downloadWav}>Descargar pista de prueba</button>
                </div>

                {#if errorToast}
                    <div class="error-toast" transition:slide>
                        <p>{errorToast}</p>
                        <button onclick={() => errorToast = null}>×</button>
                    </div>
                {/if}
            </div>
        {:else}
            <div class="manual-tab" in:fade>
                <div class="control-group">
                    <label>Tipo de señal</label>
                    <select bind:value={generatorType}>
                        <option value="pink">Ruido rosa</option>
                        <option value="white">Ruido blanco</option>
                        <option value="sine">Seno continuo</option>
                        <option value="sweep">Barrido logarítmico</option>
                    </select>
                </div>

                {#if generatorType === 'sine' || generatorType === 'sweep'}
                    <div class="control-group" transition:slide>
                        <label>Frecuencia</label>
                        <div class="input-sync">
                            <input type="range" min="20" max="20000" step="1" bind:value={genFreq} />
                            <input type="number" min="20" max="20000" bind:value={genFreq} />
                            <span>Hz</span>
                        </div>
                    </div>
                {/if}

                <div class="control-group">
                    <label>Nivel</label>
                    <div class="input-sync">
                        <input type="range" min="-60" max="0" step="0.1" bind:value={genLevel} />
                        <input type="number" min="-60" max="0" step="0.1" bind:value={genLevel} />
                        <span>dBFS</span>
                    </div>
                </div>

                <div class="control-group">
                    <label>Retardo (ms)</label>
                    <div class="input-sync">
                        <input type="number" min="0" max="2000" step="0.01" bind:value={delayMs} style="width: 100%" />
                    </div>
                </div>

                <div class="control-group">
                    <label>Ruteo</label>
                    <div class="routing-radios">
                        {#each ['L', 'R', 'Stereo'] as r}
                            <label class="radio-label" class:selected={genRouting === r}>
                                <input type="radio" name="routing" value={r} bind:group={genRouting} />
                                {r}
                            </label>
                        {/each}
                    </div>
                </div>

                <button 
                    class="btn-generator" 
                    class:active={genActive}
                    onclick={toggleGenerator}
                >
                    {genActive ? 'Detener generador' : 'Prender generador'}
                </button>

                <button class="btn-find-delay" onclick={calculateDelay}>Calcular retardo</button>
            </div>
        {/if}
    </div>
</aside>

<style>
    .sidebar {
        width: 320px;
        height: 100%;
        background: #101014;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        color: #fff;
        z-index: 100;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .tabs {
        display: flex;
        padding: 8px;
        gap: 4px;
        background: #000;
    }

    .tabs button {
        flex: 1;
        background: transparent;
        border: none;
        color: #666;
        padding: 10px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .tabs button.active {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
    }

    .tab-content {
        flex: 1;
        padding: 1.5rem;
        overflow-y: auto;
        position: relative;
    }

    .sequence-selector {
        width: 100%;
        background: #1a1a20;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 1.5rem;
        outline: none;
        font-size: 0.9rem;
    }

    .status-card {
        background: #1a1a20;
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1.5rem;
        border-left: 4px solid #3b82f6;
    }

    .state-label {
        font-size: 0.7rem;
        font-weight: 900;
        text-transform: uppercase;
        color: #3b82f6;
    }

    .state-msg {
        margin: 4px 0 0;
        font-size: 0.9rem;
        color: #ccc;
    }

    .steps-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 2rem;
    }

    .step-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: #666;
        transition: color 0.2s;
    }

    .step-item.active {
        color: #00ff88;
    }

    .step-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .numeric-result {
        font-family: monospace;
        font-size: 0.75rem;
        opacity: 0.6;
    }

    .step-icon {
        font-size: 1.2rem;
    }

    .split-button {
        display: flex;
        gap: 1px;
    }

    .btn-main {
        flex: 1;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 12px 0 0 12px;
        min-height: 44px;
        font-weight: bold;
        cursor: pointer;
    }

    .btn-sub {
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 0 12px 12px 0;
        cursor: pointer;
        padding: 0 16px;
        font-size: 0.7rem;
        font-weight: 600;
        white-space: nowrap;
    }

    .error-toast {
        position: absolute;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 8px 16px rgba(0,0,0,0.4);
        z-index: 50;
    }

    .error-toast p {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 600;
    }

    .error-toast button {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
    }

    /* Manual Tab Styles */
    .control-group {
        margin-bottom: 1.5rem;
    }

    .control-group label {
        display: block;
        font-size: 0.7rem;
        color: #888;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
    }

    .control-group select {
        width: 100%;
        background: #1a1a20;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        padding: 8px;
        border-radius: 8px;
        outline: none;
    }

    .input-sync {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .input-sync input[type="range"] {
        flex: 1;
        accent-color: #3b82f6;
    }

    .input-sync input[type="number"] {
        width: 65px;
        background: #1a1a20;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        padding: 6px;
        border-radius: 6px;
        text-align: center;
        font-family: monospace;
    }

    .input-sync span {
        font-size: 0.75rem;
        color: #666;
        min-width: 35px;
    }

    .routing-radios {
        display: flex;
        background: #000;
        padding: 4px;
        border-radius: 10px;
        gap: 4px;
    }

    .radio-label {
        flex: 1;
        text-align: center;
        padding: 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        color: #666;
        transition: all 0.2s;
    }

    .radio-label.selected {
        background: #3b82f6;
        color: #fff;
    }

    .radio-label input {
        display: none;
    }

    .btn-generator {
        width: 100%;
        min-height: 48px;
        margin-top: 1.5rem;
        background: transparent;
        border: 1px solid #3b82f6;
        color: #3b82f6;
        border-radius: 12px;
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-generator.active {
        background: #ef4444;
        border-color: #ef4444;
        color: #fff;
    }

    .btn-find-delay {
        width: 100%;
        min-height: 48px;
        margin-top: 12px;
        background: #333;
        color: #fff;
        border: none;
        border-radius: 12px;
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
    }

    .mobile-toggle {
        display: none;
    }

    @media (max-width: 768px) {
        .sidebar {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: auto;
            max-height: 80vh;
            border-right: none;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            transform: translateY(0);
        }

        .sidebar.collapsed {
            transform: translateY(calc(100% - 50px));
        }

        .mobile-toggle {
            display: block;
            width: 100%;
            height: 50px;
            background: #000;
            color: #fff;
            border: none;
            font-weight: bold;
        }
    }
</style>
