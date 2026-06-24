<script lang="ts">
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { eqStore } from "$lib/stores/eqStore.svelte";

    import TabMedicion from "./TabMedicion.svelte";
    import TabEcualizar from "./TabEcualizar.svelte";
    import TabInstantaneas from "./TabInstantaneas.svelte";
    import TabConfig from "./TabConfig.svelte";

    let statusText = $state("Listo para medir");

    const snapCount = $derived(traceManager.instantaneas.length);

    function toggleMeasurement() {
        uiStore.isMeasuring = !uiStore.isMeasuring;
    }
</script>

<aside
    class="w-[380px] h-full border-r flex flex-col select-none"
    style="background: var(--bg-secondary); border-color: var(--border-primary); color: var(--text-primary)"
>
    <!-- CABECERA DE PESTAÑAS Y CONTROL (PROMPT 11) -->
    <div class="flex items-center border-b px-2 py-1.5 gap-0.5 h-[60px] flex-shrink-0" style="background: var(--bg-primary); border-color: var(--border-primary)">
        <nav class="flex-1 flex items-center gap-0.5">
            {#each [
                { id: 'medicion', icon: 'podcasts', label: 'MEDIR' },
                { id: 'eq', icon: 'cadence', label: 'ECUALIZAR' },
                { id: 'snaps', icon: 'photo_camera', label: 'INSTANTÁNEA' },
                { id: 'config', icon: 'settings', label: 'CONFIG' },
            ] as tab}
                <button
                    class="relative flex-1 h-[48px] rounded-lg flex flex-col items-center justify-center transition-all duration-200 cursor-pointer gap-0.5
                           {uiStore.activeTab === tab.id
                        ? 'tab-active'
                        : 'tab-inactive'}"
                    onclick={() => (uiStore.activeTab = tab.id)}
                    title={tab.label}
                >
                    <span class="material-symbols-outlined text-[20px]">{tab.icon}</span>
                    <span class="text-[7px] font-bold uppercase tracking-wider leading-none">{tab.label}</span>
                    {#if tab.id === 'snaps' && snapCount > 0}
                        <span class="absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center text-white text-[8px] font-bold rounded-full px-1" style="background: var(--accent)">
                            {snapCount}
                        </span>
                    {/if}
                </button>
            {/each}
        </nav>
    </div>

    <!-- Contenido Principal del Sidebar -->
    <div class="flex-1 h-full overflow-hidden flex flex-col" style="background: var(--bg-secondary)">
        {#if uiStore.activeTab === "medicion"}
            <TabMedicion bind:statusText />
        {:else if uiStore.activeTab === "eq"}
            <TabEcualizar bind:statusText />
        {:else if uiStore.activeTab === "snaps"}
            <TabInstantaneas bind:statusText />
        {:else if uiStore.activeTab === "config"}
            <TabConfig />
        {/if}
    </div>

    <!-- FOOTER DE ACCIÓN UNIFICADO -->
    {#if uiStore.activeTab !== 'config'}
        <div class="sidebar-action-footer">
            {#if uiStore.activeTab === 'medicion'}
                <button
                    class="sidebar-action-btn {uiStore.isMeasuring ? 'action-stop' : 'action-primary'}"
                    onclick={toggleMeasurement}
                >
                    <span class="material-symbols-outlined">{uiStore.isMeasuring ? 'stop' : 'podcasts'}</span>
                    {uiStore.isMeasuring ? 'Detener' : 'Medir'}
                </button>
            {:else if uiStore.activeTab === 'eq'}
                <button
                    class="sidebar-action-btn action-primary {eqStore.isCalculatingAutoEQ ? 'action-disabled' : ''}"
                    disabled={eqStore.isCalculatingAutoEQ}
                    onclick={() => {
                        eqStore.showEQ = true;
                        if (uiStore.isMeasuring) {
                            eqStore.autoEQSourceType = 'live';
                        }
                    }}
                >
                    <svg class="sidebar-eq-icon" viewBox="0 0 97348 102870" fill="currentColor">
                        <path d="M0 64050l0-9303 5435 0c3462 0 6691-851 9670-2534 2980-1701 5396-4023 7253-7020 2747-4584 6403-8182 11005-10812 4585-2611 9593-3927 14991-3927 5396 0 10404 1316 14989 3927 4603 2630 8258 6228 11005 10812 1857 2998 4274 5319 7253 7020 2979 1683 6208 2534 9670 2534l5435 0 0 9303-5318 0c-5087 0-9846-1238-14333-3733-4467-2495-7987-5937-10560-10289-1857-3211-4411-5725-7620-7542-3231-1819-6732-2728-10521-2728-3715 0-7177 909-10406 2728-3212 1817-5745 4331-7602 7542-2592 4352-6112 7795-10580 10289-4467 2495-9245 3733-14331 3733l-5435 0z"/>
                        <rect x="82568" y="79041" width="9303" height="9322"/>
                        <rect x="4834" y="79041" width="9304" height="9322"/>
                        <rect x="63226" y="64419" width="9188" height="30305"/>
                        <rect x="24292" y="64419" width="9188" height="30305"/>
                        <rect x="43769" y="49912" width="9168" height="52957"/>
                        <path d="M76617 810l2160 9518c955 4204 4039 7288 8243 8243l9518 2160-9518 2161c-4204 954-7288 4039-8243 8243l-2160 9518-2161-9518c-954-4204-4039-7289-8243-8243l-9518-2161 9518-2160c4204-955 7289-4039 8243-8243l2161-9518z"/>
                    </svg>
                    {eqStore.isCalculatingAutoEQ ? 'Calculando...' : 'Calcular ecualización'}
                </button>
            {:else if uiStore.activeTab === 'snaps'}
                <button
                    class="sidebar-action-btn action-primary"
                    onclick={() => traceManager.captureInstantanea()}
                >
                    <span class="material-symbols-outlined">photo_camera</span>
                    Capturar
                </button>
            {/if}
        </div>
    {/if}
</aside>

<style>
    /* Tab states */
    .tab-active {
        background: color-mix(in srgb, var(--accent) 10%, transparent);
        color: var(--accent);
        border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
    }
    .tab-inactive {
        color: var(--text-muted);
    }
    .tab-inactive:hover {
        color: var(--text-secondary);
        background: color-mix(in srgb, var(--text-primary) 5%, transparent);
    }

    .sidebar-action-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--border-primary);
        flex-shrink: 0;
        background: var(--bg-secondary);
    }

    .sidebar-action-btn {
        width: 100%;
        min-height: 48px;
        border-radius: var(--radius-lg);
        font-weight: 700;
        font-size: var(--text-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        border: none;
        color: white;
        transition: all var(--transition-slow);
        box-shadow: var(--shadow-md);
    }

    .sidebar-action-btn.action-primary {
        background: linear-gradient(to right, var(--accent), var(--accent-hover));
    }
    .sidebar-action-btn.action-primary:hover {
        filter: brightness(1.1);
    }

    .sidebar-action-btn.action-stop {
        background: linear-gradient(to right, var(--accent-red), color-mix(in srgb, var(--accent-red) 85%, black));
    }
    .sidebar-action-btn.action-stop:hover {
        opacity: 0.9;
    }

    .sidebar-action-btn.action-disabled {
        opacity: 0.7;
        pointer-events: none;
    }

    .sidebar-eq-icon {
        width: 22px;
        height: 22px;
        flex-shrink: 0;
    }
</style>
