# Implementación Pre-Fase: Cierre de Deudas F0 + APST Builder

## Objetivo
Cerrar las deudas técnicas pendientes de Fase 0 (motor FFT independiente, generador de ruido rosa, deploy) y producir la utilidad APST Builder que genera los archivos FLAC de secuencias de prueba, prerequisito de la Fase 1A.

## Decisiones de Diseño Aprobadas
- **Motor FFT:** Se usará una implementación JS/TS pura (ej. `fft.js` o implementación propia en TypeScript) en lugar de WASM, priorizando la depuración e iteración en esta fase temprana. La migración a WebFFT/WASM se evaluará cuando el rendimiento lo exija.
- **APST Builder:** CLI en **Node.js/TypeScript**. La lógica de síntesis de señales (tonos sinusoidales, sweeps logarítmicos, encoding FSK a 110 baudios) es código matemático puro reutilizable en el browser para generación en tiempo real futura (Tier 2).
- **Migración del análisis:** El `AnalyserNode` del Web Audio API se reemplaza por un `dsp/Analyzer.ts` que consume datos del HAL y ejecuta FFT con el motor propio, restaurando el patrón de abstracción.

## Proposed Changes

### 1. Motor FFT Independiente

#### [NEW] `src/lib/dsp/fft.ts`
Implementación de la Transformada Rápida de Fourier (FFT) en TypeScript puro. Funciones: `fft(input: Float32Array): ComplexArray`, `magnitude(complex): Float32Array`, `applyWindow(data, 'hanning' | 'blackman')`.

#### [NEW] `src/lib/dsp/Analyzer.ts`
Clase que consume los datos crudos del HAL (`AudioBufferChunk`). Acumula buffers, aplica ventaneo y ejecuta FFT para obtener la magnitud espectral. Reemplaza la dependencia directa de `AnalyserNode`.

#### [MODIFY] `src/lib/hal/web/WebAudioProvider.ts`
Eliminar el uso de `AnalyserNode` como fuente de datos espectrales. El `WebAudioProvider` ahora solo entrega audio crudo vía `onAudioData()`. El análisis se delega al `Analyzer.ts`.

### 2. Generador de Ruido Rosa

#### [MODIFY] `src/lib/hal/web/WebAudioProvider.ts`
Implementar `playPinkNoise(active: boolean)`. Genera ruido rosa mediante un filtro de conformación espectral (algoritmo Voss-McCartney o filtro IIR de 3 etapas) aplicado a ruido blanco (`Math.random()`).

### 3. Deploy Pipeline

#### [NEW] `.github/workflows/deploy.yml`
GitHub Action que ejecuta `npm run build` y despliega los artefactos estáticos a `entrerios2.github.io/asistente` vía GitHub Pages.

### 4. APST Builder (CLI)

#### [NEW] `tools/apst-builder/package.json`
Paquete Node.js independiente con dependencias mínimas (`wavefile` o similar para encoding, sin `flac` binario — se generará WAV y se convertirá si es necesario).

#### [NEW] `tools/apst-builder/src/index.ts`
Punto de entrada CLI. Parsea argumentos (`--segments`, `--sample-rate`, `--output-dir`) y orquesta la generación.

#### [NEW] `tools/apst-builder/src/generators/tone.ts`
Generador de tonos sinusoidales puros (para Segmento `A`: 1 kHz a nivel nominal).

#### [NEW] `tools/apst-builder/src/generators/sweep.ts`
Generador de sweep logarítmico (para Segmentos `F` y `S`). Parámetros: frecuencia inicio/fin, duración, sample rate.

#### [NEW] `tools/apst-builder/src/generators/noise.ts`
Generador de ruido rosa (para Segmento `M`).

#### [NEW] `tools/apst-builder/src/generators/fsk.ts`
Encoder FSK a 110 baudios (1650/1850 Hz para HF, 150/200 Hz para LF). Genera la cabecera binaria con framing: 1 start, 7 data, 1 parity (even), 2 stop bits. Cada cabecera codifica el identificador del segmento que le sigue.

#### [NEW] `tools/apst-builder/src/assembler.ts`
Ensambla cabecera FSK + contenido del segmento en un único archivo. Genera variantes HF y LF, y las 3 frecuencias de muestreo (44.1, 48, 96 kHz). Produce también las secuencias compuestas pre-ensambladas (ej. Wizard Base = `V A M N F P T D R`).

### 5. Selección de Dispositivo de Audio (Tauri)

#### [MODIFY] `src-tauri/src/lib.rs`
Implementar 3 comandos IPC:
- `list_audio_devices` — Enumera todos los dispositivos de entrada y salida de todos los backends activos (`cpal::available_hosts()`). Devuelve: `{ id, name, backend: "WASAPI"|"ASIO"|"CoreAudio", direction, sampleRates, channels }`.
- `select_audio_device(deviceId, direction)` — Selecciona un dispositivo específico para entrada o salida. Persiste la preferencia.
- `get_audio_backend_info` — Informa qué backends están disponibles y si tienen dispositivos activos.

#### [MODIFY] `src/lib/hal/types.ts`
Extender la interfaz `AudioProvider` con métodos opcionales de enumeración:
```typescript
listDevices?(): Promise<AudioDevice[]>
selectDevice?(id: string, direction: 'input' | 'output'): Promise<void>
```

#### [MODIFY] `src/lib/hal/tauri/TauriAudioProvider.ts`
Implementar `listDevices()` y `selectDevice()` invocando los comandos IPC de Rust.

#### [NEW] `src/components/DeviceSelector.svelte`
Dropdown agrupado por backend con badges visuales (ASIO verde, WASAPI gris, CoreAudio azul). Dos selectores independientes: entrada y salida. Muestra sample rate y canales. Solo visible en la versión Tauri.

## Verification Plan

### Automated/Local Tests
- **FFT:** Test unitario: FFT de una sinusoide pura de 1 kHz debe producir un pico en el bin correspondiente y magnitud cercana a 0 en el resto.
- **Ruido Rosa:** Verificar en DevTools que la pendiente espectral es ~-3 dB/octava.
- **APST Builder:** Validar que los FLAC generados tienen el sample rate correcto y que la cabecera FSK se decodifica correctamente por un decoder de referencia.
- **Deploy:** Verificar que `entrerios2.github.io/asistente` sirve la app y es instalable como PWA.

### Manual Verification
- **Migración FFT:** Confirmar que el RTA se ve idéntico al anterior pero usando el motor propio.
- **FLAC Playback:** Reproducir un archivo generado en un reproductor externo y verificar audibilidad de la cabecera FSK.
- **Device Selector (Tauri):** Abrir la app nativa, verificar que lista las interfaces de audio conectadas agrupadas por backend. Seleccionar entrada/salida y confirmar que el RTA captura desde el dispositivo elegido.
