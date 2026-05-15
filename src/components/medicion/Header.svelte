<script lang="ts">
    import { meterStore } from '$lib/stores/meterStore.svelte';

    function getVuWidth(db: number) {
        // Normalización: -60 a 0 dB -> 0 a 100%
        return Math.max(0, Math.min(100, (db + 60) * (100 / 60)));
    }
</script>

<header class="global-header">
    <div class="header-left">
        <h1 class="header-title">Herramienta para mediciones de audio</h1>
    </div>

    <div class="header-right">
        <div class="vu-container">
            <div class="vu-group">
                <span class="vu-label">IN</span>
                <div class="vu-bars">
                    {#each meterStore.inLevels as level}
                        <div class="vu-track">
                            <div class="vu-fill in" style="width: {getVuWidth(level)}%"></div>
                        </div>
                    {/each}
                </div>
            </div>

            <div class="vu-group">
                <span class="vu-label">OUT</span>
                <div class="vu-bars">
                    {#each meterStore.outLevels as level}
                        <div class="vu-track">
                            <div class="vu-fill out" style="width: {getVuWidth(level)}%"></div>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    </div>
</header>

<style>
    .global-header {
        height: 50px;
        background: #0a0a0c;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px;
        color: #fff;
        flex-shrink: 0;
        z-index: 1000;
    }

    .header-title {
        font-size: 0.9rem;
        font-weight: 500;
        color: #888;
        margin: 0;
    }

    .vu-container {
        display: flex;
        gap: 30px;
    }

    .vu-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .vu-label {
        font-size: 0.6rem;
        font-weight: 900;
        color: #444;
        width: 25px;
    }

    .vu-bars {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .vu-track {
        width: 140px;
        height: 4px;
        background: #1a1a20;
        border-radius: 2px;
        overflow: hidden;
    }

    .vu-fill {
        height: 100%;
        transition: width 0.05s linear;
        border-radius: 2px;
    }

    .vu-fill.in {
        background: linear-gradient(90deg, #00ff88, #3b82f6);
    }

    .vu-fill.out {
        background: linear-gradient(90deg, #facc15, #ef4444);
    }
</style>
