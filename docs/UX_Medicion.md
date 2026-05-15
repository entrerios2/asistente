# Análisis UX/UI: Interfaz de Medición Avanzada

La idea de adoptar un diseño híbrido con un modo "Secuencial" (APST) y un "Modo Manual" inspirado en Open Sound Meter (OSM) resuelve magistralmente la dualidad entre nuestra innovación (orquestación guiada) y lo que el ingeniero de sistemas profesional espera ver y utilizar.

A continuación, desgrano la idea en un esquema arquitectónico y visual para validar si estamos alineados.

## 1. Layout General y Estrategia Responsiva (100vw / 100vh)

La aplicación debe sentirse como un software de medición nativo, no como una página web. Por lo tanto, el layout global estará bloqueado a **`100vw` y `100vh` con `overflow: hidden`**, eliminando el *scroll* del navegador. Cualquier *scroll* necesario (ej. la lista de snapshots) sucederá internamente dentro de su contenedor específico.

### Escritorio y Tablets (Landscape)
*   **Sidebar Fijo (Izquierda):** Panel de control de ancho fijo (ej. 320px).
*   **Main View (Centro/Derecha):** Área de gráficos ocupando todo el espacio restante (`flex: 1`).
*   **Header (Arriba):** Selector de hardware (HAL), status global, reloj/SPL meter, y un **Switch de Tema de Contraste** (Sol/Oscuro).

### Móviles (Portrait)
Mostrar gráficos de alta densidad matemática en un teléfono vertical es un desafío de UX. La estrategia de adaptación es:
1.  **Sidebar Colapsable (Bottom Sheet o Drawer):** El panel izquierdo de escritorio se convierte en una solapa que emerge desde abajo o en un menú hamburguesa, ocultándose por defecto para maximizar el área del gráfico.
2.  **Restricción del Grid:** En móviles verticales, el motor de vistas se limita automáticamente a `1x1` (Single) o `2x1` (Stack vertical) como máximo. Si el usuario abre más cuadrantes, se navegan deslizando horizontalmente (*Swipe/Carousel*) o mediante pestañas, evitando que el gráfico sea tan pequeño que resulte ilegible.
3.  **Dimensionamiento Táctil (Hit Targets):** Todos los botones, *sliders* y selectores deben escalar su tamaño en móviles para garantizar un área interactiva cómoda para los dedos (mínimo 44x44px o 48x48px según estándares de UX móvil).
4.  **Modales a Pantalla Completa:** En dispositivos móviles, cualquier menú de opciones complejo (como la configuración de un cuadrante o el panel del **Gestor de Snapshots**) pasará de ser un popup flotante a un modal inmersivo a pantalla completa (*full-screen modal*) para facilitar la gestión sin saturar la UI gráfica subyacente.
5.  **Interacciones por Gestos:** Las herramientas dependerán de gestos nativos: *Pinch-to-zoom* sobre los ejes para cambiar las escalas, y arrastre con dos dedos para el *offset* de trazos.

## 2. El Sidebar: Controlador Maestro (4 Pestañas)

La interfaz se consolida en un único panel lateral izquierdo (Sidebar) que actúa como el cerebro de la aplicación. Para evitar el uso de emojis, todas las pestañas y controles gráficos utilizarán **Material Icons**. Contará con 4 pestañas principales:

### Pestaña 1: Medición (`graphic_eq`)
El corazón del sistema. Un selector moderno (tipo *segmented control*) en la parte superior permitirá alternar entre los dos paradigmas de trabajo:

**A. Modo Secuencial (`lists`):**
El enfoque "Copiloto". Aquí vive la innovación del proyecto.
*   **Modo Operativo:** Selector *En vivo* vs *Offline*.
    *   *En vivo:* Muestra botón "Iniciar medición".
    *   *Offline:* Muestra botón "Escuchar" (espera pasiva de FSK) y, debajo, lista de archivos de audio generados descargables (WAV/FLAC) filtrables por tipo y samplerate.
*   **Selector de Secuencias APST:** Dropdown para elegir secuencias completas o reducidas. Lista interactiva de los segmentos (V, A, M, N, F, P, T, D, X, R) con tooltips explicativos.
*   **Progreso en Vivo:** A medida que el orquestador avanza, se muestran los resultados numéricos preliminares.

