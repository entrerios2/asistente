# Prompts de Remediación — Phase 2A.4

> **REGLA GLOBAL PARA EL AGENTE:** Ejecutá **ÚNICAMENTE** el prompt que se te indique. **NO avances** al siguiente prompt. **NO modifiques** archivos que no estén listados en el prompt. Al finalizar, ejecutá `npm run build` y reportá el resultado. Si el build falla, corregí los errores antes de declarar completado.

---

## Prompt R1: Eliminar `JSON.stringify` y `new Float32Array` del hot-path

**Objetivo:** Corregir dos anti-patterns de performance en `mathOrchestrator.svelte.ts`.

**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`
**Archivo secundario:** `src/lib/stores/traceManager.svelte.ts`

### Problema 1: JSON.stringify en $effect (líneas 99-106)

El constructor del `MathOrchestrator` tiene un `$effect` que usa `JSON.stringify` para detectar cambios:

```typescript
// ACTUAL (líneas 99-106) — ELIMINAR ESTE BLOQUE:
$effect(() => {
    if (typeof traceManager !== 'undefined' && traceManager && traceManager.eqBands) {
        JSON.stringify(traceManager.eqBands);
        JSON.stringify(calibrationStore.suggestedFilters);
        this.updateEQCache();
    }
});
```

Ya existe un método `checkDirty()` (líneas 212-240) que hace lo mismo con un hash numérico eficiente. El `$effect` con `JSON.stringify` es redundante y costoso.

**Acción:** Eliminá el bloque `$effect` de las líneas 99-106 completo. El timer autónomo `startTimer()` ya llama a `this.run()` que debería invocar `checkDirty()`. Verificá que `run()` efectivamente llame a `checkDirty()` al inicio. Si no lo hace, agregá `this.checkDirty();` como primera línea del método `run()`.

### Problema 2: new Float32Array en handleWorkerMessage (líneas 123-128)

Cada mensaje del worker crea 6 nuevos `Float32Array`:

```typescript
// ACTUAL (líneas 123-128) — REEMPLAZAR:
this.outputMagnitude = new Float32Array(data.outputMagnitude);
this.outputPhase = new Float32Array(data.outputPhase);
this.outputCoherence = new Float32Array(data.outputCoherence);
this.outputGroupDelay = new Float32Array(data.outputGroupDelay);
this.outputImpulse = new Float32Array(data.outputImpulse);
this.outputStep = new Float32Array(data.outputStep);
```

```typescript
// NUEVO — Escribir en buffers pre-alocados con .set():
this.outputMagnitude.set(new Float32Array(data.outputMagnitude));
this.outputPhase.set(new Float32Array(data.outputPhase));
this.outputCoherence.set(new Float32Array(data.outputCoherence));
this.outputGroupDelay.set(new Float32Array(data.outputGroupDelay));
this.outputImpulse.set(new Float32Array(data.outputImpulse));
this.outputStep.set(new Float32Array(data.outputStep));
```

> **NOTA:** Los `output*` están declarados como `$state(new Float32Array(...))` (líneas 59-64). `$state` trackea la referencia, así que cambiar de asignación `=` a `.set()` podría no triggear reactividad. Si esto rompe la UI, cambiá los output buffers a `$state.raw()` y forzá la reactividad incrementando `this.version++` (que ya se hace en la línea 153).

### Problema 3 (opcional): Version counter en traceManager

En `src/lib/stores/traceManager.svelte.ts`, agregar un counter para detectar cambios de EQ sin stringify:

```typescript
// En la clase TraceManager, después de la declaración de eqBands (línea ~82):
eqBandsVersion = $state(0);

