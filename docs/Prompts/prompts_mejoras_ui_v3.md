# Prompts de Implementación: Mejoras UI v3

Este documento contiene **instrucciones atómicas** para que un agente de IA con contexto limitado implemente las mejoras definidas en `docs/Planes/implementation_plan_mejoras_ui_v3.md`.

---

## 📋 Directivas Globales para el Agente Implementador

1. **Ejecuta SOLO el prompt que se te indique.** No avances al siguiente prompt por tu cuenta. Si te dicen "continue", eso NO es autorización para pasar al próximo prompt — solo significa que continúes trabajando en el prompt actual si lo dejaste incompleto.
2. **Svelte 5 Runes**: Usa `$state`, `$derived`, `$effect`, `onclick` (no `on:click`).
3. **Sin placeholders**: Escribe código completo, no dejes `// TODO` ni `...`.
4. **No uses transparencias ni filtros blur** en menús flotantes/dropdowns. Usa colores sólidos HEX.
5. **Verificar compilación**: El servidor de desarrollo ya está corriendo (`npm run dev`). Corrige errores inmediatamente.
6. **No modifiques** código no mencionado en el prompt. No "mejores" ni "refactorices" nada fuera del alcance.
7. **No elimines** comentarios existentes que no estén relacionados con tu cambio.

---

## 🛠️ Prompt 1: Límites de frecuencia del eje X + clamp de pan

**Objetivo**: Limitar la vista del cuadrante a 10Hz-22kHz. El usuario NO puede hacer pan más allá de esas frecuencias. Los valores `freqMin`/`freqMax` son límites duros de navegación.

### 📥 Archivo: `src/lib/dsp/canvasInteraction.ts`

### 📝 Instrucciones:

1. Localiza las constantes `freqMin` y `freqMax` (primeras líneas del archivo). Si ya son `10` y `22000`, déjalas. Si no, cámbialas a:
```typescript
export const freqMin = 10;    // Hz (sub-bajo audible)
export const freqMax = 22000; // Hz (cercano a Nyquist @ 44.1kHz)
```

2. **Agregar** la siguiente función helper `clampPan` justo después de la función `xToVal` (aprox L53). Esta función se llama después de cualquier modificación de `offsetX`/`offsetY` para impedir que el usuario haga pan fuera de los límites:

```typescript
/** Límites absolutos de pan en Y (dB). El usuario no puede hacer pan más allá de estos valores. */
export const dbPanMin = -60; // dB
export const dbPanMax = 60;  // dB

/**
 * Clamp de pan: impide que el usuario haga pan más allá de los límites.
 * Eje X: freqMin/freqMax (solo en modo frecuencia, no en time domain).
 * Eje Y: dbPanMin/dbPanMax (±60 dB).
 * Debe llamarse después de cada modificación de state.offsetX/offsetY o state.zoomX/zoomY.
 */
export function clampPan(
    state: InteractionState,
    width: number,
    height: number,
    hasTimeDomainActive: boolean,
    metricType: string,
    metricConfigs: Record<string, any>
): void {
    // --- Clamp eje X (solo en modo frecuencia) ---
    if (!hasTimeDomainActive) {
        const xMin = valToX(freqMin, width, false, state);
        const xMax = valToX(freqMax, width, false, state);
        if (xMin > 0) state.offsetX -= xMin;
        if (xMax < width) state.offsetX += width - xMax;
    }

    // --- Clamp eje Y (±60 dB) ---
    const yTop = valToY(dbPanMax, height, metricType, metricConfigs, state);
    const yBottom = valToY(dbPanMin, height, metricType, metricConfigs, state);
    if (yTop > 0) state.offsetY -= yTop;
    if (yBottom < height) state.offsetY += height - yBottom;
}
```

3. **Agregar** clamp al pan con mouse. Localiza `handleMouseMove` (L195-211). Dentro del bloque `if (state.isDragging)`, **después** de `state.lastMouseY = e.clientY;` (L209), agregar la llamada. Para esto, la función necesita recibir `width` y `hasTimeDomainActive` como parámetros:

**Cambiar la firma** de `handleMouseMove` a:
```typescript
export function handleMouseMove(
    e: MouseEvent,
    state: InteractionState,
    canvasElement: HTMLCanvasElement,
    containerWidth: number,
    containerHeight: number,
    hasTimeDomainActive: boolean,
    activeMetrics: string[],
    metricConfigs: Record<string, any>
) {
```

