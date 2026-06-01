# Guía de Prompts de Implementación: Fase 2A.4 Mejoras de Performance y Paridad (Español)

Este documento contiene una secuencia de prompts diseñados para un agente de IA con contexto reducido. Cada prompt guía al agente paso a paso a través de la implementación de las mejoras y optimizaciones descritas en el plan maestro de la Fase 2A.4 (`docs/Planes/implementation_plan_phase2a.4.md`), asegurando el cumplimiento estricto del HAL y el roadmap (`docs/Definicion/roadmap.md`).

---

## Instrucciones de Uso para el Agente Principal
1. Consuma y ejecute **exactamente un prompt a la vez**.
2. **No salte pasos** ni intente realizar tareas fuera del ámbito del prompt actual.
3. Al finalizar cada paso, realice la verificación automatizada o manual correspondiente y espere confirmación o guarde el estado antes de proceder.
4. Recuerde que el proyecto es dual-target (PWA/Web + Tauri) y debe respetarse siempre la capa de abstracción de hardware (HAL) definida en `src/lib/hal/`.

---

## Prompts de Implementación

### Prompt 1: Refactorización Arquitectónica de Quadrant (Paso Obligatorio)

**Objetivo:** Reducir la complejidad y el tamaño del componente monolítico `Quadrant.svelte` (94KB) mediante la extracción de la lógica de renderizado en Canvas, de interacción de usuario (zoom/pan) y de interpolación temporal de curvas.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componente 4).
- No agregue lógica de performance todavía; solo extraiga y reorganice el código existente.
- Mantenga la reactividad de Svelte 5 (`$state`, `$derived`, etc.) intacta.

**Instrucciones de Implementación:**
1. Cree los siguientes módulos TypeScript puros en `src/lib/dsp/`:
   - `canvasRenderers.ts`: Extraiga todas las funciones de dibujo del Canvas de `Quadrant.svelte` (como `drawGrid`, `drawAxes`, `drawCrosshair`, `drawLevelOverlay`, `drawNumericOverlay`, etc.). Reciba el contexto de Canvas 2D (`CanvasRenderingContext2D`) y las configuraciones/datos necesarios como parámetros explícitos.
   - `interpolationEngine.ts`: Extraiga el pipeline de interpolación temporal de curvas (smoothing/interps).
   - `canvasInteraction.ts`: Extraiga los gestores de eventos de ratón, teclado y táctiles (zoom, pan, touch) para el control espacial de las coordenadas del canvas.
2. Modifique `src/components/medicion/Quadrant.svelte`:
   - Importe y use las funciones de `canvasRenderers.ts`, `interpolationEngine.ts` y `canvasInteraction.ts`.
   - Reduzca el archivo `Quadrant.svelte` a una estructura limpia de alrededor de 300-500 líneas actuando como orquestador delgado.
   - Asegure que no se importen APIs de Web Audio directamente en estos archivos.

**Límite Estricto:**
- No modifique ningún otro componente, tienda (`store`) ni lógica matemática en esta fase. No avance a optimizaciones de rendimiento ni a otras características.

**Plan de Validación:**
- Ejecute la aplicación en modo desarrollo.
- Confirme que todos los cuadrantes se sigan dibujando exactamente igual que antes (grilla, ejes, crosshairs, curvas de RTA).
- Verifique que la interacción por gestos (zoom, pan) en el canvas funcione de forma fluida y sin errores de consola.

---

### Prompt 2: Resiliencia de SharedArrayBuffer y Fallback del HAL

**Objetivo:** Habilitar el aislamiento cruzado (cross-origin isolation) en hostings estáticos (como GitHub Pages) mediante un Service Worker y proveer un fallback resiliente para la captura de audio si `SharedArrayBuffer` no es compatible con el navegador.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componente 12).
- Asegure la resiliencia en plataformas web donde COOP/COEP no puedan configurarse a nivel de servidor.

