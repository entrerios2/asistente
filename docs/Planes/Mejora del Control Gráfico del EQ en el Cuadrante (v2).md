# Mejora del Control Gráfico del EQ en el Cuadrante (v2)

## Referencia de mercado

### FabFilter Pro-Q 3 — Patrones adoptados
- **Floating control panel**: Al seleccionar un nodo, aparece un panel flotante debajo con controles granulares (freq, gain, Q, tipo, slope). Es el patrón estándar de la industria.
- **Ghost curve individual**: Solo el filtro activo muestra su curva individual. Los demás no.
- **Scroll = Q**: La rueda del mouse modifica el Q del nodo bajo hover.
- **Visual feedback inmediato**: Al hover, el nodo cambia de tamaño y muestra parámetros en tiempo real.
- **0dB reference line**: Línea horizontal de referencia visible durante el drag.

### Diferencias con nuestro contexto
- FabFilter usa double-click para crear filtros → **descartado** por decisión del usuario (se crean desde el panel)
- FabFilter usa formas distintas por tipo → usaremos **nodos circulares con ícono SVG** del tipo (ya tenemos los íconos en `filterSvgIcons`)
- FabFilter tiene panel en el **bottom** del gráfico → nosotros usaremos un **popover flotante** sobre el canvas para no ocupar espacio permanente

---

## Propuestas finales

### P1 — Ghost curve del filtro activo

Al hacer **hover o drag** sobre un nodo, dibujar la curva de respuesta **individual** de ese filtro:
- Color: mismo que la curva total (`#fbbf24`) pero con **alpha 0.25** y lineWidth 1.5
- Fill: semitransparente (`rgba(251, 191, 36, 0.04)`) bajo la curva individual
- Se calcula con `biquadResponse()` usando los coeficientes del filtro individual

**Implementación**:
- Nueva función `drawIndividualFilterCurve()` en `canvasRenderers.ts`
- Recibe `coeffs: number[]` del filtro y dibuja la respuesta frequency-by-frequency
- Se invoca desde `quadrantDraw.ts` solo cuando `hoveringEQNode !== null || draggingEQNode !== null`

#### Archivos:
- `canvasRenderers.ts`: nueva función
- `quadrantDraw.ts`: invocación condicional
- `biquad.ts`: usa `getCoeffsForType()` existente

---

### P2 — Nodos circulares con ícono de tipo de filtro

Reemplazar los nodos sólidos actuales con **nodos circulares que contienen el ícono SVG** del tipo de filtro adentro. Esto permite identificar visualmente el tipo sin cambiar la forma del nodo.

**Diseño del nodo**:
```
  ┌─────────┐
  │  ╭───╮  │  Radio: 10px (hover: 12px, drag: 14px)
  │  │ 🔔│  │  Ícono SVG del tipo (peaking/shelf/etc.)
  │  ╰───╯  │  Color del borde: según tipo (tabla abajo)
  └─────────┘  Fondo: rgba del color del tipo, 80%
```

**Paleta de colores por tipo** (solo color, misma forma circular):

| Tipo | Color | Uso |
|---|---|---|
| `peaking` | `#fbbf24` (amarillo) | Campana estándar |
| `low_shelf` | `#f97316` (naranja) | Shelf bajo |
| `high_shelf` | `#a855f7` (púrpura) | Shelf alto |
| `lowpass` | `#ef4444` (rojo) | Corte LP |
| `highpass` | `#3b82f6` (azul) | Corte HP |
| `notch` | `#6b7280` (gris) | Notch/reject |
| `bandpass` | `#10b981` (verde) | Bandpass |

**Implementación**:
- Prerender cada ícono SVG a un `OffscreenCanvas` (uno por tipo) al inicio → cache como `ImageBitmap`
- En el loop de draw, usar `ctx.drawImage(cachedIcon, x - r, y - r, r*2, r*2)` para renderizar sin parsear SVG cada frame

#### Archivos:
- `quadrantDraw.ts`: cambiar loop de dibujo de nodos
- Nuevo helper `eqNodeIcons.ts`: convierte SVGs a ImageBitmap cache

---

### P3 — Tooltip enriquecido

Reemplazar el texto plano actual con un **badge semitransparente** con bordes redondeados, siguiendo el estilo FabFilter:

```
  ┌───────────────────┐
  │ 🔔 #3 Peaking     │  ← Ícono + número + tipo
  │ 1.2kHz   +3.5dB   │  ← Freq + Gain (coloreado)
  │ Q: 2.1             │  ← Q factor
  └───────────────────┘
```

**Características**:
- Background: `rgba(0, 0, 0, 0.85)` con border-radius 4px
- Padding: 6px 8px
- Font: 10px Inter/system-ui (no monospace)
- Gain: verde si positivo, rojo si negativo
- Posición: **encima** del nodo con offset adaptativo (si está cerca del borde superior, se mueve debajo)
- Se muestra en hover y drag

#### Archivos:
- `quadrantDraw.ts`: nueva función `drawEQNodeTooltip()`

---

### P4 — Popover de control al seleccionar nodo (click)

Inspirado en FabFilter: al **hacer click** en un nodo (no solo hover), se muestra un **popover HTML** superpuesto al canvas con controles editables:

```
  ┌─────────────────────────────────┐
  │ Filtro #3                   ✕   │
  │ ┌──────┐ ┌──────┐ ┌──────┐     │
  │ │ Freq │ │ Gain │ │  Q   │     │
  │ │1200Hz│ │+3.5dB│ │ 2.1  │     │
  │ └──────┘ └──────┘ └──────┘     │
  │ Tipo: [▼ Peaking          ]     │
  │                                 │
  │ [Bypass] [Reset] [Eliminar]     │
  └─────────────────────────────────┘
```

**Características**:
- Es un **elemento HTML real** (div) posicionado absolute sobre el canvas, no dibujado en canvas
- Inputs numéricos para freq, gain, Q con step/min/max
- Select para tipo de filtro
- Botones: bypass (togglea gain a 0), reset (todos a default), eliminar filtro
- Se cierra al hacer click fuera, al presionar Escape, o al hacer click en ✕
- Posición: adaptativa según la posición del nodo en el canvas (evita que se salga)

**Implementación**:
- Nuevo componente Svelte `EQNodePopover.svelte` que se monta sobre el canvas
- `Quadrant.svelte` gestiona el estado: `selectedEQNode: number | null`, `popoverPosition: {x, y}`
- Al hacer click en un nodo: se setea `selectedEQNode` y se calcula posición
- El popover escribe directamente a `eqStore.updateBand()`

> [!IMPORTANT]
> El popover es un elemento HTML real, no renderizado en canvas. Esto permite inputs nativos, accesibilidad, y evita tener que reimplementar controles de texto en canvas.

#### Archivos:
- **[NEW]** `EQNodePopover.svelte`: componente del popover
- `Quadrant.svelte`: estado `selectedEQNode`, handler de click, posicionamiento

---

### P5 — Control de Q con scroll

Mientras se hace **hover** sobre un nodo:
- **Scroll up** → Q sube (banda más estrecha)
- **Scroll down** → Q baja (banda más ancha)
- Step: 0.1 por notch
- Rango: [0.1, 20]
- Solo en modo **paramétrico** (en gráfico el Q es calculado automáticamente)
- Feedback: pulso de opacidad del nodo al cambiar Q + tooltip actualizado en tiempo real

**Implementación**:
- Interceptar `wheel` event en `Quadrant.svelte` cuando `hoveringEQNode !== null`
- Llamar a `eqStore.updateBand(hoveringEQNode, 'q', newQ)`
- Prevent default del scroll del panel cuando se está sobre un nodo

#### Archivos:
- `Quadrant.svelte`: handler `handleWheel()`, `e.preventDefault()` condicional

---

### P6 — Guías visuales durante drag

Al arrastrar un nodo, mostrar guías de referencia:

1. **Línea horizontal 0dB**: trazo punteado gris (`#ffffff20`, dash 4-4)
2. **Línea vertical en freq actual**: trazo punteado (`#ffffff15`, dash 3-3)
3. **Readout en cursor**: texto pequeño junto al cursor mostrando `freq | gain` en tiempo real

**Snap opcional** (con tecla Shift presionada):
- Snap a frecuencias ISO 1/3 octava: 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1k, 1.25k, 1.6k, 2k, 2.5k, 3.15k, 4k, 5k, 6.3k, 8k, 10k, 12.5k, 16k, 20k
- Snap a gain en steps de 0.5dB (con Ctrl)
- Indicador visual: línea vertical más brillante cuando snap está activo

#### Archivos:
- `quadrantDraw.ts`: nuevas funciones para guías y readout
- `Quadrant.svelte`: detectar Shift/Ctrl para snap, pasar `isShiftHeld` al draw params

---

## Orden de implementación sugerido

| Paso | Propuesta | Complejidad | Descripción |
|---|---|---|---|
| 1 | **P2** | Media | Nodos con ícono + colores por tipo |
| 2 | **P3** | Baja | Tooltip enriquecido (canvas) |
| 3 | **P1** | Media | Ghost curve del filtro activo |
| 4 | **P5** | Baja | Q con scroll |
| 5 | **P4** | Alta | Popover HTML de control |
| 6 | **P6** | Media | Guías de drag + snap |

## Archivos involucrados

| Archivo | Propuestas |
|---|---|
| [quadrantDraw.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/quadrantDraw.ts) | P1, P2, P3, P6 |
| [canvasRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts) | P1, P6 |
| [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte) | P4, P5, P6 |
| **[NEW]** `EQNodePopover.svelte` | P4 |
| **[NEW]** `eqNodeIcons.ts` | P2 |
| [eqStore.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/eqStore.svelte.ts) | P4 (bypass, remove) |
| [biquad.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/biquad.ts) | P1 (coeficientes individuales) |

## Verificación

- TypeScript: `npx tsc --noEmit` sin errores nuevos
- Visual: verificar que los nodos, tooltips y popover se rendericen correctamente
- Interacción: drag sin conflicto con zoom/pan, scroll Q sin scroll del panel
- Performance: ghost curve no debe impactar el frame rate (usa `biquadResponse` que ya es O(BINS))
