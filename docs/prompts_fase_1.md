# Prompts de Implementación: Fase 1 (Para Gemini 3 Flash)

Este documento contiene una secuencia de prompts diseñados para copiar y pegar en un modelo de contexto limitado (como Gemini 3 Flash o modelos rápidos). Cada prompt es "autocontenido" y proporciona las instrucciones arquitectónicas exactas.

## Instrucciones de uso
1. Abre un nuevo chat con Gemini.
2. Copia y pega cada bloque marcado como **[PROMPT]** secuencialmente.
3. Aplica los cambios sugeridos en tu proyecto local antes de enviar el siguiente prompt.

---

### [PROMPT 13] Automatización de Releases de Tauri (GitHub Actions)
```text
Actúa como un DevOps y Desarrollador Rust/Tauri Senior. En la fase anterior configuramos el despliegue de la PWA a GitHub Pages. Ahora necesitamos automatizar la compilación y publicación de los binarios nativos de escritorio (Tauri) utilizando GitHub Actions.

1. Crea el archivo `.github/workflows/release.yml`.
   - El workflow debe dispararse manualmente (`workflow_dispatch`) o cuando se crea un tag (ej. `v*`).
   - Debe correr en un runner de `windows-latest`.
   - Debe instalar Node.js, Rust (toolchain estable) y las dependencias del OS necesarias.
   - Debe ejecutar `npm install`.
   - Utiliza la acción oficial `tauri-apps/tauri-action` para compilar el binario de Tauri.
   - Configura la acción para que tome los artefactos generados (el instalador `.msi` o `.exe`) y los publique automáticamente como un GitHub Release, usando el token de GitHub `secrets.GITHUB_TOKEN`.

Genera el código YAML completo y comenta si hay algún prerrequisito en `tauri.conf.json` (como configurar el `bundle.identifier`).
```

---

### [PROMPT 14] APST: Módulo de Playback de Audio Pregrabado
```text
Actúa como un Desarrollador Svelte/TypeScript Senior. Estamos construyendo el núcleo de medición "APST Core". En lugar de sintetizar audio de prueba al vuelo, usaremos archivos `.flac` o `.wav` de altísima fidelidad previamente generados por nuestra herramienta offline.

1. Extiende la interfaz `AudioProvider` en `src/lib/hal/types.ts` añadiendo el método opcional: `playSample?(url: string): Promise<void>`.
2. Actualiza `WebAudioProvider.ts` para implementar este método. Debe usar `fetch` para obtener el archivo de la URL proporcionada, decodificarlo con `audioContext.decodeAudioData()`, y reproducirlo usando un `AudioBufferSourceNode` conectado al `destination`. El Promise debe resolverse cuando la reproducción termine (usando el evento `onended`).
3. Crea un archivo `src/lib/dsp/apst/Player.ts`. Esta clase o módulo será un wrapper de alto nivel que:
   - Recibe la instancia del HAL (`AudioProvider`).
   - Tiene un método `playSequence(sequenceName: string, sampleRate: number, type: 'HF' | 'LF')`.
   - Construye la URL del archivo (ej. `/asistente/audio/secuencias/${sequenceName}_${type}_${sampleRate}.wav`).
   - Invoca al HAL para reproducirlo.

Genera el código TypeScript para estas modificaciones e implementaciones.
```

---

### [PROMPT 15] APST: Detector Goertzel para FSK (AudioWorklet)
```text
Nuestro sistema orquesta las mediciones escuchando señales acústicas FSK (Frequency-Shift Keying). Necesitamos detectar tonos específicos en tiempo real dentro del hilo de audio.

1. Crea el archivo `src/lib/dsp/apst/GoertzelDetector.ts`. 
   - Debe implementar la matemática pura del algoritmo Goertzel genérico.
   - Recibe como parámetros en el constructor: `targetFrequency`, `sampleRate` y `blockSize`.
   - Tiene un método `processBlock(samples: Float32Array): number` que retorna la magnitud o energía detectada de esa frecuencia específica en el bloque.

2. Modifica nuestro procesador existente `public/worklets/audio-capture-processor.js`.
   - Instancia internamente el algoritmo de Goertzel (quizás necesites transcribir la lógica pura a JS vainilla dentro de este archivo, ya que los worklets no pueden importar módulos de TS directamente).
   - Configura dos "bancos" paralelos para HF (High Frequency): 1650 Hz (Mark) y 1850 Hz (Space).
   - En el método `process`, corre las muestras entrantes por ambos bancos de Goertzel. Compara las energías: si la energía de 1650 Hz supera el umbral, estamos leyendo un '1'. Si la de 1850 Hz, un '0'.
   - Implementa una máquina de estados básica que logre detectar el "Start Bit", lea los 7 bits de datos (110 baudios = ~1 bit cada 436 muestras a 48kHz), valide la paridad y extraiga el caracter ASCII.
   - Cuando detecte una cabecera completa, emite un mensaje al hilo principal mediante `this.port.postMessage({ type: 'FSK_HEADER', payload: 'V' })`.

Genera el código TypeScript del detector y el JS del worklet.
```