**Instrucciones de Implementación:**
1. Cree el archivo `static/coi-serviceworker.js` (u obtenga la biblioteca estándar `coi-serviceworker` que intercepta peticiones para inyectar cabeceras COOP `cross-origin-opener-policy: same-origin` y COEP `cross-origin-embedder-policy: require-corp`).
2. Modifique `src/app.html` (o el archivo de entrada correspondiente) para enlazar e inicializar el script `coi-serviceworker.js` al inicio de la carga del documento.
3. Modifique `src/lib/hal/web/WebAudioProvider.ts` y `src/lib/hal/tauri/TauriAudioProvider.ts` (según corresponda):
   - Al iniciar la captura (`startCapture`), evalúe si `typeof SharedArrayBuffer === "undefined"`.
   - Si `SharedArrayBuffer` está definido, use la memoria compartida cero-copia para transferir buffers del analizador al hilo de cálculo.
   - Si no está definido (fallback): registre un mensaje de advertencia (`[AudioProvider] SharedArrayBuffer no disponible. Usando fallback ArrayBuffer.`) y use un `ArrayBuffer` convencional transfiriendo los datos mediante `postMessage` estándar o por copia síncrona simple si se ejecuta en el mismo hilo.
   - Asegúrese de liberar y reasignar de manera correcta el array buffer en cada frame para evitar fugas de memoria.

**Límite Estricto:**
- No comience a diseñar el Web Worker ni modifique el pipeline dsp matemático. No edite `Quadrant.svelte` ni las tiendas de Svelte.

**Plan de Validación:**
- Fuerza la desactivación temporal de SharedArrayBuffer en tu navegador de pruebas (o simúlalo asignando `globalThis.SharedArrayBuffer = undefined` en desarrollo).
- Comprueba que el flujo de audio en vivo sigue funcionando sin interrupciones y que la advertencia de fallback se imprime en la consola de depuración de manera correcta.

---

### Prompt 3: Pipeline del DSP Worker y Desacoplamiento del Orchestrator

**Objetivo:** Mover los cálculos intensivos de la FFT y métricas acústicas fuera del hilo principal del navegador utilizando un Web Worker dedicado, y desacoplar la ejecución matemática de los frames de renderizado de la UI.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componente 1).
- La UI no debe gatillar el cálculo del DSP; el motor de cálculo debe ser autónomo y alimentado de forma externa.

**Instrucciones de Implementación:**
1. Cree el archivo `src/lib/dsp/dspWorker.ts` (Worker de Web):
   - Debe recibir buffers de entrada de audio a través de `SharedArrayBuffer` (o mediante el fallback `postMessage` de `ArrayBuffer` definido en el paso anterior).
   - Ejecute las funciones matemáticas del espectro en vivo, RTA y de la función de transferencia de manera asíncrona dentro del Worker.
   - Devuelva los resultados de salida calculados al hilo principal.
2. Modifique `src/lib/stores/mathOrchestrator.svelte.ts`:
   - Elimine la invocación de `mathOrchestrator.run()` dentro del ciclo `draw()` de los Quadrants (en el frame de renderizado).
   - Implemente un temporizador autónomo (`setInterval` o similar) gobernado por el estado `dspUpdateRate` (frecuencia de actualización en Hz).
   - Optimice la función `checkDirty()`: elimine la llamada costosa a `JSON.stringify(traceManager.eqBands)`. Reemplácela por un hash aritmético rápido (reduciendo las propiedades numéricas `freq`, `gain` y `q` de las bandas) o un versionador numérico (`eqBandsVersion`) que se incremente de forma manual ante cambios.
   - Optimice `globalActiveMetrics`: elimine la creación recurrente de `new Set()` en el getter. Conviértalo en una propiedad reactiva `$derived` o cacheada que solo se actualice cuando cambie la lista de métricas activas por cuadrante.

**Límite Estricto:**
- No intente optimizar la asignación de memoria (allocations) en las clases de dsp internas (FFT, TransferFunction, etc.) ni modifique el Canvas de `Quadrant.svelte` en este paso.

**Plan de Validación:**
- Verifique que la consola no arroje errores de inicialización del Worker.
- Compruebe que la frecuencia de cálculo se ajuste al modificar el `dspUpdateRate`.
- Asegure que los layouts multi-cuadrante no disparen cálculos redundantes por frame en el main thread.

---

### Prompt 4: Zero-Allocation DSP (Optimización de Memoria)

**Objetivo:** Eliminar la presión sobre el recolector de basura (GC pauses) eliminando la instanciación de arrays (`new Float32Array`) en loops críticos y hot paths matemáticos de audio.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componente 2).
- Todas las funciones matemáticas críticas en hot loops deben recibir buffers de salida pre-asignados como parámetros (`out` params).

