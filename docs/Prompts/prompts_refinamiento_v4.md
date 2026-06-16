# Prompts de Refinamiento v4 — Instrucciones Atómicas

> **INSTRUCCIONES GENERALES PARA EL AGENTE:**
> - Apegate **estrictamente** a cada prompt. No innoves, no agregues features, no refactorices código fuera del alcance de cada prompt.
> - **NO avances al siguiente prompt** excepto que el usuario te lo instruya explícitamente con una frase como "ejecuta el prompt N".
> - Un mensaje como "continue", "ok", "bien" o "siguiente" **NO es autorización para avanzar**. Esperá instrucciones explícitas.
> - Después de cada prompt, reportá los cambios realizados y esperá confirmación.
> - Si encontrás un conflicto o ambigüedad, preguntá antes de proceder.

---

## Prompt 1: Ajustar límites de clamp y grilla dB

**Archivo**: `src/lib/dsp/canvasInteraction.ts`

1. Localizar las constantes `dbPanMin` y `dbPanMax` (alrededor de L57-58). Cambiar sus valores:

```typescript
// ANTES:
export const dbPanMin = -60; // dB
export const dbPanMax = 60;  // dB

// DESPUÉS:
export const dbPanMin = -80; // dB - límite de pan/zoom
export const dbPanMax = 80;  // dB - límite de pan/zoom
```

2. Localizar todos los `Math.min(20,` en el archivo (en `handleWheel` y `handleTouchMove`). Cambiar `20` por `4`:

```typescript
// ANTES:
state.zoomX = Math.max(0.5, Math.min(20, state.zoomX * delta));
state.zoomY = Math.max(0.5, Math.min(20, state.zoomY * delta));

// DESPUÉS:
state.zoomX = Math.max(0.5, Math.min(4, state.zoomX * delta));
state.zoomY = Math.max(0.5, Math.min(4, state.zoomY * delta));
```

Hay 4 ocurrencias: 2 en `handleWheel` (zoomX y zoomY) y 2 en `handleTouchMove` (pinch zoom X e Y). Cambiar las 4.

**Archivo**: `src/lib/dsp/canvasRenderers.ts`

3. Localizar la función `drawGrid`. Dentro de la sección "Horizontal ticks (Left Y axis)" (aprox L87), hay un bloque con `let min = dbMin, max = dbMax`. Cambiar a:

```typescript
// ANTES:
let min = dbMin, max = dbMax, step = 10, unit = "dB";

// DESPUÉS:
let min = -60, max = 60, step = 10, unit = "dB";
```

> **IMPORTANTE**: NO cambiar `dbMin`/`dbMax` (que son -30/+30). Esos se usan para la proyección `valToY`. Solo cambiar el rango de la grilla a ±60dB hardcodeado.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 2: Fix del clamp de pan (saltos descontrolados)

**Archivo**: `src/lib/dsp/canvasInteraction.ts`

1. Verificar que la función `clampPan` tiene exactamente esta implementación (sin lógica condicional ni overscroll):

```typescript
export function clampPan(
    state: InteractionState,
    width: number,
    height: number,
    hasTimeDomainActive: boolean,
    metricType: string,
    metricConfigs: Record<string, any>
): void {
    // Clamp eje X (solo en modo frecuencia)
    if (!hasTimeDomainActive) {
        const xMin = valToX(freqMin, width, false, state);
        const xMax = valToX(freqMax, width, false, state);
        if (xMin > 0) state.offsetX -= xMin;
        if (xMax < width) state.offsetX += width - xMax;
    }
    // Clamp eje Y (±80 dB)
    const yTop = valToY(dbPanMax, height, metricType, metricConfigs, state);
    const yBottom = valToY(dbPanMin, height, metricType, metricConfigs, state);
    if (yTop > 0) state.offsetY -= yTop;
    if (yBottom < height) state.offsetY += height - yBottom;
}
```

