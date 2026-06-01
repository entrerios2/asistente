# Prompts de Implementación: Fase 0 (Para Gemini 3 Flash)

Este documento contiene una secuencia de prompts diseñados para copiar y pegar en un modelo de contexto limitado (como Gemini 3 Flash o modelos rápidos). 

Dado que estos modelos pierden memoria fácilmente, cada prompt está "autocontenido": incluye el contexto exacto necesario, las reglas de arquitectura y los archivos específicos a generar, sin abrumar al modelo con todo el Documento de Definición del Sistema.

## Instrucciones de uso
1. Abre un nuevo chat con Gemini.
2. Copia y pega cada bloque marcado como **[PROMPT]** secuencialmente.
3. Aplica los cambios sugeridos en tu proyecto local antes de enviar el siguiente prompt.

---

### [PROMPT 1] Scaffolding, Tailwind y Seguridad Web
```text
Actúa como un Desarrollador Svelte 5 Senior. Estamos construyendo un "Asistente de audio y video para asambleas" (una PWA que analiza audio en vivo). 

Necesito que me des los comandos de terminal exactos y el código para inicializar el scaffolding del proyecto con las siguientes restricciones:
1. Usa Svelte 5 con TypeScript y Vite.
2. Instala y configura Tailwind CSS v3 (o v4 si es la recomendada actual). El diseño debe priorizar temas claros de alto contraste.
3. Instala `vite-plugin-pwa` para el soporte PWA básico.

Lo más importante: necesito que me generes el archivo `vite.config.ts` completo. Este archivo DEBE configurar el plugin de Svelte, el plugin de PWA, y DEBE inyectar los siguientes headers HTTP para habilitar el uso de `SharedArrayBuffer` en el navegador (vital para nuestro motor de audio):
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
Además, el `base` de vite debe ser `/asistente/`.

Dame los comandos y el contenido de `vite.config.ts` y `tailwind.config.js`.
```

---

### [PROMPT 2] Capa de Abstracción de Hardware (HAL) - Interfaces
```text
Excelente. Ahora vamos a construir la arquitectura central del audio. El proyecto compilará tanto para Web (PWA) como para Escritorio Nativo (Tauri). Para que nuestro código de interfaz (Svelte) no se entere de dónde viene el audio, usaremos un HAL (Hardware Abstraction Layer).

Crea el archivo `src/lib/hal/types.ts` con TypeScript. Necesito que exportes:
1. Un tipo `AudioBufferChunk` que sea un `Float32Array`.
2. Una interfaz `AudioListener` que tenga un método `onAudioData(data: AudioBufferChunk): void`.
3. Una interfaz `AudioProvider` con los métodos:
   - `startCapture(listener: AudioListener): Promise<void>`
   - `stopCapture(): void`
   - `playPinkNoise(active: boolean): void`

Luego, crea un archivo `src/lib/hal/index.ts`. Este será un "Factory". Por ahora, debe exportar una función `getAudioProvider(): AudioProvider`. Dentro de la función, haz un chequeo simple: si existe `window.__TAURI_INTERNALS__`, retorna un error arrojado ("Tauri provider not implemented yet"). Si no, retorna un error ("Web provider not implemented yet"). En los próximos pasos rellenaremos esto.
```

---

### [PROMPT 3] HAL Web: El AudioWorklet
```text
Ahora implementaremos la captura de audio web. Esta es la parte más crítica para el rendimiento. No podemos procesar audio en el hilo principal de JS porque causaría pérdida de frames (glitches). 

Necesito que escribas el código para el procesador de audio isócrono.
Crea el archivo `public/worklets/audio-capture-processor.js`.
Reglas:
1. Debe heredar de `AudioWorkletProcessor`.
2. En el constructor, debe recibir un evento a través de `this.port.onmessage` que le pase un `SharedArrayBuffer` configurado desde el hilo principal.
3. En el método `process(inputs, outputs, parameters)`, debe tomar el primer canal de entrada (`inputs[0][0]`) y copiar esas muestras al `SharedArrayBuffer` cíclicamente (Ring Buffer).
4. Usa Atomics si es necesario para evitar condiciones de carrera, o simplemente mantén un índice de escritura en la memoria compartida.
5. No uses `console.log` dentro del método `process` bajo ninguna circunstancia.

Genera solo el código de este archivo JavaScript en vainilla (los worklets no soportan TS directamente).
```

