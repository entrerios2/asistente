<script lang="ts">
    import { getAudioProvider } from '$lib/hal';
    import { Orchestrator, type OrchestratorEvent } from '$lib/dsp/apst/Orchestrator';
    import { Player } from '$lib/dsp/apst/Player';
    import { fade, slide } from 'svelte/transition';

    const provider = getAudioProvider();
    const player = new Player(provider);
    const orchestrator = new Orchestrator(player, provider);

    let activeTab = $state('secuencial'); // 'secuencial' | 'manual'
    let orchestratorEvent = $state<OrchestratorEvent>({ state: 'IDLE' });
    let isCollapsed = $state(true);

    orchestrator.subscribe((event) => {
        orchestratorEvent = event;
    });

    const sequenceSteps = ['V', 'A', 'N', 'F', 'P', 'X'];

    async function startLocal() {
        try {
            await provider.startCapture({ onAudioData: () => {} });
            await orchestrator.runSequence("V A N F P X");
        } catch (e) {
            console.error(e);
        }
    }

    function downloadWav() {
        // Simulación de descarga de secuencia
        const link = document.createElement('a');
        link.href = '/signals/apst_full_sequence_48k.wav';
        link.download = 'apst_full_sequence_48k.wav';
        link.click();
    }

    function playPink() { provider.playPinkNoise(true); }
    function stopPink() { provider.playPinkNoise(false); }
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
                <div class="status-card">
                    <span class="state-label">{orchestratorEvent.state}</span>
                    {#if orchestratorEvent.message}
                        <p class="state-msg">{orchestratorEvent.message}</p>
                    {/if}
                </div>

                <div class="steps-list">
                    {#each sequenceSteps as step}
                        <div class="step-item" class:active={orchestratorEvent.currentHeader === step}>
                            <div class="step-icon">
                                {orchestratorEvent.currentHeader === step ? '📡' : '○'}
                            </div>
                            <span class="step-name">Segmento {step}</span>
                        </div>
                    {/each}
                </div>

                <div class="actions">
                    <button class="btn-primary" onclick={startLocal}>Iniciar Secuencia</button>
                    <button class="btn-secondary" onclick={downloadWav}>Descargar WAV</button>
                </div>
            </div>
        {:else}
            <div class="manual-tab" in:fade>
                <h3>Generador Proactivo</h3>
                <div class="manual-grid">
                    <button class="manual-btn pink" onmousedown={playPink} onmouseup={stopPink}>
                        Ruido Rosa
                    </button>
                    <button class="manual-btn white">
                        Ruido Blanco
                    </button>
                    <button class="manual-btn sweep">
                        Barrido (Sweep)
                    </button>
                    <button class="manual-btn impulse">
                        Impulso
                    </button>
                </div>
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
        gap: 12px;
        color: #666;
        transition: color 0.2s;
    }

    .step-item.active {
        color: #00ff88;
    }

    .step-icon {
        font-size: 1.2rem;
    }

    .actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .btn-primary, .btn-secondary, .manual-btn {
        min-height: 44px; /* Área táctil mínima */
        border-radius: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-primary {
        background: #3b82f6;
        color: white;
        border: none;
    }

    .btn-secondary {
        background: rgba(255, 255, 255, 0.05);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .manual-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }

    .manual-btn {
        background: #1a1a20;
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: #ccc;
        font-size: 0.75rem;
    }

    .manual-btn:active {
        background: #3b82f6;
        color: white;
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
