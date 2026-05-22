# Documentación Técnica: Señales de Estimulación y Métricas de Medición (OSM)

Este documento detalla los fundamentos físicos, propósitos prácticos, implementaciones algorítmicas (pseudocódigo) y reglas de compatibilidad cartográfica para las señales de generación de audio y las métricas de análisis electroacústico implementadas en el sistema.

---

## PARTE 1: Señales del Generador de Audio

El motor DSP soporta 9 tipos de señales para la estimulación de sistemas electroacústicos, permitiendo análisis en el dominio del tiempo y de la frecuencia.

### 1.1. Ruido Blanco (White Noise)
- **Física y Propósito:** Posee una densidad espectral de potencia constante en todo el espectro de frecuencias (misma energía por Hertz). Genera una respuesta acústica cruda de igual densidad de energía matemática. Es útil para el análisis espectral bruto e instrumentación de filtros de banda estrecha.
- **Implementación (Pseudocódigo):**
  ```javascript
  // Genera un valor flotante aleatorio acotado entre -1.0 y 1.0 para cada muestra.
  // Distribución estadística uniforme de energía.
  function generateWhiteNoiseSample() {
      return Math.random() * 2.0 - 1.0;
  } 
  ```

### 1.2. Ruido Rosa (Pink Noise)
- **Física y Propósito:** Densidad espectral de potencia por debajo de $1/f$ (caída de 3 dB por octava). Posee energía constante por banda de octava (ej. la energía entre 100 Hz y 200 Hz es idéntica a la energía entre 5 kHz y 10 kHz). Es el estímulo predilecto en ecualización de salas y calibración de audio, ya que emula la audición logarítmica humana.
- **Implementación (Pseudocódigo - Algoritmo de Voss-McCartney de 6 polos):**
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
      return pink * 0.11; // Atenuación de seguridad para evitar recortes
  }
  ```

### 1.3. Ruido Marrón (Brown Noise)
- **Física y Propósito:** Densidad espectral de potencia proporcional a $1/f^2$ (caída de 6 dB por octava). Representa el comportamiento de partículas bajo movimiento browniano (ruido rojo o integración de ruido blanco). Concentra gran parte de su energía en graves y subgraves, produciendo un sonido muy cálido y de baja fatiga.
- **Implementación (Pseudocódigo - Integrador con fuga):**
  ```javascript
  let lastOut = 0.0;
  function generateBrownNoiseSample() {
      const white = Math.random() * 2.0 - 1.0;
      // El factor 1.02 actúa como sumidero (leak) para evitar la acumulación de componente de continua (DC offset)
      const brown = (lastOut + (0.02 * white)) / 1.02;
      lastOut = brown;
      return brown * 3.5; // Compensación de ganancia
  }
  ```

### 1.4. Music-noise (Ruido Ponderado de Música)
- **Física y Propósito:** Señal de ruido con un perfil de filtrado específico que imita el espectro dinámico y la caída frecuencial promedio de la música comercial (por ejemplo, siguiendo la norma EIA-426-B). Permite someter a pruebas de potencia de larga duración a altavoces y etapas de amplificación simulando condiciones reales sin destruir los transductores de alta frecuencia.
- **Implementación (Pseudocódigo):**
  ```javascript
  // Filtro paso banda de 2do orden configurado a 40 Hz de paso alto y caída atenuada en agudos a partir de 5 kHz.
  function generateMusicNoiseSample(pinkSample) {
      // Coeficientes precalculados para aplicar la ecualización espectral ponderada
      return applyEIA426BFilter(pinkSample);
  }
  ```

### 1.5. Seno Continuo (Continuous Sine)
- **Física y Propósito:** Tono sinusoidal puro de frecuencia fija. Utilizado para calibración eléctrica, medición de Distorsión Armónica Total (THD), detección de resonancias mecánicas en recintos o transductores, e impedancias.
- **Implementación (Pseudocódigo):**
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

### 1.6. Sweep Logarítmico (Farina Sweep)
- **Física y Propósito:** Barrido sinusoidal con un incremento de frecuencia exponencial desde una frecuencia de inicio $f_1$ hasta una final $f_2$ en una duración fija $T$. A través del método de deconvolución de Angelo Farina, permite extraer de forma precisa y simultánea la respuesta lineal del sistema (respuesta al impulso) y las distorsiones armónicas de cada orden por separado, aisladas de las reflexiones del entorno.
- **Implementación (Pseudocódigo):**
  ```javascript
  function generateLogSweepBuffer(f1, f2, duration, sampleRate) {
      const numSamples = Math.round(duration * sampleRate);
      const buffer = new Float32Array(numSamples);
      const L = duration / Math.log(f2 / f1);
      for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          // Fase integrada analíticamente para el crecimiento exponencial
          buffer[i] = Math.sin(2.0 * Math.PI * f1 * L * (Math.exp(t / L) - 1.0));
      }
      return buffer;
  }
  ```

### 1.7. Burst (Ráfaga de Tono)
- **Física y Propósito:** Pulso de onda senoidal de frecuencia específica con una duración de tiempo $T_{burst}$ muy acotada, seguida de silencio absoluto. Permite medir respuestas transitorias de altavoces en recintos, calcular el tiempo de vuelo de la onda acústica directa e identificar ecos tempranos o reflexiones.
- **Implementación (Pseudocódigo):**
  ```javascript
  function generateBurstSample(t, freq, burstStart, burstDuration, sampleRate) {
      if (t >= burstStart && t < (burstStart + burstDuration)) {
          return Math.sin(2.0 * Math.PI * freq * t);
      }
      return 0.0; // Estado de silencio
  }
  ```

### 1.8. SinBurst (Ráfaga con Ventana)
- **Física y Propósito:** Similar a la ráfaga convencional, pero multiplicada por una función de ventana (ej. Hann o Blackman-Harris) para suavizar la envolvente de ataque y liberación. Esto evita que los flancos abruptos de encendido/apagado generen clicks de alta frecuencia no deseados, confinando la estimulación estrictamente a la banda estrecha del tono.
- **Implementación (Pseudocódigo):**
  ```javascript
  function generateWindowedBurstSample(t, freq, start, duration, sampleRate) {
      if (t >= start && t < (start + duration)) {
          const relativeT = (t - start) / duration;
          // Ventana de Hann para suavizar flancos
          const window = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * relativeT));
          return Math.sin(2.0 * Math.PI * freq * t) * window;
      }
      return 0.0;
  }
  ```

### 1.9. MLS+ (Secuencia de Longitud Máxima Modificada)
- **Física y Propósito:** Señal binaria pseudo-aleatoria generada mediante registros de desplazamiento (LFSR). Su función de autocorrelación periódica es matemáticamente igual a un impulso de Dirac. La variante MLS+ optimiza la respuesta del sistema al correlacionarla con la señal original, cancelando ruidos no correlacionados e independizando la estimulación lineal de distorsiones no lineales leves del sistema.
- **Implementación (Pseudocódigo - LFSR Galois de bits de orden N):**
  ```javascript
  function generateMLS(bits) {
      const size = (1 << bits) - 1; // Genera 2^N - 1 muestras
      const buffer = new Float32Array(size);
      let register = 1; // Semilla de inicio
      const taps = getTapsForBits(bits); // Polinomio primitivo de retroalimentación
      for (let i = 0; i < size; i++) {
          const bit = register & 1;
          buffer[i] = bit ? 1.0 : -1.0;
          register = register >>> 1;
          if (bit) register = register ^ taps;
      }
      return buffer;
  }
  ```

---

## PARTE 2: Métricas de Medición OSM y Reglas de Compatibilidad

El visualizador está diseñado bajo las directrices de OSM (Open Sound Measurement), soportando 10 métricas de análisis electroacústico.

### 2.1. Reglas de Compatibilidad de Ejes (Superposición Gráfica)
Para que los cuadrantes puedan pintar múltiples métricas simultáneamente en el mismo plano cartesiano sin desfigurar la escala de lectura, estas deben clasificarse en los siguientes grupos compatibles:

1.  **Grupo Frecuencia - Relativo (Eje X: Logarítmico 20Hz-20kHz, Eje Y: Decibelios Relativos dB / Grados / Coherencia / ms):**
    - `Magnitude` (dB)
    - `Phase` (grados - eje secundario)
    - `Coherence` (0.0 a 1.0 - eje secundario)
    - `Group Delay` (ms - eje secundario)
2.  **Grupo Espectro Absoluto (Eje X: Logarítmico 20Hz-20kHz, Eje Y: Decibelios Absolutos dBFS):**
    - `Spectrum` (RTA)
    - `Level` (vúmetro o escala de magnitud)
3.  **Grupo Temporal (Eje X: Tiempo lineal en ms, Eje Y: Amplitud lineal o dB):**
    - `Impulse` (IR)
    - `Step`
4.  **Grupo 3D / Cascada:**
    - `Spectrogram` (Monopoliza todo el espacio de visualización, no admite curvas 2D superpuestas).
5.  **Grupo Texto / Overlay:**
    - `Numeric` (Superponible en pantalla como panel de información flotante en la esquina).

---

### 2.2. Detalle y Pseudo-código de cada Métrica

#### 1. Spectrum (Espectro RTA)
- **Física:** Magnitud espectral absoluta en tiempo real (RTA) del micrófono en dBFS. Muestra el comportamiento del ruido de sala, respuestas crudas e interacción tonal acústica.
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Absoluto (-120 dBFS a +10 dBFS).
- **Pseudo-código:**
  ```javascript
  function calculateSpectrumRTA(timeData) {
      const complexFFT = FFT(timeData);
      const rta = new Float32Array(timeData.length / 2);
      for (let k = 0; k < rta.length; k++) {
          const mag = Math.sqrt(complexFFT[k].real**2 + complexFFT[k].imag**2);
          // Normalización por el tamaño del bloque (N) y paso a escala logarítmica absoluta
          rta[k] = 20 * Math.log10(mag / (timeData.length / 2) + 1e-8);
      }
      return rta;
  }
  ```

#### 2. Magnitude (Magnitud Relativa)
- **Física:** Respuesta de frecuencia del sistema bajo prueba normalizada respecto a la señal de referencia. Expresa pérdidas, ganancias y cancelaciones producidas por filtros o acústica del recinto.
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Relativo (-30 dB a +30 dB).
- **Pseudo-código:**
  ```javascript
  function calculateMagnitude(fftInput, fftReference) {
      const magnitude = new Float32Array(fftInput.length);
      for (let k = 0; k < fftInput.length; k++) {
          // Transfer Function: H(f) = Y(f) / X(f)
          const denominator = fftReference[k].real**2 + fftReference[k].imag**2 + 1e-12;
          const hReal = (fftInput[k].real * fftReference[k].real + fftInput[k].imag * fftReference[k].imag) / denominator;
          const hImag = (fftInput[k].imag * fftReference[k].real - fftInput[k].real * fftReference[k].imag) / denominator;
          magnitude[k] = 20 * Math.log10(Math.sqrt(hReal**2 + hImag**2) + 1e-8);
      }
      return magnitude;
  }
  ```

#### 3. Phase (Fase)
- **Física:** Muestra la fase en grados de la función de transferencia compleja. Permite verificar el comportamiento temporal espectral y comprobar el acoplamiento acústico en zonas de cruce (crossover).
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Grados (-180° a +180°).
- **Pseudo-código:**
  ```javascript
  function calculatePhase(fftInput, fftReference) {
      const phase = new Float32Array(fftInput.length);
      for (let k = 0; k < fftInput.length; k++) {
          const denominator = fftReference[k].real**2 + fftReference[k].imag**2 + 1e-12;
          const hReal = (fftInput[k].real * fftReference[k].real + fftInput[k].imag * fftReference[k].imag) / denominator;
          const hImag = (fftInput[k].imag * fftReference[k].real - fftInput[k].real * fftReference[k].imag) / denominator;
          phase[k] = Math.atan2(hImag, hReal) * (180.0 / Math.PI);
      }
      return phase;
  }
  ```

#### 4. Impulse (Respuesta al Impulso - IR)
- **Física:** Representa la respuesta de un transductor en el dominio del tiempo frente a un impulso instantáneo. Visualiza alineaciones de transductores, distancias físicas de fuentes acústicas, reflexiones y modos de sala primarios.
- **Escalas:** X: Tiempo Lineal (ms), Y: Amplitud lineal (-1.0 a +1.0) o Energía Logarítmica (dB).
- **Pseudo-código:**
  ```javascript
  function calculateImpulseResponse(fftTransferFunction) {
      // Retorno directo al dominio del tiempo por transformada inversa compleja
      const complexTimeData = IFFT(fftTransferFunction);
      const impulseData = new Float32Array(complexTimeData.length);
      for (let i = 0; i < complexTimeData.length; i++) {
          impulseData[i] = complexTimeData[i].real;
      }
      return impulseData;
  }
  ```

#### 5. Step (Respuesta al Escalón)
- **Física:** Integral temporal de la respuesta al impulso. Se utiliza para visualizar la respuesta dinámica coherente de las vías de un altavoz multicanal, ayudando a determinar si el tweeter y el woofer están en la misma dirección de fase temporal de ataque.
- **Escalas:** X: Tiempo Lineal (ms), Y: Amplitud acumulada.
- **Pseudo-código:**
  ```javascript
  function calculateStepResponse(impulseResponse) {
      const step = new Float32Array(impulseResponse.length);
      let cumulativeSum = 0.0;
      for (let i = 0; i < impulseResponse.length; i++) {
          cumulativeSum += impulseResponse[i];
          step[i] = cumulativeSum;
      }
      return step;
  }
  ```

#### 6. Coherence (Coherencia)
- **Física:** Evalúa la consistencia de la función de transferencia y determina qué zonas del espectro son causales y no están corrompidas por ruido de fondo, reflexiones de fase destructiva o distorsión armónica alta.
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Lineal (0.0 a 1.0).
- **Pseudo-código:**
  ```javascript
  function calculateCoherence(autoSpectraInput, autoSpectraRef, crossSpectra) {
      const coherence = new Float32Array(autoSpectraInput.length);
      for (let k = 0; k < coherence.length; k++) {
          const crossMagnitudeSq = crossSpectra[k].real**2 + crossSpectra[k].imag**2;
          coherence[k] = crossMagnitudeSq / (autoSpectraInput[k] * autoSpectraRef[k] + 1e-12);
      }
      return coherence;
  }
  ```

#### 7. Group Delay (Retardo de Grupo)
- **Física:** Representa el retardo temporal absoluto que experimentan las componentes de frecuencia al atravesar el sistema. Mide el desfase temporal de los graves respecto a los agudos debido a la acumulación de energía en filtros o resonancias del puerto bass-reflex.
- **Escalas:** X: Logarítmico (20 Hz - 20 kHz), Y: Retraso temporal (ms).
- **Pseudo-código:**
  ```javascript
  function calculateGroupDelay(phaseRadians, freqStep) {
      const groupDelay = new Float32Array(phaseRadians.length);
      for (let k = 1; k < phaseRadians.length; k++) {
          const dPhase = phaseRadians[k] - phaseRadians[k-1];
          const dOmega = 2.0 * Math.PI * freqStep;
          groupDelay[k] = (-dPhase / dOmega) * 1000.0; // Conversión a milisegundos
      }
      return groupDelay;
  }
  ```

#### 8. Spectrogram (Espectrograma)
- **Física:** Graficación en 3D que apila de forma cronológica los espectros del RTA en el tiempo. Permite rastrear resonancias de salas persistentes (modos de decaimiento lento) e identificar fugas o ecos cíclicos.
- **Escalas:** X: Frecuencia (Log/Lineal), Y: Tiempo (ms), Z (Código de Color): dBFS.
- **Pseudo-código:**
  ```javascript
  function generateSpectrogramImage(historyQueue, canvasWidth, canvasHeight) {
      const buffer = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
      for (let y = 0; y < canvasHeight; y++) {
          const spectrum = historyQueue[y];
          for (let x = 0; x < canvasWidth; x++) {
              const freq = pixelToFreq(x, canvasWidth);
              const db = sampleFFT(spectrum, freq);
              const color = getColorMap(db);
              const index = (y * canvasWidth + x) * 4;
              buffer[index] = color.r;
              buffer[index+1] = color.g;
              buffer[index+2] = color.b;
              buffer[index+3] = 255;
          }
      }
      return new ImageData(buffer, canvasWidth, canvasHeight);
  }
  ```

#### 9. Level (Nivel de Entrada/Salida)
- **Física:** Mapeo de potencia acústica y picos RMS eléctricos absolutos del hardware de captura y salida de audio.
- **Escalas:** Indicador lineal visual de barra vertical u horizontal (dBFS -120 a 0).
- **Pseudo-código:**
  ```javascript
  function processSignalLevel(buffer) {
      let maxVal = 0.0;
      let sumOfSquares = 0.0;
      for (let i = 0; i < buffer.length; i++) {
          const val = Math.abs(buffer[i]);
          if (val > maxVal) maxVal = val;
          sumOfSquares += buffer[i] * buffer[i];
      }
      const peakDb = 20 * Math.log10(maxVal + 1e-9);
      const rmsDb = 20 * Math.log10(Math.sqrt(sumOfSquares / buffer.length) + 1e-9);
      return { peakDb, rmsDb };
  }
  ```

#### 10. Numeric (Valores Numéricos)
- **Física:** Lectura textual de métricas derivadas complejas como la Distorsión Armónica Total (THD), relación señal/ruido (SNR), distancia acústica equivalente calculada a partir del retardo grupal, o valores de decaimiento acústico (RT60).
- **Escalas:** Sin representación cartesiana. Panel HUD con datos digitales dinámicos superpuestos.
- **Pseudo-código:**
  ```javascript
  function calculateSNR(signalRMS, noiseFloorRMS) {
      const snr = 20 * Math.log10(signalRMS / (noiseFloorRMS + 1e-12));
      return snr.toFixed(2) + " dB";
  }
  ```
