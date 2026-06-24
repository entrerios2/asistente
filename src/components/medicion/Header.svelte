<script lang="ts">
    import { meterStore } from "$lib/stores/meterStore.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { traceManager } from "$lib/stores/traceManager.svelte";
    import { eqStore } from "$lib/stores/eqStore.svelte";


    // Inline EQ icon paths (from images/eq.svg) for currentColor support

    // Nombres cortos para sub-label del generador
    const shortGenNames: Record<string, string> = {
        pink: "pnk", white: "wht", brown: "brn", "music-noise": "mus",
        music: "mus", sine: "sin", sweep: "swp", burst: "bst",
        sinburst: "sbt", mls: "mls",
    };

    // Nombres legibles para las señales (tooltip)
    const signalNames: Record<string, string> = {
        pink: "Ruido Rosa", white: "Ruido Blanco", brown: "Ruido Brown",
        "music-noise": "Music Noise", sine: "Seno Continuo", sweep: "Sweep Logarítmico",
        burst: "Burst", sinburst: "SinBurst", mls: "MLS+",
    };

    // Sub-label derivadas
    const genSubLabel = $derived.by(() => {
        let s = shortGenNames[uiStore.generatorType] || uiStore.generatorType;
        if (uiStore.linkGeneratorToMeasurement) s += '/a';
        return s;
    });

    const measSubLabel = $derived(uiStore.measurementMode === 'secuencial' ? 'seq' : 'man');

    const eqSubLabel = $derived.by(() => {
        if (eqStore.eqType === 'parametrico') return `peq ${eqStore.parametricFilters.length}`;
        return `geq ${eqStore.graphicBands.length}`;
    });

    const snapSubLabel = $derived(uiStore.autoSaveSnapshotOnStop ? 'auto' : '');

    // Estados del Dropdown de Grilla
    let showGridDropdown = $state(false);
    let hoverCol = $state(0);
    let hoverRow = $state(0);

    // Calcular si la entrada y salida están balanceadas/calibradas
    const isCalibrated = $derived.by(() => {
        if (!uiStore.genActive) return false;
        const inAvg = (meterStore.refLevel + meterStore.measLevel) / 2;
        const outAvg = meterStore.outLevel;
        return Math.abs(inAvg - outAvg) < 2.0;
    });

    function getVuWidth(db: number) {
        return Math.max(0, Math.min(100, (db + 60) * (100 / 70)));
    }

    function toggleGenerator() {
        uiStore.genActive = !uiStore.genActive;
    }

    function toggleMeasurement() {
        uiStore.isMeasuring = !uiStore.isMeasuring;
    }

    function handleEQClick() {
        uiStore.activeTab = 'eq';
        eqStore.showEQ = true;
        if (uiStore.isMeasuring) {
            eqStore.autoEQSourceType = 'live';
        }
    }

    function isHighlighted(col: number, row: number) {
        if (hoverCol > 0 && hoverRow > 0) {
            return col <= hoverCol && row <= hoverRow;
        }
        const [activeRow, activeCol] = uiStore.layout.split("x").map(Number);
        return col <= activeCol && row <= activeRow;
    }

    function selectLayout(col: number, row: number) {
        uiStore.setLayout(`${row}x${col}`);
        showGridDropdown = false;
    }

    function getLayoutLabel() {
        if (hoverCol > 0 && hoverRow > 0) {
            return `${hoverRow} fila${hoverRow > 1 ? "s" : ""} x ${hoverCol} col.`;
        }
        const [activeRow, activeCol] = uiStore.layout.split("x").map(Number);
        return `${activeRow} fila${activeRow > 1 ? "s" : ""} x ${activeCol} col.`;
    }
</script>