**Instrucciones de Implementación:**
1. Modifique `src/lib/dsp/fft.ts`:
   - Refactorícelo como un wrapper / fallback de `WebFFT` (`IQEngine/WebFFT`). Intente importar de forma dinámica `WebFFT`. Si está disponible, delegue los cálculos; si no, use la implementación Radix-2 local.
   - Cambie la API de `fft()` e `ifft()` para que acepten un buffer de salida pre-alocado de tipo `Float32Array` suministrado por el llamador.
   - Pre-calcule las ventanas (Hanning, Blackman-Harris, etc.) en Lookup Tables (LUTs) de tipo `Float32Array` una sola vez para los tamaños de FFT soportados. Multiplique directamente en `applyWindow()` usando estas LUTs (`data[n] *= windowLUT[n]`), eliminando llamadas a `Math.cos()`.
   - Modifique la función `magnitude()` para que escriba directamente en un buffer del caller.
2. Modifique `src/lib/dsp/math.ts`:
   - Elimine todos los retornos de tuplas `[number, number]` de `ComplexMath` (ej. `mul`, `mulConjugate`, `div`).
   - Implemente variantes que escriban en un array de salida pre-asignado o inlee las operaciones matemáticas complejas directamente en los bucles de cálculo que las requieran.
3. Modifique `src/lib/dsp/TransferFunction.ts`:
   - Modifique `calculateH()` y `calculateCoherence()` para que escriban sus resultados directamente en arrays pasados por parámetro en vez de instanciar nuevos buffers bin.
   - Inlee internamente las operaciones complejas de multiplicación conjugada eliminando llamadas estáticas del gestor de complejos.
4. Modifique `src/lib/dsp/osmMetrics.ts`:
   - Reemplace el uso de `push()` y `shift()` de arrays en `SpectrogramQueue` por una estructura de **buffer circular (Ring Buffer)** de tamaño fijo con un puntero de escritura giratorio.
   - Pre-asigne un pool fijo de `Float32Array` para evitar instanciar memoria en cada inserción del espectrograma.

**Límite Estricto:**
- No modifique componentes visuales ni lógicas de UI. Mantenga los cambios puramente en el ámbito matemático y dsp.

**Plan de Validación:**
- Ejecute un perfil de rendimiento en Google Chrome DevTools (pestaña Performance).
- Grabe una sesión de 10 segundos con el audio encendido y visualizadores activos.
- Confirme que el gráfico de línea de asignaciones de memoria (GC Activity / JS Heap) muestre una línea plana y estable, con ausencia de oscilaciones de sierra (aserradas) y pausas de recolección de basura.

---

### Prompt 5: Optimizaciones de Renderizado de UI

**Objetivo:** Mejorar la tasa de refresco a 60 FPS estables reduciendo operaciones redundantes del Canvas y re-renderizados innecesarios del Svelte Compiler.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componente 3).
- Evite calcular o iterar datos pesados dentro del bucle de animación nativo de la UI.

**Instrucciones de Implementación:**
1. Modifique `src/components/medicion/Quadrant.svelte`:
   - Confirme que `mathOrchestrator.run()` esté completamente removido del loop `draw()` del canvas.
   - Elimine el derived duplicado `eqResponseCache` en el Quadrant. Consuma única y exclusivamente el cache precalculado en `mathOrchestrator` o un derived centralizado en la tienda global para evitar cómputos de filtros duplicados en layouts multicuadrante.
   - Optimice `drawSpectrogram()`: reemplace el renderizado píxel a píxel mediante `fillRect(x, y, 1, 1)` (que satura la CPU). En su lugar, use `ImageData` y `putImageData()`, escribiendo los colores RGBA de forma directa en un `Uint8ClampedArray` pre-asignado y dibujando la fila completa con una sola llamada a la API de Canvas.
   - Optimice el cálculo de suavizado PPO (`getPPOSmoothedValue`): en lugar de computar logaritmos y sumas para cada píxel en el bucle de dibujo de la pantalla, pre-calcule el array suavizado completo una sola vez por frame (cuando se emiten nuevos datos desde el orchestrator) y léalo directamente en el dibujo.
