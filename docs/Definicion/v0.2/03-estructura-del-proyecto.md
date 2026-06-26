# 3. Estructura del Proyecto

Árbol completo del código fuente con descripción de cada archivo.  
Base: `C:\Users\Abel\Documents\Asistente\asistente\`

---

## 3.1. Raíz del proyecto

```
asistente/
├── package.json              # Dependencias Node, scripts de build/dev
├── svelte.config.js          # Config Svelte: adapter-static + base path /asistente/
├── vite.config.ts            # Config Vite: plugins (tailwind, PWA), COOP/COEP headers
├── tsconfig.json             # TypeScript strict, ESNext, excludes _deprecated
├── tailwind.config.js        # Colores de marca (negro, blanco, naranja Svelte)
├── .gitignore
├── .npmrc
├── .github/                  # GitHub workflows (CI/CD)
├── node_modules/
├── build/                    # Output de build estático
├── static/                   # Archivos estáticos (worklets, imágenes)
├── images/                   # Imágenes del proyecto
│
├── src/                      # CÓDIGO FUENTE PRINCIPAL
├── src-tauri/                # Backend nativo Tauri (Rust)
├── tools/                    # Herramientas de desarrollo
├── docs/                     # Documentación
└── plans/                    # Planes de implementación activos
```

---

## 3.2. `src/` — Código fuente de la aplicación

### 3.2.1. Raíz de `src/`

```
src/
├── app.html                  # Template HTML: #app mount, meta tags, fonts
├── app.d.ts                  # Declaraciones globales App namespace
├── hooks.server.ts           # SvelteKit hooks: inyecta COOP/COEP headers
├── routes/
│   ├── +layout.svelte        # Layout raíz (favicon dinámico por tema)
│   ├── +layout.ts            # prerender = true, ssr = false, trailingSlash = 'always'
│   ├── +page.svelte          # Página única: Header + Sidebar + ViewGrid
│   └── layout.css            # Sistema de diseño (design system) completo
│
├── lib/                      # Biblioteca principal
│   ├── index.ts              # Placeholder para alias $lib
│   ├── assets/               # Assets estáticos (SVG)
│   ├── icons/                # Definiciones de iconos SVG para tipos de filtro
│   ├── dsp/                  # Motor DSP
│   ├── hal/                  # Capa de abstracción de hardware
│   ├── stores/               # Estado reactivo (Svelte 5 Runes)
│   └── utils/                # Utilidades (persistencia, DB)
│
├── components/               # Componentes Svelte de UI
│   └── medicion/             # Componentes de medición
│
└── _deprecated/              # Código obsoleto preservado como referencia
    ├── components/           # Componentes viejos
    ├── dsp/                  # DSP viejo
    └── utils/                # Utilidades viejas
