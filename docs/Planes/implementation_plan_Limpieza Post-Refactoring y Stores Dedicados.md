# Fase 5 — Limpieza Post-Refactoring y Stores Dedicados

Correcciones de residuos, unificación de duplicados y creación de stores dedicados para EQ y persistencia de configuración.

---

## Contexto

Tras la Fase 4 se identificaron 10 hallazgos (H1-H10) en la auditoría. Esta fase aborda los más impactantes, agrupados en 4 bloques ordenados por dependencia.

---

## Propuestos Cambios

### GRUPO A — Correcciones rápidas (sin dependencias)

#### A1: Mover `hReal`/`hImag` al resultado del Worker (Nyquist)

[Quadrant.svelte:L863](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L863) usa `mathOrchestrator.hReal` y `mathOrchestrator.hImag` para dibujar Nyquist. Pero estos buffers ya no se llenan porque el fallback síncrono fue eliminado en B1 (Fase 4). El worker SÍ calcula `hReal`/`hImag` internamente pero no los envía de vuelta.

**Cambio:**
- En [dspWorker.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/dspWorker.ts): incluir `hReal` y `hImag` en el `postMessage` de `dsp-results`
- En [mathOrchestrator.svelte.ts:handleWorkerMessage](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts#L85): recibir y asignar los buffers
- Eliminar las reasignaciones de `hReal`/`hImag` en `reallocateBuffers()` (se recrearán desde el worker)

**Riesgo:** Bajo — afecta solo la métrica Nyquist

---

#### A2: Propagar `uiStore.sampleRate` a los wrappers de interpolación en Quadrant

En [Quadrant.svelte:L240-252](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L240-L252), los wrappers no pasan `sampleRate`:

```diff
 function getMetricValueInterpolated(freq: number, dataArray: Float32Array): number {
-    return interpEngine.getMetricValueInterpolated(freq, dataArray);
+    return interpEngine.getMetricValueInterpolated(freq, dataArray, uiStore.sampleRate);
 }

 function getImpulseValueInterpolated(timeMs: number, impulseArray: Float32Array): number {
-    return interpEngine.getImpulseValueInterpolated(timeMs, impulseArray);
+    return interpEngine.getImpulseValueInterpolated(timeMs, impulseArray, uiStore.sampleRate);
 }
```

**Riesgo:** Nulo

---

#### A3: Simplificar `liveTrace` en el draw loop

El objeto `liveTrace` en [Quadrant.svelte:L355-367](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L355-L367) se crea cada frame. Tras revisar sus usos reales:

| Uso | Línea | Acceso real |
|-----|-------|-------------|
| `liveTrace.data` para spectrum/spectrogram | L393, L394, L431, L752 | `traceManager.liveFrequencyData` |
| `liveTrace` como parámetro de `drawSpectrumPath` | L752 | Solo accede a `.data` |
| `liveTrace` en crosshair | L971 | Solo accede a `.data` |

**Cambio:** Eliminar la construcción del objeto `liveTrace` y reemplazar por acceso directo a `traceManager.liveFrequencyData` (que ya se importa). Adaptar `drawSpectrumPath` y `drawCrosshair` para recibir el `Float32Array` directamente.

> [!IMPORTANT]
> Verificar en [canvasRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts) qué propiedades de `liveTrace` usa cada función y ajustar la firma.

---

#### A4: Eliminar import `palettes` no usado en quadrantState.ts

```diff
-import { palettes, type PaletteType } from "./colorPalettes";
+import { type PaletteType } from "./colorPalettes";
```

---

#### A5: Tipar `timerId` en MathOrchestrator

```diff
-    private timerId: any = null;
+    private timerId: ReturnType<typeof setInterval> | null = null;
```

---

### GRUPO B — Unificar colores de métricas

#### B1: Eliminar `METRIC_COLORS` duplicado en Quadrant

[Quadrant.svelte:L152-162](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L152-L162) define `METRIC_COLORS` hardcodeado. Esto duplica los colores que ya existen en:
- `defaultMetricStyles` (importado de `quadrantState.ts`) → para métricas configurables
- `allMetrics` → para las 15 métricas registradas

**Cambio:**
1. Derivar los colores desde `allMetrics` en lugar de hardcodearlos:

```typescript
// Derivar desde la fuente de verdad
const METRIC_COLORS: Record<string, string> = Object.fromEntries(
    allMetrics.map(m => [m.name, m.color])
);
```

2. Actualizar los bloques de draw en L532-537 y L631-636 que tienen los colores inline:

```diff
-                let color = "#ff4444";
-                if (metric === "Phase") color = "#d946ef";
-                else if (metric === "Coherence") color = "#eab308";
-                else if (metric === "Spectrum") color = "#a855f7";
-                else if (metric === "Group Delay") color = "#10b981";
-                else if (metric === "Simulated Magnitude") color = "#00ffff";
+                const color = metricStyles[metric]?.color || METRIC_COLORS[metric] || '#ff4444';
```

**Riesgo:** Bajo — cambio visual solo si algún color difiere entre las fuentes (ya verificado que coinciden)

---

### GRUPO C — Crear `eqStore.svelte.ts`

#### C1: Extraer estado EQ a store dedicado

Estado actual: las bandas de EQ (gráficas y paramétricas), `showEQ`, `eqType`, `graphicBands[]`, `parametricFilters[]` viven en [Sidebar.svelte:L11-114](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L11-L114) y se pasan por `bind:` a TabEcualizar.

**Problemas:**
1. Se pierden si Sidebar se desmonta
2. No hay persistencia entre sesiones
3. `eqType` duplicado entre Sidebar y `uiStore` con doble `$effect` (L13-18)

**Cambio:** Crear `src/lib/stores/eqStore.svelte.ts` con:

```typescript
class EQStore {
    eqType = $state<'grafico' | 'parametrico'>('grafico');
    showEQ = $state(true);
    numGraphicBands = $state(10);
    customBandCount = $state(false);
    isCalculatingAutoEQ = $state(false);
    autoEQSourceLayer = $state<string>('active');
    
    graphicBands = $state<GraphicBand[]>([
        { freq: 31, gain: 0 }, { freq: 63, gain: 0 },
        // ... (mover los 10 defaults desde Sidebar)
    ]);

    parametricFilters = $state<ParametricFilter[]>([
        // ... (mover los 6 defaults desde Sidebar)
    ]);
}
export const eqStore = new EQStore();
```

**Archivos afectados:**
- **[NEW]** `src/lib/stores/eqStore.svelte.ts`
- **[MODIFY]** `src/components/medicion/Sidebar.svelte` — eliminar L11-138 de estado EQ y los $effects de sincronización. Importar `eqStore`
- **[MODIFY]** `src/components/medicion/TabEcualizar.svelte` — cambiar de `bind:` props a import directo de `eqStore`
- **[MODIFY]** `src/lib/stores/ui.svelte.ts` — eliminar `eqType` (L41) ya que vivirá en `eqStore`

> [!IMPORTANT]
> La sincronización reactiva con `traceManager.eqBands` (Sidebar L117-138) debe moverse al constructor de `eqStore` como `$effect.root`.

---

### GRUPO D — Persistencia robusta de configuración

#### D1: Crear `configPersistence.ts`

Estado actual: [Sidebar.svelte:L141-181](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L141-L181) tiene load/save con `localStorage` dentro de `onMount`/`$effect`. Problemas:
- El `$effect` de save se ejecuta en el primer render (guarda data parcial)
- No incluye `sampleRate`, `fftSize`, `dspUpdateRate`
- Tiene migración legacy `isDarkMode`

**Cambio:** Crear `src/lib/utils/configPersistence.ts`:

```typescript
const CONFIG_KEY = 'asistente_config';
const CONFIG_VERSION = 2;

interface PersistedConfig {
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

export function loadConfig(): Partial<PersistedConfig> | null { ... }
export function saveConfig(config: PersistedConfig): void { ... }
```

**Con:**
- Throttle de 1 segundo (debounce) en save
- Schema version para migraciones
- Migración automática de v1 (`isDarkMode` → `themeMode`)

**Archivos afectados:**
- **[NEW]** `src/lib/utils/configPersistence.ts`
- **[MODIFY]** `src/components/medicion/Sidebar.svelte` — eliminar `onMount` load + `$effect` save, importar las funciones
- **[MODIFY]** `src/routes/+page.svelte` o nuevo `+layout.svelte` — mover el load de config a un nivel superior

---

## Verificación

```bash
npm run build
```

- Verificar que Nyquist sigue renderizando (A1)
- Verificar que el cambio de sampleRate afecta interpolación correctamente (A2)
- Tab EQ → cambiar bandas → verificar que `traceManager.eqBands` se sincroniza (C1)
- Cerrar y reabrir la app → verificar que configuración persiste incluyendo sampleRate (D1)

---

## Resumen de Archivos

| Tarea | Archivos | Tipo |
|-------|----------|------|
| A1 | `dspWorker.ts`, `mathOrchestrator.svelte.ts` | Modify |
| A2 | `Quadrant.svelte` | Modify |
| A3 | `Quadrant.svelte`, `canvasRenderers.ts` | Modify |
| A4 | `quadrantState.ts` | Modify |
| A5 | `mathOrchestrator.svelte.ts` | Modify |
| B1 | `Quadrant.svelte` | Modify |
| C1 | `eqStore.svelte.ts` (NEW), `Sidebar.svelte`, `TabEcualizar.svelte`, `ui.svelte.ts` | New + Modify |
| D1 | `configPersistence.ts` (NEW), `Sidebar.svelte`, `+page.svelte` | New + Modify |
