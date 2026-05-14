<script lang="ts">
    import { traceManager } from '$lib/stores/traceManager.svelte';
    import { flip } from 'svelte/animate';
    import { fade, slide } from 'svelte/transition';

    // Usamos el getter reactivo de snapshots
    const snapshots = $derived(traceManager.snapshots);

    function handleToggle(id: string) {
        traceManager.toggleVisibility(id);
    }

    function handleRemove(id: string) {
        traceManager.removeTrace(id);
    }

    function handleOffsetChange(id: string, event: Event) {
        const value = parseFloat((event.target as HTMLInputElement).value);
        traceManager.setYOffset(id, value);
    }
</script>

<aside class="snapshot-panel" transition:slide={{ axis: 'x' }}>
    <header class="panel-header">
        <h2>Snapshots</h2>
        <span class="count">{snapshots.length}</span>
    </header>

    <div class="snapshot-list">
        {#if snapshots.length === 0}
            <div class="empty-state" in:fade>
                <p>No hay capturas guardadas</p>
                <span>Captura un trazo Live para empezar</span>
            </div>
        {/if}

        {#each snapshots as snap (snap.id)}
            <div 
                class="snapshot-item" 
                animate:flip={{ duration: 300 }}
                in:fade={{ duration: 200 }}
                class:hidden={!snap.visible}
            >
                <div class="item-main">
                    <div class="color-indicator" style="background-color: {snap.color}"></div>
                    <div class="info">
                        <span class="name">{snap.name}</span>
                        <span class="timestamp">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                    </div>
                    
                    <div class="actions">
                        <button 
                            class="action-btn eye-btn" 
                            onclick={() => handleToggle(snap.id)}
                            title={snap.visible ? 'Ocultar' : 'Mostrar'}
                        >
                            {#if snap.visible}
                                👁️
                            {:else}
                                👓
                            {/if}
                        </button>
                        <button 
                            class="action-btn delete-btn" 
                            onclick={() => handleRemove(snap.id)}
                            title="Eliminar"
                        >
                            🗑️
                        </button>
                    </div>
                </div>

                <div class="item-controls">
                    <label for="offset-{snap.id}">Offset Y</label>
                    <div class="slider-group">
                        <input 
                            id="offset-{snap.id}"
                            type="range" 
                            min="-20" 
                            max="20" 
                            step="0.5" 
                            value={snap.offsetY} 
                            oninput={(e) => handleOffsetChange(snap.id, e)}
                        />
                        <span class="offset-value">{snap.offsetY > 0 ? '+' : ''}{snap.offsetY} dB</span>
                    </div>
                </div>
            </div>
        {/each}
    </div>
</aside>

<style>
    .snapshot-panel {
        width: 300px;
        height: 100%;
        background: rgba(20, 20, 25, 0.9);
        backdrop-filter: blur(12px);
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        color: #e0e0e0;
        font-family: 'Inter', system-ui, sans-serif;
    }

    .panel-header {
        padding: 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .panel-header h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        letter-spacing: 0.5px;
        color: #fff;
    }

    .count {
        background: #3b82f6;
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: bold;
    }

    .snapshot-list {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .snapshot-list::-webkit-scrollbar {
        width: 4px;
    }

    .snapshot-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
    }

    .empty-state {
        text-align: center;
        padding: 2rem;
        color: #666;
    }

    .empty-state p {
        margin: 0;
        font-size: 0.9rem;
    }

    .empty-state span {
        font-size: 0.75rem;
        opacity: 0.7;
    }

    .snapshot-item {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 0.75rem;
        transition: all 0.2s ease;
    }

    .snapshot-item:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.1);
    }

    .snapshot-item.hidden {
        opacity: 0.5;
        filter: grayscale(0.5);
    }

    .item-main {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    .color-indicator {
        width: 4px;
        height: 32px;
        border-radius: 2px;
        box-shadow: 0 0 8px currentColor;
    }

    .info {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .name {
        font-size: 0.9rem;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #fff;
    }

    .timestamp {
        font-size: 0.7rem;
        color: #888;
    }

    .actions {
        display: flex;
        gap: 4px;
    }

    .action-btn {
        background: transparent;
        border: none;
        color: #888;
        padding: 6px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
    }

    .action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
    }

    .delete-btn:hover {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
    }

    .item-controls {
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        padding-top: 0.75rem;
    }

    .item-controls label {
        display: block;
        font-size: 0.7rem;
        color: #888;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .slider-group {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    input[type="range"] {
        flex: 1;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        appearance: none;
        outline: none;
    }

    input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        width: 12px;
        height: 12px;
        background: #3b82f6;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.1s;
    }

    input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }

    .offset-value {
        font-size: 0.75rem;
        font-family: monospace;
        color: #3b82f6;
        min-width: 45px;
        text-align: right;
    }
</style>
