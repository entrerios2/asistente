# Prompts de Implementación — Fase 2A: UI de Medición Avanzada

Este documento contiene los prompts de implementación estructurados para ser ejecutados secuencialmente por el Agente de IA. Cada prompt corresponde a un bloque del `implementation_plan_phase_2a.md`.

---

## Prompt 1: APST Builder a WAV y Extensión del Cable Tester

**Contexto:** Estamos iniciando la Fase 2A del Asistente de Audio APST. Necesitamos cerrar primero las deudas técnicas de la Fase 1 relacionadas con la generación de señales offline y la evaluación de cables.

**Instrucciones:**
1. **APST Builder a WAV:** Modifica `tools/apst-builder/src/index.ts` para que genere los archivos a pedido del usuario mediante parámetros CLI que soporten múltiples valores separados por comas: secuencia de códigos (ej. `VANFP,VPN`), *sample rate* (`44100,48000`), opción de canal para subwoofer (`true,false`), y formatos de salida (`wav,flac`). El script debe iterar generando el producto cartesiano de las combinaciones ingresadas. Implementa y respeta estrictamente la siguiente nomenclatura estandarizada para el output: `apst_[secuencia]_[samplerate]k_[canal].[extension]` (ej: `apst_vanfp_48k_main.wav`, `apst_vpn_44k_sub.flac`).
2. **Segmento X (Crosstalk):** Añade la lógica fundamental para procesar un segmento `X` en el protocolo. Por ahora, simplemente calcula la atenuación del sangrado cruzado.
3. **Testeador de Cables:** Modifica `src/lib/dsp/apst/CableTester.ts` para extender la prueba de `V P` a `V P N X`. Implementa la función `calculateCableScore(attenuation, snr, thd)` que devuelve un valor normalizado de 1 a 10.
4. Finaliza documentando brevemente los cambios en los comentarios. No modifiques la UI por ahora.

---

## Prompt 2: Procesamiento Dual Híbrido y Modo Ciego

**Contexto:** Ahora que tenemos las señales listas, necesitamos hacer que el orquestador soporte el procesamiento dual (Fast-Path en tiempo real y Slow-Path offline) para evitar colgar la UI, e incluir un autómata de degradación por hardware (Modo Ciego).

**Instrucciones:**
1. **Orquestador Dual:** Modifica `src/lib/dsp/apst/Orchestrator.ts`. Cuando se ejecutan segmentos largos (F, T, S), el orquestador debe grabar en el `SharedArrayBuffer` (Slow-Path).
2. **Fast-Path:** Implementa la lógica para que, concurrentemente, se instancie un worker rápido que lea fragmentos del buffer (ej. 1024 bins), calcule el RMS y advierta de *Showstoppers* (clipping). Si detecta clipping sostenido, debe emitir un comando para abortar la secuencia (`abortSequence`).
3. **Modo Ciego:** Modifica `src/lib/utils/tierDetector.ts`. Agrega una función que evalúe el *Event Loop Lag* (latencia del hilo principal) durante los primeros 500ms de captura. Si la latencia supera un umbral seguro, emite un evento que el Orquestador escuchará para apagar el Fast-Path, asegurando la grabación del Slow-Path sin interrupciones.

---

## Prompt 3: Motor de Trazos y Estado Global (TraceManager)

**Contexto:** Vamos a preparar la arquitectura reactiva en Svelte 5 para separar las matemáticas de la UI.

**Instrucciones:**
1. **TraceManager:** Crea el archivo `src/lib/stores/traceManager.svelte.ts`. Define la interfaz `Trace` con los campos: `id`, `name`, `type` (live, snapshot, math), `metric`, `data` (Float32Array), `color`, `style`, `visible`, y `offsetY`.
2. Implementa los métodos reactivos `$state` básicos: `addTrace`, `removeTrace`, `toggleVisibility`, `setYOffset`, y `captureSnapshot`.
3. **Gestor de Snapshots:** Crea un componente Svelte `src/components/medicion/SnapshotPanel.svelte` que se suscriba al `traceManager`. Debe listar los trazos tipo `snapshot` con un botón "Ojito" para alterar su propiedad `visible`, un control de `offsetY`, y estar ordenado por `timestamp`.

---

## Prompt 4: Grid Multi-Cuadrante y Renderizador Canvas

**Contexto:** Pasamos a la interfaz visual propiamente dicha. Necesitamos reemplazar el viejo visualizador único por un sistema de cuadrantes estilo Smaart u Open Sound Meter.

