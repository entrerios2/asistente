# Plan de Implementación Maestro: Fase 2A.3 - Rediseño Profesional y Optimización DSP

Este documento constituye la especificación técnica final y exhaustiva. Se han reintegrado todos los detalles textuales definidos para cada panel, asegurando que no haya pérdida de información ni simplificaciones.

## 1. Arquitectura del Sidebar y Navegación
**Orden de pestañas e Iconografía:**
1.  **Medición:** Icono `cadence`.
2.  **Ecualización:** Icono `instant_mix`.
3.  **Instantáneas:** Icono `screenshot_frame_2` (Aquí se gestionan todas las capturas y snapshots).
4.  **Configuración:** Icono `settings`.

---

## 2. Panel de Medición (Manual y Secuencial)
### Estructura y Feedback
- **Selector de Modo:** Switch interno para elegir entre **Manual** y **Secuencial**.
- **Footer Anclado:** Botón principal **"Medir / Detener"** con icono `podcast`.
    - **Modo Secuencial:** El botón se transforma en una **barra de progreso** visual durante la captura.
    - **Texto de Estado (debajo del botón):** Muestra "Generando secuencia", "Recibiendo", "Error", "Completado" o "Esperando señal offline".

### 2.1. Sección: Medición Manual
- **Generador:** 
    - Dropdown para elegir señal: Ruido (Rosa, Blanco, Brown, Music-noise), Seno continuo, Sweep logarítmico (Farina), Burst, SinBurst, MLS+.
    - **Opciones dinámicas:** Panel que cambia según la señal (Frecuencia para Seno, duración para Burst, etc.).
    - **Nivel:** Slider horizontal centrado en 0 dB por defecto.
    - **Acción:** Botón de generar/detener con iconos `volume_up` / `volume_mute`.
- **Retardo:**
    - Botones de **"Calcular"** y **"Usar"**. Cuadro de texto para ingreso manual del valor calculado o manual.

### 2.2. Sección: Medición Secuencial
- **Generación:** El buffer de audio o FLAC se genera en segundo plano y se guarda en caché apenas el usuario toca un preset o segmento, eliminando esperas.
- **Presets:** Selector de configuraciones guardadas.
- **Tasa de Muestreo:** Dropdown con 44.1, 48, 96, 192 kHz (Default: tasa del sistema).
- **Segmentos de Medición:** 
    - Debido al espacio reducido, se usará una **única columna** que agrupe el **Checkbox y el Nombre completo** del segmento.
    - A medida que se vayan obteniendo resultados (primero preliminares y luego finales), se irán agregando y visualizando estos detalles y métricas dinámicamente debajo del checkbox y del nombre del segmento correspondiente.
    - Tooltips con explicación concisa de qué mide cada segmento.
- **Modo Offline:** Botón **"Descargar"** (selector WAV/FLAC) anclado al fondo cuando el switch offline está activo.

---

## 3. Panel de Ecualización
### Controles Globales
- **Switch "Mostrar Ecualización":** Muestra u oculta la curva resultante en el gráfico.
- **Botón "Calcular Ecualización":** Aplica AutoEQ sobre el snapshot actual o la medición en vivo y actualiza los valores del ecualizador automáticamente.
- **Botón "Simular / Detener simulación" (Anclado al fondo):** Botón de estado.
    - Si se aplica sobre un **snapshot**, ejecuta y fija la simulación de ecualización.
    - Si se está en **vivo**, enciende o apaga la simulación predictiva en tiempo real sobre el flujo entrante.

### 3.1. Tipos de Ecualizador (Dropdown "Tipo")
- **Modo Gráfico:**
    - Selección de cantidad de bandas.
    - Panel con un **slider horizontal por banda**.
    - Etiqueta con la frecuencia de cada banda.
    - **Doble clic** en el slider para resetear a 0 dB.
    - Cuadro de texto para ingreso manual de ganancia de la banda.