---

### [PROMPT 4] HAL Web: El Provider
```text
Ahora conectaremos el Worklet con nuestra interfaz de TypeScript.

Crea el archivo `src/lib/hal/web/WebAudioProvider.ts` que implemente la interfaz `AudioProvider` que definimos antes.
Reglas:
1. En `startCapture`, pide permisos de micrófono usando `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. Es crucial apagar todo el procesamiento del navegador.
2. Crea un `AudioContext` (sample rate fijo a 48000 si es posible).
3. Añade el módulo del worklet desde `/asistente/worklets/audio-capture-processor.js`.
4. Crea un `SharedArrayBuffer` grande (ej. para 1 segundo de audio a 48kHz, Float32) y pásalo al WorkletNode mediante `port.postMessage`.
5. Implementa un `setInterval` o `requestAnimationFrame` en este archivo principal que lea los datos nuevos del `SharedArrayBuffer` y dispare el callback `listener.onAudioData()` de la interfaz.

Dame el código completo de `WebAudioProvider.ts`.
```

---

### [PROMPT 5] Tauri HAL (Mock) y Detección de Tier
```text
Casi terminamos la estructura básica. Necesitamos dos cosas:

1. Crea `src/lib/hal/tauri/TauriAudioProvider.ts` que implemente `AudioProvider`. Como aún no hemos escrito el backend de Rust, haz que `startCapture` simplemente dispare un `setInterval` cada 20ms enviando un `Float32Array` lleno de ruido blanco matemático (Math.random) al `listener.onAudioData`. Esto simulará el IPC.
2. Actualiza `src/lib/hal/index.ts` para que importe `WebAudioProvider` y `TauriAudioProvider` y devuelva el correcto según `window.__TAURI_INTERNALS__`.
3. Crea `src/lib/utils/tierDetector.ts`. Exporta una función `detectTier(): 'TIER_0' | 'TIER_1' | 'TIER_2'`. 
   - Retorna TIER_2 si `navigator.gpu` existe.
   - Retorna TIER_1 si `navigator.deviceMemory >= 4`.
   - Si no, TIER_0.

Genera los tres archivos.
```

---

### [PROMPT 6] UI: Canvas RTA y Svelte 5 App
```text
Por último, vamos a atar todo en la interfaz usando Svelte 5 (usa Runes: $state, $effect).

1. Crea el componente `src/components/RTA.svelte`. 
   - Debe recibir una prop `audioData` (que será un Float32Array actualizado constantemente).
   - Usa un `<canvas>` HTML de ancho completo.
   - En un `$effect`, configura un `requestAnimationFrame`. Por ahora, como no hemos implementado la Transformada de Fourier (FFT), simplemente dibuja la "Forma de Onda" en el tiempo (Osciloscopio) leyendo el arreglo `audioData` y dibujando una línea en el canvas. Asegúrate de usar un color de alto contraste (ej. un azul eléctrico sobre fondo blanco/gris muy claro).

2. Sobrescribe `src/App.svelte`.
   - Usa un layout moderno con Tailwind (fondo claro, alto contraste).
   - Al montar el componente, llama a `detectTier()` y guárdalo en un `$state`.
   - Usa `getAudioProvider()` del HAL.
   - Ten un botón grande para "Iniciar Captura" / "Detener Captura".
   - Al iniciar, pasa un listener al provider que actualice una variable `$state` con los datos crudos, la cual se le pasa como prop al `<RTA />`.

Muestra el código de ambos componentes. Recuerda usar la sintaxis moderna de Svelte 5.
```

---

### [PROMPT 7] Motor FFT Independiente y Analyzer DSP
```text
Actúa como un Desarrollador Svelte/TypeScript Senior. Estamos construyendo un analizador de audio. En fases anteriores creamos un HAL que nos da buffers de audio crudo (`Float32Array`). Ahora necesitamos procesarlos matemáticamente sin depender de APIs exclusivas del navegador.
No podemos usar `AnalyserNode` de la Web Audio API. Necesitamos nuestro propio motor.