**B. Modo Manual (`hearing`):**
El enfoque "Workbench". Control absoluto inspirado en Open Sound Meter.
*   **Generador de Señales:** Equiparación total con OSM (Ruido rosa, blanco, Brown, music-noise, Seno continuo, Sweep logarítmico puro, burst, SinBurst, MLS+).
*   **Opciones por generador:** Exposición dinámica de controles (ej. Frecuencia, ciclos, ancho de banda) idéntica a OSM.
*   **Controles:** Botones "Generador" y "Escuchar". Input de retardo manual y botón "Calcular retardo".

### Pestaña 2: Ecualización (`equalizer`)
El módulo de corrección acústica.
*   **Selector de Tipo:** Ecualizador Gráfico, Paramétrico, etc.
*   **Playground Interactivo:** Controles de Ganancia, Frecuencia y Q dinámicos según el tipo seleccionado.
*   **Interacción Visual:** La curva resultante de la suma del impulso acústico + el filtro del playground se dibujará en tiempo real sobre el lienzo.
*   **Auto EQ:** Botón "Calcular ecualización" que alimenta automáticamente los parámetros sugeridos al playground para su ajuste manual final.

### Pestaña 3: Instantáneas (`screenshot_frame_2`)
La memoria acústica (antiguo SnapshotPanel). Módulo central y compartido.
*   **Auto-save (Secuencial):** Tras una secuencia, se guarda el trazo automáticamente.
*   **Manual-save:** Botón de captura congela el estado actual.
*   **Identidad Visual:** Íconos distintivos (Material Icons) diferencian snapshots Secuenciales de Manuales.
*   **Offset Manual (Y-Offset):** Capacidad de aplicar compensación de decibeles.
*   **Visibilidad:** Botón "Ojito" para encender/apagar el trazo sobre el lienzo.

### Pestaña 4: Configuración (`settings`)
El ruteo y visualización.
*   **Audio I/O:** Selectores de dispositivo de Entrada y Salida, selección individual de canales, y definición de Canal de Referencia (con opción Loopback).
*   **Pantalla:** Selector visual estilo "Insertar tabla de Word" para definir la grilla de gráficos (desde 1x1 hasta 2x3).
*   **Tema:** Toggle de Modo oscuro.

## 3. Lienzo Principal (Main View)

Aquí radica la potencia visual. El área gráfica debe ser altamente personalizable, igual que OSM o Smaart.

### Motor de Vistas (Grid System) y Configuración Local
*   Posibilidad de dividir la pantalla y apilar gráficos: `1x1` (Single), `2x1` (2 filas), `3x1` (3 filas en una columna), `1x2` (2 columnas), `2x2` (4 cuadrantes), y hasta **`3x2` (6 cuadrantes: 3 filas por 2 columnas)**.
*   **Selector Integrado por Cuadrante:** Cada cuadrante contará con su propio menú de configuración (botón de engranaje). Desde allí residirá el **Selector de Mediciones** para definir qué métrica observar (RTA, Magnitud, Fase, Coherencia, Espectro, Nivel, Valores Numéricos, IR, Delay de Grupo), permitiendo cargar y cruzar tanto mediciones en vivo (Manual o Secuencial) como cualquier *snapshot* de la memoria.
    *   *Configuración Específica:* Si la medición seleccionada requiere ajustes profundos (ej. tamaño de bloque FFT o tipo de ventana para un IR), se mostrará un **ícono dedicado que abrirá un modal** para ajustar esos parámetros sin saturar la interfaz principal.

