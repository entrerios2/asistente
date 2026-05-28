# Plan de Implementación: Rediseño de Gestión de Métricas en Cuadrante (V9)

Este plan detalla el rediseño de la interfaz de usuario para la administración y configuración de métricas en los cuadrantes de la vista gráfica (`Quadrant.svelte`). Incorpora optimizaciones de alta resolución en el eje X, el análisis y corrección del vúmetro a saltos consolidando el cálculo dentro del módulo de mediciones, gradientes de calibración a 0 dB, la sincronización bidireccional paralela de la simulación de EQ, y mejoras funcionales avanzadas para el Espectrograma 2D.

---

## 📌 Principios del Rediseño

### 1. Retención del Diálogo de Configuración Global del Cuadrante
- El popover global actual (`.selector-popover`) **no se elimina**. 
- Se reestructura para albergar únicamente configuraciones globales que afectan a todo el cuadrante como conjunto:
  - **Suavizado Global (Smoothing)**.
  - **Límites de FPS de Renderizado**: Selector mediante un **control deslizante (slider)** que va desde **0.5 a 60 FPS**, con incrementos de **1 FPS** y un valor predeterminado (default) de **10 FPS**.
  - **Límites de Zoom (In / Out)**: Restricciones en la escala (frecuencia de 10 Hz a 24 kHz; amplitud a ±100 dB).
  - **Alineación de Ejes Y (Visual Shift)**: Opción para desplazar verticalmente el trazo de distintas métricas activas para facilitar la comparación y visualización superpuesta en el mismo espacio.

### 2. Nomenclatura Numérica de Títulos
- El título del cuadrante se referirá únicamente por su número (ej: "1", "2", "3", "4").

### 3. Botón "Agregar Métrica" (+) en la Cabecera
- Ubicado en la barra superior al lado del identificador numérico.
- Despliega un menú flotante dropdown con la lista de métricas disponibles, con exclusión cartesiana reactiva.
- **Integración de Simulación de EQ**: Se añade a la lista de métricas seleccionables la opción **"Simulated Magnitude"** (o "Magnitud Simulada").

### 4. Pills Interactivos con Acción de Borrado por Icono de Papelera
- Pills con color sólido e iconos individuales de **Configurar** (`tune`) y **Eliminar** (`delete`).

### 5. Optimización de Rendimiento UI (Sin Transparencias ni Blur)
- Los popovers, menús de adición y dropdowns usarán fondos con colores opacos sólidos y bordes limpios sin efectos gráficos costosos (sin `backdrop-filter` ni opacidades) para garantizar máximo rendimiento a cualquier nivel de FPS.

---

## 🔍 Análisis Técnico: Renderizado a "Saltos" (Visual Jumps)

### El Síntoma
Las curvas se mueven de a saltos discretos seguidos de transiciones que se ralentizan hasta congelarse justo antes del próximo paso.

### La Causa Raíz
Desacoplamiento entre la tasa de refresco del DSP (`throttleMs` del `MathOrchestrator`) y el suavizado exponencial en el hilo visual, sumado a la ejecución frecuente de `snap` por disparadores reactivos de `dirty` en Svelte.

### Solución
1. **Interpolación Basada en Tiempo de Transición (Linear/Hermite Path Interpolation)**: En el bucle de pintado a 60 FPS, calcularemos un factor de interpolación normalizado de tiempo $t$ basado en el timestamp del último cálculo del DSP y el intervalo de refresco (`throttleMs`):
   $$t = \min\left(1.0, \frac{\text{now} - \text{lastMathTime}}{\text{throttleMs}}\right)$$
   Interpolaremos linealmente entre el buffer del frame anterior y el nuevo usando $t$. Esto asegura un desplazamiento continuo a 60 FPS sin detenciones ni saltos de velocidad.
2. **Aislamiento Estricto del Flag `dirty` (Snap vs. Smooth)**: Limitar el "snap" (salto instantáneo sin suavizado) a acciones estrictamente destructivas o cambios estructurales iniciados por el usuario (como cambiar de escala, resetear el zoom o cargar un archivo nuevo).

---

## 🔍 Análisis Técnico: Pérdida de Detalle en el Eje X

### El Síntoma
Las curvas de magnitud y fase de nuestro sistema lucen excesivamente simplificadas y carecen de las muescas (notches), picos angostos y texturas detalladas presentes en las gráficas de Open Sound Meter.

### La Causa Raíz
El bucle que recorre las frecuencias incrementa multiplicativamente (`f *= 1.03`), evaluando únicamente entre **176 y 233 puntos** para cubrir de 20 Hz a 20 kHz, y la función `smoothDataLog` reduce la FFT de 4096 bins a un tamaño fijo de 400 puntos.

