<script lang="ts">
    let {
        activeConfigMetric = $bindable(),
        metricConfigs = $bindable(),
        metricStyles = $bindable(),
        onClose,
        onRemoveMetric
    }: {
        activeConfigMetric: string | null;
        metricConfigs: Record<string, any>;
        metricStyles: Record<string, { color: string; lineWidth: number; lineDash: number[] }>;
        onClose: () => void;
        onRemoveMetric: (name: string) => void;
    } = $props();
</script>

{#if activeConfigMetric}
    <!-- Backdrop para cerrar con un click fuera -->
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-40" onclick={onClose}></div>
    
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="absolute top-[46px] left-[16px] rounded-xl p-4 shadow-[0_10px_30px_#000000] z-50 min-w-[240px] flex flex-col gap-3 select-none text-[11px] text-gray-200"
         style="background: var(--bg-surface); border: 1px solid var(--border-primary)"
         onmousedown={(e) => e.stopPropagation()}
         onmouseup={(e) => e.stopPropagation()}
         onmousemove={(e) => e.stopPropagation()}
         onclick={(e) => e.stopPropagation()}
         onwheel={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between border-b pb-1.5 mb-1" style="border-color: var(--border-primary)">
            <span class="font-bold text-[#00ff88] uppercase tracking-wide">Config. {activeConfigMetric}</span>
            <button onclick={onClose} class="text-gray-500 hover:text-gray-300">
                <span class="material-symbols-outlined text-xs">close</span>
            </button>
        </div>
        
        {#if activeConfigMetric === "Magnitude" || activeConfigMetric === "Spectrum" || activeConfigMetric === "Simulated Magnitude"}
            <!-- Modo Y -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Modo Eje Y</span>
                <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                        bind:value={metricConfigs[activeConfigMetric].modeY}>
                    <option value="dB">dB</option>
                    <option value="Linear">Linear</option>
                    <option value="Impedance">Impedance</option>
                </select>
            </div>
            
            {#if metricConfigs[activeConfigMetric].modeY === "Impedance"}
                <!-- Resistencia del sensor -->
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Resistencia Sensor (Ω)</span>
                    <input type="number" class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white"
                           bind:value={metricConfigs[activeConfigMetric].sensorResistance} />
                </div>
            {/if}
            
            <!-- Suavizado PPO -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Suavizado PPO (1/Oct)</span>
                <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                        bind:value={metricConfigs[activeConfigMetric].smoothingPPO}>
                    <option value="1">1/1 Octava</option>
                    <option value="3">1/3 Octava</option>
                    <option value="6">1/6 Octava</option>
                    <option value="12">1/12 Octava</option>
                    <option value="24">1/24 Octava</option>
                    <option value="48">1/48 Octava</option>
                </select>
            </div>
            
            <!-- Invertir Y / Activar coherencia -->
            <div class="flex flex-col gap-1.5 py-1">
                <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                    <input type="checkbox" bind:checked={metricConfigs[activeConfigMetric].invertY} />
                    <span>Invertir Eje Y</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                    <input type="checkbox" bind:checked={metricConfigs[activeConfigMetric].enableCoherence} />
                    <span>Activar Coherencia</span>
                </label>
            </div>
            
            {#if metricConfigs[activeConfigMetric].enableCoherence}
                <div class="flex flex-col gap-1">
                    <span class="text-gray-400 font-medium">Umbral Coherencia ({metricConfigs[activeConfigMetric].coherenceThreshold})</span>
                    <input type="range" min="0" max="1" step="0.05" class="accent-[#00ff88]"
                           bind:value={metricConfigs[activeConfigMetric].coherenceThreshold} />
                </div>
            {/if}
            
            <!-- Desplazamiento Y -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Desplazamiento Eje Y ({metricConfigs[activeConfigMetric].yShift}px)</span>
                <input type="range" min="-300" max="300" step="5" class="accent-[#00ff88]"
                       bind:value={metricConfigs[activeConfigMetric].yShift} />
            </div>
        {/if}
        
        {#if activeConfigMetric === "Phase"}
            <!-- Envoltura -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Rango / Envoltura</span>
                <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                        bind:value={metricConfigs["Phase"].unwrapMode}>
                    <option value="±180">±180º</option>
                    <option value="360">0..360º</option>
                </select>
            </div>
            
            <!-- Rotación de Fase -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Ángulo de Rotación ({metricConfigs["Phase"].rotate}º)</span>
                <input type="range" min="-360" max="360" step="5" class="accent-[#00ff88]"
                       bind:value={metricConfigs["Phase"].rotate} />
            </div>
            
            <!-- Rango angular -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Rango Angular ({metricConfigs["Phase"].range}º)</span>
                <input type="range" min="90" max="720" step="30" class="accent-[#00ff88]"
                       bind:value={metricConfigs["Phase"].range} />
            </div>
            
            <!-- Desplazamiento Y -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Desplazamiento Eje Y ({metricConfigs["Phase"].yShift}px)</span>
                <input type="range" min="-300" max="300" step="5" class="accent-[#00ff88]"
                       bind:value={metricConfigs["Phase"].yShift} />
            </div>
        {/if}
        
        {#if activeConfigMetric === "Coherence"}
            <!-- Tipo de Coherencia -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Tipo de Coherencia</span>
                <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                        bind:value={metricConfigs["Coherence"].cohType}>
                    <option value="normal">Normal</option>
                    <option value="squared">Al Cuadrado (r²)</option>
                    <option value="SNR">Estimación SNR</option>
                </select>
            </div>
            
            <!-- Línea de umbral -->
            <div class="flex flex-col gap-1.5 py-1">
                <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                    <input type="checkbox" bind:checked={metricConfigs["Coherence"].showThresholdLine} />
                    <span>Mostrar línea de umbral</span>
                </label>
            </div>
            
            {#if metricConfigs["Coherence"].showThresholdLine}
                <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-400">Color Umbral</span>
                        <input type="color" bind:value={metricConfigs["Coherence"].thresholdColor} class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-gray-400 font-medium">Valor Umbral ({metricConfigs["Coherence"].thresholdValue})</span>
                        <input type="range" min="0.05" max="0.95" step="0.05" class="accent-[#eab308]"
                               bind:value={metricConfigs["Coherence"].thresholdValue} />
                    </div>
                </div>
            {/if}
            
            <!-- Desplazamiento Y -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Desplazamiento Eje Y ({metricConfigs["Coherence"].yShift}px)</span>
                <input type="range" min="-300" max="300" step="5" class="accent-[#00ff88]"
                       bind:value={metricConfigs["Coherence"].yShift} />
            </div>
        {/if}
        
        {#if activeConfigMetric === "Spectrogram"}
            <!-- Paleta de Colores -->
            <div class="flex flex-col gap-1">
                <span class="text-gray-400 font-medium">Paleta de Colores</span>
                <select class="bg-[#121216] border border-[#222] rounded px-2 py-1 text-xs text-white focus:outline-none"
                        bind:value={metricConfigs["Spectrogram"].palette}>
                    <option value="Magma">Magma</option>
                    <option value="Jet">Jet (Arcoíris)</option>
                    <option value="Hot">Hot (Térmico)</option>
                    <option value="Grayscale">Escala de Grises</option>
                </select>
            </div>
        {/if}

        <!-- Editor de Estilos de Curva -->
        {#if activeConfigMetric && metricStyles[activeConfigMetric]}
            <div class="border-t pt-2 mt-1 flex flex-col gap-2" style="border-color: var(--border-primary)">
                <span class="text-gray-400 font-bold uppercase tracking-wider text-[8px]">Estilo de Curva</span>
                
                <!-- Color -->
                <div class="flex items-center justify-between">
                    <span>Color</span>
                    <input type="color" bind:value={metricStyles[activeConfigMetric].color} class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                </div>

                <!-- Grosor -->
                <div class="flex flex-col gap-1">
                    <div class="flex justify-between">
                        <span>Grosor</span>
                        <span class="font-mono">{metricStyles[activeConfigMetric].lineWidth}px</span>
                    </div>
                    <input type="range" min="1" max="5" step="0.2" class="accent-[#00ff88]"
                           bind:value={metricStyles[activeConfigMetric].lineWidth} />
                </div>

                <!-- Estilo de Trazo -->
                <div class="flex flex-col gap-1">
                    <span>Estilo de Línea</span>
                    <div class="flex gap-1">
                        <button class="flex-1 py-1 text-center border rounded text-[9px] cursor-pointer {metricStyles[activeConfigMetric].lineDash.length === 0 ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]' : 'bg-[#121216] border-[#222]'}"
                                onclick={() => metricStyles[activeConfigMetric!].lineDash = []}>
                            Sólido
                        </button>
                        <button class="flex-1 py-1 text-center border rounded text-[9px] cursor-pointer {metricStyles[activeConfigMetric].lineDash.join(',') === '8,4' ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]' : 'bg-[#121216] border-[#222]'}"
                                onclick={() => metricStyles[activeConfigMetric!].lineDash = [8, 4]}>
                            Dashed
                        </button>
                        <button class="flex-1 py-1 text-center border rounded text-[9px] cursor-pointer {metricStyles[activeConfigMetric].lineDash.join(',') === '2,3' ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]' : 'bg-[#121216] border-[#222]'}"
                                onclick={() => metricStyles[activeConfigMetric!].lineDash = [2, 3]}>
                            Dotted
                        </button>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Toggle Visibilidad de la Métrica -->
        <div class="flex items-center justify-between mt-2 pt-2 border-t" style="border-color: var(--border-primary)">
            <span class="text-[10px] text-gray-400">Visible en gráfico</span>
            <button
                class="w-8 h-4 rounded-full transition-all cursor-pointer {metricConfigs[activeConfigMetric!]?.hidden ? 'bg-gray-700' : 'bg-[#00ff88]'}"
                onclick={() => {
                    if (!metricConfigs[activeConfigMetric!]) metricConfigs[activeConfigMetric!] = {};
                    metricConfigs[activeConfigMetric!].hidden = !metricConfigs[activeConfigMetric!].hidden;
                }}
            >
                <div class="w-3 h-3 rounded-full bg-white shadow transition-transform {metricConfigs[activeConfigMetric!]?.hidden ? 'translate-x-0.5' : 'translate-x-4'}"></div>
            </button>
        </div>

        <!-- Botón Eliminar Métrica -->
        <button
            class="w-full mt-2 py-1.5 px-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
            onclick={() => {
                onRemoveMetric(activeConfigMetric!);
                activeConfigMetric = null;
            }}
        >
            <span class="material-symbols-outlined text-[12px]">delete</span>
            Eliminar {activeConfigMetric}
        </button>
    </div>
{/if}
