# Prompts de Implementación — Fase 5: Limpieza Post-Refactoring y Stores Dedicados

Este documento contiene instrucciones atómicas para ejecutar la Fase 5 del refactoring. El proyecto es una SPA SvelteKit con Svelte 5 runes (`$state`, `$derived`, `$effect`).

## ⛔ REGLAS OBLIGATORIAS — Leer antes de empezar

1. **NO AVANCES al siguiente Grupo (A→B→C→D) sin recibir aprobación explícita del usuario.** Al terminar cada grupo, reporta lo hecho y ESPERA instrucciones.
2. **NO MODIFIQUES archivos que no estén explícitamente listados en la tarea.** Si descubrís que se necesita un cambio adicional, reportalo y esperá aprobación.
3. **NO AGREGUES funcionalidad nueva** que no esté especificada en la tarea. No refactorices código adyacente "de paso". No agregues logs, tests, ni comentarios extra.
4. **NO ELIMINES comentarios existentes** a menos que la tarea lo indique expresamente.
5. **NO CAMBIES la lógica de negocio** salvo que la tarea lo especifique. Los cambios son estructurales/mecánicos.
6. **Verificá con `npm run build` al final de cada grupo.** Si falla, corregí solo lo necesario para que compile sin inventar soluciones propias.
7. **Si algo no queda claro, PREGUNTÁ** en vez de asumir.

---

# GRUPO A — Correcciones de residuos (sin dependencias entre sí)

---

## Tarea A1: Enviar `hReal`/`hImag` desde el Worker

**Archivos a modificar:**
- `src/lib/dsp/dspWorker.ts`
- `src/lib/stores/mathOrchestrator.svelte.ts`

**Contexto:** La métrica Nyquist (`Quadrant.svelte` L863) lee `mathOrchestrator.hReal` y `mathOrchestrator.hImag`. Estos buffers se llenan mediante `calculateMagnitude()` pero solo dentro del **dspWorker** (L429-430). El worker NO los envía de vuelta en `postMessage`, por lo que Nyquist recibe arrays llenos de ceros.

**Instrucción:**

### Paso 1: En `src/lib/dsp/dspWorker.ts`

Buscar el bloque de `postMessage` (~L537-547). Agregar `hReal` y `hImag` al mensaje y al array de transferibles:

```diff
         const magBuf = outputMagnitude.buffer;
         const phaseBuf = outputPhase.buffer;
         const cohBuf = outputCoherence.buffer;
         const gdBuf = outputGroupDelay.buffer;
         const impBuf = outputImpulse.buffer;
         const stepBuf = outputStep.buffer;
         const cfBuf = outputCrestFactor.buffer;
+        const hRealBuf = hReal.buffer;
+        const hImagBuf = hImag.buffer;

         (self as any).postMessage({
             type: 'dsp-results',
             outputMagnitude: magBuf,
             outputPhase: phaseBuf,
             outputCoherence: cohBuf,
             outputGroupDelay: gdBuf,
             outputImpulse: impBuf,
             outputStep: stepBuf,
             outputCrestFactor: cfBuf,
+            hReal: hRealBuf,
+            hImag: hImagBuf,
             dbIn
-        }, [magBuf, phaseBuf, cohBuf, gdBuf, impBuf, stepBuf, cfBuf]);
+        }, [magBuf, phaseBuf, cohBuf, gdBuf, impBuf, stepBuf, cfBuf, hRealBuf, hImagBuf]);
```

Y agregar la reasignación de `hReal`/`hImag` después del postMessage (junto a las demás reasignaciones, ~L550-556):

```diff
         outputCrestFactor = new Float32Array(currentBins);
+        hReal = new Float32Array(currentBins);
+        hImag = new Float32Array(currentBins);
```

### Paso 2: En `src/lib/stores/mathOrchestrator.svelte.ts`

En el método `handleWorkerMessage` (~L85-121), agregar la recepción de `hReal`/`hImag`:

```diff
             if (data.outputCrestFactor) {
                 this.outputCrestFactor = new Float32Array(data.outputCrestFactor);
             }
+            if (data.hReal) {
+                this.hReal = new Float32Array(data.hReal);
+            }
+            if (data.hImag) {
+                this.hImag = new Float32Array(data.hImag);
+            }
```

---

## Tarea A2: Propagar `uiStore.sampleRate` a wrappers de interpolación

**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

**Instrucción:**

Buscar los wrappers de interpolación (~L240-252) y agregar el tercer argumento:

```diff
     function getMetricValueInterpolated(
         freq: number,
         dataArray: Float32Array,
     ): number {
-        return interpEngine.getMetricValueInterpolated(freq, dataArray);
+        return interpEngine.getMetricValueInterpolated(freq, dataArray, uiStore.sampleRate);
     }

     function getImpulseValueInterpolated(
         timeMs: number,
         impulseArray: Float32Array,
     ): number {
-        return interpEngine.getImpulseValueInterpolated(timeMs, impulseArray);
+        return interpEngine.getImpulseValueInterpolated(timeMs, impulseArray, uiStore.sampleRate);
     }
```

---

## Tarea A3: Simplificar `liveTrace` en el draw loop

**Archivos a modificar:**
- `src/components/medicion/Quadrant.svelte`
- `src/lib/dsp/canvasRenderers.ts`

**Contexto:** Se construye un objeto `liveTrace` cada frame (~L355-367) que solo se usa para acceder a `.data` (que es `traceManager.liveFrequencyData`). Los consumidores son:

| Consumidor | Línea en Quadrant | Acceso |
|-----------|-------------------|--------|
| `hasLive` check | L393 | `liveTrace.data.length > 0` |
| `rawSpec` | L394 | `liveTrace.data` |
| `data` en spectrogram | L431 | `liveTrace.data` |
| `drawSpectrumPath` | L752 | `liveTrace` → accede a `.data` |
| `drawCrosshair` | L971 | `liveTrace` → accede a `.data` |

**Instrucción paso a paso:**

### Paso 1: En `canvasRenderers.ts` — Cambiar firma de `drawSpectrumPath`

Buscar la función `drawSpectrumPath` (~L631-647). Cambiar el parámetro `liveTrace`:

```diff
 export function drawSpectrumPath(
     ctx: CanvasRenderingContext2D,
-    liveTrace: Trace | undefined,
+    liveData: Float32Array | null,
     width: number,
     height: number,
```

Y actualizar las referencias internas (~L654-657):

```diff
-    const hasLive =
-        liveTrace && liveTrace.data && liveTrace.data.length > 0;
-    const dataArray = hasLive ? liveTrace.data : interpMagnitude;
+    const hasLive = liveData && liveData.length > 0;
+    const dataArray = hasLive ? liveData : interpMagnitude;
```

### Paso 2: En `canvasRenderers.ts` — Cambiar firma de `drawCrosshair`

Buscar la función `drawCrosshair` (~L367-382). Cambiar el parámetro `liveTrace`:

```diff
-    liveTrace: Trace | undefined,
+    liveData: Float32Array | null,
```

Y actualizar las referencias internas (~L480-487):

```diff
         if (activeMetrics.includes("Spectrum")) {
             const val = getMetricValueInterpolated(
                 xVal,
-                liveTrace && liveTrace.data && liveTrace.data.length > 0
-                    ? liveTrace.data
+                liveData && liveData.length > 0
+                    ? liveData
                     : interpMagnitude,
             );
             const offset =
-                liveTrace && liveTrace.data && liveTrace.data.length > 0
+                liveData && liveData.length > 0
                     ? 0
                     : 68;
```

### Paso 3: En `Quadrant.svelte` — Eliminar `liveTrace` y usar acceso directo

Eliminar la construcción del objeto `liveTrace` (~L355-367):

```diff
-        const liveTrace = {
-            id: 'live-1',
-            name: 'Señal en Vivo',
-            type: 'live' as const,
-            metric: 'magnitude',
-            data: traceManager.liveFrequencyData,
-            color: '#ff4444',
-            style: 'solid' as const,
-            visible: true,
-            offsetY: 0,
-            timestamp: Date.now(),
-            source: 'manual' as const
-        };
+        const liveData = traceManager.liveFrequencyData;
```