// Crear un método helper:
updateEQBand(index: number, field: 'freq' | 'gain' | 'q' | 'type', value: number | string) {
    (this.eqBands[index] as any)[field] = value;
    this.eqBandsVersion++;
}
```

### Validación
1. `npm run build` debe compilar sin errores.
2. Abrir la app, activar la medición, y verificar que las curvas se actualizan.
3. Abrir DevTools > Performance, grabar 5 segundos, y verificar que NO aparece `JSON.stringify` en el flame chart.

### Límite Estricto
- **NO** modifiques `dspWorker.ts`, `canvasRenderers.ts`, `Quadrant.svelte`, ni `Sidebar.svelte`.
- **NO** avances al Prompt R2.

---

## Prompt R2: Controles DSP Avanzados en la pestaña Config del Sidebar

**Objetivo:** Agregar los selectores de Weighting, Averaging, Window Function, Source Windowing, y Leq al panel de configuración del Sidebar.

**Archivo a modificar:** `src/components/medicion/Sidebar.svelte`

### Contexto

La pestaña `config` del Sidebar (que empieza en la línea `{:else if uiStore.activeTab === "config"}`, alrededor de la línea 2027) tiene actualmente:
1. Calibración y Ganancia ✅
2. Hardware de Audio ✅
3. Pantalla y Preferencias ✅

**Falta** una sección de "Procesamiento DSP" con los controles que ya existen en `uiStore` pero no tienen UI. Los estados reactivos ya están declarados en `src/lib/stores/ui.svelte.ts` (líneas 47-57).

### Instrucciones

Insertá el siguiente bloque **después** de la card "Calibración y Ganancia" (que termina en la línea ~2131 con `</div>`) y **antes** de la card "Hardware de Audio" (línea ~2133):

```svelte
<!-- PROCESAMIENTO DSP AVANZADO -->
<div
    class="flex flex-col gap-4 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-xl p-4"
