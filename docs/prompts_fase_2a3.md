# Prompts de Implementación: Fase 2A.3 - Refinamiento DSP y UI

Este documento contiene los prompts estructurados y auto-contenidos, diseñados específicamente para que un modelo con contexto reducido (Gemini 3.5 Flash) pueda ejecutar la implementación paso a paso sin requerir de la totalidad del código fuente del proyecto en cada iteración.

---

### Prompt 1: Optimización del Core DSP y Renderizado del Canvas
**Contexto a inyectar:** `src/components/medicion/Quadrant.svelte`.
```markdown
Eres un ingeniero experto en DSP y rendimiento de Svelte 5.
Tu objetivo es modificar EXCLUSIVAMENTE el componente `Quadrant.svelte` para resolver dos problemas críticos de rendimiento y visualización (1 FPS y gráfico RTA invisible) en un analizador de espectro de audio.

Requisitos estrictos de implementación:
1. Escala Y Dinámica: Modifica la función `valToY` (o equivalente que calcula la altura en el canvas) para que cuando la métrica a graficar sea un RTA absoluto (Spectrum/Level), la escala de mapeo vaya desde un mínimo de -120 dB hasta un máximo de +10 dB. Esto hará visible la curva del `AnalyserNode`.
2. Caché de Filtros EQ: El cálculo predictivo de la ecualización está matando el Event Loop (20k operaciones por frame). Crea un `$derived` array en Svelte 5 que pre-calcule la curva de respuesta del ecualizador. El motor de renderizado (`requestAnimationFrame`) DEBE leer este array cacheado en lugar de ejecutar las funciones matemáticas `Math.log2`, `Math.exp` en cada iteración.
3. Logarithmic Binning (Decimación): Implementa un algoritmo de agrupamiento logarítmico para el suavizado de la curva RTA (función `smoothData`). En lugar de promediar linealmente miles de bins en frecuencias altas, agrupa los bins en ventanas logarítmicas (ej. 1/3, 1/6 de octava) ANTES de dibujarlos, reduciendo drásticamente los puntos a iterar y manteniendo 60 FPS estables.
No modifiques UI ajena al canvas. Devuelve el código del componente optimizado.
```

---