- **Modo Paramétrico:**
    - Selección de cantidad de filtros/polos.
    - Panel individual por cada filtro.
    - **Botón de Configuración:** Abre un selector interactivo basado en una lista de checkboxes (o equivalente moderno) para seleccionar qué tipo de filtro tiene activado cada polo (Paso alto, paso bajo, campana, shelving, notch, paso de banda).
    - Selector de tipo de filtro activo y controles de **Frecuencia, Ganancia y Q** adaptados según el tipo.
- **Modo Control de Tono:** Controles de 3 vías: **Graves / Medios / Agudos**.

---

## 4. Panel de Configuración
### 4.1. Audio (Hardware)
- **Entrada:** Dropdown de dispositivos disponibles.
- **Canales de Entrada:** Checkboxes para selección individual de canales.
- **Referencia:** Dropdown para elegir el canal de referencia (Medición Manual).
- **Loopback:** Opción para usar Loopback interno como referencia.
- **Salida:** Dropdown de dispositivos y checkboxes de selección de canales de salida.

### 4.2. Pantalla y Sistema
- **Grilla:** Selección de configuraciones con botones de preset (hasta 2 columnas y 3 filas). **Modo inicial por defecto: 1x1.**
- **Modo Oscuro:** Switch de activación global.
- **Persistencia:** Todo el estado de la UI y hardware se guarda en `localStorage`.

---

## 5. Cabecera (Header) y Cuadrantes
### 5.1. Topbar (Accesos Rápidos)
- **Vúmetros:** Barras apiladas (Entrada arriba, Salida abajo). Clic abre pestaña de **Configuración**.
  - **Indicador de Igualación:** Cuando el generador esté activo, mostrar un indicador visual integrado en los vúmetros que señale si el nivel de entrada y salida están igualados (calibrados/emparejados).
- **Control Rápido de Generador:** Botón `volume_up`/`volume_mute` + etiqueta de tipo activo. Clic en la etiqueta abre **Medición Manual**.
- **Control Rápido de Medición:** 
    - Icono del modo actual (Manual/Secuencial). Clic abre el panel de **Medición**.
    - Botón "Medir" con icono `podcasts`.
- **Selector de Grilla Visual:** Menú desplegable estilo Word (cuadros pintables) hasta 2x3. Valor inicial: **1x1**.

### 5.2. Cuadrantes Dinámicos
- **Render:** `ResizeObserver` para evitar pixelado y overflow. Canvas al 100%.
- **Interacción:** Pan (drag) y Zoom (wheel/pinch).
- **Popover:** Título con métricas activas, icono de configuración, resaltado del cuadrante activo y selección de múltiples métricas compatibles (OSM style).

---

## 6. Especificaciones de Señales del Generador
A continuación se detalla la física, propósito y pseudo-código de cada señal de estimulación acústica:

### 6.1. Ruido Blanco (White Noise)
- **Física/Propósito:** Señal aleatoria con densidad espectral de potencia constante. Contiene la misma energía por unidad de ancho de banda (por Hz) a lo largo de todo el espectro. Ideal para analizar la respuesta acústica bruta o excitar filtros con distribución estadística homogénea.
- **Pseudo-código:**
  ```javascript
  // Genera un valor flotante aleatorio acotado entre -1.0 y 1.0 para cada muestra
  function generateWhiteNoiseSample() {
      return Math.random() * 2.0 - 1.0;
  }
  ```

### 6.2. Ruido Rosa (Pink Noise)
- **Física/Propósito:** Señal con densidad espectral inversamente proporcional a la frecuencia ($1/f$, caída de 3 dB por octava). Posee la misma cantidad de energía por banda de octava (ej. la banda de 100 a 200 Hz tiene la misma energía que la de 10 a 20 kHz). Es el estándar acústico preferido para ecualización de salas ya que se asemeja a la respuesta logarítmica del oído humano.
- **Pseudo-código (Algoritmo de Voss-McCartney de 6 polos):**
  ```javascript
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  function generatePinkNoiseSample() {
      const white = Math.random() * 2.0 - 1.0;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      return pink * 0.11; // Atenuación para evitar clipping
  }
  ```