2. Modifique `src/lib/stores/meterStore.svelte.ts`:
   - Modifique los métodos de actualización del medidor de volumen (`updateIn`, `updateOut`) para utilizar un estado reactivo crudo (`$state.raw()`) o aplique un estrangulador de actualización (throttle) en lugar de reinstanciar arrays reactivos en cada frame, reduciendo el churn reactivo sobre el Header.

**Límite Estricto:**
- No implemente todavía el sistema de múltiples capas estilizadas ni edite lógicas de instantáneas o archivos locales.

**Plan de Validación:**
- Abra múltiples cuadrantes en un layout (por ejemplo, grilla 2x2).
- Verifique que el espectrograma rinda fluidamente y compruebe con `performance.now()` que la llamada a `draw()` del Canvas tarde menos de 2 milisegundos en completarse en promedio.

---

### Prompt 6: Sistema de Capas de Medición Avanzado

**Objetivo:** Desacoplar las capas de medición en vivo de las instancias de los cuadrantes y proveer soporte para múltiples capas estilizadas, movilidad espacial y asignación reactiva de fuentes en vivo o congeladas.

**Contexto e Instrucciones de Diseño:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componentes 10 y 11 - Nota de Consolidación).
- Asegure un diseño unificado para evitar conflictos futuros: `MeasurementLayer.data` es plano para la métrica activa, mientras que la instantánea asociada mantiene los buffers de todas las métricas en paralelo.

**Instrucciones de Implementación:**
1. Modifique `src/lib/stores/ui.svelte.ts`:
   - Añada los estados reactivos globales: `autoSaveSnapshotOnStop = $state(false)`, `linkGeneratorToMeasurement = $state(false)`, y `activeLayerId = $state('')` (para denotar qué capa se encuentra bajo medición activa en vivo).
2. Modifique `src/lib/stores/traceManager.svelte.ts`:
   - Elimine variables de capas locales a nivel de cuadrante. Almacene las capas de medición en un array global reactivo de trazos/capas: `layers = $state<MeasurementLayer[]>([])`.
   - Cada objeto capa debe estructurarse con campos como: `id`, `name`, `visible` (estado de visibilidad individual), `isMeasuring` (conmutador en vivo), `quadrantId` (asociación espacial al cuadrante actual), `sourceType` (`'live' | 'snapshot' | 'calculated'`), y `data` (`Float32Array` para el buffer de magnitud/fase activo).
   - Desarrolle métodos CRUD reactivos en el traceManager para agregar, renombrar, duplicar, eliminar y mover de forma global las capas.
3. Modifique `src/lib/stores/mathOrchestrator.svelte.ts`:
   - Ajuste el método `run()` para escribir los resultados calculados exclusivamente sobre la capa que posea `isMeasuring === true`. Al pulsar detener, conserve los datos de forma síncrona en el buffer.
   - Sincronice el Auto EQ con el estado `eqType` de `uiStore`. El cálculo de filtros se ajustará de forma adaptativa según sea gráfico, paramétrico o de tono.
4. Modifique `src/components/medicion/Quadrant.svelte`:
   - Rediseñe el bucle de dibujo de curvas: itere y pinte sobre todas las capas asignadas a su `quadrantId` que tengan `visible === true`.
   - Implemente codificación visual avanzada:
     - **Color reservado para la Métrica:** Magnitud es siempre Rojo, Fase es siempre Magenta, Coherencia es Amarillo.
     - **Estilo de línea reservado para la Capa:** La capa activa se destaca en línea sólida de grosor grueso (`2.5px - 3px`) y 100% de opacidad. Las capas secundarias de fondo (frozen) se pintan con patrones de trazos específicos: Capa 2 es Discontinua (`lineDash: [8, 4]`), Capa 3 es Punteada (`lineDash: [2, 3]`), etc., en grosor delgado (`1.2px - 1.5px`) y opacidad atenuada al 75%.
   - Implemente Drag & Drop (`ondragstart`, `ondragover`, `ondrop`) sobre los Pills de cabecera de las capas para arrastrarlas y soltarlas entre cuadrantes visualmente, actualizando su propiedad `quadrantId` al instante.
   - Alterne la fuente (`sourceType: 'live' | 'snapshot'`). Si es snapshot, cargue la instantánea en la capa copiando su buffer estático de manera directa.

**Límite Estricto:**
- No comience la persistencia persistente IndexedDB ni la carga/guardado de archivos `.snapshot.json` en este paso.

