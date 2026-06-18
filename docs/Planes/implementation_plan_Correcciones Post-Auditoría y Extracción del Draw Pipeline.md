# Fase 6 — Correcciones Post-Auditoría y Extracción del Draw Pipeline

Corrección de bugs, limpieza de residuos, tipado de `metricConfigs`, persistencia de EQ y extracción del draw engine de Quadrant.

---

## Contexto

La auditoría post-Fase 5 identificó 10 hallazgos (B1-B2, O1-O3, T1-T3, A1-A2). Este plan aborda todos excepto O3 (migración CSS del Sidebar, que es cosmético y requiere tocar todos los Tab*.svelte).

---

## Propuestos Cambios

### GRUPO A — Fixes rápidos (sin dependencias, ~10 min total)

#### A1: Eliminar doble renderizado de Impulse/Step (B1)

**Bug:** [Quadrant.svelte:L664-697](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L664-L697) dibuja Impulse/Step una primera vez dentro del bloque de capas. Luego [L794-826](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L794-L826) los dibuja de nuevo idéntico como métricas "globales".

**Cambio:** Eliminar el primer bloque (L664-697, etiquetado `// 4. Renderizar métricas que no son capas o son globales (Impulse, Step)`). El segundo bloque (L794+) ya cubre esta funcionalidad correctamente.

**Riesgo:** Nulo — la lógica es idéntica.

---

#### A2: Asegurar inicialización de `eqStore` al arranque (B2)

**Bug:** `eqStore` solo se instancia cuando `TabEcualizar` se importa (navegación a tab EQ). Su `$effect.root` no corre hasta ese momento.

**Cambio en** [+page.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/%2Bpage.svelte):

```diff
 import { loadConfig, saveConfig } from "$lib/utils/configPersistence";
+import '$lib/stores/eqStore.svelte';  // Asegura inicialización del $effect.root
```

**Riesgo:** Nulo

---

#### A3: Eliminar interface `Trace` residual (O1)