```

### 3.2.2. `src/lib/dsp/` — Motor de procesamiento de señales

```
lib/dsp/
├── dspWorker.ts              # ★ WEB WORKER PRINCIPAL ★
│   # Recibe: measTimeDomain, refTimeDomain + parámetros de configuración
│   # Calcula: FFT → Transfer Function → Magnitud, Fase, Coherence,
│   #           Impulse Response, Step Response, Group Delay, Crest Factor
│   #   Aplica: windowing, weighting, averaging, calibration
│   # Devuelve: DSPWorkerResult (postMessage)
│   # Es el corazón del procesamiento matemático
│
├── fft.ts                    # Wrapper para webfft (FFT WASM)
│
├── biquad.ts                 # ★ FILTROS BIQUAD ★
│   # Implementación completa del RBJ Audio EQ Cookbook
│   # Tipos: peaking, low_shelf, high_shelf, lowpass, highpass, notch, allpass,
│   #         bandpass, lowshelf, highshelf (ambos con Q/S, S = slope)
│   # Funciones: coefs(c) para cada tipo, y procesamiento de respuesta en frecuencia
│   # computeFilterResponse(): evalúa la respuesta compleja de un filtro en frecuencia
│   # computeTotalResponse(): combina múltiples filtros por multiplicación compleja
│
├── iirFilter.ts              # Implementación de filtro IIR en tiempo real
│
├── windowFunction.ts         # Funciones de ventana FFT
│   # Hann, Hamming, Blackman-Harris 4-term, FlatTop, HFT223D,
│   # Exponential, Rectangular
│   # getWindowCoeffs(): genera coeficientes para N samples
│
├── weighting.ts              # Ponderación frecuencial
│   # A, B, C, Z weighting filters (implementados como biquads)
│   # computeWeighingCurve(): genera curva de ponderación sobre frecuencia
│
├── signalGenerators.ts       # Generadores de señales de audio
│   # white, pink, brown, music-noise, sine, sweep (log/pink),
│   #   burst, sinburst, MLS (Maximum Length Sequence)
│   # pink noise: algoritmo Voss-McCartney mejorado (método de la caja blanca)
│   # MLS: generación por Linear Feedback Shift Register
│
├── autoEQ.ts                 # ★ ORQUESTADOR DE AUTO EQ ★
│   # Interfaz unificada para 4 algoritmos de optimización
│   # autoEqualize(): ejecuta greedy, Nelder-Mead, PSO o GA según config
│   # benchmarkAlgorithms(): compara rendimiento de todos los algoritmos
│   # calcula MSE entre curva medida y target + respuesta de filtros
│
├── optimizers/
│   ├── nelderMead.ts         # Optimización Nelder-Mead (simplex)
│   ├── psoEQ.ts              # Particle Swarm Optimization para EQ
│   └── geneticEQ.ts          # Algoritmo Genético para EQ
│       # Cada optimizador:
│       # - Toma: FilterParams[], target curve, measured curve, bounds, config
│       # - Optimiza: filtros para minimizar MSE entre respuesta y target
│       # - Devuelve: mejores filtros + métricas de convergencia
│
├── apst/                     # ★ PROTOCOLO APST ★
│   ├── Orchestrator.ts       # Orquesta secuencias de medición APST
│   ├── Player.ts             # Reproductor de segmentos de test
│   ├── CableTester.ts        # Test de integridad de cable
│   ├── GoertzelDetector.ts   # Detección de headers FSK via Goertzel
│   ├── segments/             # Definiciones de segmentos (V, A, N, F, P, T, X)
│   └── workers/              # FastPathWorker para detección acelerada
│
├── math.ts                   # Utilidades matemáticas genéricas
│
├── leq.ts                    # Calculador de Leq (nivel continuo equivalente)
│   # Acumula energía en ventana temporal, computeLeq()
│
├── deconvolution.ts          # Deconvolución para extraer respuesta al impulso
│
├── deviationMetrics.ts       # Métricas de desviación estadística entre curvas
│
├── interpolationEngine.ts    # Interpolación temporal para renderizado fluido 60fps
│
├── averaging.ts              # Algoritmos de promediación
│   # FIFO, EMA (Exponential Moving Average), LPF (Low Pass Filter)
│   # Con compuerta de amplitud (averagingThresholdDb)
│
├── besselLPF.ts              # Filtro Bessel pasa-bajos (Slow/Medium/Fast response)
│
├── ppoSmoothing.ts           # Suavizado PPO (Per-Period Octave)
│   # Reduce resolución espectral a puntos por octava para trazas legibles
│
├── sourceWindowing.ts        # Ventaneo temporal para análisis selectivo
│
├── spectrogramManager.ts     # Gestión de buffers del espectrograma
│
├── osmMetrics.ts             # Cálculos de métricas compatibles con OSM
│
├── canvasRenderers.ts        # ★ FUNCIONES DE DIBUJADO CANVAS ★
│   # Dibuja: grids, trazas de magnitud, fase, coherencia, impulso,
│   #          retardo de grupo, espectrograma, overlay de EQ,
│   #          curvas target, crosshair, medidores VU
│   # Es el archivo más grande de dibujado
│
├── canvasInteraction.ts      # Interacción mouse/touch en canvas
│   # Pan, zoom, crosshair, arrastre de nodos EQ
│
├── canvasTheme.ts            # Gestión de tema (claro/oscuro) del canvas
│
├── colorPalettes.ts          # Definiciones de paletas de color (10 paletas)
│
├── quadrantDraw.ts           # ★ ORQUESTADOR DE DIBUJADO ★
│   # Coordina qué métricas dibujar en cada cuadrante
│   # 965 líneas: selecciona metricRenderers según configuración
│   # Llama a canvasRenderers.ts, eqRenderers.ts, overlayRenderers.ts
│
├── quadrantState.ts          # Tipos y defaults de configuración de métricas
│
├── quadrantHelpers.ts        # Funciones auxiliares para renderizado de cuadrantes
│
├── eqNodeIcons.ts            # Iconos y colores por tipo de filtro EQ
│
├── eqInteractionHandlers.ts  # Handlers de drag/mouse para nodos EQ en canvas
│
├── renderers/                # Sub-renderers por tipo de métrica
│   ├── eqRenderers.ts        # Renderizado de nodos y curvas EQ
│   ├── overlayRenderers.ts   # Overlays (target trace, capas)
│   ├── metricRenderers.ts    # Renderizado específico por tipo de métrica
│   └── gridRenderers.ts      # Dibujado de grillas
│
└── eqInteractionHandlers.ts  # Handlers de interacción para EQ
```

### 3.2.3. `src/lib/hal/` — Hardware Abstraction Layer

```
lib/hal/
├── index.ts                  # ★ FACTORY ★
│   # detectCapabilities() → determina si es web o tauri
│   # createAudioProvider() → instancia WebAudioProvider o TauriAudioProvider
│
├── types.ts                  # Interfaces del HAL
│   # AudioProvider: contrato que deben cumplir los providers
│   # AudioDevice: { id, name, backend, direction, channels }
│   # AudioListener: { onAudioData, onFrequencyData?, onTimeDomainData? }
│   # SignalType: white, pink, brown, music-noise, sine, sweep, burst, sinburst, mls
│
├── web/
│   └── WebAudioProvider.ts   # ★ IMPLEMENTACIÓN WEB ★
│       # Usa: Web Audio API, AudioContext, AudioWorklet
│       # startCapture(): conecta mic, crea AudioWorkletNode
│       # playGenerator(): crea OscillatorNode/BufferSourceNode
│       # getSharedBuffer(): devuelve SharedArrayBuffer para datos
│       # sendWorkletMessage(): configuración del worklet
│       # Maneja: selección de dispositivos, routing, gain staging
│
└── tauri/
    └── TauriAudioProvider.ts # ★ IMPLEMENTACIÓN TAURI (SIMULADA) ★
        # Actualmente genera datos sintéticos (seno + ruido)
        # La integración real con cpal está pendiente
