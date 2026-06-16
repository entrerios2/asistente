# Plan de Refinamiento v4 — Mejoras UI Cuadrante + Sidebar + Tema

## Resumen

17 problemas de refinamiento sobre la implementación actual (post-v3). Enfocados en pulir la experiencia del cuadrante, la interacción de zoom/pan, la consistencia visual del tema, y la usabilidad del panel de ecualización.

---

## Problema 1: Ajuste de límites de clamp y grilla

### Contexto actual
- `dbPanMin = -60`, `dbPanMax = 60` (clamp de pan Y)
- `dbMin = -30`, `dbMax = 30` (rango de grilla Y para Magnitude)
- Zoom mínimo `0.5`, máximo `4`

### Cambio requerido
- **Clamp de zoom**: El zoom debe poder mostrar hasta ±80 dB → cambiar `dbPanMin = -80`, `dbPanMax = 80`
- **Clamp de pan**: Igual que zoom, hasta ±80 dB
- **Grilla**: Mostrar etiquetas de frecuencia hasta ±60 dB → cambiar `drawGrid` para usar rango de grilla de -60 a +60 dB en el eje Y

### Archivos a modificar

#### [MODIFY] [canvasInteraction.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts)

1. Cambiar `dbPanMin` y `dbPanMax` (L57-58):
```typescript
export const dbPanMin = -80; // dB - límite de pan/zoom
export const dbPanMax = 80;  // dB - límite de pan/zoom
```

#### [MODIFY] [canvasRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts)

1. En `drawGrid`, sección "Horizontal ticks (Left Y axis)" (L87-131), cambiar los valores para Magnitude:
```typescript
// ANTES (L87-88):
let min = dbMin, max = dbMax, step = 10, unit = "dB";

// DESPUÉS:
let min = -60, max = 60, step = 10, unit = "dB";
```

> [!NOTE]
> `dbMin`/`dbMax` siguen siendo -30/+30 para la proyección `valToY` (rango normalizado sin zoom). La grilla ahora muestra labels en el rango extendido de ±60dB, que se vuelven visibles cuando el usuario hace zoom out.

---

## Problema 2: Fix del clamp de pan (saltos descontrolados)

### Contexto actual
- `clampPan()` se llama después de modificar offsets, pero en ciertos casos el pan "salta" descontroladamente al llegar al límite
- Esto es un bug funcional, no un problema estético

### Cambio requerido
- Asegurar que `clampPan()` aplique un **clamp duro inmediato** sin excepciones
- Verificar que se llama en **todos** los puntos de modificación de offset (drag mouse, drag touch, zoom wheel, pinch zoom)
- Verificar que el clamp funciona correctamente cuando `zoomX` o `zoomY` están en valores extremos (0.5 o 4)
- Asegurar que `handleMouseUp` y `handleTouchEnd` también llaman a `clampPan` por seguridad

### Archivos a modificar

#### [MODIFY] [canvasInteraction.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts)

1. Simplificar `clampPan()` para que siempre haga clamp duro (eliminar cualquier lógica condicional o de overscroll):
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

2. Agregar llamada a `clampPan` en `handleMouseUp` y `handleTouchEnd` como red de seguridad (requiere ampliar sus firmas para recibir los parámetros necesarios).

3. Cambiar zoom máximo de `20` a `4` en todos los `Math.max(0.5, Math.min(...))` de `handleWheel` y `handleTouchMove`.

---

## Problema 3: Menú zoom para anclar eje

### Contexto actual
- El menú de zoom tiene opciones "Zoom XY", "Zoom X", "Zoom Y" que llaman `zoomTactile()` para hacer zoom real
- El usuario quiere que este menú **ancle** el eje de zoom (lock), no que haga zoom en sí

### Cambio requerido
- Convertir el menú en un selector de modo: XY (libre), X (solo horizontal), Y (solo vertical)
- El modo seleccionado afecta qué eje se modifica con la rueda del mouse en la zona central del cuadrante
- Mostrar indicador visual del modo activo en el botón

### Archivos a modificar

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. Eliminar función `zoomTactile` (ya no es necesaria).