2. Verificar que `clampPan` se llama en TODOS estos puntos:
   - Al final de `handleMouseMove` (después de modificar `offsetX`/`offsetY` durante drag)
   - Al final de `handleTouchMove` (después del drag de 1 dedo)
   - Al final de `handleTouchMove` (después del pinch zoom de 2 dedos — **agregar si falta**)
   - Al final de `handleWheel` (después de modificar zoom)

3. Agregar `clampPan` a `handleMouseUp`. Cambiar la firma para recibir los parámetros necesarios:

```typescript
// ANTES:
export function handleMouseUp(state: InteractionState): void {
    state.isDragging = false;
}

// DESPUÉS:
export function handleMouseUp(
    state: InteractionState,
    width: number,
    height: number,
    hasTimeDomainActive: boolean,
    activeMetrics: string[],
    metricConfigs: Record<string, any>
): void {
    state.isDragging = false;
    const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
    clampPan(state, width, height, hasTimeDomainActive, refMetric, metricConfigs);
}
```

4. Agregar `clampPan` a `handleTouchEnd`. Cambiar la firma:

```typescript
// ANTES:
export function handleTouchEnd(state: InteractionState) {
    state.isDragging = false;
    state.isPinching = false;
    state.showCrosshair = false;
}

// DESPUÉS:
export function handleTouchEnd(
    state: InteractionState,
    width: number,
    height: number,
    hasTimeDomainActive: boolean,
    activeMetrics: string[],
    metricConfigs: Record<string, any>
) {
    state.isDragging = false;
    state.isPinching = false;
    state.showCrosshair = false;
    const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
    clampPan(state, width, height, hasTimeDomainActive, refMetric, metricConfigs);
}
```

5. Verificar que al final de `handleTouchMove`, en el bloque de pinch zoom (2 dedos), también se llame a `clampPan`. Si falta, agregar después de modificar `zoomX`/`zoomY`:

```typescript
} else if (e.touches.length === 2 && state.isPinching) {
    // ...existing pinch zoom code...
    if (dist > 0 && state.touchStartDist > 0) {
        const factor = dist / state.touchStartDist;
        state.zoomX = Math.max(0.5, Math.min(4, state.touchStartScaleX * factor));
        state.zoomY = Math.max(0.5, Math.min(4, state.touchStartScaleY * factor));
    }
    // AGREGAR AQUÍ:
    const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
    clampPan(state, rect.width, rect.height, false, refMetric, metricConfigs);
}
```

**Archivo**: `src/components/medicion/Quadrant.svelte`

6. Actualizar las llamadas a `handleMouseUp` y `handleTouchEnd` para pasar los nuevos parámetros. Buscar las llamadas existentes y agregar: `containerWidth, containerHeight, hasTimeDomainActive, activeMetrics, metricConfigs`.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 3: Menú zoom para anclar eje (no para hacer zoom)

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. Localizar la función `zoomTactile`. **Eliminarla completamente.**

2. Localizar el bloque del menú zoom (buscar `showZoomMenu` y el `div` con las opciones "Zoom XY", "Zoom X", "Zoom Y"). Reemplazar **todo el contenido** del menú desplegable (el `div` que aparece cuando `showZoomMenu` es true) por:

```svelte
<div class="absolute right-0 bottom-10 bg-[#0c0c0e] border border-[#1a1a24] rounded-lg p-1.5 shadow-xl z-50 min-w-[110px] flex flex-col gap-0.5">
    {#each [
        { mode: 'XY', label: 'Libre (XY)', icon: 'open_with' },
        { mode: 'X', label: 'Solo Eje X', icon: 'swap_horiz' },
        { mode: 'Y', label: 'Solo Eje Y', icon: 'swap_vert' },
    ] as opt}
        <button class="px-3 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer text-left flex items-center gap-1.5
                       {interactionState.zoomMode === opt.mode ? 'text-[#00ff88] bg-[#00ff88]/10' : 'text-gray-300 hover:text-white hover:bg-[#121216]'}"
            onclick={() => { interactionState.zoomMode = opt.mode; showZoomMenu = false; }}>
            <span class="material-symbols-outlined text-[14px]">{opt.icon}</span>
            {opt.label}
        </button>
    {/each}
    <div class="border-t border-[#1a1a24] my-0.5"></div>
    <button class="px-3 py-1.5 text-[10px] font-bold text-[#00ff88] hover:bg-[#00ff88]/10 rounded transition-all cursor-pointer text-left"
        onclick={() => { handleDoubleClick(); showZoomMenu = false; }}>Restaurar</button>
</div>
```