**Instrucciones:**
1. **Grid System:** Crea `src/components/medicion/ViewGrid.svelte`. Usa CSS Grid para permitir layouts de `1x1` hasta `3x2`. En anchos menores a 768px, restringe a `2x1` máximo con *overflow* horizontal.
2. **Quadrant:** Renombra/refactoriza `TraceMath.svelte` a `src/components/medicion/Quadrant.svelte`. Cada cuadrante debe tener su propio selector interno (un modal) para definir qué `metric` renderiza (Fase, Magnitud, RTA, etc.).
3. **Filtros de Renderizado:** En el renderizado del Canvas del cuadrante, suscríbete al `traceManager` y filtra solo los trazos correspondientes a la métrica seleccionada. Antes de pintar, implementa *Smoothing* móvil (ej. 1/3, 1/48 de octava) y la lógica visual de *Coherence Blanking* (si un valor del array paralelo de coherencia es menor al umbral, opaca el color del trazo).
4. **Crosshair:** Añade una mirilla que siga al cursor devolviendo en una etiqueta los valores de X e Y.

---

## Prompt 5: Layout Global y Sidebar Tabulado (Secuencial/Manual)

**Contexto:** Como toque final de la Fase 2A, vamos a integrar la grilla y el estado global en el Layout definitivo (100vw/100vh) con el panel de control lateral.

**Instrucciones:**
1. **Layout 100vw:** Modifica la vista principal (`src/routes/+page.svelte` o similar) para que el contenedor use `w-screen h-screen overflow-hidden`.
2. **Sidebar:** Crea `src/components/medicion/Sidebar.svelte`. Divide este panel en dos pestañas grandes.
3. **Pestaña Secuencial:** Integra el `Orchestrator` mostrando la lista de pasos en vivo con sus checkmarks. Agrega dos botones de disparo principales: "Iniciar" (para ejecutar localmente) e "Iniciar fuera de línea" (que permite descargar la pista WAV estática correspondiente a la secuencia seleccionada).
4. **Pestaña Manual:** Integra botones para el generador de señales invocando el `HAL` (Ruido Rosa, Blanco, Barrido).
5. **Responsividad Móvil:** Haz que el Sidebar sea un *Bottom Sheet* colapsable en pantallas pequeñas y garantiza que los botones y las "tuerquitas" de los cuadrantes tengan áreas táctiles mínimas de 44x44px. Modifica la configuración de los cuadrantes y el gestor de Snapshots para que sean modales *fullscreen* absolutos en el móvil.
6. **Hotkeys:** Conecta un EventListener global para capturar la barra espaciadora (`Espacio`) que invoque `captureSnapshot()` en el `traceManager` para el cuadrante enfocado.

---

## Prompt 6: Refactorización UX (Layout y Panel lateral)

**Contexto:** Fase 2A.1. Limpieza radical de la UI en español. Prohibido usar `backdrop-filter: blur`. CSS puro, Grid/Flexbox y variables `$state`.

**Instrucciones:**
1. **Actualización del HAL (`types.ts` y `WebAudioProvider.ts`):**
   - Modifica `playGenerator(type: 'pink' | 'white' | 'sweep' | 'sine', active: boolean, freq: number, level: number, routing: 'L' | 'R' | 'Stereo')`.
   - Implementalo en `WebAudioProvider.ts`: Usa `StereoPannerNode` o `ChannelSplitterNode`. 'sine' usa un `OscillatorNode` fijo. 'sweep' debe usar `osc.frequency.exponentialRampToValueAtTime(20000, audioContext.currentTime + 5)`. 
2. **Cabecera global hiper-limpia (`Header.svelte`):**
   - Elimina el selector HAL, el SPL falso, el reloj y la etiqueta "Conectado".
   - Izquierda: Selector de micrófono (`navigator.mediaDevices.enumerateDevices`).
   - Centro: Selector de Layout (`<select>` con opciones: 1x1, 2x1, 2x2, 3x2).
   - Derecha: Botón Switch para tema (asegurando que haga `document.documentElement.classList.toggle('dark')`) y un botón para "Ocultar/Mostrar Instantáneas".
