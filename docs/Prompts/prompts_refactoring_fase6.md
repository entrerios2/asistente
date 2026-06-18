# Prompts de Implementación — Fase 6: Correcciones Post-Auditoría y Extracción del Draw Pipeline

Este documento contiene instrucciones atómicas para ejecutar la Fase 6 del refactoring. El proyecto es una SPA SvelteKit con Svelte 5 runes (`$state`, `$derived`, `$effect`).

## ⛔ REGLAS OBLIGATORIAS — Leer antes de empezar

1. **NO AVANCES al siguiente Grupo (A→B→C→D) sin recibir aprobación explícita del usuario.** Al terminar cada grupo, reporta lo hecho y ESPERA instrucciones.
2. **NO MODIFIQUES archivos que no estén explícitamente listados en la tarea.** Si descubrís que se necesita un cambio adicional, reportalo y esperá aprobación.
3. **NO AGREGUES funcionalidad nueva** que no esté especificada en la tarea. No refactorices código adyacente "de paso". No agregues logs, tests, ni comentarios extra.
4. **NO ELIMINES comentarios existentes** a menos que la tarea lo indique expresamente.
5. **NO CAMBIES la lógica de negocio** salvo que la tarea lo especifique. Los cambios son estructurales/mecánicos.
6. **Verificá con `npm run build` al final de cada grupo.** Si falla, corregí solo lo necesario para que compile sin inventar soluciones propias.
7. **Si algo no queda claro, PREGUNTÁ** en vez de asumir.

---

# GRUPO A — Fixes rápidos (sin dependencias entre sí)

---

## Tarea A1: Eliminar doble renderizado de Impulse/Step

**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

**Contexto:** `drawTimeDomainPath` se llama DOS VECES para Impulse y Step en el draw loop:
- Primera vez: ~L664-697 (etiquetado `// 4. Renderizar métricas que no son capas o son globales (Impulse, Step)`)
- Segunda vez: ~L794-826 (fuera del loop de capas, como métricas stand-alone)

Ambos bloques son **idénticos**. El resultado es doble opacidad visual + doble overhead de canvas.

**Instrucción:** Eliminar el PRIMER bloque completo (~L664-697). Buscar este bloque exacto y eliminarlo:

```
        // 4. Renderizar métricas que no son capas o son globales (Impulse, Step)
        if (activeMetrics.includes("Impulse") && hasTimeDomainActive) {
            const style = metricStyles["Impulse"];
            drawTimeDomainPath(
                ctx,
                interpEngine.interpImpulse,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Impulse",
                interactionState,
                getImpulseValueInterpolated,
                hasTimeDomainActive
            );
        }

        if (activeMetrics.includes("Step") && hasTimeDomainActive) {
            const style = metricStyles["Step"];
            drawTimeDomainPath(
                ctx,
                interpEngine.interpStep,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Step",
                interactionState,
                getImpulseValueInterpolated,
                hasTimeDomainActive
            );
        }
```

**IMPORTANTE:** NO eliminar el segundo bloque (~L794-826) que dice lo mismo pero está ubicado después de las métricas de frecuencia (Simulated Magnitude, Spectrum, Phase, etc.). Ese es el correcto.

---

## Tarea A2: Asegurar inicialización de eqStore al arranque

**Archivo a modificar:** `src/routes/+page.svelte`

**Instrucción:** Agregar un import de side-effect al inicio del bloque `<script>`, después del import de `loadConfig`:

```diff
 import { loadConfig, saveConfig } from "$lib/utils/configPersistence";
+import '$lib/stores/eqStore.svelte';  // Asegura inicialización del $effect.root
```

---

## Tarea A3: Eliminar interface `Trace` residual

**Archivo a modificar:** `src/lib/dsp/canvasRenderers.ts`

**Instrucción:** Eliminar las líneas 16-19:

```diff
-interface Trace {
-    id: string;
-    data: Float32Array;
-}
```

Verificar que no queden referencias a `Trace` en el archivo.

---

## Tarea A4: Hacer `hReal`/`hImag` reactivos con `$state.raw`