3. Localizar el icono del botón de zoom (`zoom_in` dentro del botón `showZoomMenu`). Reemplazar el `<span>` del icono por:

```svelte
<span class="material-symbols-outlined text-[16px]">
    {interactionState.zoomMode === 'X' ? 'swap_horiz' : interactionState.zoomMode === 'Y' ? 'swap_vert' : 'open_with'}
</span>
```

**Archivo**: `src/lib/dsp/canvasInteraction.ts`

4. En `handleWheel`, localizar el bloque `else` de la zona central (actualmente L210-213):

```typescript
// ANTES:
} else {
    // Área central: zoom XY proporcional
    zoomX = true;
    zoomY = true;
}

// DESPUÉS:
} else {
    // Área central: respetar el modo anclado
    zoomX = state.zoomMode === 'XY' || state.zoomMode === 'X';
    zoomY = state.zoomMode === 'XY' || state.zoomMode === 'Y';
}
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 4: Zoom Y inicial más alejado + restaurar

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. Localizar la inicialización de `interactionState` (buscar `zoomY: 1`). Cambiar a:

```typescript
zoomY: 0.7,
```

**Archivo**: `src/lib/dsp/canvasInteraction.ts`

2. Localizar `handleDoubleClick`. Cambiar `zoomY = 1` a `zoomY = 0.7`:

```typescript
export function handleDoubleClick(state: InteractionState): void {
    state.zoomX = 1;
    state.zoomY = 0.7;
    state.offsetX = 0;
    state.offsetY = 0;
}
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 5: Cursores contextuales por zona

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. Agregar un `$derived` para el cursor, DESPUÉS de la declaración de `containerHeight` (aprox L93):

```typescript
let cursorStyle = $derived.by(() => {
    if (interactionState.isDragging) return 'grabbing';
    const mX = interactionState.mouseX;
    const mY = interactionState.mouseY;
    if (mX <= 45) return 'ns-resize';
    if (mY >= containerHeight - 25) return 'ew-resize';
    return 'crosshair';
});
```

2. Localizar el `<div class="quadrant-container"` (aprox L1144). Reemplazar el `style` inline:

```svelte
<!-- ANTES: -->
style="cursor: {interactionState.isDragging ? 'grabbing' : 'grab'}; background: {uiStore.isDarkMode ? '#060608' : '#f8f8fa'}; touch-action: none;"

<!-- DESPUÉS: -->
style="cursor: {cursorStyle}; background: {uiStore.isDarkMode ? '#060608' : '#f8f8fa'}; touch-action: none;"
```

3. Localizar el `<canvas` (aprox L1340). Reemplazar el `style` inline:

```svelte
<!-- ANTES: -->
style="cursor: {interactionState.isDragging ? 'grabbing' : 'grab'}"

<!-- DESPUÉS: -->
style="cursor: {cursorStyle}"
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 6: ID del cuadrante como watermark

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. Localizar `<span class="quadrant-id font-bold text-[14px] text-emerald-400">` (aprox L1177). **Eliminar toda la línea.**

2. Localizar el `<canvas bind:this={canvas}` (aprox L1340). **Inmediatamente después** de la etiqueta `<canvas>`, agregar:

```svelte
<!-- WATERMARK ID DEL CUADRANTE -->
<span class="absolute bottom-2 right-3 text-[72px] font-black pointer-events-none select-none leading-none"
      style="color: {uiStore.isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'}">
    {id.replace(/[qQ]-?/g, '')}
