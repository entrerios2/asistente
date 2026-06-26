# 5. Pipeline DSP

Este documento describe la cadena completa de procesamiento de audio: desde la captura del micrófono hasta el renderizado en pantalla.

---

## 5.1. Pipeline completo

```
CAPTURA (HAL)
  │ AudioWorklet: meas + ref (Float32Array a 48/96 kHz)
  │ SharedArrayBuffer (zero-copy)
  ▼
MATH ORCHESTRATOR
  │ feedTimeDomain() → buffers circulares (ref, meas)
  │ Timer → cada dspUpdateRate ms:
  │   run() → postMessage al dspWorker
  ▼
DSP WORKER (Web Worker)
  │ 1. Corrección de delay (autoDelayCompensation)
  │ 2. Aplicación de inputFilter (Notch1k / BP100 / LP200)
  │ 3. Ventaneo (windowFunction.ts)
  │ 4. FFT (webfft WASM, fallback Radix-2)
  │ 5. Función de Transferencia: H(f) = conj(FFT_ref) × FFT_meas / |FFT_ref|²
  │ 6. Magnitud: 20 × log₁₀(|H(f)|)
  │ 7. Fase: atan2(Im(H), Re(H)) → unwrap → ±180°
  │ 8. Coherencia: |G_rm|² / (G_rr × G_mm) (FIFO circular profundidad 21)
  │ 9. Respuesta al impulso: IFFT(H(f))
  │ 10. Respuesta al escalón: suma acumulativa de impulso
  │ 11. Retardo de grupo: −d(phase)/d(freq)
  │ 12. Factor de cresta: peak / RMS
  │ 13. Promediación: FIFO / EMA / LPF sobre H(f)
  │ 14. Ponderación: A/B/C/Z (biquads sobre magnitud)
  │ 15. Calibración: multiplicación por curva de calibración
  │ 16. Suavizado PPO (Per-Period Octave)
  │ 17. Espectro plano: |FFT_meas| (sin TF)
  ▼  postMessage: DSPWorkerResult
MATH ORCHESTRATOR
  │ handleWorkerMessage() → actualiza stores
  │ updateEQCache() → computa respuesta combinada de todos los filtros
  ▼
TRACE MANAGER
  │ Actualiza MeasurementLayer activa
  ▼
RENDER LOOP
  │ rAF → executeDraw() a targetFps (20-60)
  │ quadrantDraw.ts → selecciona métricas → canvasRenderers.ts
  │ Interpolación temporal para 60fps suaves
  ▼
CANVAS 2D
  │ Grillas, trazas, overlays, espectrograma, EQ
```

---

## 5.2. Captura (HAL → MathOrchestrator)

### WebAudioProvider (`lib/hal/web/WebAudioProvider.ts`)

```
AudioContext → AudioWorkletNode (captura)
                │
                ├── AudioWorkletProcessor (hilo isócrono)
                │     ├── Input  → micrófono de medición → meas
                │     └── Input  → loopback línea → ref
                │
                └── SharedArrayBuffer → Main Thread
```

El `AudioWorkletNode` recibe 2 entradas:
- **Entrada 0**: señal de medición (micrófono)
- **Entrada 1**: señal de referencia (loopback del generador)

Cada bloque de ~128 samples (~2.7ms @48kHz) se escribe en un `SharedArrayBuffer` que el hilo principal lee sin copia.

### TauriAudioProvider (`lib/hal/tauri/TauriAudioProvider.ts`)

Actualmente genera datos sintéticos (seno + ruido). La integración real con `cpal` para captura nativa está pendiente.

### MathOrchestrator.feedTimeDomain()

```typescript
feedTimeDomain(measSamples: Float32Array, refSamples?: Float32Array): void
```

- Almacena en buffers circulares (`measBuffer`, `refBuffer`)
- Si `refSamples` es undefined, usa solo la medición (espectro plano, sin TF)
- Inicia un timer que cada `dspUpdateRate` ms llama a `run()`

---

## 5.3. Web Worker DSP (`lib/dsp/dspWorker.ts`)

### 5.3.1. Parámetros de configuración

Recibe del main thread por `postMessage`:

| Parámetro | Tipo | Default | Efecto |
|-----------|------|---------|--------|
| `FFT_SIZE` | number | 16384 | Resolución espectral |
| `sampleRate` | number | 48000 | Frecuencia de muestreo |
| `windowType` | string | Hann | Ventana FFT |
| `weightingType` | string | none | Ponderación A/B/C/Z |
| `averagingType` | string | none | FIFO/EMA/LPF |
| `averagingDepth` | number | 10 | Profundidad FIFO |
| `averagingAlpha` | number | 0.3 | Factor EMA |
| `averagingThresholdDb` | number | -∞ | Compuerta de amplitud |
| `enableSourceWindow` | boolean | false | Ventaneo temporal |
| `compensationDelaySamples` | number | 0 | Delay manual |
| `autoDelayCompensation` | boolean | false | Delay automático |
| `inputGain` | number | 0 | Ganancia de entrada (dB) |
| `displayOffset` | number | 0 | Offset vertical (dB) |
| `polarity` | string | normal | normal/inverted |
| `calibrationGain` | Float32Array | null | Curva de calibración |
| `inputFilter` | string | none | Filtro de entrada |
| `besselSpeed` | string | medium | Slow/Med/Fast Bessel |
| `ppoSmoothing` | number | 48 | Puntos por octava |
| `fftOverlap` | number | 0 | Overlap FFT |
| `metrics` | string[] | [] | Qué métricas computar |

### 5.3.2. Inicialización

```typescript
async function initWebFFT(fftSize: number): Promise<void>
```

- Carga `webfft` (WASM) dinámicamente con `import('webfft')`
- Crea una instancia de `WebFFT` con el tamaño solicitado
- Ejecuta `webfftEngine.profile()` para optimizar
- Si falla la carga WASM, usa fallback Radix-2 en JS puro

### 5.3.3. Procesamiento por frame

```typescript
function processFrame(params: ProcessParams): DSPWorkerResult
```

**Paso 1 — Corrección de delay**
```typescript
if (autoDelayCompensation) {
    // Busca el pico de correlación cruzada entre ref y meas
    // Ajusta compensationDelaySamples
}
```

**Paso 2 — Filtro de entrada**
```typescript
if (inputFilter !== 'none') {
    // Crea filtro biquad (Notch1k, BP100 o LP200)
    // Aplica sobre meas y ref en tiempo (IIR)
}
```

**Paso 3 — Ventaneo**
```typescript
const windowCoeffs = getWindowCoeffs(windowType, FFT_SIZE);
// Multiplica meas y ref por la ventana sample a sample
```

**Paso 4 — FFT**
```typescript
// Usa webfftEngine si disponible, sino Radix-2 JS
fftInputReal = ventaneado(meas)
fftRefReal = ventaneado(ref)
F_meas = fft(fftInputReal)      // complejo
F_ref = fft(fftRefReal)         // complejo
```

**Paso 5 — Función de Transferencia**
```typescript
// H(f) = conj(F_ref) × F_meas / (|F_ref|² + ε)
// ε evita división por cero
for (each bin) {
    denom = F_ref_real²  + F_ref_imag² + epsilon
    H_real = (F_ref_real × F_meas_real + F_ref_imag × F_meas_imag) / denom
    H_imag = (F_ref_real × F_meas_imag - F_ref_imag × F_meas_real) / denom
}
```

**Paso 6 — Magnitud**
```typescript
for (each bin) {
    magnitude = sqrt(H_real² + H_imag²)
    magnitude_dB = 20 × log10(magnitude)
}
```

**Paso 7 — Fase**
```typescript
for (each bin) {
    phase_rad = atan2(H_imag, H_real)
    phase_deg = phase_rad × 180 / π
    // unwrap si corresponde
}
```

**Paso 8 — Coherencia** (FIFO circular, profundidad 21 = default OSM)

```typescript
// Grr = |F_ref|², Gmm = |F_meas|², Grm = F_ref × conj(F_meas)
// FIFO: depth=21, circular buffer
// Suma acumulativa de todas las depth snapshots
// coh = |ΣGrm|² / (ΣGrr × ΣGmm)
```

**Paso 9 — Respuesta al impulso**
```typescript
impulse = IFFT(H)  // usando webfft o Radix-2
```

