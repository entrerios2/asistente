<script lang="ts">
    import Quadrant from './Quadrant.svelte';
    import { uiStore } from '$lib/stores/ui.svelte';

    const quadrants = $derived(
        uiStore.layout === '1x1' ? 1 :
        (uiStore.layout === '1x2' || uiStore.layout === '2x1') ? 2 :
        uiStore.layout === '3x1' ? 3 :
        uiStore.layout === '2x2' ? 4 : 6
    );
</script>

<div class="view-grid layout-{uiStore.layout}">
    {#each Array(quadrants) as _, i}
        <Quadrant id="q-{i + 1}" />
    {/each}
</div>

<style>
    .view-grid {
        display: grid;
        gap: 4px;
        background: #050507;
        width: 100%;
        height: 100%;
        padding: 4px;
        box-sizing: border-box;
        overflow: hidden;
    }

    .layout-1x1 { grid-template-rows: 1fr; grid-template-columns: 1fr; }
    .layout-1x2 { grid-template-rows: 1fr; grid-template-columns: 1fr 1fr; }
    .layout-2x1 { grid-template-rows: 1fr 1fr; grid-template-columns: 1fr; }
    .layout-2x2 { grid-template-rows: 1fr 1fr; grid-template-columns: 1fr 1fr; }
    .layout-3x1 { grid-template-rows: 1fr 1fr 1fr; grid-template-columns: 1fr; }
    .layout-3x2 { grid-template-rows: 1fr 1fr 1fr; grid-template-columns: 1fr 1fr; }

    @media (max-width: 768px) {
        .view-grid {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            grid-template-columns: none;
            grid-template-rows: none;
        }

        .view-grid :global(.quadrant-container) {
            flex: 0 0 100%;
            scroll-snap-align: start;
            height: 100%;
        }
    }
</style>
