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