>
    <div
        class="flex items-center gap-2 border-b border-[#1a1a24]/30 pb-2"
    >
        <span
            class="material-symbols-outlined text-[#ec4899] text-lg"
            >tune</span
        >
        <h3
            class="text-xs font-bold text-gray-300 uppercase tracking-wider"
        >
            Procesamiento DSP
        </h3>
    </div>

    <!-- Ponderación de Frecuencia -->
    <div class="flex flex-col gap-1.5">
        <label
            class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
            >Ponderación (Weighting)</label
        >
        <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
            {#each ['Z', 'A', 'B', 'C'] as wt}
                <button
                    class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                           {uiStore.weightingType === wt
                        ? 'bg-[#ec4899]/15 text-[#ec4899] shadow'
                        : 'text-gray-500 hover:text-gray-300'}"
                    onclick={() => uiStore.weightingType = wt}
                >
                    {wt}
                </button>
            {/each}
        </div>
    </div>

    <!-- Promediado Complejo -->
    <div class="flex flex-col gap-1.5">
        <label
            class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
            >Promediado (Averaging)</label
        >
        <div class="flex bg-[#121216] p-0.5 rounded-md border border-[#1a1a24]/40">
            {#each ['None', 'FIFO', 'LPF'] as avgType}
                <button
                    class="flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer min-h-[28px]
                           {uiStore.averagingType === avgType
                        ? 'bg-[#ec4899]/15 text-[#ec4899] shadow'
                        : 'text-gray-500 hover:text-gray-300'}"
                    onclick={() => uiStore.averagingType = avgType}
                >
                    {avgType}
                </button>
            {/each}
        </div>
        {#if uiStore.averagingType === 'FIFO'}
            <div class="flex items-center gap-2 mt-1">
                <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Depth</span>
                <input
                    type="range" min="2" max="64" step="1"
                    bind:value={uiStore.averagingDepth}
                    ondblclick={() => uiStore.averagingDepth = 16}
                    class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                    title="Doble clic para reiniciar a 16"
                />
                <span class="text-[10px] font-mono text-[#ec4899] w-8 text-right">{uiStore.averagingDepth}</span>
            </div>
        {:else if uiStore.averagingType === 'LPF'}
            <div class="flex items-center gap-2 mt-1">
                <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Alpha</span>
                <input
                    type="range" min="0.01" max="0.5" step="0.01"
                    bind:value={uiStore.averagingAlpha}
                    ondblclick={() => uiStore.averagingAlpha = 0.1}
                    class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                    title="Doble clic para reiniciar a 0.1"
                />
                <span class="text-[10px] font-mono text-[#ec4899] w-10 text-right">{uiStore.averagingAlpha.toFixed(2)}</span>
            </div>
        {/if}
    </div>

    <!-- Función de Ventana -->
    <div class="flex flex-col gap-1.5">
        <label
            class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
            >Ventana (Window)</label
        >
        <select
            bind:value={uiStore.windowType}
            class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-[#ec4899]"
        >
            {#each ['Rectangular', 'Hann', 'Hamming', 'FlatTop', 'BlackmanHarris', 'HFT223D', 'Exponential'] as wType}
                <option value={wType}>{wType}</option>
            {/each}
        </select>
    </div>

    <!-- Source Windowing (Time Gate) -->
    <div class="flex flex-col gap-2 pt-2 border-t border-[#1a1a24]/20">
        <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
            <input
                type="checkbox"
                bind:checked={uiStore.enableSourceWindow}
                class="w-4 h-4 rounded accent-[#ec4899] cursor-pointer"
            />
            <span class="font-semibold select-none">Source Window (Time Gate)</span>
        </label>
        {#if uiStore.enableSourceWindow}
            <div class="flex flex-col gap-2 pl-6">
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Width</span>
                    <input
                        type="range" min="0.5" max="50" step="0.5"
                        bind:value={uiStore.sourceWindowWidthMs}
                        ondblclick={() => uiStore.sourceWindowWidthMs = 10.0}
                        class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                    />
                    <span class="text-[10px] font-mono text-[#ec4899] w-14 text-right">{uiStore.sourceWindowWidthMs.toFixed(1)} ms</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Offset</span>
                    <input
                        type="range" min="-20" max="20" step="0.1"
                        bind:value={uiStore.sourceWindowOffsetMs}
                        ondblclick={() => uiStore.sourceWindowOffsetMs = 0}
                        class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                    />
                    <span class="text-[10px] font-mono text-[#ec4899] w-14 text-right">{uiStore.sourceWindowOffsetMs.toFixed(1)} ms</span>
                </div>
            </div>
        {/if}
    </div>

    <!-- Leq (Nivel Equivalente Continuo) -->
    <div class="flex flex-col gap-2 pt-2 border-t border-[#1a1a24]/20">
        <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
            <input
                type="checkbox"
                bind:checked={uiStore.enableLeq}
                class="w-4 h-4 rounded accent-[#ec4899] cursor-pointer"
            />
            <span class="font-semibold select-none">Leq (Nivel Equivalente)</span>
        </label>
        {#if uiStore.enableLeq}
            <div class="flex items-center gap-2 pl-6">
                <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Ventana</span>
                <input
                    type="range" min="1" max="60" step="1"
                    bind:value={uiStore.leqWindowSeconds}
                    ondblclick={() => uiStore.leqWindowSeconds = 10}
                    class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                />
                <span class="text-[10px] font-mono text-[#ec4899] w-10 text-right">{uiStore.leqWindowSeconds} s</span>
            </div>
            <div class="flex items-center gap-2 pl-6">
                <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Valor</span>
                <span class="text-sm font-mono font-bold text-[#00ff88]">{uiStore.leqValue.toFixed(1)} dBSPL</span>
            </div>
        {/if}
    </div>

    <!-- FPS y DSP Rate -->
    <div class="flex flex-col gap-2 pt-2 border-t border-[#1a1a24]/20">
        <div class="flex items-center gap-2">
            <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Target FPS</span>
            <input
                type="range" min="5" max="60" step="5"
                bind:value={uiStore.targetFps}
                ondblclick={() => uiStore.targetFps = 30}
                class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                title="Doble clic para reiniciar a 30"
            />
            <span class="text-[10px] font-mono text-[#ec4899] w-8 text-right">{uiStore.targetFps}</span>
        </div>
        <div class="flex items-center gap-2">
            <span class="text-[9px] text-gray-500 font-bold uppercase w-16">DSP Rate</span>
            <input
                type="range" min="1" max="10" step="1"
                bind:value={uiStore.dspUpdateRate}
                ondblclick={() => uiStore.dspUpdateRate = 2}
                class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                title="Doble clic para reiniciar a 2 Hz"
            />
            <span class="text-[10px] font-mono text-[#ec4899] w-10 text-right">{uiStore.dspUpdateRate} Hz</span>
        </div>
        <div class="flex items-center gap-2">
            <span class="text-[9px] text-gray-500 font-bold uppercase w-16">FFT Size</span>
            <select
                bind:value={uiStore.fftSize}
                class="flex-1 bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200"
            >
                {#each [2048, 4096, 8192, 16384, 32768] as size}
                    <option value={size}>{size}</option>
                {/each}
            </select>
        </div>
    </div>
</div>
```

### Validación
1. `npm run build` debe compilar sin errores.
2. Abrir la app, ir a la pestaña "Cfg" en el sidebar.
3. Verificar que los controles aparecen entre "Calibración" y "Hardware".
4. Cambiar el weighting a "A" y verificar que `uiStore.weightingType` se actualiza en DevTools.
5. Activar Source Window y mover los sliders.

### Límite Estricto
- **SOLO** modificá `Sidebar.svelte`.
- **NO** modifiques `ui.svelte.ts` (los estados ya existen).
- **NO** avances al Prompt R3.

---

## Prompt R3: Integrar sistema de capas en el draw loop del Quadrant

**Objetivo:** Hacer que `Quadrant.svelte` itere sobre las capas (`traceManager.layers`) asignadas a su cuadrante y las dibuje con visual coding (color por métrica, dash por capa).

**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

### Contexto

- `traceManager.layers` es un array `$state<MeasurementLayer[]>` con `id`, `name`, `visible`, `isMeasuring`, `quadrantId`, `sourceType`, `data`.
- El método `traceManager.addLayer('Capa 1', 'q-1', 'live')` se ejecuta en el constructor y crea una capa por defecto.
- `mathOrchestrator.handleWorkerMessage()` ya escribe en la capa activa (`isMeasuring && id === uiStore.activeLayerId`).
- El `id` del Quadrant se pasa como prop (`let { id }: Props = $props()`).

### Instrucciones

1. **Agregar un getter derivado** al inicio del bloque `<script>` para las capas de este cuadrante:

```typescript
const myLayers = $derived(
    traceManager.layers.filter(l => l.quadrantId === id && l.visible)
);
```

2. **Definir las constantes de visual coding** después del getter:

```typescript
// Visual coding: dash patterns por índice de capa
const LAYER_DASHES: number[][] = [
    [],          // Capa 1: sólida
    [8, 4],      // Capa 2: guiones
    [2, 3],      // Capa 3: puntos
    [8, 3, 2, 3] // Capa 4: guión-punto
];

// Visual coding: colores por tipo de métrica
const METRIC_COLORS: Record<string, string> = {
    'Magnitude': '#ff4444',
    'Phase': '#d946ef',
    'Coherence': '#eab308',
    'Group Delay': '#3b82f6',
    'Impulse': '#14b8a6',
    'Step': '#10b981',
    'Spectrum': '#a855f7',
    'Scope': '#06b6d4',
    'Crest Factor': '#f97316',
};
```

3. **En el draw loop**, buscar donde actualmente se llama a `drawMetricPath` para la métrica "Magnitude". El patrón actual probablemente es algo como:

```typescript
// PATRÓN ACTUAL (buscar algo similar):
drawMetricPath(ctx, interpMagnitude, width, height, '#ff4444', 2, [], 'Magnitude', ...);
```

**Antes** de esa llamada, agregar la iteración de capas:

```typescript
// NUEVO: Dibujar capas adicionales (no-live) de este cuadrante
for (let li = 0; li < myLayers.length; li++) {
    const layer = myLayers[li];
    if (layer.isMeasuring) continue; // La capa live se dibuja aparte con el pipeline principal
    if (layer.data.length === 0) continue;

    const dashPattern = LAYER_DASHES[li % LAYER_DASHES.length];
    const isActive = layer.id === uiStore.activeLayerId;
    const lineWidth = isActive ? 2.5 : 1.2;
    const alpha = isActive ? 1.0 : 0.75;

    // Determinar la métrica principal para el color
    const metricForColor = activeMetrics[0] || 'Magnitude';
    const color = METRIC_COLORS[metricForColor] || '#ff4444';

    ctx.globalAlpha = alpha;
    drawMetricPath(
        ctx, layer.data, width, height,
        color, lineWidth, dashPattern,
        metricForColor, frequencyLUT, interpCoherence,
        metricConfigs, interactionState, getPPOSmoothedValue
    );
    ctx.globalAlpha = 1.0;
}
```

### Validación
1. `npm run build` debe compilar sin errores.
2. Abrir la app y verificar que la capa por defecto ("Capa 1") se dibuja.
3. En la consola del navegador, ejecutar: `traceManager.addLayer('Capa 2', 'q-1', 'snapshot')` — debería aparecer una segunda capa con línea punteada.

### Límite Estricto
- **SOLO** modificá `Quadrant.svelte`.
- **NO** modifiques `traceManager.svelte.ts`, `mathOrchestrator.svelte.ts`, ni `canvasRenderers.ts`.
- **NO** avances al Prompt R4.

---

## Prompt R4: Zoom diferenciado X/Y y cursor grab

**Objetivo:** Agregar zoom independiente por eje (X = frecuencia, Y = amplitud) y cambiar el cursor a `grab`/`grabbing` durante el paneo.

**Archivo a modificar:** `src/lib/dsp/canvasInteraction.ts`
**Archivo secundario:** `src/components/medicion/Quadrant.svelte` (solo el atributo `style` del canvas)

### Contexto

Actualmente `canvasInteraction.ts` exporta un `handleWheel` que aplica zoom uniforme. La `InteractionState` tiene `zoomLevel`, `offsetX`, `offsetY`.

### Instrucciones

1. **Verificar la interfaz `InteractionState`** en `canvasInteraction.ts`. Si solo tiene un `zoomLevel`, agregar:

```typescript
export interface InteractionState {
    // ... campos existentes ...
    zoomX: number;     // Zoom independiente eje X (frecuencia)
    zoomY: number;     // Zoom independiente eje Y (amplitud)
    zoomMode: 'XY' | 'X' | 'Y'; // Modo de zoom activo
    isDragging: boolean; // Para el cursor grab/grabbing
}
```

2. **Modificar `handleWheel`** para respetar `zoomMode`:

```typescript
export function handleWheel(e: WheelEvent, state: InteractionState, width: number, height: number): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;

    // Alt+Scroll = zoom Y solamente
    // Shift+Scroll = zoom X solamente
    // Normal = según zoomMode
    if (e.altKey) {
        state.zoomY = Math.max(0.1, Math.min(20, state.zoomY * delta));
    } else if (e.shiftKey) {
        state.zoomX = Math.max(0.1, Math.min(20, state.zoomX * delta));
    } else {
        if (state.zoomMode === 'X') {
            state.zoomX = Math.max(0.1, Math.min(20, state.zoomX * delta));
        } else if (state.zoomMode === 'Y') {
            state.zoomY = Math.max(0.1, Math.min(20, state.zoomY * delta));
        } else {
            state.zoomX = Math.max(0.1, Math.min(20, state.zoomX * delta));
            state.zoomY = Math.max(0.1, Math.min(20, state.zoomY * delta));
        }
    }
}
```

3. **Modificar `handleDoubleClick`** para resetear zoom:

```typescript
export function handleDoubleClick(state: InteractionState): void {
    state.zoomX = 1;
    state.zoomY = 1;
    state.offsetX = 0;
    state.offsetY = 0;
}
```

4. **Modificar `handleMouseDown` y `handleMouseMove`** para setear `isDragging`:

```typescript
// En handleMouseDown:
state.isDragging = true;

// En handleMouseUp (si existe) o al final de handleMouseMove cuando button === 0:
// Agregar un handleMouseUp exportado:
export function handleMouseUp(state: InteractionState): void {
    state.isDragging = false;
}
```

5. **En `valToX` y `valToY`**, verificá que usen `state.zoomX` y `state.zoomY` respectivamente en vez de un `zoomLevel` único. Si usan `zoomLevel`, reemplazá:
   - `state.zoomLevel` en el eje X → `state.zoomX`
   - `state.zoomLevel` en el eje Y → `state.zoomY`

6. **En `Quadrant.svelte`**, buscar donde se inicializa el `InteractionState` y agregar los campos nuevos:

```typescript
// Donde se crea el estado (buscar la inicialización):
zoomX: 1,
zoomY: 1,
zoomMode: 'XY' as const,
isDragging: false,
```

7. **En `Quadrant.svelte`**, agregar el estilo de cursor al canvas:

```svelte
<!-- Buscar el tag <canvas> y agregar/modificar el style: -->
<canvas
    bind:this={canvas}
    style="cursor: {interactionState.isDragging ? 'grabbing' : 'grab'}"
    ...
/>
```

### Validación
1. `npm run build` debe compilar sin errores.
2. Scroll normal = zoom XY, Alt+Scroll = zoom Y, Shift+Scroll = zoom X.
3. Doble clic resetea zoom.
4. El cursor muestra `grab` y cambia a `grabbing` al arrastrar.

### Límite Estricto
- **SOLO** modificá `canvasInteraction.ts` y el tag `<canvas>` + inicialización de estado en `Quadrant.svelte`.
- **NO** modifiques `canvasRenderers.ts`, `Sidebar.svelte`, ni otros archivos.
- **NO** avances al Prompt R5.

---

## Prompt R5: Renderer de Phase Delay

**Objetivo:** Agregar la función `drawPhaseDelay` a `canvasRenderers.ts` y conectarla en `Quadrant.svelte`.

**Archivo a modificar:** `src/lib/dsp/canvasRenderers.ts`
**Archivo secundario:** `src/components/medicion/Quadrant.svelte`

### Instrucciones

1. **En `canvasRenderers.ts`**, agregar la siguiente función al final del archivo (antes de la última línea):

```typescript
export function drawPhaseDelay(
    ctx: CanvasRenderingContext2D,
    phaseData: Float32Array,
    width: number,
    height: number,
    color: string,
    lw: number,
    frequencyLUT: Int32Array,
    metricConfigs: Record<string, any>,
    state: InteractionState,
    bins: number
) {
    if (frequencyLUT.length === 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    let first = true;
    const sr = 48000;
    const binWidth = sr / 2 / bins;

    for (let x = 0; x < width; x++) {
        const binIndex = frequencyLUT[x];
        if (binIndex === undefined || binIndex < 1) continue;

        const freq = binIndex * binWidth || 1e-6;
        const phaseRad = (phaseData[binIndex] * Math.PI) / 180;

        // Phase Delay = -φ(f) / (2πf), convertido a ms
        const phaseDelayMs = (-phaseRad / (2 * Math.PI * freq)) * 1000;

        // Clamp para evitar valores absurdos en bajas frecuencias
        const clampedDelay = Math.max(-5, Math.min(25, phaseDelayMs));

        const y = valToY(clampedDelay, height, 'Phase Delay', metricConfigs, state);

        if (first) {
            ctx.moveTo(x, y);
            first = false;
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}
```

2. **En `Quadrant.svelte`**, agregar el import:

```typescript
// Buscar la línea de imports de canvasRenderers (alrededor de la línea 26-41) y agregar:
import {
    // ... imports existentes ...,
    drawPhaseDelay
} from "$lib/dsp/canvasRenderers";
```

3. **En `Quadrant.svelte`**, buscar el bloque del draw loop donde se dibujan las métricas (buscar llamadas a `drawMetricPath`, `drawPhasePath`, `drawTimeDomainPath`) y agregar:

```typescript
// Después de la llamada a drawPhasePath (o donde se dibujan las métricas de frecuencia):
if (activeMetrics.includes('Phase Delay')) {
    drawPhaseDelay(
        ctx, interpPhase, width, height,
        '#06b6d4', 1.5,
        frequencyLUT, metricConfigs, interactionState,
        BINS
    );
}
```

4. **En `Quadrant.svelte`**, verificar que "Phase Delay" esté en la lista de métricas seleccionables. Buscar el array de métricas disponibles (probablemente un array como `['Magnitude', 'Phase', 'Coherence', ...]`) y agregar `'Phase Delay'` si no está.

### Validación
1. `npm run build` debe compilar sin errores.
2. Abrir la app, seleccionar "Phase Delay" como métrica en un cuadrante.
3. Verificar que aparece una curva de retardo de fase en milisegundos con el eje Y de -5ms a 25ms.

### Límite Estricto
- **SOLO** modificá `canvasRenderers.ts` y `Quadrant.svelte`.
- **NO** modifiques `canvasInteraction.ts`, `Sidebar.svelte`, ni `mathOrchestrator.svelte.ts`.
- **NO** avances al Prompt R6.

---

## Prompt R6: Sidebar colapsable con animación CSS

**Objetivo:** Hacer que el sidebar del layout principal se colapse/expanda con animación suave cuando `uiStore.showSidebar` cambia.

**Archivo a modificar:** `src/routes/+page.svelte`

### Contexto

- `uiStore.showSidebar` es un `$state(true)` en `ui.svelte.ts`.
- El botón de colapso ya existe en `Sidebar.svelte` (línea ~710-716) y cambia `uiStore.showSidebar`.
- **El problema es que `+page.svelte` no responde a `uiStore.showSidebar`** para ocultar/mostrar el sidebar.

### Instrucciones

1. **En `+page.svelte`**, buscar donde se renderiza el `<Sidebar />` component. Envolvelo con una transición condicional:

```svelte
<script lang="ts">
    import { uiStore } from "$lib/stores/ui.svelte";
    // ... otros imports existentes ...
</script>

<!-- En el layout, reemplazar la renderización directa del Sidebar con: -->
<div class="flex h-screen w-screen overflow-hidden">
    <!-- Sidebar con transición -->
    {#if uiStore.showSidebar}
        <div
            class="sidebar-container flex-shrink-0 overflow-hidden"
            style="width: 380px; transition: width 300ms ease, opacity 300ms ease;"
        >
            <Sidebar />
        </div>
    {:else}
        <!-- Mini-botón flotante para re-abrir el sidebar -->
        <button
            class="fixed left-2 top-2 z-50 w-10 h-10 bg-[#121216] border border-[#1a1a24] rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1a1a24] transition-all cursor-pointer shadow-lg"
            onclick={() => uiStore.showSidebar = true}
            title="Abrir Panel"
        >
            <span class="material-symbols-outlined text-[18px]">menu</span>
        </button>
    {/if}

    <!-- Contenido principal (cuadrantes) -->
    <div class="flex-1 overflow-hidden">
        <!-- ... contenido existente de los cuadrantes ... -->
    </div>
</div>
```

> **NOTA:** Adaptá este esqueleto al layout existente de `+page.svelte`. No reescribas todo el archivo — solo envolvé el Sidebar con la lógica condicional y agregá el mini-botón.

### Validación
1. `npm run build` debe compilar sin errores.
2. Clic en el botón de colapso del sidebar: el sidebar desaparece y los cuadrantes ocupan todo el ancho.
3. Clic en el mini-botón flotante: el sidebar reaparece.

### Límite Estricto
- **SOLO** modificá `+page.svelte`.
- **NO** modifiques `Sidebar.svelte`, `Header.svelte`, ni `ui.svelte.ts`.
- **NO** avances al Prompt R7.

---

## Prompt R7: Crest Factor real en el DSP Worker

**Objetivo:** Reemplazar el placeholder hardcoded de Crest Factor en `canvasRenderers.ts` por un cálculo real proveniente del DSP Worker.

**Archivo principal:** `src/lib/dsp/dspWorker.ts`
**Archivo secundario:** `src/lib/stores/mathOrchestrator.svelte.ts`

### Contexto

Actualmente `drawCrestFactor` en `canvasRenderers.ts` (líneas 927-958) usa un placeholder:
```typescript
const val = Math.abs(spectrumData[binIndex]) * 0.15 + 12; // PLACEHOLDER
```

El Crest Factor real es: `CF(f) = 20 * log10(peak(f) / rms(f))` por bin de frecuencia.

### Instrucciones

1. **En `dspWorker.ts`**, agregar un buffer de salida para crest factor. Buscar las declaraciones de buffers (líneas ~190-196) y agregar:

```typescript
let outputCrestFactor: Float32Array;
```

2. **En la sección de re-alocación** (dentro del `if (BINS !== currentBins ...)`, ~línea 237-261), agregar:

```typescript
outputCrestFactor = new Float32Array(BINS);
```

3. **En el pipeline de procesamiento** del worker (después de calcular outputMagnitude, ~línea 352), agregar el cálculo de Crest Factor:

```typescript
// Crest Factor por bin: CF = peak_dB - rms_dB (simplificado a partir de la magnitud)
if (metricsSet.has("Crest Factor")) {
    for (let k = 0; k < BINS; k++) {
        const mag = Math.sqrt(fftInputReal[k] * fftInputReal[k] + fftInputImag[k] * fftInputImag[k]);
        const peakDb = 20 * Math.log10(mag + 1e-12);
        // Estimar RMS como promedio local de 5 bins
        let sumSq = 0;
        let count = 0;
        for (let j = Math.max(0, k - 2); j <= Math.min(BINS - 1, k + 2); j++) {
            const m = Math.sqrt(fftInputReal[j] * fftInputReal[j] + fftInputImag[j] * fftInputImag[j]);
            sumSq += m * m;
            count++;
        }
        const rmsDb = 10 * Math.log10(sumSq / count + 1e-24);
        outputCrestFactor[k] = Math.max(0, Math.min(30, peakDb - rmsDb));
    }
}
```

4. **En el `postMessage`** del worker (líneas ~397-406), agregar:

```typescript
outputCrestFactor: outputCrestFactor.slice().buffer,
```

5. **En `mathOrchestrator.svelte.ts`**, agregar el buffer de salida. Buscar las declaraciones `outputStep = $state(...)` (~línea 64) y agregar:

```typescript
outputCrestFactor = $state(new Float32Array(this.BINS));
```

6. **En `handleWorkerMessage`** del orchestrator, agregar la recepción:

```typescript
if (data.outputCrestFactor) {
    this.outputCrestFactor.set(new Float32Array(data.outputCrestFactor));
}
```

7. **En `reallocateBuffers`** del orchestrator, agregar:

```typescript
this.outputCrestFactor = new Float32Array(this.BINS);
```

### Validación
1. `npm run build` debe compilar sin errores.
2. Seleccionar "Crest Factor" como métrica — debería mostrar valores entre 0-30 dB en vez del placeholder lineal anterior.

### Límite Estricto
- **SOLO** modificá `dspWorker.ts` y `mathOrchestrator.svelte.ts`.
- **NO** modifiques `canvasRenderers.ts` (la función `drawCrestFactor` se actualizará en un prompt futuro).
- **NO** avances al Prompt R8.

---

## Prompt R8: Conectar Crest Factor real al renderer

**Objetivo:** Actualizar `drawCrestFactor` en `canvasRenderers.ts` y la llamada en `Quadrant.svelte` para usar el buffer `outputCrestFactor` calculado por el worker.

**Archivo principal:** `src/lib/dsp/canvasRenderers.ts`
**Archivo secundario:** `src/components/medicion/Quadrant.svelte`

### Instrucciones

1. **En `canvasRenderers.ts`**, reemplazar la función `drawCrestFactor` completa (líneas 927-958) por:

```typescript
export function drawCrestFactor(
    ctx: CanvasRenderingContext2D,
    crestFactorData: Float32Array,
    width: number,
    height: number,
    frequencyLUT: Int32Array,
    state: InteractionState,
    color: string
) {
    if (frequencyLUT.length === 0 || crestFactorData.length === 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let first = true;

    for (let x = 0; x < width; x++) {
        const binIndex = frequencyLUT[x];
        if (binIndex === undefined) continue;

        const val = crestFactorData[binIndex];
        const y = valToY(val, height, "Crest Factor", {}, state);

        if (first) {
            ctx.moveTo(x, y);
            first = false;
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}
```

2. **En `Quadrant.svelte`**, buscar la llamada existente a `drawCrestFactor` y actualizarla para pasar `mathOrchestrator.outputCrestFactor` en vez de `spectrumData`:

```typescript
// BUSCAR algo como:
drawCrestFactor(ctx, interpMagnitude, width, height, frequencyLUT, interactionState, '#f97316');

// REEMPLAZAR con:
drawCrestFactor(ctx, mathOrchestrator.outputCrestFactor, width, height, frequencyLUT, interactionState, '#f97316');
```

### Validación
1. `npm run build` debe compilar sin errores.
2. Seleccionar "Crest Factor" como métrica — la curva debe mostrar valores reales de peak/RMS entre 0-30 dB.

### Límite Estricto
- **SOLO** modificá `canvasRenderers.ts` y la llamada en `Quadrant.svelte`.
- **NO** modifiques `dspWorker.ts` ni `mathOrchestrator.svelte.ts` (ya se hizo en R7).
