<script lang="ts">
    import { meterStore } from "$lib/stores/meterStore.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";

    // Nombres legibles para las señales
    const signalNames: Record<string, string> = {
        pink: "Ruido Rosa",
        white: "Ruido Blanco",
        brown: "Ruido Brown",
        "music-noise": "Music Noise",
        sine: "Seno Continuo",
        sweep: "Sweep Logarítmico",
        burst: "Burst",
        sinburst: "SinBurst",
        mls: "MLS+",
    };

    // Estados del Dropdown de Grilla
    let showGridDropdown = $state(false);
    let hoverCol = $state(0);
    let hoverRow = $state(0);

    // Calcular si la entrada y salida están balanceadas/calibradas
    const isCalibrated = $derived.by(() => {
        if (!uiStore.genActive) return false;
        // Comparar promedio de ref+meas vs out
        const inAvg = (meterStore.refLevel + meterStore.measLevel) / 2;
        const outAvg = meterStore.outLevel;
        return Math.abs(inAvg - outAvg) < 2.0;
    });

    function getVuWidth(db: number) {
        // Escala de -60 dB a +10 dB: 0% a 100% de la barra
        return Math.max(0, Math.min(100, (db + 60) * (100 / 70)));
    }

    function toggleGenerator() {
        uiStore.genActive = !uiStore.genActive;
    }

    function toggleMeasurement() {
        uiStore.isMeasuring = !uiStore.isMeasuring;
        // Si se inicia la medición, asegurar que el tab Medir esté montado
        // (la lógica de audio/generador vive en su $effect)
        if (uiStore.isMeasuring && uiStore.activeTab !== 'medir') {
            uiStore.activeTab = 'medir';
        }
    }

    function isHighlighted(col: number, row: number) {
        if (hoverCol > 0 && hoverRow > 0) {
            return col <= hoverCol && row <= hoverRow;
        }
        // Si no hay hover, resalta el layout seleccionado actualmente
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
        <span
            class="material-symbols-outlined text-[#00ff88] text-[20px] select-none font-bold"
            >analytics</span
        >
        <h1 class="header-title select-none">
            Herramienta para mediciones de audio
        </h1>
    </div>

    <!-- ESTRUCTURA CENTRO/DERECHA (CONSOLA DE ACCESOS RÁPIDOS) -->
    <div class="header-right">
        <!-- Generador -->
        <button
            class="header-btn"
            style="color: {uiStore.genActive ? '#00ff88' : 'var(--text-muted)'};"
            onclick={toggleGenerator}
            title={uiStore.genActive
                ? `Generador: ${signalNames[uiStore.generatorType]} (activo)`
                : "Iniciar generador"}
        >
            <span class="material-symbols-outlined text-[16px]">
                {uiStore.genActive ? 'volume_up' : 'volume_mute'}
            </span>
        </button>

        <div class="header-sep"></div>

        <!-- Medir -->
        <button
            class="header-btn {uiStore.isMeasuring ? 'measuring' : ''}"
            onclick={toggleMeasurement}
            title={uiStore.isMeasuring ? "Detener medición" : "Iniciar medición"}
        >
            <span class="material-symbols-outlined text-[16px]">podcasts</span>
        </button>

        <div class="header-sep"></div>

        <!-- EQ -->
        <button
            class="header-btn"
            style="color: var(--text-muted);"
            onclick={() => { uiStore.activeTab = 'eq'; }}
            title="Ecualización"
        >
            <span class="material-symbols-outlined text-[16px]">equalizer</span>
        </button>

        <div class="header-sep"></div>

        <!-- Grilla -->
        <div class="relative">
            <button
                class="header-btn"
                onclick={() => (showGridDropdown = !showGridDropdown)}
                title="Configurar grilla ({uiStore.layout})"
            >
                <span class="material-symbols-outlined text-[16px]">grid_view</span>
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
                    <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 select-none">
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

                    <div class="text-[9px] font-mono text-center font-bold text-[#00ff88] mt-1 bg-[#001a0e] py-1.5 rounded border border-[#004d29] tracking-wide select-none">
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
        color: #fff;
        flex-shrink: 0;
        z-index: 1000;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .header-title {
        font-family: "Outfit", "Inter", sans-serif;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
        letter-spacing: 0.03em;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 16px;
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
        font-family: "Outfit", "Inter", sans-serif;
        font-size: 7px;
        font-weight: 900;
        color: #4b5563;
        width: 16px;
        text-align: right;
        line-height: 1;
    }

    .vu-track {
        width: 80px;
        height: 3px;
        background: #09090b;
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
            #00ff88 85.7%,   /* 85.7% representa exactamente 0 dB en el rango de 70 dB */
            #facc15 87%, 
            #ef4444 100%
        );
        background-size: 80px 100%;
    }

    .vu-fill.out {
        background: linear-gradient(90deg, 
            #0a1628 0%, 
            #3b82f6 85.7%, 
            #facc15 87%, 
            #ef4444 100%
        );
        background-size: 80px 100%;
    }

    .vu-fill.inactive {
        background: #1f1f26;
    }

    .led-indicator {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #1f1f26;
        border: 1px solid #2e2e38;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
    }

    .led-indicator.active {
        background: #00ff88;
        border-color: #00ff88;
        box-shadow:
            0 0 10px #00ff88,
            0 0 4px #00ff88;
        transform: scale(1.1);
    }

    .header-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: all 0.15s ease;
        color: var(--text-muted);
    }

    .header-btn:hover {
        background: var(--bg-tertiary);
    }

    .header-btn.measuring {
        color: #ef4444;
        animation: pulse-measure 1.5s infinite;
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
</style>
