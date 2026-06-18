# Prompts de Implementación — Pipeline DSP Real: Dual-Channel Analyzer

Este documento contiene instrucciones atómicas para transformar el pipeline DSP de simulación cosmética a analizador FFT dual-channel real. El proyecto es una SPA SvelteKit con Svelte 5 runes (`$state`, `$derived`, `$effect`).

## ⛔ REGLAS OBLIGATORIAS — Leer antes de empezar

1. **NO AVANCES al siguiente Grupo (A→B→C→D→E) sin recibir aprobación explícita del usuario.** Al terminar cada grupo, reporta lo hecho y ESPERA instrucciones.
2. **NO MODIFIQUES archivos que no estén explícitamente listados en la tarea.** Si descubrís que se necesita un cambio adicional, reportalo y esperá aprobación.
3. **NO AGREGUES funcionalidad nueva** que no esté especificada en la tarea. No refactorices código adyacente "de paso". No agregues logs, tests, ni comentarios extra.
4. **NO ELIMINES comentarios existentes** a menos que la tarea lo indique expresamente.
5. **NO CAMBIES la lógica de negocio** salvo que la tarea lo especifique.
6. **Verificá con `npm run build` al final de cada grupo.** Si falla, corregí solo lo necesario para que compile sin inventar soluciones propias.
7. **Si algo no queda claro, PREGUNTÁ** en vez de asumir.

---

# GRUPO A — Configuración y Store (Fase 1 prerequisitos)

---

## Tarea A1: Agregar propiedades de routing y referencia al uiStore

**Archivo a modificar:** `src/lib/stores/ui.svelte.ts`

**Instrucción:** Agregar las siguientes propiedades reactivas a la clase del store, al final de las propiedades existentes (antes de cualquier método):

```typescript
    // Routing de canales dual-channel
    refChannel = $state(0);           // Canal físico para referencia (0=L, 1=R)
    measChannel = $state(1);          // Canal físico para medición
    channelAssignment = $state<'manual' | 'auto'>('manual');

    // Modo de referencia
    refSourceMode = $state<'channel' | 'generator-tap' | 'analytical' | 'loopback'>('channel');

    // FFT overlap
    fftOverlap = $state(0.5);        // 0, 0.5, 0.75

    // Delay compensation
    compensationDelayMs = $state(0);       // Delay manual en ms
    autoDelayCompensation = $state(true);  // Auto-detect desde IR

    // Averaging threshold
    averagingThresholdDb = $state(-60);    // dBFS threshold para amplitude gating
```

---

## Tarea A2: Extender interface AudioListener con time-domain dual-channel

**Archivo a modificar:** `src/lib/hal/types.ts`

**Instrucción:** Agregar el método `onTimeDomainData` a la interface `AudioListener`:

```diff
 export interface AudioListener {
     onAudioData(data: AudioBufferChunk): void;
     onFrequencyData?(data: Float32Array): void;
+    onTimeDomainData?(measSamples: Float32Array, refSamples?: Float32Array): void;
 }
```

---

## Verificación Grupo A

```bash
npm run build
```

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo B.

---

# GRUPO B — AudioWorklet Dual-Channel (Fase 1)

---

## Tarea B1: Reescribir audio-capture-processor.js para captura dual-channel

**Archivo a modificar:** `static/worklets/audio-capture-processor.js`

**Contexto:** El worklet actual (L57-99) solo lee `input[0][0]` (canal 0) y escribe en un solo ring buffer. Se debe cambiar para capturar **ambos canales** del stream estéreo, acumular bloques de `fftSize` muestras, y enviar bloques completos al main thread.

**Instrucción:** Reemplazar la clase `AudioCaptureProcessor` manteniendo la lógica FSK/Goertzel existente. Los cambios son:

### Paso 1: Cambiar el constructor

Reemplazar las propiedades del ring buffer existentes (L28-31) por:

```javascript
    // Dual-channel ring buffers
    this.refBuffer = null;
    this.measBuffer = null;
    this.refWriteIdx = 0;
    this.measWriteIdx = 0;
    this.bufferSize = 0;
    this.hasSAB = false;

    // Acumulación de bloques FFT
    this.fftSize = 8192;
    this.samplesAccumulated = 0;
    this.overlapFraction = 0.5; // 50% overlap default
```

### Paso 2: Cambiar el handler de mensajes

Reemplazar el `this.port.onmessage` existente (L49-54) por:

```javascript
    this.port.onmessage = (event) => {
        if (event.data && event.data.type === 'init') {
            this.fftSize = event.data.fftSize || 8192;
            this.bufferSize = this.fftSize;
            if (event.data.refSab && event.data.measSab) {
                this.refBuffer = new Float32Array(event.data.refSab);
                this.measBuffer = new Float32Array(event.data.measSab);
                this.hasSAB = true;
            } else {
                this.refBuffer = new Float32Array(this.bufferSize);
                this.measBuffer = new Float32Array(this.bufferSize);
                this.hasSAB = false;
            }
            this.refWriteIdx = 0;
            this.measWriteIdx = 0;
            this.samplesAccumulated = 0;
        }
        if (event.data && event.data.type === 'updateFftSize') {
            this.fftSize = event.data.fftSize;
            this.bufferSize = this.fftSize;
            this.refBuffer = new Float32Array(this.bufferSize);
            this.measBuffer = new Float32Array(this.bufferSize);
            this.refWriteIdx = 0;
            this.measWriteIdx = 0;
            this.samplesAccumulated = 0;
            this.hasSAB = false;
        }
        if (event.data && event.data.type === 'setOverlap') {
            this.overlapFraction = event.data.overlap;
        }
        // Mantener compatibilidad con el protocolo SAB antiguo
        if (event.data && event.data.sab) {
            // Legacy single-channel SAB — ignorar o migrar
        }
    };
```