<header class="global-header">
    <!-- ESTRUCTURA IZQUIERDA (TÍTULO) -->
    <div class="header-left">
        <svg class="header-app-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 97348 102870" fill="currentColor" style="color: var(--accent);">
            <path d="M0 64050l0-9303 5435 0c3462 0 6691-851 9670-2534 2980-1701 5396-4023 7253-7020 2747-4584 6403-8182 11005-10812 4585-2611 9593-3927 14991-3927 5396 0 10404 1316 14989 3927 4603 2630 8258 6228 11005 10812 1857 2998 4274 5319 7253 7020 2979 1683 6208 2534 9670 2534l5435 0 0 9303-5318 0c-5087 0-9846-1238-14333-3733-4467-2495-7987-5937-10560-10289-1857-3211-4411-5725-7620-7542-3231-1819-6732-2728-10521-2728-3715 0-7177 909-10406 2728-3212 1817-5745 4331-7602 7542-2592 4352-6112 7795-10580 10289-4467 2495-9245 3733-14331 3733l-5435 0z"/>
            <rect x="82568" y="79041" width="9303" height="9322"/>
            <rect x="4834" y="79041" width="9304" height="9322"/>
            <rect x="63226" y="64419" width="9188" height="30305"/>
            <rect x="24292" y="64419" width="9188" height="30305"/>
            <rect x="43769" y="49912" width="9168" height="52957"/>
            <path stroke="currentColor" stroke-width="359" d="M76617 810l2160 9518c955 4204 4039 7288 8243 8243l9518 2160-9518 2161c-4204 954-7288 4039-8243 8243l-2160 9518-2161-9518c-954-4204-4039-7289-8243-8243l-9518-2161 9518-2160c4204-955 7289-4039 8243-8243l2161-9518z"/>
        </svg>
        <h1 class="header-title select-none">
            Herramienta para calibración de audio
        </h1>
    </div>

    <!-- ESTRUCTURA CENTRO/DERECHA (CONSOLA DE ACCESOS RÁPIDOS) -->
    <div class="header-right">
        <!-- Generador -->
        <button
            class="header-btn"
            style="color: {uiStore.genActive ? 'var(--accent-green)' : 'var(--text-muted)'};"
            onclick={toggleGenerator}
            title={uiStore.genActive
                ? `Generador: ${signalNames[uiStore.generatorType]} (activo)`
                : "Iniciar generador"}
        >
            <span class="material-symbols-outlined text-[14px] header-icon-area">
                {uiStore.genActive ? 'volume_up' : 'volume_mute'}
            </span>
            <span class="header-btn-sub">{genSubLabel}</span>
        </button>

        <!-- Medir -->
        <button
            class="header-btn {uiStore.isMeasuring ? 'measuring' : ''}"
            onclick={toggleMeasurement}
            title={uiStore.isMeasuring ? "Detener medición" : "Iniciar medición"}
        >
            <span class="material-symbols-outlined text-[14px] header-icon-area">podcasts</span>
            <span class="header-btn-sub">{measSubLabel}</span>
        </button>

        <!-- EQ -->
        <button
            class="header-btn"
            style="color: {eqStore.showEQ ? 'var(--accent)' : 'var(--text-muted)'};"
            onclick={handleEQClick}
            title="Ecualización"
        >
            <svg class="header-eq-icon header-icon-area" viewBox="0 0 97348 102870" fill="currentColor">
                <path d="M0 64050l0-9303 5435 0c3462 0 6691-851 9670-2534 2980-1701 5396-4023 7253-7020 2747-4584 6403-8182 11005-10812 4585-2611 9593-3927 14991-3927 5396 0 10404 1316 14989 3927 4603 2630 8258 6228 11005 10812 1857 2998 4274 5319 7253 7020 2979 1683 6208 2534 9670 2534l5435 0 0 9303-5318 0c-5087 0-9846-1238-14333-3733-4467-2495-7987-5937-10560-10289-1857-3211-4411-5725-7620-7542-3231-1819-6732-2728-10521-2728-3715 0-7177 909-10406 2728-3212 1817-5745 4331-7602 7542-2592 4352-6112 7795-10580 10289-4467 2495-9245 3733-14331 3733l-5435 0z"/>
                <rect x="82568" y="79041" width="9303" height="9322"/>
                <rect x="4834" y="79041" width="9304" height="9322"/>
                <rect x="63226" y="64419" width="9188" height="30305"/>
                <rect x="24292" y="64419" width="9188" height="30305"/>
                <rect x="43769" y="49912" width="9168" height="52957"/>
                <path d="M76617 810l2160 9518c955 4204 4039 7288 8243 8243l9518 2160-9518 2161c-4204 954-7288 4039-8243 8243l-2160 9518-2161-9518c-954-4204-4039-7289-8243-8243l-9518-2161 9518-2160c4204-955 7289-4039 8243-8243l2161-9518z"/>
            </svg>
            <span class="header-btn-sub">{eqSubLabel}</span>
        </button>

        <!-- Capturar instantánea -->
        <button
            class="header-btn"
            style="color: var(--text-muted);"
            onclick={() => traceManager.captureInstantanea()}
            title="Capturar instantánea"
        >
            <span class="material-symbols-outlined text-[14px] header-icon-area">photo_camera</span>
            <span class="header-btn-sub">{snapSubLabel}</span>
        </button>

        <!-- Grilla -->
        <div class="relative">
            <button
                class="header-btn"
                onclick={() => (showGridDropdown = !showGridDropdown)}
                title="Configurar grilla ({uiStore.layout})"
            >
                <span class="material-symbols-outlined text-[14px] header-icon-area">grid_view</span>
            </button>

            {#if showGridDropdown}
                <div
                    class="fixed inset-0 z-40"
                    onclick={() => (showGridDropdown = false)}
                ></div>

                <div
                    class="absolute right-0 mt-2 rounded-xl p-3 shadow-[0_10px_30px_#000000] z-50 min-w-[140px] flex flex-col gap-2"
                    style="background: var(--bg-surface); border: 1px solid var(--border-primary);"
                >
                    <div class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 select-none">
                        Configurar Rejilla
                    </div>

                    <div
                        class="grid grid-cols-2 gap-1.5 p-2 rounded-lg cursor-pointer transition-colors"
                        style="background: var(--bg-tertiary); border: 1px solid var(--border-primary);"
                        onmouseleave={() => { hoverCol = 0; hoverRow = 0; }}
                    >
                        {#each [1, 2, 3] as row}
                            {#each [1, 2] as col}
                                <div
                                    class="w-6 h-6 rounded-[4px] border transition-all duration-150"
                                    style="{isHighlighted(col, row)
                                        ? 'background: rgba(0,255,136,0.2); border-color: #00ff88; box-shadow: 0 0 8px rgba(0,255,136,0.15); transform: scale(1.05);'
                                        : 'background: var(--bg-secondary); border-color: var(--border-primary);'}"
                                    onmouseenter={() => { hoverCol = col; hoverRow = row; }}
                                    onclick={() => selectLayout(col, row)}
                                ></div>
                            {/each}
                        {/each}
                    </div>

                    <div class="text-[9px] font-mono text-center font-bold text-[var(--accent-green)] mt-1 bg-[#001a0e] py-1.5 rounded border border-[#004d29] tracking-wide select-none">
                        {getLayoutLabel()}
                    </div>
                </div>
            {/if}
        </div>

        <div class="header-sep"></div>

        <!-- Vúmetro compacto: REF + MEAS + OUT -->
        <div class="vu-container">
            <div class="vu-group">
                <span class="vu-label">REF</span>
                <div class="vu-track">
                    <div class="vu-fill {uiStore.isMeasuring ? 'in' : 'inactive'}" style="width: {getVuWidth(meterStore.refLevel)}%"></div>
                </div>
            </div>
            <div class="vu-group">
                <span class="vu-label">MED</span>
                <div class="vu-track">
                    <div class="vu-fill {uiStore.isMeasuring ? 'in' : 'inactive'}" style="width: {getVuWidth(meterStore.measLevel)}%"></div>
                </div>
            </div>
            <div class="vu-group">
                <span class="vu-label">SAL</span>
                <div class="vu-track">
                    <div class="vu-fill {uiStore.genActive ? 'out' : 'inactive'}" style="width: {getVuWidth(meterStore.outLevel)}%"></div>
                </div>
            </div>
        </div>
        <div
            class="led-indicator {isCalibrated ? 'active' : ''}"
            title={isCalibrated
                ? "Sistema calibrado (nivel IN/OUT empatado)"
                : "Sistema no calibrado o señal inactiva"}
        ></div>
    </div>
</header>

<style>
    .global-header {
        height: 38px;
        background: var(--bg-primary);
        border-bottom: 1px solid var(--border-primary);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px;
        color: var(--text-primary);
        flex-shrink: 0;
        z-index: 1000;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .header-app-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }

    .header-title {
        font-family: var(--font-ui);
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
        letter-spacing: 0.03em;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .header-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 34px;
        padding: 2px 4px 1px;
        border-radius: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: all 0.15s ease;
        color: var(--text-muted);
        gap: 1px;
        line-height: 1;
    }

    .header-btn:hover {
        background: var(--bg-tertiary);
    }

    .header-btn.measuring {
        color: var(--accent-red);
        animation: pulse-measure 1.5s infinite;
    }

    .header-btn-sub {
        font-family: var(--font-ui);
        font-size: 7px;
        font-weight: 700;
        font-stretch: condensed;
        letter-spacing: 0.02em;
        line-height: 1;
        white-space: nowrap;
        text-transform: uppercase;
        color: inherit;
        opacity: 0.7;
        min-height: 7px;
    }

    .header-icon-area {
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .header-eq-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }

    @keyframes pulse-measure {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }

    .header-sep {
        width: 1px;
        height: 18px;
        background: var(--border-primary);
        flex-shrink: 0;
    }

    /* Vúmetros y Controles */
    .vu-container {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .vu-group {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .vu-label {
        font-family: var(--font-ui);
        font-size: 7px;
        font-weight: 900;
        color: var(--text-muted);
        width: 16px;
        text-align: right;
        line-height: 1;
    }

    .vu-track {
        width: 80px;
        height: 3px;
        background: var(--bg-deep);
        border-radius: 1px;
        overflow: hidden;
    }

    .vu-fill {
        height: 100%;
        transition: width 0.05s linear;
        border-radius: 1px;
    }

    .vu-fill.in {
        background: linear-gradient(90deg, 
            #004411 0%, 
            #00ff88 85.7%,
            #facc15 87%, 
            #ef4444 100%
        );
        background-size: 80px 100%;
    }

    .vu-fill.out {
        background: linear-gradient(90deg, 
            #0a1628 0%, 
            var(--accent) 85.7%, 
            #facc15 87%, 
            #ef4444 100%
        );
        background-size: 80px 100%;
    }

    .vu-fill.inactive {
        background: var(--bg-elevated);
    }

    .led-indicator {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--bg-elevated);
        border: 1px solid var(--border-primary);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
    }

    .led-indicator.active {
        background: var(--accent-green);
        border-color: var(--accent-green);
        box-shadow:
            0 0 10px var(--accent-green),
            0 0 4px var(--accent-green);
        transform: scale(1.1);
    }
</style>