</span>
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 7: Pills con color y estilo de línea de la métrica

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. Localizar el bloque de pills de métricas. Buscar `<!-- Pills compactos de métricas` o el `{#each activeMetrics as m}` dentro de `active-metrics-badges`. Reemplazar **todo el `{#each}` block** (desde `{#each activeMetrics as m}` hasta su `{/each}`) por:

```svelte
{#each activeMetrics as m}
    {@const isHidden = metricConfigs[m]?.hidden}
    {@const mStyle = metricStyles[m] || { color: '#888', lineWidth: 1, lineDash: [] }}
    {@const hasDash = mStyle.lineDash.length > 0}
    <button
        class="px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer select-none
               {isHidden ? 'opacity-30 line-through' : ''}"
        style="color: {soloMetric === m ? '#000' : 'white'};
               background: {soloMetric === m ? mStyle.color : mStyle.color + '15'};
               border: 1.5px {hasDash ? 'dashed' : 'solid'} {mStyle.color}{isHidden ? '40' : '80'};"
        onmouseenter={() => (hoverMetric = m)}
        onmouseleave={() => (hoverMetric = null)}
        onclick={() => activeConfigMetric = activeConfigMetric === m ? null : m}
        ondblclick={() => (soloMetric = soloMetric === m ? null : m)}
        title="{isHidden ? '(Oculta) ' : ''}Clic: configurar · Doble clic: modo solo"
    >
        {m}
    </button>
{/each}
```

> **NOTA**: El texto es siempre blanco (`color: white`) excepto en modo solo donde es negro (`#000`) sobre fondo del color de la métrica. El fondo normal es el color de la métrica con 15% de opacidad. El borde usa `dashed` si la métrica tiene `lineDash` con valores, `solid` si es vacío.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 8: Controles de capas y settings alineados a la derecha

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. Localizar el `<div class="quadrant-header flex items-center justify-between`. Cambiar `justify-between` por `gap-2`:

```svelte
<!-- ANTES: -->
<div class="quadrant-header flex items-center justify-between bg-[#08080a] ...">

<!-- DESPUÉS: -->
<div class="quadrant-header flex items-center gap-2 bg-[#08080a] ...">
```

2. Localizar el `<div class="flex items-center gap-1.5">` que contiene la etiqueta de capa activa y el botón de capas (buscar `ETIQUETA DE CAPA ACTIVA`). Agregar `ml-auto` a su clase:

```svelte
<!-- ANTES: -->
<div class="flex items-center gap-1.5">

<!-- DESPUÉS: -->
<div class="flex items-center gap-1.5 ml-auto">
```

3. Mover el botón settings (buscar `settings-btn`) dentro de este mismo `div`, justo después del cierre del `</div>` del dropdown de capas, pero ANTES del cierre del `div` con `ml-auto`. El resultado debe ser:

```svelte
<div class="flex items-center gap-1.5 ml-auto">
    <!-- Etiqueta capa activa -->
    ...
    <!-- Botón capas con dropdown -->
    <div class="relative">
        ...
    </div>
    <!-- Botón settings (MOVIDO AQUÍ) -->
    <button bind:this={settingsBtn} class="settings-btn ...">
        ...
    </button>
</div>
```

4. Eliminar el `<button bind:this={settingsBtn}` de su posición original (estaba como hijo directo del header, después del div de capas).

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 9: Menú agregar capas — opciones medición, instantánea, calculada

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. Agregar una variable de estado para el sub-menú de instantáneas. Buscar `let showAddLayerMenu = $state(false);` y agregar debajo:

```typescript
let showSnapshotSubmenu = $state(false);
```

2. Localizar el sub-menú de "Agregar capa" (buscar `{#if showAddLayerMenu}`). Reemplazar **todo el contenido del `div`** del sub-menú (el que tiene `class="absolute left-0 bottom-full..."`) por:

