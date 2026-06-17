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
    <div class="app-container" style="position: relative;">
        {#if uiStore.showSidebar}
            <div class="sidebar-wrapper transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0" style="width: 380px; transition: width 300ms ease, opacity 300ms ease;">
                <Sidebar />
            </div>
        {/if}
        
        <!-- BOTÓN FLOTANTE COLAPSAR/ABRIR SIDEBAR -->
        <button
            class="absolute z-50 w-5 h-12 flex items-center justify-center
                   bg-amber-500 border border-amber-400 rounded-r-lg
                   text-white hover:bg-amber-400
                   transition-all duration-300 cursor-pointer shadow-lg"
            style="top: 50%; transform: translateY(-50%); left: {uiStore.showSidebar ? '380px' : '0px'};"
            onclick={() => uiStore.showSidebar = !uiStore.showSidebar}
            title="{uiStore.showSidebar ? 'Colapsar' : 'Abrir'} Panel"
        >
            <span class="material-symbols-outlined text-[14px]">
                {uiStore.showSidebar ? 'chevron_left' : 'chevron_right'}
            </span>
        </button>
        
        <main class="main-viewport">
            <ViewGrid />
        </main>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        background-color: var(--bg-primary);
        overflow: hidden;
        font-family: 'Inter', -apple-system, sans-serif;
    }

    .app-layout {
        display: flex;
        flex-direction: column;
        width: 100vw;
        height: 100vh;  /* fallback */
        height: 100dvh; /* preferido */
        overflow: hidden;
    }

    .app-container {
        display: flex;
        flex: 1;
        overflow: hidden;
        background: var(--bg-secondary);
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
            height: calc(100vh - 100px);   /* fallback */
            height: calc(100dvh - 100px);  /* preferido */
        }
    }
</style>