---

### [PROMPT 16] APST: Orquestador de Secuencias
```text
Necesitamos una máquina de estados central que coordine el playback de nuestras secuencias y reaccione a los headers detectados por el micrófono (vía FSK).

1. Crea el archivo `src/lib/dsp/apst/Orchestrator.ts`.
   - Debe recibir la instancia del `Player` y el listener que recibe los mensajes del Worklet.
   - Tiene un método `runSequence(sequenceString: string)` (ej: `"V A N F P"`).
   - Internamente, itera sobre los caracteres de la secuencia. Por cada uno:
     a) Pide al `Player` que reproduzca el audio de ese segmento (ej. `segmento_V...`).
     b) Espera pasivamente (Promise) hasta que el callback del micrófono reciba un evento `FSK_HEADER` cuyo payload coincida con la letra esperada, o se agote un timeout de seguridad (ej. 3 segundos).
     c) Si detecta la cabecera, invoca al módulo encargado de procesar ese segmento de audio (que construiremos luego) pasando el buffer entrante.
     d) Al terminar, avanza a la siguiente letra de la secuencia.
   - Debe emitir eventos de estado (ej. "ESPERANDO_CABECERA", "PROCESANDO", "ERROR_TIMEOUT") para que la UI pueda mostrarlos.

Genera el código TypeScript de la clase Orchestrator utilizando promesas y manejadores de eventos.
```

---

### [PROMPT 17] APST: Segmentos Atómicos (V, A, N)
```text
Vamos a implementar la lógica de procesamiento post-captura para los 3 primeros segmentos de medición acústica. Estos segmentos actúan sobre el audio capturado inmediatamente después de la cabecera FSK.

Crea los siguientes archivos en `src/lib/dsp/apst/segments/`:
1. `SegmentV.ts` (Verificación de Integridad):
   - Objetivo: Confirmar que el audio acústico está llegando al micrófono.
   - Acción: Recibe 1 segundo de audio capturado. Calcula el valor RMS (Root Mean Square) del bloque. Si el RMS es mayor a un umbral (ej. 0.01), retorna "OK". Si es menor, retorna "ERROR_NO_AUDIO".
2. `SegmentA.ts` (Normalización):
   - Objetivo: Medir el nivel del tono puro (1 kHz) emitido por el sistema.
   - Acción: Mide el RMS. Calcula el offset necesario en decibelios para llevar este nivel a un "0 dB de referencia interno". Retorna ese factor de compensación de ganancia.
3. `SegmentN.ts` (Ruido de Fondo):
   - Objetivo: Medir el silencio del recinto y calcular la Relación Señal/Ruido (SNR).
   - Acción: Mide el RMS del periodo de silencio. Compara este nivel contra el RMS obtenido previamente en el Segmento A. Si la diferencia (SNR) es menor a 15 dB, retorna un "ERROR_LOW_SNR", indicando que hay demasiado ruido ambiente para una calibración automática confiable.

Genera el código TypeScript para estas tres clases/funciones puras.
```

---

### [PROMPT 18] Función de Transferencia y Matemáticas Complejas
```text
Para los segmentos avanzados (Fase, Coherencia, Alineamiento), necesitamos comparar matemáticamente el canal de salida de referencia contra la entrada del micrófono en el dominio de la frecuencia.

1. Crea `src/lib/dsp/math.ts` con funciones de utilidad para números complejos (ya que JS no los soporta nativamente): suma, resta, multiplicación, multiplicación por conjugado, cálculo de magnitud (módulo) y ángulo (fase) a partir de arrays de partes `real` e `imag`.

2. Crea `src/lib/dsp/TransferFunction.ts`.
   - Debe recibir el espectro (FFT real e imag) de una Señal de Referencia `X(f)` y de la Señal Medida `Y(f)`.
   - Calcula la Función de Transferencia `H(f) = Y(f) / X(f)`. Explicado en arrays: `H_real` y `H_imag` usando multiplicación compleja por el conjugado del denominador.
   - De `H(f)`, deriva la **Magnitud** en decibelios (`20 * log10(|H|)`).
   - De `H(f)`, deriva la **Fase** (`Math.atan2(imag, real)`).
   - Implementa un cálculo estadístico acumulativo para la **Coherencia (γ²)**, que mide entre 0 y 1 qué tanta causalidad lineal existe entre la referencia y la medición para cada bin de frecuencia.

Genera el código en TypeScript, optimizado con bucles iterando sobre Float32Arrays.
```

---