**Plan de Validación:**
- Añada 3 capas en un cuadrante. Congele la primera, mida en la segunda y cambie el origen de la tercera a un snapshot estático de prueba.
- Compruebe que los estilos de trazo (sólido, dashed, punteado) cambien adecuadamente según la capa y que se diferencien de manera correcta de los colores específicos de la métrica activa.

---

### Prompt 7: Simulación EQ Biquad (RBJ), Controles Paramétricos y Calibración Global

**Objetivo:** Reemplazar las aproximaciones simplificadas de EQ por un motor biquad preciso de Robert Bristow-Johnson, añadir controles sliders logarítmicos e implementar ganancia, offset y carga dinámica de canales basada en hardware en el panel lateral y backend Rust de Tauri.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (F30, F31, Componente 8, 8b y Fragmento A).
- Respete el modelo dual-target (PWA/Web + Tauri) implementando fallbacks de canales para el navegador.

**Instrucciones de Implementación:**
1. Cree el módulo de cálculo de biquads estándar en `src/lib/dsp/biquad.ts`:
   - Implemente las funciones para generar coeficientes de filtros `peakingCoeffs`, `lowShelfCoeffs`, `highShelfCoeffs`, etc., según el estándar RBJ.
   - Implemente la función `biquadResponse` y la optimizada de zero-allocation `fillBiquadResponseCache` detallada en el Fragmento A del plan.
2. Modifique `src/lib/stores/calibrationStore.svelte.ts`:
   - Modifique `calculateFilterGainAt` y los caches de ecualización para evaluar analíticamente en magnitud y fase compleja la suma de todos los biquads activos en cascada, eliminando cálculos gaussianos.
   - Implemente un cargador de archivos de calibración: lea y parsee archivos `.cal` o `.txt` con pares `Frecuencia \t Ganancia` e interpole de forma logarítmica para compensar las curvas FFT en caliente.
3. Modifique `src/lib/stores/mathOrchestrator.svelte.ts`:
   - Integre el cálculo de biquads en `updateEQCache()` y `getPhaseValueRadians()`.
   - Aplique la ganancia, calibración acústica interpolada y offset absoluto en el pipeline del espectro tras obtener la lectura cruda.
4. Modifique el backend de Tauri y HAL de canales:
   - Modifique `src-tauri/src/lib.rs` para añadir el campo `channels: u16` a la estructura `AudioDevice`. Obtenga la cantidad de canales de entrada/salida reales llamando a CPAL (`supported_input_configs` y `supported_output_configs`).
   - Modifique `src/lib/hal/types.ts` y las clases `TauriAudioProvider.ts` y `WebAudioProvider.ts` para capturar y propagar este campo de canales reales, con fallback estricto a 2 canales en la versión web.
5. Modifique `src/components/medicion/Sidebar.svelte`:
   - Rediseñe la interfaz de los ecualizadores paramétricos agregando: Sliders horizontales de precisión (con mapeo logarítmico para frecuencia - ver Fragmento D), entradas numéricas asociadas y evento `ondblclick` sobre los sliders para reiniciar de inmediato el parámetro a su valor neutro por defecto.
   - Integre la visualización e inputs en la pestaña de configuración global del panel lateral para la carga de curvas de calibración (.cal), slider de ganancia de entrada (-20dB a +20dB) y offset de visualización en dB (-100dB a +100dB).
   - Renderice de forma dinámica la selección de canales basada en la interfaz cargada en vez del bucle duro `[0,1,2,3]`.
6. Modifique `src/components/medicion/Header.svelte` para ajustar y dibujar dinámicamente el número exacto de vúmetros de salida/entrada conforme a los canales del hardware.

**Límite Estricto:**
- No modifique las lógicas de guardado de instantáneas en IndexedDB en este punto.

**Plan de Validación:**
- Suba un archivo de calibración con un realce de +6dB a 1000Hz y observe el cambio correspondiente en la visualización RTA en vivo.
- Use el ecualizador paramétrico y verifique que la fase simulada sufra la distorsión analítica real y esperada de un filtro de fase mínima, y que el doble clic restaure los sliders instantáneamente.

---

### Prompt 8: Gestión de Instantáneas Multimétricas Avanzadas con IndexedDB