Y **agregar** después de L209:
```typescript
        const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
        clampPan(state, containerWidth, containerHeight, hasTimeDomainActive, refMetric, metricConfigs);
```

4. **Agregar** clamp al pan con touch. Localiza `handleTouchMove` (L250-276). Cambiar la firma para recibir `activeMetrics` y `metricConfigs`. Dentro del bloque `if (e.touches.length === 1 && state.isDragging)`, **después** de `state.showCrosshair = true;` (L265), agregar:
```typescript
        const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
        clampPan(state, rect.width, rect.height, false, refMetric, metricConfigs);
```

Y en el bloque de pinch zoom (L266-274), cambiar el mínimo de zoom de `0.1` a `0.5`:
```typescript
// ANTES:
state.zoomX = Math.max(0.1, Math.min(20, state.touchStartScaleX * factor));
state.zoomY = Math.max(0.1, Math.min(20, state.touchStartScaleY * factor));

// DESPUÉS:
state.zoomX = Math.max(0.5, Math.min(20, state.touchStartScaleX * factor));
state.zoomY = Math.max(0.5, Math.min(20, state.touchStartScaleY * factor));
```

5. **Actualizar** todas las llamadas a `handleMouseMove` y `handleTouchMove` en `Quadrant.svelte` para pasar los nuevos parámetros (`containerWidth`, `containerHeight`, `hasTimeDomainActive`, `activeMetrics`, `metricConfigs`). Buscar las llamadas existentes y agregar los parámetros extras.

> **IMPORTANTE**: No modifiques `handleWheel` en este prompt. Eso se hace en el Prompt 4.

---

## 🛠️ Prompt 2: Curvas spline suaves (reescritura de drawMetricPath)

**Objetivo**: Reemplazar el loop de `drawMetricPath` que itera píxel por píxel (generando "escalones" en bajas frecuencias) por un enfoque de un punto por bin FFT con curvas spline.

### 📥 Archivo: `src/lib/dsp/canvasRenderers.ts`

### 📝 Instrucciones:

1. Localiza la función `drawMetricPath` (aprox L532-618). Dentro de ella hay un loop `for (let x = 0; x < width; x++)` que usa `frequencyLUT[x]`.

2. **Reemplaza** ese loop y la construcción del Path2D por el siguiente código. Mantén TODO el código de setup previo (strokeStyle, lineWidth, setLineDash) y el ctx.stroke(path) final. Solo reemplaza el loop interior:

```typescript
// Construir array de puntos (un punto por bin FFT visible)
const points: {x: number, y: number}[] = [];
const binWidth = 24000 / dataArray.length;

for (let bin = 0; bin < dataArray.length; bin++) {
    const freq = bin * binWidth;
    if (freq < freqMin || freq > freqMax) continue;
    const x = valToX(freq, width, false, state);
    if (x < -10 || x > width + 10) continue;

    // Coherence threshold masking (si aplica)
    if (cfg && cfg.enableCoherence && interpCoherence[bin] < cfg.coherenceThreshold) continue;

    let val = (cfg && cfg.smoothingPPO)
        ? getPPOSmoothedValue(bin, dataArray, cfg.smoothingPPO)
        : dataArray[bin];

    // Mantener las transformaciones existentes de coherence/modeY sin cambios
    if (metricType === "Coherence") {
        // ... (copiar la lógica existente de Coherence tal como está)
    }
    if (cfg && (metricType === "Magnitude" || metricType === "Spectrum")) {
        // ... (copiar la lógica existente de modeY tal como está)
    }

    const y = valToY(val, height, metricType, metricConfigs, state) + (cfg?.yShift || 0);
    points.push({ x, y });
}

// Dibujar con spline (quadratic curve through midpoints)
if (points.length > 0) {
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    if (points.length > 1) {
        const last = points[points.length - 1];
        path.lineTo(last.x, last.y);
    }
}
```

3. **Aplica el mismo cambio** a `drawSpectrumPath` (aprox L620+). Misma estrategia de spline.

4. Asegúrate de que `freqMin` y `freqMax` están importados desde `canvasInteraction.ts`.

5. El parámetro `frequencyLUT` ya no se usa en `drawMetricPath` ni `drawSpectrumPath`. Mantenlo solo para el espectrograma waterfall.

> **IMPORTANTE**: Copia las transformaciones existentes de Coherence y modeY tal cual están — no las reescribas, solo muévelas al nuevo loop.

---

## 🛠️ Prompt 3: Grosor de línea 1px por defecto

**Objetivo**: Reducir el grosor por defecto de todas las curvas de 2px a 1px.

