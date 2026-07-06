<script lang="ts">
    import { type MetricConfig } from '$lib/dsp/quadrantState';
    import { uiStore } from '$lib/stores/ui.svelte';

    let {
        activeConfigMetric = $bindable(),
        metricConfigs = $bindable(),
        metricStyles = $bindable(),
        anchorRect = $bindable(),
        onClose,
        onRemoveMetric
    }: {
        activeConfigMetric: string | null;
        metricConfigs: Record<string, MetricConfig>;
        metricStyles: Record<string, { color: string; lineWidth: number; lineDash: number[] }>;
        anchorRect: { top: number; left: number } | null;
        onClose: () => void;
        onRemoveMetric: (name: string) => void;
    } = $props();
</script>

{#if activeConfigMetric}
    <!-- Backdrop para cerrar con un click fuera -->
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-[9998]" onclick={onClose}></div>
    
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="fixed rounded-xl p-4 shadow-[0_10px_30px_#000000] z-[9999] min-w-[240px] max-w-[300px] max-h-[70vh] overflow-y-auto flex flex-col gap-3 select-none text-[11px] text-[var(--text-primary)]"
         style="background: var(--bg-surface); border: 1px solid var(--border-primary);
                top: {anchorRect ? anchorRect.top + 'px' : '60px'};
                left: {anchorRect ? anchorRect.left + 'px' : '16px'};"
         onmousedown={(e) => e.stopPropagation()}
         onmouseup={(e) => e.stopPropagation()}
         onmousemove={(e) => e.stopPropagation()}
         onclick={(e) => e.stopPropagation()}
         onwheel={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between border-b pb-1.5 mb-1" style="border-color: var(--border-primary)">
            <span class="font-bold text-[var(--accent)] uppercase tracking-wide">Config. {activeConfigMetric}</span>
            <button onclick={onClose} class="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <span class="material-symbols-outlined text-xs">close</span>
            </button>
        </div>
        
        {#if activeConfigMetric === "Magnitude" || activeConfigMetric === "Spectrum" || activeConfigMetric === "Simulated Magnitude"}
            <!-- Modo Y -->
            <div class="flex flex-col gap-1">
                <span class="text-[var(--text-secondary)] font-medium">Modo eje Y</span>
                <select class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                        bind:value={metricConfigs[activeConfigMetric].modeY}>
                    <option value="dB">dB</option>
                    <option value="Linear">Lineal</option>
                    <option value="Impedance">Impedancia</option>
                </select>
            </div>
            
            {#if metricConfigs[activeConfigMetric].modeY === "Impedance"}
                <div class="flex flex-col gap-1">
                    <span class="text-[var(--text-secondary)] font-medium">Resistencia sensor (Ω)</span>
                    <input type="number" class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                           bind:value={metricConfigs[activeConfigMetric].sensorResistance} />
                </div>
            {/if}
            
            <!-- Suavizado PPO -->
            <div class="flex flex-col gap-1">
                <span class="text-[var(--text-secondary)] font-medium">Suavizado PPO (1/oct)</span>
                <select class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                        bind:value={metricConfigs[activeConfigMetric].smoothingPPO}>
                    <option value="1">1/1 octava</option>
                    <option value="3">1/3 octava</option>
                    <option value="6">1/6 octava</option>
                    <option value="12">1/12 octava</option>
                    <option value="24">1/24 octava</option>
                    <option value="48">1/48 octava</option>
                </select>
            </div>
            
            <!-- 🔧 AVANZADO: Invertir Y / Activar coherencia -->
            {#if uiStore.showAdvanced}
                <div class="flex flex-col gap-1.5 py-1">
                    <label class="flex items-center gap-2 cursor-pointer text-[var(--text-primary)]">
                        <input type="checkbox" bind:checked={metricConfigs[activeConfigMetric].invertY} />
                        <span>Invertir eje Y</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer text-[var(--text-primary)]">
                        <input type="checkbox" bind:checked={metricConfigs[activeConfigMetric].enableCoherence} />
                        <span>Activar coherencia</span>
                    </label>
                </div>
            {/if}
            
            {#if metricConfigs[activeConfigMetric].enableCoherence}
                <div class="flex flex-col gap-2">
                    <div class="flex flex-col gap-1">
                        <span class="text-[var(--text-secondary)] font-medium">Modo coherencia</span>
                        <select class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                                bind:value={metricConfigs[activeConfigMetric].coherenceMode}>
                            <option value="attenuate">Atenuar (transparente)</option>
                            <option value="color">Cambiar color</option>
                        </select>
                    </div>
                    {#if metricConfigs[activeConfigMetric].coherenceMode === 'color'}
                        <div class="flex items-center justify-between">
                            <span class="text-[var(--text-secondary)]">Color bajo umbral</span>
                            <input type="color" bind:value={metricConfigs[activeConfigMetric].coherenceColor} class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                        </div>
                    {/if}
                    <div class="flex flex-col gap-1">
                        <span class="text-[var(--text-secondary)] font-medium">Umbral coherencia ({metricConfigs["Coherence"]?.thresholdValue ?? 0.2})</span>
                        <input type="range" min="0" max="1" step="0.05" class="accent-[var(--accent)]"
                               value={metricConfigs["Coherence"]?.thresholdValue ?? 0.2}
                               oninput={e => metricConfigs["Coherence"] = { ...metricConfigs["Coherence"], thresholdValue: +e.currentTarget.value }} />
                    </div>
                </div>
            {/if}
            
            <!-- 🔧 AVANZADO: Desplazamiento Y -->
            {#if uiStore.showAdvanced}
                <div class="flex flex-col gap-1">
                    <span class="text-[var(--text-secondary)] font-medium">Desplazamiento eje Y ({metricConfigs[activeConfigMetric].yShift}px)</span>
                    <input type="range" min="-300" max="300" step="5" class="accent-[var(--accent)]"
                           bind:value={metricConfigs[activeConfigMetric].yShift} />
                </div>
            {/if}
        {/if}
        
        {#if activeConfigMetric === "Phase"}
            <!-- Envoltura -->
            <div class="flex flex-col gap-1">
                <span class="text-[var(--text-secondary)] font-medium">Rango / envoltura</span>
                <select class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                        bind:value={metricConfigs["Phase"].unwrapMode}>
                    <option value="±180">±180º</option>
                    <option value="360">0..360º</option>
                    <option value="Unwrap">Unwrap (continuo)</option>
                </select>
            </div>
            
            <!-- 🔧 AVANZADO: Rotación de fase -->
            {#if uiStore.showAdvanced}
                <div class="flex flex-col gap-1">
                    <span class="text-[var(--text-secondary)] font-medium">Ángulo de rotación ({metricConfigs["Phase"].rotate}º)</span>
                    <input type="range" min="-360" max="360" step="5" class="accent-[var(--accent)]"
                           bind:value={metricConfigs["Phase"].rotate} />
                </div>
                
                <div class="flex flex-col gap-1">
                    <span class="text-[var(--text-secondary)] font-medium">Rango angular ({metricConfigs["Phase"].range}º)</span>
                    <input type="range" min="90" max="720" step="30" class="accent-[var(--accent)]"
                           bind:value={metricConfigs["Phase"].range} />
                </div>
                
                <div class="flex flex-col gap-1">
                    <span class="text-[var(--text-secondary)] font-medium">Desplazamiento eje Y ({metricConfigs["Phase"].yShift}px)</span>
                    <input type="range" min="-300" max="300" step="5" class="accent-[var(--accent)]"
                           bind:value={metricConfigs["Phase"].yShift} />
                </div>
            {/if}
        {/if}
        
        {#if activeConfigMetric === "Coherence"}
            <!-- Tipo de coherencia -->
            <div class="flex flex-col gap-1">
                <span class="text-[var(--text-secondary)] font-medium">Tipo de coherencia</span>
                <select class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                        bind:value={metricConfigs["Coherence"].cohType}>
                    <option value="normal">Normal</option>
                    <option value="squared">Al cuadrado (r²)</option>
                    <option value="SNR">Estimación SNR</option>
                </select>
            </div>
            
            <!-- Mostrar curva y fondo -->
            <div class="flex flex-col gap-1.5 py-1">
                <label class="flex items-center gap-2 cursor-pointer text-[var(--text-primary)]">
                    <input type="checkbox" bind:checked={metricConfigs["Coherence"].showLine} />
                    <span>Mostrar curva</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-[var(--text-primary)]">
                    <input type="checkbox" bind:checked={metricConfigs["Coherence"].showBackground} />
                    <span>Mostrar fondo</span>
                </label>
            </div>
            
            {#if metricConfigs["Coherence"].showBackground}
                <div class="flex flex-col gap-1">
                    <span class="text-[var(--text-secondary)] font-medium">Paleta de fondo</span>
                    <select class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                            bind:value={metricConfigs["Coherence"].bgPalette}>
                        <option value="RedTransparent">Rojo → Transparente</option>
                        <option value="Magma">Magma</option>
                        <option value="Jet">Jet</option>
                        <option value="Hot">Hot</option>
                        <option value="Grayscale">Escala de grises</option>
                    </select>
                </div>
            {/if}
            
            <!-- Línea de umbral -->
            <div class="flex flex-col gap-1.5 py-1">
                <label class="flex items-center gap-2 cursor-pointer text-[var(--text-primary)]">
                    <input type="checkbox" bind:checked={metricConfigs["Coherence"].showThresholdLine} />
                    <span>Mostrar línea de umbral</span>
                </label>
            </div>
            
            {#if metricConfigs["Coherence"].showThresholdLine}
                <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[var(--text-secondary)]">Color umbral</span>
                        <input type="color" bind:value={metricConfigs["Coherence"].thresholdColor} class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-[var(--text-secondary)] font-medium">Valor umbral ({metricConfigs["Coherence"].thresholdValue})</span>
                        <input type="range" min="0.05" max="0.95" step="0.05" class="accent-[#eab308]"
                               bind:value={metricConfigs["Coherence"].thresholdValue} />
                    </div>
                </div>
            {/if}
            
            <!-- 🔧 AVANZADO: Desplazamiento Y -->
            {#if uiStore.showAdvanced}
                <div class="flex flex-col gap-1">
                    <span class="text-[var(--text-secondary)] font-medium">Desplazamiento eje Y ({metricConfigs["Coherence"].yShift}px)</span>
                    <input type="range" min="-300" max="300" step="5" class="accent-[var(--accent)]"
                           bind:value={metricConfigs["Coherence"].yShift} />
                </div>
            {/if}
        {/if}
        
        {#if activeConfigMetric === "Spectrogram"}
            <div class="flex flex-col gap-1">
                <span class="text-[var(--text-secondary)] font-medium">Paleta de colores</span>
                <select class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                        bind:value={metricConfigs["Spectrogram"].palette}>
                    <option value="Magma">Magma</option>
                    <option value="Jet">Jet (arcoíris)</option>
                    <option value="Hot">Hot (térmico)</option>
                    <option value="Grayscale">Escala de grises</option>
                </select>
            </div>
        {/if}

        {#if activeConfigMetric === "Impulse"}
            <div class="flex flex-col gap-1">
                <span class="text-[var(--text-secondary)] font-medium">Configuración de impulso</span>
                <label class="flex items-center gap-2 cursor-pointer text-[var(--text-primary)] py-1">
                    <input type="checkbox" 
                           checked={metricConfigs["Impulse"]?.modeY === 'ETC'}
                           onchange={(e) => {
                               metricConfigs["Impulse"] = {
                                   ...metricConfigs["Impulse"],
                                   modeY: e.currentTarget.checked ? 'ETC' : 'Linear'
                               };
                           }} />
                    <span>ETC (dB)</span>
                </label>
            </div>
        {/if}

        {#if activeConfigMetric === "Harmonics"}
            <div class="flex flex-col gap-2">
                <span class="text-[var(--text-secondary)] font-medium">Colores por armónico</span>
                <div class="flex items-center justify-between">
                    <span style="color:#ff4444" class="font-mono text-[10px]">H₂</span>
                    <input type="color" value={metricConfigs["Harmonics"]?.harmonicColorH2 ?? '#ff4444'}
                           oninput={e => {
                               if (!metricConfigs["Harmonics"]) metricConfigs["Harmonics"] = {};
                               metricConfigs["Harmonics"].harmonicColorH2 = e.currentTarget.value;
                           }}
                           class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                </div>
                <div class="flex items-center justify-between">
                    <span style="color:#f97316" class="font-mono text-[10px]">H₃</span>
                    <input type="color" value={metricConfigs["Harmonics"]?.harmonicColorH3 ?? '#f97316'}
                           oninput={e => {
                               if (!metricConfigs["Harmonics"]) metricConfigs["Harmonics"] = {};
                               metricConfigs["Harmonics"].harmonicColorH3 = e.currentTarget.value;
                           }}
                           class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                </div>
                <div class="flex items-center justify-between">
                    <span style="color:#eab308" class="font-mono text-[10px]">H₄</span>
                    <input type="color" value={metricConfigs["Harmonics"]?.harmonicColorH4 ?? '#eab308'}
                           oninput={e => {
                               if (!metricConfigs["Harmonics"]) metricConfigs["Harmonics"] = {};
                               metricConfigs["Harmonics"].harmonicColorH4 = e.currentTarget.value;
                           }}
                           class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                </div>
                <div class="flex items-center justify-between">
                    <span style="color:#a855f7" class="font-mono text-[10px]">H₅</span>
                    <input type="color" value={metricConfigs["Harmonics"]?.harmonicColorH5 ?? '#a855f7'}
                           oninput={e => {
                               if (!metricConfigs["Harmonics"]) metricConfigs["Harmonics"] = {};
                               metricConfigs["Harmonics"].harmonicColorH5 = e.currentTarget.value;
                           }}
                           class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                </div>
            </div>
        {/if}

        {#if activeConfigMetric === "Octave Bands"}
            <div class="flex flex-col gap-2">
                <span class="text-[var(--text-secondary)] font-medium">Modo de color</span>
                <select class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                        value={metricConfigs["Octave Bands"]?.octaveColorMode ?? 'pass_warn_fail'}
                        onchange={e => {
                            if (!metricConfigs["Octave Bands"]) metricConfigs["Octave Bands"] = {};
                            metricConfigs["Octave Bands"].octaveColorMode = e.currentTarget.value as 'pass_warn_fail' | 'solid';
                        }}>
                    <option value="pass_warn_fail">PASS / WARN / FAIL</option>
                    <option value="solid">Color sólido</option>
                </select>
                {#if (metricConfigs["Octave Bands"]?.octaveColorMode ?? 'pass_warn_fail') === 'pass_warn_fail'}
                    <div class="flex flex-col gap-1 text-[10px] text-[var(--text-muted)]">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-2" style="background:#22c55e"></span>
                            <span>Dentro de tolerancia (±3 dB)</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-2" style="background:#eab308"></span>
                            <span>Desviación moderada</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-2" style="background:#ef4444"></span>
                            <span>Fuera de tolerancia</span>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Editor de estilos de curva -->
        {#if activeConfigMetric && metricStyles[activeConfigMetric]}
            <div class="border-t pt-2 mt-1 flex flex-col gap-2" style="border-color: var(--border-primary)">
                <span class="text-[var(--text-secondary)] font-bold uppercase tracking-wider text-[8px]">Estilo de curva</span>
                
                <!-- Color -->
                <div class="flex items-center justify-between">
                    <span>Color</span>
                    <input type="color" bind:value={metricStyles[activeConfigMetric].color} class="w-6 h-6 border-none cursor-pointer rounded bg-transparent" />
                </div>

                <!-- 🔧 AVANZADO: Grosor y estilo -->
                {#if uiStore.showAdvanced}
                    <div class="flex flex-col gap-1">
                        <div class="flex justify-between">
                            <span>Grosor</span>
                            <span class="font-mono">{metricStyles[activeConfigMetric].lineWidth}px</span>
                        </div>
                        <input type="range" min="1" max="5" step="0.2" class="accent-[var(--accent)]"
                               bind:value={metricStyles[activeConfigMetric].lineWidth} />
                    </div>

                    <div class="flex flex-col gap-1">
                        <span>Estilo de línea</span>
                        <div class="flex gap-1">
                            <button class="flex-1 py-1 text-center border rounded text-[9px] cursor-pointer {metricStyles[activeConfigMetric].lineDash.length === 0 ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'}"
                                    onclick={() => metricStyles[activeConfigMetric!].lineDash = []}>
                                Sólido
                            </button>
                            <button class="flex-1 py-1 text-center border rounded text-[9px] cursor-pointer {metricStyles[activeConfigMetric].lineDash.join(',') === '8,4' ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'}"
                                    onclick={() => metricStyles[activeConfigMetric!].lineDash = [8, 4]}>
                                Dashed
                            </button>
                            <button class="flex-1 py-1 text-center border rounded text-[9px] cursor-pointer {metricStyles[activeConfigMetric].lineDash.join(',') === '2,3' ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'}"
                                    onclick={() => metricStyles[activeConfigMetric!].lineDash = [2, 3]}>
                                Dotted
                            </button>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Toggle visibilidad -->
        <div class="flex items-center justify-between mt-2 pt-2 border-t" style="border-color: var(--border-primary)">
            <span class="text-[10px] text-[var(--text-secondary)]">Visible en gráfico</span>
            <button
                class="w-8 h-4 rounded-full transition-all cursor-pointer {metricConfigs[activeConfigMetric!]?.hidden ? 'bg-[var(--bg-elevated)]' : 'bg-[var(--accent)]'}"
                onclick={() => {
                    if (!metricConfigs[activeConfigMetric!]) metricConfigs[activeConfigMetric!] = {};
                    metricConfigs[activeConfigMetric!].hidden = !metricConfigs[activeConfigMetric!].hidden;
                }}
            >
                <div class="w-3 h-3 rounded-full bg-white shadow transition-transform {metricConfigs[activeConfigMetric!]?.hidden ? 'translate-x-0.5' : 'translate-x-4'}"></div>
            </button>
        </div>

        <!-- Botón eliminar métrica -->
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