### Estrategia de Implementación y Optimización de Alta Resolución
1. **Tabla de Búsqueda de Frecuencias (Lookup Table - LUT)**: Crearemos un `Int32Array` de tamaño `width` que guarda el índice exacto del buffer DSP para cada píxel. Solo se recalcula al cambiar el zoom/ancho del canvas, reduciendo el bucle a $O(\text{Width})$ con lectura directa de memoria.
2. **Caché Gráfica con `Path2D`**: Reconstrucción de la ruta únicamente ante actualizaciones. En frames intermedios se llama a `ctx.stroke(cachedPath)`.
3. **Downsampling Dinámico por Columna (MinMax)**: Dibujo de rangos verticales (mínimo a máximo) para múltiples bins que coinciden en el mismo píxel para evitar aliasing.
4. **Suavizado (PPO) en el DSP**: Procesado del suavizado acústico únicamente en el `MathOrchestrator` durante el ciclo de actualización de datos, entregando a la UI un array limpio de tamaño óptimo sin cómputo de integraciones redundantes a 60 FPS.

---

## 🔍 Análisis Técnico: Vúmetro de Entrada y Consolidación en el Módulo de Mediciones

### El Síntoma
El vúmetro de entrada (IN) reacciona lentamente, dando saltos muy toscos de nivel.

### La Causa Raíz (Bug de Índice en `WebAudioProvider.ts`)
En la función de captura de audio (`readData`), el cálculo lee siempre el rango fijo `0..127` de `sharedArray` (un ring buffer de 48,000 muestras) en lugar de utilizar el índice de escritura actual. Esto provoca que el vúmetro solo se actualice una vez por segundo cuando el puntero del buffer circular completa una vuelta entera.

### Solución Propuesta (Cálculo Integrado en el Módulo de Mediciones)
Para evitar recargar la capa de hardware/captura y centralizar el procesamiento en las capas matemáticas correctas:
1. **Cálculo dentro del Módulo de Procesamiento**: En lugar de calcular el valor pico en `WebAudioProvider`, el valor RMS/Peak se calculará **directamente en el módulo de mediciones** (dentro de `MathOrchestrator` o en el flujo de callback de procesamiento de tramas de `traceManager.svelte`).
2. **Cómo funciona**:
   - Cada vez que el motor DSP procesa un bloque de muestras para la FFT, calculará de forma directa el valor pico/RMS de ese bloque.
   - Llamará a `meterStore.updateIn([dbIn, dbIn])` directamente desde la lógica DSP, garantizando que los vúmetros estén perfectamente sincronizados con la señal de audio real procesada.
3. **Rediseño Visual del Vúmetro (Gradientes de Calibración a 0 dB)**:
   - Escalaremos el rango del vúmetro en `Header.svelte` para ir de **-60 dB a +10 dB** (dando un rango de 70 dB).
   - Aplicaremos un gradiente multicolor CSS lineal y continuo de 3 tramos:
     - **$\le 0\text{ dB}$**: Gradiente hacia verde suave (`#004411` progresando a verde brillante `#00ff88` en la marca de 0 dB).
     - **$> 0\text{ dB}$**: Transición inmediata de amarillo brillante (`#facc15`) a rojo intenso (`#ef4444` en la marca de +10 dB).
   - Esto proporcionará una referencia visual perfecta e instantánea para evitar la saturación analógica/digital y nivelar a 0 dB.

---

## 🔍 Sincronización Bidireccional de la Simulación de EQ (Pill + Panel de Control)

Para garantizar un control coherente y evitar estados desfasados, la simulación de EQ (curva cian punteada) operará de forma paralela en el panel de control lateral y en la barra superior de los cuadrantes mediante **sincronización bidireccional reactiva**:

### 1. El Estado Central (`uiStore.isSimulating`)
- Este booleano continuará gobernando si la curva de predicción matemática se calcula y dibuja en pantalla.
- La simulación estará **desactivada por defecto** al iniciar el sistema.

### 2. Flujo de Sincronización en Paralelo:
- **Acción A: Activación desde el Panel Lateral de EQ**:
  - Al presionar el botón de simulación en el panel lateral de ecualización, se establece `uiStore.isSimulating = true`.
  - Reactivamente, el componente `Quadrant.svelte` detectará este cambio de estado y **añadirá automáticamente** la métrica `"Simulated Magnitude"` a su array `activeMetrics` de forma silenciosa.
  - Esto provocará que el pill de *"Simulated Magnitude"* aparezca inmediatamente en la cabecera del cuadrante.
- **Acción B: Adición desde el menú "+ Métrica" del Cuadrante**:
  - Al abrir el dropdown en la cabecera del cuadrante y seleccionar *"Simulated Magnitude"*, se añade al array `activeMetrics`.
  - Reactivamente, el cuadrante forzará `uiStore.isSimulating = true`.
  - Esto causará que el botón de simulación en el panel lateral de EQ **se encienda automáticamente** para reflejar la activación.