3. **Pestaña secuencial (`Sidebar.svelte`):**
   - Amplía el selector superior a secuencias reales: "Completa (VANFP)", "Verificación de ganancia (V)", "Respuesta (F)".
   - Traduce el estado del orquestador (ej. si es "IDLE", muestra "Estado: En espera").
   - En la lista de pasos, usa nombres explicativos: "V - Verificación", "A - Alineación", etc.
   - El **Split Button** debe tener un sub-botón a la derecha con el texto explícito "Descargar pista de prueba" (no solo una flecha inentendible).
4. **Pestaña manual (`Sidebar.svelte`):**
   - `<select>` para "Tipo de señal": Ruido rosa, Ruido blanco, Seno continuo, Barrido logarítmico.
   - El control de **Frecuencia** (slider + input numerico) DEBE ocultarse (con `#if`) si el tipo de señal es ruido rosa o blanco. Solo mostrar para seno o barrido.
   - Crea un input numérico para "Retardo (ms)", que pueda ser editado a mano o autocompletado por el sistema.
   - El botón gigante inferior debe decir "Calcular retardo".

---

## Prompt 7: Refactorización UX (Cuadrante e instantáneas)

**Contexto:** Fase 2A.1 (Continuación). Implementación interactiva del lienzo y ejes. Sin uso de blur.

**Instrucciones:**
1. **Lógica de Gestos y Ejes (`Quadrant.svelte`):**
   - Mantén las variables `scaleX`, `scaleY`, `offsetX`, `offsetY`.
   - Modifica `draw()` para invocar `ctx.fillText` al dibujar la grilla: escribe las frecuencias (Hz) en el borde inferior del canvas, y los niveles (dB) o Grados (°) en el borde derecho, usando color `#888`.
   - Implementa `onwheel` para pellizco/rueda (escalas) y `onmousemove` con `onmousedown` para paneo (offsets). Modifica las matemáticas de dibujo para que apliquen dichas escalas.
2. **Interfaz de Cuadrante (Popover compacto):**
   - El botón del engranaje `⚙️` debe abrir un panel flotante **compacto** posicionado absolutamente junto al botón (dropdown), NO un modal gigante en pantalla completa.
   - Mantiene opciones de métricas, suavizado (`1/3` a `1/48`), toggle de "Ocultamiento por coherencia" y botón de desenvolvimiento de fase.
3. **ViewGrid y Layout (`ViewGrid.svelte`):**
   - Conecta el selector de Layout del `Header.svelte` al `ViewGrid` mediante un estado global (puedes meter el layout en `traceManager` o usar un store derivado) para que cambie la grilla de CSS.
4. **Gestor de instantáneas (`SnapshotPanel.svelte`):**
   - Modifica el contenedor principal para obedecer al botón "Ocultar/Mostrar Instantáneas" del Header, colapsándose hacia la derecha con una transición.
   - Asegúrate de que el título diga "Instantáneas" y no haya ningún efecto `blur`. Añade un ícono `🖱️` o `⚙️` en la lista para diferenciar la fuente.

---

## Prompt 8: Conexión DSP y Motor de Medición (Wireup)

**Contexto:** Fase 2A.2. La UI está lista pero necesita matemáticas acústicas reales para dejar de ser un cascarón vacío.

**Instrucciones:**
1. **RTA Nativo en HAL (`WebAudioProvider.ts`):**
   - Instancia un `AnalyserNode` en `startCapture` conectado a la fuente del micrófono. `fftSize = 4096`, `smoothingTimeConstant = 0`.
   - Modifica `AudioListener` para aceptar `onFrequencyData?(data: Float32Array): void;`.
   - En el bucle de `requestAnimationFrame`, lee `analyser.getFloatFrequencyData` y envíalo al listener.
2. **Inyección Reactiva (`traceManager.svelte.ts`):**
   - Crea `updateLiveTrace(metric: string, data: Float32Array)`. Si existe el trazo `live-1`, muta o clona los datos del array para forzar el `$state` de Svelte 5 a repintar a 60fps.
3. **Cableado del Sidebar (`Sidebar.svelte`):**
   - Modifica `startLocal()` y la pestaña manual para que al invocar `startCapture`, le pasen el callback `onFrequencyData: (data) => traceManager.updateLiveTrace('Magnitud', data)`.
   - Asegúrate de que, si el contexto de audio estaba `suspended`, invoque `audioContext.resume()` al encender cualquier generador.
   - Matemáticas del retardo: El botón "Calcular retardo" debe (simulado por ahora si no hay loopback físico) ejecutar un log y poblar automáticamente el `<input>` de retardo manual creado en el Prompt 6.
