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

## Prompt 6: Rediseño Arquitectónico UX/UI (Header y Configuración)

**Contexto:** Iniciamos la Fase 2A.3. El objetivo es una UI profesional y consolidada. Todo ícono debe ser un `Material Icon` (nada de emojis). No usar `backdrop-filter`.

**Instrucciones:**
1. **Actualización de Cabecera (`src/components/medicion/Header.svelte`):**
   - Elimina el selector HAL, el reloj, el estado y el SPL falso.
   - **Izquierda:** Texto estático `Herramienta para mediciones de audio`.
   - **Derecha:** Implementa Vúmetros (VU Meters) visuales. Usa barras horizontales apiladas en dos columnas (una columna "IN" y otra "OUT"), mostrando 1 barra por cada canal activo.
2. **Consolidación del Sidebar (`src/components/medicion/Sidebar.svelte`):**
   - Convierte el Sidebar en el panel maestro con 4 pestañas (orden exacto):
     1. Medición (ícono `graphic_eq`)
     2. Ecualización (ícono `equalizer`)
     3. Instantáneas (ícono `screenshot_frame_2`)
     4. Configuración (ícono `settings`)
3. **Pestaña Configuración:**
   - **Audio IN:** Selector de dispositivo. Checkboxes para canales. Selector de Canal de Referencia (con opción Loopback).
   - **Audio OUT:** Selector de dispositivo. Checkboxes para canales.
   - **Pantalla:** Un selector de grilla visual (estilo insertar tabla de Word) con opciones: 1x1, 1x2, 1x3, 2x1, 2x2, 2x3. Almacena esta selección en un estado global (ej. `traceManager.layout`).
   - **Tema:** Toggle para modo oscuro (`document.documentElement.classList.toggle('dark')`).
4. **Pestaña Instantáneas:**
   - Traslada todo el HTML/Lógica de `SnapshotPanel.svelte` aquí adentro, eliminando el componente externo.
   - Usa íconos para diferenciar origen (Manual o Secuencial).
5. **ViewGrid (`src/components/medicion/ViewGrid.svelte`):**
   - Elimina la cabecera `q1`, `q2`. 
   - Modifica el CSS Grid para que reaccione directamente al layout elegido en la pestaña de Configuración.

---

## Prompt 7: Sidebar (Medición y Ecualización)

**Contexto:** Fase 2A.3 (Continuación). Reestructuración de la operación de medición y la nueva pestaña de ecualización.

**Instrucciones:**
1. **Pestaña Medición (`Sidebar.svelte`):**
   - Incluye un selector moderno (segmented control) en la parte superior para alternar entre "Secuencial" (`lists`) y "Manual" (`hearing`).
2. **Modo Secuencial:**
   - Selector moderno: En vivo / Offline.
   - **En vivo:** Muestra botón "Iniciar medición".
   - **Offline:** Muestra botón "Escuchar" y, debajo, una tabla de descargas filtrable (Formato, Tipo Normal/Sub, SampleRate).
   - **Secuencias APST:** Muestra una lista de todos los segmentos (V, A, M, N, F, P, T, D, X, R) con Tooltips de información (ícono `info`).
   - Usa una lógica donde seleccionar segmentos a mano activa automáticamente el Preset que los contenga en el dropdown superior.
3. **Modo Manual:**
   - **Generadores:** Selector con Ruido rosa, Ruido blanco, Brown, music-noise, Seno continuo, Sweep logarítmico puro, burst, SinBurst, MLS+.
   - **Opciones por generador:** Exponer inputs calcados de OSM (Frecuencia, Ciclos, Periodo, etc., ocultando dinámicamente según la señal elegida).
   - **Controles:** Botón "Generador" y Botón "Escuchar". Input numérico de "Retardo (ms)" manual y botón "Calcular retardo".
4. **Pestaña Ecualización:**
   - Dropdown de tipo de Ecualizador (Gráfico, Paramétrico).
   - **Playground Interactivo:** Sliders/Inputs para Ganancia, Frecuencia y Q de cada banda.
   - **Botón "Calcular ecualización":** Imprime un log y autocompleta el playground con valores ficticios para probar reactividad.
   - (El dibujo de las curvas se conectará en el siguiente paso).

---

## Prompt 8: Motor DSP y Corrección de Lienzo

**Contexto:** Fase 2A.3. Matemáticas acústicas puras y corrección del escalado de Canvas.

**Instrucciones:**
1. **Arreglo del Lienzo (`src/components/medicion/Quadrant.svelte`):**
   - **Pixelación:** Elimina variables `$state` para el CSS `transform: scale()`. Para garantizar nitidez máxima (crisp), vincula la resolución interna del canvas al pixelaje real usando `devicePixelRatio`. Ajusta la lógica de dibujo a este nuevo factor de escala interna.
   - **Z-Index Configuración:** Mueve el dropdown del menú de configuración (`⚙️`) fuera del div del lienzo, usando `fixed` o la etiqueta `<svelte:window>` para que no se recorte por culpa del `overflow: hidden`.
2. **WebAudioProvider y Generadores Puros (`src/lib/hal/web/WebAudioProvider.ts`):**
   - Refactoriza `playGenerator` para soportar las nuevas señales OSM (MLS+, burst, etc.).
   - **Sweep Crítico:** No uses `OscillatorNode`. Implementa el barrido inyectando en un `AudioBuffer` la fórmula matemática pura del `apst-builder` para permitir arrancar en frecuencias sub-20Hz garantizando alineación de fase.
   - Agrega un `AnalyserNode` en el proceso de captura y envía los datos crudos a un `onFrequencyData` (Fast-Path en tiempo real).
3. **Inyección Reactiva (`src/lib/stores/traceManager.svelte.ts`):**
   - Implementa `updateLiveTrace(metric, data)`. Enlázalo con la salida del `AnalyserNode`.
   - Modifica el `draw` del Quadrant para mostrar:
     1. La medición en vivo.
     2. (Si estamos en Ecualización) la curva del filtro actual del Playground.
     3. La curva predictiva (Medición + Filtro sumados matemáticamente).
