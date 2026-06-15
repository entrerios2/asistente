# Prompts de Gaps Pendientes — Phase 2A.4

> **REGLA GLOBAL PARA EL AGENTE:** Ejecutá **ÚNICAMENTE** el prompt que se te indique. **NO avances** al siguiente prompt. **NO modifiques** archivos que no estén listados en el prompt. Al finalizar, ejecutá `npm run build` y reportá el resultado. Si el build falla, corregí los errores antes de declarar completado.

---

## Prompt G1: Checkboxes de Auto-guardar y Vincular Generador en el Sidebar

**Objetivo:** Agregar dos checkboxes a la pestaña "Medición" del Sidebar para automatizar el flujo de medición manual.

**Archivo a modificar:** `src/components/medicion/Sidebar.svelte`

### Contexto

En `src/lib/stores/ui.svelte.ts` ya existen estos estados reactivos (buscar en el archivo para confirmar las líneas exactas):

```typescript
autoSaveSnapshotOnStop = $state(false);
linkGeneratorToMeasurement = $state(false);
```

Actualmente **no tienen UI**. Deben aparecer como checkboxes en la sección de controles de medición manual del Sidebar (pestaña `medicion`).

### Instrucciones

1. **Buscar** en `Sidebar.svelte` la sección de la pestaña `medicion` que contiene el botón "Medir" / "Detener". El patrón a buscar es:

```svelte
{:else if uiStore.activeTab === "medicion"}
```

2. **Dentro de esa sección**, buscar el área donde están los controles de medición (cerca de los botones de Medir/Detener). **Después** de los botones principales de control y **antes** de la sección de generador de señal, insertar exactamente este bloque:

```svelte
<!-- AUTOMATIZACIÓN DE MEDICIÓN (F27) -->
<div class="flex flex-col gap-2 bg-[#121216]/40 border border-[#1a1a24]/50 rounded-xl p-3 mt-3">
    <div class="flex items-center gap-2 border-b border-[#1a1a24]/30 pb-1.5">
        <span class="material-symbols-outlined text-[#a855f7] text-sm">bolt</span>
        <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Automatización</h3>
    </div>

    <label class="flex items-center gap-2.5 cursor-pointer group py-1">
        <input
            type="checkbox"
            bind:checked={uiStore.autoSaveSnapshotOnStop}
            class="w-4 h-4 rounded accent-[#a855f7] cursor-pointer"
        />
        <div class="flex flex-col">
            <span class="text-xs text-gray-200 font-semibold group-hover:text-white transition-colors select-none">
                Auto-guardar al detener
            </span>
            <span class="text-[9px] text-gray-500">
                Guarda instantánea automática al pulsar Detener
            </span>
        </div>
    </label>

    <label class="flex items-center gap-2.5 cursor-pointer group py-1">
        <input
            type="checkbox"
            bind:checked={uiStore.linkGeneratorToMeasurement}
            class="w-4 h-4 rounded accent-[#a855f7] cursor-pointer"
        />
        <div class="flex flex-col">
            <span class="text-xs text-gray-200 font-semibold group-hover:text-white transition-colors select-none">
                Vincular Generador al medir
            </span>
            <span class="text-[9px] text-gray-500">
                Enciende/apaga el generador junto con la medición
            </span>
        </div>
    </label>
</div>
```

3. **NO implementes la lógica** de auto-guardado ni de vinculación del generador — eso se hará en otro prompt. Solo agregá los checkboxes que escriben los flags en el `uiStore`.

### Validación
1. `npm run build` debe compilar sin errores.
2. Abrir la app, ir a la pestaña "Med" del sidebar.
3. Los dos checkboxes deben aparecer y cambiar `uiStore.autoSaveSnapshotOnStop` y `uiStore.linkGeneratorToMeasurement`.

### Límite Estricto
- **SOLO** modificá `Sidebar.svelte`.
- **NO** modifiques `ui.svelte.ts` (los estados ya existen).
- **NO** implementes la lógica de auto-save ni de link-generator.
- **NO** avances al Prompt G2.