Reemplazar todas las referencias a `liveTrace.data` por `liveData`:

- L393: `liveTrace && liveTrace.data && liveTrace.data.length > 0` → `liveData && liveData.length > 0`
- L394: `liveTrace.data` → `liveData`
- L431: `liveTrace.data` → `liveData`
- L752 (drawSpectrumPath): `liveTrace` → `liveData`
- L971 (drawCrosshair): `liveTrace` → `liveData`

---

## Tarea A4: Eliminar import `palettes` no usado

**Archivo a modificar:** `src/lib/dsp/quadrantState.ts`

**Instrucción:**

```diff
-import { palettes, type PaletteType } from "./colorPalettes";
+import { type PaletteType } from "./colorPalettes";
```

---

## Tarea A5: Tipar `timerId` en MathOrchestrator

**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`

**Instrucción:**

Buscar (~L45):

```diff
-    private timerId: any = null;
+    private timerId: ReturnType<typeof setInterval> | null = null;
```

---

## Verificación Grupo A

```bash
npm run build
```

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo B.

---

# GRUPO B — Unificar colores de métricas

---

## Tarea B1: Eliminar `METRIC_COLORS` duplicado y unificar colores

**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

**Contexto:** Hay 3 fuentes de colores de métricas:
1. `METRIC_COLORS` (L152-162) — hardcodeado local
2. `defaultMetricStyles` → importado desde `quadrantState.ts`
3. `allMetrics` → importado desde `quadrantState.ts`

Se debe usar una sola fuente de verdad.

**Instrucción:**

### Paso 1: Reemplazar `METRIC_COLORS` por derivación desde `allMetrics`

Buscar el bloque `METRIC_COLORS` (~L152-162) y reemplazar:

```diff
-    // Visual coding: colores por tipo de métrica
-    const METRIC_COLORS: Record<string, string> = {
-        'Magnitude': '#ff4444',
-        'Phase': '#d946ef',
-        'Coherence': '#eab308',
-        'Group Delay': '#3b82f6',
-        'Impulse': '#14b8a6',
-        'Step': '#10b981',
-        'Spectrum': '#a855f7',
-        'Scope': '#06b6d4',
-        'Crest Factor': '#f97316',
-    };
+    // Visual coding: colores por tipo de métrica (derivados de allMetrics)
+    const METRIC_COLORS: Record<string, string> = Object.fromEntries(
+        allMetrics.map(m => [m.name, m.color])
+    );
```

### Paso 2: Simplificar los bloques de color inline en el draw loop

Buscar los dos bloques idénticos de asignación de color inline (~L532-537 y ~L631-636). En ambos, reemplazar:

```diff
-                let color = "#ff4444";
-                if (metric === "Phase") color = "#d946ef";
-                else if (metric === "Coherence") color = "#eab308";
-                else if (metric === "Spectrum") color = "#a855f7";
-                else if (metric === "Group Delay") color = "#10b981";
-                else if (metric === "Simulated Magnitude") color = "#00ffff";
+                const color = metricStyles[metric]?.color || METRIC_COLORS[metric] || '#ff4444';
```

**NOTA:** Hay DOS bloques idénticos. Aplicar el mismo cambio a ambos.

---

## Verificación Grupo B

```bash
npm run build
```

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo C.

---

# GRUPO C — Crear `eqStore.svelte.ts`

---

## Tarea C1: Crear el store

**Archivo a crear:** `src/lib/stores/eqStore.svelte.ts`

**Instrucción:** Crear el archivo con el siguiente contenido exacto:

```typescript
/**
 * EQStore: Estado centralizado de ecualización (gráfica y paramétrica).
 * Extraído de Sidebar.svelte para desacoplar el estado de la UI.
 */

import { traceManager } from './traceManager.svelte';

export interface GraphicBand {
    freq: number;
    gain: number;
}

export interface ParametricFilter {
    id: number;
    freq: number;
    gain: number;
    q: number;
    type: string;
    supportedTypes: string[];
    showConfig: boolean;
}