1. Crea `src/lib/dsp/fft.ts`. Escribe una implementación pura en TypeScript de la Transformada Rápida de Fourier (FFT Radix-2 DIT). Debe exportar:
   - `fft(input: Float32Array): { real: Float32Array, imag: Float32Array }`
   - `magnitude(real: Float32Array, imag: Float32Array): Float32Array`
   - `applyWindow(data: Float32Array, type: 'hanning' | 'blackman'): void` (modifica in-place)

2. Crea `src/lib/dsp/Analyzer.ts`. Será una clase que consume los datos del HAL.
   - Debe tener un método `processChunk(data: Float32Array)`.
   - Acumula los datos entrantes en un buffer circular interno (ej. tamaño 2048 o 4096).
   - Cuando el buffer se llena, extrae una copia, aplica la ventana de Hanning, ejecuta la FFT, calcula la magnitud en dBFS (`20 * Math.log10(mag)`), y expone los resultados espectrales actualizados en una propiedad pública o mediante callbacks para que la UI (Svelte) los lea.

Proporciona el código TypeScript de ambos archivos. No uses librerías externas.
```

---

### [PROMPT 8] Generador de Ruido Rosa y Refactor del RTA
```text
Necesitamos implementar el generador de ruido rosa en nuestro `WebAudioProvider` y conectar nuestro nuevo `Analyzer` a la UI para visualizar espectros reales.

1. Abre `src/lib/hal/web/WebAudioProvider.ts`. Tenemos un método vacío `playPinkNoise(active: boolean)`. 
   - Modifícalo para crear un `AudioWorkletNode` auxiliar o usar el API de `ScriptProcessorNode` (si buscas simplicidad rápida) que genere ruido rosa ininterrumpidamente.
   - Para generarlo puramente en matemáticas, genera ruido blanco (`Math.random() * 2 - 1`) y pásalo por un filtro IIR de conformación (ej. el algoritmo Voss-McCartney que usa una cascada de delays o una aproximación de polos/ceros para lograr una pendiente espectral de ~-3dB/octava).
   - Conéctalo al `audioContext.destination`.

2. Abre `src/components/RTA.svelte` y actualiza la lógica visual.
   - Modifica el componente para instanciar el nuevo `Analyzer` (de `src/lib/dsp/Analyzer.ts`).
   - Cada vez que la prop `audioData` se actualice (recibe del HAL), pásala a `analyzer.processChunk(audioData)`.
   - Cambia el `requestAnimationFrame` del Canvas: debe leer la magnitud espectral (no la forma de onda temporal), y dibujar el clásico gráfico de barras RTA, usando escala logarítmica para el eje X (frecuencias) y lineal/decibelios para el eje Y.

Proporciona las modificaciones necesarias para estos archivos.
```

---

### [PROMPT 9] Deploy Pipeline para PWA Estática
```text
Vamos a configurar el despliegue continuo de nuestra PWA SvelteKit a GitHub Pages. Nuestro proyecto usa Svelte 5.

1. Explícame brevemente cómo configurar `svelte.config.js` y crear un `src/routes/+layout.ts` con `export const prerender = true` para usar `@sveltejs/adapter-static` correctamente. Nuestro base path ya es `/asistente/`.

2. Crea el archivo `.github/workflows/deploy.yml`. 
   - Configura una acción que se dispare en evento `push` a la rama `main`.
   - Usa la imagen de Node 20+.
   - Ejecuta los pasos: `npm ci`, y luego `npm run build`.
   - Despliega el contenido de la carpeta de salida generada por el adapter-static (usualmente `build/`) a GitHub Pages usando la acción nativa de GitHub Actions (upload-pages-artifact y deploy-pages) o la de peaceiris. 

Genera el YAML completo y los ajustes necesarios en SvelteKit.
```

---

### [PROMPT 10] APST Builder: Generadores de Señal Matemáticos
```text
Para la versión de Escritorio y PWA, usaremos señales de audio pregrabadas de máxima fidelidad en lugar de sintetizarlas al vuelo. Crearemos una herramienta CLI interna en Node.js llamada "APST Builder". No usará APIs de navegador, todo es matemática pura de arrays (PCM).