### Motor de Trazos (Trace Engine)
*   **Superposición y Presets de Compatibilidad:** Múltiples mediciones conviven en el mismo cuadrante. Sin embargo, no todas las mediciones son compatibles en una misma escala (ej. RTA usa dB absolutos o SPL, Magnitud usa dB relativos, Fase usa grados). El botón de configuración aplicará "Presets de Vista" para filtrar lógicamente y evitar superponer peras con manzanas.
*   **Avanzado:**
    *   **Suavizado (Smoothing):** Selector rápido en el cuadrante (1/3, 1/6, 1/12, 1/24, 1/48 de octava) para limpiar el "pasto" de las FFTs crudas y visualizar tendencias tonales reales.
    *   **Coherence Blanking:** Opción para ocultar o engrisar automáticamente los trazos de Magnitud/Fase en aquellas frecuencias donde la coherencia matemática caiga por debajo de un umbral definible (ej. 20%), evitando decisiones de EQ erróneas basadas en ruido acústico.
    *   **Desenvolvimiento de Fase (Phase Unwrap):** Botón dedicado en los gráficos de Fase para "desenrollar" visualmente la curva (+/- 180°), facilitando enormemente la lectura del Delay de Grupo continuo.
*   **Estilizado Distintivo:** Variación de colores, grosor, rellenos (fills) y estilos de línea (sólido, dashed) para distinguir lo que está en vivo de la memoria.
*   **Interfaz de Gráficos (Data Viz):**
    *   **Grilla y Ejes:** Mostrar una muy buena grilla de valores en el fondo, con referencias numéricas claras en los bordes.
    *   **Controles de Escala:** Controles sutiles incrustados en los ejes (y soporte para *scroll/pinch*) para expandir, contraer o desplazar las escalas (Zoom In/Out) de los ejes X e Y de forma independiente.
    *   **Cursor Interactivo:** Cursor estilo "mirilla" (*crosshair*) que sigue el mouse, con una etiqueta flotante mostrando los valores numéricos exactos (`X: Hz, Y: dB/Deg`) que acompañen dinámicamente al movimiento del cursor.

## 4. Gestor de Snapshots (Compartido)

La gestión de snapshots (Instantáneas) debe ser un módulo central y **compartido** por ambos modos de operación (Secuencial y Manual).
El Snapshot es el estado guardado en memoria de un array matemático completo.
*   **Auto-save (Secuencial):** Tras una secuencia automatizada, se guarda automáticamente un trazo (ej. "PA_Left_PostEq_10:30").
*   **Manual-save:** En Modo Manual, un botón de captura congela el estado actual.
*   **Identidad Visual:** La lista del gestor utilizará **íconos distintivos** para diferenciar a simple vista qué snapshots provienen de mediciones Secuenciales y cuáles son de capturas Manuales.
*   **Organización Avanzada:** Capacidad de guardarlos persistentemente y **ordenarlos/agruparlos por Ubicación y por Fecha/Hora**.
*   **Offset Manual (Y-Offset):** Capacidad de aplicar una compensación visual de decibeles a un snapshot para desplazarlo hacia arriba o abajo en el eje Y. Vital para comparar curvas de frecuencia de sistemas que fueron medidos a distinto volumen real.
*   **Activación Visual:** Un panel flotante o pestaña inferior donde el usuario puede prender/apagar el "Ojito" (visibilidad) de cada trazo guardado sobre los gráficos actuales.

## 5. Accesibilidad y Atajos de Teclado (Hotkeys)

Diseñado para la máxima velocidad operativa en campo (donde la mano libre está en la consola de mezcla), el sistema integrará atajos de teclado para las acciones más críticas:
*   `Espacio`: Capturar Snapshot manual del cuadrante activo.
*   `D`: Disparar alineamiento automático ("Find Delay").
*   `1 al 9`: Alternar rápidamente la visibilidad ("Ojito") de los últimos snapshots capturados.

---

### Reflexión Técnica sobre Svelte 5

Implementar esto con Svelte 5 (Runes) es **ideal**.
Podemos tener un Store reactivo global (`traceManager.svelte.ts`) que contenga un array de objetos `Trace`:

```typescript
interface Trace {
    id: string;
    name: string;
    type: 'live' | 'snapshot' | 'math';
    metric: 'magnitude' | 'phase' | 'rta' | 'ir' | 'group_delay';
    data: Float32Array; // Array de puntos XY
    color: string;
    style: 'solid' | 'dashed';
    visible: boolean;
    location?: string;
    timestamp?: number;
}
```

Nuestros componentes `<Canvas>` se van a suscribir a este store para iterar sobre los trazos visibles y pintarlos con la mirilla interactiva en tiempo real.