**Cambio en** [canvasRenderers.ts:L16-19](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts#L16-L19):

```diff
-interface Trace {
-    id: string;
-    data: Float32Array;
-}
```

**Riesgo:** Nulo — ya no se referencia.

---

#### A4: Hacer `hReal`/`hImag` reactivos con `$state.raw` (O2)

**Cambio en** [mathOrchestrator.svelte.ts:L34-35](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts#L34-L35):

```diff
-    hReal = new Float32Array(this.BINS);
-    hImag = new Float32Array(this.BINS);
+    hReal = $state.raw(new Float32Array(this.BINS));
+    hImag = $state.raw(new Float32Array(this.BINS));
```

**Riesgo:** Nulo — consistencia con los demás buffers.

---

#### A5: Eliminar `console.log` de producción en dspWorker (T2)

**Cambio en** [dspWorker.ts:L23](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/dspWorker.ts#L23):

```diff
-        console.log('[dspWorker] WebFFT initialized:', webfftEngine.toString());
```

**Riesgo:** Nulo

---

### GRUPO B — Tipado de `metricConfigs` (T1)

#### B1: Crear interface `MetricConfig` y reemplazar `Record<string, any>`

**Archivos afectados:**
- **[MODIFY]** [quadrantState.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/quadrantState.ts) — definir la interface y exportarla
- **[MODIFY]** [canvasRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts) — reemplazar 7 firmas
- **[MODIFY]** [canvasInteraction.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts) — reemplazar 6 firmas
- **[MODIFY]** [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte) — 1 declaración
- **[MODIFY]** [MetricConfigPopover.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/MetricConfigPopover.svelte) — 1 prop

**Interface propuesta** (en `quadrantState.ts`):

```typescript
export interface MetricConfig {
    modeY?: 'dB' | 'Linear' | 'Impedance';
    sensorResistance?: number;
    smoothingPPO?: number;
    invertY?: boolean;
    enableCoherence?: boolean;
    coherenceThreshold?: number;
    yShift?: number;
    hidden?: boolean;
    // Phase-specific
    unwrapMode?: '±180' | '±360' | 'Unwrap';
    rotate?: number;
    range?: number;
    // Coherence-specific
    cohType?: 'normal' | 'inverted';
    showThresholdLine?: boolean;
    thresholdColor?: string;
    thresholdValue?: number;
    // Spectrogram-specific
    palette?: PaletteType;
}
```

**Cambio mecánico:** En todos los archivos, reemplazar `Record<string, any>` por `Record<string, MetricConfig>` (importando la interface donde sea necesario).

> [!IMPORTANT]
> Verificar que `defaultMetricConfigs` en quadrantState.ts satisface la interface propuesta. Si alguna propiedad falta, agregarla a la interface con `?` (opcional).

---

### GRUPO C — Persistencia de EQ (A2)

#### C1: Agregar estado EQ a `PersistedConfig`

**Archivos afectados:**
- **[MODIFY]** [configPersistence.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/utils/configPersistence.ts) — extender interface, bumps version a 3
- **[MODIFY]** [+page.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/%2Bpage.svelte) — agregar EQ al `$effect` de save y al `onMount` de load
- **[MODIFY]** [eqStore.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/eqStore.svelte.ts) — exportar método `loadFromConfig()` y `toConfig()`

**Cambios en `configPersistence.ts`:**

```diff
 export interface PersistedConfig {
     _version: number;
     // ... existente ...
+    eqType?: 'grafico' | 'parametrico';
+    eqShowEQ?: boolean;
+    eqGraphicBands?: { freq: number; gain: number }[];
+    eqParametricFilters?: { id: number; freq: number; gain: number; q: number; type: string; supportedTypes: string[] }[];
 }
```

Bumps `CONFIG_VERSION` a 3. Migración v2→v3: no-op (campos opcionales).

**Cambios en `eqStore.svelte.ts`:**

```typescript
loadFromConfig(config: Partial<PersistedConfig>) {
    if (config.eqType) this.eqType = config.eqType;
    if (config.eqShowEQ !== undefined) this.showEQ = config.eqShowEQ;
    if (config.eqGraphicBands) this.graphicBands = config.eqGraphicBands;
    if (config.eqParametricFilters) {
        this.parametricFilters = config.eqParametricFilters.map(f => ({
            ...f, showConfig: false, supportedTypes: f.supportedTypes || ['peaking']
        }));
    }
}

toConfig() {
    return {
        eqType: this.eqType,
        eqShowEQ: this.showEQ,
        eqGraphicBands: $state.snapshot(this.graphicBands),
        eqParametricFilters: $state.snapshot(this.parametricFilters).map(f => ({
            id: f.id, freq: f.freq, gain: f.gain, q: f.q, type: f.type, supportedTypes: f.supportedTypes
        })),
    };
}
```

**Cambios en `+page.svelte`:**

```diff
 // En onMount, después de loadConfig:
+    if (config) {
+        eqStore.loadFromConfig(config);
+    }

 // En $effect de saveConfig:
     saveConfig({
         _version: 3,
         // ... existente ...
+        ...eqStore.toConfig(),
     });
```

---

### GRUPO D — Extracción del Draw Pipeline (A1)

#### D1: Crear `quadrantDraw.ts` y mover el draw engine

**Archivos afectados:**
- **[NEW]** `src/lib/dsp/quadrantDraw.ts`
- **[MODIFY]** [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte) — reemplazar función `draw()` inline por llamada a la función extraída

**Concepto:** La función `draw()` (~620 líneas, L324-945) se mueve a un módulo puro que recibe todos sus inputs como parámetros:

```typescript
// quadrantDraw.ts
export interface QuadrantDrawContext {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    activeMetrics: string[];
    hasTimeDomainActive: boolean;
    metricConfigs: Record<string, MetricConfig>;
    metricStyles: Record<string, MetricStyle>;
    interactionState: InteractionState;
    isDarkMode: boolean;
    // Buffers & engines
    interpEngine: InterpolationEngine;
    liveData: Float32Array | null;
    frequencyLUT: Int32Array;
    smoothedMagnitude: Float32Array;
    smoothedSpectrum: Float32Array;
    // Stores (read-only refs)
    sampleRate: number;
    BINS: number;
    // Callbacks
    getPPOSmoothedValue: (bin: number, arr: Float32Array, ppo: number) => number;
    getMetricValueInterpolated: (freq: number, arr: Float32Array) => number;
    getImpulseValueInterpolated: (timeMs: number, arr: Float32Array) => number;
    getMetricAlpha: (metric: string) => number;
    getEQResponseCached: (freq: number) => number;
    // Layer & snapshot data
    myLayers: any[];
    instantaneas: any[];
    // EQ overlay
    showEQOverlay: boolean;
    eqBands: any[];
    hoveringEQNode: number | null;
    draggingEQNode: number | null;
    // Spectrogram state
    offscreenCanvas: HTMLCanvasElement;
    spectrogramDbHistory: Float32Array[];
    sharedImageData: ImageData;
    // Target & overlays
    targetTrace: any;
    meterStore: any;
}

export function drawQuadrant(params: QuadrantDrawContext): void {
    // ... toda la lógica de draw() movida aquí
}
```

> [!IMPORTANT]  
> La cantidad de parámetros es alta porque `draw()` accede a muchas variables de scope. Se encapsulan en una interface para claridad. El refactoring es puramente mecánico — no cambia ninguna lógica.

> [!WARNING]
> Este es el cambio más invasivo. Requiere verificación visual cuidadosa de que todas las métricas se siguen renderizando correctamente.

**En Quadrant.svelte**, la función `draw()` se reduce a:

```typescript
function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    
    drawQuadrant({
        ctx,
        width: canvas.width / dpr,
        height: canvas.height / dpr,
        activeMetrics,
        hasTimeDomainActive,
        // ... todos los campos
    });
}
```

Esto reduce Quadrant de ~1330 a ~700 líneas.

---

## Verificación

### Cada grupo:
```bash
npm run build
```

### Grupo A (B1 específicamente):
- Activar Impulse/Step → verificar visualmente que se dibujan UNA sola vez (no doble opacidad)

### Grupo C:
- Cambiar bandas de EQ → cerrar app → reabrir → verificar que persisten

### Grupo D:
- Verificar visualmente que TODAS las métricas se renderizan correctamente (Magnitude, Phase, Coherence, Spectrum, Spectrogram, Impulse, Step, Simulated Magnitude, Nyquist, Scope, Phase Delay, Crest Factor, Level, Numeric)
- Verificar que EQ overlay con nodos drag sigue funcionando

---

## Resumen de Archivos

| Tarea | Archivos | Tipo |
|-------|----------|------|
| A1 | `Quadrant.svelte` | Modify |
| A2 | `+page.svelte` | Modify |
| A3 | `canvasRenderers.ts` | Modify |
| A4 | `mathOrchestrator.svelte.ts` | Modify |
| A5 | `dspWorker.ts` | Modify |
| B1 | `quadrantState.ts`, `canvasRenderers.ts`, `canvasInteraction.ts`, `Quadrant.svelte`, `MetricConfigPopover.svelte` | Modify |
| C1 | `configPersistence.ts`, `eqStore.svelte.ts`, `+page.svelte` | Modify |
| D1 | `quadrantDraw.ts` (NEW), `Quadrant.svelte` | New + Modify |
