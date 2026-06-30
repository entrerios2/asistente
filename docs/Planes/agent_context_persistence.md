# Contexto para Agente: Persistencia Completa de Configuración

## Objetivo
Extender el sistema de persistencia para que TODOS los controles y opciones sean guardados/cargados, incluyendo la configuración por cuadrante (métricas activas, estilos, opciones de cada métrica).

## Discrepancia Conocida
> [!WARNING]
> El código en `configPersistence.ts` busca `defaults.ca.json` pero el archivo en `static/` se llama `default.ca.json`. Unificar a un solo nombre.

---

## Arquitectura Actual de Persistencia

### Archivos Clave

| Archivo | Rol |
|---------|-----|
| [configPersistence.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/utils/configPersistence.ts) | Interface `PersistedConfig`, funciones `loadConfig/saveConfig/exportConfig/importConfig/loadDefaults` |
| [+page.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/+page.svelte) | Carga config en `onMount` vía `applyConfig()`, guarda en `$effect` vía `saveConfig()` |
| [ui.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/ui.svelte.ts) | Store global de UI con `$state` |
| [eqStore.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/eqStore.svelte.ts) | Store de EQ con `loadFromConfig()`/`toConfig()` |
| [targetTrace.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/targetTrace.svelte.ts) | Target trace con `loadFromConfig()`/`toConfig()` |
| [calibrationStore.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/calibrationStore.svelte.ts) | Calibración con `loadFromConfig()`/`toConfig()` |
| [traceManager.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/traceManager.svelte.ts) | Capas/snapshots con `loadFromConfig()`/`toConfig()` |
| [TabConfig.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabConfig.svelte) | UI de exportar/importar `.ca.json`, construye `buildCurrentConfig()` |

### Flujo Actual

```
Arranque:
  localStorage → loadConfig() → applyConfig()
  Si no hay localStorage → loadDefaults(base) → fetch /defaults.ca.json → applyConfig()
  Fallback → hardcoded en stores

Guardado reactivo:
  $effect en +page.svelte → saveConfig({...}) → localStorage (debounced 1s)

Exportar:
  TabConfig → buildCurrentConfig() → exportConfig() → descarga .ca.json

Importar:
  TabConfig → archivo .ca.json → importConfig() → applyConfig()
```

### Patrón de un Store con Persistencia
Cada store expone:
- `loadFromConfig(config: Partial<PersistedConfig>)`: aplica valores del config
- `toConfig()`: retorna objeto parcial para spread en saveConfig

---

## Lo que YA se Persiste

### uiStore (directamente en +page.svelte)
- layout, themeMode, palette, canvasTheme
- audioInDevice, audioOutDevice, sampleRate, fftSize
- dspBaseRate, targetFpsMultiplier, metricDecimation
- weightingType, averagingType, averagingDepth, averagingAlpha
- besselSpeed, ppoSmoothing, fftOverlap, windowType
- inputGain, displayOffset, polarity, inputFilter
- compensationDelayMs, autoDelayCompensation
- refChannel, measChannel
- generatorType, genFreq, genLevel, genRouting
- linkGeneratorToMeasurement
- enableLeq, leqWindowSeconds, averagingThresholdDb
- enableSourceWindow, sourceWindowWidthMs, sourceWindowOffsetMs
- autoSaveSnapshotOnStop, measurementMode
- showAdvanced, showMinorGrid, targetFps

### eqStore (vía toConfig/loadFromConfig)
- eqType, showEQ, graphicBands, parametricFilters
- autoEQ* (algoritmo, parámetros)

### targetTrace
- targetPoints, targetVisible, targetColor, targetOpacity, targetOffset, targetName

### calibrationStore
- calibrationPoints, calibrationFilename

### traceManager
- metricsToCapture, tagPresets

---

## Lo que NO se Persiste (a implementar)

### 1. Estado por Cuadrante (NUEVO — requiere estructura)

Cada cuadrante (`q-1`, `q-2`, etc.) tiene estado local en [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte) que NO se persiste:

```typescript
// Línea 49: Métricas activas por cuadrante
let activeMetrics = $state<string[]>(["Magnitude"]);

// Líneas 81-83: Estilos de métrica (color, lineWidth, lineDash)
let metricStyles = $state<Record<string, { color; lineWidth; lineDash }>>(
    JSON.parse(JSON.stringify(defaultMetricStyles))
);

// Líneas 87-89: Configuración de cada métrica (smoothingPPO, unwrapMode, etc.)
let metricConfigs = $state<Record<string, MetricConfig>>(
    JSON.parse(JSON.stringify(defaultMetricConfigs))
);
```

#### Tipos involucrados