### 📥 Archivo: `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones:

1. Localiza el objeto `metricStyles` (aprox L61-69). Cambia TODOS los `lineWidth: 2` a `lineWidth: 1`:
```typescript
"Spectrum": { color: "#a855f7", lineWidth: 1, lineDash: [] },
"Magnitude": { color: "#ff4444", lineWidth: 1, lineDash: [] },
"Phase": { color: "#d946ef", lineWidth: 1, lineDash: [] },
"Coherence": { color: "#eab308", lineWidth: 1, lineDash: [] },
"Group Delay": { color: "#10b981", lineWidth: 1, lineDash: [] },
"Impulse": { color: "#3b82f6", lineWidth: 1, lineDash: [] },
"Step": { color: "#f97316", lineWidth: 1, lineDash: [] },
"Simulated Magnitude": { color: "#00ffff", lineWidth: 1, lineDash: [4, 4] },
```

2. Localiza donde se asigna `lineWidth` para capas (aprox L537). Cambia:
   - `isActive ? 2.5 : 1.2` → `isActive ? 1.8 : 1`

3. Localiza donde se asigna `lineWidth` para capas live (aprox L570). Cambia:
   - `isActive ? 2.8 : 1.3` → `isActive ? 1.8 : 1`

---

## 🛠️ Prompt 4: Zoom inteligente por posición del mouse

**Objetivo**: Detectar en qué zona del canvas está el mouse al hacer scroll y aplicar zoom solo en el eje correspondiente.

### 📥 Archivo: `src/lib/dsp/canvasInteraction.ts`

### 📝 Instrucciones:

1. Localiza la función `handleWheel` (aprox L143-193).

2. **Reemplaza** la lógica de detección del eje por detección de posición. El nuevo código debe ser:

```typescript
export function handleWheel(
    e: WheelEvent,
    state: InteractionState,
    canvasElement: HTMLCanvasElement,
    containerWidth: number,
    containerHeight: number,
    activeMetrics: string[],
    metricConfigs: Record<string, any>,
    hasTimeDomainActive: boolean
): void {
    e.preventDefault();
    const rect = canvasElement.getBoundingClientRect();
    const mX = e.clientX - rect.left;
    const mY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;

    // --- DETECCIÓN INTELIGENTE DE EJE ---
    const Y_LABEL_ZONE = 45;  // Margen izquierdo (zona de labels Y)
    const X_LABEL_ZONE = 25;  // Margen inferior (zona de labels X)

    let zoomX = false;
    let zoomY = false;

    if (mX <= Y_LABEL_ZONE) {
        // Mouse sobre labels del eje Y → zoom solo Y
        zoomY = true;
    } else if (mY >= containerHeight - X_LABEL_ZONE) {
        // Mouse sobre labels del eje X → zoom solo X
        zoomX = true;
    } else if (e.altKey) {
        zoomY = true;
    } else if (e.shiftKey) {
        zoomX = true;
    } else {
        // Área central: zoom XY proporcional
        zoomX = true;
        zoomY = true;
    }

    if (zoomX) {
        const valBefore = xToVal(mX, containerWidth, hasTimeDomainActive, state);
        state.zoomX = Math.max(0.5, Math.min(20, state.zoomX * delta));
        const xAfter = valToX(valBefore, containerWidth, hasTimeDomainActive, state);
        state.offsetX += mX - xAfter;
    }

    if (zoomY) {
        const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
        const valBefore = yToVal(mY, containerHeight, refMetric, state);
        state.zoomY = Math.max(0.5, Math.min(20, state.zoomY * delta));
        const yAfter = valToY(valBefore, containerHeight, refMetric, metricConfigs, state);
        state.offsetY += mY - yAfter;
    }

    // Clamp X + Y: reusar la función helper de Prompt 1
    const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
    clampPan(state, containerWidth, containerHeight, hasTimeDomainActive, refMetric, metricConfigs);
}
```

3. Si la función `handleWheel` actual tiene una firma diferente, adapta los parámetros pero mantén la lógica de detección de posición exactamente como está arriba.

---

## 🛠️ Prompt 5: Botón de zoom con menú desplegable

**Objetivo**: Reemplazar los 4 botones de zoom flotantes por un único botón con menú desplegable.

### 📥 Archivo: `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones:

1. Agregar variable de estado al inicio del script:
```typescript
let showZoomMenu = $state(false);
```