---

## Prompt G2: Lógica de Auto-guardar y Vincular Generador

**Objetivo:** Conectar los flags `autoSaveSnapshotOnStop` y `linkGeneratorToMeasurement` a la lógica de medición.

**Archivo a modificar:** `src/components/medicion/Sidebar.svelte`

### Contexto

En `Sidebar.svelte` hay un handler que se ejecuta al pulsar "Detener" la medición. Buscar una función o handler `onclick` asociado al botón de Detener. Típicamente contiene lógica como:

```typescript
// Patrón a buscar (aproximado):
function stopMeasurement() { ... }
// o un onclick inline en el botón Detener
```

También hay un handler para "Medir" que inicia la captura.

### Instrucciones

1. **Buscar el handler de "Detener"** en `Sidebar.svelte`. Agregar al final del handler, **antes del cierre de la función**:

```typescript
// Auto-guardar instantánea al detener (F27)
if (uiStore.autoSaveSnapshotOnStop) {
    // Reutilizar la lógica existente de "Tomar Instantánea"
    // Buscar la función que se ejecuta al pulsar el botón de snapshot
    // y llamarla aquí. Si se llama takeSnapshot(), agregarla:
    takeSnapshot();
}

// Apagar generador si está vinculado (F27)
if (uiStore.linkGeneratorToMeasurement) {
    uiStore.isGenerating = false;
}
```

2. **Buscar el handler de "Medir"** (que inicia la captura). Agregar al inicio del handler:

```typescript
// Encender generador si está vinculado (F27)
if (uiStore.linkGeneratorToMeasurement && !uiStore.isGenerating) {
    uiStore.isGenerating = true;
}
```

> **NOTA:** Los nombres exactos de las funciones (`stopMeasurement`, `takeSnapshot`, `startMeasurement`, `uiStore.isGenerating`) pueden variar. Leé el código existente del Sidebar para usar los nombres correctos. Lo importante es:
> - Al detener: auto-guardar snapshot + apagar generador
> - Al medir: encender generador

### Validación
1. `npm run build` sin errores.
2. Activar ambos checkboxes (G1), pulsar Medir → generador se enciende. Pulsar Detener → generador se apaga + snapshot aparece en la lista.

### Límite Estricto
- **SOLO** modificá `Sidebar.svelte`.
- **NO** modifiques `ui.svelte.ts`, `mathOrchestrator.svelte.ts`, ni `traceManager.svelte.ts`.
- **NO** avances al Prompt G3.

---

## Prompt G3: Spectrogram con ImageData en vez de fillRect

**Objetivo:** Reemplazar el rendering pixel-by-pixel del espectrograma por `ImageData` + `putImageData()` para reducir de ~800 llamadas a `fillRect` por fila a 1 sola llamada.

**Archivo a modificar:** `src/lib/dsp/canvasRenderers.ts`

### Contexto

La función `drawSpectrogram` en `canvasRenderers.ts` (línea ~190) actualmente dibuja cada barra del espectrograma con `ctx.fillRect()` individual (líneas ~245, ~262). Cada cambio de `fillStyle` + `fillRect` es una llamada al API de Canvas.

### Instrucciones

1. **Buscar** la función `drawSpectrogram` (línea ~190). Verificar su firma actual y el loop de dibujo.

2. **Al inicio de la función**, después de los early returns, agregar la creación del ImageData:

```typescript
// Pre-alocar ImageData para dibujo batch (una fila del espectrograma)
const rowImageData = ctx.createImageData(width, 1);
const rowPixels = rowImageData.data; // Uint8ClampedArray (RGBA)
```

3. **Reemplazar el loop** que usa `fillRect` por un loop que escribe en `rowPixels` y usa `putImageData`:

```typescript
// Para cada fila del historial del espectrograma:
for (let row = 0; row < history.length; row++) {
    const spectrum = history[row];
    const yRow = height - row * barHeight;
    if (yRow < 0) break;

    // Escribir píxeles de la fila completa en el ImageData
    for (let x = 0; x < width; x++) {
        const binIndex = frequencyLUT[x];
        if (binIndex === undefined || binIndex >= spectrum.length) {
            // Píxel transparente
            const offset = x * 4;
            rowPixels[offset] = 0;
            rowPixels[offset + 1] = 0;
            rowPixels[offset + 2] = 0;
            rowPixels[offset + 3] = 0;
            continue;
        }

        const val = spectrum[binIndex];
        // Normalizar valor dB a 0-1 (asumiendo rango -100 a 0 dB)
        const normalized = Math.max(0, Math.min(1, (val + 100) / 100));

        // Obtener color de la paleta (la función getPaletteColor ya existe)
        const [r, g, b] = getPaletteColor(normalized, palette);

        const offset = x * 4;
        rowPixels[offset] = r;
        rowPixels[offset + 1] = g;
        rowPixels[offset + 2] = b;
        rowPixels[offset + 3] = 255; // Opacidad completa
    }

    // Dibujar la fila completa de una sola vez
    ctx.putImageData(rowImageData, 0, yRow);
}
```

> **NOTA:** Adaptá este código a la estructura real del loop actual. Los nombres de variables (`history`, `barHeight`, `frequencyLUT`, `palette`) pueden diferir. Lo importante es:
> 1. Crear `ImageData` una vez fuera del loop
> 2. Escribir píxeles RGBA en el loop interno
> 3. Llamar `putImageData` una vez por fila (en vez de N `fillRect` por fila)

4. **Si `getPaletteColor` no existe como función separada**, extraela del código inline actual. La paleta probablemente ya se resuelve con `colorPalettes.ts`. Verificá si hay un import o una función inline que convierte valor dB → color RGB.

### Validación
1. `npm run build` sin errores.
2. Abrir la app, seleccionar "Spectrogram" como métrica.
3. El espectrograma debe verse igual que antes (mismo color, misma orientación).
4. En DevTools > Performance, la cantidad de llamadas a `fillRect` por frame debe reducirse drásticamente.

### Límite Estricto
- **SOLO** modificá `canvasRenderers.ts`.
- **NO** modifiques `Quadrant.svelte`, `osmMetrics.ts`, ni `colorPalettes.ts`.
- **NO** avances al Prompt G4.

---

## Prompt G4: Canvas responsive al tema claro/oscuro

**Objetivo:** Hacer que las funciones de dibujo del canvas (`drawGrid`, `drawAxes`, `drawCrosshair`, etc.) respondan reactivamente a `uiStore.isDarkMode` para que el tema claro sea legible.

**Archivo a modificar:** `src/lib/dsp/canvasRenderers.ts`
**Archivo secundario:** `src/components/medicion/Quadrant.svelte` (solo pasar `isDarkMode` como parámetro)

### Instrucciones

1. **En `canvasRenderers.ts`**, buscar la función `drawGrid`. Actualmente usa colores hardcoded como `#1a1a24` (grilla oscura), `#333` (ejes), etc.

2. **Agregar un parámetro `isDarkMode: boolean`** a la firma de `drawGrid`:

```typescript
export function drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    // ... otros params existentes ...,
    isDarkMode: boolean  // NUEVO
) {
```

3. **Al inicio de `drawGrid`**, definir las constantes de color por tema:

```typescript
const theme = isDarkMode ? {
    gridLine: 'rgba(255, 255, 255, 0.04)',
    gridLineMajor: 'rgba(255, 255, 255, 0.08)',
    axisLabel: 'rgba(255, 255, 255, 0.35)',
    axisLine: '#333',
    background: '#060608',
} : {
    gridLine: 'rgba(0, 0, 0, 0.06)',
    gridLineMajor: 'rgba(0, 0, 0, 0.12)',
    axisLabel: 'rgba(0, 0, 0, 0.55)',
    axisLine: '#999',
    background: '#f8f8fa',
};
```