**Objetivo:** Implementar persistencia estructurada y de alta capacidad mediante IndexedDB para guardar instantáneas consolidadas con múltiples buffers de datos FFT en paralelo, además de añadir capacidades de exportación e importación de archivos `.snapshot.json`.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componente 11, F32 y Fragmento B).
- Renombre todas las referencias visuales y de código de "Capturas" / "Snapshots" a **Instantáneas** en español.

**Instrucciones de Implementación:**
1. Cree el archivo de utilidad `src/lib/utils/db.ts` utilizando la API de IndexedDB nativa (ver Fragmento B):
   - Inicialice la base de datos `asistente_db` en la versión 1 y la tabla de almacenamiento (Object Store) `instantaneas`.
   - Provea las funciones síncronas/asíncronas CRUD: `saveInstantanea(item)`, `loadAllInstantaneas()` y `deleteInstantanea(id)`.
2. Modifique `src/lib/stores/traceManager.svelte.ts`:
   - Reestructure el tipo de datos para soportar la instantánea multimétrica `Instantanea`, la cual mantiene un objeto `data` mapeado con múltiples Float32Arrays opcionales (`Magnitude`, `Phase`, `Coherence`, `Impulse`, `GroupDelay`, etc.).
   - Modifique la inicialización del store para cargar de manera asíncrona todas las instantáneas guardadas en IndexedDB al arrancar la aplicación.
   - Implemente la exportación a archivos locales: serialice y descargue la instantánea como un JSON formateado legible con extensión `.snapshot.json`. Convierta los Float32Arrays a números convencionales (`Array.from(buf)` o similar) para la serialización.
   - Implemente la importación: añada un cargador que lea archivos `.snapshot.json`, valide la estructura, reconstruya los Float32Arrays binarios y guarde e inyecte reactivamente el elemento en el traceManager y en IndexedDB.
3. Modifique `src/components/medicion/Quadrant.svelte` para extraer de manera transparente la métrica que demanda el cuadrante a partir de los datos multimétricos de la instantánea activa (`instantanea.data[activeMetric]`), asegurando el soporte estético completo de visibilidad de curvas.
4. Modifique `src/components/medicion/Sidebar.svelte`:
   - Renombre todas las leyendas y botones a "Instantáneas".
   - Añada un botón de configuración de capturas que despliegue un panel con checkboxes interactivos para definir qué métricas capturar en paralelo (`[x] Magnitud`, `[x] Fase`, `[ ] Coherencia`, etc.).
   - Añada controles visuales en el historial para descargar y cargar archivos `.snapshot.json`.

**Límite Estricto:**
- No intente implementar algoritmos DSP complejos de weighting, averaging o deconvolution en este paso.

**Plan de Validación:**
- Tome una instantánea marcando Magnitud y Fase en la configuración.
- Borre la pestaña o recargue el navegador y verifique que la instantánea siga existiendo en la lista.
- Descargue el archivo `.snapshot.json`, elimínelo de la app, vuelva a cargarlo mediante el importador y compruebe que se dibuje de forma perfecta en las curvas correspondientes.

---

### Prompt 9: Algoritmos DSP de Paridad con OSM

**Objetivo:** Implementar los algoritmos matemáticos profesionales faltantes respecto a la suite Open Sound Meter: ponderación de frecuencia, averaging complejo multimodular, deconvolución en tiempo real, funciones de ventana avanzadas con corrección, source windowing, Leq y curvas isofónicas.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componente 5, F1 a F7).
- Respete el patrón zero-allocation de buffers pre-asignados y garantice la modularidad de cada clase matemática.