- **Acción C: Desactivación por cualquiera de las vías**:
  - Si el usuario presiona el botón de **eliminar (papelera)** en el pill de *"Simulated Magnitude"* en la cabecera, o apaga el botón en el panel lateral de EQ:
    - Se establece `uiStore.isSimulating = false`.
    - Se remueve `"Simulated Magnitude"` del listado `activeMetrics`.
    - Ambas interfaces (el panel lateral y la barra del cuadrante) se actualizan en paralelo para reflejar el estado apagado y la curva cian punteada se oculta del canvas.

### 3. Mecanismo Técnico de Implementación (Svelte 5 Runes)
Utilizaremos un `$effect` reactivo en `Quadrant.svelte` para enlazar bidireccionalmente el array con la variable global:
```typescript
// Sincronizar el array de métricas activas con el estado global de simulación
$effect(() => {
    const isSimulatingGlobal = uiStore.isSimulating;
    const hasPill = activeMetrics.includes("Simulated Magnitude");
    
    if (isSimulatingGlobal && !hasPill) {
        activeMetrics.push("Simulated Magnitude");
    } else if (!isSimulatingGlobal && hasPill) {
        activeMetrics = activeMetrics.filter(m => m !== "Simulated Magnitude");
    }
});

// Al modificar localmente activeMetrics mediante adición/borrado, actualiza el store
$effect(() => {
    const hasPill = activeMetrics.includes("Simulated Magnitude");
    if (hasPill !== uiStore.isSimulating) {
        uiStore.isSimulating = hasPill;
    }
});
```

---

## 🔍 Mejoras Avanzadas para el Espectrograma 2D

Para maximizar el valor de análisis del espectrograma, se realizarán las siguientes modificaciones:

1. **Cuadrícula de Referencia Activa**:
   - No se removerán las líneas de la grilla de ejes X/Y cuando el espectrograma esté en pantalla.
   - Las líneas de la cuadrícula se dibujarán **por encima del espectrograma** usando un color contrastante semitransparente (ej. `#1a1a24` con trazo sutil) para que el usuario siempre mantenga la escala de referencia visual de frecuencias y amplitud.
2. **Tooltip Interactivo al Hover**:
   - Al pasar el puntero del mouse sobre el lienzo del espectrograma, se detectará la posición `x` e `y`.
   - Se transformará la coordenada `x` en frecuencia logarítmica y la coordenada `y` en tiempo histórico (en segundos transcurridos hacia atrás).
   - Buscaremos el valor en dB en el búfer histórico del espectrograma correspondiente y se mostrará un tooltip flotante junto al cursor con el formato: `Frecuencia (Hz) | Tiempo (s) | Nivel (dB)`.
3. **Eje Y Secundario (Historial de Tiempo)**:
   - En el lateral derecho del cuadrante, cuando el espectrograma esté activo, se dibujará un eje Y secundario.
   - Mostrará la escala de tiempo transcurrido desde `0s` (tiempo actual, parte inferior del espectrograma) hasta `-N s` (límite del historial, parte superior del espectrograma), permitiendo correlacionar visualmente eventos acústicos en el tiempo.

---

## 📈 Plan de Verificación

### Pruebas de Fluidez y Calibración
1. **Verificación de Vúmetros**: Confirmar que los vúmetros IN/OUT reaccionan sin latencia ni saltos (60 actualizaciones por segundo) impulsados por los cálculos del módulo de procesamiento. Verificar que al inyectar una señal de 0 dB el indicador llega exactamente a la zona de transición verde-amarillo, y que al superar 0 dB se pinta en tonos rojos.
2. **Sincronización de Simulación en Paralelo**:
   - Iniciar con simulación apagada.
   - Activar la simulación desde el panel lateral y constatar que aparece inmediatamente el pill "Simulated Magnitude" en la cabecera.
   - Agregar "Simulated Magnitude" desde el dropdown de un cuadrante y confirmar que el botón del panel lateral se enciende.
   - Hacer clic en la papelera del pill y verificar que se apaga el botón del panel lateral y desaparece la línea cian punteada.
3. **Espectrograma y Grilla**: Validar que la cuadrícula de frecuencias se superpone correctamente al fondo dinámico del espectrograma.
4. **Lectura de Tooltip**: Mover el cursor sobre el espectrograma y constatar que se lee el valor de dB real correspondiente a la frecuencia bajo el puntero.
5. **Eje Y Secundario**: Verificar que el eje derecho muestra la escala de tiempo en segundos (ej. `0s`, `-2s`, `-4s`).
6. **Zoom y Alineación**: Validar que el zoom se limita y que el slider de desplazamiento visual alinea las curvas.