```

### 3.2.4. `src/lib/stores/` — Estado reactivo (Svelte 5 Runes)

```
lib/stores/
├── traceManager.svelte.ts    # ★ STORE PRINCIPAL ★
│   # 700 líneas. Gestiona:
│   # - MeasurementLayer[]: capas activas con sus datos
│   # - Instantanea[]: instantáneas guardadas
│   # - Session[]: sesiones (agrupaciones de instantáneas)
│   # Operaciones CRUD sobre instantáneas y sesiones
│   # Persistencia vía db.ts (IndexedDB)
│   # Exportación/Importación JSON
│   # Sincronización con capas del canvas
│
├── ui.svelte.ts              # ★ CONFIGURACIÓN DE UI ★
│   # Clase UIStore con ~100 propiedades reactivas:
│   # layout (grid), theme, palette, canvasTheme
│   # audio devices, sampleRate, fftSize, dspUpdateRate
│   # generator config, measurement mode
│   # weighting, averaging, windowing config
│   # input routing (refChannel, measChannel, inputFilter)
│   # Persistencia parcial vía configPersistence.ts
│
├── eqStore.svelte.ts         # ★ ESTADO DEL EQ ★
│   # EQConfig: tipo (graphic/parametric), filtros, visibilidad
│   # EQBand / GraphicBand / ParametricFilter
│   # AutoEQConfig: algoritmo, dominio de costo, límites
│   # AutoEQResult / BenchmarkResult
│   # Operaciones: add/remove/update filters, AutoEQ, benchmark
│
├── meterStore.svelte.ts      # Niveles de VU meter
│   # refLevel, measLevel, outLevel (dB)
│   # crest factor
│
├── mathOrchestrator.svelte.ts # ★ ORQUESTADOR DSP ★
│   # 575 líneas. Corazón del pipeline de datos:
│   # - feedTimeDomain(meas, ref): recibe datos del HAL
│   # - Almacena en buffers circulares
│   # - Timer: cada dspUpdateRate ms ejecuta run()
│   # - run(): envía datos al dspWorker
│   # - handleWorkerMessage(): recibe DSPWorkerResult
│   # - Actualiza traceManager, meterStore
│   # - updateEQCache(): computa respuesta de EQ combinada
│   # - getOutputSpectrum(): para visualización
│
├── calibrationStore.svelte.ts # Calibración de micrófono
│   # CalibrationPoint[]: pares (freq, gain)
│   # Importación desde archivo CSV/JSON
│   # Aplica curva de calibración al pipeline
│
├── targetTrace.svelte.ts     # Curva target
│   # TargetPoint[]: pares (f, g)
│   # Presets: Flat, X-Curve, House, BK, Harman
│   # Personalizable por el usuario
│
└── useRenderLoop.ts          # Render loop extractado
    # Ciclo rAF: llama executeDraw() a targetFps
    # InterpolationEngine para smooth 60fps
