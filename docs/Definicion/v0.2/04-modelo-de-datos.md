# 4. Modelo de Datos

Este documento describe todos los tipos, interfaces y stores del sistema. Es el punto de referencia para entender qué datos maneja la aplicación y cómo fluyen entre módulos.

---

## 4.1. HAL — Hardware Abstraction Layer (`lib/hal/types.ts`)

```typescript
// Tipo base para bloques de audio
type AudioBufferChunk = Float32Array;

// Callbacks que recibe el HAL desde la aplicación
interface AudioListener {
    onAudioData(data: AudioBufferChunk): void;
    onFrequencyData?(data: Float32Array): void;
    onTimeDomainData?(measSamples: Float32Array, refSamples?: Float32Array): void;
}

// Dispositivo de audio detectado
interface AudioDevice {
    id: string;            // Identificador único
    name: string;          // Nombre mostrable
    backend: string;       // 'WASAPI' | 'ASIO' | 'CoreAudio' | 'WebAudio'
    direction: 'input' | 'output';
    channels: number;
}

// Tipos de señal que puede generar el sistema
type SignalType = 'white' | 'pink' | 'brown' | 'music-noise' | 'sine'
                | 'sweep' | 'burst' | 'sinburst' | 'mls';

// Contrato que deben cumplir WebAudioProvider y TauriAudioProvider
interface AudioProvider {
    startCapture(listener: AudioListener): Promise<void>;
    stopCapture(): void;
    playGenerator(type: SignalType, active: boolean, freq: number,
                  level: number, routing: 'L' | 'R' | 'Stereo'): void | Promise<void>;
    playSample?(url: string): Promise<void>;
    onMessage?(callback: (message: any) => void): void;
    listDevices?(): Promise<AudioDevice[]>;
    selectDevice?(id: string, direction: 'input' | 'output'): Promise<void>;
    getSharedBuffer?(): SharedArrayBuffer | null;
    sendWorkletMessage?(msg: any): void;
}
```

> **Factory**: `lib/hal/index.ts` — `createAudioProvider()` detecta el entorno y retorna el provider adecuado.

---

## 4.2. DSP Worker — Mensajes (`lib/dsp/dspWorker.ts`)

### Mensaje entrante (main → worker)

```typescript
interface DSPWorkerMessage {
    type: 'process' | 'init' | 'updateConfig';
    // process:
    measTimeDomain?: Float32Array;
    refTimeDomain?: Float32Array;
    // init / updateConfig:
    BINS?: number;
    FFT_SIZE?: number;
    sampleRate?: number;
    windowType?: WindowType;
    weightingType?: WeightingType;
    averagingType?: AveragingType;
    averagingDepth?: number;
    averagingAlpha?: number;
    averagingThresholdDb?: number;
    enableSourceWindow?: boolean;
    sourceWindowWidthMs?: number;
    sourceWindowOffsetMs?: number;
    compensationDelaySamples?: number;
    autoDelayCompensation?: boolean;
    inputGain?: number;
    displayOffset?: number;
    polarity?: PolarityType;
    calibrationGain?: Float32Array;
    inputFilter?: InputFilterType;
    besselSpeed?: BesselFrequency;
    ppoSmoothing?: number;
    fftOverlap?: number;
    metrics?: MetricType[];
}
```

### Mensaje saliente (worker → main)

```typescript
interface DSPWorkerResult {
    type: 'dsp-results';
    outputMagnitude: Float32Array;      // Magnitud (dB)
    outputPhase: Float32Array;          // Fase (grados, ±180 o unwrapped)
    outputCoherence: Float32Array;      // Coherencia (0-1)
    outputGroupDelay: Float32Array;     // Retardo de grupo (ms)
    outputImpulse: Float32Array;        // Respuesta al impulso
    outputStep: Float32Array;           // Respuesta al escalón
    outputCrestFactor?: Float32Array;   // Factor de cresta
    outputSpectrum?: Float32Array;      // Espectro plano (sin TF)
    hReal?: Float32Array;               // Parte real de H(f)
    hImag?: Float32Array;               // Parte imaginaria de H(f)
    refPeakDb?: number;                 // Pico de referencia (dB)
    measPeakDb?: number;                // Pico de medición (dB)
    detectedDelaySamples?: number;      // Delay detectado automáticamente
}
```