**Instrucciones de Implementación:**
1. Cree los siguientes archivos de procesamiento en `src/lib/dsp/`:
   - `weighting.ts`: Implemente filtros biquad en cascada para curvas A, B, C y Z según ANSI 1.43-1997. Exponga coeficientes calibrados para la frecuencia de muestreo del hardware.
   - `averaging.ts`: Implemente la clase `ComplexAveraging` con soporte para:
     - *Off:* Sin filtrado.
     - *LPF:* Filtro de paso bajo Bessel estable de 5to orden calculado de forma secuencial por bin para suavizar fase y amplitud de manera coherente.
     - *FIFO:* Ring buffer circular complejo de profundidad ajustable (1-64 frames) para realizar promedios matemáticos de vectores complejos en tiempo real.
   - `deconvolution.ts`: Algoritmo de deconvolución compleja en el dominio de frecuencia: `IR = IFFT(FFT(salida) / FFT(entrada))`.
   - `windowFunction.ts`: Implemente 7 ventanas: Rectangular, Hann, Hamming, FlatTop, BlackmanHarris, HFT223D y Exponential. Incluya factores de corrección de ganancia de amplitud (`gain`) y energía (`norm`).
   - `sourceWindowing.ts`: Algoritmo para recortar la IR en el dominio de tiempo o frecuencia mediante un ancho de ventana y un offset deslizables, silenciando rebotes y reflexiones secundarias.
   - `leq.ts`: Árbol de integración temporal para computar nivel de presión sonoro equivalente continuo (Leq) en ventanas configurables de 1s a 10 min.
   - `equalLoudness.ts`: Tabulador del estándar ISO 226:2003 para renderizar curvas de contorno de igual volumen (fones) sobre el gráfico de magnitud RTA.
2. Modifique `src/lib/stores/mathOrchestrator.svelte.ts` para integrar estos algoritmos en el pipeline del método `run()` (aplicando el weighting elegido antes de SPL, el selector de averaging y las funciones de ventana en las transformadas).

**Límite Estricto:**
- No modifique las vistas visuales del Quadrant para renderizar nuevos charts todavía. Limítese a implementar y acoplar los motores matemáticos en el backend de cálculo.

**Plan de Validación:**
- Ejecute pruebas unitarias de los filtros de ponderación y verifique que dBA atenúe de forma drástica las frecuencias por debajo de 100Hz respecto a dBZ (lineal) conforme a la curva teórica ANSI.

---

### Prompt 10: Gráficos de Paridad, Paletas y Pipeline de Medición

**Objetivo:** Integrar y renderizar los nuevos gráficos de análisis (Scope, Crest Factor, Nyquist Plot, Phase Delay), las paletas de color para el espectrograma, el Target Trace (curva objetivo) y operaciones matemáticas entre trazos.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componente 6, Componente 7, F8, F9, F10, F11, F12 y F13).

**Instrucciones de Implementación:**
1. Cree y configure los siguientes archivos:
   - `src/lib/dsp/colorPalettes.ts`: Genere arrays de consulta (LUTs) de 256 entradas RGB correspondientes a las paletas de color clásicas: Jet, Magma, Viridis, Hot y escala de grises.
   - `src/lib/stores/targetTrace.svelte.ts`: Desarrolle el store para la curva objetivo. Permita editar puntos (frecuencia/ganancia), aplicar offsets, colores e incluya presets comunes como plana, curvas de cine (X-Curve) o curvas residenciales (House Curve).
   - `src/lib/dsp/mathSource.ts`: Implemente operaciones matemáticas entre mediciones y capas (suma, resta para diferencias, promedio de potencia, promedio vectorial, mín, máx e inversión de trazo).
2. Modifique `src/components/medicion/Quadrant.svelte` para añadir los métodos de dibujado e integración en canvas de:
   - *Scope:* Osciloscopio que dibuje directamente la forma de onda temporal.
   - *Crest Factor:* Gráfico de densidad espectral del factor de cresta (pico/RMS) por bin.
   - *Nyquist:* Gráfico polar bidimensional trazando `Re(H(f))` en X vs `Im(H(f))` en Y.
   - *Phase Delay:* Retardo de fase calculado a partir de la fase continua desenvuelta.
   - *Target Trace:* Dibuje la curva objetivo como un overlay suavizado con opacidad.
   - *Selector de paleta:* Integre la selección de color de `colorPalettes.ts` para el dibujo del espectrograma con `ImageData`.
3. Modifique `src/lib/hal/web/WebAudioProvider.ts` para agregar soporte al generador de audio para cargar y reproducir archivos locales `.wav` de estímulo (WAV Playback) decodificándolos a través del AudioContext.

**Límite Estricto:**
- No altere la ergonomía ni los gestos o animaciones de colapso de la pantalla en este paso.

**Plan de Validación:**
- Abra la vista de un Quadrant y seleccione la métrica de Nyquist.
- Asegúrese de que dibuje el gráfico polar correspondiente en tiempo real de forma armónica y que las paletas del espectrograma (ej. Magma u Hot) se refresquen adecuadamente en pantalla sin fugas ni lags de CPU.