```

### 3.2.5. `src/lib/utils/` — Utilidades

```
lib/utils/
├── configPersistence.ts      # Persistencia de configuración en localStorage
│   # saveConfig() / loadConfig() con migración de versiones
│   # PersistedConfig: schema con _version para migraciones
│
└── db.ts                     # CRUD IndexedDB
    # openDB(): abre conexión a base IndexedDB
    # saveInstantanea() / loadInstantanea() / listInstantaneas()
    # saveSession() / loadSession() / listSessions()
    # deleteInstantanea() / deleteSession()
    # SerializedInstantanea: datos en ArrayBuffer para almacenar Float32Arrays
```

### 3.2.6. `src/components/medicion/` — Componentes de UI

```
components/medicion/
├── Quadrant.svelte           # ★ COMPONENTE PRINCIPAL ★
│   # 592 líneas. Cada cuadrante del grid de medición.
│   # Renderiza: Canvas + ZoomControls + LayerPanel + popovers
│   # Maneja: ciclo de vida del canvas, resize observer
│   # Configura: qué métricas mostrar, colores, ejes
│
├── ViewGrid.svelte           # Grid de cuadrantes (1x1, 2x1, 2x2, 3x2)
│   # Distribuye los cuadrantes según configuración de layout
│
├── Sidebar.svelte            # Panel lateral con tabs
│   # 4 tabs: Medición, Ecualizar, Instantáneas, Config
│
├── Header.svelte             # Barra superior
│   # VU meters, controles de generador, selector de layout, reloj
│
├── TabMedicion.svelte        # Pestaña de control de medición
│   # 549 líneas. Modos: manual, secuencial, APST
│   # Config: tipo de señal, nivel, routing, duración
│
├── TabEcualizar.svelte       # Pestaña de EQ
│   # 749 líneas. EQ gráfico + paramétrico + AutoEQ
│   # Lista de filtros, controles de frecuencia/ganancia/Q
│
├── TabInstantaneas.svelte    # Pestaña de gestión de instantáneas
│   # 739 líneas. CRUD, tags, filtros, sesiones
│   # Import/Export JSON
│
├── TabConfig.svelte          # Pestaña de configuración
│   # Ajustes de audio, tema, canvas, red, etc.
│
├── CaptureModal.svelte       # Modal para nombrar/tags al capturar
│
├── SnapshotPicker.svelte     # Selector de instantáneas para AutoEQ
│
├── AddMetricDropdown.svelte  # Dropdown para agregar métricas al cuadrante
│
├── LayerPanel.svelte         # Panel de capas superpuestas
│
├── EQNodePopover.svelte      # Popover de configuración de nodo EQ
│
├── MetricConfigPopover.svelte # Configuración por métrica
│
└── ZoomControls.svelte       # Controles de zoom/pan del canvas
```

---

## 3.3. `src-tauri/` — Backend nativo (Rust)

```
src-tauri/
├── Cargo.toml                # Rust dependencies: tauri, cpal (ASIO), serde, log
├── tauri.conf.json           # Config: window (título, 800x600), build, bundle, security
├── build.rs                  # Build script
├── capabilities/
│   └── default.json          # Permisos Tauri
└── src/
    ├── main.rs               # Entry point (cfg windows_platform)
    └── lib.rs                # Tauri commands
        # list_audio_devices() → AudioDevice[]
        # select_audio_device(id, direction) → ()
        # Estado: Mutex<SelectedDevices>