### 6.3. Ruido Marrón (Brown Noise)
- **Física/Propósito:** Densidad espectral proporcional a $1/f^2$ (caída de 6 dB por octava). Simula el movimiento browniano (ruido rojo/filtrado acumulador). Posee mucha energía en bajas frecuencias y decae abruptamente en las frecuencias altas, produciendo un sonido cálido y amortiguado.
- **Pseudo-código:**
  ```javascript
  let lastOut = 0.0;
  function generateBrownNoiseSample() {
      const white = Math.random() * 2.0 - 1.0;
      // Integración con fugas para evitar deriva de continua
      const brown = (lastOut + (0.02 * white)) / 1.02;
      lastOut = brown;
      return brown * 3.5; // Compensación de ganancia
  }
  ```

### 6.4. Music-noise (Ruido Ponderado de Música)
- **Física/Propósito:** Ruido calibrado para simular la envolvente espectral promedio del material musical comercial (con una curva de atenuación pronunciada en frecuencias altas y medias, según especificaciones como la EIA-426-B). Permite probar amplificadores y altavoces bajo condiciones de estrés dinámico similares a la música real.
- **Pseudo-código (Ruido Rosa + Filtro de paso banda específico):**
  ```javascript
  // Pasa el ruido rosa por un filtro paso alto a 40Hz y un filtro de caída de agudos de segundo orden a 5kHz
  function generateMusicNoiseSample(pinkSample) {
      // Coeficientes simplificados de un filtro EIA-426-B
      // Simula el filtrado paso banda sobre la muestra de ruido rosa
      return applyMusicFilter(pinkSample);
  }
  ```

### 6.5. Seno Continuo (Continuous Sine)
- **Física/Propósito:** Tono puro de frecuencia única constante. Permite realizar análisis de distorsión armónica (THD), búsqueda de resonancias mecánicas y calibración de niveles absolutos de tensión/SPL.
- **Pseudo-código:**
  ```javascript
  let phase = 0.0;
  function generateSineSample(freq, sampleRate) {
      const phaseStep = (2.0 * Math.PI * freq) / sampleRate;
      const sample = Math.sin(phase);
      phase += phaseStep;
      if (phase >= 2.0 * Math.PI) phase -= 2.0 * Math.PI;
      return sample;
  }
  ```

### 6.6. Sweep Logarítmico (Farina Sweep)
- **Física/Propósito:** Barrido sinusoidal exponencial cuya frecuencia aumenta logarítmicamente desde $f_1$ hasta $f_2$ a lo largo de una duración $T$. Es el estándar científico moderno para medición electroacústica ya que permite, mediante deconvolución con la señal inversa del sweep, extraer de forma exacta y por separado la respuesta al impulso lineal y la distorsión armónica individual por armónicos.
- **Pseudo-código (Generación analítica pura):**
  ```javascript
  function generateLogSweepBuffer(f1, f2, duration, sampleRate) {
      const numSamples = Math.round(duration * sampleRate);
      const buffer = new Float32Array(numSamples);
      const L = duration / Math.log(f2 / f1);
      for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          // Fase acumulada para crecimiento exponencial
          buffer[i] = Math.sin(2.0 * Math.PI * f1 * L * (Math.exp(t / L) - 1.0));
      }
      return buffer;
  }
  ```

### 6.7. Burst (Ráfaga de Tono)
- **Física/Propósito:** Un fragmento breve de tono sinusoidal de frecuencia $f_0$ encendido durante un número exacto de ciclos o milisegundos, rodeado de silencio. Se usa para analizar el decaimiento de reflexiones, tiempos de llegada acústicos y comportamiento dinámico temporal de los transductores.
- **Pseudo-código:**
  ```javascript
  function generateBurstSample(t, freq, burstStart, burstDuration, sampleRate) {
      if (t >= burstStart && t < (burstStart + burstDuration)) {
          return Math.sin(2.0 * Math.PI * freq * t);
      }
      return 0.0; // Silencio fuera de la ventana
  }
  ```

