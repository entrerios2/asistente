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

## 2. El Sidebar: Tabulador Dual

El sidebar tendrá dos grandes pestañas en la parte superior, cambiando radicalmente la filosofía de trabajo de la herramienta pero compartiendo el mismo lienzo gráfico.

### Pestaña A: Secuencial
El enfoque "Copiloto". Aquí vive la innovación del proyecto.
*   **Selector de Secuencias:** Dropdown para elegir la secuencia a ejecutar (Full Commission, Quick Check, Cable Tester). *Nota: El wizard guiado completo se dejará para una iteración posterior.*
*   **Opciones de Disparo:** Un botón dividido (split button) que permita:
    *   Disparar la secuencia internamente (generador local).
    *   Activar la "Escucha Offline" (el sistema se pone a la escucha pasiva esperando el trigger), ofreciendo ahí mismo enlaces rápidos para **descargar los archivos de audio** (.wav/.flac) correspondientes a la secuencia seleccionada, listos para reproducir desde un USB externo.
*   **Progreso en Vivo:** Una lista de pasos (`V`, `A`, `N`, `F`, etc.) con *checkmarks* que se van iluminando a medida que el orquestador escucha el FSK, **y muestra a su lado los resultados numéricos preliminares** apenas cada paso concluye.
*   **Smart Toasts / Diagnósticos:** Si el Fast-Path detecta un *showstopper*, la alerta roja de acción (ej. "Baje ganancia") aparece aquí.

### Pestaña B: Modo Manual (Estilo OSM)
El enfoque "Workbench". El control absoluto para el operador veterano.
*   **Generador de Señales:**
    *   Ruido Rosa, Ruido Blanco, Ruido Rojo.
    *   Seno, Sweep Lineal, Sweep Logarítmico.
    *   Controles: Play/Stop, Frecuencia, Nivel (dBFS), **Selección de canal de salida (L/R/Stereo)**.
*   **Alineamiento de Delay:** Botón de "Find Delay" para que el usuario fuerce la sincronización temporal manualmente entre la referencia y la medición.
*(Nota: El selector general de mediciones fue reubicado a la cabecera de cada cuadrante gráfico para permitir mayor modularidad).*

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