### Paso 3: Cambiar el método process()

Reemplazar el método `process()` existente (L57-99) por:

```javascript
    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;
        if (!this.refBuffer || !this.measBuffer) return true;

        const ch0 = input[0];                  // Canal 0
        const ch1 = input[1] || input[0];      // Canal 1 (fallback mono)
        const len = ch0.length;

        // Escribir en ring buffers duales
        for (let i = 0; i < len; i++) {
            this.refBuffer[this.refWriteIdx] = ch0[i];
            this.measBuffer[this.measWriteIdx] = ch1[i];
            this.refWriteIdx = (this.refWriteIdx + 1) % this.bufferSize;
            this.measWriteIdx = (this.measWriteIdx + 1) % this.bufferSize;
        }

        this.samplesAccumulated += len;

        // Cuando tenemos fftSize muestras, notificar al main thread
        if (this.samplesAccumulated >= this.fftSize) {
            if (!this.hasSAB) {
                // Extraer bloque ordenado del ring buffer circular
                const refBlock = new Float32Array(this.fftSize);
                const measBlock = new Float32Array(this.fftSize);
                for (let i = 0; i < this.fftSize; i++) {
                    const readIdx = (this.refWriteIdx - this.fftSize + i + this.bufferSize) % this.bufferSize;
                    refBlock[i] = this.refBuffer[readIdx];
                    measBlock[i] = this.measBuffer[readIdx];
                }
                this.port.postMessage({
                    type: 'DUAL_BLOCK',
                    ref: refBlock.buffer,
                    meas: measBlock.buffer
                }, [refBlock.buffer, measBlock.buffer]);
            } else {
                // SAB: notificar que hay un bloque listo
                this.port.postMessage({ type: 'BLOCK_READY' });
            }

            // Overlap: retroceder el contador
            const hopSize = Math.round(this.fftSize * (1 - this.overlapFraction));
            this.samplesAccumulated -= hopSize;
        }

        // Mantener lógica FSK/Goertzel existente sobre ch0
        const channelData = ch0;
        for (let i = 0; i < len; i++) {
            this.samplesCount++;
            if (this.samplesCount % this.blockSize === 0) {
                const block = channelData.slice(Math.max(0, i - this.blockSize + 1), i + 1);
                const markEnergy = this.markDetector.process(block);
                const spaceEnergy = this.spaceDetector.process(block);
                if (markEnergy > spaceEnergy && markEnergy > this.threshold) {
                    this.currentBit = 1;
                } else if (spaceEnergy > markEnergy && spaceEnergy > this.threshold) {
                    this.currentBit = 0;
                }
            }
            this.handleFskState();
        }

        return true;
    }
```

**IMPORTANTE:** NO modificar la clase `Goertzel`, `handleFskState()`, ni `decodeFskByte()`. Solo cambia el constructor, `port.onmessage`, y `process()`.

---

## Verificación Grupo B

```bash
npm run build
```

El build debe compilar sin errores. El worklet es JS puro, no pasa por el bundler de TypeScript.

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo C.

---

# GRUPO C — WebAudioProvider Dual-Channel (Fase 1)

---

## Tarea C1: Agregar ChannelSplitter y doble AnalyserNode

**Archivo a modificar:** `src/lib/hal/web/WebAudioProvider.ts`

**Instrucción:**

### Paso 1: Agregar propiedades a la clase (después de L26)

Agregar después de `private leqCalculator`:

```typescript
    private analyserRef: AnalyserNode | null = null;
    private splitterNode: ChannelSplitterNode | null = null;
    private refSab: SharedArrayBuffer | null = null;
    private measSab: SharedArrayBuffer | null = null;
    private refTimeDomain: Float32Array | null = null;
    private measTimeDomain: Float32Array | null = null;
```

### Paso 2: Modificar startCapture() — agregar splitter

En `startCapture()`, después de `source.connect(this.analyserNode);` (L60), agregar:

```typescript
        // Dual-channel: separar L/R para captura independiente
        this.splitterNode = this.audioContext.createChannelSplitter(2);
        source.connect(this.splitterNode);

        // AnalyserNode dedicado para canal de referencia
        this.analyserRef = this.audioContext.createAnalyser();
        this.analyserRef.fftSize = uiStore.fftSize;
        this.analyserRef.smoothingTimeConstant = 0;

        // Conectar canales según routing del usuario
        const refCh = uiStore.refChannel;
        const measCh = uiStore.measChannel;
        this.splitterNode.connect(this.analyserRef, refCh);

        // Reasignar analyserNode existente al canal de medición
        this.analyserNode!.smoothingTimeConstant = 0;
        this.splitterNode.connect(this.analyserNode!, measCh);

        // Buffers time-domain para dual-channel
        this.refTimeDomain = new Float32Array(uiStore.fftSize);
        this.measTimeDomain = new Float32Array(uiStore.fftSize);
```

