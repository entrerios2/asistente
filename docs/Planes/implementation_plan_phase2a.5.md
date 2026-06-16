# Plan de Mejoras: Rendering de Curvas y Zoom por Eje

---

## Problema 1: Gráfico tipo "barras" en frecuencias bajas

### Diagnóstico

El `drawMetricPath` ([canvasRenderers.ts:532-618](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts#L532-L618)) dibuja la curva iterando píxel por píxel con `frequencyLUT`:

```typescript
for (let x = 0; x < width; x++) {
    const binIndex = frequencyLUT[x];
    // ...
    path.lineTo(x, y);
}
```

El `frequencyLUT` ([canvasInteraction.ts:295-317](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts#L295-L317)) mapea cada píxel X a un bin FFT usando `Math.round(freq / binWidth)`. A bajas frecuencias (10-200Hz), **múltiples píxeles consecutivos mapean al mismo bin** porque la resolución de la FFT (binWidth ≈ 5.86Hz con fftSize=8192 @ 48kHz) es menor que la resolución de píxeles en escala logarítmica.

**Resultado:** Una misma magnitud dB se repite en 10-30 píxeles consecutivos, creando "escalones" planos horizontales que se ven como barras.

### Solución propuesta: Un punto por bin FFT + curvas spline

En vez de iterar píxel por píxel (lo que genera escalones cuando muchos píxeles caen en el mismo bin), el enfoque es **colocar un punto por cada bin FFT visible** y unirlos con curvas suaves (`quadraticCurveTo` o `bezierCurveTo`).

**Ventajas sobre la interpolación lineal entre bins:**
- Elimina completamente los escalones en bajas frecuencias
- Las curvas lucen naturales y orgánicas (como en OSM, Smaart, REW)
- Menos iteraciones (se itera sobre bins visibles, no sobre píxeles)

```typescript
// ANTES (escalón: un lineTo por cada píxel X):
for (let x = 0; x < width; x++) {
    const binIndex = frequencyLUT[x];
    let val = dataArray[binIndex];
    path.lineTo(x, valToY(val, ...));
}

// DESPUÉS (spline: un punto por bin FFT visible, unidos con curvas):
const points: {x: number, y: number}[] = [];
const binWidth = 24000 / bins;

for (let bin = 0; bin < bins; bin++) {
    const freq = bin * binWidth;
    if (freq < freqMin || freq > freqMax) continue;
    const x = valToX(freq, width, false, state);
    if (x < -10 || x > width + 10) continue; // fuera de vista
    
    let val = (cfg && cfg.smoothingPPO)
        ? getPPOSmoothedValue(bin, dataArray, cfg.smoothingPPO)
        : dataArray[bin];
    
    const y = valToY(val, height, metricType, metricConfigs, state) + (cfg?.yShift || 0);
    points.push({ x, y });
}

// Dibujar con spline suave (quadratic curve through midpoints)
if (points.length > 0) {
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    // Último segmento recto
    if (points.length > 1) {
        const last = points[points.length - 1];
        path.lineTo(last.x, last.y);
    }
}
```

### Proposed Changes

#### [MODIFY] [canvasInteraction.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts)

1. Cambiar `freqMin` de `20` a `10` (L1):
   ```typescript
   export const freqMin = 10; // Hz (límite inferior audible)
   ```

2. Cambiar `freqMax` de `20000` a `22000` (L2):
   ```typescript
   export const freqMax = 22000; // Hz (Nyquist cercano @ 44.1kHz)
   ```

3. **Agregar** constantes de límites de pan Y:
   ```typescript
   export const dbPanMin = -60; // dB - límite inferior de pan
   export const dbPanMax = 60;  // dB - límite superior de pan
   ```

4. **Agregar función `clampPan`** después de `xToVal`. Se llama después de cada modificación de `offsetX`/`offsetY` o `zoomX`/`zoomY` para impedir que el usuario haga pan fuera de los límites:

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
    // Clamp eje Y (±60 dB)
    const yTop = valToY(dbPanMax, height, metricType, metricConfigs, state);
    const yBottom = valToY(dbPanMin, height, metricType, metricConfigs, state);
    if (yTop > 0) state.offsetY -= yTop;
    if (yBottom < height) state.offsetY += height - yBottom;
}
```

5. **Agregar `clampPan`** al final de `handleMouseMove` (L205-209) y `handleTouchMove` (L258-261) después de modificar `offsetX`/`offsetY`. Esto requiere ampliar las firmas de ambas funciones para recibir `width`, `height`, `hasTimeDomainActive`, `activeMetrics` y `metricConfigs`.

6. Cambiar pinch zoom mínimo de `0.1` a `0.5` (L272-273).

> [!NOTE]
> Ya no se necesita `rebuildFrequencyLUT_frac`. El nuevo approach de spline itera directamente sobre bins FFT y usa `valToX(freq)` para posicionar cada punto.

#### [MODIFY] [canvasRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts)

1. **Reescribir el loop de `drawMetricPath`** (L558-598). En vez de iterar `for (x = 0; x < width; x++)` con `frequencyLUT[x]`, iterar sobre **bins FFT** y usar `valToX(freq)` para la posición X de cada punto. Unir los puntos con `quadraticCurveTo` para obtener curvas suaves:

```typescript
// Construir array de puntos (un punto por bin FFT visible)
const points: {x: number, y: number}[] = [];
const binWidth = 24000 / dataArray.length;

for (let bin = 0; bin < dataArray.length; bin++) {
    const freq = bin * binWidth;
    if (freq < freqMin || freq > freqMax) continue;
    const x = valToX(freq, width, false, state);
    if (x < -10 || x > width + 10) continue;

    // Coherence threshold masking
    if (cfg && cfg.enableCoherence && interpCoherence[bin] < cfg.coherenceThreshold) continue;

    let val = (cfg && cfg.smoothingPPO)
        ? getPPOSmoothedValue(bin, dataArray, cfg.smoothingPPO)
        : dataArray[bin];

    // Coherence/modeY transformations (existentes, sin cambios)...
    if (metricType === "Coherence") { /* ... */ }
    if (cfg && (metricType === "Magnitude" || metricType === "Spectrum")) { /* ... */ }

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

2. **Aplicar el mismo cambio a `drawSpectrumPath`** (L620) — misma estrategia de spline.

3. **El parámetro `frequencyLUT` puede eliminarse** de `drawMetricPath` y `drawSpectrumPath` ya que los bins se iteran directamente. Mantener `frequencyLUT` solo para el espectrograma waterfall.

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. Actualizar las llamadas a `drawMetricPath` y `drawSpectrumPath` para que no pasen `frequencyLUT` (o pasarlo como parámetro opcional/deprecado).
2. Mantener `frequencyLUT` para el espectrograma y otros usos que lo necesiten.

---

## Problema 2: Grosor de línea por defecto de 1px

### Diagnóstico

En [Quadrant.svelte L61-69](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L61-L69), los `metricStyles` por defecto tienen `lineWidth: 2`:

```typescript
"Spectrum": { color: "#a855f7", lineWidth: 2, lineDash: [] },
"Magnitude": { color: "#ff4444", lineWidth: 2, lineDash: [] },
// ...
```

Y en el draw loop de capas (L537, L570):
- Capa activa: `lineWidth = isActive ? 2.5 : 1.2`
- Capa live activa: `lw = isActive ? 2.8 : 1.3`

### Proposed Changes

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. Cambiar `metricStyles` defaults (L61-69): todos a `lineWidth: 1`:
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

2. Ajustar lineWidth de capas (L537): `isActive ? 1.8 : 1` (en vez de `2.5 : 1.2`)
3. Ajustar lineWidth de capas live (L570): `isActive ? 1.8 : 1` (en vez de `2.8 : 1.3`)

---

## Problema 3: Zoom inteligente por eje sobre leyendas + límites X

### Diagnóstico

Actualmente la rueda del mouse hace zoom según `zoomMode` (XY/X/Y) o modificadores (Alt/Shift). Los labels de ejes son pintados directamente en el canvas (`ctx.fillText`) — no son elementos HTML, así que no pueden recibir su propio `onwheel`.

La solución es detectar **la posición del mouse dentro del canvas** al recibir el evento `wheel`:
- **Mouse sobre la zona izquierda (0-45px)** → Los labels del eje Y están ahí → **zoom solo Y**
- **Mouse sobre la zona inferior (height-25px a height)** → Los labels del eje X están ahí → **zoom solo X**
- **Mouse en el área central del gráfico** → Zoom XY (comportamiento actual)

### Proposed Changes

#### [MODIFY] [canvasInteraction.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts)

1. Modificar `handleWheel` (L143-193). Reemplazar la lógica de detección del eje por detección de posición:

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

    // Clamp X + Y
    const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
    clampPan(state, containerWidth, containerHeight, hasTimeDomainActive, refMetric, metricConfigs);
}
```

> [!IMPORTANT]
> Se eliminó el uso de `state.zoomMode` para la detección por posición. Los modificadores Alt/Shift siguen funcionando como fallback en el área central del gráfico. El zoom mínimo cambió de `0.1` a `0.5` para evitar zoom-out extremo. El clamp usa `clampPan()` del Problema 1 para limitar pan X (10Hz-22kHz) e Y (±60dB).

2. Cambiar los límites de frecuencia (L1-L2):
```typescript
export const freqMin = 10;    // Hz (sub-bajo audible)
export const freqMax = 22000; // Hz (cercano a Nyquist @ 44.1kHz)
```

---

## Problema 4: Botones de zoom — Menú desplegable único

### Diagnóstico

Los 4 botones flotantes (XY/X/Y/Reset) en la esquina inferior derecha ([Quadrant.svelte L1364-1394](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L1364-L1394)) tienen dos problemas:
1. Llaman a `zoomTactile()` que **no existe** — no hacen nada
2. Ocupan demasiado espacio visual (4 botones apilados verticalmente)

### Proposed Changes

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. **Agregar la función `zoomTactile`** en la sección de event handlers (cerca de L978-1009):

```typescript
function zoomTactile(axis: 'XY' | 'X' | 'Y') {
    const factor = 1.3; // zoom in por cada clic
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

2. **Reemplazar los 4 botones** (L1364-1394) por un solo botón con menú desplegable:

```svelte
<!-- BOTÓN ÚNICO DE ZOOM CON MENÚ -->
<div class="absolute right-3 bottom-3 z-20 select-none">
    <div class="relative">
        {#if showZoomMenu}
            <div class="fixed inset-0 z-40" onclick={() => showZoomMenu = false}></div>
            <div class="absolute right-0 bottom-10 bg-[#0c0c0e]/95 border border-[#1a1a24] rounded-lg p-1.5 shadow-xl z-50 min-w-[100px] flex flex-col gap-0.5">
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
            class="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0c0c0e]/80 border border-[#1a1a24] text-gray-400 hover:text-white hover:border-[#00ff88] transition-all cursor-pointer shadow-lg opacity-40 hover:opacity-100"
            onclick={() => showZoomMenu = !showZoomMenu}
            title="Opciones de Zoom"
        >
            <span class="material-symbols-outlined text-[16px]">zoom_in</span>
        </button>
    </div>
</div>
```

3. Agregar variable de estado `let showZoomMenu = $state(false);`

---

## Problema 5: Rediseño compacto de la cabecera del cuadrante

### Diagnóstico

La cabecera actual del cuadrante ([Quadrant.svelte L1147-1315](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L1147-L1315)) ocupa mucho espacio horizontal porque:

- Cada **pill de métrica** tiene iconos de `tune` (configurar) y `delete` (borrar), consumiendo ~80px por métrica
- Las **pills de capas** están alineadas horizontalmente con 4 botones cada una (icono layers, visibilidad, duplicar, eliminar)
- El botón "+ Métrica" dice `add Métrica` en vez de solo `+`
- El **HUD de capas** del canvas (L1320-1362) duplica la información de capas de la cabecera

Con 4+ métricas y 2+ capas, la cabecera desborda el ancho disponible, especialmente en layouts 2x2.

### Diseño propuesto

**Lado izquierdo de la cabecera:**
- **ID del cuadrante** — Fix: actualmente L1155 usa `id.replace(/[qQ]/g, '')` que convierte `"q-1"` en `"-1"`. Cambiar a `id.replace(/[qQ]-?/g, '')` para eliminar el guión también
- **Botón `+`** minimalista (solo el símbolo, sin texto) que abre el dropdown de agregar métrica
- **Pills de métrica** — solo texto, sin iconos. Al hacer **clic** se abre el popover de configuración (fusionando la funcionalidad de `tune` + `delete`). El popover ya existente (`activeConfigMetric`) incluirá:
  - Un **toggle de visibilidad** (ocultar/mostrar) — permite dejar la métrica activa (midiéndose) pero invisible en el gráfico. Las pills de métricas ocultas se muestran con **opacidad reducida** y **texto tachado** para indicar que están midiendo pero no se dibujan
  - Un **botón "Eliminar"** al final

**Lado derecho de la cabecera:**
- **Etiqueta de capa activa** — Texto pequeño con el nombre de la capa actualmente seleccionada (ej: "Capa 1"), visible directamente sin abrir dropdown. Esto reemplaza el HUD de capas del canvas
- **Botón de capas** — Un solo icono `layers` con un **badge numérico** indicando la cantidad de capas activas (visibles). Al hacer clic se abre un **dropdown de gestión de capas**
- **Botón settings** (ya existe)

**Dropdown de capas (nuevo):**
- Lista de capas con nombre, y para cada una: botón visibilidad (ojo), botón configurar (engranaje), botón eliminar
- Comando "+ Nueva Capa" al final
- Comando "+ Capa Calculada" debajo

**Eliminaciones:**
- Se elimina el **HUD de capas** superpuesto en el canvas (L1320-1362) porque la información ahora vive en el dropdown de la cabecera
- Se eliminan los iconos `tune` y `delete` de las pills de métricas
- Se elimina el texto "Métrica" del botón de agregar

### Proposed Changes

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. **Fix del ID del cuadrante** (L1155). Cambiar la regex para eliminar también el guión:

```svelte
<!-- ANTES: -->
<span class="quadrant-id font-bold text-[14px] text-emerald-400">{id.replace(/[qQ]/g, '')}</span>
<!-- DESPUÉS: -->
<span class="quadrant-id font-bold text-[14px] text-emerald-400">{id.replace(/[qQ]-?/g, '')}</span>
```

2. **Pills de métricas** (L1199-1235). Reemplazar por pills compactos sin iconos, con soporte para estado "oculto":

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

> [!NOTE]
> El clic abre el popover de configuración. El doble clic activa el modo solo (anteriormente era clic simple, ahora se mueve a doble clic para no colisionar con la apertura del popover).
> Las métricas ocultas (`metricConfigs[m].hidden === true`) se muestran con opacidad 50% y texto tachado (`line-through`) para indicar que se están midiendo pero no se dibujan.

3. **Botón agregar métrica** (L1158-1197). Simplificar a solo `+`:

```svelte
<button
    class="w-6 h-6 flex items-center justify-center rounded border border-[#222] text-[#00ff88] hover:bg-[#00ff88]/10 hover:border-[#00ff88]/30 transition-all cursor-pointer text-sm font-bold"
    onclick={(e) => { e.stopPropagation(); showAddDropdown = !showAddDropdown; }}
    title="Agregar Métrica"
>
    +
</button>
```

4. **Agregar controles al popover de configuración** (`activeConfigMetric`, L1441-1653). Antes del cierre del popover:

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

5. **En el draw loop**, respetar `metricConfigs[metric].hidden`. Buscar donde se dibuja cada métrica activa (L584-617) y agregar al inicio del loop:

```typescript
// No dibujar métricas ocultas
if (metricConfigs[metric]?.hidden) return;
```

6. **Lado derecho de la cabecera: etiqueta de capa activa + botón de capas con dropdown**. Agregar variables `let showLayerDropdown = $state(false)`. En la cabecera, reemplazar las pills de capas actuales (L1237-1304) y antes del botón settings insertar:

```svelte
<!-- ETIQUETA DE CAPA ACTIVA + BOTÓN DE CAPAS CON BADGE -->
<div class="flex items-center gap-1.5">
    <!-- Etiqueta de capa activa (siempre visible) -->
    {@const activeLayer = quadrantLayers.find(l => l.id === uiStore.activeLayerId)}
    {#if activeLayer}
        <span class="text-[9px] text-gray-400 truncate max-w-[80px]" title={activeLayer.name}>
            {#if activeLayer.isCalculated}<span class="text-[#a855f7] font-mono">∑</span>{/if}
            {activeLayer.name}
        </span>
    {/if}

    <div class="relative">
        <button
            class="flex items-center justify-center w-8 h-8 rounded-lg border border-[#1a1a24] text-gray-400 hover:text-gray-200 transition-all cursor-pointer hover:bg-[#121216] relative"
            onclick={(e) => { e.stopPropagation(); showLayerDropdown = !showLayerDropdown; }}
            title="Gestionar Capas"
        >
            <span class="material-symbols-outlined text-[16px]">layers</span>
            {#if quadrantLayers.length > 0}
                <span class="absolute -top-1 -right-1 bg-[#00ff88] text-black text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {quadrantLayers.filter(l => l.visible).length}
                </span>
            {/if}
        </button>

        {#if showLayerDropdown}
            <div class="fixed inset-0 z-40" onclick={() => showLayerDropdown = false}></div>
            <div class="absolute right-0 mt-1 bg-[#0c0c0e] border border-[#1a1a24] rounded-xl p-3 shadow-[0_10px_30px_#000] z-50 min-w-[200px] flex flex-col gap-1.5 select-none text-[11px]"
                 onmousedown={(e) => e.stopPropagation()}
                 onclick={(e) => e.stopPropagation()}
                 onwheel={(e) => e.stopPropagation()}>
                <div class="flex items-center justify-between border-b border-[#1a1a24] pb-1.5 mb-1">
                    <span class="font-bold text-gray-300 text-[10px] uppercase tracking-wider">Capas</span>
                    <button onclick={() => showLayerDropdown = false} class="text-gray-500 hover:text-gray-300">
                        <span class="material-symbols-outlined text-xs">close</span>
                    </button>
                </div>

                {#each quadrantLayers as layer}
                    <div class="flex items-center justify-between gap-2 py-1 px-1 rounded hover:bg-[#121216] group"
                         draggable="true"
                         ondragstart={(e) => onLayerDragStart(e, layer.id)}>
                        <span class="text-[10px] truncate flex-1 cursor-pointer {layer.id === uiStore.activeLayerId ? 'text-[#00ff88] font-bold' : 'text-gray-300'}"
                              onclick={() => uiStore.activeLayerId = layer.id}>
                            {#if layer.isCalculated}<span class="text-[#a855f7] font-mono mr-1">∑</span>{/if}
                            {layer.name}
                        </span>
                        <div class="flex items-center gap-0.5">
                            <button class="p-0.5 text-gray-500 hover:text-white" onclick={() => layer.visible = !layer.visible}>
                                <span class="material-symbols-outlined text-[13px]">{layer.visible ? 'visibility' : 'visibility_off'}</span>
                            </button>
                            <button class="p-0.5 text-gray-500 hover:text-red-400" onclick={() => traceManager.deleteLayer(layer.id)}>
                                <span class="material-symbols-outlined text-[13px]">delete</span>
                            </button>
                        </div>
                    </div>
                {/each}

                <!-- Botón único "Agregar" con sub-menú desplegable -->
                <div class="border-t border-[#1a1a24] pt-1.5 mt-1 relative">
                    <button
                        class="w-full text-left px-2 py-1.5 rounded text-[10px] text-[#00ff88] hover:bg-[#00ff88]/5 font-semibold flex items-center gap-1 cursor-pointer"
                        onclick={(e) => { e.stopPropagation(); showAddLayerMenu = !showAddLayerMenu; }}>
                        <span class="material-symbols-outlined text-[12px]">add</span>
                        Agregar capa
                        <span class="material-symbols-outlined text-[10px] ml-auto">expand_more</span>
                    </button>
                    {#if showAddLayerMenu}
                        <div class="absolute left-0 bottom-full mb-1 bg-[#0c0c0e] border border-[#1a1a24] rounded-lg shadow-lg z-50 min-w-[160px] py-1">
                            <button
                                class="w-full text-left px-3 py-1.5 text-[10px] text-[#00ff88] hover:bg-[#00ff88]/5 flex items-center gap-1.5 cursor-pointer"
                                onclick={() => { traceManager.addLayer(`Capa ${traceManager.layers.length + 1}`, id, 'live'); showAddLayerMenu = false; }}>
                                <span class="material-symbols-outlined text-[12px]">add</span>
                                Nueva Capa
                            </button>
                            <button
                                class="w-full text-left px-3 py-1.5 text-[10px] text-[#a855f7] hover:bg-[#a855f7]/5 flex items-center gap-1.5 cursor-pointer"
                                onclick={() => { traceManager.addCalculatedLayer('Avg', id, 'average'); showAddLayerMenu = false; }}>
                                <span class="material-symbols-outlined text-[12px]">functions</span>
                                Capa Calculada
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>
```

7. **Eliminar** las pills de capas horizontales actuales (L1237-1304) de la cabecera.
8. **Eliminar** el HUD de capas del canvas (L1320-1362) ya que su funcionalidad se unifica en el dropdown.

---

## Problema 6: Viewport móvil — zoom del navegador y altura dinámica

### Diagnóstico

Dos problemas en dispositivos móviles:

1. **Pinch-to-zoom del navegador:** Al hacer zoom in con dos dedos sobre el cuadrante, se amplía toda la interfaz del navegador en vez del gráfico dentro del cuadrante. Esto ocurre porque el meta viewport ([app.html L6](file:///c:/Users/Abel/Documents/Asistente/asistente/src/app.html#L6)) no tiene `maximum-scale=1, user-scalable=no`:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1" />
   ```

2. **Barra de direcciones oculta parte inferior:** En móvil, cuando la barra de direcciones/pestañas del navegador está visible, `100vh` incluye el espacio detrás de la barra, ocultando la parte inferior de la página. Actualmente [+page.svelte L68](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/+page.svelte#L68) usa `height: 100vh`.

### Proposed Changes

#### [MODIFY] [app.html](file:///c:/Users/Abel/Documents/Asistente/asistente/src/app.html)

1. Agregar `maximum-scale=1, user-scalable=no, interactive-widget=resizes-content` al viewport meta (L6):

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content" />
```

> [!NOTE]
> `user-scalable=no` previene el zoom nativo del navegador. El zoom del gráfico se maneja internamente con los touch handlers (`handleTouchStart`, `handleTouchMove` en `canvasInteraction.ts`).
> `interactive-widget=resizes-content` ajusta el viewport cuando aparece el teclado virtual.

#### [MODIFY] [+page.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/+page.svelte)

1. Reemplazar `100vh` por `100dvh` (L68). `dvh` (dynamic viewport height) excluye la barra del navegador:

```css
/* ANTES: */
height: 100vh;

/* DESPUÉS: */
height: 100dvh;
height: 100vh; /* fallback para navegadores sin soporte dvh */
```

> [!IMPORTANT]
> Se usa `dvh` como primera declaración y `vh` como fallback. Los navegadores que soporten `dvh` lo usarán; los demás caerán al `vh`.
> El orden correcto es **fallback primero, preferido después** (CSS cascade):
> ```css
> height: 100vh;  /* fallback */
> height: 100dvh; /* preferido, sobrescribe si soportado */
> ```

2. Si hay un `calc(100vh - ...)` (L92), actualizarlo también:
```css
/* ANTES: */
height: calc(100vh - 100px);

/* DESPUÉS: */
height: calc(100vh - 100px);   /* fallback */
height: calc(100dvh - 100px);  /* preferido */
```

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. En el contenedor del canvas (`.quadrant-container`, L1122-1146), agregar `touch-action: none` para prevenir que el navegador intercepte gestos:

```svelte
<div class="quadrant-container"
     style="cursor: ...; background: ...; touch-action: none;"
     ...>
```

2. En los `handleTouchStart`/`handleTouchMove`, agregar `e.preventDefault()` para prevenir el scroll nativo del navegador:

```typescript
function handleTouchStart(e: TouchEvent) {
    e.preventDefault(); // Prevenir zoom nativo del navegador
    interactionHandleTouchStart(e, interactionState);
}

function handleTouchMove(e: TouchEvent) {
    e.preventDefault(); // Prevenir scroll nativo
    interactionHandleTouchMove(e, interactionState, canvas);
}
```

---

## Problema 7: Botón colapsar sidebar flotante en el borde

### Diagnóstico

Actualmente el botón de colapsar/abrir el sidebar está distribuido en 3 lugares:

1. **Sidebar.svelte L724-731**: Botón `menu_open` dentro de la cabecera de pestañas (solo visible con sidebar abierto)
2. **+page.svelte L40-46**: Mini-botón `menu` fijado en `fixed left-2 top-14` (solo visible con sidebar cerrado)
3. **Header.svelte L87-96**: Botón hamburguesa `menu` en el header (solo visible con sidebar cerrado, condición `{#if !uiStore.showSidebar}`)

Problemas:
- El botón cambia de lugar al colapsar/abrir, confundiendo al usuario
- Tres implementaciones separadas para la misma funcionalidad
- El botón hamburguesa del header duplica el mini-botón de +page.svelte

### Diseño propuesto

Un único **botón flotante pegado al borde derecho del sidebar**, centrado verticalmente. Este botón:
- Siempre está visible en el borde, tanto con sidebar abierto como cerrado
- Con sidebar abierto: se ve como una pequeña aleta/tab en el borde derecho del sidebar, con `chevron_left` (indicando "colapsar")
- Con sidebar cerrado: se ve como una pequeña aleta/tab pegada al borde izquierdo de la pantalla, con `chevron_right` (indicando "abrir")
- Se anima suavemente entre posiciones

### Proposed Changes

#### [MODIFY] [+page.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/+page.svelte)

1. **Eliminar** el mini-botón flotante existente (L39-46).

2. **Agregar un botón flotante en el borde del sidebar**. Colocarlo **fuera** del condicional `{#if uiStore.showSidebar}`, para que siempre se renderice. Posicionarlo con `position: absolute` relativo al `app-container`:

```svelte
<div class="app-container" style="position: relative;">
    {#if uiStore.showSidebar}
        <div class="sidebar-wrapper ..." style="width: 380px; ...">
            <Sidebar />
        </div>
    {/if}

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

    <main class="main-viewport">
        <ViewGrid />
    </main>
</div>
```

> [!NOTE]
> El `left` del botón transiciona de `380px` (ancho del sidebar) a `0px` cuando se colapsa, gracias al `transition-all duration-300`. El botón usa `rounded-r-lg` para que solo tenga bordes redondeados del lado derecho (tab adherida al borde).

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. **Eliminar** el botón colapsar de la cabecera de pestañas (L724-731):
```svelte
<!-- ELIMINAR este bloque -->
<button
    class="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 ..."
    onclick={() => (uiStore.showSidebar = !uiStore.showSidebar)}
    title="Colapsar Panel"
>
    <span class="material-symbols-outlined text-[20px]">menu_open</span>
</button>
```

#### [MODIFY] [Header.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte)

1. **Eliminar** el botón hamburguesa condicional (L87-97):
```svelte
<!-- ELIMINAR este bloque -->
{#if !uiStore.showSidebar}
    <button
        class="cursor-pointer flex items-center ..."
        onclick={() => (uiStore.showSidebar = !uiStore.showSidebar)}
        title="Mostrar panel lateral"
    >
        <span class="material-symbols-outlined text-[20px]">menu</span>
    </button>
{/if}
```

---

## Problema 8: Pestañas del sidebar más altas con etiqueta debajo

### Diagnóstico

Las pestañas actuales del sidebar ([Sidebar.svelte L733-782](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L733-L782)) tienen layout horizontal con icono + texto en línea:

```svelte
<button class="flex-1 h-9 rounded-lg flex items-center justify-center ... gap-2 px-2">
    <span class="material-symbols-outlined text-[18px]">cadence</span>
    <span class="text-[10px] font-bold uppercase tracking-wider hidden xl:block">Med</span>
</button>
```

- `h-9` (36px) es pequeño para un área táctil
- El texto está al lado del icono y se oculta en pantallas < XL
- El contenedor tiene `h-[56px]` (L723)

### Diseño propuesto

Botones más altos con layout **vertical** (icono arriba, etiqueta debajo). La etiqueta siempre visible pero más pequeña.

### Proposed Changes

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. **Aumentar la altura del contenedor** de pestañas (L723). Cambiar `h-[56px]` a `h-[60px]`:

```svelte
<!-- ANTES: -->
<div class="flex items-center bg-[#050507] border-b border-[#1a1a24]/50 px-2 py-2 gap-1 h-[56px] flex-shrink-0">

<!-- DESPUÉS (sin el botón colapsar, que se movió al borde): -->
<div class="flex items-center bg-[#050507] border-b border-[#1a1a24]/50 px-2 py-1.5 gap-0.5 h-[60px] flex-shrink-0">
```

2. **Cambiar cada botón de pestaña** a layout vertical (icono arriba, label abajo). Reemplazar los 4 botones (L735-781) por este patrón:

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

> [!NOTE]
> Cambios clave:
> - Layout cambió de `flex items-center` (horizontal) a `flex flex-col items-center` (vertical)
> - Altura de botón: `h-9` (36px) → `h-[48px]` (48px)
> - Icono: `text-[18px]` → `text-[20px]`
> - Label: `text-[10px]` → `text-[8px]`, siempre visible (se eliminó `hidden xl:block`)
> - Gap entre icono y label: `gap-2` (horizontal) → `gap-0.5` (vertical apretado)
> - Se usa `{#each}` para evitar duplicar código de 4 botones

---

## Problema 9: Sistema de tema global (claro / oscuro / sistema) + scrollbar estilizado

### Diagnóstico

Actualmente:

1. **Tema claro/oscuro**: Solo existe un toggle boolean `isDarkMode` ([ui.svelte.ts L8, L67-70](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/ui.svelte.ts#L8)). Solo aplica la clase `dark` al `<html>` pero **no afecta al resto de la UI** porque los colores están hardcodeados en clases Tailwind (`bg-[#0a0a0c]`, `text-gray-200`, etc.), no en CSS variables.
2. **No hay opción "Sistema"**: No detecta `prefers-color-scheme` del OS.
3. **Canvas sí responde**: El renderer ([canvasRenderers.ts L29-41](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts#L29-L41)) tiene tema dark/light con colores inline.
4. **No hay temas de colores (accent)**: No existen CSS custom properties ni sistema de color themes.
5. **Scrollbar**: Usa el default del navegador, desentona con el tema oscuro.
6. **Control actual**: Toggle de 2 estados (light/dark) en pestaña Config ([Sidebar.svelte L2585-2623](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L2585-L2623)).

### Diseño propuesto

#### 9A: Selector de modo claro / oscuro / sistema

Reemplazar el toggle boolean por un selector de 3 opciones:
- **Sistema** (default): detecta `prefers-color-scheme` del OS y se actualiza en tiempo real
- **Claro**: fuerza tema claro
- **Oscuro**: fuerza tema oscuro

#### 9B: Scrollbar estilizado

Agregar CSS global para scrollbar con colores del tema.

### Proposed Changes

#### [MODIFY] [ui.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/ui.svelte.ts)

1. **Reemplazar** `isDarkMode: boolean` por `themeMode: 'system' | 'light' | 'dark'` (default: `'system'`).
2. **Agregar** propiedad computada `isDarkMode` que resuelve el modo actual:

```typescript
themeMode = $state<'system' | 'light' | 'dark'>('system');

// Propiedad computada
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

3. **Registrar listener** de `matchMedia` para `prefers-color-scheme` en modo `system`, que re-aplique el tema cuando el OS cambie.

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. **Reemplazar** el toggle de 2 estados (L2594-2623) por un **segmented control de 3 opciones** (Sistema/Claro/Oscuro):

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

2. **Actualizar** la persistencia en `localStorage` (L566-571, L597): guardar `themeMode` en vez de `isDarkMode`.

#### [MODIFY] [layout.css](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/layout.css)

1. Agregar estilos globales de scrollbar para Webkit y Firefox:

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

> [!NOTE]
> - El modo `system` usa `window.matchMedia('(prefers-color-scheme: dark)')` con un listener `change` para reaccionar en tiempo real si el usuario cambia el tema del OS.
> - La scrollbar usa los colores del tema oscuro (`#1a1a24` thumb, transparente track). En modo claro, estos colores se mantienen discretos.
> - No hay temas de colores de acento implementados actualmente. El color primario (`#3b82f6`), acento (`#00ff88`) y otros están hardcodeados en clases Tailwind. Un sistema de color themes requeriría migrar a CSS custom properties, lo cual es un refactor mayor y queda fuera de este plan.

---

## Problema 10: EQ gráfico — hasta 31 bandas con fracciones de octava

### Diagnóstico

Actualmente el selector de bandas ([Sidebar.svelte L1337-1344](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L1337-L1344)) solo ofrece 5, 10 o 15 bandas con labels genéricos:

```svelte
<option value={5}>5 Bandas</option>
<option value={10}>10 Bandas</option>
<option value={15}>15 Bandas</option>
```

No muestra la fracción de octava correspondiente ni ofrece hasta 31 bandas.

### Diseño propuesto

Mostrar las opciones con el formato: **fracción de octava + número de bandas entre paréntesis**. Agregar un botón "Personalizar" que permita ingresar un número libre de bandas.

Opciones estándar ISO:
- 1 octava (10 bandas)
- 2/3 octava (15 bandas)
- 1/2 octava (20 bandas)
- 1/3 octava (31 bandas)
- Personalizar...

### Proposed Changes

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. **Agregar variable** `let customBandCount = $state(false);` para el modo personalizar.

2. **Reemplazar el selector** de bandas (L1337-1344):

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

3. **Actualizar la lógica de generación de bandas** (L171-181). La función que genera las frecuencias de las bandas debe soportar cualquier número usando distribución logarítmica entre 20Hz y 20kHz:

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

## Problema 11: Panel EQ sin overflow / doble scrollbar

### Diagnóstico

El panel EQ gráfico tiene `max-h-[300px] overflow-y-auto` ([L1348](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L1348)), y el panel EQ paramétrico tiene `max-h-[350px] overflow-y-auto` ([L1408](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L1408)). Cuando el contenido excede esos límites, aparece un scrollbar **interno** además del scrollbar del contenedor padre (`overflow-y-auto` en L1271), generando **doble scrollbar**.

### Proposed Changes

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. **Eliminar `max-h-[300px] overflow-y-auto`** del contenedor de bandas gráficas (L1348):
```svelte
<!-- ANTES: -->
<div class="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">

<!-- DESPUÉS: -->
<div class="flex flex-col gap-2.5">
```

2. **Eliminar `max-h-[350px] overflow-y-auto`** del contenedor de filtros paramétricos (L1408):
```svelte
<!-- ANTES: -->
<div class="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">

<!-- DESPUÉS: -->
<div class="flex flex-col gap-3">
```

> [!NOTE]
> El scroll lo maneja el contenedor padre del panel EQ (`panel-eq`, L1271, que ya tiene `overflow-y-auto`). Al eliminar los `max-h` internos, el contenido fluye naturalmente y el usuario tiene un solo scrollbar.

---

## Problema 12: Eliminar opción de control de tono

### Diagnóstico

El "Control de Tono" ([Sidebar.svelte L1650-1720+](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L1650)) es una versión simplificada del ecualizador paramétrico (3 bandas fijas: Bass, Mid, Treble). Es **redundante** con el ecualizador gráfico configurado en 3 bandas.

También existe lógica asociada en:
- L33: `eqType` permite valor `'tono'`
- L162-168: Lógica AutoEQ para tono
- L206-210: Lógica de envío de tono
- L1324: `<option value="tono">Control de Tono</option>`
- Variables: `toneBass`, `toneMid`, `toneTreble`

### Proposed Changes

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. **Eliminar** la `<option value="tono">Control de Tono</option>` del selector (L1324)
2. **Eliminar** todo el bloque `{#if eqType === "tono"}...{/if}` (L1650-1720+)
3. **Eliminar** las variables `toneBass`, `toneMid`, `toneTreble`
4. **Eliminar** la lógica de AutoEQ para tono (L162-168) y envío de tono (L206-210)
5. **Cambiar** el tipo de `eqType` de `'grafico' | 'parametrico' | 'tono'` a `'grafico' | 'parametrico'`

#### [MODIFY] [ui.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/ui.svelte.ts)

1. Si `eqType` se persiste en el store, cambiar el tipo para que no acepte `'tono'`

---

## Problema 13: EQ paramétrico — filtros ilimitados

### Diagnóstico

Actualmente el número de filtros paramétricos está limitado a 6 mediante un `<select>` ([L1392-1404](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L1392-L1404)) con `Array.from({ length: 6 })`. Los filtros están pre-creados y se muestran/ocultan con `.slice(0, numParametricFilters)` (L1410).

Esto no permite más de 6 filtros y la UX de pre-seleccionar cantidad no es intuitiva.

### Diseño propuesto

Reemplazar el `<select>` de cantidad por:
- Un **botón "+ Agregar Filtro"** que crea un filtro nuevo al final del array
- Un **botón "Eliminar"** en cada filtro individual
- Sin límite artificial en la cantidad de filtros

### Proposed Changes

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. **Eliminar** la variable `numParametricFilters` y el `<select>` de cantidad (L1386-1405)

2. **Cambiar** `parametricFilters.slice(0, numParametricFilters)` (L1410) por `parametricFilters` directamente

3. **Agregar botón "Eliminar"** en cada card de filtro (L1414-1420). Al lado del nombre "Filtro N":

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

4. **Agregar botón "+ Agregar Filtro"** después del `{#each}` (L1645):

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

5. **Reemplazar el header** del panel paramétrico (L1386-1405) por una barra simple:

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

---

## Verificación

### Manual
1. `npm run build` sin errores.
2. Verificar que las curvas de Magnitude y Spectrum se ven **suaves como ondas** en todo el rango (sin escalones/barras en bajas frecuencias).
3. Verificar que el grosor por defecto es fino (1px).
4. Verificar zoom:
   - Rueda sobre los labels izquierdos (dB) → solo zoom vertical
   - Rueda sobre los labels inferiores (Hz) → solo zoom horizontal
   - Rueda en el centro → zoom XY
   - Alt+Rueda en cualquier lugar → solo zoom vertical
   - Shift+Rueda → solo zoom horizontal
   - Doble clic → reset
   - Botón de zoom (menú desplegable) → opciones XY/X/Y/Restaurar
5. Verificar que el eje X va de 10Hz a 22kHz.
6. Cabecera compacta:
   - ID del cuadrante sin guión ("1" en vez de "-1")
   - Pills de métricas: solo texto, clic abre popover de config, doble clic = modo solo
   - Métricas ocultas: pill con opacidad reducida y texto tachado
   - Popover de config tiene toggle visibilidad + botón "Eliminar"
   - Botón `+` es minimalista (solo símbolo)
   - Etiqueta de capa activa visible junto al botón de capas
   - Botón de capas (derecha) tiene badge numérico con conteo de capas visibles
   - Dropdown de capas lista todas las capas con visibilidad/eliminar + comandos para agregar
7. Móvil:
   - Pinch-to-zoom sobre el cuadrante hace zoom del gráfico (no del navegador)
   - La interfaz ocupa exactamente la pantalla visible (sin overflow por barra del navegador)
8. Sidebar:
   - Botón colapsar/abrir es una aleta flotante pegada al borde derecho del sidebar, centrada verticalmente
   - Al colapsar, la aleta se desliza a la izquierda (left: 0) con animación
   - No hay botón hamburguesa en el Header ni mini-botón en +page.svelte
   - Pestañas del sidebar: icono arriba, etiqueta pequeña debajo, más altas (48px)
   - Iconos: `podcasts` (Med), `cadence` (EQ), `photo_camera` (Inst), `settings` (Cfg)
   - Scrollbar estilizado con tema oscuro (#1a1a24), 6px ancho
9. Ecualizador:
   - EQ gráfico: opciones 1 oct / 2/3 oct / 1/2 oct / 1/3 oct + personalizar, hasta 31 bandas
   - Sin doble scrollbar en el panel EQ (contenido fluye sin max-h)
   - No existe opción "Control de Tono"
   - EQ paramétrico: botón "+ Agregar Filtro" sin límite, botón eliminar en cada filtro

---

## Resumen de Archivos

| Archivo | Cambios |
|---------|---------|
| [canvasInteraction.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts) | `freqMin=10`, `freqMax=22000`, zoom por posición en `handleWheel` |
| [canvasRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts) | `drawMetricPath` y `drawSpectrumPath` reescritos con spline por bin FFT |
| [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte) | Fix ID, `metricStyles` lineWidth=1, `zoomTactile()` + menú zoom, pills con hide/show, cabecera compacta, `touch-action: none` |
| [app.html](file:///c:/Users/Abel/Documents/Asistente/asistente/src/app.html) | Viewport meta: `maximum-scale=1, user-scalable=no` |
| [+page.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/+page.svelte) | `100vh` → `100dvh`, eliminar mini-botón sidebar, agregar botón flotante en borde |
| [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte) | Pestañas verticales + nuevos iconos, EQ: bandas octava, sin overflow, sin tono, filtros ilimitados |
| [Header.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte) | Eliminar botón hamburguesa condicional |
| [layout.css](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/layout.css) | Scrollbar estilizado con tema oscuro |
| [ui.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/ui.svelte.ts) | Eliminar tipo `'tono'` de `eqType` |