**Paso 10 — Respuesta al escalón**
```typescript
step[n] = Σ(impulse[0..n])  // suma acumulativa
```

**Paso 11 — Retardo de grupo**
```typescript
// Derivada discreta de fase: −Δphase / Δfreq
// Con unwrapping para evitar saltos de 360°
```

**Paso 12 — Promediación** (sobre H(f), no sobre el espectro crudo)

```typescript
switch (averagingType) {
    case 'FIFO':
        // Buffer circular de profundidad N
        // avgH = (sum of last N H(f) values) / N
    case 'EMA':
        // avgH = α × H_current + (1−α) × avgH_previous
    case 'LPF':
        // Filtro IIR pasa-bajos de primer orden sobre H(f)
}
// Con compuerta: solo acumula si level > averagingThresholdDb
```

**Paso 13 — Ponderación frecuencial**

```typescript
if (weightingType !== 'none') {
    // Aplica curva A/B/C/Z multiplicando la magnitud
    // Las curvas están precomputadas en weighting.ts
}
```

**Paso 14 — Calibración**

```typescript
if (calibrationGain) {
    for (each bin) {
        magnitude_dB += calibrationGain[bin]  // corrección por curva
    }
}
```

**Paso 15 — Suavizado PPO**

```typescript
if (ppoSmoothing > 0) {
    // Reduce BINS puntos a ~ppoSmoothing puntos por octava
    // magnitude = applyPPOSmoothing(magnitude, BINS, sampleRate, ppoSmoothing)
    // phase = applyPPOSmoothingPhase(phase, ...)
}
```

---

## 5.4. AutoEQ (`lib/dsp/autoEQ.ts`)

### Orquestador

```typescript
async function autoEqualize(
    measured: Float32Array,       // Curva medida (dB por bin)
    target: Float32Array,         // Curva target (dB por bin)
    freqs: Float32Array,          // Frecuencias de cada bin
    config: AutoEQConfig,         // Algoritmo, límites, etc.
    currentFilters?: FilterParams[]  // Filtros actuales (opcional)
): Promise<AutoEQResult>
```

### Algoritmos

| Algoritmo | Archivo | Estrategia | Mejor para |
|-----------|---------|------------|------------|
| **Greedy** | autoEQ.ts | Añade un filtro a la vez, elige el que más reduce MSE | Rápido, primera aproximación |
| **Nelder-Mead** | `optimizers/nelderMead.ts` | Optimización simplex, ajusta todos los filtros simultáneamente | Ajuste fino |
| **PSO** | `optimizers/psoEQ.ts` | Particle Swarm Optimization, enjambre de soluciones | Espacios grandes, evita mínimos locales |
| **Genético** | `optimizers/geneticEQ.ts` | Algoritmo genético con crossover y mutación | Exploración global |

### Función de costo

```typescript
function costFunction(filters: FilterParams[], measured: Float32Array,
                      target: Float32Array, freqs: Float32Array): number
{
    // 1. Computa respuesta combinada de filtros (biquad.ts)
    // 2. Aplica preamp
    // 3. Resta de la curva medida
    // 4. MSE entre resultado y target
    // 5. Penalizaciones: Q extremos, ganancia excesiva
    return MSE + penalties
}
```

### Benchmark

```typescript
async function benchmarkAlgorithms(
    measured: Float32Array,
    target: Float32Array,
    freqs: Float32Array,
    config: AutoEQConfig
): Promise<BenchmarkResult>
```
Ejecuta los 4 algoritmos secuencialmente y compara resultados.

---

## 5.5. EQ Cache (Main Thread)

La respuesta combinada de todos los filtros EQ se computa en el hilo principal (no en el worker) para latencia cero en la interacción.

```typescript
updateEQCache(): void
{
    // 1. Toma todos los filtros activos (gráficos + paramétricos + calibración)
    // 2. Para cada bin de frecuencia:
    //      resp = 1 + 0j
    //      for each filter:
    //          resp *= computeFilterResponse(filter, freq)
    //      eqCache[freq] = 20 * log10(|resp|)
    // 3. traceManager.setEQData(eqCache)
}
```
Esto se ejecuta a 60fps (en el render loop) para feedback visual instantáneo al arrastrar nodos EQ.