### Paso 3: Modificar startCapture() — configurar worklet con protocolo dual

Reemplazar el bloque de inicialización del worklet (L62-92) por:

```typescript
        const fftSize = uiStore.fftSize;
        const hasSAB = typeof SharedArrayBuffer !== 'undefined';

        if (hasSAB) {
            this.refSab = new SharedArrayBuffer(fftSize * Float32Array.BYTES_PER_ELEMENT);
            this.measSab = new SharedArrayBuffer(fftSize * Float32Array.BYTES_PER_ELEMENT);
        }

        this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor', {
            channelCount: 2,
            channelCountMode: 'explicit',
        });

        if (hasSAB) {
            this.workletNode.port.postMessage({
                type: 'init',
                fftSize,
                refSab: this.refSab,
                measSab: this.measSab
            });
        } else {
            this.workletNode.port.postMessage({ type: 'init', fftSize });

            this.workletNode.port.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'DUAL_BLOCK') {
                    // Bloque dual-channel recibido via postMessage
                    this.refTimeDomain = new Float32Array(event.data.ref);
                    this.measTimeDomain = new Float32Array(event.data.meas);
                }
            });
            this.workletNode.port.start();
        }

        source.connect(this.workletNode);
```

### Paso 4: Modificar readData() — enviar time-domain al listener

Reemplazar la función `readData()` (L96-122) por:

```typescript
        const readData = () => {
            // Fast-path RTA (AnalyserNode de medición, solo para Spectrum)
            if (this.analyserNode && this.freqDataArray && listener.onFrequencyData) {
                this.analyserNode.getFloatFrequencyData(this.freqDataArray as any);
                listener.onFrequencyData(this.freqDataArray as any);
            }

            // Dual-channel time-domain para el worker DSP
            if (listener.onTimeDomainData && this.analyserRef && this.analyserNode) {
                if (hasSAB && this.refSab && this.measSab) {
                    // Leer desde SAB (el worklet ya los llena)
                    const refData = new Float32Array(this.refSab);
                    const measData = new Float32Array(this.measSab);
                    listener.onTimeDomainData(measData, refData);
                } else if (this.refTimeDomain && this.measTimeDomain) {
                    // Fallback: datos ya recibidos via postMessage
                    listener.onTimeDomainData(this.measTimeDomain, this.refTimeDomain);
                }
            }

            // Leq calculator (mantener existente)
            if (this.analyserNode && uiStore.enableLeq) {
                if (!this.leqCalculator) {
                    this.leqCalculator = new LeqCalculator(uiStore.leqWindowSeconds, uiStore.sampleRate);
                } else {
                    this.leqCalculator.setWindowSeconds(uiStore.leqWindowSeconds);
                }
                const timeData = new Float32Array(this.analyserNode.fftSize);
                this.analyserNode.getFloatTimeDomainData(timeData);
                uiStore.leqValue = this.leqCalculator.processBlock(timeData);
            } else {
                this.leqCalculator = null;
            }

            this.animationFrameId = requestAnimationFrame(readData);
        };

        readData();
```

### Paso 5: Modificar stopCapture() — limpiar nuevos nodos

En `stopCapture()` (L125-135), agregar limpieza de los nuevos nodos:

```diff
     stopCapture(): void {
         if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
         if (this.workletNode) this.workletNode.disconnect();
         if (this.analyserNode) this.analyserNode.disconnect();
+        if (this.analyserRef) this.analyserRef.disconnect();
+        if (this.splitterNode) this.splitterNode.disconnect();
         if (this.stream) this.stream.getTracks().forEach(track => track.stop());

         this.stream = null;
         this.workletNode = null;
         this.analyserNode = null;
+        this.analyserRef = null;
+        this.splitterNode = null;
         this.freqDataArray = null;
+        this.refTimeDomain = null;
+        this.measTimeDomain = null;
     }
```

---

## Verificación Grupo C

```bash
npm run build
```

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo D.

---

# GRUPO D — dspWorker Real (Fase 2 + 3 + 4)

Este es el grupo más grande. Reemplaza TODA la lógica cosmética del worker por procesamiento real.

---

## Tarea D1: Eliminar funciones cosméticas del dspWorker

**Archivo a modificar:** `src/lib/dsp/dspWorker.ts`

**Instrucción:** Eliminar las siguientes funciones/bloques completos:

### Eliminación 1: `getPhaseValueRadians()` (L49-186)

Eliminar la función completa desde `function getPhaseValueRadians(` hasta su llave de cierre `}`. Son ~138 líneas.

### Eliminación 2: `getCoherenceValue()` (L188-215)

Eliminar la función completa desde `function getCoherenceValue(` hasta su llave de cierre `}`. Son ~28 líneas.

### Eliminación 3: `getCalibrationGainAt()` (L217-244)

Eliminar la función completa desde `function getCalibrationGainAt(` hasta su llave de cierre `}`. Son ~28 líneas. (Esta lógica ya existe en `calibrationStore.ts` y se aplica en el orchestrator.)

### Eliminación 4: Interfaces `EQBand`, `EQFilter`, `CalibrationPoint` (L29-47)

Eliminar las 3 interfaces — ya no se necesitan en el worker.

**IMPORTANTE:** NO eliminar los imports al inicio del archivo (`calculateMagnitude`, `calculatePhase`, etc.) ni los buffers pre-alocados. NO eliminar `processSignalLevel` del import de osmMetrics — se usará en la tarea D2.