---

## 4.3. Trazas, Capas e Instantáneas (`lib/stores/traceManager.svelte.ts`)

```typescript
// Una capa activa en el canvas (puede ser live, instantánea o calculada)
interface MeasurementLayer {
    id: string;
    name: string;
    visible: boolean;
    isMeasuring: boolean;
    quadrantId: string | null;
    sourceType: 'live' | 'instantanea' | 'calculated';
    data: DSPWorkerResult | null;           // Datos DSP actuales
    // Para capas calculadas:
    isCalculated?: boolean;
    calcOperation?: 'average' | 'difference' | 'sum';
    calcTargetMetrics?: string[];
    instantaneaId?: string;                 // Instantánea vinculada
    multiMetricData?: Record<string, DSPWorkerResult>;
    // Override visual:
    color?: string;
    dashPattern?: number[];
}

// Tags para organizar instantáneas
interface InstantaneaTags {
    ubicacion?: string;     // 'FOH' | 'stage' | 'balcony' | ...
    posicion?: string;      // 'center' | 'left' | 'right' | ...
    custom: string[];       // Tags libres
}

// Metadatos de una instantánea
interface InstantaneaMetadata {
    sampleRate: number;
    fftSize: number;
    averagingDepth: number;
}

// Instantánea completa (no serializada)
interface Instantanea {
    id: string;
    name: string;
    timestamp: number;
    data: Record<string, Float32Array>;  // metric → Float32Array
    visible: boolean;
    color: string;
    source: string;                      // origen de la captura
    metric: string;                      // tipo de métrica
    offsetY: number;
    tags?: InstantaneaTags;
    notes?: string;
    sessionId?: string;
    metadata?: InstantaneaMetadata;
}

// Sesión (agrupación de instantáneas)
interface Session {
    id: string;
    name: string;
    venue?: string;
    event?: string;
    createdAt: number;
}
```

### Serialización para IndexedDB

```typescript
interface SerializedInstantanea {
    id: string;
    name: string;
    timestamp: number;
    data: Record<string, ArrayBufferLike>;  // Float32Arrays → ArrayBuffer
    visible: boolean;
    color: string;
    source: string;
    metric: string;
    offsetY: number;
    tags?: InstantaneaTags;
    notes?: string;
    sessionId?: string;
    metadata?: InstantaneaMetadata;
}

interface SerializedSession {
    id: string;
    name: string;
    venue?: string;
    event?: string;
    createdAt: number;
}
```

---

## 4.4. EQ — Filtros y AutoEQ (`lib/stores/eqStore.svelte.ts`)

```typescript
// Banda de EQ paramétrico
interface EQBand {
    freq: number;       // Frecuencia central (Hz)
    gain: number;       // Ganancia (dB)
    q: number;          // Factor Q
    type: FilterType;   // 'peaking' | 'low_shelf' | 'high_shelf' | ...
    muted?: boolean;
}

// Banda de EQ gráfico (solo freq + gain, Q fijo por frecuencia)
interface GraphicBand {
    freq: number;
    gain: number;
}

// Filtro paramétrico con UI expandida
interface ParametricFilter {
    id: string;
    freq: number;
    gain: number;
    q: number;
    type: FilterType;
    muted: boolean;
    supportedTypes: FilterType[];
    showConfig: boolean;
}

// Configuración completa de EQ
interface EQConfig {
    eqType: 'graphic' | 'parametric';
    eqShowEQ: boolean;
    eqGraphicBands?: GraphicBand[];
    eqParametricFilters?: ParametricFilter[];
}

// Resultado de AutoEQ
interface AutoEQResult {
    filters: FilterParams[];       // Filtros encontrados
    preamp: number;                // Ganancia de preamplificación
    residualMSE: number;           // Error residual
    iterations: number;
    timeMs: number;
    algorithm: string;
}

// Resultados de benchmark entre algoritmos
interface BenchmarkResult {
    results: BenchmarkEntry[];
    best: string;
    totalTimeMs: number;
}

interface BenchmarkEntry {
    algorithm: string;
    residualMSE: number;
    iterations: number;
    timeMs: number;
}
```