2. Agregar la función `zoomTactile` cerca de los event handlers (aprox L978-1009):
```typescript
function zoomTactile(axis: 'XY' | 'X' | 'Y') {
    const factor = 1.3;
    const cX = containerWidth / 2;
    const cY = containerHeight / 2;

    if (axis === 'X' || axis === 'XY') {
        const valBefore = xToVal(cX, containerWidth, hasTimeDomainActive, interactionState);
        interactionState.zoomX = Math.max(0.5, Math.min(20, interactionState.zoomX * factor));
        const xAfter = valToX(valBefore, containerWidth, hasTimeDomainActive, interactionState);
        interactionState.offsetX += cX - xAfter;
    }
    if (axis === 'Y' || axis === 'XY') {
        const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
        const valBefore = yToVal(cY, containerHeight, refMetric, interactionState);
        interactionState.zoomY = Math.max(0.5, Math.min(20, interactionState.zoomY * factor));
        const yAfter = valToY(valBefore, containerHeight, refMetric, metricConfigs, interactionState);
        interactionState.offsetY += cY - yAfter;
    }
}
```

3. Localiza los 4 botones de zoom flotantes (aprox L1364-1394). **Reemplázalos** por:
```svelte
<!-- BOTÓN ÚNICO DE ZOOM CON MENÚ -->
<div class="absolute right-3 bottom-3 z-20 select-none">
    <div class="relative">
        {#if showZoomMenu}
            <div class="fixed inset-0 z-40" onclick={() => showZoomMenu = false}></div>
            <div class="absolute right-0 bottom-10 bg-[#0c0c0e] border border-[#1a1a24] rounded-lg p-1.5 shadow-xl z-50 min-w-[100px] flex flex-col gap-0.5">
                <button class="px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:text-white hover:bg-[#121216] rounded transition-all cursor-pointer text-left"
                    onclick={() => { zoomTactile('XY'); showZoomMenu = false; }}>Zoom XY</button>
                <button class="px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:text-white hover:bg-[#121216] rounded transition-all cursor-pointer text-left"
                    onclick={() => { zoomTactile('X'); showZoomMenu = false; }}>Zoom X</button>
                <button class="px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:text-white hover:bg-[#121216] rounded transition-all cursor-pointer text-left"
                    onclick={() => { zoomTactile('Y'); showZoomMenu = false; }}>Zoom Y</button>
                <div class="border-t border-[#1a1a24] my-0.5"></div>
                <button class="px-3 py-1.5 text-[10px] font-bold text-[#00ff88] hover:bg-[#00ff88]/10 rounded transition-all cursor-pointer text-left"
                    onclick={() => { handleDoubleClick(); showZoomMenu = false; }}>Restaurar</button>
            </div>
        {/if}
        <button
            class="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0c0c0e] border border-[#1a1a24] text-gray-400 hover:text-white hover:border-[#00ff88] transition-all cursor-pointer shadow-lg opacity-40 hover:opacity-100"
            onclick={() => showZoomMenu = !showZoomMenu}
            title="Opciones de Zoom"
        >
            <span class="material-symbols-outlined text-[16px]">zoom_in</span>
        </button>
    </div>
</div>
```

---

## 🛠️ Prompt 6: Fix ID del cuadrante

**Objetivo**: El ID del cuadrante muestra "-1" en vez de "1". Arreglar la regex.

### 📥 Archivo: `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones:

1. Busca (aprox L1155):
```svelte
{id.replace(/[qQ]/g, '')}
```

2. Reemplázalo por:
```svelte
{id.replace(/[qQ]-?/g, '')}
```

---

## 🛠️ Prompt 7: Pills de métricas compactas con toggle ocultar

**Objetivo**: Reemplazar pills con iconos por pills solo-texto. Clic = config, doble clic = solo. Soporte para ocultar métrica.

### 📥 Archivo: `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones:

1. Localiza las pills de métricas (aprox L1199-1235). **Reemplázalas** por:
```svelte
<!-- Pills compactos de métricas (solo texto, clic = config) -->
<div class="active-metrics-badges flex items-center gap-1">
    {#each activeMetrics as m}
        {@const isHidden = metricConfigs[m]?.hidden}
        <button
            class="px-2 py-0.5 rounded text-[10px] font-semibold transition-all border cursor-pointer select-none
                   {soloMetric === m ? 'bg-[#00ff88]/20 border-[#00ff88] text-[#00ff88]'
                    : isHidden ? 'bg-[#0a0a0e] border-[#1a1a24] text-gray-600 opacity-50'
                    : 'bg-[#121216] border-[#222] text-gray-300 hover:border-[#444]'}
                   {isHidden ? 'line-through' : ''}"
            onmouseenter={() => (hoverMetric = m)}
            onmouseleave={() => (hoverMetric = null)}
            onclick={() => activeConfigMetric = activeConfigMetric === m ? null : m}
            ondblclick={() => (soloMetric = soloMetric === m ? null : m)}
            title="{isHidden ? '(Oculta) ' : ''}Clic: configurar · Doble clic: modo solo"
        >
            {m}
        </button>
    {/each}
</div>
```