**Verificar que no quedan referencias a las funciones eliminadas.** Si las hay, serán resueltas en D2.

---

## Tarea D2: Reescribir el handler onmessage con pipeline real

**Archivo a modificar:** `src/lib/dsp/dspWorker.ts`

**Contexto:** Después de las eliminaciones de D1, el handler `self.onmessage` (que empezaba ~L278) necesita ser reescrito completamente.

**Instrucción:** Reemplazar TODO el contenido de `self.onmessage` por el siguiente pipeline real:

```typescript
import {
    calculateMagnitude,
    calculatePhase,
    calculateStepResponse,
    calculateGroupDelay,
    processSignalLevel,
} from './osmMetrics';
import { getWeightingGain } from './weighting';
import { ComplexAveraging } from './averaging';
import { deconvolve } from './deconvolution';
import { applySourceWindow } from './sourceWindowing';
import { WindowFunction } from './windowFunction';
import { fft } from './fft';

// WebFFT: motor FFT acelerado (WASM/GPU)
let webfftEngine: any = null;
let webfftSize = 0;

async function initWebFFT(fftSize: number): Promise<void> {
    try {
        const { default: WebFFT } = await import('webfft');
        webfftEngine = new WebFFT(fftSize);
        await webfftEngine.profile();
        webfftSize = fftSize;
    } catch (e) {
        console.warn('[dspWorker] WebFFT not available, using Radix-2 fallback:', e);
        webfftEngine = null;
    }
}

// Shared calculation buffers
let fftInputReal: Float32Array;
let fftInputImag: Float32Array;
let fftRefReal: Float32Array;
let fftRefImag: Float32Array;
let hReal: Float32Array;
let hImag: Float32Array;

let tempFullReal: Float32Array;
let tempFullImag: Float32Array;
let tempFullRealOut: Float32Array;
let tempFullImagOut: Float32Array;

let outputMagnitude: Float32Array;
let outputPhase: Float32Array;
let outputCoherence: Float32Array;
let outputGroupDelay: Float32Array;
let outputImpulse: Float32Array;
let outputStep: Float32Array;
let tempPhaseRadians: Float32Array;
let outputCrestFactor: Float32Array;

// Averaging buffers (applied on H(f), not raw Y)
let avgHReal: Float32Array;
let avgHImag: Float32Array;

// Coherence accumulator state
let cohGxx: Float32Array;
let cohGyy: Float32Array;
let cohGxyR: Float32Array;
let cohGxyI: Float32Array;
let cohAlpha = 0.1;

let currentBins = 0;
let currentFftSize = 0;

let averagingProcessor: ComplexAveraging | null = null;
const windowProcessor = new WindowFunction();

function feedCoherence(
    refR: Float32Array, refI: Float32Array,
    measR: Float32Array, measI: Float32Array,
    bins: number
): void {
    for (let k = 0; k < bins; k++) {
        const xx = refR[k] * refR[k] + refI[k] * refI[k];
        const yy = measR[k] * measR[k] + measI[k] * measI[k];
        const xyR = measR[k] * refR[k] + measI[k] * refI[k];
        const xyI = measI[k] * refR[k] - measR[k] * refI[k];

        cohGxx[k] += (xx - cohGxx[k]) * cohAlpha;
        cohGyy[k] += (yy - cohGyy[k]) * cohAlpha;
        cohGxyR[k] += (xyR - cohGxyR[k]) * cohAlpha;
        cohGxyI[k] += (xyI - cohGxyI[k]) * cohAlpha;
    }
}

function computeCoherence(output: Float32Array, bins: number): void {
    for (let k = 0; k < bins; k++) {
        const crossMagSq = cohGxyR[k] * cohGxyR[k] + cohGxyI[k] * cohGxyI[k];
        const denom = cohGxx[k] * cohGyy[k] + 1e-12;
        output[k] = Math.min(1, Math.max(0, crossMagSq / denom));
    }
}

function circularShift(buffer: Float32Array, samples: number): void {
    const N = buffer.length;
    const shift = ((samples % N) + N) % N;
    if (shift === 0) return;
    const temp = new Float32Array(shift);
    temp.set(buffer.subarray(0, shift));
    buffer.copyWithin(0, shift);
    buffer.set(temp, N - shift);
}

self.onmessage = (event) => {
    if (event.data && event.data.type === 'run-dsp') {
        const {
            measTimeDomain,
            refTimeDomain,
            BINS,
            FFT_SIZE,
            metrics,
            windowType,
            weightingType,
            averagingType,
            averagingDepth,
            averagingAlpha,
            enableSourceWindow,
            sourceWindowWidthMs,
            sourceWindowOffsetMs,
            sampleRate,
            compensationDelaySamples,
            autoDelayCompensation,
        } = event.data;

        const sr = sampleRate || 48000;

        // Validar datos reales
        if (!measTimeDomain || !refTimeDomain) return;

        // WebFFT initialization if FFT_SIZE changes
        if (FFT_SIZE && FFT_SIZE !== webfftSize) {
            initWebFFT(FFT_SIZE);
        }

        // Re-allocate only if dimensions changed
        if (BINS !== currentBins || FFT_SIZE !== currentFftSize) {
            currentBins = BINS;
            currentFftSize = FFT_SIZE;

            fftInputReal = new Float32Array(BINS);
            fftInputImag = new Float32Array(BINS);
            fftRefReal = new Float32Array(BINS);
            fftRefImag = new Float32Array(BINS);
            hReal = new Float32Array(BINS);
            hImag = new Float32Array(BINS);

            tempFullReal = new Float32Array(FFT_SIZE);
            tempFullImag = new Float32Array(FFT_SIZE);
            tempFullRealOut = new Float32Array(FFT_SIZE);
            tempFullImagOut = new Float32Array(FFT_SIZE);

            outputMagnitude = new Float32Array(BINS);
            outputPhase = new Float32Array(BINS);
            outputCoherence = new Float32Array(BINS);
            outputGroupDelay = new Float32Array(BINS);
            outputImpulse = new Float32Array(FFT_SIZE);
            outputStep = new Float32Array(FFT_SIZE);
            tempPhaseRadians = new Float32Array(BINS);
            outputCrestFactor = new Float32Array(BINS);

            avgHReal = new Float32Array(BINS);
            avgHImag = new Float32Array(BINS);

            // Coherence accumulator
            cohGxx = new Float32Array(BINS);
            cohGyy = new Float32Array(BINS);
            cohGxyR = new Float32Array(BINS);
            cohGxyI = new Float32Array(BINS);

            averagingProcessor = new ComplexAveraging(BINS, averagingDepth || 16);
        }

        if (averagingProcessor) {
            averagingProcessor.setDepth(averagingDepth || 16);
        }
        cohAlpha = averagingAlpha || 0.1;

        const metricsSet = new Set<string>(metrics);

        // --- PIPELINE REAL ---

        const meas = new Float32Array(measTimeDomain);
        const ref = new Float32Array(refTimeDomain);

        // 1. Calcular niveles Peak/RMS ANTES de aplicar ventana
        const refLevel = processSignalLevel(ref);
        const measLevel = processSignalLevel(meas);

        // 2. Delay compensation en la referencia
        if (compensationDelaySamples && compensationDelaySamples > 0) {
            circularShift(ref, compensationDelaySamples);
        }

        // 3. Aplicar ventana pre-FFT a ambos canales
        const winType = windowType || 'Hann';
        if (winType !== 'Rectangular') {
            windowProcessor.apply(meas, winType);
            windowProcessor.apply(ref, winType);
        }

        // 4. FFT de ambos canales → espectros complejos REALES
        fft(ref, fftRefReal, fftRefImag);       // X(f) REAL
        fft(meas, fftInputReal, fftInputImag);  // Y(f) REAL

        // Tomar solo la primera mitad (bins positivos)
        // fft() ya devuelve el espectro completo; usamos los primeros BINS

        // 5. Transfer Function H(f) = Y·conj(X) / |X|²
        const needMagnitude = metricsSet.has("Magnitude") || metricsSet.has("Impulse") || metricsSet.has("Step");
        const needPhase = metricsSet.has("Phase") || metricsSet.has("Group Delay");
        const needImpulse = metricsSet.has("Impulse") || metricsSet.has("Step");

        if (needMagnitude) {
            calculateMagnitude(
                fftInputReal, fftInputImag,
                fftRefReal, fftRefImag,
                outputMagnitude, hReal, hImag,
            );
        }

        // 6. Averaging sobre H(f)
        if (averagingProcessor && averagingType !== 'None' && needMagnitude) {
            if (averagingType === 'FIFO') {
                averagingProcessor.processFIFO(hReal, hImag, avgHReal, avgHImag);
                hReal.set(avgHReal);
                hImag.set(avgHImag);
                // Recalcular magnitud desde H promediada
                for (let k = 0; k < BINS; k++) {
                    const mag = Math.sqrt(hReal[k] * hReal[k] + hImag[k] * hImag[k]);
                    outputMagnitude[k] = 20 * Math.log10(mag + 1e-8);
                }
            } else if (averagingType === 'LPF') {
                averagingProcessor.processLPF(hReal, hImag, avgHReal, avgHImag, averagingAlpha || 0.1);
                hReal.set(avgHReal);
                hImag.set(avgHImag);
                for (let k = 0; k < BINS; k++) {
                    const mag = Math.sqrt(hReal[k] * hReal[k] + hImag[k] * hImag[k]);
                    outputMagnitude[k] = 20 * Math.log10(mag + 1e-8);
                }
            }
        }

        // 7. Phase de H(f)
        if (needPhase) {
            calculatePhase(
                fftInputReal, fftInputImag,
                fftRefReal, fftRefImag,
                outputPhase,
            );
        }

        // 8. Coherencia real
        feedCoherence(fftRefReal, fftRefImag, fftInputReal, fftInputImag, BINS);
        computeCoherence(outputCoherence, BINS);

        // 9. Impulse Response = IFFT(H(f))
        if (needImpulse) {
            deconvolve(
                fftInputReal, fftInputImag,
                fftRefReal, fftRefImag,
                outputImpulse,
                tempFullReal, tempFullImag,
                tempFullRealOut, tempFullImagOut
            );

            if (enableSourceWindow) {
                applySourceWindow(outputImpulse, sourceWindowWidthMs, sourceWindowOffsetMs, sr);
            }
        }

        // 10. Step Response
        if (metricsSet.has("Step")) {
            calculateStepResponse(outputImpulse, outputStep, sr);
        }

        // 11. Group Delay
        if (metricsSet.has("Group Delay")) {
            for (let k = 0; k < BINS; k++) {
                tempPhaseRadians[k] = (outputPhase[k] * Math.PI) / 180;
            }
            calculateGroupDelay(tempPhaseRadians, (sr / 2) / BINS, outputGroupDelay);
        }

        // 12. Crest Factor real (time-domain)
        const globalCF = measLevel.peakDb - measLevel.rmsDb;
        outputCrestFactor.fill(Math.max(0, Math.min(30, globalCF)));

        // 13. Auto delay compensation — detectar pico del IR
        let detectedDelaySamples = 0;
        if (autoDelayCompensation && needImpulse) {
            let peakVal = 0;
            for (let i = 0; i < outputImpulse.length; i++) {
                const absVal = Math.abs(outputImpulse[i]);
                if (absVal > peakVal) {
                    peakVal = absVal;
                    detectedDelaySamples = i;
                }
            }
        }

        // --- ENVIAR RESULTADOS ---
        const magBuf = outputMagnitude.buffer;
        const phaseBuf = outputPhase.buffer;
        const cohBuf = outputCoherence.buffer;
        const gdBuf = outputGroupDelay.buffer;
        const impBuf = outputImpulse.buffer;
        const stepBuf = outputStep.buffer;
        const cfBuf = outputCrestFactor.buffer;
        const hRealBuf = hReal.buffer;
        const hImagBuf = hImag.buffer;

        (self as any).postMessage({
            type: 'dsp-results',
            outputMagnitude: magBuf,
            outputPhase: phaseBuf,
            outputCoherence: cohBuf,
            outputGroupDelay: gdBuf,
            outputImpulse: impBuf,
            outputStep: stepBuf,
            outputCrestFactor: cfBuf,
            hReal: hRealBuf,
            hImag: hImagBuf,
            refPeakDb: refLevel.peakDb,
            refRmsDb: refLevel.rmsDb,
            measPeakDb: measLevel.peakDb,
            measRmsDb: measLevel.rmsDb,
            detectedDelaySamples,
        }, [magBuf, phaseBuf, cohBuf, gdBuf, impBuf, stepBuf, cfBuf, hRealBuf, hImagBuf]);

        // Realocar buffers transferidos
        outputMagnitude = new Float32Array(currentBins);
        outputPhase = new Float32Array(currentBins);
        outputCoherence = new Float32Array(currentBins);
        outputGroupDelay = new Float32Array(currentBins);
        outputImpulse = new Float32Array(currentFftSize);
        outputStep = new Float32Array(currentFftSize);
        outputCrestFactor = new Float32Array(currentBins);
        hReal = new Float32Array(currentBins);
        hImag = new Float32Array(currentBins);
    }
};
```