Crea la estructura base para el CLI en un nuevo directorio `tools/apst-builder/`:
1. `package.json`: Configúralo como type module. Necesitamos una librería para exportar WAVs, añade `wavefile` a las dependencias.
2. `src/generators/tone.ts`: Exporta una función `generateTone(frequency, durationSec, sampleRate)` que retorne un `Float32Array`. Genera una onda senoidal pura.
3. `src/generators/noise.ts`: Exporta `generatePinkNoise(durationSec, sampleRate)` -> `Float32Array`. Usa un algoritmo de filtrado matemático.
4. `src/generators/sweep.ts`: Exporta `generateLogSweep(startFreq, endFreq, durationSec, sampleRate)` -> `Float32Array`. Implementa la fórmula del chirp de barrido logarítmico (sine sweep).

Entrega el código TypeScript para configurar el paquete y generar matemáticamente estas 3 señales en arrays flotantes (-1.0 a 1.0).
```

---

### [PROMPT 11] APST Builder: Codificador FSK y Ensamblador de Archivos
```text
Siguiendo con la herramienta CLI `tools/apst-builder/`, necesitamos implementar la modulación FSK (Frequency-Shift Keying). El sistema emite cabeceras de datos por sonido antes de cada segmento acústico.

1. Crea `src/generators/fsk.ts`. Exporta `encodeFSK(text: string, type: 'HF' | 'LF', sampleRate: number): Float32Array`.
   - Implementa FSK a 110 baudios (bits por segundo).
   - Frecuencias para HF: mark (bit 1) = 1650 Hz, space (bit 0) = 1850 Hz.
   - Frecuencias para LF: mark = 150 Hz, space = 200 Hz.
   - Protocolo de Framing: Por cada caracter ASCII del string `text`, emite: 1 bit de start (space), 7 bits de datos (LSB primero), 1 bit de paridad (even), y 2 bits de stop (mark). 
   - Modula el array contiguo en base a la tasa de baudios y frecuencias.

2. Crea `src/index.ts`. Será el ejecutable principal.
   - Usa las funciones generadoras y `wavefile` para ensamblar un archivo de prueba.
   - Construye una "Secuencia V": llama a `encodeFSK('V', 'HF', 48000)`, luego concatena un `generateTone(1000, 5, 48000)`.
   - Codifica el array Float32 combinado en un archivo PCM de 24 o 32 bits a través de `wavefile` y guárdalo en disco local como `segmento_V_HF_48k.wav`.

Entrega el código de modulación FSK y el script ensamblador principal.
```

---

### [PROMPT 12] Tauri: Selección Multi-Backend de Dispositivos (ASIO/WASAPI)
```text
Vamos a implementar el acceso directo a los drivers de audio de hardware para la versión de Escritorio (Tauri), utilizando Rust.

1. Abre `src-tauri/Cargo.toml` y `src-tauri/src/lib.rs`. Debemos usar el crate `cpal` (asegúrate de incluir el feature `asio` para Windows).
   - Implementa un comando de Tauri (invokable) llamado `list_audio_devices()`.
   - Usa `cpal::available_hosts()` para iterar sobre todos los backends (WASAPI, ASIO, CoreAudio).
   - Por cada host, enumera los dispositivos de entrada y salida (`input_devices()`, `output_devices()`).
   - Retorna a Svelte un `Vec` serializable con un struct de forma: `{ id, name, backend, direction }`.
   - Implementa un segundo comando `select_audio_device(id, direction)` que por ahora solo guarde el id elegido en un `Mutex` en el state global de Tauri.

2. En la UI (Svelte), crea `src/components/DeviceSelector.svelte`. 
   - Al montar, si está corriendo bajo Tauri (`window.__TAURI_INTERNALS__` presente), invoca `list_audio_devices`.
   - Dibuja dos listas `<select>` (una para Entradas, otra para Salidas).
   - Agrupa visualmente usando `<optgroup label="ASIO">`, `<optgroup label="WASAPI">`, etc., mapeando los campos del backend.
   - Al seleccionar una opción, llama a `select_audio_device`.

Muestra el código en Rust (comando y structs) y el componente de Svelte.
```