```svelte
<div class="absolute left-0 bottom-full mb-1 bg-[#0c0c0e] border border-[#1a1a24] rounded-lg shadow-lg z-50 min-w-[180px] py-1">
    <button
        class="w-full text-left px-3 py-1.5 text-[10px] text-[#00ff88] hover:bg-[#00ff88]/5 flex items-center gap-1.5 cursor-pointer"
        onclick={() => { traceManager.addLayer(`Capa ${traceManager.layers.length + 1}`, id, 'live'); showAddLayerMenu = false; showLayerDropdown = false; }}>
        <span class="material-symbols-outlined text-[12px]">podcasts</span>
        Medición
    </button>
    <div class="relative">
        <button
            class="w-full text-left px-3 py-1.5 text-[10px] text-[#3b82f6] hover:bg-[#3b82f6]/5 flex items-center gap-1.5 cursor-pointer"
            onclick={(e) => { e.stopPropagation(); showSnapshotSubmenu = !showSnapshotSubmenu; }}>
            <span class="material-symbols-outlined text-[12px]">photo_camera</span>
            Instantánea
            <span class="material-symbols-outlined text-[10px] ml-auto">{showSnapshotSubmenu ? 'expand_less' : 'expand_more'}</span>
        </button>
        {#if showSnapshotSubmenu}
            <div class="bg-[#0a0a0e] border-t border-[#1a1a24] py-0.5">
                {#each traceManager.instantaneas as inst}
                    <button
                        class="w-full text-left px-4 py-1 text-[9px] text-gray-300 hover:bg-[#3b82f6]/5 hover:text-white cursor-pointer truncate"
                        onclick={() => {
                            const layer = traceManager.addLayer(inst.name, id, 'snapshot');
                            if (layer && inst.data) {
                                traceManager.setLayerSource(layer.id, 'snapshot', inst.data);
                            }
                            showSnapshotSubmenu = false;
                            showAddLayerMenu = false;
                            showLayerDropdown = false;
                        }}
                        title={inst.name}
                    >
                        {inst.name}
                    </button>
                {:else}
                    <span class="block px-4 py-1 text-[9px] text-gray-600 italic">Sin instantáneas</span>
                {/each}
            </div>
        {/if}
    </div>
    <button
        class="w-full text-left px-3 py-1.5 text-[10px] text-[#a855f7] hover:bg-[#a855f7]/5 flex items-center gap-1.5 cursor-pointer"
        onclick={() => { traceManager.addCalculatedLayer('Avg', id, 'average'); showAddLayerMenu = false; showLayerDropdown = false; }}>
        <span class="material-symbols-outlined text-[12px]">functions</span>
        Calculada
    </button>
</div>
```

> **NOTA**: `traceManager.instantaneas` devuelve la lista de instantáneas. `traceManager.addLayer` retorna el layer creado. `traceManager.setLayerSource` asigna datos de snapshot al layer. Verificar que estas funciones existen antes de implementar; si `addLayer` no retorna el layer, ajustar la lógica.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 10: Botón colapsar sidebar ámbar

**Archivo**: `src/routes/+page.svelte`

1. Localizar el botón flotante de colapsar sidebar (buscar `BOTÓN FLOTANTE COLAPSAR/ABRIR SIDEBAR`). Reemplazar su `class`:

```svelte
<!-- ANTES: -->
class="absolute z-50 w-5 h-12 flex items-center justify-center
       bg-[#0a0a0c] border border-[#1a1a24] rounded-r-lg
       text-gray-500 hover:text-white hover:bg-[#121216]
       transition-all duration-300 cursor-pointer shadow-lg"

<!-- DESPUÉS: -->
class="absolute z-50 w-5 h-12 flex items-center justify-center
       bg-amber-500 border border-amber-400 rounded-r-lg
       text-white hover:bg-amber-400
       transition-all duration-300 cursor-pointer shadow-lg"
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 11: Etiquetas de pestañas del sidebar

**Archivo**: `src/components/medicion/Sidebar.svelte`

1. Localizar el array de tabs (buscar `{ id: 'medicion', icon: 'podcasts', label: 'Med' }`). Cambiar los labels:

```typescript
// ANTES:
{ id: 'medicion', icon: 'podcasts', label: 'Med' },
{ id: 'eq', icon: 'cadence', label: 'EQ' },
{ id: 'snaps', icon: 'photo_camera', label: 'Inst' },
{ id: 'config', icon: 'settings', label: 'Cfg' },