---

### Prompt 11: Ergonomía, Animaciones, Zoom Diferenciado y Micro-Interacciones Premium

**Objetivo:** Completar la experiencia premium del suite acústico implementando gestos ergonómicos refinados, transiciones de ancho fluidas, zoom diferenciado por eje, personalización de curvas y herramientas avanzadas de aislamiento visual.

**Contexto y Reglas:**
- Consulte `docs/Planes/implementation_plan_phase2a.4.md` (Componente 9, F20 a F25, F29).
- Asegure un diseño visual extremadamente limpio, de alta legibilidad técnica en temas claro/oscuro de alto contraste.

**Instrucciones de Implementación:**
1. Modifique `src/components/medicion/Sidebar.svelte`:
   - Reubique de forma ergonómica el selector de pestañas (Tabs) moviéndolo del sector inferior al tope superior del panel lateral, utilizando un diseño Flex minimalista con iconos de Material Icons de alta definición.
2. Modifique `src/components/medicion/Header.svelte`:
   - Añada un botón interactivo premium para colapsar y expandir el panel de control conmutando la variable reactiva global `uiStore.showSidebar`.
3. Modifique `src/routes/+page.svelte` (o contenedor general):
   - Estilice la visualización del panel lateral para que responda a `showSidebar` mediante una transición CSS sumamente suave sobre el ancho (`transition-all duration-300 ease-in-out`), aplicando `w-0` y `overflow-hidden` cuando esté oculto para otorgar el 100% de la pantalla a los cuadrantes gráficos.
4. Modifique `src/components/medicion/Quadrant.svelte`:
   - **Zoom Diferenciado X/Y:**
     - Modifique el evento de rueda (`wheel` handler): Scroll simple aplica zoom logarítmico horizontal (Eje X) sobre frecuencias/tiempo; combinando con la tecla `Alt` (Alt + Scroll) se aplica zoom vertical (Eje Y) sobre amplitud en dB o fase. Doble clic restaura el zoom a escala 1.0.
     - Añada una botonera flotante minimalista en la esquina superior `[XY]`, `[X]`, `[Y]` para control de zoom táctil directo sin teclado.
   - **Cursor Dinámico:**
     - Al estar en modo navegación de arrastre, aplique de forma reactiva la propiedad CSS `cursor: grab` sobre el canvas, conmutando a `cursor: grabbing` síncronamente al presionar y arrastrar (`isDragging = true`).
   - **Editor de Estilos de Curva:**
     - Expanda el popover de métrica del cuadrante para permitir seleccionar interactivamente un color (niveleta color nativa), grosor de línea (slider de 1px a 5px) y estilo de trazo (sólido, discontinuo, punteado). Actualice `metricStyles` reactivamente.
   - **Ergonomía Visual Avanzada:**
     - *Hover Focus:* Al pasar el cursor sobre la insignia de una métrica activa en la cabecera del cuadrante, atenúe al 15% de opacidad las curvas de todas las demás métricas de pantalla.
     - *Coherence Masking:* Desvanezca de forma degradada e incremental las líneas de Magnitud y Fase en las frecuencias donde el valor de Coherencia caiga por debajo de 0.5, limpiando de inmediato curvas inestables de ruido acústico.
     - *Solo Mode:* Al hacer clic en una curva o en su leyenda en el canvas, resalte esa línea al 100% de brillo y atenúe las restantes curvas de fondo al 20% de opacidad. Un segundo clic o presionar fuera desactiva la selección.
     - *HUD de Capas:* Dibuje en la esquina superior una tarjeta de control flotante semitransparente con los nombres de capas, interruptor de ojo de visibilidad y selector de estilo dash rápido.
   - Redibuje grillas y ejes adaptando el contraste y color dinámicamente en respuesta a `uiStore.isDarkMode` para garantizar la legibilidad en temas claro y oscuro.

**Plan de Validación:**
- Verifique que la ocultación del panel lateral desplace y ensanche los cuadrantes de forma fluida a 60 FPS sin saltos de layout.
- Realice zoom horizontal y vertical por separado usando la tecla Alt y compruebe que el modo Solo atenúe apropiadamente los trazos secundarios al hacer clic físico sobre la curva en el canvas.
