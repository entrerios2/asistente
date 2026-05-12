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