class EQStore {
    eqType = $state<'grafico' | 'parametrico'>('grafico');
    showEQ = $state(true);
    numGraphicBands = $state(10);
    customBandCount = $state(false);
    isCalculatingAutoEQ = $state(false);
    autoEQSourceLayer = $state<string>('active');

    graphicBands = $state<GraphicBand[]>([
        { freq: 31, gain: 0 },
        { freq: 63, gain: 0 },
        { freq: 125, gain: 0 },
        { freq: 250, gain: 0 },
        { freq: 500, gain: 0 },
        { freq: 1000, gain: 0 },
        { freq: 2000, gain: 0 },
        { freq: 4000, gain: 0 },
        { freq: 8000, gain: 0 },
        { freq: 16000, gain: 0 },
    ]);

    parametricFilters = $state<ParametricFilter[]>([
        { id: 1, freq: 80, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "lowpass", "highpass", "low_shelf", "high_shelf", "notch", "bandpass"], showConfig: false },
        { id: 2, freq: 500, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "low_shelf", "high_shelf", "notch"], showConfig: false },
        { id: 3, freq: 2000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "notch"], showConfig: false },
        { id: 4, freq: 8000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "lowpass", "low_shelf", "high_shelf"], showConfig: false },
        { id: 5, freq: 12000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking", "lowpass"], showConfig: false },
        { id: 6, freq: 16000, gain: 0, q: 1.0, type: "peaking", supportedTypes: ["peaking"], showConfig: false },
    ]);

    constructor() {
        // Sincronización reactiva con traceManager.eqBands
        $effect.root(() => {
            $effect(() => {
                if (!this.showEQ) {
                    traceManager.eqBands = [];
                    return;
                }

                if (this.eqType === "grafico") {
                    traceManager.eqBands = this.graphicBands.map((b) => ({
                        freq: b.freq,
                        gain: b.gain,
                        q: 1.414,
                        type: "peaking",
                    }));
                } else if (this.eqType === "parametrico") {
                    traceManager.eqBands = this.parametricFilters
                        .map((f) => ({
                            freq: f.freq,
                            gain: f.gain,
                            q: f.q,
                            type: f.type,
                        }));
                }
            });
        });
    }
}

export const eqStore = new EQStore();
```

---

## Tarea C2: Migrar `TabEcualizar.svelte` a usar `eqStore`

**Archivo a modificar:** `src/components/medicion/TabEcualizar.svelte`

**Instrucción:**

### Paso 1: Cambiar imports

Agregar al inicio del `<script>`:

```typescript
import { eqStore, type GraphicBand, type ParametricFilter } from '$lib/stores/eqStore.svelte';
```

### Paso 2: Eliminar las interfaces locales y los props de bind

Eliminar las interfaces `GraphicBand` y `ParametricFilter` (L10-23) ya que ahora se importan.

Reemplazar el bloque completo de props (~L25-45):

```diff
-    let {
-        showEQ = $bindable(true),
-        eqType = $bindable("grafico"),
-        numGraphicBands = $bindable(10),
-        customBandCount = $bindable(false),
-        isCalculatingAutoEQ = $bindable(false),
-        autoEQSourceLayer = $bindable("active"),
-        graphicBands = $bindable([]),
-        parametricFilters = $bindable([]),
-        statusText = $bindable("Listo para medir")
-    }: {
-        showEQ: boolean;
-        eqType: "grafico" | "parametrico";
-        numGraphicBands: number;
-        customBandCount: boolean;
-        isCalculatingAutoEQ: boolean;
-        autoEQSourceLayer: string;
-        graphicBands: GraphicBand[];
-        parametricFilters: ParametricFilter[];
-        statusText: string;
-    } = $props();
+    let {
+        statusText = $bindable("Listo para medir")
+    }: {
+        statusText: string;
+    } = $props();
```

### Paso 3: Reemplazar todas las referencias a las variables locales por `eqStore.*`

En todo el archivo, reemplazar:
- `showEQ` → `eqStore.showEQ`
- `eqType` → `eqStore.eqType`
- `numGraphicBands` → `eqStore.numGraphicBands`
- `customBandCount` → `eqStore.customBandCount`
- `isCalculatingAutoEQ` → `eqStore.isCalculatingAutoEQ`
- `autoEQSourceLayer` → `eqStore.autoEQSourceLayer`
- `graphicBands` → `eqStore.graphicBands`
- `parametricFilters` → `eqStore.parametricFilters`

**IMPORTANTE:** En el template, los `bind:checked={showEQ}`, `bind:value={eqType}`, `bind:value={numGraphicBands}`, etc. deben cambiarse a `bind:checked={eqStore.showEQ}`, `bind:value={eqStore.eqType}`, etc.

---

## Tarea C3: Limpiar `Sidebar.svelte`

**Archivo a modificar:** `src/components/medicion/Sidebar.svelte`

**Instrucción:**

### Paso 1: Eliminar todo el estado EQ

Eliminar las líneas 11-138 (desde `// --- ESTADOS DE ECUALIZACIÓN` hasta el cierre de la sincronización reactiva con `traceManager.eqBands`).