### 6.8. SinBurst (Ráfaga con Ventana)
- **Física/Propósito:** Idéntico al Burst convencional, pero aplicando una ventana de atenuación suave (ej. Hann o coseno) en el inicio y final de la ráfaga. Esto elimina el click de alta frecuencia producido por la discontinuidad abrupta del encendido/apagado, confinando el espectro exclusivamente alrededor de la frecuencia fundamental de prueba.
- **Pseudo-código:**
  ```javascript
  function generateWindowedBurstSample(t, freq, start, duration, sampleRate) {
      if (t >= start && t < (start + duration)) {
          const relativeT = (t - start) / duration;
          // Ventana de Hann (0.0 a 1.0 y vuelta a 0.0)
          const window = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * relativeT));
          return Math.sin(2.0 * Math.PI * freq * t) * window;
      }
      return 0.0;
  }
  ```

### 6.9. MLS+ (Secuencia de Longitud Máxima Modificada)
- **Física/Propósito:** Señal pseudo-aleatoria periódica binaria basada en registros de desplazamiento de retroalimentación lineal (LFSR). Posee una autocorrelación que aproxima una función delta de Dirac. La variante MLS+ optimiza y mitiga la influencia del ruido de fondo y la distorsión no lineal del sistema sobre la respuesta lineal calculada.
- **Pseudo-código (Generador LFSR Galois de orden N):**
  ```javascript
  function generateMLS(bits) {
      const size = (1 << bits) - 1; // 2^N - 1
      const buffer = new Float32Array(size);
      let register = 1; // Semilla distinta de cero
      const taps = getTapsForBits(bits); // Polinomio de retroalimentación
      for (let i = 0; i < size; i++) {
          const bit = register & 1;
          buffer[i] = bit ? 1.0 : -1.0;
          // Retroalimentación Galois
          register = register >>> 1;
          if (bit) register = register ^ taps;
      }
      return buffer;
  }
  ```

---

## 7. Especificación de Métricas OSM e Intercompatibilidad
Detalle exhaustivo de las métricas disponibles en el visualizador, su física de procesamiento, compatibilidad de escalas para renderizado simultáneo en un solo cuadrante, y pseudo-código.

### 7.1. Compatibilidad de Ejes (Regla de Superposición)
Para que dos o más métricas puedan ser seleccionadas y dibujadas simultáneamente en el mismo lienzo, deben compartir escalas físicas en sus ejes cartesianos:
- **Grupo Frecuencia Logarítmico (X: 20-20kHz Log, Y: Decibelios Relativos dB):** `Magnitude`, `Phase` (eje secundario en grados), `Coherence` (eje secundario 0.0 - 1.0), `Group Delay` (eje secundario en ms).
- **Grupo RTA (X: 20-20kHz Log, Y: Decibelios Absolutos dBFS):** `Spectrum` (RTA) e `Level` (Vúmetro absoluto).
- **Grupo Dominio del Tiempo (X: Tiempo ms Lineal, Y: Amplitud lineal o dB):** `Impulse` (IR) y `Step`.
- **Grupo 3D / Cascada:** `Spectrogram` (No admite superposición con trazados 2D ordinarios).
- **Grupo No Gráfico:** `Numeric` (Superponible en pantalla como HUD).

---

### 7.2. Detalle y Pseudo-código de cada Métrica

#### 1. Spectrum (Espectro RTA)
- **Física:** Magnitud espectral absoluta en tiempo real (RTA) obtenida del flujo del micrófono.
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Absoluto (-120 dBFS a +10 dBFS).
- **Compatibilidad:** `Level` (vúmetro), `Numeric` (overlay). Incompatible con métricas relativas (ej. `Magnitude`).
- **Pseudo-código:**
  ```javascript
  // Transforma el bloque temporal de entrada a frecuencia absoluta
  function calculateRTA(floatTimeData) {
      const complexData = FFT(floatTimeData);
      const spectrum = new Float32Array(complexData.length / 2);
      for (let k = 0; k < spectrum.length; k++) {
          const mag = Math.sqrt(complexData[k].real**2 + complexData[k].imag**2);
          // Normalización por el tamaño del bloque (N) y paso a dBFS
          spectrum[k] = 20 * Math.log10(mag / (floatTimeData.length / 2) + 1e-8);
      }
      return spectrum;
  }
  ```