2. Simplifica el botón "Agregar Métrica" (aprox L1158-1197) a solo `+`:
```svelte
<button
    class="w-6 h-6 flex items-center justify-center rounded border border-[#222] text-[#00ff88] hover:bg-[#00ff88]/10 hover:border-[#00ff88]/30 transition-all cursor-pointer text-sm font-bold"
    onclick={(e) => { e.stopPropagation(); showAddDropdown = !showAddDropdown; }}
    title="Agregar Métrica"
>
    +
</button>
```

3. En el popover de configuración de métrica (`activeConfigMetric`, aprox L1441-1653), **agrega** antes del cierre del popover:
```svelte
<!-- Toggle Visibilidad de la Métrica -->
<div class="flex items-center justify-between mt-2 pt-2 border-t border-[#1a1a24]">
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
        removeMetric(activeConfigMetric!);
        activeConfigMetric = null;
    }}
>
    <span class="material-symbols-outlined text-[12px]">delete</span>
    Eliminar {activeConfigMetric}
</button>
```

4. En el draw loop donde se dibuja cada métrica activa (aprox L584-617), agrega al inicio:
```typescript
if (metricConfigs[metric]?.hidden) return;
```

---

## 🛠️ Prompt 8: Cabecera — Etiqueta de capa activa + dropdown de capas

**Objetivo**: Agregar una etiqueta con la capa activa y un botón de capas con dropdown al lado derecho de la cabecera. Eliminar el HUD de capas del canvas.

### 📥 Archivo: `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones:

1. Agregar variables de estado:
```typescript
let showLayerDropdown = $state(false);
let showAddLayerMenu = $state(false);
```

2. En la cabecera del cuadrante, **antes del botón settings** existente (lado derecho), insertar el bloque completo de etiqueta + botón + dropdown. El código exacto está en el plan `docs/Planes/implementation_plan_mejoras_ui_v3.md`, sección "Problema 5", paso 6 (L477-566).

3. **Eliminar** las pills de capas horizontales actuales (aprox L1237-1304).

4. **Eliminar** el HUD de capas superpuesto en el canvas (aprox L1320-1362).

---

## 🛠️ Prompt 9: Viewport móvil

**Objetivo**: Prevenir zoom nativo del navegador en móvil y usar altura dinámica.

### 📥 Archivos:
- `src/app.html`
- `src/routes/+page.svelte`
- `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones:

#### En `src/app.html`:
1. Localiza la meta tag viewport (L6). Reemplázala por:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content" />
```

#### En `src/routes/+page.svelte`:
1. Localiza `height: 100vh` (L68) en `.app-layout`. Reemplázalo por:
```css
height: 100vh;  /* fallback */
height: 100dvh; /* preferido */
```

2. Si hay `calc(100vh - 100px)` (L92), también agregar:
```css
height: calc(100vh - 100px);   /* fallback */
height: calc(100dvh - 100px);  /* preferido */
```

#### En `src/components/medicion/Quadrant.svelte`:
1. En el contenedor del canvas (`.quadrant-container`, aprox L1122-1146), agregar `touch-action: none` al style inline.

2. En `handleTouchStart` y `handleTouchMove`, agregar `e.preventDefault()` como primera línea de cada función.

---

## 🛠️ Prompt 10: Botón colapsar sidebar flotante

**Objetivo**: Unificar los 3 botones de colapsar/abrir sidebar en un único botón flotante en el borde.

### 📥 Archivos:
- `src/routes/+page.svelte`
- `src/components/medicion/Sidebar.svelte`
- `src/components/medicion/Header.svelte`

### 📝 Instrucciones:

#### En `src/routes/+page.svelte`:

1. **Eliminar** el mini-botón flotante (L39-46, el bloque `{:else}` con el `<button>` fixed).

2. **Agregar** `style="position: relative;"` al `<div class="app-container">`.