**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`

**Instrucción:** Buscar las declaraciones (~L34-35):

```diff
-    hReal = new Float32Array(this.BINS);
-    hImag = new Float32Array(this.BINS);
+    hReal = $state.raw(new Float32Array(this.BINS));
+    hImag = $state.raw(new Float32Array(this.BINS));
```

---

## Tarea A5: Eliminar `console.log` de producción en dspWorker

**Archivo a modificar:** `src/lib/dsp/dspWorker.ts`

**Instrucción:** Buscar (~L23):

```diff
-        console.log('[dspWorker] WebFFT initialized:', webfftEngine.toString());
```

**NOTA:** NO eliminar el `console.warn` de L25 — ese es relevante para debug de fallback.

---

## Verificación Grupo A

```bash
npm run build
```

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo B.

---

# GRUPO B — Tipado de `metricConfigs`

---

## Tarea B1: Crear interface `MetricConfig` en quadrantState.ts

**Archivo a modificar:** `src/lib/dsp/quadrantState.ts`

**Instrucción:**

### Paso 1: Agregar la interface después de `MetricStyle` (~L107)

```typescript
export interface MetricConfig {
    // Magnitude/Spectrum/Simulated Magnitude
    modeY?: 'dB' | 'Linear' | 'Impedance';
    sensorResistance?: number;
    smoothingPPO?: number;
    invertY?: boolean;
    enableCoherence?: boolean;
    coherenceThreshold?: number;
    yShift?: number;
    hidden?: boolean;
    // Phase
    unwrapMode?: '±180' | '±360' | 'Unwrap';
    rotate?: number;
    range?: number;
    // Coherence
    cohType?: string;
    showThresholdLine?: boolean;
    thresholdColor?: string;
    thresholdValue?: number;
    // Spectrogram
    palette?: PaletteType;
}
```

### Paso 2: Cambiar el tipo del export existente

```diff
-export const defaultMetricConfigs: Record<string, any> = {
+export const defaultMetricConfigs: Record<string, MetricConfig> = {
```

---

## Tarea B2: Reemplazar `Record<string, any>` por `Record<string, MetricConfig>` en canvasRenderers.ts

**Archivo a modificar:** `src/lib/dsp/canvasRenderers.ts`

**Instrucción:**

### Paso 1: Agregar import

Al inicio del archivo, después del import existente de `canvasInteraction`:

```diff
 import {
     valToX,
     valToY,
     xToVal,
     yToVal,
     timeMin,
     timeMax,
     dbMin,
     dbMax,
     freqMin,
     freqMax,
     type InteractionState
 } from './canvasInteraction';
 import { palettes, type PaletteType } from './colorPalettes';
+import { type MetricConfig } from './quadrantState';
```

### Paso 2: Reemplazar TODAS las ocurrencias

En todo el archivo, reemplazar:

```
metricConfigs: Record<string, any>
```

por:

```
metricConfigs: Record<string, MetricConfig>
```

Hay **7 ocurrencias** en las firmas de: `drawGrid`, `drawMetricPath`, `drawSpectrumPath`, `drawSimulatedMagnitudePath`, `drawPhasePath`, `drawPhaseDelay`, `drawEQOverlayPath`.

---

## Tarea B3: Reemplazar `Record<string, any>` en canvasInteraction.ts

**Archivo a modificar:** `src/lib/dsp/canvasInteraction.ts`

**Instrucción:**

### Paso 1: Agregar import al inicio del archivo

```typescript
import { type MetricConfig } from './quadrantState';
```

### Paso 2: Reemplazar TODAS las ocurrencias

En todo el archivo, reemplazar:

```
metricConfigs: Record<string, any>
```

por:

```
metricConfigs: Record<string, MetricConfig>
```

Hay **6 ocurrencias** en las firmas de: `handleWheel`, `handleMouseMove`, `handleMouseUp`, `handleTouchMove`, `handleTouchEnd`, y `valToY`.

---

## Tarea B4: Reemplazar `Record<string, any>` en Quadrant.svelte

**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

**Instrucción:**

### Paso 1: Agregar import

Al bloque de imports de quadrantState (~L10), agregar `MetricConfig`:

```diff
-    import { allMetrics, defaultMetricStyles, defaultMetricConfigs } from "$lib/dsp/quadrantState";
+    import { allMetrics, defaultMetricStyles, defaultMetricConfigs, type MetricConfig } from "$lib/dsp/quadrantState";
```

### Paso 2: Cambiar la declaración de estado

Buscar (~L91):

```diff
-    let metricConfigs = $state<Record<string, any>>(
+    let metricConfigs = $state<Record<string, MetricConfig>>(
```

---

## Tarea B5: Reemplazar `Record<string, any>` en MetricConfigPopover.svelte

**Archivo a modificar:** `src/components/medicion/MetricConfigPopover.svelte`

**Instrucción:**

### Paso 1: Agregar import

Al inicio del `<script>`, agregar:

```typescript
    import { type MetricConfig } from '$lib/dsp/quadrantState';
```

### Paso 2: Cambiar el tipo del prop

Buscar (~L10):

```diff
-        metricConfigs: Record<string, any>;
+        metricConfigs: Record<string, MetricConfig>;
```

---

## Verificación Grupo B

```bash
npm run build
```

Si hay errores de tipo por propiedades que faltan en la interface, agregar las propiedades faltantes como opcionales (`?`) a `MetricConfig`.

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo C.

---

# GRUPO C — Persistencia de EQ

---

## Tarea C1: Extender interface `PersistedConfig` con campos EQ

**Archivo a modificar:** `src/lib/utils/configPersistence.ts`

**Instrucción:**

### Paso 1: Agregar campos EQ a la interface

```diff
 export interface PersistedConfig {
     _version: number;
     layout: string;
     themeMode: 'system' | 'light' | 'dark';
     audioInDevice: string;
     audioOutDevice: string;
     inChannels: boolean[];
     outChannels: boolean[];
     referenceChannel: string;
     sampleRate: number;
     fftSize: number;
     dspUpdateRate: number;
+    eqType?: 'grafico' | 'parametrico';
+    eqShowEQ?: boolean;
+    eqGraphicBands?: { freq: number; gain: number }[];
+    eqParametricFilters?: { id: number; freq: number; gain: number; q: number; type: string; supportedTypes: string[] }[];
 }
```

### Paso 2: Actualizar CONFIG_VERSION

```diff
-const CONFIG_VERSION = 2;
+const CONFIG_VERSION = 3;
```

---

## Tarea C2: Agregar métodos `loadFromConfig` y `toConfig` a eqStore

**Archivo a modificar:** `src/lib/stores/eqStore.svelte.ts`

**Instrucción:** Agregar estos dos métodos dentro de la clase `EQStore`, antes del cierre `}` de la clase (~L80):

```typescript
    loadFromConfig(config: any) {
        if (config.eqType) this.eqType = config.eqType;
        if (config.eqShowEQ !== undefined) this.showEQ = config.eqShowEQ;
        if (config.eqGraphicBands && Array.isArray(config.eqGraphicBands)) {
            this.graphicBands = config.eqGraphicBands;
        }
        if (config.eqParametricFilters && Array.isArray(config.eqParametricFilters)) {
            this.parametricFilters = config.eqParametricFilters.map((f: any) => ({
                ...f,
                showConfig: false,
                supportedTypes: f.supportedTypes || ['peaking'],
            }));
        }
    }

    toConfig() {
        return {
            eqType: this.eqType,
            eqShowEQ: this.showEQ,
            eqGraphicBands: $state.snapshot(this.graphicBands).map(b => ({ freq: b.freq, gain: b.gain })),
            eqParametricFilters: $state.snapshot(this.parametricFilters).map(f => ({
                id: f.id, freq: f.freq, gain: f.gain, q: f.q, type: f.type, supportedTypes: f.supportedTypes,
            })),
        };
    }
```

**NOTA:** `$state.snapshot()` es necesario para obtener datos planos serializables en Svelte 5.

---

## Tarea C3: Integrar carga y guardado de EQ en +page.svelte

**Archivo a modificar:** `src/routes/+page.svelte`

**Instrucción:**

### Paso 1: Agregar import de eqStore (si no existe ya por A2)

Verificar que exista:

```typescript
import '$lib/stores/eqStore.svelte';
```

Y agregar el import nombrado para acceder a los métodos:

```diff
-import '$lib/stores/eqStore.svelte';
+import { eqStore } from '$lib/stores/eqStore.svelte';
```

### Paso 2: En el `onMount`, después de cargar la config en uiStore, cargar EQ

Buscar el bloque `if (config) {` (~L14) y agregar al final, antes del `} else {`:

```diff
             if (config.dspUpdateRate) uiStore.dspUpdateRate = config.dspUpdateRate;
+            eqStore.loadFromConfig(config);
         } else {
```

### Paso 3: En el `$effect` de save, agregar los campos de EQ

Buscar el bloque `saveConfig({` (~L54) y agregar los campos de EQ:

```diff
         saveConfig({
-            _version: 2,
+            _version: 3,
             layout: uiStore.layout,
             themeMode: uiStore.themeMode,
             audioInDevice: uiStore.audioInDevice,
             audioOutDevice: uiStore.audioOutDevice,
             inChannels: $state.snapshot(uiStore.inChannels),
             outChannels: $state.snapshot(uiStore.outChannels),
             referenceChannel: uiStore.referenceChannel,
             sampleRate: uiStore.sampleRate,
             fftSize: uiStore.fftSize,
             dspUpdateRate: uiStore.dspUpdateRate,
+            ...eqStore.toConfig(),
         });
```

---

## Verificación Grupo C

```bash
npm run build
```

Verificación manual:
1. Abrir la app → ir a tab EQ → cambiar tipo a "paramétrico" → modificar una frecuencia
2. Cerrar la app → reabrir → ir a tab EQ → verificar que la frecuencia modificada persiste
3. Verificar que el tipo "paramétrico" persiste

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo D.

---

# GRUPO D — Extracción del Draw Pipeline

---

## Tarea D1: Crear `quadrantDraw.ts`

**Archivo a crear:** `src/lib/dsp/quadrantDraw.ts`

**Contexto:** La función `draw()` en `Quadrant.svelte` (~L324-945) tiene ~620 líneas. Se debe extraer a un módulo puro que reciba todos sus inputs como parámetros.

**Instrucción:**

### Paso 1: Crear la interface de parámetros y la función

El archivo debe:
1. Importar todas las funciones de dibujo de `canvasRenderers.ts` que usa `draw()`
2. Importar tipos de `canvasInteraction.ts` y `quadrantState.ts`
3. Definir una `interface DrawParams` con todos los inputs que `draw()` necesita
4. Exportar una función `drawQuadrant(params: DrawParams)` que contenga toda la lógica del draw loop

**Estructura del archivo:**

```typescript
import {
    drawGrid,
    drawSpectrogram,
    drawLevelOverlay,
    drawNumericOverlay,
    drawCrosshair,
    drawMetricPath,
    drawSpectrumPath,
    drawTimeDomainPath,
    drawSimulatedMagnitudePath,
    drawPhasePath,
    drawNyquistPath,
    drawTargetTrace,
    drawScope,
    drawCrestFactor,
    drawPhaseDelay,
    drawEQOverlayPath
} from './canvasRenderers';
import {
    freqMin,
    freqMax,
    valToX,
    valToY,
    type InteractionState,
} from './canvasInteraction';
import type { MetricConfig, MetricStyle } from './quadrantState';
import type { InterpolationEngine } from './interpolationEngine';

export interface DrawParams {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;

    // Métricas y configuración
    activeMetrics: string[];
    hasTimeDomainActive: boolean;
    metricConfigs: Record<string, MetricConfig>;
    metricStyles: Record<string, MetricStyle>;
    interactionState: InteractionState;
    isDarkMode: boolean;
    sampleRate: number;
    BINS: number;

    // Buffers de interpolación
    interpEngine: InterpolationEngine;
    liveData: Float32Array | null;
    frequencyLUT: Int32Array;
    smoothedMagnitude: Float32Array;
    smoothedSpectrum: Float32Array;

    // Callbacks
    getPPOSmoothedValue: (bin: number, arr: Float32Array, ppo: number) => number;
    getMetricValueInterpolated: (freq: number, arr: Float32Array) => number;
    getImpulseValueInterpolated: (timeMs: number, arr: Float32Array) => number;
    getMetricAlpha: (metric: string) => number;
    getEQResponseCached: (freq: number) => number;

    // Capas y snapshots
    myLayers: { data: Float32Array; isMeasuring: boolean; visible: boolean }[];
    instantaneas: { visible: boolean; data: Record<string, Float32Array> }[];

    // EQ overlay
    showEQOverlay: boolean;
    eqBands: { freq: number; gain: number; q: number; type: string }[];
    hoveringEQNode: number | null;
    draggingEQNode: number | null;

    // Spectrogram
    offscreenCanvas: HTMLCanvasElement;
    spectrogramDbHistory: Float32Array[];
    sharedImageData: ImageData;

    // Target & meter overlays
    targetTrace: any;
    meterStore: any;

    // Nyquist
    hReal: Float32Array;
    hImag: Float32Array;

    // Canvas dimensions for EQ node positioning
    containerWidth: number;
    containerHeight: number;

    // Custom PPO smoothing
    customPPOSmooth: number;
}

export function drawQuadrant(p: DrawParams): void {
    // COPIAR AQUÍ TODO EL CONTENIDO DE draw() de Quadrant.svelte
    // desde la línea después de `ctx.clearRect(0, 0, width, height);`
    // hasta el cierre de draw().
    //
    // Reemplazar todas las variables de scope por accesos a `p.xxx`:
    // - activeMetrics → p.activeMetrics
    // - hasTimeDomainActive → p.hasTimeDomainActive
    // - metricConfigs → p.metricConfigs
    // - metricStyles → p.metricStyles
    // - interactionState → p.interactionState
    // - uiStore.isDarkMode → p.isDarkMode
    // - uiStore.sampleRate → p.sampleRate
    // - interpEngine → p.interpEngine
    // - liveData → p.liveData
    // - frequencyLUT → p.frequencyLUT
    // - smoothedMagnitude → p.smoothedMagnitude
    // - smoothedSpectrum → p.smoothedSpectrum
    // - getPPOSmoothedValue → p.getPPOSmoothedValue
    // - getMetricValueInterpolated → p.getMetricValueInterpolated
    // - getImpulseValueInterpolated → p.getImpulseValueInterpolated
    // - getMetricAlpha → p.getMetricAlpha
    // - mathOrchestrator.getEQResponseCached → p.getEQResponseCached
    // - mathOrchestrator.BINS → p.BINS
    // - mathOrchestrator.hReal → p.hReal
    // - mathOrchestrator.hImag → p.hImag
    // - myLayers → p.myLayers
    // - traceManager.instantaneas → p.instantaneas
    // - showEQOverlay → p.showEQOverlay
    // - traceManager.eqBands → p.eqBands
    // - hoveringEQNode → p.hoveringEQNode
    // - draggingEQNode → p.draggingEQNode
    // - targetTrace → p.targetTrace
    // - meterStore → p.meterStore
    // - offscreenCanvas → p.offscreenCanvas
    // - spectrogramDbHistory → p.spectrogramDbHistory
    // - sharedImageData → p.sharedImageData
    // - containerWidth → p.containerWidth
    // - containerHeight → p.containerHeight
    // - customPPOSmooth → p.customPPOSmooth
    // - BINS → p.BINS
    // - ctx → p.ctx
    // - width → p.width
    // - height → p.height
}
```

**IMPORTANTE:** 
- La función es puramente mecánica: copiar el cuerpo de `draw()` y prefijar accesos con `p.`.
- NO cambiar ninguna lógica — solo reemplazar nombres de variables.
- Las funciones que `draw()` llama (como `drawGrid`, `drawMetricPath`, etc.) se importan directamente en el nuevo módulo.

---

## Tarea D2: Simplificar `draw()` en Quadrant.svelte

**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

**Instrucción:**

### Paso 1: Agregar import

```typescript
import { drawQuadrant } from '$lib/dsp/quadrantDraw';
```

### Paso 2: Reemplazar el cuerpo de `draw()`

La función `draw()` actual (~L324-945) se reduce a:

```typescript
    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        ctx.clearRect(0, 0, width, height);

        // Actualizar capas calculadas antes de dibujar
        traceManager.updateCalculatedLayers();

        const liveData = traceManager.liveFrequencyData;

        const currentVersion = mathOrchestrator.version;
        if (currentVersion !== localLastVersion) {
            localLastVersion = currentVersion;
            interpEngine.updateHistory();
        }

        interpEngine.interpolateBuffers(dirty, mathOrchestrator);
        if (dirty) {
            dirty = false;
        }

        const BINS = interpEngine.BINS;
        const specPPO = metricConfigs["Spectrum"]?.smoothingPPO || 48;
        const hasLive = liveData && liveData.length > 0;
        const rawSpec = hasLive ? liveData : interpEngine.interpMagnitude;
        if (activeMetrics.includes("Spectrum") && specPPO < 48) {
            for (let i = 0; i < BINS; i++) {
                smoothedSpectrum[i] = getPPOSmoothedValue(i, rawSpec, specPPO);
            }
        }

        const magPPO = metricConfigs["Magnitude"]?.smoothingPPO || 48;
        if (activeMetrics.includes("Magnitude") && magPPO < 48) {
            for (let i = 0; i < BINS; i++) {
                smoothedMagnitude[i] = getPPOSmoothedValue(i, interpEngine.interpMagnitude, magPPO);
            }
        }

        drawQuadrant({
            ctx,
            width,
            height,
            activeMetrics,
            hasTimeDomainActive,
            metricConfigs,
            metricStyles,
            interactionState,
            isDarkMode: uiStore.isDarkMode,
            sampleRate: uiStore.sampleRate,
            BINS,
            interpEngine,
            liveData,
            frequencyLUT,
            smoothedMagnitude,
            smoothedSpectrum,
            getPPOSmoothedValue,
            getMetricValueInterpolated,
            getImpulseValueInterpolated,
            getMetricAlpha,
            getEQResponseCached: mathOrchestrator.getEQResponseCached.bind(mathOrchestrator),
            myLayers,
            instantaneas: traceManager.instantaneas,
            showEQOverlay,
            eqBands: traceManager.eqBands,
            hoveringEQNode,
            draggingEQNode,
            offscreenCanvas,
            spectrogramDbHistory,
            sharedImageData,
            targetTrace,
            meterStore,
            hReal: mathOrchestrator.hReal,
            hImag: mathOrchestrator.hImag,
            containerWidth,
            containerHeight,
            customPPOSmooth,
        });
    }
```

**NOTA:** Los cálculos de smoothing (PPO para Spectrum y Magnitude) se mantienen en `draw()` de Quadrant porque escriben en los buffers locales `smoothedSpectrum` y `smoothedMagnitude`. `drawQuadrant` solo los lee.

---

## Verificación Grupo D

```bash
npm run build
```

Verificación visual obligatoria:
- [ ] Magnitude se renderiza
- [ ] Phase se renderiza
- [ ] Coherence se renderiza
- [ ] Spectrum se renderiza
- [ ] Spectrogram se renderiza
- [ ] Impulse se renderiza (UNA sola vez)
- [ ] Step se renderiza (UNA sola vez)
- [ ] Simulated Magnitude se renderiza
- [ ] Nyquist se renderiza
- [ ] Scope se renderiza
- [ ] Phase Delay se renderiza
- [ ] Crest Factor se renderiza
- [ ] Level overlay funciona
- [ ] Numeric overlay funciona
- [ ] EQ overlay con nodos arrastrables funciona
- [ ] Target trace se renderiza
- [ ] Crosshair muestra valores correctos
- [ ] Zoom/Pan funciona

### ⛔ STOP — Fase 6 completada. Reportá todos los cambios al usuario.

---

# Resumen de archivos por tarea

| Tarea | Archivos | Tipo |
|-------|----------|------|
| A1 | `Quadrant.svelte` | Modify |
| A2 | `+page.svelte` | Modify |
| A3 | `canvasRenderers.ts` | Modify |
| A4 | `mathOrchestrator.svelte.ts` | Modify |
| A5 | `dspWorker.ts` | Modify |
| B1 | `quadrantState.ts` | Modify |
| B2 | `canvasRenderers.ts` | Modify |
| B3 | `canvasInteraction.ts` | Modify |
| B4 | `Quadrant.svelte` | Modify |
| B5 | `MetricConfigPopover.svelte` | Modify |
| C1 | `configPersistence.ts` | Modify |
| C2 | `eqStore.svelte.ts` | Modify |
| C3 | `+page.svelte` | Modify |
| D1 | `quadrantDraw.ts` | **New** |
| D2 | `Quadrant.svelte` | Modify |
