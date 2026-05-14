# Implementación Fase 2A: UI de Medición Avanzada y Consolidación Core

Este documento detalla la arquitectura técnica y los pasos de desarrollo para materializar la **Fase 2A**. Esta fase transforma el sistema DSP fundamental (Fase 1) en una herramienta de medición *standalone* de grado profesional, resolviendo las deudas técnicas arquitectónicas e implementando un motor de renderizado gráfico de alto rendimiento.

---

## 1. Backlog Core: Procesamiento y Protocolos

### 1.1. APST Builder a WAV
- **[MODIFY] `tools/apst-builder/src/index.ts`**
  - Refactorizar el script para funcionar a demanda del usuario mediante parámetros CLI que soporten múltiples valores separados por comas: secuencia de códigos (`VANFP,VPN`), *sample rate* (`44100,48000,96000`), opción de canal para subwoofer (`true,false`) y formato de salida (`wav,flac`).
  - El script debe generar el producto cartesiano de todas las combinaciones solicitadas en una sola ejecución.
  - Asegurar que la salida principal se genere en `.wav` (PCM Lineal sin compresión) como target por defecto.
  - Implementar la nomenclatura estandarizada obligatoria para los archivos generados: `apst_[secuencia]_[samplerate]k_[canal].[extension]` (ej: `apst_vanfp_48k_main.wav`, `apst_vpn_44k_sub.flac`).

### 1.2. Procesamiento Dual Híbrido y Modo Ciego
- **[MODIFY] `src/lib/dsp/apst/Orchestrator.ts`**
  - Implementar la orquestación de doble vía sobre el `SharedArrayBuffer` durante secuencias largas (Segmento F, T, S).
  - **Fast-Path:** Lógica para instanciar un worker ligero que realice análisis RMS (clipping, caídas bruscas) y FFTs pequeñas (1024 bins) para RTA en vivo. Si detecta anomalías extremas, invoca un método de `abortSequence()`.
  - **Modo Ciego:** En `src/lib/utils/tierDetector.ts`, evaluar el rendimiento del sistema durante los primeros 500ms de captura. Si el Event Loop Lag es excesivo, emitir evento para abortar el Fast-Path inmediatamente, garantizando la escritura limpia en el `SharedArrayBuffer` para el Slow-Path.

### 1.3. Cable Tester Extendido (Segmento X y Score)
- **[MODIFY] `src/lib/dsp/apst/CableTester.ts`**
  - Extender la lógica del loopback para incluir el Segmento N (medición de piso de ruido para detectar fallas de blindaje y bucles de 50/60Hz).
  - Integrar la lógica para el Segmento X (Crosstalk), evaluando sangrado entre canales, pero manteniendo su visualización como *opcional* mediante una flag en la UI.
  - Implementar la función `calculateCableScore(attenuation, snr, thd): number` que devuelva un valor normalizado (1 a 10) exportable.

---

## 2. Motor de Trazos y Estado Global (Svelte 5)

La pieza central de la nueva arquitectura de UI es separar el procesamiento matemático del renderizado visual mediante un Store global reactivo.

### 2.1. El Trace Manager
- **[NEW] `src/lib/stores/traceManager.svelte.ts`**
  - Implementar el estado global para gestionar los trazos acústicos.
  - Interfaz base:
    ```typescript
    interface Trace {
        id: string;
        name: string;
        type: 'live' | 'snapshot' | 'math';
        metric: 'magnitude' | 'phase' | 'rta' | 'ir' | 'group_delay';
        data: Float32Array; 
        color: string;
        style: 'solid' | 'dashed' | 'fill';
        visible: boolean;
        offsetY: number; // Compensación manual de nivel
        timestamp?: number;
    }
    ```
  - Métodos clave: `addTrace()`, `removeTrace()`, `toggleVisibility()`, `setYOffset()`, y `captureSnapshot()`.

### 2.2. Gestor de Snapshots
- **[NEW] `src/components/medicion/SnapshotPanel.svelte`**
  - Componente de UI que se suscribe al `traceManager`.
  - Muestra la lista de trazos tipo `snapshot`, ordenables por fecha o ubicación.
  - Incluye el sistema de "Ojito" para prender/apagar trazos y controles de desplazamiento Y (*Y-Offset*).

---

## 3. UI Multi-cuadrante y Renderizado (Canvas)

El lienzo principal deja de ser un gráfico único para convertirse en una grilla personalizable, imitando el estándar de herramientas como Smaart u Open Sound Meter.

### 3.1. Grid System
- **[NEW] `src/components/medicion/ViewGrid.svelte`**
  - Contenedor CSS Grid reactivo que adapta sus columnas/filas (desde `1x1` hasta `3x2`) dependiendo de la selección del usuario.
  - En móviles (ancho < 768px), fuerza un máximo de `2x1` e implementa scroll/swipe horizontal si hay más cuadrantes activos.

### 3.2. Canvas Renderer (El Cuadrante)
- **[NEW] `src/components/medicion/Quadrant.svelte`**
  - Reemplazo y evolución del antiguo `TraceMath`.
  - Cada cuadrante es independiente, posee una cabecera con un botón de "tuerquita" para configurar qué métrica visualiza (ej. este cuadrante muestra Fase, el otro muestra Magnitud).
  - Suscripción filtrada al `traceManager`: solo renderiza los trazos cuya métrica (`metric`) coincida con la configuración del cuadrante.
  - **Filtros Analíticos:** Implementar lógicas visuales antes de pintar:
    - *Smoothing:* Promediado móvil fraccional por octava (1/3, 1/6, 1/48).
    - *Coherence Blanking:* Si `coherenceArray[i] < umbral`, pintar el trazo de magnitud/fase en gris o cortarlo.
    - *Phase Unwrap:* Desenvolver los saltos de ±180° visualmente.
  - **Interacción:** Renderizado de la grilla de fondo, referencias en los ejes y un "Crosshair" que sigue al mouse/dedo mostrando los valores exactos XY.

