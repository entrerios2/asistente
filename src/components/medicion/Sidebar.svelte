<script lang="ts">
    import { uiStore } from '$lib/stores/ui.svelte';

    let activeTab = $state('medicion'); // 'medicion' | 'eq' | 'snaps' | 'config'
</script>

<aside class="w-[380px] h-full bg-[#0a0a0c] border-r border-[#1a1a24]/50 flex flex-row text-gray-200 select-none">
    <!-- Pestañas Laterales -->
    <nav class="w-[60px] bg-[#050507] border-r border-[#1a1a24]/50 flex flex-col items-center py-4 gap-2">
        <button
            class="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px]
                   {activeTab === 'medicion' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
            onclick={() => activeTab = 'medicion'}
            title="Medición"
        >
            <span class="material-symbols-outlined text-[22px]">cadence</span>
        </button>

        <button
            class="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px]
                   {activeTab === 'eq' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
            onclick={() => activeTab = 'eq'}
            title="Ecualización"
        >
            <span class="material-symbols-outlined text-[22px]">instant_mix</span>
        </button>

        <button
            class="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px]
                   {activeTab === 'snaps' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
            onclick={() => activeTab = 'snaps'}
            title="Instantáneas"
        >
            <span class="material-symbols-outlined text-[22px]">screenshot_frame_2</span>
        </button>

        <button
            class="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px]
                   {activeTab === 'config' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
            onclick={() => activeTab = 'config'}
            title="Configuración"
        >
            <span class="material-symbols-outlined text-[22px]">settings</span>
        </button>
    </nav>

    <!-- Contenido Principal del Sidebar -->
    <div class="flex-1 h-full overflow-hidden flex flex-col">
        {#if activeTab === 'medicion'}
            <div class="flex-1 p-6 overflow-y-auto flex flex-col gap-6" id="panel-medicion">
                <!-- Contenido de Medición -->
            </div>
        {:else if activeTab === 'eq'}
            <div class="flex-1 p-6 overflow-y-auto flex flex-col gap-6" id="panel-eq">
                <!-- Contenido de Ecualización -->
            </div>
        {:else if activeTab === 'snaps'}
            <div class="flex-1 p-6 overflow-y-auto flex flex-col gap-6" id="panel-snaps">
                <!-- Contenido de Instantáneas -->
            </div>
        {:else if activeTab === 'config'}
            <div class="flex-1 p-6 overflow-y-auto flex flex-col gap-6" id="panel-config">
                <!-- Contenido de Configuración -->
            </div>
        {/if}
    </div>
</aside>
