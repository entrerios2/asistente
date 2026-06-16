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

        // Calcular promedio de entrada y salida
        const inAvg =
            meterStore.inLevels.reduce((a, b) => a + b, 0) /
            Math.max(1, meterStore.inLevels.length);
        const outAvg =
            meterStore.outLevels.reduce((a, b) => a + b, 0) /
            Math.max(1, meterStore.outLevels.length);

        // Si la diferencia absoluta es menor a 2.0 dB, se considera empatado
        return Math.abs(inAvg - outAvg) < 2.0;
    });

    function getVuWidth(db: number) {
        // Escala de -60 dB a +10 dB: 0% a 100% de la barra
        return Math.max(0, Math.min(100, (db + 60) * (100 / 70)));
    }

    function toggleGenerator() {
        uiStore.genActive = !uiStore.genActive;
    }

    function openManualMeasurement() {
        uiStore.activeTab = "medicion";
        uiStore.measurementMode = "manual";
    }

    function openModeMeasurement() {
        uiStore.activeTab = "medicion";
    }

    function toggleMeasurement() {
        uiStore.isMeasuring = !uiStore.isMeasuring;
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
        <!-- ACCESOS RÁPIDOS DE CONTROL -->
        <div
            class="flex items-center gap-3 p-1.5 px-3 rounded-xl"
            style="background: var(--bg-tertiary); border: 1px solid var(--border-primary);"
        >
            <!-- CONTROL GENERADOR RÁPIDO -->
            <div
                class="flex items-center gap-1.5 pr-3 border-r border-[#1a1a24]/50"
            >
                <button
                    class="flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer min-h-[30px] min-w-[30px]"
                    style="background: {uiStore.genActive ? 'rgba(0,255,136,0.15)' : 'var(--bg-secondary)'};
                           border-color: {uiStore.genActive ? '#00ff88' : 'var(--border-primary)'};
                           color: {uiStore.genActive ? '#00ff88' : 'var(--text-muted)'};"
                    onclick={toggleGenerator}
                    title={uiStore.genActive
                        ? "Detener Generador"
                        : "Iniciar Generador"}
                >
                    <span class="material-symbols-outlined text-[16px]">
                        {uiStore.genActive ? "volume_up" : "volume_mute"}
                    </span>
                </button>

                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="flex flex-col cursor-pointer select-none group"
                    onclick={openManualMeasurement}
                    title="Configurar señal en el Sidebar"
                >
                    <span
                        class="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none"
                        >Generador</span
                    >
                    <span
                        class="text-[11px] font-semibold text-gray-300 group-hover:text-[#00ff88] transition-colors leading-tight"
                    >
                        {signalNames[uiStore.generatorType] || "Desactivado"}
                    </span>
                </div>
            </div>

            <!-- CONTROL MEDICIÓN RÁPIDA -->
            <div class="flex items-center gap-2">
                <!-- Icono de Modo de Medición -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <button
                    class="flex items-center justify-center p-1.5 rounded-lg border text-gray-400 hover:text-gray-200 transition-all cursor-pointer min-h-[30px] min-w-[30px]"
                    style="background: var(--bg-secondary); border-color: var(--border-primary);"
                    onclick={openModeMeasurement}
                    title="Abrir panel de medición"
                >
                    <span class="material-symbols-outlined text-[16px]">
                        {uiStore.measurementMode === "manual"
                            ? "hearing"
                            : "lists"}
                    </span>
                </button>

                <!-- Botón Medir / Detener -->
                <button
                    class="flex items-center gap-1.5 p-1.5 px-3 rounded-lg border transition-all duration-300 font-bold text-xs cursor-pointer min-h-[30px]"
                    style="{uiStore.isMeasuring
                        ? 'background: rgba(239,68,68,0.15); border-color: #ef4444; color: #ef4444; box-shadow: 0 0 12px rgba(239,68,68,0.25);'
                        : 'background: var(--bg-secondary); border-color: var(--border-primary); color: var(--text-primary);'}"
                    onclick={toggleMeasurement}
                >
                    <span class="material-symbols-outlined text-[14px]"
                        >podcasts</span
                    >
                    <span>{uiStore.isMeasuring ? "Midiendo" : "Medir"}</span>
                </button>
            </div>
        </div>

        <!-- SELECTOR DE GRILLA VISUAL (ESTILO WORD) -->
        <div class="relative">
            <button
                class="flex items-center gap-1.5 hover:border-[#1b1b26] p-1.5 px-3 rounded-xl transition-all text-xs font-semibold cursor-pointer min-h-[40px] text-gray-400 hover:text-gray-200"
                style="background: var(--bg-tertiary); border: 1px solid var(--border-primary);"
                onclick={() => (showGridDropdown = !showGridDropdown)}
                title="Configurar visualización multi-cuadrante"
            >
                <span class="material-symbols-outlined text-[18px]"
                    >grid_view</span
                >
                <span class="font-mono text-[11px] font-bold text-gray-300"
                    >{uiStore.layout}</span
                >
            </button>

            {#if showGridDropdown}
                <!-- Backdrop invisible para cerrar con un click fuera -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="fixed inset-0 z-40"
                    onclick={() => (showGridDropdown = false)}
                ></div>

                <div
                    class="absolute right-0 mt-2 rounded-xl p-3 shadow-[0_10px_30px_#000000] z-50 min-w-[140px] flex flex-col gap-2"
                    style="background: var(--bg-surface); border: 1px solid var(--border-primary);"
                >
                    <div
                        class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 select-none"
                    >
                        Configurar Rejilla
                    </div>

                    <!-- Matriz interactiva de cuadrados de 2x3 (2 col, 3 filas) -->
                    <div
                        class="grid grid-cols-2 gap-1.5 p-2 rounded-lg cursor-pointer transition-colors"
                        style="background: var(--bg-tertiary); border: 1px solid var(--border-primary);"
                        onmouseleave={() => {
                            hoverCol = 0;
                            hoverRow = 0;
                        }}
                    >
                        {#each [1, 2, 3] as row}
                            {#each [1, 2] as col}
                                <!-- Celda Individual -->
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <div
                                    class="w-6 h-6 rounded-[4px] border transition-all duration-150"
                                    style="{isHighlighted(col, row)
                                        ? 'background: rgba(0,255,136,0.2); border-color: #00ff88; box-shadow: 0 0 8px rgba(0,255,136,0.15); transform: scale(1.05);'
                                        : 'background: var(--bg-secondary); border-color: var(--border-primary);'}"
                                    onmouseenter={() => {
                                        hoverCol = col;
                                        hoverRow = row;
                                    }}
                                    onclick={() => selectLayout(col, row)}
                                ></div>
                            {/each}
                        {/each}
                    </div>

                    <!-- Etiqueta informativa del layout -->
                    <div
                        class="text-[9px] font-mono text-center font-bold text-[#00ff88] mt-1 bg-[#001a0e] py-1.5 rounded border border-[#004d29] tracking-wide select-none"
                    >
                        {getLayoutLabel()}
                    </div>
                </div>
            {/if}
        </div>

        <!-- VÚMETRO INTEGRADO (CON LED INTELIGENTE DE CALIBRACIÓN) -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="vu-outer-container cursor-pointer"
            onclick={() => {
                uiStore.activeTab = "config";
            }}
            title="Hacer clic para ir a Configuración de Audio"
        >
            <div class="vu-container">
                <!-- Entrada -->
                <div class="vu-group">
                    <span class="vu-label">IN</span>
                    <div class="vu-bars">
                        {#each meterStore.inLevels as level}
                            <div class="vu-track">
                                <div
                                    class="vu-fill in"
                                    style="width: {getVuWidth(level)}%"
                                ></div>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Salida -->
                <div class="vu-group">
                    <span class="vu-label">OUT</span>
                    <div class="vu-bars">
                        {#each meterStore.outLevels as level}
                            <div class="vu-track">
                                <div
                                    class="vu-fill out"
                                    style="width: {getVuWidth(level)}%"
                                ></div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- LED Central de Calibración -->
            <div class="led-container">
                <div
                    class="led-indicator {isCalibrated ? 'active' : ''}"
                    title={isCalibrated
                        ? "Sistema Calibrado (Nivel IN/OUT empatado)"
                        : "Sistema no calibrado o señal inactiva"}
                ></div>
            </div>
        </div>
    </div>
</header>

<style>
    .global-header {
        height: 54px;
        background: var(--bg-primary);
        border-bottom: 1px solid var(--border-primary);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px;
        color: #fff;
        flex-shrink: 0;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
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
    .vu-outer-container {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-primary);
        padding: 6px 12px;
        border-radius: 12px;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        min-height: 40px;
    }

    .vu-outer-container:hover {
        background: var(--bg-surface);
        border-color: var(--border-secondary);
        box-shadow: 0 0 15px #000000;
    }

    .vu-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .vu-group {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .vu-label {
        font-family: "Outfit", "Inter", sans-serif;
        font-size: 0.55rem;
        font-weight: 900;
        color: #4b5563;
        width: 22px;
        text-align: right;
        letter-spacing: 0.05em;
    }

    .vu-bars {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .vu-track {
        width: 110px;
        height: 3px;
        background: #09090b;
        border-radius: 1.5px;
        overflow: hidden;
    }

    .vu-fill {
        height: 100%;
        transition: width 0.05s linear;
        border-radius: 1.5px;
    }

    .vu-fill.in {
        background: linear-gradient(90deg, 
            #004411 0%, 
            #00ff88 85.7%,   /* 85.7% representa exactamente 0 dB en el rango de 70 dB */
            #facc15 87%, 
            #ef4444 100%
        );
        background-size: 110px 100%;
    }

    .vu-fill.out {
        background: linear-gradient(90deg, 
            #004411 0%, 
            #00ff88 85.7%, 
            #facc15 87%, 
            #ef4444 100%
        );
        background-size: 110px 100%;
    }

    /* Contenedor del LED de Calibración */
    .led-container {
        display: flex;
        align-items: center;
        justify-content: center;
        border-left: 1px solid var(--border-secondary);
        padding-left: 10px;
        height: 24px;
    }

    .led-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #1f1f26;
        border: 1px solid #2e2e38;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .led-indicator.active {
        background: #00ff88;
        border-color: #00ff88;
        box-shadow:
            0 0 10px #00ff88,
            0 0 4px #00ff88;
        transform: scale(1.1);
    }
</style>