2. Reemplazar las opciones del menú zoom (L1349-1359):
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

3. Cambiar el icono del botón principal para reflejar el modo activo:
```svelte
<span class="material-symbols-outlined text-[16px]">
    {interactionState.zoomMode === 'X' ? 'swap_horiz' : interactionState.zoomMode === 'Y' ? 'swap_vert' : 'open_with'}
</span>
```

#### [MODIFY] [canvasInteraction.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts)

1. En `handleWheel`, la detección de zona ya funciona (labels del eje → zoom single axis). Pero en la zona central (L210-213), respetar `state.zoomMode`:
```typescript
} else {
    // Área central: respetar el modo anclado
    zoomX = state.zoomMode === 'XY' || state.zoomMode === 'X';
    zoomY = state.zoomMode === 'XY' || state.zoomMode === 'Y';
}
```

---

## Problema 4: Zoom Y inicial más alejado

### Contexto actual
- `zoomY: 1` por defecto (L98)
- La vista muestra el rango de -30 a +30 dB, lo cual puede ser estrecho

### Cambio requerido
- Iniciar con `zoomY: 0.7` para mostrar un rango más amplio (~±43 dB visible)

### Archivos a modificar

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. Cambiar `zoomY: 1` a `zoomY: 0.7` (L98).

2. También actualizar `handleDoubleClick` en canvasInteraction.ts para restaurar a `zoomY: 0.7` en vez de `1`:
```typescript
export function handleDoubleClick(state: InteractionState): void {
    state.zoomX = 1;
    state.zoomY = 0.7;
    state.offsetX = 0;
    state.offsetY = 0;
}
```

---

## Problema 5: Cursores contextuales

### Contexto actual
- Solo 2 cursores: `grab` y `grabbing` (L1146, L1340)
- No hay feedback visual del eje de zoom

### Cambio requerido
- **Zona labels eje Y** (margen izquierdo 45px): cursor `ns-resize` (flecha vertical)
- **Zona labels eje X** (margen inferior 25px): cursor `ew-resize` (flecha horizontal)
- **Zona central del cuadrante**: cursor `crosshair`
- **Durante pan (drag)**: cursor `grabbing` (mano cerrada)

### Archivos a modificar

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. Crear un `$derived` para el cursor basado en la posición del mouse:
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

2. Reemplazar el cursor hardcoded en el contenedor (L1146) y el canvas (L1340):
```svelte
<!-- contenedor -->
style="cursor: {cursorStyle}; ..."
<!-- canvas -->
style="cursor: {cursorStyle}"
```

---

## Problema 6: ID del cuadrante como watermark

### Contexto actual
- El ID se muestra en la barra superior del cuadrante como texto pequeño (L1177)

### Cambio requerido
- Eliminar de la barra superior
- Mostrar el ID como texto grande (72px), semitransparente, en la **esquina inferior derecha** del canvas (como marca de agua)

### Archivos a modificar

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. Eliminar `<span class="quadrant-id ...">` (L1177).

2. Agregar un overlay absoluto dentro del cuadrante, después del canvas (L1340):
```svelte
<!-- WATERMARK ID DEL CUADRANTE -->
<span class="absolute bottom-2 right-3 text-[72px] font-black pointer-events-none select-none leading-none"
      style="color: {uiStore.isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'}">
    {id.replace(/[qQ]-?/g, '')}
</span>
```

---

## Problema 7: Pills con color y estilo de línea

### Contexto actual
- Los pills son texto plano con colores genéricos (L1223-1236)
- No reflejan el color asignado a la métrica ni su estilo de línea (dash pattern)

### Cambio requerido
- El texto del pill debe usar el color de la métrica (`metricStyles[m].color`)
- El borde del pill debe usar el estilo de línea de la métrica: sólido si `lineDash: []`, punteado si tiene dash
- Mantener los estados existentes (solo, hidden)