---

## 4. Layout 100vw y Shell de la Herramienta

### 4.1. Layout Fijo
- **[MODIFY] `src/routes/+page.svelte` (Temporal) o nueva ruta de Medición**
  - Aplicar `w-screen h-screen overflow-hidden bg-background text-foreground` al contenedor raíz.
  - Estructurar en `Header` (arriba), `Sidebar` (izquierda/bottom), y `Main` (ViewGrid).

### 4.2. Sidebar Tabulado (Secuencial vs Manual)
- **[NEW] `src/components/medicion/Sidebar.svelte`**
  - **Pestaña A (Secuencial):** Selector de secuencias (APST). Lista de pasos (`V A N F P`) con checkmarks reactivos al `Orchestrator`. Botones principales: "Iniciar" (ejecución en el dispositivo) e "Iniciar fuera de línea" (para descargar la pista WAV de prueba).
  - **Pestaña B (Manual):** Panel de generador de señales invocando métodos del HAL (Ruido Rosa, Blanco, Seno). Selección de enrutamiento de salida y botón de captura de retardo ("Find Delay").
- **Responsividad:** Mediante un Media Query, este componente debe actuar como un Drawer emergente desde abajo en dispositivos móviles.

### 4.3. Accesibilidad y Touch
- **Hit Targets:** Auditar todos los botones del nuevo layout (tuerquitas, play, tabs) para asegurar que tengan clases como `min-w-[44px] min-h-[44px]`.
- **Modales a Pantalla Completa:** En dispositivos móviles, la tuerca de configuración y el panel de Snapshots usarán modales *fullscreen* absolutos.
- **Hotkeys:** Instalar `window.addEventListener('keydown')` para atajar la tecla `Espacio` (guardar snapshot del cuadrante en foco) y `D` (Find Delay automático).

---

## 5. Fase 2A.1: Refactorización UX/UI

La implementación original requiere ajustes críticos para alinearse estrictamente con `UX_Medicion.md` y corregir los elementos sin funcionalidad. No se deben utilizar fondos con blur (`backdrop-filter`).

### 5.1. Cabecera global (`Header.svelte`)
- **Limpieza visual:** Eliminar elementos inútiles (selector HAL falso, etiqueta "Conectado", medidor SPL hardcodeado y reloj del sistema).
- **Contenido:** Solo incluir un selector real de dispositivo de entrada (micrófono), un selector de Layout de grilla (1x1, 2x1, 2x2) y el botón de alternar tema (asegurando que inyecte la clase `.dark` en el `<html>`).

### 5.2. Panel lateral - Secuencial (`Sidebar.svelte`)
- **Secuencias:** Ampliar el `<select>` para incluir secuencias reales (ej. "Completa (VANFP)", "Verificación (V)", "Respuesta (F)").
- **Estado:** Traducir y hacer legible el estado del orquestador (ej. "En espera" en vez de "IDLE").
- **Explicación de segmentos:** La lista de pasos debe mostrar nombres completos ("V - Verificación de ganancia", "F - Respuesta en frecuencia").
- **Botón de descarga:** Clarificar el botón de "Descargar WAV" con texto explícito ("Descargar pista de prueba"), no un mero ícono desplegable.

### 5.3. Panel lateral - Manual (`Sidebar.svelte`)
- **Generadores:** Ampliar la lista a Ruido rosa, Ruido blanco, Seno continuo y Barrido logarítmico (Sweep).
- **Visibilidad condicional:** Ocultar el control de "Frecuencia" cuando el generador sea Ruido Rosa o Blanco.
- **Gestión de Retardo:** Incluir un input numérico para el "Retardo de medición (ms)" manual, el cual se autocompletará si se presiona el botón "Alinear retardo".

### 5.4. Cuadrantes y Grilla (`ViewGrid.svelte` y `Quadrant.svelte`)
- **Selector de layout:** El `ViewGrid` debe reaccionar al selector del Header para cambiar sus columnas y filas CSS.
- **Menú de configuración:** El modal/dropdown de la tuerca `⚙️` debe ser un popover flotante y **compacto** en versión desktop, no ocupando toda la pantalla ni siendo gigante.
- **Referencias de ejes:** La función `draw` del canvas DEBE incluir llamadas a `fillText` para renderizar los valores en Hz en el eje X inferior y los dB/Grados en el eje Y.
- **Gestos:** Implementar arrastre para offset y pellizco/rueda para escala (`scaleX/Y`).

### 5.5. Panel de instantáneas (`SnapshotPanel.svelte`)
- **Ocultamiento:** Agregar la capacidad de colapsar o cerrar por completo el panel lateral de instantáneas.
- **Limpieza:** Eliminar cualquier efecto blur.

---

## 6. Fase 2A.2: Conexión DSP y Motor de Medición (Wireup)

### 6.1. Motor HAL (`WebAudioProvider.ts`)
- **RTA Real:** Instanciar un `AnalyserNode` en `startCapture` para obtener los datos de frecuencia en vivo.
- **Barrido real:** Modificar la lógica de `playGenerator` en modo 'sweep' para usar `exponentialRampToValueAtTime`, generando un barrido auditivo real, no un tono estático.

### 6.2. Inyección Reactiva (`traceManager`)
- Crear `updateLiveTrace(metric, data)` para que el `traceManager` reciba iterativamente los datos crudos del `AnalyserNode`, forzando el redibujado de los cuadrantes en vivo.