**MetricConfig** (de [quadrantState.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/quadrantState.ts#L212-L238)):
```typescript
interface MetricConfig {
    modeY?: 'dB' | 'Linear' | 'Impedance' | 'ETC';
    sensorResistance?: number;
    smoothingPPO?: number;
    invertY?: boolean;
    enableCoherence?: boolean;
    coherenceThreshold?: number;
    coherenceMode?: 'attenuate' | 'color';
    coherenceColor?: string;
    yShift?: number;
    hidden?: boolean;
    unwrapMode?: '±180' | '360' | 'Unwrap';
    rotate?: number;
    range?: number;
    cohType?: string;
    showLine?: boolean;
    showBackground?: boolean;
    bgPalette?: string;
    showThresholdLine?: boolean;
    thresholdColor?: string;
    thresholdValue?: number;
    palette?: PaletteType;
}
```

**MetricStyle** (de [quadrantState.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/quadrantState.ts#L240-L255)):
```typescript
interface MetricStyle {
    color: string;
    lineWidth: number;
    lineDash: number[];
}
```

**Defaults** (de [quadrantState.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/quadrantState.ts#L257-L264)):
```typescript
const defaultMetricConfigs = {
    "Spectrum": { modeY: "dB", smoothingPPO: 48, enableCoherence: false, ... },
    "Magnitude": { modeY: "dB", smoothingPPO: 48, enableCoherence: true, ... },
    "Phase": { unwrapMode: "±180", rotate: 0, range: 360, ... },
    "Coherence": { cohType: "normal", showLine: true, ... },
    ...
};
const defaultMetricStyles = {
    "Magnitude": { color: "#ff4444", lineWidth: 1, lineDash: [] },
    "Phase": { color: "#d946ef", ... },
    ...
};
```

#### Estructura propuesta para PersistedConfig

```typescript
// En PersistedConfig agregar:
quadrants?: Record<string, {
    activeMetrics: string[];
    metricStyles?: Record<string, MetricStyle>;
    metricConfigs?: Record<string, MetricConfig>;
}>;
```

Ejemplo en JSON:
```json
{
    "quadrants": {
        "q-1": {
            "activeMetrics": ["Magnitude", "Phase"],
            "metricStyles": {
                "Magnitude": { "color": "#ff4444", "lineWidth": 2, "lineDash": [] }
            },
            "metricConfigs": {
                "Magnitude": { "smoothingPPO": 24, "enableCoherence": true },
                "Phase": { "unwrapMode": "Unwrap" }
            }
        },
        "q-2": {
            "activeMetrics": ["Coherence"],
            "metricConfigs": {}
        }
    }
}
```

### 2. Controles de uiStore que faltan

Los siguientes campos de `uiStore` existen como `$state` pero NO se incluyen en el `$effect` de saveConfig ni en applyConfig:

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `showSidebar` | boolean | true | Sidebar visible |
| `activeTab` | string | 'medicion' | Tab activo del sidebar |

### 3. Interacción de Zoom/Pan (InteractionState)

El estado de zoom/pan de cada cuadrante (offsets, escalas) está en [canvasInteraction.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts) como un objeto mutable. NO se persiste. Evaluar si vale la pena persistirlo.

---

## Plan de Implementación

### Paso 1: Agregar `quadrants` a PersistedConfig
En [configPersistence.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/utils/configPersistence.ts) agregar el campo `quadrants?` a la interface.

### Paso 2: Exponer estado del cuadrante
El `Quadrant.svelte` es un componente que se instancia N veces. Opciones:
- **Opción A (recomendada)**: Crear un store reactivo `quadrantConfigStore` (similar a `eqStore`) que tenga un `Record<string, QuadrantConfig>`. Cada `Quadrant` lee/escribe su config desde ahí por su `id`.
- **Opción B**: Pasar callbacks desde `+page.svelte` a través de `ViewGrid` → `Quadrant` para reportar cambios.

### Paso 3: Conectar al ciclo de persistencia
- En `+page.svelte`, incluir `quadrantConfigStore.toConfig()` en el `$effect` de saveConfig
- En `applyConfig()`, llamar `quadrantConfigStore.loadFromConfig(config)`
- En `TabConfig.svelte`, incluir en `buildCurrentConfig()`

### Paso 4: Persistir controles faltantes de uiStore
Agregar `showSidebar` y `activeTab` al saveConfig/applyConfig/PersistedConfig.

### Paso 5: Corregir nombre del archivo de defaults
Unificar `default.ca.json` ↔ `defaults.ca.json`.

---

## Reglas del Proyecto

1. **NO AVANZAR SIN PREGUNTAR** — Responder consultas y esperar instrucciones explícitas
2. El stack es **SvelteKit + Svelte 5** con `$state`, `$derived`, `$effect`
3. La persistencia usa **localStorage** con debounce + archivos `.ca.json` para export/import
4. Los stores usan el patrón `class` con Svelte 5 runes (`$state`, `$derived`)
5. Base path para GitHub Pages: `/asistente`
6. El archivo de defaults del sitio va en `static/` y se carga con `fetch(base + '/defaults.ca.json')`
