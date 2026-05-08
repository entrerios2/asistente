# Implementación Fase 0: Fundación, Scaffolding y HAL

## Objetivo
Establecer la arquitectura base del proyecto "Asistente de Audio Proactivo" con un enfoque dual-target (PWA y Tauri nativo). La fase incluye la configuración del entorno Svelte 5 + Vite, la creación de la Capa de Abstracción de Hardware (HAL) para audio, el procesamiento de audio crudo y la visualización de un analizador de espectro (RTA) en Canvas.

## Decisiones de Diseño Aprobadas
- **UI y Estilos:** Se utilizará **TailwindCSS** para un desarrollo rápido de la interfaz. Dado que la herramienta se usará en asambleas y entornos iluminados, el diseño priorizará temas claros de alto contraste (aunque soportará dark mode). Todo el renderizado intensivo (RTA, Stage Plot) se aislará en **Canvas API** para no comprometer el rendimiento de los estilos CSS.
- **Backend Rust (Tauri) en Fase 0:** Se implementará el andamiaje IPC del HAL para asegurar que Svelte pueda comunicarse con Rust. Sin embargo, para no bloquear la Fase 0 en configuraciones complejas de ASIO/cpal, la captura nativa será básica o simulada, priorizando la robustez del puente IPC y volcando el esfuerzo principal en el `AudioWorklet` de la versión web.

## Proposed Changes

### 1. Scaffolding y Configuración Base
- **Svelte + Vite:** Inicializar el proyecto Svelte 5 con TypeScript (`npm create vite@latest`).
- **Tailwind CSS:** Instalar y configurar Tailwind CSS v3 / v4 para el estilizado.
- **Vite Config:** Configurar `vite.config.ts` con `base: '/asistente/'` y añadir headers de seguridad COOP/COEP (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) necesarios para habilitar `SharedArrayBuffer`.
- **Tauri:** Inicializar el backend Rust con `cargo tauri init` (apuntando al `dist` de Vite).
- **PWA:** Configurar `vite-plugin-pwa` para generar el `manifest.json` y el Service Worker.

### 2. Capa de Abstracción de Hardware (HAL)
Crear la estructura modular agnóstica al entorno en `src/lib/hal/`:

#### [NEW] `src/lib/hal/types.ts`
Definir las interfaces: `AudioProvider` y `AudioListener`. Métodos esenciales: `startCapture()`, `stopCapture()`, `playPinkNoise()`.

#### [NEW] `src/lib/hal/web/AudioWorkletProcessor.ts`
Un script de AudioWorklet que corre en el hilo isócrono. Recibe las muestras del micrófono y las escribe cíclicamente en un `SharedArrayBuffer` sin bloquear ni perder frames.

#### [NEW] `src/lib/hal/web/WebAudioProvider.ts`
Implementación para la PWA. Configura el `AudioContext`, carga el Worklet, pide permisos de `getUserMedia` e instancia la memoria compartida.

#### [NEW] `src/lib/hal/tauri/TauriAudioProvider.ts`
Implementación para la app nativa. Usa `@tauri-apps/api/core` para invocar el inicio de captura en Rust y escucha los eventos IPC con los *chunks* de audio.

#### [NEW] `src/lib/hal/index.ts`
El *Factory*. Detecta el entorno (ej. chequeando `window.__TAURI_INTERNALS__`) y devuelve la implementación adecuada.

### 3. Motor DSP (Procesamiento Analítico)
#### [NEW] `src/lib/dsp/Analyzer.ts`
Clase que consume los datos del HAL. Acumula los *buffers*, aplica ventanas (Hanning) y ejecuta la Transformada Rápida de Fourier (FFT) para obtener la magnitud espectral.

### 4. Detección de Capacidades (Tiering)
#### [NEW] `src/lib/utils/tierDetector.ts`
Clasificar el dispositivo en Tier 0, 1 o 2 basándose en `navigator.deviceMemory`, `wasmFeatureDetect.simd` y `navigator.gpu`.

### 5. Interfaz de Usuario (UI)
#### [MODIFY] `src/App.svelte`
Punto de entrada. Muestra el estado del Tier detectado y controles básicos (Start/Stop micrófono, Activar Ruido Rosa).

#### [NEW] `src/components/RTA.svelte`
Componente visual basado en Canvas API. Utiliza un bucle `requestAnimationFrame` a ~20 FPS que consulta los últimos datos espectrales del `Analyzer` y dibuja las barras de frecuencia (con retención de picos).

## Verification Plan

### Automated/Local Tests
- **Deploy Web:** Ejecutar `npm run build` y `npm run preview`. Verificar que la aplicación sirva correctamente bajo el path `/asistente/`.
- **Seguridad de Hilos:** Comprobar en consola que `SharedArrayBuffer` está disponible.
- **Compilación Tauri:** Ejecutar `cargo tauri dev`.

### Manual Verification
- **Captura Web:** Autorizar el micrófono y validar que el RTA reacciona adecuadamente a la voz.
- **Rendimiento:** Verificar en DevTools que no haya pérdidas de memoria ni caídas severas de cuadros en el canvas.