### Prompt 2: Arquitectura Base del Sidebar (4 Pestañas)
**Contexto a inyectar:** `src/components/medicion/Sidebar.svelte` (reemplazo completo).
```markdown
Eres un desarrollador experto en UI y Svelte 5.
Tu objetivo es reestructurar el archivo `Sidebar.svelte` desechando el layout antiguo y creando un contenedor maestro robusto basado en un sistema de 4 pestañas laterales fijas (Tabs).

Requisitos de implementación:
1. Pestañas: Crea un layout con un menú lateral o superior de navegación (dentro del propio Sidebar) para 4 pestañas exclusivas. Usa estricta y únicamente los siguientes Material Icons:
   - Medición: `cadence`
   - Ecualización: `instant_mix`
   - Instantáneas: `screenshot_frame_2`
   - Configuración: `settings`
2. Estado de Pestaña: Usa una variable reactiva Svelte 5 (`let activeTab = $state('medicion')`) para renderizar condicionalmente el bloque de contenido (ej. `{#if activeTab === 'medicion'}...`).
3. Bloques Vacíos: Deja el interior de los contenedores de las 4 pestañas como bloques div vacíos con un placeholder semántico (ej. `<!-- Contenido de Medición -->`). Esto servirá de base para inyecciones posteriores.
4. Asegúrate de aplicar clases TailwindCSS (modo oscuro compatible `bg-background text-foreground`, bordes, transiciones suaves y *hit targets* táctiles de mínimo 44px) para un acabado premium.
Devuelve el código del componente completo.
```

---

### Prompt 3: Pestaña Medición (Panel Manual, Secuencial y Estados)
**Contexto a inyectar:** Componente creado en el Prompt 2, centrándose solo en el bloque "Medición".
```markdown
Eres un desarrollador UX avanzado en Svelte 5.
Tu objetivo es implementar el interior de la pestaña "Medición" en el `Sidebar.svelte`.

Requisitos de implementación:
1. Switch de Modo: Un selector tipo *Segmented Control* para alternar entre "Manual" y "Secuencial".
2. Modo Manual:
   - Dropdown "Generador" con 9 señales (Ruido Rosa, Blanco, Brown, Music-noise, Seno continuo, Sweep logarítmico, Burst, SinBurst, MLS+).
   - Bloque de "Opciones Dinámicas": Un panel reactivo al tipo de señal (ej. si es Seno, muestra input de Frecuencia; si es Burst, input de Duración).
   - Slider horizontal de "Nivel" centrado en 0 dB por defecto.
   - Botones de "Generar / Detener" usando iconos `volume_up` y `volume_mute`.
   - Sección "Retardo": Botones "Calcular" y "Usar", más un input manual.
3. Modo Secuencial:
   - Tasa de Muestreo: Dropdown (44.1, 48, 96, 192 kHz).
   - Selector de Presets.
   - Tabla de Segmentos Compacta: Renderiza una sola columna donde el Nombre del segmento esté junto a su Checkbox. Debajo del Nombre, deja espacio div condicional para mostrar los resultados de métricas a medida que se completen. Usa tooltips (`title`) para la explicación de cada segmento.
   - Modo Offline: Un switch booleano. Si está activo, muestra anclado al final un botón "Descargar" (con selector de extensión WAV/FLAC).
4. Footer Anclado (Global a la pestaña): Un botón principal gigante "Medir / Detener" con el icono `podcasts`. En modo secuencial, conviértelo visualmente en una barra de progreso. Coloca texto de estado debajo ("Generando secuencia...", "Esperando...", etc.).
Devuelve el código del bloque insertado.
```

---

### Prompt 4: Pestaña Ecualización (Gráfico, Paramétrico, Tono y Estado)
**Contexto a inyectar:** Componente creado en el Prompt 2, centrándose solo en el bloque "Ecualización".
```markdown
Eres un experto en interfaces de control de Audio (UI/UX) y Svelte 5.
Tu objetivo es implementar el interior de la pestaña "Ecualización" en el `Sidebar.svelte`.

Requisitos de implementación:
1. Controles Superiores: Un Switch "Mostrar Ecualización" y un botón "Calcular Ecualización" (AutoEQ).
2. Selector de Tipo: Dropdown principal (Gráfico, Paramétrico, Control de Tono) que controla qué panel se muestra.
3. Modo Gráfico: Selector de "Cantidad de bandas". Renderiza dinámicamente un arreglo de sliders verticales u horizontales. Cada slider debe mostrar la frecuencia de la banda, tener una función `ondblclick` para resetear la ganancia a 0 dB, y un input numérico debajo para ingreso manual.
4. Modo Paramétrico: Selector de "Cantidad de Filtros". Renderiza paneles individuales. Cada panel tiene un botón "Configuración" que abre una lista de checkboxes para habilitar/limitar qué tipos de filtros soporta el polo (Paso alto, paso bajo, campana, shelving, notch, paso de banda). Controles de Frecuencia, Ganancia y Q reactivos al tipo activo.
5. Modo Tono: 3 controles simples de ecualización (Graves, Medios, Agudos).
6. Botón Anclado al Fondo: Botón de estado "Simular / Detener simulación" (estilo toggler), para activar la predicción de la curva o fijarla en un snapshot.
Devuelve el código del bloque insertado.
```

---

### Prompt 5: Pestañas Instantáneas y Configuración
**Contexto a inyectar:** Componente creado en el Prompt 2, centrándose en los bloques restantes.
```markdown
Eres un desarrollador experto en TailwindCSS y gestión de estado local con Svelte 5.
Implementa el contenido de las pestañas "Instantáneas" y "Configuración".

Requisitos de implementación:
1. Configuración > Audio (Hardware):
   - Dropdowns nativos de `dispositivos disponibles` (In/Out).
   - Checkboxes dinámicos para seleccionar/habilitar canales específicos de entrada y de salida.
   - Dropdown "Canal de Referencia" y un Checkbox especial para "Loopback interno".
2. Configuración > Pantalla y Sistema:
   - "Grilla predeterminada": Botones para configurar el layout por defecto, limitados a combinaciones de hasta 2 columnas y 3 filas. El botón "1x1" debe estar seleccionado por defecto.
   - Switch de "Modo Oscuro" global.
   - Lógica de persistencia: Envuelve las preferencias en un estado `$effect` que lea y guarde en `localStorage`.
3. Instantáneas: Crea una interfaz de gestión con una lista (ul/li) renderizando datos falsos o trazos del traceManager, con botones de visibilidad ("ojito"), opciones de ordenar por fecha, y slider manual de Y-Offset.
Devuelve el código de los bloques insertados.
```

---

### Prompt 6: Topbar (Cabecera) y Accesos Rápidos
**Contexto a inyectar:** `src/components/medicion/Header.svelte`.
```markdown
Eres un experto en accesibilidad y layouts de cabecera con TailwindCSS y Svelte 5.
Modifica `Header.svelte` para albergar accesos rápidos profesionales.

Requisitos de implementación:
1. Izquierda: Título "Herramienta para mediciones de audio".
2. Centro/Derecha (Controles de Generador y Medición):
   - Control Generador Rápido: Un botón con icono `volume_up`/`volume_mute` pegado a una etiqueta de texto que indica el nombre de la señal generada actual (ej. "Ruido Rosa"). Haz que el click en la etiqueta despache un evento o acceda a una función para abrir la pestaña "Medición Manual" del Sidebar.
   - Control Medición Rápida: Un icono que represente el modo actual (Secuencial o Manual). Al cliquear el icono, se abre el panel de medición correspondiente. Al lado, el botón principal de acción "Medir" con el icono `podcasts`.
3. Selector de Grilla Visual: Implementa un widget "Insertar Tabla" estilo Word: un menú desplegable (dropdown) que muestre una matriz de cuadrados de 2x3. Al pasar el mouse, resalta los cuadrados y al hacer clic define la configuración del layout de la grilla principal (ej. 2x1, 1x1). Default 1x1.
4. Vúmetros (Extremo Derecho): Un componente de barras horizontales apiladas. Arriba (Entrada), Abajo (Salida). Añade un indicador visual LED/icono en el medio de las barras que, cuando el generador está encendido, se ilumine si los niveles IN/OUT están empatados (calibrados/igualados). Al hacer clic en los Vúmetros, abre la pestaña "Configuración".
```

---

### Prompt 7: Motor Multi-Cuadrante y Popover OSM
**Contexto a inyectar:** `src/components/medicion/ViewGrid.svelte` y `Quadrant.svelte`.
```markdown
Eres un programador experto en arquitecturas de aplicaciones de grado de ingeniería en Svelte 5.
Debes actualizar la lógica de visualización y el contenedor de los gráficos.

Requisitos de implementación:
1. Grid Dinámico: En `ViewGrid.svelte`, usa CSS Grid y escucha el estado de configuración (de 1x1 hasta 2x3) para redimensionar los `<Quadrant />` renderizados.
2. Responsividad Absoluta (`ResizeObserver`): En `Quadrant.svelte`, implementa un `ResizeObserver` en el div contenedor que alimente el ancho/alto en píxeles físicos del `<canvas>`, y multiplícalo por `window.devicePixelRatio` para evitar pixelación, independientemente del tamaño del cuadrante.
3. Gestos (Interacción): Instala manejadores de eventos nativos en el canvas para soportar *Pan* (arrastrar el gráfico en X e Y) y *Zoom* (usando la rueda del mouse o gesto de *pinch-to-zoom*).
4. Popover OSM: En la esquina de cada cuadrante, muestra un título con las métricas activas actualmente y un icono de configuración. Al hacer clic, despliega un Popover flotante absoluto.
   - El Popover debe listar las 10 métricas de Open Sound Meter (Spectrum, Magnitude, Phase, Impulse, Step, Coherence, Group Delay, Spectrogram, Level, Numeric).
   - Implementa checkboxes.
   - Aplica estricta lógica de Superposición Cartesiana: Si el usuario selecciona "Magnitude" (escala Y relativa), deshabilita o enmascara "Spectrum" (escala Y absoluta) pero permite seleccionar "Phase" (escala angular secundaria). Revisa el grupo temporal (Impulse/Step) vs frecuencia logarítmica.
```

---

*(Nota para el usuario: Los Prompts 8 y 9 sobre la implementación matemática del pseudocódigo de generadores y de métricas deberán ejecutarse sobre el `WebAudioProvider.ts` o la clase del motor DSP una vez que los archivos base de UI estén estructurados mediante estos 7 primeros prompts).*