**NOTA:** Este código reemplaza el contenido COMPLETO del archivo `dspWorker.ts`. El archivo anterior tenía 564 líneas; el nuevo es autocontenido con las funciones de coherencia y delay inline.

---

## Tarea D3: Actualizar mathOrchestrator para pipeline dual-channel

**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`

**Instrucción:**

### Paso 1: Agregar buffers time-domain y delay tracking

Después de las declaraciones de `hReal`/`hImag` (~L35), agregar:

```typescript
    // Dual-channel time-domain buffers (recibidos del HAL)
    private measTimeDomain: Float32Array | null = null;
    private refTimeDomain: Float32Array | null = null;

    // Auto delay compensation tracking
    compensationDelaySamples = 0;
```

### Paso 2: Agregar método para recibir datos time-domain

Después de `unregisterQuadrant()` (~L136), agregar:

```typescript
    /**
     * Recibe datos time-domain dual-channel del HAL y dispara el pipeline DSP.
     */
    feedTimeDomain(measSamples: Float32Array, refSamples?: Float32Array): void {
        this.measTimeDomain = measSamples;
        this.refTimeDomain = refSamples || measSamples;
        this.dirty = true;
    }
```

### Paso 3: Modificar run() para enviar time-domain al worker

Reemplazar el contenido de `run()` (~L289-341) por:

```typescript
    run() {
        this.checkDirty();

        // Sin datos time-domain, no procesamos
        if (!this.measTimeDomain || !this.refTimeDomain) {
            return;
        }

        if (!this.dirty) {
            return;
        }

        this.lastMathTime = performance.now();

        if (this.worker) {
            const measCopy = new Float32Array(this.measTimeDomain);
            const refCopy = new Float32Array(this.refTimeDomain);

            this.worker.postMessage({
                type: 'run-dsp',
                measTimeDomain: measCopy.buffer,
                refTimeDomain: refCopy.buffer,
                BINS: this.BINS,
                FFT_SIZE: this.FFT_SIZE,
                metrics: Array.from(this.globalActiveMetrics),
                windowType: uiStore.windowType,
                weightingType: uiStore.weightingType,
                averagingType: uiStore.averagingType,
                averagingDepth: uiStore.averagingDepth,
                averagingAlpha: uiStore.averagingAlpha,
                enableSourceWindow: uiStore.enableSourceWindow,
                sourceWindowWidthMs: uiStore.sourceWindowWidthMs,
                sourceWindowOffsetMs: uiStore.sourceWindowOffsetMs,
                sampleRate: uiStore.sampleRate,
                compensationDelaySamples: uiStore.autoDelayCompensation
                    ? this.compensationDelaySamples
                    : Math.round(uiStore.compensationDelayMs * uiStore.sampleRate / 1000),
                autoDelayCompensation: uiStore.autoDelayCompensation,
            }, [measCopy.buffer, refCopy.buffer]);

            this.dirty = false;
        }
    }