4. **Reemplazar** todos los colores hardcoded de grilla, ejes y labels por las variables del `theme`. Buscar y reemplazar:
   - Colores de `strokeStyle` para líneas de grilla → `theme.gridLine` o `theme.gridLineMajor`
   - Colores de `fillStyle` para labels de ejes → `theme.axisLabel`
   - Colores de bordes o ejes → `theme.axisLine`

5. **En `Quadrant.svelte`**, buscar donde se llama a `drawGrid(...)` (línea ~423) y agregar `uiStore.isDarkMode` como último argumento:

```typescript
// ANTES:
drawGrid(ctx, width, height, hasTimeDomainActive, activeMetrics, metricConfigs, interactionState);

// DESPUÉS:
drawGrid(ctx, width, height, hasTimeDomainActive, activeMetrics, metricConfigs, interactionState, uiStore.isDarkMode);
```

6. **En `Quadrant.svelte`**, buscar la clase CSS del contenedor `.quadrant-container` (línea ~1657-1660). Probablemente tiene `background: #060608` hardcoded. Cambiarlo a reactivo:

```svelte
<!-- Buscar el div con class="quadrant-container" y agregar: -->
<div class="quadrant-container"
     style="background: {uiStore.isDarkMode ? '#060608' : '#f8f8fa'}">
```

### Validación
1. `npm run build` sin errores.
2. Abrir la app, ir a Config > Tema Visual, cambiar a modo claro.
3. Los ejes, grilla y labels del canvas deben ser legibles (texto oscuro sobre fondo claro).
4. Cambiar de vuelta a oscuro — todo debe verse como antes.

### Límite Estricto
- **SOLO** modificá `canvasRenderers.ts` y los puntos especificados en `Quadrant.svelte`.
- **NO** modifiques `Sidebar.svelte`, `Header.svelte`, ni `ui.svelte.ts`.
- **NO** avances al Prompt G5.

---

## Prompt G5: Drag & Drop de capas entre cuadrantes

**Objetivo:** Permitir arrastrar el badge/pill de una capa desde la cabecera de un cuadrante y soltarlo en otro cuadrante para moverla.

**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

### Contexto

- `traceManager.moveLayer(layerId, targetQuadrantId)` ya existe en `traceManager.svelte.ts`.
- Cada Quadrant tiene un `id` pasado como prop.
- Las capas del cuadrante se obtienen con `myLayers` (derivado en L114).
- En la cabecera del Quadrant hay badges/pills de métricas. Las capas pueden mostrarse en el HUD (L1302+).

### Instrucciones

1. **Buscar el HUD de capas** en `Quadrant.svelte` (línea ~1302, comentario `<!-- HUD DE CAPAS -->`). En la lista de capas del HUD, cada item de capa necesita atributos de drag:

```svelte
<!-- Agregar atributos draggable a cada pill/badge de capa en el HUD: -->
{#each myLayers as layer, li}
    <div
        class="... clases existentes ..."
        draggable="true"
        ondragstart={(e) => {
            e.dataTransfer?.setData('text/plain', layer.id);
            e.dataTransfer!.effectAllowed = 'move';
        }}
    >
        <!-- contenido existente del pill -->
    </div>
{/each}
```

2. **En el contenedor principal del Quadrant** (el `<div class="quadrant-container">`, línea ~1657 aprox. en el markup), agregar los handlers de drop:

```svelte
<div class="quadrant-container"
     ondragover={(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; }}
     ondragenter={(e) => { e.preventDefault(); e.currentTarget.style.outline = '2px solid #00ff88'; }}
     ondragleave={(e) => { e.currentTarget.style.outline = 'none'; }}
     ondrop={(e) => {
         e.preventDefault();
         e.currentTarget.style.outline = 'none';
         const layerId = e.dataTransfer?.getData('text/plain');
         if (layerId) {
             traceManager.moveLayer(layerId, id);
         }
     }}
>
```

> **NOTA:** El `id` en `traceManager.moveLayer(layerId, id)` es el prop del Quadrant (ej: `'q-1'`, `'q-2'`).