### [PROMPT 19] APST: Testeador de Cables (Loopback) y Segmentos F, P
```text
Aprovechando la Función de Transferencia recién creada, implementemos los segmentos acústicos finales y un caso de uso físico (Loopback).

1. Crea `src/lib/dsp/apst/segments/SegmentF.ts` (Respuesta en Frecuencia).
   - Toma el audio capturado (un log-sweep). Ejecuta la FFT y calcula la Magnitud Espectral.

2. Crea `src/lib/dsp/apst/segments/SegmentP.ts` (Polaridad).
   - Usa la Función de Transferencia comparando la señal de salida original contra la capturada.
   - Analiza la Fase. Si la fase promedio (o en bandas bajas) se agrupa cerca de 180° (o -180°, π o -π radianes), diagnostica una "Inversión de Polaridad de Cable (Pin 2 y 3 cruzados)". Retorna `true` o `false`.

3. Crea `src/lib/dsp/apst/CableTester.ts` (Testeador de Cables).
   - Esta utilidad es para cuando el usuario conecta un cable desde la salida de la interfaz de audio directo a la entrada (circuito cerrado, sin altavoces).
   - Orquesta internamente un envío de la secuencia `V` (para continuidad) seguido de la `P` (para fase).
   - Devuelve un diagnóstico visual simple: "Cable OK", "Roto/No hay señal", o "Polaridad Invertida".

Genera el código TypeScript para estos tres módulos.
```

---

### [PROMPT 20] Calibración Interactiva: Curva Objetivo y Estado
```text
Pasando a la Fase 1B, necesitamos gestionar el estado global de la calibración que verá el usuario en pantalla.

1. Crea el archivo `src/lib/stores/calibrationStore.ts` utilizando las runas modernas de Svelte 5 (`$state`).
   - El estado debe almacenar:
     - `measuredCurve`: Un array de magnitud espectral (los datos reales capturados por el micrófono).
     - `targetCurve`: Un array de respuesta plana (0 dB) por defecto, pero con parámetros para modificarla (ej. tilt o roll-offs en extremos).
     - `suggestedFilters`: Un array de objetos `{ frequency: number, gain: number, q: number, type: 'peaking' | 'highshelf' | 'lowshelf' }`.
     - `predictedCurve`: Un array calculado automáticamente (Suma de `measuredCurve` + respuesta combinada de todos los `suggestedFilters`).
     - `agnosticMode`: Booleano para activar el "Modo Agnóstico" (que restringe correcciones extremas).

Genera el código TypeScript del store, asegurándote de que la curva predicha se derive reactivamente.
```

---

### [PROMPT 21] Motor AutoEq de Derivación de Filtros
```text
Vamos a implementar el núcleo de la inteligencia de ecualización. El sistema debe sugerir filtros paramétricos para que la medición se acerque a la curva objetivo, pero respetando estrictos muros de seguridad.

1. Crea `src/lib/dsp/AutoEq.ts`. 
   - Exporta una función `deriveFilters(measured: Float32Array, target: Float32Array, coherence: Float32Array, agnosticMode: boolean): Filter[]`.
   - Pasos del algoritmo:
     1. Calcula el error (`measured - target`).
     2. Muros de seguridad: Si `agnosticMode` es `true`, NINGÚN filtro puede tener ganancia positiva (solo se permiten recortes/cortes). Si es `false`, el máximo boost permitido es +3 dB.
     3. Identifica picos prominentes en el error y asigna un filtro `peaking` con ganancia inversa al error (hasta el límite de seguridad).
     4. Gate de Coherencia: Ignora zonas donde el array `coherence` sea menor a 0.5 (indicando ruido o reflejos no corregibles).

Genera el código en TypeScript. Usa un algoritmo heurístico simple ("peak finding") para derivar hasta un máximo de 6 filtros paramétricos.
```

---

### [PROMPT 22] UI: Trace Math Visualizer
```text
Vamos a crear el dashboard visual de la medición, que es una evolución de nuestro RTA inicial.

1. Crea `src/components/TraceMath.svelte`.
   - Utiliza un Canvas interactivo.
   - Debe dibujar 3 trazos o capas superpuestas, obtenidas del `calibrationStore`:
     a) Medición Cruda (ej. color gris/azul opaco).
     b) Filtro Inverso / EQ Target (ej. color amarillo translúcido).
     c) Respuesta Prevista (Suma algebraica de A + B) (ej. color verde brillante).
   - Añade debajo del gráfico un medidor tipo "Semáforo" horizontal que lea el promedio de la Coherencia (Verde > 0.8, Amarillo > 0.5, Rojo < 0.5).

2. Crea `src/components/FilterList.svelte`.
   - Renderiza una tabla o lista de controles vinculada bidireccionalmente a `calibrationStore.suggestedFilters`.
   - Por cada filtro, el operador debe tener sliders o inputs de números para alterar la Frecuencia, Ganancia y Q. Cuando el operador modifique un valor, el store reactivo debe actualizar automáticamente la capa de "Respuesta Prevista" en el gráfico.

Genera el código de Svelte 5 para ambos componentes.
```