### Tipos de filtro biquad (`lib/dsp/biquad.ts`)

```typescript
// Implementación completa del RBJ Audio EQ Cookbook
type FilterType = 'peaking' | 'low_shelf' | 'high_shelf' | 'lowpass' | 'highpass'
                | 'notch' | 'allpass' | 'bandpass' | 'lowshelf' | 'highshelf';

// Coeficientes de filtro biquad (Direct Form I)
interface BiquadCoefficients {
    b0: number; b1: number; b2: number;
    a0: number; a1: number; a2: number;
}
```

### Configuración de AutoEQ (`lib/stores/eqStore.svelte.ts`)

```typescript
interface AutoEQConfig {
    algorithm: 'greedy' | 'nelder-mead' | 'pso' | 'genetic';
    costDomain: 'frequency' | 'time';
    numFilters: number;
    allowedTypes: FilterType[];
    freqRange: [number, number];
    maxBoost: number;
    maxCut: number;
    minQ: number;
    maxQ: number;
}
```

---

## 4.5. Métricas y Cuadrantes (`lib/dsp/quadrantState.ts`)

### Tipos de métrica disponibles

| name | type | Label | Descripción |
|------|------|-------|-------------|
| `magnitude` | `Magnitude` | Magnitud | Magnitud de la función de transferencia (dB) |
| `phase` | `Phase` | Fase | Fase de la función de transferencia (°) |
| `coherence` | `Coherence` | Coherencia | Coherencia (0–1) |
| `impulse` | `Impulse` | Impulso | Respuesta al impulso |
| `step` | `Step` | Step | Respuesta al escalón |
| `gd` | `GroupDelay` | GD | Retardo de grupo (ms) |
| `spectrogram` | `Spectrogram` | Espectrograma | Espectrograma en tiempo real |
| `crest` | `Crest` | Cresta | Factor de cresta |
| `spectrum` | `Spectrum` | Spectrum | Espectro plano (sin TF) |

### Configuración global por métrica

```typescript
// Comunes a todas las métricas
interface GlobalMetricCommon {
    lineWidth: number;
    lineDash: number[];
    smoothingPPO: number;      // Puntos por octava para suavizado
    invertY: boolean;
    yShift: number;
}

// Magnitud
interface GlobalMagnitudeDefaults {
    modeY: string;                    // 'dB' | 'linear'
    enableCoherence: boolean;         // Mostrar coherencia como fondo
    coherenceThreshold: number;       // Umbral de coherencia
    coherenceMode: 'attenuate' | 'color';
    coherenceColor: string;
}

// Fase
interface GlobalPhaseDefaults {
    unwrapMode: string;               // '±180' | 'unwrapped'
    rotate: number;
    range: number;
}

// Coherencia
interface GlobalCoherenceDefaults {
    cohType: string;
    showLine: boolean;
    showBackground: boolean;
    bgPalette: string;
    showThresholdLine: boolean;
    thresholdValue: number;
    thresholdColor: string;
}

// Espectrograma, Impulso, etc. (ver quadrantState.ts)
```

---

## 4.6. Estado de UI (`lib/stores/ui.svelte.ts`)

La clase `UIStore` (Svelte 5 Rune) contiene ~100 propiedades reactivas, agrupadas en:

| Grupo | Propiedades clave |
|-------|-------------------|
| **Layout** | `layout`, `activeTab`, `quadrantCount` |
| **Theme** | `themeMode`, `palette`, `canvasTheme` |
| **Audio config** | `audioInDevice`, `audioOutDevice`, `sampleRate` (48k/96k), `fftSize` (1024–65536), `dspUpdateRate` |
| **Generator** | `generatorType`, `genActive`, `genFreq`, `genLevel`, `genRouting` |
| **Measurement** | `measurementMode`, `isMeasuring`, `activeLayerId`, `autoSaveSnapshotOnStop`, `linkGeneratorToMeasurement` |
| **DSP config** | `weightingType` (A/B/C/Z/none), `averagingType` (FIFO/EMA/LPF/none), `averagingDepth`, `averagingAlpha`, `averagingThresholdDb`, `fftOverlap`, `windowType`, `besselSpeed`, `ppoSmoothing` |
| **Source window** | `enableSourceWindow`, `sourceWindowWidthMs`, `sourceWindowOffsetMs` |
| **Input** | `refChannel`, `measChannel`, `inputGain`, `displayOffset`, `polarity`, `inputFilter` (none/notch1k/BP100/LP200) |
| **Delay** | `compensationDelayMs`, `autoDelayCompensation` |
| **Leq** | `enableLeq`, `leqWindowSeconds`, `leqValue` |

---

## 4.7. Persistencia

### Esquemas guardados

| Store | Medio | Clave/DB | Contenido |
|-------|-------|----------|-----------|
| Config UI | localStorage | `asistente-config-v2` | `PersistedConfig` (JSON) |
| Instantáneas | IndexedDB | `asistente-db` / `instantaneas` | `SerializedInstantanea[]` |
| Sesiones | IndexedDB | `asistente-db` / `sessions` | `SerializedSession[]` |

### Config persistida (`configPersistence.ts`)

```typescript
interface PersistedConfig {
    _version: number;          // Para migraciones
    layout: string;
    themeMode: string;
    audioInDevice: AudioDevice | null;
    audioOutDevice: AudioDevice | null;
    sampleRate: number;
    fftSize: number;
    dspUpdateRate: number;
    eqType: string;
    eqShowEQ: boolean;
    eqGraphicBands: GraphicBand[];
    eqParametricFilters: ParametricFilter[];
    weightingType: string;
    averagingType: string;
    // ... todas las propiedades de UIStore que se persisten
    palette: string;
    canvasTheme: string;
    targetPoints: TargetPoint[];
    targetVisible: boolean;
    calibrationPoints: CalibrationPoint[];
    metricsToCapture: string[];
    tagPresets: string[];
    autoEQAlgorithm: string;
    // ...
}
```

---

## 4.8. Curva Target (`lib/stores/targetTrace.svelte.ts`)

```typescript
interface TargetPoint {
    f: number;  // Frecuencia (Hz)
    g: number;  // Ganancia (dB)
}

// Presets incorporados:
type TargetPreset = 'Flat' | 'X-Curve' | 'House' | 'BK' | 'Harman';
```

---

## 4.9. Calibración (`lib/stores/calibrationStore.svelte.ts`)

```typescript
interface EQFilter {
    frequency: number;
    gain: number;
    q: number;
    type: FilterType;
    enabled: boolean;
}

interface CalibrationPoint {
    frequency: number;
    gain: number;
}
```

---

## 4.10. Stores — Resumen de dependencias

```
traceManager ──depende de──> db.ts (IndexedDB)
ui           ──depende de──> configPersistence.ts (localStorage)
eqStore      ──depende de──> biquad.ts (computeFilterResponse)
mathOrchestrator ──usa──> dspWorker.ts (Web Worker)
                         ──escribe──> traceManager, meterStore
                         ──lee──> ui (config), calibrationStore, eqStore
meterStore   ──independiente
calibrationStore ──independiente
targetTrace  ──independiente
```