```

### Paso 4: Modificar handleWorkerMessage() para meters independientes

En `handleWorkerMessage()` (~L85-128), reemplazar el bloque de meters (L103-107):

```diff
-            const inChCount = uiStore.inChannels.filter(Boolean).length || 2;
-            const outChCount = uiStore.outChannels.filter(Boolean).length || 2;
-            meterStore.updateIn(Array.from({ length: inChCount }, () => data.dbIn));
-            meterStore.updateOut(Array.from({ length: outChCount }, () => data.dbIn));
+            // Meters independientes por canal
+            meterStore.updateIn([data.refPeakDb ?? -60]);
+            meterStore.updateOut([data.measPeakDb ?? -60]);
+
+            // Auto delay compensation
+            if (data.detectedDelaySamples !== undefined) {
+                this.compensationDelaySamples = data.detectedDelaySamples;
+            }
```

### Paso 5: Modificar startTimer() para usar feedTimeDomain

Reemplazar `startTimer()` (~L75-83). El timer ya no llama `run(liveFrequencyData)` directamente — el trigger viene de `feedTimeDomain()`:

```typescript
    private startTimer(rate: number) {
        if (this.timerId) {
            clearInterval(this.timerId);
        }
        const intervalMs = 1000 / rate;
        this.timerId = setInterval(() => {
            this.run();
        }, intervalMs);
    }