3. **Insertar** el botón flotante **fuera** del condicional `{#if uiStore.showSidebar}`, justo antes del `<main>`:
```svelte
<!-- BOTÓN FLOTANTE COLAPSAR/ABRIR SIDEBAR -->
<button
    class="absolute z-50 w-5 h-12 flex items-center justify-center
           bg-[#0a0a0c] border border-[#1a1a24] rounded-r-lg
           text-gray-500 hover:text-white hover:bg-[#121216]
           transition-all duration-300 cursor-pointer shadow-lg"
    style="top: 50%; transform: translateY(-50%); left: {uiStore.showSidebar ? '380px' : '0px'};"
    onclick={() => uiStore.showSidebar = !uiStore.showSidebar}
    title="{uiStore.showSidebar ? 'Colapsar' : 'Abrir'} Panel"
>
    <span class="material-symbols-outlined text-[14px]">
        {uiStore.showSidebar ? 'chevron_left' : 'chevron_right'}
    </span>
</button>
```

#### En `src/components/medicion/Sidebar.svelte`:

1. **Eliminar** el botón colapsar de la cabecera de pestañas (L724-731, el bloque con `menu_open` y `onclick={() => (uiStore.showSidebar = !uiStore.showSidebar)}`).

#### En `src/components/medicion/Header.svelte`:

1. **Eliminar** el bloque completo `{#if !uiStore.showSidebar}...{/if}` (L87-97, el botón hamburguesa con icono `menu`).

---

## 🛠️ Prompt 11: Pestañas del sidebar verticales con nuevos iconos

**Objetivo**: Cambiar las pestañas a layout vertical (icono arriba, etiqueta debajo) con nuevos iconos.

### 📥 Archivo: `src/components/medicion/Sidebar.svelte`

### 📝 Instrucciones:

1. Localiza el contenedor de pestañas (L723). Cambia su clase:
```svelte
<!-- ANTES: -->
<div class="flex items-center bg-[#050507] border-b border-[#1a1a24]/50 px-2 py-2 gap-1 h-[56px] flex-shrink-0">

<!-- DESPUÉS: -->
<div class="flex items-center bg-[#050507] border-b border-[#1a1a24]/50 px-2 py-1.5 gap-0.5 h-[60px] flex-shrink-0">
```

2. Localiza el `<nav>` con los 4 botones de pestaña (L733-782). **Reemplaza** todo el `<nav>` por:
```svelte
<nav class="flex-1 flex items-center gap-0.5">
    {#each [
        { id: 'medicion', icon: 'podcasts', label: 'Med' },
        { id: 'eq', icon: 'cadence', label: 'EQ' },
        { id: 'snaps', icon: 'photo_camera', label: 'Inst' },
        { id: 'config', icon: 'settings', label: 'Cfg' },
    ] as tab}
        <button
            class="flex-1 h-[48px] rounded-lg flex flex-col items-center justify-center transition-all duration-200 cursor-pointer gap-0.5
                   {uiStore.activeTab === tab.id
                ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
            onclick={() => (uiStore.activeTab = tab.id)}
            title={tab.label}
        >
            <span class="material-symbols-outlined text-[20px]">{tab.icon}</span>
            <span class="text-[8px] font-bold uppercase tracking-wider leading-none">{tab.label}</span>
        </button>
    {/each}
</nav>
```

---

## 🛠️ Prompt 12: Scrollbar estilizado + selector de tema 3 opciones

**Objetivo**: Estilizar la scrollbar con el tema oscuro y cambiar el toggle de tema a Sistema/Claro/Oscuro.

### 📥 Archivos:
- `src/routes/layout.css`
- `src/lib/stores/ui.svelte.ts`
- `src/components/medicion/Sidebar.svelte`

### 📝 Instrucciones:

#### En `src/routes/layout.css`:

1. **Agregar** al final del archivo:
```css
/* Scrollbar estilizada para toda la app */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: #1a1a24;
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: #2a2a35;
}

/* Firefox */
* {
    scrollbar-width: thin;
    scrollbar-color: #1a1a24 transparent;
}
```

#### En `src/lib/stores/ui.svelte.ts`:

1. Localiza `isDarkMode = $state(true)` (L8). **Reemplázalo** por:
```typescript
themeMode = $state<'system' | 'light' | 'dark'>('system');
```

2. Localiza el método `toggleTheme()` (L67-70). **Reemplázalo** por:
```typescript
get isDarkMode(): boolean {
    if (this.themeMode === 'system') {
        return typeof window !== 'undefined'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
            : true;
    }
    return this.themeMode === 'dark';
}

setThemeMode(mode: 'system' | 'light' | 'dark') {
    this.themeMode = mode;
    this.applyTheme();
}

applyTheme() {
    if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', this.isDarkMode);
    }
}
```

