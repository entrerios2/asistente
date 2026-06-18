# Prompts de Implementación — Fase 4: Refactoring Estructural

Este documento contiene instrucciones atómicas para ejecutar el refactoring de la Fase 4. El proyecto es una SPA SvelteKit con Svelte 5 runes (`$state`, `$derived`, `$effect`).

## ⛔ REGLAS OBLIGATORIAS — Leer antes de empezar

1. **NO AVANCES al siguiente Grupo (A→B→C→D→E→F) sin recibir aprobación explícita del usuario.** Al terminar cada grupo, reporta lo hecho y ESPERA instrucciones.
2. **NO MODIFIQUES archivos que no estén explícitamente listados en la tarea.** Si descubrís que se necesita un cambio adicional, reportalo y esperá aprobación.
3. **NO AGREGUES funcionalidad nueva** que no esté especificada en la tarea. No refactorices código adyacente "de paso". No agregues logs, tests, ni comentarios extra.
4. **NO ELIMINES comentarios existentes** a menos que la tarea lo indique expresamente.
5. **NO CAMBIES la lógica de negocio** salvo que la tarea lo especifique. Los cambios son estructurales/mecánicos.
6. **Verificá con `npm run build` al final de cada grupo.** Si falla, corregí solo lo necesario para que compile sin inventar soluciones propias.
7. **Si algo no queda claro, PREGUNTÁ** en vez de asumir.

---

# GRUPO A — Fundaciones (sin dependencias)

---

## Tarea A1: Tipar `db.ts`

**Archivo a modificar:** `src/lib/utils/db.ts`

**Contexto:** Todas las funciones usan `any`. La estructura real de los datos que se guardan/cargan es:

```typescript
interface SerializedInstantanea {
    id: string;
    name: string;
    timestamp: number;
    data: Record<string, ArrayBuffer | number[]>;
    visible: boolean;
    color: string;
    source: 'manual' | 'secuencial';
    metric: string;
    offsetY: number;
}
```

**Instrucción:**

1. Agrega la interface `SerializedInstantanea` al inicio del archivo, después de las constantes.
2. Cambia las signatures:

```diff
-export async function saveInstantanea(item: any): Promise<void> {
+export async function saveInstantanea(item: SerializedInstantanea): Promise<void> {

-export async function loadAllInstantaneas(): Promise<any[]> {
+export async function loadAllInstantaneas(): Promise<SerializedInstantanea[]> {
```

3. `deleteInstantanea` ya tiene `id: string`, no cambiar.

---

## Tarea A2: Agregar `sampleRate` al `uiStore`

**Archivo a modificar:** `src/lib/stores/ui.svelte.ts`

**Instrucción:**

En la clase `UIStore`, después de la línea `fftSize = $state(8192);` (aprox. L27), agrega:

```typescript
    sampleRate = $state(48000); // 44100 | 48000 | 96000
```

---

## Tarea A3: Alerta de Worker fallido

**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`

**Contexto:** En el constructor (L76-90), hay un try/catch que logea el error pero no notifica al usuario. Si el Worker falla, la app se abre pero no procesa DSP.

**Instrucción:**

1. Agrega una propiedad de estado al inicio de la clase `MathOrchestrator`:

```typescript
    workerError = $state<string | null>(null);
```

2. Modifica el catch del constructor para setear el error:

```diff
             } catch (e) {
-                console.error('[MathOrchestrator] Error initializing dspWorker:', e);
+                console.error('[MathOrchestrator] Error initializing dspWorker:', e);
+                this.workerError = 'No se pudo inicializar el procesador DSP. La medición no estará disponible.';
             }
