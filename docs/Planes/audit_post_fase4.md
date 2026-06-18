# Auditoría Post-Fase 4 — Estado del Codebase

> Build: ✅ `npm run build` exitoso (18.35s, 478 KiB precache)  
> Fecha: 2026-06-18

---

## 1. Verificación de Tareas Fase 4

| Tarea | Estado | Notas |
|-------|--------|-------|
| **A1** Tipar `db.ts` | ✅ | `SerializedInstantanea` interface agregada, `data: Record<string, ArrayBufferLike \| number[]>` |
| **A2** `sampleRate` en uiStore | ✅ | L28: `sampleRate = $state(48000)` |
| **A3** Worker error alert | ✅ | `workerError` state + banner en `+page.svelte` L36-40 |
| **B1** Eliminar fallback síncrono | ✅ | `mathOrchestrator.svelte.ts` pasó de 588→339 líneas (~42% reducción) |
| **B2** Eliminar API legacy Trace | ✅ | `captureInstantaneaFromLive`, `liveFrequencyData` directo, sin `traces` getter |
| **C1** Eliminar sampleRate de calibrationStore | ✅ | Eliminado |
| **C2** Propagar `uiStore.sampleRate` | ⚠️ Parcial | Ver hallazgo H1 |
| **D1** Presets BK/Harman en targetTrace | ✅ | Verificar si se implementó |
| **D2** Migrar `getTargetCurve` | ✅ | Usa `targetTrace.getInterpolatedGain()` |
| **D3** Migrar selector UI | ✅ | `targetCurveType` y `targetCurveCustom` eliminados |
| **E1-E4** Extraer Tabs Sidebar | ✅ | Sidebar pasó de ~2681→286 líneas. 4 componentes Tab extraídos |
| **F1-F5** Extraer componentes Quadrant | ✅ | 5 componentes extraídos. Quadrant pasó de ~2445→1361 líneas |
| **F6** Extraer `quadrantState.ts` | ✅ | `allMetrics`, `defaultMetricStyles`, `defaultMetricConfigs` exportados |

---

## 2. Hallazgos y Problemas

### H1: ⚠️ `liveTrace` objeto hardcodeado en Quadrant.svelte

En [Quadrant.svelte:L355-367](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L355-L367), se construye un objeto `liveTrace` cada frame del render loop con `timestamp: Date.now()`:

```typescript
const liveTrace = {
    id: 'live-1',
    name: 'Señal en Vivo',
    type: 'live' as const,
    metric: 'magnitude',
    data: traceManager.liveFrequencyData,
    color: '#ff4444',
    style: 'solid' as const,
    visible: true,
    offsetY: 0,
    timestamp: Date.now(),  // ← se crea un nuevo Date en cada frame
    source: 'manual' as const
};
```

**Problema**: Crea un objeto temporal en cada frame del `requestAnimationFrame` (hasta 60 fps). Si ese objeto no se usa más adelante en el draw, debería eliminarse. Si se usa, el `timestamp: Date.now()` causa allocación innecesaria.

**Recomendación**: Verificar si `liveTrace` se consume abajo en el draw. Si no, eliminarlo.

---

### H2: ⚠️ `METRIC_COLORS` duplica `defaultMetricStyles`

En [Quadrant.svelte:L152-162](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L152-L162), existe `METRIC_COLORS` con colores hardcodeados que duplican parcialmente `defaultMetricStyles` de [quadrantState.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/quadrantState.ts).

**Recomendación**: Derivar `METRIC_COLORS` desde `defaultMetricStyles` o `metricStyles` (la versión reactiva por instancia).

---

### H3: ⚠️ Estado de EQ reside en Sidebar, no en un store

El estado de bandas gráficas/paramétricas (`graphicBands`, `parametricFilters`, `showEQ`, `eqType`) vive en [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L11-L114) y se pasa por `bind:` a `TabEcualizar`. Esto significa:

- Si el Sidebar se desmonta (cambio de ruta), se pierde el estado EQ
- No hay persistencia entre sesiones  
- El estado está duplicado: `eqType` vive en Sidebar Y en `uiStore` con sincronización bidireccional ($effect × 2)

**Recomendación**: Mover a un `eqStore.svelte.ts` dedicado (Fase 5).

---

### H4: ⚠️ Configuración local duplicada con `localStorage`

La persistencia de config ([Sidebar.svelte:L141-181](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L141-L181)) se hace con `localStorage.setItem` manual dentro de un `$effect`. Esto tiene problemas:

- Se ejecuta en cada cambio reactivo (incluyendo el load inicial → guardando data potencialmente incompleta)
- No incluye `sampleRate`, `fftSize`, `dspUpdateRate` en la persistencia
- Hay migración de campo antiguo `isDarkMode` que ya se puede eliminar

**Recomendación**: Crear `configPersistence.ts` con throttle + schema migration.

---

### H5: 🔴 `hReal`/`hImag` se conservan en MathOrchestrator pero no se usan