### Archivos a modificar

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. Reemplazar pills (L1221-1237):
```svelte
{#each activeMetrics as m}
    {@const isHidden = metricConfigs[m]?.hidden}
    {@const style = metricStyles[m] || { color: '#888', lineWidth: 1, lineDash: [] }}
    {@const hasDash = style.lineDash.length > 0}
    <button
        class="px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer select-none
               {isHidden ? 'opacity-30 line-through' : ''}"
        style="color: {soloMetric === m ? '#000' : style.color};
               background: {soloMetric === m ? style.color : style.color + '15'};
               border: 1.5px {hasDash ? 'dashed' : 'solid'} {style.color}{isHidden ? '40' : '80'};"
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

---

## Problema 8: Controles de capas alineados a la derecha

### Contexto actual
- Los controles de capas están entre el `quadrant-title-group` y el botón settings, pero el layout `justify-between` no los alinea bien visualmente

### Cambio requerido
- La barra superior debe tener: lado izquierdo = botón `+` + pills, lado derecho = etiqueta capa activa + botón capas + botón settings
- El `div` contenedor de capas + settings debe tener `ml-auto` para empujar a la derecha

### Archivos a modificar

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. Mover el botón settings dentro del `div` de capas (L1241-1337). Agrupar etiqueta capa + botón layers + botón settings en un solo `div` con `ml-auto`:

```svelte
<!-- CONTROLES DERECHA: Capa activa + Capas + Settings -->
<div class="flex items-center gap-1.5 ml-auto">
    <!-- Etiqueta capa activa -->
    {#if activeLayer}
        <span class="text-[9px] text-gray-400 truncate max-w-[80px]" title={activeLayer.name}>
            {#if activeLayer.isCalculated}<span class="text-[#a855f7] font-mono">∑</span>{/if}
            {activeLayer.name}
        </span>
    {/if}
    <!-- Botón capas (existente) -->
    ...
    <!-- Botón settings (existente) -->
    ...
</div>
```

2. Eliminar el `justify-between` del header y usar `gap-2` directo.

---

## Problema 9: Snapshots como capas

### Contexto actual
- Los snapshots se gestionan desde la pestaña "Inst" del sidebar
- Las capas del cuadrante tienen `sourceType: 'live' | 'snapshot' | 'calculated'`
- Pero no hay forma de agregar un snapshot existente como capa desde el menú de capas del cuadrante

### Cambio requerido
- En el dropdown de "Agregar capa", mostrar la opción "Instantánea" que abra un sub-menú con la lista de instantáneas disponibles
- Al seleccionar un snapshot, crear una capa con `sourceType: 'snapshot'` y asignarle los datos del snapshot

### Archivos a modificar

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. En el menú "Agregar capa" (L1307-1322), agregar la opción de snapshot entre "Nueva Capa" y "Capa Calculada".

---

## Problema 10: Menú agregar capas — opciones: medición, snapshot, calculada

### Contexto actual
- El sub-menú tiene "Nueva Capa" y "Capa Calculada" (L1309-1320)

### Cambio requerido
- Renombrar "Nueva Capa" → "Medición" con icono `podcasts`
- Agregar "Instantánea" con icono `photo_camera` (abre sub-menú con lista de snapshots disponibles)
- Mantener "Capa Calculada" con icono `functions`

### Archivos a modificar

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

1. Reemplazar el sub-menú (L1308-1321):
```svelte
<div class="absolute left-0 bottom-full mb-1 bg-[#0c0c0e] border border-[#1a1a24] rounded-lg shadow-lg z-50 min-w-[180px] py-1">
    <button
        class="w-full text-left px-3 py-1.5 text-[10px] text-[#00ff88] hover:bg-[#00ff88]/5 flex items-center gap-1.5 cursor-pointer"
        onclick={() => { traceManager.addLayer(`Capa ${traceManager.layers.length + 1}`, id, 'live'); showAddLayerMenu = false; showLayerDropdown = false; }}>
        <span class="material-symbols-outlined text-[12px]">podcasts</span>
        Medición
    </button>
    <button
        class="w-full text-left px-3 py-1.5 text-[10px] text-[#3b82f6] hover:bg-[#3b82f6]/5 flex items-center gap-1.5 cursor-pointer"
        onclick={() => { /* abrir sub-menú de snapshots */ }}>
        <span class="material-symbols-outlined text-[12px]">photo_camera</span>
        Instantánea
        <span class="material-symbols-outlined text-[10px] ml-auto">chevron_right</span>
    </button>
    <button
        class="w-full text-left px-3 py-1.5 text-[10px] text-[#a855f7] hover:bg-[#a855f7]/5 flex items-center gap-1.5 cursor-pointer"
        onclick={() => { traceManager.addCalculatedLayer('Avg', id, 'average'); showAddLayerMenu = false; showLayerDropdown = false; }}>
        <span class="material-symbols-outlined text-[12px]">functions</span>
        Calculada
    </button>
</div>
```

---

## Problema 11: Botón colapsar sidebar más visible

### Contexto actual
- El botón es `bg-[#0a0a0c]` con `text-gray-500` — muy oscuro y difícil de ver (L42-44 en +page.svelte)

### Cambio requerido
- Usar un color más visible, como rojo, para el botón
- Mantener la misma estructura y posición

### Archivos a modificar

#### [MODIFY] [+page.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/+page.svelte)

1. Cambiar clases del botón (L42-44):
```svelte
class="absolute z-50 w-5 h-12 flex items-center justify-center
       bg-amber-500 border border-amber-400 rounded-r-lg
       text-white hover:bg-amber-400
       transition-all duration-300 cursor-pointer shadow-lg"
```

---

## Problema 12: Etiquetas de pestañas del sidebar

### Contexto actual
- Labels: `'Med'`, `'EQ'`, `'Inst'`, `'Cfg'` (L710-713)

### Cambio requerido
- Cambiar a: `'MEDIR'`, `'ECUALIZAR'`, `'INSTANTÁNEA'`, `'CONFIG'`

### Archivos a modificar

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. Cambiar el array de tabs (L710-713):
```typescript
{ id: 'medicion', icon: 'podcasts', label: 'MEDIR' },
{ id: 'eq', icon: 'cadence', label: 'ECUALIZAR' },
{ id: 'snaps', icon: 'photo_camera', label: 'INSTANTÁNEA' },
{ id: 'config', icon: 'settings', label: 'CONFIG' },
```

2. Reducir tamaño del texto de la etiqueta de `text-[8px]` a `text-[7px]` para que "INSTANTÁNEA" quepa:
```svelte
<span class="text-[7px] font-bold uppercase tracking-wider leading-none">{tab.label}</span>
```

---

## Problema 13: Tema global completo

### Contexto actual
- `isDarkMode` solo afecta: canvas background (L1146), `drawGrid` colors (L435)
- Sidebar, Header, +page.svelte, todos los componentes usan colores hardcodeados oscuros (`#0a0a0c`, `#050507`, `#121216`, etc.)
- La clase `dark` se aplica a `<html>` via `applyTheme()` pero nadie la usa

### Cambio requerido
- Implementar CSS variables para los tokens de color principales en `layout.css`
- Cambiar los colores hardcodeados a CSS variables en los componentes principales
- Definir valores para modo claro y modo oscuro

### Archivos a modificar

#### [MODIFY] [layout.css](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/layout.css)

1. Agregar CSS variables para los dos temas:
```css
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
    --scrollbar-thumb: #c0c0c8;
    --scrollbar-thumb-hover: #a0a0a8;
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
    --scrollbar-thumb: #1a1a24;
    --scrollbar-thumb-hover: #2a2a35;
}
```

2. Actualizar scrollbar para usar variables:
```css
::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
}
::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
}
* {
    scrollbar-color: var(--scrollbar-thumb) transparent;
}
```

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. Reemplazar colores hardcoded principales:
   - `bg-[#0a0a0c]` → `bg-[var(--bg-secondary)]` o usar style inline `background: var(--bg-secondary)`
   - `bg-[#050507]` → `var(--bg-primary)`
   - `bg-[#121216]` → `var(--bg-tertiary)`
   - `border-[#1a1a24]` → `var(--border-primary)`
   - `text-gray-200` → `var(--text-primary)`
   - `text-gray-500` → `var(--text-muted)`

> [!IMPORTANT]
> Este es el cambio más extenso. Se debe hacer componente por componente, reemplazando solo los colores de fondo, borde y texto principales. NO cambiar los colores de acento (verde, azul, rojo) ni los colores de las métricas.

#### [MODIFY] [Header.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte)
- Mismo patrón de reemplazo de colores.

#### [MODIFY] [+page.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/+page.svelte)
- Mismo patrón de reemplazo de colores.

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)
- Reemplazar `uiStore.isDarkMode ? '#060608' : '#f8f8fa'` por `var(--bg-primary)` (L1146)
- Reemplazar colores hardcoded en header, popovers, menus.

---

## Problema 14: Selector de tipo EQ por botones

### Contexto actual
- Es un `<select>` dropdown (L1261-1269)

### Cambio requerido
- Reemplazar por botones segmentados (como el selector de tema)

### Archivos a modificar

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. Reemplazar el `<select>` (L1256-1269):
```svelte
<div class="flex flex-col gap-1.5">
    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tipo de Ecualizador</label>
    <div class="flex items-center bg-[#121216] border border-[#1a1a24] p-0.5 rounded-lg gap-0.5">
        <button
            class="flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer
                   {eqType === 'grafico' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300'}"
            onclick={() => eqType = 'grafico'}>
            Gráfico
        </button>
        <button
            class="flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer
                   {eqType === 'parametrico' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'text-gray-500 hover:text-gray-300'}"
            onclick={() => eqType = 'parametrico'}>
            Paramétrico
        </button>
    </div>
</div>
```

---

## Problema 15: Tipo de filtro paramétrico como botones con iconos

### Contexto actual
- Es un `<select>` dropdown (L1477-1500)

### Cambio requerido
- Reemplazar por botones con iconos descriptivos (Grid de botones cuadrados)

### Archivos a modificar

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. Reemplazar el `<select>` de tipo de filtro (L1470-1500):
```svelte
<div class="flex flex-col gap-1">
    <label class="text-[9px] text-gray-500 font-bold uppercase">Tipo de Filtro</label>
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
                       {filter.type === type ? 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30' : 'bg-[#121216] text-gray-500 hover:text-gray-300 border border-[#1a1a24]'}"
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

---

## Problema 16: Spinners de inputs numéricos estilizados

### Contexto actual
- Los `<input type="number">` usan el estilo nativo del browser (spinners feos) (L1510-1516, L1543-1553)

### Cambio requerido
- Ocultar los spinners nativos del browser
- Estilizar los inputs numéricos para que se vean consistentes con el tema oscuro
- **Mantener los spinners** pero con colores del tema

### Archivos a modificar

#### [MODIFY] [layout.css](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/layout.css)

1. Agregar estilos para los spinners estilizados:
```css
/* Estilizar spinners nativos de inputs numéricos para tema oscuro */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
    opacity: 1;
    cursor: pointer;
}

input[type="number"] {
    color-scheme: dark;
}

.dark input[type="number"] {
    color-scheme: dark;
}

:root input[type="number"] {
    color-scheme: light;
}
```

> [!NOTE]
> Usar `color-scheme: dark` hace que los spinners nativos se adapten al tema oscuro automáticamente en Chrome/Edge/Firefox, sin necesidad de CSS complejo. La propiedad respeta la cascada del tema.

---

## Problema 17: (Agrupado con P9 y P10) — Ya cubierto

Los problemas de snapshots como capas y opciones del menú agregar capas se cubren en P9 y P10.

---

## Verificación

### Compilación
- Verificar que `npm run dev` no tiene errores después de cada prompt.

### Visual
- Verificar que:
  - El pan hace rebote suave al llegar al límite
  - La grilla muestra hasta ±60 dB
  - El zoom respeta el modo anclado
  - Los cursores cambian según la zona
  - El ID del cuadrante es un watermark grande y semitransparente
  - Los pills reflejan el color y estilo de línea de la métrica
  - El tema claro funciona en toda la interfaz
  - Los spinners no muestran flechas nativas