```

3. En `src/routes/+page.svelte`, dentro del template, justo después de `<Header />` (L34), agrega un banner de error:

```svelte
    <Header />
    {#if mathOrchestrator.workerError}
        <div style="background: #dc2626; color: white; padding: 8px 16px; font-size: 12px; text-align: center; font-weight: 600;">
            ⚠️ {mathOrchestrator.workerError}
        </div>
    {/if}
```

4. Agrega el import de `mathOrchestrator` al bloque `<script>` de `+page.svelte`:

```typescript
    import { mathOrchestrator } from '$lib/stores/mathOrchestrator.svelte';
```

---

## Verificación Grupo A

```bash
npm run build
```

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo B.

---

# GRUPO B — Eliminar código obsoleto

---

## Tarea B1: Eliminar fallback síncrono del MathOrchestrator

**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`

**Contexto:** El método `run()` tiene dos paths: Worker (L390-424) y Fallback síncrono (L427-583). El fallback solo se ejecuta cuando `this.worker === null`. Vamos a eliminarlo y los elementos que solo él usa.

**Instrucción:**

1. **En el método `run()`**: elimina todo desde la línea que dice `// Fallback synchronous calculations inside Main Thread` (L427) hasta el cierre del método (L583, justo antes del `}`). Reemplázalo por un return vacío:

```typescript
        // Sin fallback — el Worker es obligatorio
        if (!this.worker) {
            return;
        }
```

Esto va DESPUÉS del bloque `if (this.worker) { ... return; }` (L390-424). Es decir, el código final del método `run()` después de enviar al worker debería terminar así:

```typescript
            if (this.dirty) {
                this.dirty = false;
            }
            return;
        }

        // Sin Worker disponible — no procesar
        return;
    }
```

2. **Eliminar métodos privados** que solo usaba el fallback:
   - `getPhaseValueRadians()` (~L329-350)
   - `getCoherenceValue()` (~L352-366)

3. **Eliminar imports** que solo usaba el fallback. Quitar de los imports:
   - `calculateMagnitude` y `calculatePhase`, `calculateStepResponse`, `calculateGroupDelay` de `osmMetrics` (el worker tiene su propia copia)
   - `applySourceWindow` de `sourceWindowing`
   - `WindowFunction` de `windowFunction`
   - `getWeightingGain` de `weighting`
   - `ComplexAveraging` de `averaging`
   - `deconvolve` de `deconvolution`

   **NOTA:** Verificar antes de eliminar que cada import NO se usa en otro lugar del archivo (fuera del fallback). En particular:
   - `getCoeffsForType` y `biquadResponse` — SE USAN en `updateEQCache()`. **NO eliminar.**

4. **Eliminar propiedades de clase** que solo usaba el fallback:
   - `fftInputReal`, `fftInputImag`, `fftRefReal`, `fftRefImag`, `hReal`, `hImag`
   - `averagingProcessor`, `avgInputReal`, `avgInputImag`, `windowProcessor`
   - `tempFullReal`, `tempFullImag`, `tempFullRealOut`, `tempFullImagOut`, `tempPhaseRadians`

   **NOTA:** Los buffers `outputMagnitude`, `outputPhase`, `outputCoherence`, etc. se QUEDAN porque son leídos por los Quadrants y otros consumidores después de `handleWorkerMessage`.

5. **Eliminar del `reallocateBuffers()`** las reasignaciones de los buffers eliminados en el punto 4. Conservar solo las reasignaciones de `outputMagnitude`, `outputPhase`, `outputCoherence`, `outputGroupDelay`, `outputImpulse`, `outputStep`, `outputCrestFactor`, y `eqResponseCache`.

---

## Tarea B2: Eliminar API legacy `Trace`

**Archivo a modificar:** `src/lib/stores/traceManager.svelte.ts`

**Contexto:** `traceManager` tiene una interface `Trace` y métodos wrapper (`addTrace`, `removeTrace`, `updateLiveTrace`, `captureSnapshot`, `get snapshots`, `get traces`) que son retrocompatibilidad sobre el sistema `Instantanea`. Hay 8 consumidores que deben migrarse primero.

**Instrucción paso a paso:**

### Paso 1: Migrar consumidores

**En `src/routes/+page.svelte`:**

```diff
             if (e.code === 'Space') {
                 e.preventDefault();
-                traceManager.captureSnapshot('live-1', 'Captura manual', 'manual');
+                traceManager.captureInstantaneaFromLive('Captura manual', 'manual');
             } else if (e.key >= '1' && e.key <= '9') {
                 const index = parseInt(e.key) - 1;
-                const snapshots = traceManager.snapshots;
+                const snapshots = traceManager.instantaneas;
                 if (snapshots[index]) {
                     traceManager.toggleVisibility(snapshots[index].id);
                 }
```

**En `src/lib/stores/mathOrchestrator.svelte.ts`** (método `startTimer`, ~L108):

```diff
         this.timerId = setInterval(() => {
-            const liveTrace = traceManager.traces.find((t) => t.id === "live-1");
-            this.run(liveTrace);
+            this.run(traceManager.liveFrequencyData);
         }, intervalMs);
```

Y en el método `run()`, cambiar la firma:

```diff
-    run(liveTrace: any | undefined) {
+    run(liveData: Float32Array | null) {
```

Y simplificar la obtención de datos (L380-388):

```diff
-        // Obtener la referencia de datos de entrada directa (Prompt 8/Fix)
-        let liveData: Float32Array | null = null;
-        if (liveTrace) {
-            if (liveTrace instanceof Float32Array) {
-                liveData = liveTrace;
-            } else if (liveTrace.data) {
-                liveData = liveTrace.data;
-            }
-        }
```

(Ya recibe `liveData` directamente)

**En `src/components/medicion/Quadrant.svelte`** (~L457):
Busca la línea que dice `traceManager.traces.find((t) => t.id === "live-1")` y reemplázala por el acceso directo a `traceManager.liveFrequencyData` o el mecanismo equivalente que use la capa activa.

**En `src/components/medicion/Sidebar.svelte`** (~L406-425):
Busca `traceManager.traces.some`, `traceManager.addTrace`, y `traceManager.updateLiveTrace` y reemplaza por el mecanismo directo de capas/buffer.

**En `src/components/medicion/Sidebar.svelte`** (~L2004):
Busca `traceManager.removeTrace` y reemplázalo por `traceManager.deleteInstantanea`.

### Paso 2: Verificar que el método `captureInstantaneaFromLive` existe en traceManager

Si no existe, crearlo como wrapper que captura los datos live actuales del mathOrchestrator y los guarda como nueva instantánea. Buscar el método `captureSnapshot` existente y renombrarlo/adaptarlo.

### Paso 3: Eliminar código legacy

Una vez migrados todos los consumidores, eliminar de `traceManager.svelte.ts`:
- La interface `Trace`
- El `$derived` `traces` (costoso — se evaluaba en cada tick DSP)
- Los métodos: `addTrace()`, `removeTrace()`, `updateLiveTrace()`, `captureSnapshot()`, `get snapshots`
- La propiedad `liveFrequencyData` se QUEDA si existe — es el acceso directo a los datos live

---

## Verificación Grupo B

```bash
npm run build
npm run check
```

Verificación manual:
- Abrir la app → presionar Space → verificar que captura instantánea
- Teclas 1-9 → toggle de instantáneas
- Verificar que el canvas sigue renderizando métricas

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo C.

---

# GRUPO C — Sample Rate Configurable

---

## Tarea C1: Eliminar `sampleRate` de `calibrationStore`

**Archivo a modificar:** `src/lib/stores/calibrationStore.svelte.ts`

**Instrucción:**

1. Eliminar la propiedad `sampleRate = $state<number>(48000);` (L27)
2. Buscar TODAS las referencias a `this.sampleRate` en el archivo y reemplazar por `48000` temporalmente (se actualizará en C2)

---

## Tarea C2: Propagar `uiStore.sampleRate` a todos los archivos

**Archivos a modificar:** Múltiples

**Instrucción general:** Reemplaza **cada ocurrencia literal** de `48000` por la referencia correcta al sample rate. Las reglas son:

### En stores y módulos que pueden importar `uiStore`:
Usar `uiStore.sampleRate` directamente.

**Archivos:** `mathOrchestrator.svelte.ts`, `calibrationStore.svelte.ts` (donde corresponda)

### En funciones puras de DSP (no pueden importar stores):
Agregar un parámetro `sampleRate: number`.

**Archivos y cambios específicos:**

1. **`src/lib/dsp/osmMetrics.ts`** (~L155): `const dt = 1.0 / 48000.0;`
   ```diff
   -export function calculateGroupDelay(phaseRadians: Float32Array, binWidth: number, output: Float32Array): void {
   +export function calculateGroupDelay(phaseRadians: Float32Array, binWidth: number, output: Float32Array, sampleRate: number = 48000): void {
   ```
   Y cambiar `1.0 / 48000.0` → `1.0 / sampleRate`

2. **`src/lib/dsp/interpolationEngine.ts`** (~L53, L64): `const sr = 48000;`
   Agregar `sampleRate` como parámetro a los métodos que lo usan.

3. **`src/lib/dsp/canvasRenderers.ts`** (~L769, L1012, L1055): `const sr = 48000;`
   Agregar `sampleRate` como parámetro a `drawPhaseDelay`, `drawEQOverlayPath`, y las funciones afectadas.

4. **`src/lib/dsp/canvasInteraction.ts`** (~L375): `const binWidth = 24000 / bins; // 48000 Hz / 2 / bins`
   ```diff
   -export function rebuildFrequencyLUT(bins: number) {
   +export function rebuildFrequencyLUT(bins: number, sampleRate: number = 48000) {
   ```
   Y cambiar `24000` → `sampleRate / 2`

5. **`src/lib/dsp/dspWorker.ts`** (~L61, L112, L134, L167, L507): Múltiples `48000`
   En el handler de `self.onmessage`, extraer `sampleRate` del mensaje:
   ```typescript
   const sampleRate = msg.sampleRate || 48000;
   ```
   Y reemplazar todas las ocurrencias de `48000` por `sampleRate`.
   En `mathOrchestrator.svelte.ts`, agregar `sampleRate: uiStore.sampleRate` al objeto de `postMessage` (~L398-418).

6. **`src/lib/hal/web/WebAudioProvider.ts`** (~L35, L62, L107, L139, L162, L272):
   Importar `uiStore` y reemplazar `{ sampleRate: 48000 }` por `{ sampleRate: uiStore.sampleRate }`.
   En L62: cambiar `const bufferSize = 48000;` por `const bufferSize = uiStore.sampleRate;`

7. **`src/components/medicion/Sidebar.svelte`** (~L30, L48, L56, L1109):
   - L30: Eliminar `let sampleRate = $state(48000);` — usar `uiStore.sampleRate`
   - L48: `traceManager.getTargetCurve(mathOrchestrator.BINS, 48000)` → `uiStore.sampleRate`
   - L56: `const sampleRate = 48000;` → `uiStore.sampleRate`

### En los callers dentro de Quadrant.svelte:
Busca calls a `rebuildFrequencyLUT(bins)` y agrega el segundo argumento: `rebuildFrequencyLUT(bins, uiStore.sampleRate)`.
Busca calls a funciones de `canvasRenderers` que ahora requieren `sampleRate` y pásalo.

---

## Verificación Grupo C

```bash
npm run build
npm run check
```

Verificación manual:
- Abrir Tab Config → cambiar sample rate a 44100 → verificar que el canvas re-renderiza
- Cambiar a 48000 → verificar
- Verificar que el generador de señales funciona en ambos rates

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo D.

---

# GRUPO D — Unificar Target Curves

---

## Tarea D1: Agregar presets BK y Harman a `targetTrace`

**Archivo a modificar:** `src/lib/stores/targetTrace.svelte.ts`

**Instrucción:**

Extiende el tipo de `applyPreset` y agrega los nuevos presets. Cambia:

```diff
-    applyPreset(type: 'Flat' | 'X-Curve' | 'House') {
+    applyPreset(type: 'Flat' | 'X-Curve' | 'House' | 'BK' | 'Harman') {
```

Y agrega los casos:

```typescript
        } else if (type === 'BK') {
            // B&K cinema curve — rolloff above 2 kHz
            this.points = [
                { f: 20, g: 0 },
                { f: 2000, g: 0 },
                { f: 4000, g: -1 },
                { f: 8000, g: -3 },
                { f: 16000, g: -5 },
                { f: 20000, g: -6 }
            ];
        } else if (type === 'Harman') {
            // Harman 2019 room target
            this.points = [
                { f: 20, g: 4 },
                { f: 60, g: 3 },
                { f: 200, g: 0 },
                { f: 1500, g: 0 },
                { f: 3000, g: -1 },
                { f: 5000, g: 0 },
                { f: 8000, g: -1 },
                { f: 20000, g: -2 }
            ];
        }
```

---

## Tarea D2: Migrar `getTargetCurve()` a usar `targetTrace`

**Archivo a modificar:** `src/lib/stores/traceManager.svelte.ts`

**Instrucción:**

1. Agregar import al inicio del archivo:
```typescript
import { targetTrace } from './targetTrace.svelte';
```

2. Reemplazar el método `getTargetCurve()` completo (L95-145) por:

```typescript
    getTargetCurve(bins: number, sampleRate: number = 48000): Float32Array {
        const key = `${targetTrace.name}_${bins}_${sampleRate}_${targetTrace.offset}`;
        if (this._targetCurveCache && this._targetCurveCacheKey === key) {
            return this._targetCurveCache;
        }

        const target = new Float32Array(bins);
        const binWidth = (sampleRate / 2) / bins;
        for (let i = 0; i < bins; i++) {
            const freq = Math.max(i * binWidth, 1);
            target[i] = targetTrace.getInterpolatedGain(freq);
        }

        this._targetCurveCache = target;
        this._targetCurveCacheKey = key;
        return target;
    }
```

3. Eliminar las propiedades:
   - `targetCurveType` (L89)
   - `targetCurveCustom` (L90)

---

## Tarea D3: Migrar selector UI de target curve

**Archivo a modificar:** `src/components/medicion/Sidebar.svelte`

**Instrucción:**

Buscar el selector de curva de referencia (~L1317-1336) que usa `traceManager.targetCurveType`. Reemplazar por:

```svelte
<select
    class="flex-1 rounded-md text-xs py-1.5 px-2"
    style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)"
    value={targetTrace.name}
    onchange={(e) => {
        const val = e.currentTarget.value;
        targetTrace.applyPreset(val as any);
    }}>
    <option value="Flat">Flat (0dB)</option>
    <option value="House">House curve</option>
    <option value="BK">B&K cinema</option>
    <option value="Harman">Harman 2019</option>
    <option value="X-Curve">X-Curve</option>
</select>
```

Agregar import de `targetTrace`:
```typescript
import { targetTrace } from '$lib/stores/targetTrace.svelte';
```

Eliminar la referencia al botón de importar custom si existía referenciando `traceManager.targetCurveType === 'custom'`.

---

## Verificación Grupo D

```bash
npm run build
```

Verificación manual:
- Tab EQ → cambiar curva de referencia → verificar que la curva target se actualiza en el canvas
- Verificar que las desviaciones se recalculan correctamente

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo E.

---

# GRUPO E — Extraer Tabs del Sidebar

---

## Tarea E1: Extraer `TabConfig.svelte`

**Archivos:**
- Crear: `src/components/medicion/TabConfig.svelte`
- Modificar: `src/components/medicion/Sidebar.svelte`

**Instrucción:**

1. Copiar todo el bloque dentro de `{:else if uiStore.activeTab === "config"}` (~L2100-L2680 de Sidebar) al nuevo archivo.
2. Envolver el contenido en `<script lang="ts">` con los imports necesarios:
   - `uiStore`, `calibrationStore`, `traceManager`, y `getAudioProvider` desde `$lib/hal`
   - Las variables `$state` locales que solo usa este tab (buscar cuáles son: `audioDevices`, `isLoadingDevices`, etc.)
3. En `Sidebar.svelte`, reemplazar todo ese bloque por:
```svelte
{:else if uiStore.activeTab === "config"}
    <TabConfig />
```
4. Agregar el import en Sidebar:
```typescript
import TabConfig from './TabConfig.svelte';
```

---

## Tarea E2: Extraer `TabInstantaneas.svelte`

Repetir el mismo patrón que E1 para el bloque `{:else if uiStore.activeTab === "snaps"}` (~L1770-L2099).

Variables locales que migran: `sortedSnapshots`, `sortOrder`, `editingId`, `editingName`, funciones `startEditing`, `saveEditing`, `cancelEditing`.

---

## Tarea E3: Extraer `TabEcualizar.svelte`

Repetir para `{:else if uiStore.activeTab === "eq"}` (~L1276-L1769).

Variables locales: `importTargetCurve()`, lógica de AutoEQ.

---

## Tarea E4: Extraer `TabMedicion.svelte`

Repetir para `{#if uiStore.activeTab === "medicion"}` (~L789-L1275).

Variables locales: `statusText`, `progress`, `sweepF1/F2`, `sweepDuration`, `burstDuration/Period`, `mlsOrder`, `manualDelay`.
Funciones: `startMeasurement`, `stopMeasurement`, lógica de link generador.

---

## Verificación Grupo E

```bash
npm run build
npm run check
```

Verificación manual:
- Navegar entre las 4 tabs → verificar que todo renderiza
- Tab Medición → iniciar/detener medición
- Tab Config → cambiar dispositivo de audio
- Tab Instantáneas → capturar, renombrar, eliminar
- Tab EQ → agregar/modificar bandas

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo F.

---

# GRUPO F — Extraer Componentes del Quadrant

---

## Tarea F1: Extraer `ZoomControls.svelte`

**Crear:** `src/components/medicion/ZoomControls.svelte`

**Props de entrada:**
```typescript
interface Props {
    interactionState: InteractionState;
    onDoubleClick: () => void;
}
```

**Contenido:** El bloque `<!-- BOTÓN ÚNICO DE ZOOM CON MENÚ -->` (~L1516-1551 de Quadrant).
Mover el estado `showZoomMenu` al nuevo componente.

---

## Tarea F2: Extraer `GlobalConfigPopover.svelte`

**Crear:** `src/components/medicion/GlobalConfigPopover.svelte`

**Props de entrada:**
```typescript
interface Props {
    show: boolean;
    smoothing: number;
    onClose: () => void;
    onSmoothingChange: (s: number) => void;
    onResetView: () => void;
}
```

**Contenido:** El bloque `<!-- POPOVER FLOTANTE ABSOLUTO OSM (CONFIGURACIÓN GLOBAL) -->` (~L1553-1633).

---

## Tarea F3: Extraer `MetricConfigPopover.svelte`

**Crear:** `src/components/medicion/MetricConfigPopover.svelte`

**Props de entrada:**
```typescript
interface Props {
    activeConfigMetric: string | null;
    metricConfigs: Record<string, any>;
    metricStyles: Record<string, { color: string; lineWidth: number; lineDash: number[] }>;
    onClose: () => void;
    onRemoveMetric: (name: string) => void;
}
```

**Contenido:** El bloque `<!-- POPOVER DE CONFIGURACIÓN POR MÉTRICA -->` (~L1636-1876). Es el más grande (~240 líneas de template).

---

## Tarea F4: Extraer `AddMetricDropdown.svelte`

**Crear:** `src/components/medicion/AddMetricDropdown.svelte`

**Props de entrada:**
```typescript
interface Props {
    allMetrics: Array<{ name: string; label: string }>;
    activeMetrics: string[];
    isMetricDisabled: (name: string) => boolean;
    onToggleMetric: (name: string) => void;
}
```

**Contenido:** El botón "+" y su dropdown (~L1287-1326).

---

## Tarea F5: Extraer `LayerPanel.svelte`

**Crear:** `src/components/medicion/LayerPanel.svelte`

**Props de entrada:**
```typescript
interface Props {
    quadrantId: string;
    quadrantLayers: any[];
    showEQOverlay: boolean;
    onToggleEQ: () => void;
}
```

**Contenido:** El botón de capas con badge + todo el dropdown de gestión de capas (~L1352-1490). Mover los estados `showLayerDropdown`, `showAddLayerMenu`, `showSnapshotSubmenu` al nuevo componente.

---

## Tarea F6: Extraer `quadrantState.ts` (módulo de estado/defaults)

**Crear:** `src/lib/dsp/quadrantState.ts`

**Contenido:** Mover las definiciones de `allMetrics`, `defaultMetricStyles`, `defaultMetricConfigs` y sus tipos TypeScript desde el `<script>` de Quadrant.svelte. Exportarlas para que Quadrant y los sub-componentes las importen.

---

## Verificación Grupo F

```bash
npm run build
npm run check
```

Verificación manual:
- Abrir un cuadrante → clic en "+" → agregar métrica
- Clic en pill de métrica → se abre config popover
- Clic en engranaje → se abre global config
- Gestionar capas (agregar, ocultar, eliminar)
- Zoom menú funciona correctamente
- Cambiar color/grosor/estilo de una métrica

### ⛔ STOP — Fase 4 completada. Reportá todos los cambios al usuario.

---

# Resumen de archivos por tarea

| Tarea | Archivos | Tipo |
|-------|----------|------|
| A1 | `db.ts` | Modify |
| A2 | `ui.svelte.ts` | Modify |
| A3 | `mathOrchestrator.svelte.ts`, `+page.svelte` | Modify |
| B1 | `mathOrchestrator.svelte.ts` | Modify (eliminación masiva) |
| B2 | `traceManager.svelte.ts`, `+page.svelte`, `mathOrchestrator.svelte.ts`, `Quadrant.svelte`, `Sidebar.svelte` | Modify |
| C1 | `calibrationStore.svelte.ts` | Modify |
| C2 | 10+ archivos | Modify |
| D1 | `targetTrace.svelte.ts` | Modify |
| D2 | `traceManager.svelte.ts` | Modify |
| D3 | `Sidebar.svelte` | Modify |
| E1-E4 | `Sidebar.svelte` + 4 nuevos archivos | New + Modify |
| F1-F6 | `Quadrant.svelte` + 6 nuevos archivos/módulos | New + Modify |