### Paso 2: Simplificar el binding de `TabEcualizar`

Reemplazar el bloque completo de `TabEcualizar` (~L218-229):

```diff
         {:else if uiStore.activeTab === "eq"}
-            <TabEcualizar
-                bind:showEQ
-                bind:eqType
-                bind:numGraphicBands
-                bind:customBandCount
-                bind:isCalculatingAutoEQ
-                bind:autoEQSourceLayer
-                bind:graphicBands
-                bind:parametricFilters
-                bind:statusText
-            />
+            <TabEcualizar bind:statusText />
```

### Paso 3: Agregar import del eqStore

Agregar al inicio del `<script>`:

```typescript
import { eqStore } from '$lib/stores/eqStore.svelte';
```

**NOTA:** Aunque Sidebar ya no usa `eqStore` directamente, el import asegura que la instancia se cree. Alternativamente, si el import se hace desde `TabEcualizar` o desde `+page.svelte`, no es necesario importar aquí. Verificá que al menos un módulo cargado al inicio importe `eqStore`.

---

## Tarea C4: Eliminar `eqType` de `uiStore`

**Archivo a modificar:** `src/lib/stores/ui.svelte.ts`

**Instrucción:**

Buscar y eliminar la línea (~L41):

```diff
-    eqType = $state<'grafico' | 'parametrico'>('grafico'); // 'grafico' | 'parametrico'
```

Verificar que ningún otro archivo referencia `uiStore.eqType`. Si alguno lo hace, reemplazarlo por `eqStore.eqType` (agregando el import correspondiente).

---

## Verificación Grupo C

```bash
npm run build
```

Si hay errores de compilación por referencias a `uiStore.eqType`, corregir agregando `import { eqStore } from '$lib/stores/eqStore.svelte'` y cambiando la referencia.

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo D.

---

# GRUPO D — Persistencia robusta de configuración

---

## Tarea D1: Crear `configPersistence.ts`

**Archivo a crear:** `src/lib/utils/configPersistence.ts`

**Instrucción:** Crear el archivo con el siguiente contenido exacto:

```typescript
/**
 * Persistencia de configuración del usuario con throttle y schema versioning.
 */

const CONFIG_KEY = 'asistente_config';
const CONFIG_VERSION = 2;
const SAVE_DEBOUNCE_MS = 1000;

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
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Carga la configuración persistida, aplicando migraciones si es necesario.
 */
export function loadConfig(): Partial<PersistedConfig> | null {
    try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);

        // Migración v1 → v2: isDarkMode → themeMode
        if (!parsed._version || parsed._version < 2) {
            if (parsed.isDarkMode !== undefined && !parsed.themeMode) {
                parsed.themeMode = parsed.isDarkMode ? 'dark' : 'light';
            }
            delete parsed.isDarkMode;
            parsed._version = CONFIG_VERSION;
        }

        return parsed as Partial<PersistedConfig>;
    } catch (e) {
        console.error('[configPersistence] Error cargando configuración:', e);
        return null;
    }
}

/**
 * Guarda la configuración con debounce para evitar escrituras excesivas.
 */
export function saveConfig(config: PersistedConfig): void {
    if (saveTimer) {
        clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
        } catch (e) {
            console.error('[configPersistence] Error guardando configuración:', e);
        }
        saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
}
```

