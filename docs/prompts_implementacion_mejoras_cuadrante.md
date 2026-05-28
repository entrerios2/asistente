# Prompts de Instrucciones de Implementación: Mejoras UI de Cuadrantes, Vúmetros e Interpolarización

Este documento contiene un conjunto de **instrucciones estructuradas paso a paso (prompts)** altamente específicos y detallados para que un agente de IA externo implemente el rediseño gráfico, la paridad con Open Sound Meter (OSM) y la optimización de visualización en los archivos de la aplicación. 

---

## 📋 Directivas Globales para el Agente Implementador
1. **Svelte 5 Runes**: Asegúrate de usar la sintaxis nativa de Svelte 5 (`$state`, `$derived`, `$effect`, y directivas de evento actualizadas como `onclick` o `onchange` en lugar de `on:click`).
2. **Sin placeholders ni simplificaciones**: Escribe el código completo con lógica matemática robusta.
3. **No utilizar transparencias ni filtros `blur`**: Utiliza colores opacos sólidos (`#HEX` o `rgb`) para todos los menús flotantes, popovers y dropdowns para no degradar los FPS de renderizado del canvas.
4. **Verificar Compilación**: El servidor de desarrollo ya está corriendo en el proyecto (`npm run dev`). Cualquier error de sintaxis o tipo TypeScript debe ser corregido inmediatamente.

---

## 🛠️ Prompt 1: Corrección de Vúmetros y Consolidación en el DSP (MathOrchestrator)

**Objetivo**: Corregir el bug que hace que el vúmetro de entrada (IN) vaya lento/a saltos y rediseñar ambos vúmetros para ayudar al usuario a calibrar sus niveles a 0 dB en un rango de -60 dB a +10 dB.

### 📥 Archivos a Modificar:
1. `src/lib/hal/web/WebAudioProvider.ts`
2. `src/lib/stores/mathOrchestrator.svelte.ts`
3. `src/components/medicion/Header.svelte`

### 📝 Instrucciones Específicas:

#### Paso 1.1: Limpiar la capa de hardware en `WebAudioProvider.ts`
1. Abre [WebAudioProvider.ts](file:///C:/Users/Abel/Documents/Asistente/asistente/src/lib/hal/web/WebAudioProvider.ts).
2. Localiza en la función `readData` (líneas 73-81) el cálculo obsoleto que lee los índices `0..127` de `this.sharedArray`.
3. **Elimina** por completo esa porción de cálculo para liberar de cómputo inútil al bucle de captura y evitar escrituras de niveles desfasados en `meterStore`. El proveedor de audio debe quedar puramente como una interfaz de captura.

#### Paso 1.2: Implementar el cálculo de nivel en `mathOrchestrator.svelte.ts`
1. Abre [mathOrchestrator.svelte.ts](file:///C:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts).
2. Dentro del método `run(liveTrace: Trace | undefined)`, implementa el cálculo de nivel RMS y Pico para el canal de entrada a partir del buffer `fftInputReal` y `fftInputImag` (o directamente del buffer de señal temporal si está disponible). 
3. Específicamente, calcula el valor pico absoluto del bloque de frecuencia y escala a decibelios de la siguiente manera:
   ```typescript
   // Calcular el valor RMS o Peak del espectro
   let peakSum = 0;
   for (let k = 0; k < this.BINS; k++) {
       const mag = Math.sqrt(this.fftInputReal[k] * this.fftInputReal[k] + this.fftInputImag[k] * this.fftInputImag[k]);
       if (mag > peakSum) peakSum = mag;
   }
   const dbIn = 20 * Math.log10(peakSum || 1e-6);
   
   // Actualizar el meterStore con los niveles del bloque actual procesado
   import { meterStore } from './meterStore.svelte';
   meterStore.updateIn([dbIn, dbIn]);
   ```
4. Asegúrate de hacer lo mismo para el generador (Out): el valor se actualiza en `updateOut` usando el `level` activo del generador en `playGenerator()`.

#### Paso 1.3: Rediseñar los Vúmetros en `Header.svelte`
1. Abre [Header.svelte](file:///C:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte).
2. Modifica la función `getVuWidth(db: number)` para cambiar la escala del vúmetro. Ahora debe ir desde **-60 dB hasta +10 dB** (un ancho total de 70 dB):
   ```typescript
   function getVuWidth(db: number) {
       // Escala de -60 dB a +10 dB: 0% a 100% de la barra
       return Math.max(0, Math.min(100, (db + 60) * (100 / 70)));
   }
   ```
3. Modifica los estilos del archivo (`<style>`) para crear un gradiente de calibración continuo sin transparencias:
   - Para la barra de entrada (`.vu-fill.in`):
     ```css
     .vu-fill.in {
         background: linear-gradient(90deg, 
             #004411 0%, 
             #00ff88 85.7%,   /* 85.7% representa exactamente 0 dB en el rango de 70 dB */
             #facc15 87%, 
             #ef4444 100%
         );
     }
     ```
   - Para la barra de salida (`.vu-fill.out`):
     ```css
     .vu-fill.out {
         background: linear-gradient(90deg, 
             #004411 0%, 
             #00ff88 85.7%, 
             #facc15 87%, 
             #ef4444 100%
         );
     }
     ```
   - Asegúrate de remover efectos de sombra o gradientes con opacidad para máximo rendimiento.

---

## 🛠️ Prompt 2: Optimización de Alta Resolución en el Eje X ( frequencyLUT & Path2D )

**Objetivo**: Reemplazar la iteración multiplicativa simplificada en el eje X del canvas por una proyección logarítmica exacta de 1 píxel de resolución horizontal, precalculando una Lookup Table (LUT) para evitar operaciones matemáticas costosas y usando `Path2D` para mitigar el overhead del puente JS-Native de Chrome.

### 📥 Archivos a Modificar:
1. `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones Específicas:

#### Paso 2.1: Definir la LUT reactiva y el Downsampling
1. Abre [Quadrant.svelte](file:///C:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte).
2. Declara un buffer tipado `Int32Array` reactivo para almacenar el mapeo logarítmico píxel a píxel del eje X:
   ```typescript
   let frequencyLUT = $state<Int32Array>(new Int32Array(0));
   ```
3. Implementa una función `rebuildFrequencyLUT(width: number)` que se dispare mediante un `$effect` únicamente cuando cambie `containerWidth`, `scaleX` o `offsetX`:
   ```typescript
   function rebuildFrequencyLUT(width: number) {
       if (width <= 0) return;
       const lut = new Int32Array(Math.round(width));
       const logMin = Math.log10(freqMin);
       const logMax = Math.log10(freqMax);
       const binWidth = 24000 / BINS; // 48000 Hz / 2 / BINS

       for (let x = 0; x < width; x++) {
           // Calcular frecuencia logarítmica correspondiente al píxel X
           const adjustedX = (x - offsetX) / scaleX;
           const logFreq = (adjustedX / width) * (logMax - logMin) + logMin;
           const freq = Math.pow(10, logFreq);
           
           // Mapear al bin FFT correspondiente
           const binIndex = Math.max(0, Math.min(BINS - 1, Math.round(freq / binWidth)));
           lut[x] = binIndex;
       }
       frequencyLUT = lut;
   }

   $effect(() => {
       rebuildFrequencyLUT(containerWidth);
   });
   ```

#### Paso 2.2: Implementar el dibujado optimizado con `Path2D` y la LUT
1. Modifica la función de renderizado de curvas `drawMetricPath` para que en lugar de usar un bucle multiplicativo de frecuencia `f *= 1.03`, dibuje iterando a través de los píxeles físicos del ancho del canvas y leyendo de la `frequencyLUT`:
   ```typescript
   function drawMetricPath(
       ctx: CanvasRenderingContext2D,
       dataArray: Float32Array,
       width: number,
       height: number,
       color: string,
       lw: number,
       lineDash: number[],
       metricType: string
   ) {
       if (frequencyLUT.length === 0) return;

       ctx.strokeStyle = color;
       ctx.lineWidth = lw;
       ctx.setLineDash(lineDash || []);
       
       // Crear objeto Path2D
       const path = new Path2D();
       let first = true;

       for (let x = 0; x < width; x++) {
           const binIndex = frequencyLUT[x];
           if (binIndex === undefined) continue;

           const val = dataArray[binIndex];
           const y = valToY(val, height, metricType);

           if (first) {
               path.moveTo(x, y);
               first = false;
           } else {
               path.lineTo(x, y);
           }
       }

       ctx.stroke(path);
       ctx.setLineDash([]);
   }
   ```
2. Asegúrate de hacer una adaptación similar en el renderizado de la curva de fase (`Phase`), manteniendo la lógica de detección de saltos circulares abruptos (discontinuidad de envoltura de fase) para no unir líneas verticales espurias de +180 a -180 grados:
   ```typescript
   // En el bucle de Phase:
   const val = dataArray[binIndex];
   const y = valToY(val, height, "Phase");
   if (first) {
       path.moveTo(x, y);
       first = false;
   } else {
       if (Math.abs(y - lastY) > height * 0.65) {
           path.moveTo(x, y); // Salto circular sin dibujar línea vertical de descarte
       } else {
           path.lineTo(x, y);
       }
   }
   lastY = y;
   ```

---

## 🛠️ Prompt 3: Interpolación Temporal Lineal Continua (Evitar Saltos)

**Objetivo**: Reemplazar la interpolación exponencial discontinua (que congela el gráfico periódicamente y genera saltos en el flujo del RTA) por una interpolación lineal suave sincronizada con el timestamp real de ejecución de la FFT en el DSP.

### 📥 Archivos a Modificar:
1. `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones Específicas:

#### Paso 3.1: Almacenar buffers históricos para transición
1. Declara buffers históricos en `Quadrant.svelte` para guardar los estados de las curvas calculadas en el frame anterior:
   ```typescript
   const prevMagnitude = new Float32Array(BINS);
   const prevPhase = new Float32Array(BINS);
   const prevCoherence = new Float32Array(BINS);
   const prevGroupDelay = new Float32Array(BINS);
   ```

#### Paso 3.2: Implementar interpolación basada en tiempo transcurrido
1. En cada frame de la función `draw()` (que se ejecuta a 60 FPS mediante el loop animado de canvas):
   - Calcula el factor temporal normalizado $t$ respecto al momento en que ocurrió la última actualización matemática en el DSP (`mathOrchestrator.lastMathTime`):
     ```typescript
     const now = performance.now();
     const throttleMs = mathOrchestrator.throttleMs;
     const timeElapsed = now - mathOrchestrator.lastMathTime;
     const t = Math.max(0, Math.min(1.0, timeElapsed / throttleMs)); // factor de 0.0 a 1.0
     ```
   - Genera el buffer de renderizado interpolado de manera lineal entre `prev` y `output` usando $t$:
     ```typescript
     for (let i = 0; i < BINS; i++) {
         interpMagnitude[i] = prevMagnitude[i] * (1 - t) + mathOrchestrator.outputMagnitude[i] * t;
         interpPhase[i] = prevPhase[i] * (1 - t) + mathOrchestrator.outputPhase[i] * t;
         interpCoherence[i] = prevCoherence[i] * (1 - t) + mathOrchestrator.outputCoherence[i] * t;
         interpGroupDelay[i] = prevGroupDelay[i] * (1 - t) + mathOrchestrator.outputGroupDelay[i] * t;
     }
     ```
   - Al finalizar un cálculo del DSP (detectado porque `mathOrchestrator.version` se incrementó), actualiza los buffers `prev` con los valores que acaban de expirar:
     ```typescript
     let lastVersion = 0;
     $effect(() => {
         const currentVersion = mathOrchestrator.version;
         if (currentVersion !== lastVersion) {
             lastVersion = currentVersion;
             // Copiar estado actual a previos para el inicio de la nueva transición
             prevMagnitude.set(interpMagnitude);
             prevPhase.set(interpPhase);
             prevCoherence.set(interpCoherence);
             prevGroupDelay.set(interpGroupDelay);
         }
     });
     ```
2. Esto asegura que la curva siempre fluya a 60 FPS con perfecta linealidad temporal, eliminando el stuttering acústico de raíz.

---

## 🛠️ Prompt 4: Sincronización Bidireccional de la Simulación de EQ (Pill + Panel de Control)

**Objetivo**: Tratar a "Simulated Magnitude" como una métrica de pleno derecho. Si se activa desde el panel lateral, aparece el pill en el cuadrante. Si se agrega el pill del cuadrante, se enciende la simulación en el panel lateral. Si se elimina con la papelera, se desactiva todo.

### 📥 Archivos a Modificar:
1. `src/components/medicion/Quadrant.svelte`
2. `src/lib/stores/ui.svelte.ts` (asegúrate de que `isSimulating` inicie en `false` por defecto)

### 📝 Instrucciones Específicas:

#### Paso 4.1: Añadir "Simulated Magnitude" a las métricas del cuadrante
1. En `Quadrant.svelte`, localiza la lista `allMetrics` e introduce la nueva métrica:
   ```typescript
   {
       name: "Simulated Magnitude",
       type: "frequency",
       color: "#00ffff", // Color cian característico
       label: "Magnitud Simulada (EQ)",
   }
   ```
2. Asegúrate de configurar la simulación de EQ para que se dibuje únicamente cuando `"Simulated Magnitude"` esté activa en el array `activeMetrics`.

#### Paso 4.2: Implementar la sincronización bidireccional reactiva
1. En el script de `Quadrant.svelte`, añade los siguientes efectos reactivos de Svelte 5 para enlazar `activeMetrics` y `uiStore.isSimulating`:
   ```typescript
   // Sincronización desde el panel lateral hacia el cuadrante
   $effect(() => {
       const isSimulatingGlobal = uiStore.isSimulating;
       const hasPill = activeMetrics.includes("Simulated Magnitude");
       
       if (isSimulatingGlobal && !hasPill) {
           activeMetrics.push("Simulated Magnitude");
       } else if (!isSimulatingGlobal && hasPill) {
           activeMetrics = activeMetrics.filter(m => m !== "Simulated Magnitude");
       }
   });

   // Sincronización desde el cuadrante hacia el panel lateral
   $effect(() => {
       const hasPill = activeMetrics.includes("Simulated Magnitude");
       if (hasPill !== uiStore.isSimulating) {
           uiStore.isSimulating = hasPill;
       }
   });
   ```
2. Al eliminar el pill presionando el icono de la papelera en la barra superior del cuadrante, esto removerá `"Simulated Magnitude"` de `activeMetrics`, lo que a su vez apagará reactivamente `uiStore.isSimulating = false` y apagará el botón correspondiente del panel de control lateral.

---

## 🛠️ Prompt 5: Rediseño Premium de la Cabecera de Cuadrante (Paridad OSM)

**Objetivo**: Eliminar la ventana global flotante de configuración y reestructurar la barra del cuadrante. Añadir el botón "+ Métrica" (dropdown), los pills dinámicos (con configuración individual de OSM e icono de papelera) y conservar el popover de engranaje global únicamente para FPS (slider 0.5 a 60, default 10) y suavizado.

### 📥 Archivos a Modificar:
1. `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones Específicas:

#### Paso 5.1: Modificar la cabecera HTML y los Pills
1. Remueve la clase `.selector-popover` vieja y su listado de checks.
2. Añade en la parte superior la estructura de cabecera que muestra el ID del cuadrante de forma numérica (ej. `{id}` en lugar de `Q{id}`):
   ```html
   <span class="quadrant-id font-bold text-[14px] text-emerald-400">{id}</span>
   ```
3. Añade el botón "+ Métrica" y su dropdown correspondiente, que se renderiza de forma opaca y sólida sin blur:
   - Fondo: `#0d0d12`
   - Borde: `1px solid #222`
4. Renderiza las métricas activas como pills interactivos. Cada pill debe llevar:
   - El nombre de la métrica.
   - Un botón de configuración (icono `tune` de google material icons).
   - Un botón de borrado con **icono de papelera** (`delete`).

#### Paso 5.2: Implementar el Popover de Configuración de OSM por Métrica
1. Cuando se pulsa `tune` en un pill, define `activeConfigMetric = m.name`.
2. Dibuja un diálogo flotante opaco que contenga los controles exactos descubiertos en el código de OSM:
   - **Para Magnitude / Spectrum**:
     - Modo Y (`dB`, `Linear`, `Impedance`).
     - Input de resistencia de sensor (visible con `Impedance`).
     - Selector de octava de suavizado PPO (`1`, `3`, `6`, `12`, `24`, `48`).
     - Checkbox para invertir el eje Y.
     - Checkbox para activar coherencia y deslizador de umbral de coherencia (`0.0` a `1.0`).
     - Deslizador de **Desplazamiento Visual Eje Y (`yShift`)** (rango `-300` a `300` píxeles, default `0`).
   - **Para Phase**:
     - Selector de envoltura (`±180º` o `0..360º`).
     - Ángulo de rotación de fase (`rotate`: -360 a 360).
     - Rango angular (`range`).
   - **Para Coherencia**:
     - Tipo de valor (`normal`, `squared`, `SNR`).
     - Casilla para mostrar línea de umbral horizontal, su color y su valor.
3. Asegúrate de integrar la propiedad `yShift` de forma reactiva en el trazado:
   ```typescript
   const y = valToY(val, height, metricType) + (metricConfigs[metricType]?.yShift || 0);
   ```

#### Paso 5.3: Ajustar el Popover Global de Engranaje
1. El engranaje global de la derecha ahora solo controla variables generales:
   - **FPS de visualización**: Utiliza un control deslizante `<input type="range">` de **0.5 a 60 FPS**, paso 1, por defecto en **10 FPS**.
   - **Suavizado global**.
   - **Límites de Zoom de seguridad (In / Out)**.

---

## 🛠️ Prompt 6: Características Avanzadas del Espectrograma 2D

**Objetivo**: Dibujar la cuadrícula de los ejes sobre el espectrograma en lugar de removerla, mostrar la escala de tiempo transcurrido (eje Y derecho secundario) e implementar lectura de dB por hover tooltip.

### 📥 Archivos a Modificar:
1. `src/components/medicion/Quadrant.svelte`

### 📝 Instrucciones Específicas:

#### Paso 6.1: Conservar la cuadrícula
1. Asegúrate de que la función `drawGrid(ctx, width, height)` se ejecute **después** o **encima** de la llamada a `drawSpectrogram(...)`.
2. Las líneas de la cuadrícula deben pintarse con un trazo semitransparente sutil (ej: `rgba(255, 255, 255, 0.08)`) para que sean legibles sobre el fondo de colores del espectrograma.

#### Paso 6.2: Implementar el eje Y secundario (Historial de Tiempo)
1. Si el espectrograma está activo, dibuja en el extremo derecho del canvas una escala vertical de tiempo transcurrido (desde `0s` en la base hasta el límite del historial del buffer `-10s` o `-N s` en la cima).
2. Pinta las etiquetas de tiempo (ej. `0s`, `-2.5s`, `-5s`, `-7.5s`, `-10s`) alineadas al eje Y secundario con color opaco claro `#888`.

#### Paso 6.3: Implementar hover tooltip con lectura en dB
1. Registra el evento de movimiento del ratón (`onmousemove`) sobre el canvas del cuadrante.
2. Si el espectrograma está activo, lee la coordenada `x` e `y` del cursor:
   - Convierte `x` a frecuencia logarítmica (`xToVal`).
   - Convierte `y` a línea de historial del buffer del espectrograma (ej: `const historyLine = Math.floor((y / height) * maxHistory)`).
   - Lee el valor dB de esa frecuencia y momento histórico.
3. Dibuja un tooltip flotante (un elemento `div` absoluto en HTML o pintado directamente en el canvas) que siga al cursor y muestre los datos en tiempo real:
   ```typescript
   const text = `${freq.toFixed(1)} Hz | ${time.toFixed(1)}s | ${db.toFixed(1)} dB`;
   ```
4. Oculta el tooltip al dispararse el evento `onmouseleave` del cuadrante.