#### 2. Magnitude (Magnitud Relativa)
- **Física:** Respuesta de magnitud en frecuencia del canal de entrada en relación con el canal de referencia (Función de transferencia).
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Relativo (-30 dB a +30 dB).
- **Compatibilidad:** `Phase`, `Coherence`, `Group Delay`.
- **Pseudo-código:**
  ```javascript
  function calculateMagnitude(fftInput, fftReference) {
      const magnitude = new Float32Array(fftInput.length);
      for (let k = 0; k < fftInput.length; k++) {
          // H(f) = Y(f) / X(f)
          const hReal = (fftInput[k].real * fftReference[k].real + fftInput[k].imag * fftReference[k].imag) / (fftReference[k].real**2 + fftReference[k].imag**2 + 1e-12);
          const hImag = (fftInput[k].imag * fftReference[k].real - fftInput[k].real * fftReference[k].imag) / (fftReference[k].real**2 + fftReference[k].imag**2 + 1e-12);
          const mag = Math.sqrt(hReal**2 + hImag**2);
          magnitude[k] = 20 * Math.log10(mag + 1e-8);
      }
      return magnitude;
  }
  ```

#### 3. Phase (Fase)
- **Física:** Fase angular de la función de transferencia, que muestra el retardo angular introducido por el sistema en cada frecuencia.
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Ángulo en grados (-180° a +180°).
- **Compatibilidad:** `Magnitude`, `Coherence`, `Group Delay`.
- **Pseudo-código:**
  ```javascript
  function calculatePhase(fftInput, fftReference) {
      const phase = new Float32Array(fftInput.length);
      for (let k = 0; k < fftInput.length; k++) {
          const hReal = (fftInput[k].real * fftReference[k].real + fftInput[k].imag * fftReference[k].imag) / (fftReference[k].real**2 + fftReference[k].imag**2 + 1e-12);
          const hImag = (fftInput[k].imag * fftReference[k].real - fftInput[k].real * fftReference[k].imag) / (fftReference[k].real**2 + fftReference[k].imag**2 + 1e-12);
          const angleRad = Math.atan2(hImag, hReal);
          phase[k] = angleRad * (180.0 / Math.PI); // Conversión a grados
      }
      return phase;
  }
  ```

#### 4. Impulse (Respuesta al Impulso - IR)
- **Física:** Caracterización temporal completa del sistema que representa su salida ante una excitación delta de Dirac instantánea. Muestra reflexiones físicas y el retardo del sistema.
- **Escalas:** X: Tiempo Lineal (ms), Y: Amplitud relativa (-1.0 a +1.0) o Energía (ETC Logarítmica dB).
- **Compatibilidad:** `Step`.
- **Pseudo-código:**
  ```javascript
  function calculateImpulseResponse(fftTransferFunction) {
      // Retorno al dominio del tiempo mediante la transformada inversa compleja
      const complexIR = IFFT(fftTransferFunction);
      const irReal = new Float32Array(complexIR.length);
      for (let i = 0; i < complexIR.length; i++) {
          irReal[i] = complexIR[i].real; // Parte real del impulso en el tiempo
      }
      return irReal;
  }
  ```

#### 5. Step (Respuesta al Escalón)
- **Física:** Integral temporal de la Respuesta al Impulso. Evalúa la coherencia de fase y la alineación temporal de los distintos transductores (ej. Tweeter/Woofer).
- **Escalas:** X: Tiempo Lineal (ms), Y: Amplitud acumulada lineal.
- **Compatibilidad:** `Impulse`.
- **Pseudo-código:**
  ```javascript
  function calculateStepResponse(impulseResponse) {
      const step = new Float32Array(impulseResponse.length);
      let accumulator = 0.0;
      for (let i = 0; i < impulseResponse.length; i++) {
          accumulator += impulseResponse[i];
          step[i] = accumulator;
      }
      return step;
  }
  ```

