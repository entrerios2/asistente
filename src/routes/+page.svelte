<script lang="ts">
    import { onMount } from 'svelte';
    import Sidebar from '../components/medicion/Sidebar.svelte';
    import ViewGrid from '../components/medicion/ViewGrid.svelte';
    import SnapshotPanel from '../components/medicion/SnapshotPanel.svelte';
    import { traceManager } from '$lib/stores/traceManager.svelte';
    import { detectTier } from '$lib/utils/tierDetector';

    let tier = $state<string | null>(null);

    onMount(() => {
        tier = detectTier();

        // Hotkeys Globales
        const handleKey = (e: KeyboardEvent) => {
            // Prevenir scroll con espacio
            if (e.code === 'Space') {
                e.preventDefault();
                // En una implementación real, buscaríamos el cuadrante activo
                // Por ahora capturamos el snapshot del flujo principal
                traceManager.captureSnapshot('live-1', 'HotKey Capture');
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    });
</script>

<div class="app-container">
    <Sidebar />
    
    <main class="main-viewport">
        <ViewGrid layout="2x2" />
    </main>

    <SnapshotPanel />
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        background-color: #000;
        overflow: hidden;
        font-family: 'Inter', -apple-system, sans-serif;
    }

    .app-container {
        display: flex;
        width: 100vw;
        height: 100vh;
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
            height: calc(100vh - 50px); /* Ajustado por el Bottom Sheet */
        }
    }
</style>
