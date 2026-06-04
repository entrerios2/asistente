<script lang="ts">
    import { onMount } from 'svelte';
    import Header from '../components/medicion/Header.svelte';
    import Sidebar from '../components/medicion/Sidebar.svelte';
    import ViewGrid from '../components/medicion/ViewGrid.svelte';
    import { traceManager } from '$lib/stores/traceManager.svelte';
    import { uiStore } from '$lib/stores/ui.svelte';

    onMount(() => {
        // Hotkeys globales
        const handleKey = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                traceManager.captureSnapshot('live-1', 'Captura manual', 'manual');
            } else if (e.code === 'KeyD') {
                console.log("Disparando Find Delay");
            } else if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                const snapshots = traceManager.snapshots;
                if (snapshots[index]) {
                    traceManager.toggleVisibility(snapshots[index].id);
                }
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    });
</script>

<div class="app-layout">
    <Header />
    <div class="app-container">
        <div class="sidebar-wrapper transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 {uiStore.showSidebar ? 'w-[380px]' : 'w-0 border-none'}">
            <Sidebar />
        </div>
        
        <main class="main-viewport">
            <ViewGrid />
        </main>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        background-color: #000;
        overflow: hidden;
        font-family: 'Inter', -apple-system, sans-serif;
    }

    .app-layout {
        display: flex;
        flex-direction: column;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
    }

    .app-container {
        display: flex;
        flex: 1;
        overflow: hidden;
        background: #000;
    }

    .main-viewport {
        flex: 1;
        height: 100%;
        position: relative;
        overflow: hidden;
    }

    @media (max-width: 768px) {
        .app-container {
            flex-direction: column;
        }

        .main-viewport {
            height: calc(100vh - 100px); /* Ajustado por Header y Bottom Sheet */
        }
    }
</style>
