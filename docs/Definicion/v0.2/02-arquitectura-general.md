# 2. Arquitectura General

---

## 2.1. Diagrama de arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        APLICACIÓN (Browser / Tauri)                      │
│                                                                          │
│  ┌─────────────┐  ┌──────────────────────────────────┐  ┌───────────┐  │
│  │   HAL       │  │         Svelte 5 App              │  │  Tauri    │  │
│  │  (Audio)    │  │  ┌──────────┐  ┌───────────────┐  │  │  Backend  │  │
│  │             │  │  │  Stores   │  │  Componentes  │  │  │  (Rust)   │  │
│  │ WebAudio-   │  │  │ (Estado   │  │  UI           │  │  │           │  │
│  │ Provider    │──│─>│ reactivo) │─>│  (Svelte)     │  │  │ list_     │  │
│  │             │  │  │           │  │               │  │  │ audio_    │  │
│  │ TauriAudio- │  │  │ traceMgr  │  │ +Canvas 2D   │  │  │ devices() │  │
│  │ Provider    │  │  │ ui        │  │ (Quadrant)    │  │  │           │  │
│  │             │  │  │ eqStore   │  │               │  │  └───────────┘  │
│  └──────┬──────┘  │  │ meterStore│  └───────────────┘  │                 │
│         │         │  │ mathOrch  │         ▲            │                 │
│         │         │  │ calStore  │         │            │  ┌───────────┐  │
│         │         │  │ targetTr  │         │            │  │Service    │  │
│         │         │  └──────────┘         │            │  │ Worker    │  │
│         │         │         │              │            │  │(PWA Cache)│  │
│         │         │         ▼              │            │  └───────────┘  │
│         │         │  ┌──────────────────┐  │            │                 │
│         │         │  │   DSP Engine     │  │            │  ┌───────────┐  │
│         │         │  │                  │  │            │  │IndexedDB  │  │
│         │         │  │ dspWorker (Web   │──┘            │  │(Snapshots)│  │
│         │         │  │ Worker)          │               │  └───────────┘  │
│         │         │  │                  │               │                 │
│         │         │  │ FFT / TransFn /  │               │  ┌───────────┐  │
│         │         │  │ Impulse / etc.   │               │  │localStor- │  │
│         │         │  └──────────────────┘               │  │age (Config│  │
│         │         │                                     │  └───────────┘  │
│         │         └──────────────────────────────────┘                    │
│         │                                                                  │
│         ▼                                                                  │
│  ┌─────────────┐                                                          │
│  │  Render Loop │  rAF (60fps) → quadrantDraw.ts → canvasRenderers.ts     │
│  └─────────────┘                                                          │
└─────────────────────────────────────────────────────────────────────────┘
       │                          ▲
       │ HW Audio                 │ SW / Config
       ▼                          │
┌──────────────────┐    ┌──────────────────────┐
│ Micrófono medición│    │  Archivos            │
│ Interfaz de audio │    │  - Calibración mic   │
│                   │    │  - Import/Export JSON│
└──────────────────┘    │  - APST .wav         │
                        └──────────────────────┘
```

---

## 2.2. Modelo de capacidades por niveles (Tiers)

El sistema implementa detección automática de hardware al inicio para determinar qué capacidades están disponibles. Esto permite que la aplicación funcione en cualquier dispositivo sin romperse.

```
Boot sequence:
  1. Detectar memoria (navigator.deviceMemory)
  2. Detectar WebGPU (navigator.gpu)
  3. Detectar WASM SIMD
  4. Asignar Tier
```

### Tier 0 — Modo determinístico (fallback)

| Condición | Sin WebGPU, RAM < 4 GB |
|-----------|------------------------|
| **Habilitado** | DSP completo (WASM/WebFFT), reglas heurísticas (Fast-Rail), renderizado Canvas |
| **Deshabilitado** | RAG semántico, inferencia en lenguaje natural, explicaciones detalladas |
| **Comportamiento** | Usa respuestas pre-compiladas para diagnósticos comunes |

### Tier 1 — Modo CPU intermedio

| Condición | Sin WebGPU, RAM ≥ 4 GB, WASM SIMD disponible |
|-----------|------------------------------------------------|
| **Habilitado** | RAG por similitud de cosenos, modelos ultra-ligeros (<200M params) vía ONNX Runtime Web |
| **Deshabilitado** | Modelos >500M parámetros |

### Tier 2 — Modo acelerado (full)

| Condición | WebGPU disponible, VRAM ≥ 2 GB, RAM ≥ 8 GB |
|-----------|---------------------------------------------|
| **Habilitado** | Todas las funciones. Modelos cuantizados ~0.5B params vía Transformers.js con WebGPU |

> **Nota**: Actualmente (v0.2) solo el Tier 0 está implementado. Los Tiers 1 y 2 son para fases futuras (Fase 2+).

---

## 2.3. Targets de despliegue

### Target 1: PWA (Web)

- **Framework**: Svelte 5 + Vite 8 + adapter-static
- **Host**: GitHub Pages (`/asistente/`)
- **Service Worker**: @vite-pwa/sveltekit para caché offline
- **SharedArrayBuffer**: Requiere cabeceras COOP/COEP (inyectadas en `hooks.server.ts`)
- **Audio**: Web Audio API (AudioWorklet para captura de baja latencia)
- **Limitación**: Depende de drivers genéricos del SO (WASAPI Shared en Windows)

### Target 2: Tauri (Desktop nativo)

- **UI**: Mismo bundle Svelte 5, renderizado en WebView2
- **Backend**: Rust con `cpal` para acceso a ASIO/WASAPI Exclusive/CoreAudio
- **Comandos IPC**: `list_audio_devices()`, `select_audio_device()`
- **Ventaja**: Acceso a hardware de audio profesional con baja latencia
- **Estado actual**: Backend Tauri implementado pero `TauriAudioProvider` usa datos simulados (la captura real vía cpal no está integrada aún)

---

## 2.4. Flujo de datos de alto nivel

```
┌──────────┐   ┌────────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐
│ HARDWARE │──>│  CAPTURA   │──>│   DSP     │──>│  RENDER  │──>│   UI     │
│ (Mic+    │   │ (Audio-    │   │ (Web      │   │ (Canvas  │   │ (Svelte  │
│  Interface)│   │  Worklet)  │   │  Worker)  │   │  2D)     │   │  Stores) │
└──────────┘   └────────────┘   └───────────┘   └──────────┘   └──────────┘
                    │                │               │              │
                    ▼                ▼               ▼              ▼
              Float32Array     DSPWorkerResult   60fps rAF     traceManager
              (ref + meas)     (magnitud,        loop          eqStore
                               fase, coher,                   meterStore
                               impulso, etc)                   ...
```

**Pasos:**

1. **HAL** captura audio del micrófono (entrada = medición) y genera la señal de referencia (salida → línea → entrada de referencia de la interfaz)
2. **AudioWorklet** entrega bloques de `Float32Array` (ref + meas) al hilo principal vía `SharedArrayBuffer`
3. **MathOrchestrator** recibe los datos, los almacena en buffers circulares, y cada `dspUpdateRate` ms envía al Web Worker
4. **dspWorker** calcula FFT, función de transferencia, fase, coherencia, respuesta al impulso, etc. Devuelve `DSPWorkerResult`
5. **Stores** se actualizan con los nuevos datos (traceManager, meterStore, eqStore)
6. **Render Loop** (rAF) toma los datos de las stores y dibuja en el Canvas a 60fps
7. **UI** reacciona a los cambios de estado

---

## 2.5. Arquitectura de captura (AudioWorklet + SharedArrayBuffer)

El sistema usa **AudioWorklet** para la captura de audio, ejecutándose en el hilo de audio isócrono del browser.

```
AudioWorklet (hilo isócrono)
  │
  │ Bloque de 128 samples cada ~2.7ms @48kHz
  │
  ├── Lee entrada (micrófono de medición) → meas
  ├── Lee referencia (loopback de la señal generada) → ref
  │
  └── Escribe en SharedArrayBuffer
        │
        ▼
  Main Thread (hilo principal)
        │
        Lee SharedArrayBuffer sin copia
        │
        ▼
  MathOrchestrator.feedTimeDomain(meas, ref)
```

> **Nota**: SharedArrayBuffer requiere COOP/COEP. Ver [06-despliegue-y-configuracion.md](./06-despliegue-y-configuracion.md#headers-de-seguridad).

### Procesamiento dual (Fast-Path / Slow-Path)

Para secuencias APST largas:

- **Fast-Path** (tiempo real): Worker ligero monitorea el audio entrante para feedback visual fluido y detección de *showstoppers* (acoples, clipping). Si el CPU no da abasto, aborta dinámicamente y la UI muestra "Grabando..."
- **Slow-Path** (offline): Al finalizar la secuencia, un Web Worker pesado procesa el buffer completo con FFT de alta resolución para máxima precisión.

---

## 2.6. Comunicación entre módulos

```
┌─────────────────────────────────────────────────────┐
│                   Stores (Runes)                     │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ traceManager │  │ eqStore  │  │ ui (UIStore)  │  │
│  │ .svelte.ts   │  │.svelte.ts│  │ .svelte.ts    │  │
│  └──────┬───────┘  └────┬─────┘  └───────┬───────┘  │
│         │               │                │           │
│  ┌──────┴───────┐  ┌────┴─────┐  ┌───────┴───────┐  │
│  │ meterStore   │  │calStore  │  │ targetTrace   │  │
│  │ .svelte.ts   │  │.svelte.ts│  │ .svelte.ts    │  │
│  └──────────────┘  └──────────┘  └───────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │        mathOrchestrator.svelte.ts            │   │
│  │  (Orquestador central del pipeline DSP)      │   │
│  │  Recibe: feedTimeDomain()                    │   │
│  │  Envía:  buffers al dspWorker               │   │
│  │  Recibe: DSPWorkerResult                     │   │
│  │  Escribe: traceManager, meterStore           │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│   dspWorker.ts   │    │  HAL (Audio)     │
│   (Web Worker)   │    │  Provider        │
│                  │    │                  │
│ FFT + TransFn +  │    │ startCapture()   │
│ Impulse + etc.   │    │ playGenerator()  │
└──────────────────┘    └──────────────────┘
```

---

## 2.7. Capas de la aplicación

| Capa | Responsabilidad | Archivos clave |
|------|----------------|----------------|
| **HAL** | Abstraer hardware de audio (Web vs Tauri) | `lib/hal/` |
| **DSP Engine** | Procesamiento de señales: FFT, TF, impulso, EQ | `lib/dsp/` |
| **State (Stores)** | Estado reactivo global de la aplicación | `lib/stores/` |
| **UI Components** | Componentes Svelte para la interfaz | `components/` |
| **Canvas Renderers** | Dibujado de métricas en Canvas 2D | `lib/dsp/renderers/` |
| **APST** | Protocolo de medición estandarizado | `lib/dsp/apst/` |
| **Optimizers** | Algoritmos de optimización de EQ | `lib/dsp/optimizers/` |
| **Persistence** | Almacenamiento local (IndexedDB, localStorage) | `lib/utils/` |
| **Config** | Configuración de build y despliegue | `svelte.config.js`, `vite.config.ts`, `src-tauri/` |

---

## 2.8. Archivos clave de entrada del sistema

| Archivo | Propósito |
|---------|-----------|
| `src/app.html` | Template HTML raíz |
| `src/hooks.server.ts` | Inyecta cabeceras COOP/COEP para SharedArrayBuffer |
| `src/routes/+layout.svelte` | Layout global con favicon dinámico y tema |
| `src/routes/+page.svelte` | Página única de la aplicación (SPA) |
| `src/routes/+layout.ts` | Config: prerender=true, ssr=false |
| `src/routes/layout.css` | Sistema de diseño completo (temas, paletas) |
| `src/lib/hal/index.ts` | Factory: elige WebAudioProvider o TauriAudioProvider |
| `src/lib/stores/mathOrchestrator.svelte.ts` | Orquestador central del pipeline DSP |
| `src/lib/stores/traceManager.svelte.ts` | Gestión de capas, instantáneas y sesiones |
| `src/lib/dsp/dspWorker.ts` | Web Worker con todo el procesamiento pesado |
| `src/lib/dsp/quadrantDraw.ts` | Orquestador de dibujado de canvas |