3. **NO** modifiques `traceManager.svelte.ts` — `moveLayer` ya existe.

### Validación
1. `npm run build` sin errores.
2. Abrir la app con layout 2x1 (dos cuadrantes).
3. En el HUD de capas del cuadrante 1, arrastrar una capa y soltarla sobre el cuadrante 2.
4. La capa debe desaparecer del cuadrante 1 y aparecer en el cuadrante 2.
5. El borde verde aparece al entrar y desaparece al salir/soltar.

### Límite Estricto
- **SOLO** modificá `Quadrant.svelte`.
- **NO** modifiques `traceManager.svelte.ts`, `Sidebar.svelte`, ni `canvasRenderers.ts`.
- **NO** avances al Prompt G6.

---

## Prompt G6: Calculated Layer — Store (F28 Parte 1)

**Objetivo:** Agregar la infraestructura de "Capa Calculada" al `traceManager` para que pueda promediar las capas visibles de un cuadrante.

**Archivo a modificar:** `src/lib/stores/traceManager.svelte.ts`

### Contexto

Una "Capa Calculada" es una capa virtual cuyo `data` no proviene de una medición directa sino del resultado de una operación matemática (promedio, diferencia, etc.) sobre las demás capas visibles del mismo cuadrante.

### Instrucciones

1. **Buscar la interfaz `MeasurementLayer`** en `traceManager.svelte.ts`. Agregar el campo `isCalculated`:

```typescript
export interface MeasurementLayer {
    // ... campos existentes ...
    isCalculated?: boolean;        // true = capa virtual calculada
    calcOperation?: 'average' | 'sum' | 'subtract' | 'min' | 'max';  // Operación
    calcTargetMetrics?: string[];  // Métricas sobre las que calcular (vacío = todas)
}
```

2. **Agregar un método** `addCalculatedLayer` a la clase `TraceManager`:

```typescript
addCalculatedLayer(name: string, quadrantId: string, operation: 'average' | 'sum' | 'subtract' | 'min' | 'max' = 'average'): string {
    const id = `calc-${Date.now()}`;
    this.layers.push({
        id,
        name,
        visible: true,
        isMeasuring: false,
        quadrantId,
        sourceType: 'live',
        data: new Float32Array(0),
        isCalculated: true,
        calcOperation: operation,
        calcTargetMetrics: ['Magnitude'],
    });
    return id;
}
```

3. **Agregar un método** `updateCalculatedLayers` que recalcula los datos de todas las capas calculadas:

```typescript
updateCalculatedLayers(): void {
    for (const layer of this.layers) {
        if (!layer.isCalculated || !layer.visible) continue;

        // Obtener capas fuente: mismo quadrantId, visibles, NO calculadas
        const sources = this.layers.filter(l =>
            l.quadrantId === layer.quadrantId &&
            l.visible &&
            !l.isCalculated &&
            l.data.length > 0
        );

        if (sources.length === 0) {
            layer.data = new Float32Array(0);
            continue;
        }

        const bins = sources[0].data.length;
        const result = new Float32Array(bins);

        switch (layer.calcOperation) {
            case 'average': {
                for (let k = 0; k < bins; k++) {
                    let sum = 0;
                    for (const src of sources) {
                        sum += src.data[k] || 0;
                    }
                    result[k] = sum / sources.length;
                }
                break;
            }
            case 'sum': {
                for (let k = 0; k < bins; k++) {
                    for (const src of sources) {
                        result[k] += src.data[k] || 0;
                    }
                }
                break;
            }
            case 'min': {
                result.fill(Infinity);
                for (let k = 0; k < bins; k++) {
                    for (const src of sources) {
                        if ((src.data[k] || 0) < result[k]) result[k] = src.data[k];
                    }
                }
                break;
            }
            case 'max': {
                result.fill(-Infinity);
                for (let k = 0; k < bins; k++) {
                    for (const src of sources) {
                        if ((src.data[k] || 0) > result[k]) result[k] = src.data[k];
                    }
                }
                break;
            }
            case 'subtract': {
                if (sources.length >= 2) {
                    for (let k = 0; k < bins; k++) {
                        result[k] = (sources[0].data[k] || 0) - (sources[1].data[k] || 0);
                    }
                }
                break;
            }
        }

        if (layer.data.length !== bins) {
            layer.data = new Float32Array(bins);
        }
        layer.data.set(result);
    }
}
```

