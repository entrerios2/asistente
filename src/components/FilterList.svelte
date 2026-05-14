<script lang="ts">
    import { calibrationStore } from '$lib/stores/calibrationStore.svelte';

    const filters = calibrationStore.suggestedFilters;

    function removeFilter(index: number) {
        calibrationStore.removeFilter(index);
    }
</script>

<div class="filter-panel">
    <div class="header">
        <h3>FILTROS SUGERIDOS</h3>
        <button class="add-btn" onclick={() => calibrationStore.addFilter({ frequency: 1000, gain: 0, q: 1.0, type: 'peaking', enabled: true })}>
            + AÑADIR
        </button>
    </div>

    <div class="filter-list">
        {#if calibrationStore.suggestedFilters.length === 0}
            <p class="empty-msg">No hay filtros activos. Inicia AutoEq o añade uno manual.</p>
        {:else}
            {#each calibrationStore.suggestedFilters as filter, i}
                <div class="filter-card" class:disabled={!filter.enabled}>
                    <div class="filter-controls">
                        <div class="control-group">
                            <label>FRECUENCIA (Hz)</label>
                            <input type="number" bind:value={filter.frequency} min="20" max="20000" />
                            <input type="range" bind:value={filter.frequency} min="20" max="20000" step="1" />
                        </div>

                        <div class="control-group">
                            <label>GANANCIA (dB)</label>
                            <input type="number" bind:value={filter.gain} min="-18" max="12" step="0.1" />
                            <input type="range" bind:value={filter.gain} min="-18" max="12" step="0.1" />
                        </div>

                        <div class="control-group">
                            <label>Q (Ancho)</label>
                            <input type="number" bind:value={filter.q} min="0.1" max="10" step="0.1" />
                            <input type="range" bind:value={filter.q} min="0.1" max="10" step="0.1" />
                        </div>
                    </div>

                    <div class="actions">
                        <button class="toggle-btn" onclick={() => filter.enabled = !filter.enabled}>
                            {filter.enabled ? 'ON' : 'OFF'}
                        </button>
                        <button class="delete-btn" onclick={() => removeFilter(i)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<style>
    .filter-panel {
        background: #1a1a1a;
        padding: 24px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: white;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
    }

    h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 1px;
        color: rgba(255, 255, 255, 0.4);
    }

    .add-btn {
        background: #00ff88;
        color: #000;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s;
    }

    .add-btn:hover {
        transform: scale(1.05);
    }

    .filter-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .filter-card {
        background: #242424;
        padding: 16px;
        border-radius: 12px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border: 1px solid rgba(255, 255, 255, 0.05);
        transition: opacity 0.3s;
    }

    .filter-card.disabled {
        opacity: 0.4;
    }

    .filter-controls {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        flex: 1;
    }

    .control-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    label {
        font-size: 10px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.4);
    }

    input[type="number"] {
        background: transparent;
        border: none;
        color: #00ff88;
        font-size: 16px;
        font-weight: 700;
        outline: none;
        width: 80px;
    }

    input[type="range"] {
        accent-color: #00ff88;
        cursor: pointer;
    }

    .actions {
        display: flex;
        gap: 8px;
        margin-left: 24px;
    }

    .toggle-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 800;
        width: 50px;
    }

    .delete-btn {
        background: rgba(255, 68, 68, 0.1);
        border: none;
        color: #ff4444;
        padding: 8px;
        border-radius: 6px;
        cursor: pointer;
    }

    .delete-btn:hover {
        background: rgba(255, 68, 68, 0.2);
    }

    .empty-msg {
        text-align: center;
        color: rgba(255, 255, 255, 0.3);
        padding: 40px;
        font-size: 13px;
        font-style: italic;
    }
</style>