#### 6. Coherence (Coherencia)
- **Física:** Grado de causalidad lineal entre la señal de entrada y la de salida. Varía entre 0.0 (ruido dominante o no linealidad) y 1.0 (relación perfectamente lineal). Útil para validar zonas del gráfico de magnitud que son confiables.
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Lineal (0.0 a 1.0).
- **Compatibilidad:** `Magnitude`, `Phase`, `Group Delay`.
- **Pseudo-código:**
  ```javascript
  // Promediado de densidades espectrales cruzadas (Cross-Spectral Density)
  function calculateCoherence(autoInputPower, autoRefPower, crossPower) {
      const coherence = new Float32Array(autoInputPower.length);
      for (let k = 0; k < coherence.length; k++) {
          const crossMagnitudeSquared = crossPower[k].real**2 + crossPower[k].imag**2;
          coherence[k] = crossMagnitudeSquared / (autoInputPower[k] * autoRefPower[k] + 1e-12);
      }
      return coherence;
  }
  ```

#### 7. Group Delay (Retardo de Grupo)
- **Física:** Derivada negativa de la fase espectral respecto a la frecuencia angular. Expresa el retraso temporal en milisegundos que sufre el grupo de componentes de frecuencia al pasar por el sistema.
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Tiempo (ms).
- **Compatibilidad:** `Magnitude`, `Phase`, `Coherence`.
- **Pseudo-código:**
  ```javascript
  function calculateGroupDelay(phaseRadiansArray, freqStep, sampleRate) {
      const gd = new Float32Array(phaseRadiansArray.length);
      for (let k = 1; k < phaseRadiansArray.length; k++) {
          const dPhase = phaseRadiansArray[k] - phaseRadiansArray[k-1];
          // Derivada con respecto a la frecuencia angular (omega)
          const dOmega = 2.0 * Math.PI * freqStep;
          const delaySeconds = -dPhase / dOmega;
          gd[k] = delaySeconds * 1000.0; // Paso a milisegundos
      }
      return gd;
  }
  ```

#### 8. Spectrogram (Espectrograma)
- **Física:** Cascada bidimensional de la magnitud espectral a lo largo del tiempo, donde la frecuencia y el tiempo ocupan los ejes cartesianos, y la magnitud dBFS se codifica mediante un mapa de colores (eje Z).
- **Escalas:** X: Frecuencia (Log/Lineal), Y: Tiempo transcurrido (ms), Z (Color): Magnitud dBFS.
- **Compatibilidad:** Ninguna en gráfico de curvas 2D. Requiere el cuadrante entero para su renderizado.
- **Pseudo-código:**
  ```javascript
  // Mantenimiento de una cola circular de espectros FFT históricos
  function renderSpectrogramRow(ctx, spectrumDB, rowY, width) {
      const rowImg = ctx.createImageData(width, 1);
      for (let x = 0; x < width; x++) {
          const freq = xToFreq(x, width);
          const dbVal = sampleSpectrumAtFreq(spectrumDB, freq);
          const color = getMapColorForDB(dbVal); // Mapeo de dBFS a HSL/RGB
          rowImg.data[x * 4] = color.r;
          rowImg.data[x * 4 + 1] = color.g;
          rowImg.data[x * 4 + 2] = color.b;
          rowImg.data[x * 4 + 3] = 255;
      }
      ctx.putImageData(rowImg, 0, rowY);
  }
  ```

#### 9. Level (Nivel de Entrada/Salida)
- **Física:** Indicador del nivel instantáneo de amplitud pico y promedio (RMS) de la señal.
- **Escalas:** X o Y: Lineal en dBFS (-120 dBFS a 0 dBFS).
- **Compatibilidad:** No se superpone a curvas. Es un widget autónomo o barra lateral integrada.
- **Pseudo-código:**
  ```javascript
  function calculateLevels(audioBlock) {
      let maxPeak = 0.0;
      let sumSquares = 0.0;
      for (let i = 0; i < audioBlock.length; i++) {
          const absVal = Math.abs(audioBlock[i]);
          if (absVal > maxPeak) maxPeak = absVal;
          sumSquares += audioBlock[i] * audioBlock[i];
      }
      const rms = Math.sqrt(sumSquares / audioBlock.length);
      const dbPeak = 20 * Math.log10(maxPeak + 1e-8);
      const dbRMS = 20 * Math.log10(rms + 1e-8);
      return { peak: dbPeak, rms: dbRMS };
  }
  ```