```

---

## 3.4. `tools/` — Herramientas de desarrollo

```
tools/
├── apst-builder/             # Generador de señales de test APST
│   ├── package.json
│   └── src/
│       ├── index.ts          # CLI: genera .wav con secuencias de test
│       └── generators/
│           ├── fsk.ts        # Generación de headers FSK
│           ├── noise.ts      # Ruido rosa/blanco/marrón
│           ├── sweep.ts      # Barridos senoidales logarítmicos
│           └── tone.ts       # Tonos senoidales
│
└── summation-engine/         # (Vacío - planeado)
    # Futuro: implementación del motor de suma acústica
    # Basado en Ch.4 de McCarthy
```

---

## 3.5. `docs/` — Documentación

```
docs/
├── Definicion/               # Documentación de definición del sistema
│   ├── Definicion.md         # DDS principal (651 líneas)
│   ├── documentacion_senales_y_metricas.md
│   ├── Organizacion_interfaz.md
│   ├── Protocolo_APST.md
│   ├── UX_Medicion.md
│   ├── roadmap.md
│   └── v0.2/                 # ★ DOCUMENTACIÓN ACTUAL (esta) ★
│       ├── INDEX.md
│       ├── 01-introduccion-y-vision.md
│       ├── 02-arquitectura-general.md
│       ├── 03-estructura-del-proyecto.md
│       ├── 04-modelo-de-datos.md
│       ├── 05-pipeline-dsp.md
│       └── 06-despliegue-y-configuracion.md
│
├── Audits/                   # Auditorías de código
│   ├── audit_cosmetic_functions.md
│   ├── audit_loopback_coherence.md
│   └── audit_mccarthy.md
│
├── Planes/                   # Planes de implementación detallados (27 archivos)
├── Prompts/                  # Templates de prompts usados en desarrollo (20 archivos)
├── Corpus/                   # Libros de referencia de audio (McCarthy, etc.)
│
├── algorithm-candidates.md
├── mic-placement-decision-tree.md
├── summation-engine-decision-tree.md
└── informe_post_fase_1.md
```

---

## 3.6. `plans/` — Planes activos

```
plans/
├── performance_optimization_plan.md
├── performance_optimization_plan_v2.md
├── plan_mejoras_ui_cuadrante.md
└── smooth_rendering_plan.md
```