```

### Paso 6: Eliminar parámetro `liveData` de run()

La firma de `run()` ya no necesita el parámetro. Verificar que no haya otras llamadas a `run()` con argumentos en el archivo. Si las hay, eliminar el argumento.

---

## Tarea D4: Conectar TabMedicion.svelte con el pipeline dual-channel

**Archivo a modificar:** `src/components/medicion/TabMedicion.svelte`

**Contexto:** `startCapture()` en `TabMedicion.svelte` (L169) pasa callbacks `onAudioData` y `onFrequencyData` al HAL, pero NO pasa `onTimeDomainData`. Sin esta callback, `mathOrchestrator.feedTimeDomain()` nunca recibe datos y el pipeline DSP no ejecuta — la magnitud queda en 0.

**Instrucción:**

### Paso 1: Agregar import de mathOrchestrator

Al inicio del `<script>` (L1-6), agregar:

```diff
     import { uiStore } from "$lib/stores/ui.svelte";
     import { traceManager } from "$lib/stores/traceManager.svelte";
     import { getAudioProvider } from "$lib/hal";
+    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";
```

### Paso 2: Agregar callback onTimeDomainData en startCapture

En `startMeasurement()` (L169-178), agregar la callback después de `onFrequencyData`:

```diff
             if (uiStore.measurementMode === "manual") {
                 await provider.startCapture({
                     onAudioData: () => {},
                     onFrequencyData: (data) => {
                         if (traceManager.liveFrequencyData.length !== data.length) {
                             traceManager.liveFrequencyData = new Float32Array(data.length);
                         }
                         traceManager.liveFrequencyData.set(data);
                         traceManager.version++;
                     },
+                    onTimeDomainData: (measSamples, refSamples) => {
+                        mathOrchestrator.feedTimeDomain(measSamples, refSamples);
+                    },
                 });
```

---

## Verificación Grupo D

```bash
npm run build
```

Si hay errores de tipo por propiedades que faltan (como `dbIn`), eliminar las referencias obsoletas.

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo E.

---

# GRUPO E — Features McCarthy (Fase 5)

---

## Tarea E1: Phase Unwrap mode

**Archivo a modificar:** `src/lib/dsp/canvasRenderers.ts`

**Instrucción:** En la función `drawPhasePath()`, agregar soporte para modo "Unwrap". Buscar la sección donde se lee `phaseData[k]` para dibujar la curva.

Agregar ANTES del loop de dibujo de la fase:

```typescript
    // Phase unwrap mode
    const phaseMode = metricConfigs?.["Phase"]?.unwrapMode || '±180';
    let phaseToRender = rawPhaseData;

    if (phaseMode === 'Unwrap') {
        const unwrapped = new Float32Array(rawPhaseData.length);
        unwrapped[0] = rawPhaseData[0];
        let accumulated = rawPhaseData[0];
        for (let k = 1; k < rawPhaseData.length; k++) {
            let diff = rawPhaseData[k] - rawPhaseData[k - 1];
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            accumulated += diff;
            unwrapped[k] = accumulated;
        }
        phaseToRender = unwrapped;
    }
```

Y usar `phaseToRender` en vez de `rawPhaseData` para el renderizado.

---

## Tarea E2: Agregar opción Unwrap al MetricConfigPopover

**Archivo a modificar:** `src/components/medicion/MetricConfigPopover.svelte`

**Instrucción:** En la sección del selector de Phase Display Mode, donde están las opciones `±180°` y `0..360°`, agregar `Unwrap`:

Buscar el select/opciones de Phase display mode y agregar:

```html
<option value="Unwrap">Unwrap (continuo)</option>
```

---

## Tarea E3: ETC (Energy Time Curve) display para Impulse

**Archivo a modificar:** `src/lib/dsp/canvasRenderers.ts`

**Instrucción:** En la función `drawTimeDomainPath()`, agregar modo ETC cuando el metric es "Impulse".

Agregar al inicio del cuerpo de la función, después de validar los parámetros:

```typescript
    // ETC mode: Energy Time Curve (dB display of impulse)
    if (metric === "Impulse" && metricConfigs?.["Impulse"]?.modeY === 'ETC') {
        const etcData = new Float32Array(data.length);
        // Encontrar pico para referencia 0 dB
        let peakVal = 0;
        for (let i = 0; i < data.length; i++) {
            const absVal = Math.abs(data[i]);
            if (absVal > peakVal) peakVal = absVal;
        }
        const peakRef = 20 * Math.log10(peakVal + 1e-12);
        for (let i = 0; i < data.length; i++) {
            etcData[i] = 20 * Math.log10(Math.abs(data[i]) + 1e-12) - peakRef;
        }
        // Usar etcData para el renderizado con eje Y en dB (-60 a 0)
        data = etcData;
    }
```

**NOTA:** Si `data` es `const`, cambiar a `let` en la firma de la función o crear variable local.

---

## Tarea E4: Agregar opción ETC al MetricConfigPopover

**Archivo a modificar:** `src/components/medicion/MetricConfigPopover.svelte`

**Instrucción:** En la sección de configuración de Impulse, agregar un toggle o select para el modo ETC:

```html
<!-- En la sección de Impulse config -->
<label>
    <input type="checkbox" 
           checked={metricConfigs["Impulse"]?.modeY === 'ETC'}
           onchange={(e) => {
               metricConfigs["Impulse"] = {
                   ...metricConfigs["Impulse"],
                   modeY: e.currentTarget.checked ? 'ETC' : 'Linear'
               };
           }} />
    ETC (dB)
</label>
```

---

## Tarea E5: Amplitude thresholding en averaging

**Archivo a modificar:** `src/lib/dsp/averaging.ts`

**Instrucción:**

### Paso 1: Agregar buffers de último valor válido a la clase

Después de `private lpfImag` (~L16), agregar:

```typescript
    private lastValidReal: Float32Array;
    private lastValidImag: Float32Array;
```

Inicializar en el constructor después de `this.lpfImag`:

```typescript
        this.lastValidReal = new Float32Array(bins);
        this.lastValidImag = new Float32Array(bins);
```

### Paso 2: Agregar parámetro threshold a processFIFO

Cambiar la firma:

```diff
-    public processFIFO(inReal: Float32Array, inImag: Float32Array, outReal: Float32Array, outImag: Float32Array): void {
+    public processFIFO(inReal: Float32Array, inImag: Float32Array, outReal: Float32Array, outImag: Float32Array, thresholdDb?: number): void {
```

Agregar al inicio del cuerpo, ANTES de `this.bufferReal[this.writeIdx].set(inReal)`:

```typescript
        // Amplitude thresholding: descartar bins debajo del umbral
        if (thresholdDb !== undefined && thresholdDb > -120) {
            for (let i = 0; i < this.bins; i++) {
                const mag = Math.sqrt(inReal[i] * inReal[i] + inImag[i] * inImag[i]);
                const db = 20 * Math.log10(mag + 1e-12);
                if (db < thresholdDb) {
                    inReal[i] = this.lastValidReal[i];
                    inImag[i] = this.lastValidImag[i];
                } else {
                    this.lastValidReal[i] = inReal[i];
                    this.lastValidImag[i] = inImag[i];
                }
            }
        }
```

### Paso 3: Actualizar setDepth para realocar lastValid

En `setDepth()`, agregar después de las realocaciones existentes:

```typescript
        this.lastValidReal = new Float32Array(this.bins);
        this.lastValidImag = new Float32Array(this.bins);
```

### Paso 4: Actualizar reset

En `reset()`, agregar:

```typescript
        this.lastValidReal.fill(0);
        this.lastValidImag.fill(0);
```

---

## Verificación Grupo E

```bash
npm run build
```

### ⛔ STOP — Pipeline real completado. Reportá todos los cambios al usuario.

---

# Resumen de archivos por tarea

| Tarea | Archivo | Tipo |
|-------|---------|:----:|
| A1 | `src/lib/stores/ui.svelte.ts` | Modify |
| A2 | `src/lib/hal/types.ts` | Modify |
| B1 | `static/worklets/audio-capture-processor.js` | Modify |
| C1 | `src/lib/hal/web/WebAudioProvider.ts` | Modify |
| D1 | `src/lib/dsp/dspWorker.ts` | Modify (eliminar) |
| D2 | `src/lib/dsp/dspWorker.ts` | Modify (reescribir) |
| D3 | `src/lib/stores/mathOrchestrator.svelte.ts` | Modify |
| D4 | `src/components/medicion/TabMedicion.svelte` | Modify |
| E1 | `src/lib/dsp/canvasRenderers.ts` | Modify |
| E2 | `src/components/medicion/MetricConfigPopover.svelte` | Modify |
| E3 | `src/lib/dsp/canvasRenderers.ts` | Modify |
| E4 | `src/components/medicion/MetricConfigPopover.svelte` | Modify |
| E5 | `src/lib/dsp/averaging.ts` | Modify |