3. Si hay otros usos de `this.isDarkMode` como asignación directa (`this.isDarkMode = ...`), reemplázalos por `this.setThemeMode(...)`.

#### En `src/components/medicion/Sidebar.svelte`:

1. Localiza el toggle de tema (aprox L2585-2623). **Reemplaza** todo el bloque (desde "Tema Visual" hasta el cierre del botón toggle) por:
```svelte
<div class="flex flex-col gap-0.5">
    <span class="text-xs font-semibold text-gray-300">Tema Visual</span>
    <span class="text-[10px] text-gray-500">Apariencia de la interfaz</span>
</div>

<div class="flex items-center bg-[#121216] border border-[#1a1a24] p-0.5 rounded-lg gap-0.5">
    {#each [
        { mode: 'system', icon: 'computer', label: 'Auto' },
        { mode: 'light', icon: 'light_mode', label: 'Claro' },
        { mode: 'dark', icon: 'dark_mode', label: 'Oscuro' },
    ] as opt}
        <button
            class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer
                   {uiStore.themeMode === opt.mode
                ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
                : 'text-gray-500 hover:text-gray-300'}"
            onclick={() => uiStore.setThemeMode(opt.mode)}
        >
            <span class="material-symbols-outlined text-[14px]">{opt.icon}</span>
            {opt.label}
        </button>
    {/each}
</div>
```

2. Actualiza la persistencia en `localStorage` (aprox L566-571): cambiar `config.isDarkMode` por `config.themeMode`. En la lectura:
```typescript
if (config.themeMode) {
    uiStore.setThemeMode(config.themeMode);
} else if (config.isDarkMode !== undefined) {
    // Migración: valor antiguo
    uiStore.setThemeMode(config.isDarkMode ? 'dark' : 'light');
}
```

3. Actualiza el guardado (aprox L597): cambiar `isDarkMode: uiStore.isDarkMode` por `themeMode: uiStore.themeMode`.

---

## 🛠️ Prompt 13: EQ gráfico — bandas por fracción de octava

**Objetivo**: Reemplazar el selector de 5/10/15 bandas por opciones de fracción de octava + personalizar.

### 📥 Archivo: `src/components/medicion/Sidebar.svelte`

### 📝 Instrucciones:

1. Agregar variable de estado:
```typescript
let customBandCount = $state(false);
```

2. Localiza el selector de bandas (aprox L1331-1344). **Reemplaza** todo el `<div>` contenedor por:
```svelte
<div class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5">
    <label class="text-xs text-gray-400">Bandas</label>
    {#if customBandCount}
        <div class="flex items-center gap-1">
            <input
                type="number"
                min="3"
                max="31"
                bind:value={numGraphicBands}
                class="w-14 bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200 text-center"
            />
            <button
                class="text-[9px] text-gray-500 hover:text-white cursor-pointer"
                onclick={() => customBandCount = false}
            >Presets</button>
        </div>
    {:else}
        <div class="flex items-center gap-1">
            <select
                bind:value={numGraphicBands}
                class="bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
            >
                <option value={10}>1 oct (10)</option>
                <option value={15}>2/3 oct (15)</option>
                <option value={20}>1/2 oct (20)</option>
                <option value={31}>1/3 oct (31)</option>
            </select>
            <button
                class="text-[9px] text-gray-500 hover:text-white cursor-pointer px-1"
                onclick={() => customBandCount = true}
                title="Número personalizado de bandas"
            >
                <span class="material-symbols-outlined text-[12px]">tune</span>
            </button>
        </div>
    {/if}
</div>
```

3. Localiza la lógica de generación de bandas (aprox L171-181). **Reemplázala** por una función que soporte cualquier número usando distribución logarítmica:
```typescript
function generateGraphicBands(count: number): GraphicBand[] {
    const logMin = Math.log10(20);
    const logMax = Math.log10(20000);
    return Array.from({ length: count }, (_, i) => {
        const freq = Math.round(Math.pow(10, logMin + (i / (count - 1)) * (logMax - logMin)));
        return { freq, gain: 0 };
    });
}
```

---

## 🛠️ Prompt 14: Eliminar doble scrollbar del panel EQ

**Objetivo**: Eliminar `max-h` y `overflow-y-auto` internos del EQ gráfico y paramétrico.

### 📥 Archivo: `src/components/medicion/Sidebar.svelte`

### 📝 Instrucciones:

1. Localiza el contenedor de bandas gráficas (aprox L1348):
```svelte
<!-- ANTES: -->
<div class="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">

<!-- DESPUÉS: -->
<div class="flex flex-col gap-2.5">
```

2. Localiza el contenedor de filtros paramétricos (aprox L1408):
```svelte
<!-- ANTES: -->
<div class="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">

<!-- DESPUÉS: -->
<div class="flex flex-col gap-3">
```

---

## 🛠️ Prompt 15: Eliminar control de tono

**Objetivo**: Remover la opción "Control de Tono" del ecualizador por ser redundante.

### 📥 Archivos:
- `src/components/medicion/Sidebar.svelte`
- `src/lib/stores/ui.svelte.ts`

### 📝 Instrucciones:

#### En `src/components/medicion/Sidebar.svelte`:

1. **Eliminar** la `<option value="tono">Control de Tono</option>` del selector de tipo EQ (aprox L1324).

2. **Eliminar** todo el bloque `{#if eqType === "tono"}...{/if}` (aprox L1650-1720+, el panel con Bass/Mid/Treble sliders).

3. **Eliminar** las variables `toneBass`, `toneMid`, `toneTreble` (aprox L135-137).

4. **Eliminar** la lógica de AutoEQ para tono (aprox L162-168, el bloque `} else if (eqType === "tono") {`).

5. **Eliminar** la lógica de envío de tono (aprox L206-210, el bloque `} else if (eqType === "tono") {`).

6. **Cambiar** el comentario del tipo de `eqType` de `'grafico' | 'parametrico' | 'tono'` a `'grafico' | 'parametrico'` (L33).

#### En `src/lib/stores/ui.svelte.ts`:

1. Si `eqType` se define en el store, cambiar su tipo para que no acepte `'tono'`.

---

## 🛠️ Prompt 16: EQ paramétrico — filtros ilimitados

**Objetivo**: Reemplazar el selector de cantidad de filtros por un botón "Agregar" sin límite + botón "Eliminar" por filtro.

### 📥 Archivo: `src/components/medicion/Sidebar.svelte`

### 📝 Instrucciones:

1. **Eliminar** la variable `numParametricFilters` (buscarla con Ctrl+F).

2. Localiza el `<select>` de cantidad de filtros (aprox L1386-1405). **Reemplázalo** por:
```svelte
<div class="flex justify-between items-center bg-[#121216]/20 border border-[#1a1a24]/30 rounded-lg p-2.5">
    <label class="text-xs text-gray-400">{parametricFilters.length} filtro{parametricFilters.length !== 1 ? 's' : ''}</label>
    <button
        class="text-[9px] text-red-400/60 hover:text-red-400 cursor-pointer"
        onclick={() => parametricFilters.forEach(f => { f.gain = 0; f.freq = 1000; f.q = 1.0; })}
        title="Resetear todos los filtros"
    >Resetear</button>
</div>
```

3. Localiza `parametricFilters.slice(0, numParametricFilters)` (aprox L1410). Cámbialo a solo `parametricFilters`.

4. En cada card de filtro (aprox L1414-1420), localiza la línea con "Filtro {filter.id}". **Reemplaza** el `<div>` contenedor por:
```svelte
<div class="flex justify-between items-center">
    <span class="text-xs font-bold text-[#3b82f6]">Filtro {filter.id}</span>
    <button
        class="text-gray-500 hover:text-red-400 cursor-pointer"
        onclick={() => parametricFilters = parametricFilters.filter(f => f.id !== filter.id)}
        title="Eliminar filtro"
    >
        <span class="material-symbols-outlined text-[14px]">close</span>
    </button>
</div>
```

5. **Después** del cierre del `{/each}` de filtros (aprox L1645), agregar:
```svelte
<button
    class="w-full py-2 px-3 rounded-lg border border-dashed border-[#1a1a24] text-[#3b82f6] hover:bg-[#3b82f6]/5 text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
    onclick={() => {
        const newId = parametricFilters.length > 0 ? Math.max(...parametricFilters.map(f => f.id)) + 1 : 1;
        parametricFilters = [...parametricFilters, {
            id: newId,
            type: 'peaking',
            freq: 1000,
            gain: 0,
            q: 1.0,
            supportedTypes: ['peaking', 'lowpass', 'highpass', 'shelving', 'notch', 'bandpass'],
            showConfig: false
        }];
    }}
>
    <span class="material-symbols-outlined text-[12px]">add</span>
    Agregar Filtro
</button>
```