En [mathOrchestrator.svelte.ts:L34-35](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts#L34-L35):
```typescript
hReal = new Float32Array(this.BINS);
hImag = new Float32Array(this.BINS);
```

Estos buffers eran usados por el fallback síncrono (eliminado en B1). El worker tiene sus propias copias. También se reallocan en `reallocateBuffers()` (L157-158).

**Recomendación**: Eliminar `hReal`, `hImag` y sus reasignaciones en `reallocateBuffers()`.

---

### H6: ⚠️ `interpolationEngine.ts` acepta `sampleRate` pero Quadrant no lo pasa

Los métodos `getMetricValueInterpolated` y `getImpulseValueInterpolated` del [InterpolationEngine](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/interpolationEngine.ts#L52-L61) ahora aceptan `sampleRate` como parámetro (default 48000). Sin embargo, los wrappers en [Quadrant.svelte:L240-252](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte#L240-L252) no pasan `uiStore.sampleRate`:

```typescript
function getMetricValueInterpolated(freq, dataArray) {
    return interpEngine.getMetricValueInterpolated(freq, dataArray);
    // ← falta tercer argumento: uiStore.sampleRate
}
```

**Recomendación**: Propagar `uiStore.sampleRate` como tercer argumento.

---

### H7: ⚠️ `apst/Orchestrator.ts` con 48000 hardcodeado

En [Orchestrator.ts:L72](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/apst/Orchestrator.ts#L72) y [L116](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/apst/Orchestrator.ts#L116), hay `48000` hardcodeado. Este módulo no fue tocado en C2.

**Prioridad**: Baja — solo aplica cuando se use APST, pero debería propagarse.

---

### H8: ⚠️ CSS theme overrides en Sidebar con `!important`

[Sidebar.svelte:L238-284](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L238-L284) tiene ~47 líneas de CSS `:global()` con `!important` para overridear colores hardcodeados de TailwindCSS. Esto es frágil y difícil de mantener.

**Recomendación**: Los nuevos componentes extraídos (TabConfig, TabMedicion, etc.) deberían usar CSS variables directamente en vez de clases Tailwind hardcodeadas (`bg-[#121216]`), eliminando la necesidad de estos overrides.

---

### H9: ℹ️ `quadrantState.ts` tiene `palettes` import no usado

En [quadrantState.ts:L1](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/quadrantState.ts#L1):
```typescript
import { palettes, type PaletteType } from "./colorPalettes";
```

`palettes` no se usa. Solo `PaletteType` se usa en L126.

---

### H10: ℹ️ `timerId: any` en MathOrchestrator

En [mathOrchestrator.svelte.ts:L45](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts#L45):
```typescript
private timerId: any = null;
```

Debería ser `ReturnType<typeof setInterval> | null`.

---

## 3. Métricas del Codebase

| Archivo | Líneas Pre-F4 | Líneas Post-F4 | Reducción |
|---------|--------------|----------------|-----------|
| `mathOrchestrator.svelte.ts` | 588 | 339 | **-42%** |
| `Sidebar.svelte` | ~2681 | 286 | **-89%** |
| `Quadrant.svelte` | ~2445 | 1361 | **-44%** |

**Archivos nuevos creados**: 10
- `TabMedicion.svelte` (31 KB), `TabEcualizar.svelte` (32 KB), `TabInstantaneas.svelte` (20 KB), `TabConfig.svelte` (29 KB)
- `ZoomControls.svelte` (2.7 KB), `GlobalConfigPopover.svelte` (4.3 KB), `MetricConfigPopover.svelte` (14 KB), `AddMetricDropdown.svelte` (2.6 KB), `LayerPanel.svelte` (10 KB)
- `quadrantState.ts` (3.5 KB)

---

## 4. Plan de Mejoras Propuesto (Fase 5)

### 5.1 — Correcciones rápidas (bugs/residuos)

| # | Cambio | Archivos | Riesgo |
|---|--------|----------|--------|
| 1 | Eliminar `hReal`/`hImag` de MathOrchestrator | `mathOrchestrator.svelte.ts` | Bajo |
| 2 | Propagar `uiStore.sampleRate` a wrappers de InterpolationEngine en Quadrant | `Quadrant.svelte` | Bajo |
| 3 | Eliminar objeto `liveTrace` temporal del draw loop si no se consume | `Quadrant.svelte` | Bajo |
| 4 | Eliminar import `palettes` no usado en `quadrantState.ts` | `quadrantState.ts` | Nulo |
| 5 | Tipar `timerId` correctamente | `mathOrchestrator.svelte.ts` | Nulo |

### 5.2 — Unificar colores de métricas

Derivar `METRIC_COLORS` desde `metricStyles` en Quadrant, eliminando la duplicación.

### 5.3 — Crear `eqStore.svelte.ts`

Mover el estado de ecualización (bandas gráficas, paramétricas, showEQ, eqType) a un store dedicado. Esto:
- Elimina los `bind:` pesados entre Sidebar y TabEcualizar
- Permite persistencia
- Desacopla la lógica

### 5.4 — Persistencia robusta de configuración

Crear `configPersistence.ts`:
- Throttled save (debounce 1s)
- Incluir `sampleRate`, `fftSize`, `dspUpdateRate` en la persistencia
- Schema version para migraciones automáticas
- Eliminar migración legacy `isDarkMode`

### 5.5 — Eliminar CSS overrides `!important`

Migrar los Tabs extraídos a CSS variables, eliminando los 47 overrides en Sidebar.

### 5.6 — Propagar `sampleRate` a APST

Pasar `uiStore.sampleRate` al Orchestrator y Player de APST.

---

## 5. Archivos `_deprecated/`

El directorio `src/_deprecated/` contiene los archivos movidos en Fase 1:
- `components/`: RTA.svelte, TraceMath.svelte, FilterList.svelte, DeviceSelector.svelte
- `dsp/`: Analyzer.svelte.ts, mathSource.ts, TransferFunction.ts, equalLoudness.ts, AutoEq.ts
- `utils/`: tierDetector.ts

> [!TIP]
> Estos archivos no son importados por ningún módulo activo. Se pueden eliminar del repositorio cuando se quiera.