---

## Tarea D2: Migrar persistencia desde Sidebar al layout

**Archivos a modificar:**
- `src/components/medicion/Sidebar.svelte`
- `src/routes/+page.svelte`

**Instrucción:**

### Paso 1: En `Sidebar.svelte` — Eliminar `onMount` y `$effect` de persistencia

Eliminar el import `onMount` si no se usa para otra cosa.

Eliminar el bloque `onMount(async () => { ... })` (~L141-168) que carga desde localStorage.

Eliminar el `$effect` de guardado (~L170-181) que escribe en localStorage.

Eliminar la variable `statusText` (~L183) si ya no se usa en Sidebar directamente (verificar si TabMedicion la necesita por bind).

### Paso 2: En `+page.svelte` — Agregar carga y guardado de configuración

Agregar los imports al bloque `<script>`:

```typescript
import { loadConfig, saveConfig, type PersistedConfig } from '$lib/utils/configPersistence';
```

Dentro del `onMount` existente, agregar la carga de configuración **antes** del handler de hotkeys:

```typescript
onMount(() => {
    // Cargar configuración persistida
    const config = loadConfig();
    if (config) {
        if (config.layout) uiStore.setLayout(config.layout);
        if (config.themeMode) {
            uiStore.setThemeMode(config.themeMode);
        }
        if (config.audioInDevice) uiStore.audioInDevice = config.audioInDevice;
        if (config.audioOutDevice) uiStore.audioOutDevice = config.audioOutDevice;
        if (config.inChannels) uiStore.inChannels = config.inChannels;
        if (config.outChannels) uiStore.outChannels = config.outChannels;
        if (config.referenceChannel) uiStore.referenceChannel = config.referenceChannel;
        if (config.sampleRate) uiStore.sampleRate = config.sampleRate;
        if (config.fftSize) uiStore.fftSize = config.fftSize;
        if (config.dspUpdateRate) uiStore.dspUpdateRate = config.dspUpdateRate;
    } else {
        uiStore.setLayout('1x1');
    }

    // Hotkeys globales
    const handleKey = (e: KeyboardEvent) => {
        // ... (existente, no modificar)
    };
    // ... (resto del onMount existente)
});
```

Y agregar un `$effect` para el guardado reactivo (fuera del onMount, en el bloque `<script>`):

```typescript
$effect(() => {
    saveConfig({
        _version: 2,
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
    });
});
```

Agregar import de `$state` si es necesario (Svelte 5 lo provee automáticamente en archivos `.svelte`).

---

## Verificación Grupo D

```bash
npm run build
```

Verificación manual:
- Cambiar layout/tema/sample rate en la app → cerrar → reabrir → verificar que persiste
- Verificar que no se guarda en cada keystroke (debounce de 1s)

### ⛔ STOP — Fase 5 completada. Reportá todos los cambios al usuario.

---

# Resumen de archivos por tarea

| Tarea | Archivos | Tipo |
|-------|----------|------|
| A1 | `dspWorker.ts`, `mathOrchestrator.svelte.ts` | Modify |
| A2 | `Quadrant.svelte` | Modify |
| A3 | `Quadrant.svelte`, `canvasRenderers.ts` | Modify |
| A4 | `quadrantState.ts` | Modify |
| A5 | `mathOrchestrator.svelte.ts` | Modify |
| B1 | `Quadrant.svelte` | Modify |
| C1 | `eqStore.svelte.ts` | **New** |
| C2 | `TabEcualizar.svelte` | Modify |
| C3 | `Sidebar.svelte` | Modify |
| C4 | `ui.svelte.ts` | Modify |
| D1 | `configPersistence.ts` | **New** |
| D2 | `Sidebar.svelte`, `+page.svelte` | Modify |