// DESPUÉS:
{ id: 'medicion', icon: 'podcasts', label: 'MEDIR' },
{ id: 'eq', icon: 'cadence', label: 'ECUALIZAR' },
{ id: 'snaps', icon: 'photo_camera', label: 'INSTANTÁNEA' },
{ id: 'config', icon: 'settings', label: 'CONFIG' },
```

2. Localizar el `<span>` que renderiza el label de la pestaña (buscar `text-[8px] font-bold uppercase`). Cambiar `text-[8px]` a `text-[7px]`:

```svelte
<!-- ANTES: -->
<span class="text-[8px] font-bold uppercase tracking-wider leading-none">{tab.label}</span>

<!-- DESPUÉS: -->
<span class="text-[7px] font-bold uppercase tracking-wider leading-none">{tab.label}</span>
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 12: Tema global — CSS variables en layout.css

**Archivo**: `src/routes/layout.css`

1. Agregar las CSS variables ANTES de la regla `::-webkit-scrollbar`. El archivo debe quedar así:

```css
@import 'tailwindcss';
@config '../../tailwind.config.js';

/* === TOKENS DE TEMA (CSS Variables) === */
:root {
    --bg-primary: #f5f5f7;
    --bg-secondary: #ffffff;
    --bg-tertiary: #e8e8ec;
    --bg-surface: #f0f0f3;
    --border-primary: #d0d0d5;
    --border-secondary: #e0e0e5;
    --text-primary: #1a1a2e;
    --text-secondary: #555566;
    --text-muted: #888899;
    --accent: #3b82f6;
    --accent-green: #00cc66;
}

.dark {
    --bg-primary: #060608;
    --bg-secondary: #0a0a0c;
    --bg-tertiary: #121216;
    --bg-surface: #0c0c0e;
    --border-primary: #1a1a24;
    --border-secondary: #222233;
    --text-primary: #e0e0e8;
    --text-secondary: #a0a0b0;
    --text-muted: #666678;
    --accent: #3b82f6;
    --accent-green: #00ff88;
}

/* Scrollbar estilizada para toda la app */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: var(--border-primary);
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--border-secondary);
}

/* Firefox */
* {
    scrollbar-width: thin;
    scrollbar-color: var(--border-primary) transparent;
}

/* Estilizar spinners nativos de inputs numéricos */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
    opacity: 1;
    cursor: pointer;
}

.dark input[type="number"] {
    color-scheme: dark;
}

input[type="number"] {
    color-scheme: light;
}
```

> **IMPORTANTE**: Reemplazar el contenido COMPLETO del archivo `layout.css` con el bloque anterior. No dejar reglas duplicadas.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 13: Tema global — Aplicar a Header.svelte

**Archivo**: `src/components/medicion/Header.svelte`

En el bloque `<style>`, hacer las siguientes sustituciones exactas:

1. `.global-header`: Cambiar `background: #08080a;` → `background: var(--bg-primary);` y `border-bottom: 1px solid #1a1a24;` → `border-bottom: 1px solid var(--border-primary);`

2. `.header-title`: Cambiar `color: #e2e8f0;` → `color: var(--text-primary);`

3. `.vu-outer-container`: Cambiar `background: #121216;` → `background: var(--bg-tertiary);` y `border: 1px solid #1a1a24;` → `border: 1px solid var(--border-primary);`

4. `.vu-outer-container:hover`: Cambiar `background: #181822;` → `background: var(--bg-surface);` y `border-color: #262636;` → `border-color: var(--border-secondary);`

5. `.led-container`: Cambiar `border-left: 1px solid #262636;` → `border-left: 1px solid var(--border-secondary);`