---

## 5.6. Render Loop (`lib/stores/useRenderLoop.ts` + `lib/dsp/quadrantDraw.ts`)

### Ciclo

```
rAF callback
  │
  ├── InterpolationEngine.step()  → interpola datos para 60fps suaves
  ├── quadrantDraw.executeDraw()  → dibuja todos los cuadrantes
  │     ├── gridRenderers.drawGrid()
  │     ├── for each metric:
  │     │     ├── applyPPOSmoothing() si es necesario
  │     │     └── metricRenderers.drawMetric() según tipo
  │     ├── overlayRenderers.drawOverlays() (target, EQ, etc.)
  │     └── eqRenderers.drawEQNodes() si eqShowEQ
  │
  └── Si hay cambios en datos → updateEQCache()
```

### Interpolación temporal

```typescript
InterpolationEngine.step(): void
// Interpola suavemente entre el frame DSP anterior y el actual
// Previene saltos bruscos cuando dspUpdateRate < 60fps
// Usa mezcla lineal con factor basado en tiempo transcurrido
```

---

## 5.7. Órdenes de Speaker y Arrays

### Clasificación (`lib/dsp/` — referencias McCarthy)

El sistema incorpora el modelo de McCarthy para clasificación de altavoces (definido en `docs/Corpus/`):

| Orden | Beamwidth | Array típico | Uso |
|-------|-----------|-------------|-----|
| 1er orden | Plateau >60° | Uncoupled arrays, altavoces solos | Cobertura ancha, fills |
| 2do orden | Plateau 20°–60° | Coupled point source | Cobertura media, arrays pequeños |
| 3er orden | Proportional <20° HF | Coupled line source (line arrays) | Cobertura estrecha, larga distancia |

### Summation Engine

El motor de suma acústica (planeado en `tools/summation-engine/`) implementará las reglas del Capítulo 4 de McCarthy:

- **Zonas de suma**: Coupling (<120° fase, <10 dB nivel), Cancellation (180° ±30°), Combing, Transition, Isolation
- **Progresión espectral**: peak⁰ → dip¹ → peak¹ → dip² → ...
- **Geometría espacial**: Triangulación isósceles/aguda/recta/obtusa

> Ver `docs/summation-engine-decision-tree.md` para el árbol de decisión completo.

### Mic Placement

El sistema de posicionamiento de micrófonos (planeado) implementará las reglas del Capítulo 14.3 de McCarthy:

- **6 clases de posición**: ONAX, OFFAX, VTOP, VBOT, XOVR, SYM
- **Por tipo de sistema**: single, coupled, uncoupled, line/point source/destination
- **Por tarea**: EQ, aim, splay, spacing, level, delay

> Ver `docs/mic-placement-decision-tree.md` para el árbol de decisión completo.

---

## 5.8. APST — Acoustic Protocol for System Testing (`lib/dsp/apst/`)

### Segmentos de test

| Segmento | Propósito | Señal |
|----------|-----------|-------|
| **V** | Calibración de ganancia/impedancia | Tono 1 kHz |
| **A** | Respuesta tonal | Ruido rosa |
| **M** | Bajos profundos | Ruido marrón |
| **N** | Altas frecuencias | Ruido blanco |
| **F** | Barrido frecuencia + impulso | Sweep logarítmico |
| **P** | Alineación de fase | MLS + sweeps |
| **T** | Decaimiento RT60 | Ruido + corte |
| **D** | Distorsión armónica | Tonos por frecuencia |
| **X** | Marcador extra/genérico | Configurable |

### Detección de headers FSK

Cada segmento comienza con un header FSK (Frequency Shift Keying) que identifica el tipo de segmento. El `GoertzelDetector` usa el algoritmo de Goertzel para detectar las frecuencias del header en tiempo real, permitiendo al `Orchestrator` sincronizar la captura con la reproducción.

### Arquitectura de procesamiento

Para secuencias APST largas:
- **Fast-Path**: Worker ligero para feedback visual en vivo y detección de *showstoppers* (acoples, clipping). Se degrada automáticamente si el CPU no da abasto.
- **Slow-Path**: Al finalizar, procesa el buffer completo con FFT de alta resolución para máxima precisión.
