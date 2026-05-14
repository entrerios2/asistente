<script lang="ts">
    import { traceManager } from '$lib/stores/traceManager.svelte';
    import { uiStore } from '$lib/stores/ui.svelte';
    import { flip } from 'svelte/animate';
    import { fade, slide } from 'svelte/transition';

    let sortBy = $state('date'); // 'date' | 'location'

    // Usamos el getter reactivo de snapshots y aplicamos el ordenamiento
    const sortedSnapshots = $derived(
        [...traceManager.snapshots].sort((a, b) => {
            if (sortBy === 'date') return b.timestamp - a.timestamp;
            return a.source.localeCompare(b.source);
        })
    );

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

<aside class="snapshot-panel" class:collapsed={!uiStore.showSnapshots}>
    <header class="panel-header">
        <h2>Instantáneas</h2>
        <span class="count">{sortedSnapshots.length}</span>
    </header>

    <div class="sort-tabs">
        <button class:active={sortBy === 'date'} onclick={() => sortBy = 'date'}>Por fecha</button>
        <button class:active={sortBy === 'location'} onclick={() => sortBy = 'location'}>Por ubicación</button>
    </div>

    <div class="snapshot-list">
        {#if sortedSnapshots.length === 0}
            <div class="empty-state" in:fade>
                <p>No hay capturas guardadas</p>
                <span>Captura un trazo en vivo para empezar</span>
            </div>
        {/if}

        {#each sortedSnapshots as snap (snap.id)}
            <div 
                class="snapshot-item" 
                animate:flip={{ duration: 300 }}
                in:fade={{ duration: 200 }}
                class:hidden={!snap.visible}
            >
                <div class="item-main">
                    <div class="source-icon" title={snap.source}>
                        {snap.source === 'manual' ? '🖱️' : '⚙️'}
                    </div>
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
                    <label for="offset-{snap.id}">Desplazamiento Y</label>
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
        background: #101014;
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        color: #e0e0e0;
        font-family: 'Inter', system-ui, sans-serif;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
    }

    .snapshot-panel.collapsed {
        transform: translateX(100%);
        margin-right: -300px;
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
        font-size: 1rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
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

    .sort-tabs {
        display: flex;
        padding: 8px;
        gap: 4px;
        background: #000;
    }

    .sort-tabs button {
        flex: 1;
        background: transparent;
        border: none;
        color: #666;
        padding: 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .sort-tabs button.active {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
    }

    .snapshot-list {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .snapshot-item {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 0.75rem;
        transition: all 0.2s ease;
    }

    .item-main {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    .source-icon {
        font-size: 1.2rem;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
    }

    .info {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .name {
        font-size: 0.85rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #fff;
    }

    .timestamp {
        font-size: 0.7rem;
        color: #666;
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
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .item-controls {
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        padding-top: 0.75rem;
    }

    .item-controls label {
        display: block;
        font-size: 0.65rem;
        color: #666;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        font-weight: 800;
    }

    .slider-group {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    input[type="range"] {
        flex: 1;
        accent-color: #3b82f6;
    }

    .offset-value {
        font-size: 0.75rem;
        font-family: monospace;
        color: #3b82f6;
        min-width: 45px;
        text-align: right;
    }
</style>