6. En el template HTML (no en `<style>`), buscar todas las clases Tailwind con colores hardcoded y reemplazar usando `style` inline con variables:
   - `bg-[#121216]` → agregar `style="background: var(--bg-tertiary)"` y eliminar la clase `bg-[#121216]`
   - `border-[#1a1a24]` → agregar a style `border-color: var(--border-primary)` y eliminar la clase `border-[#1a1a24]`
   - `bg-[#0a0a0c]` → agregar a style `background: var(--bg-secondary)` y eliminar la clase `bg-[#0a0a0c]`

> **IMPORTANTE**: NO cambiar colores de acento (verde #00ff88, rojo, etc). Solo cambiar fondos, bordes y texto base.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 14: Tema global — Aplicar a Quadrant.svelte y +page.svelte

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. Localizar el style del contenedor principal (buscar `background: {uiStore.isDarkMode ? '#060608' : '#f8f8fa'}`). Reemplazar por:

```svelte
style="cursor: {cursorStyle}; background: var(--bg-primary); touch-action: none;"
```

2. En el header del cuadrante, buscar `bg-[#08080a]` y reemplazar la clase por style inline: agregar `style="background: var(--bg-primary)"` y eliminar `bg-[#08080a]`.

3. Buscar todas las ocurrencias de `bg-[#0c0c0e]` en popovers/menus del cuadrante y reemplazar por `style="background: var(--bg-surface)"`. Son al menos: el popover de configuración, el dropdown de capas, el menú de zoom, el dropdown de agregar métricas.

4. Buscar `border-[#1a1a24]` en los mismos elementos y reemplazar por `style` con `border-color: var(--border-primary)`.

**Archivo**: `src/routes/+page.svelte`

5. Si hay `bg-[#0a0a0c]` u otros colores hardcoded en +page.svelte, reemplazar por variables CSS.

> **IMPORTANTE**: NO cambiar colores de acento. Solo fondos, bordes y texto base. Tener cuidado de no romper estilos existentes al combinar `class` y `style`.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 15: Tema global — Aplicar a Sidebar.svelte

**Archivo**: `src/components/medicion/Sidebar.svelte`

1. En el `<aside>` principal (aprox L703-704), reemplazar `bg-[#0a0a0c]` por `style="background: var(--bg-secondary)"` y `border-[#1a1a24]/50` por `style` con `border-color: var(--border-primary)`. También reemplazar `text-gray-200` por `style` con `color: var(--text-primary)`.

2. En la cabecera de pestañas (buscar `bg-[#050507]`), reemplazar por `style="background: var(--bg-primary)"`.

3. Hacer un recorrido general del archivo buscando los siguientes patrones y reemplazándolos:
   - `bg-[#121216]` → agregar/merge `style="background: var(--bg-tertiary)"`
   - `bg-[#0c0c0e]` → agregar/merge `style="background: var(--bg-surface)"`
   - `border-[#1a1a24]` → agregar/merge `style="border-color: var(--border-primary)"`
   - `text-gray-200` en contextos de texto principal → `style="color: var(--text-primary)"`
   - `text-gray-500` en contextos de labels/muted → `style="color: var(--text-muted)"`

> **IMPORTANTE**: Este es un archivo grande (~2500 líneas). Hacer las sustituciones de forma sistemática. NO cambiar colores de acento (#00ff88, #3b82f6, #a855f7, #ff4444, etc). Solo fondos, bordes y texto base. Priorizar las áreas más visibles: aside principal, cabecera de tabs, botones principales, secciones de contenido.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 16: Selector de tipo EQ por botones + filtros por botones con iconos

**Archivo**: `src/components/medicion/Sidebar.svelte`

### Parte A: Selector de tipo de ecualizador

1. Localizar el `<select>` de tipo de ecualizador (buscar `bind:value={eqType}` dentro de un `<select>`). Reemplazar **todo el `<div class="flex flex-col gap-1.5">`** que lo contiene por:

```svelte
<div class="flex flex-col gap-1.5">
    <label class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--text-muted)">Tipo de Ecualizador</label>
    <div class="flex items-center p-0.5 rounded-lg gap-0.5" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
        <button
            class="flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer
                   {eqType === 'grafico' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'hover:text-gray-300'}"
            style="{eqType !== 'grafico' ? 'color: var(--text-muted)' : ''}"
            onclick={() => eqType = 'grafico'}>
            Gráfico
        </button>
        <button
            class="flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer
                   {eqType === 'parametrico' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'hover:text-gray-300'}"
            style="{eqType !== 'parametrico' ? 'color: var(--text-muted)' : ''}"
            onclick={() => eqType = 'parametrico'}>
            Paramétrico
        </button>
    </div>
</div>
```

### Parte B: Tipo de filtro paramétrico como botones con iconos

2. Localizar el `<select>` de tipo de filtro en la sección de EQ paramétrico (buscar `bind:value={filter.type}` dentro de un `<select>` que tiene opciones como "Campana (Peaking)"). Reemplazar **todo el `<div class="flex flex-col gap-1 col-span-2">`** que contiene el label "Tipo de Filtro" y el `<select>` por:

```svelte
<div class="flex flex-col gap-1 col-span-2">
    <label class="text-[9px] font-bold uppercase" style="color: var(--text-muted)">Tipo de Filtro</label>
    <div class="flex flex-wrap gap-1">
        {#each filter.supportedTypes as type}
            {@const icons = {
                peaking: 'graphic_eq',
                lowpass: 'arrow_downward',
                highpass: 'arrow_upward',
                shelving: 'trending_up',
                notch: 'filter_center_focus',
                bandpass: 'tune',
            }}
            {@const labels = {
                peaking: 'Peak',
                lowpass: 'LP',
                highpass: 'HP',
                shelving: 'Shelf',
                notch: 'Notch',
                bandpass: 'BP',
            }}
            <button
                class="flex flex-col items-center justify-center w-10 h-10 rounded-md text-[8px] font-bold transition-all cursor-pointer
                       {filter.type === type ? 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30' : 'border'}"
                style="{filter.type !== type ? 'background: var(--bg-tertiary); color: var(--text-muted); border-color: var(--border-primary)' : ''}"
                onclick={() => filter.type = type}
                title={type}
            >
                <span class="material-symbols-outlined text-[16px]">{icons[type] || 'tune'}</span>
                {labels[type] || type}
            </button>
        {/each}
    </div>
</div>
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Resumen de Prompts

| # | Descripción | Archivos |
|---|-------------|----------|
| 1 | Límites clamp ±80dB, grilla ±60dB, zoom max 4x | canvasInteraction.ts, canvasRenderers.ts |
| 2 | Fix clamp pan (saltos) + clamp en mouseUp/touchEnd | canvasInteraction.ts, Quadrant.svelte |
| 3 | Menú zoom para anclar eje | Quadrant.svelte, canvasInteraction.ts |
| 4 | Zoom Y inicial 0.7 + restaurar | Quadrant.svelte, canvasInteraction.ts |
| 5 | Cursores contextuales por zona | Quadrant.svelte |
| 6 | ID cuadrante como watermark | Quadrant.svelte |
| 7 | Pills con color/estilo de línea | Quadrant.svelte |
| 8 | Capas + settings alineados derecha | Quadrant.svelte |
| 9 | Menú agregar capas: medición/instantánea/calculada | Quadrant.svelte |
| 10 | Botón sidebar ámbar | +page.svelte |
| 11 | Etiquetas tabs: MEDIR/ECUALIZAR/INSTANTÁNEA/CONFIG | Sidebar.svelte |
| 12 | CSS variables + spinners | layout.css |
| 13 | Tema global: Header | Header.svelte |
| 14 | Tema global: Quadrant + page | Quadrant.svelte, +page.svelte |
| 15 | Tema global: Sidebar | Sidebar.svelte |
| 16 | EQ selector botones + filtros botones con iconos | Sidebar.svelte |