4. **NO** agregues UI ni llames a `updateCalculatedLayers` desde ningún sitio todavía — eso se hará en G7.

### Validación
1. `npm run build` sin errores.
2. En la consola del navegador, ejecutar:
   ```javascript
   traceManager.addCalculatedLayer('Promedio', 'q-1', 'average')
   ```
   No debe dar error.

### Límite Estricto
- **SOLO** modificá `traceManager.svelte.ts`.
- **NO** modifiques `Quadrant.svelte`, `Sidebar.svelte`, ni `mathOrchestrator.svelte.ts`.
- **NO** avances al Prompt G7.

---

## Prompt G7: Calculated Layer — UI e Integración (F28 Parte 2)

**Objetivo:** Agregar un botón "Agregar Capa Calculada" al HUD de capas del Quadrant e integrar la actualización automática.

**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`
**Archivo secundario:** `src/lib/stores/mathOrchestrator.svelte.ts`

### Instrucciones

1. **En `Quadrant.svelte`**, buscar el HUD de capas (línea ~1302, comentario `<!-- HUD DE CAPAS -->`). **Después** de la lista de capas, agregar un botón para crear una capa calculada:

```svelte
<!-- Botón para agregar capa calculada -->
<button
    class="flex items-center gap-1 text-[9px] text-gray-500 hover:text-[#a855f7] transition-colors cursor-pointer mt-1 px-1 py-0.5 rounded hover:bg-[#a855f7]/5"
    onclick={() => traceManager.addCalculatedLayer('Avg', id, 'average')}
    title="Agregar capa calculada (promedio de capas visibles)"
>
    <span class="material-symbols-outlined text-[12px]">functions</span>
    <span>+ Calculada</span>