#### 10. Numeric (Valores Numéricos)
- **Física:** Lecturas discretas y parámetros acústicos críticos calculados a partir de los datos espectrales/temporales (ej. THD%, SNR dB, RT60, Distancia equivalente en metros).
- **Escalas:** Representación alfanumérica pura en pantalla (HUD).
- **Compatibilidad:** Superponible de manera flotante en la esquina superior de cualquier cuadrante.
- **Pseudo-código:**
  ```javascript
  function calculateTHD(spectrumBins, fundamentalFreqIndex) {
      let harmonicSum = 0.0;
      const fundamentalPower = spectrumBins[fundamentalFreqIndex]**2;
      for (let h = 2; h <= 10; h++) {
          const harmonicIndex = fundamentalFreqIndex * h;
          if (harmonicIndex < spectrumBins.length) {
              harmonicSum += spectrumBins[harmonicIndex]**2;
          }
      }
      const thd = Math.sqrt(harmonicSum) / Math.sqrt(fundamentalPower);
      return thd * 100.0; // Retorna porcentaje
  }
  ```

---

## 8. Diagnóstico de Rendimiento y Soluciones DSP
Se integran las siguientes correcciones críticas para el motor de renderizado y procesamiento:

### 8.1. El misterio del "Gráfico Invisible"
El micrófono en vivo SÍ está capturando el audio y mandando los datos al Canvas, pero se están dibujando por debajo de la pantalla.
- **Causa:** La constante de visualización en el Quadrant asume por defecto `dbMin = -30` y `dbMax = 30` (ideal para Funciones de Transferencia relativas). Sin embargo, el RTA en vivo (vía `AnalyserNode.getFloatFrequencyData`) escupe niveles crudos absolutos en dBFS (que suelen ir de -120 dB a 0 dB). Como el gráfico corta la pantalla en -30 dB, y el micrófono reporta por ejemplo -60 dB, la línea se dibuja invisiblemente por debajo del borde inferior del monitor.
- **Solución:** **Escala Y Dinámica.** Ajustar la función `valToY` para que si estamos viendo "RTA" o "Nivel Absoluto", la escala sea de **-120 dB a +10 dB**, permitiendo que la curva del micrófono en vivo sea visible.

### 8.2. El colapso de rendimiento (1 FPS)
El brutal bajón de frames es un estrangulamiento de CPU causado por dos algoritmos que se ejecutan de forma ineficiente dentro de `requestAnimationFrame` (que intenta correr 60 veces por segundo):

- **A. El algoritmo de Suavizado (Smoothing):** El suavizado (`smoothData`) usa ventanas fraccionales por octava. La matemática hace que la ventana crezca junto con la frecuencia. En las frecuencias altas, si elegís suavizado de 1/3 de octava, el sistema suma unos 900 bins hacia atrás y hacia adelante por cada uno de los 4096 bins de frecuencia. Esto resulta en alrededor de 1.8 millones de iteraciones de bucle por cada frame visual. A 60 FPS, JS está intentando ejecutar más de 110 millones de sumas por segundo, lo cual destruye el Event Loop de la pestaña.
- **B. El cálculo Predictivo de la Ecualización:** Para dibujar la línea punteada de "Live + EQ", el código recorre los 4096 bins y por cada uno llama a `getEQResponse`. Esta función recorre las 5 bandas de EQ ejecutando operaciones pesadísimas como `Math.log2`, `Math.exp` y `Math.pow`. Esto inyecta otras 20,000 operaciones logarítmicas por frame.

### 8.3. Soluciones de Ingeniería
- **Caché del Filtro EQ:** En lugar de calcular el impacto del ecualizador millón de veces por segundo, usar Svelte 5 `$derived` para pre-calcular un Array con la curva del filtro **solo cuando el usuario mueva un slider**. El motor de render solo leerá de ese array cacheado a velocidad de la luz.
- **Decimación Logarítmica:** Para el suavizado en RTA, en lugar de suavizar el array lineal masivo en cada frame, usar un algoritmo de **"Logarithmic Binning"**, que reduce drásticamente los puntos a calcular manteniendo la fidelidad visual, erradicando el bajón de FPS para siempre.