</button>
```

2. **En `Quadrant.svelte`**, en el draw loop (función `draw()`), agregar una llamada a `updateCalculatedLayers` **antes** de dibujar las capas. Buscar la zona donde se inicia el dibujo (después de `ctx.clearRect`) y agregar:

```typescript
// Actualizar capas calculadas antes de dibujar
traceManager.updateCalculatedLayers();
```

3. **En el HUD de capas**, las capas calculadas deben tener un estilo visual diferente. En el `{#each myLayers as layer}`, agregar una clase condicional:

```svelte
<!-- Dentro del pill de cada capa en el HUD, agregar indicador visual: -->
{#if layer.isCalculated}
    <span class="text-[8px] text-[#a855f7] font-mono">∑</span>
{/if}
```

4. **En el draw loop**, las capas calculadas deben dibujarse con estilo especial. Buscar el for loop que itera `myLayers` (línea ~527). Dentro del loop, **después de** `if (layer.isMeasuring) continue;`, agregar:

```typescript
// Estilo especial para capas calculadas
if (layer.isCalculated) {
    ctx.globalAlpha = 0.9;
    ctx.setLineDash([4, 2, 1, 2]); // Trazo distintivo
}
```

Y después de dibujar (después de `ctx.globalAlpha = 1.0;`), agregar:

```typescript
if (layer.isCalculated) {
    ctx.setLineDash([]);
}
```

### Validación
1. `npm run build` sin errores.
2. Abrir la app. En el HUD de capas, clic en "+ Calculada".
3. Debe aparecer una capa con símbolo ∑.
4. Si hay otras capas con datos, la capa calculada debe mostrar el promedio.

### Límite Estricto
- **SOLO** modificá `Quadrant.svelte`.
- **NO** modifiques `traceManager.svelte.ts` (ya se hizo en G6), `Sidebar.svelte`, ni `canvasRenderers.ts`.
- **NO** avances al Prompt G8.

---

## Prompt G8: WebFFT como motor FFT en el Worker

**Objetivo:** Integrar WebFFT (`IQEngine/WebFFT`) como motor FFT principal en el DSP Worker para acelerar los cálculos.

**Archivo a modificar:** `src/lib/dsp/dspWorker.ts`

### Contexto

- `webfft` ya está preparado como dependencia opcional en `fft.ts` (línea ~6-11) con carga dinámica.
- El worker actualmente usa funciones de `osmMetrics.ts` que internamente llaman a `fft()` / `ifft()` del módulo `fft.ts`.
- `fft.ts` ya tiene un `webfftInstance` que puede delegar a WebFFT si está disponible.

### Instrucciones

1. **Primero, verificar si `webfft` está instalado** ejecutando `npm list webfft`. Si NO está instalado, ejecutar:

```bash
npm install webfft
```

2. **En `dspWorker.ts`**, al inicio del archivo (después de los imports existentes), agregar la inicialización de WebFFT:

```typescript
// WebFFT: motor FFT acelerado (WASM/GPU)
let webfftEngine: any = null;
let webfftSize = 0;

async function initWebFFT(fftSize: number): Promise<void> {
    try {
        const { default: WebFFT } = await import('webfft');
        webfftEngine = new WebFFT(fftSize);
        await webfftEngine.profile();
        webfftSize = fftSize;
        console.log('[dspWorker] WebFFT initialized:', webfftEngine.toString());
    } catch (e) {
        console.warn('[dspWorker] WebFFT not available, using Radix-2 fallback:', e);
        webfftEngine = null;
    }
}
```

3. **En la sección donde se recibe el mensaje de configuración** (buscar `onmessage` o `self.onmessage` y el handler que procesa `fftSize`), agregar la llamada a `initWebFFT`:

```typescript
// Dentro del handler que recibe el fftSize del main thread:
if (data.fftSize && data.fftSize !== webfftSize) {
    initWebFFT(data.fftSize);
}
```

4. **En el pipeline de FFT del worker**, buscar donde se llama a `fft()` para transformar las señales de entrada. Antes de esa llamada, agregar la opción de usar WebFFT:

```typescript
// Si WebFFT está disponible, usarlo para la FFT forward:
if (webfftEngine && webfftEngine.size === BINS * 2) {
    // WebFFT espera un Float32Array interleaved [re0, im0, re1, im1, ...]
    const interleaved = new Float32Array(BINS * 2 * 2);
    for (let i = 0; i < BINS * 2; i++) {
        interleaved[i * 2] = fftInputReal[i];
        interleaved[i * 2 + 1] = fftInputImag[i];
    }
    const result = webfftEngine.fft(interleaved);
    for (let i = 0; i < BINS * 2; i++) {
        fftInputReal[i] = result[i * 2];
        fftInputImag[i] = result[i * 2 + 1];
    }
} else {
    // Fallback: usar fft() de fft.ts (Radix-2)
    fft(fftInputReal, fftInputImag);
}
```

> **NOTA IMPORTANTE:** Verificá el formato exacto de entrada/salida de WebFFT antes de implementar. Puede requerir interleaved complex o arrays separados. Consultá la documentación en https://github.com/IQEngine/WebFFT. Si el formato difiere del ejemplo, adaptalo.

### Validación
1. `npm run build` sin errores.
2. Abrir la app con la consola abierta. Verificar que aparece `[dspWorker] WebFFT initialized: ...`.
3. Las curvas deben verse idénticas a antes (mismos datos).
4. Si WebFFT no carga (import falla), debe caer al fallback Radix-2 sin romper nada.

### Límite Estricto
- **SOLO** modificá `dspWorker.ts`.
- **NO** modifiques `fft.ts`, `osmMetrics.ts`, ni `mathOrchestrator.svelte.ts`.
- **NO** avances a otros prompts.
