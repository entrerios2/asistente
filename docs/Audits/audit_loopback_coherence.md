# Análisis Loopback: Diagnóstico Definitivo y Soluciones

## Resumen del problema
La coherencia en modo loopback es baja porque los bloques de ref y meas llegan desalineados temporalmente al DSP worker, destruyendo la correlación cruzada.

---

## Cómo funciona OSM (referencia correcta)

### Arquitectura de OSM
```
GeneratorThread ──signal(sampleOut)──> Measurement::newSampleFromGenerator()
                                          │
                                          ▼
                                    m_loopBuffer.write(sample)
                                          │
                                          ▼ (writeData, sample a sample)
                     ┌────────────────────┼─────────────────────┐
                     │                    │                     │
              dataChanel(mic)      refChanel(mic)     forceRef(loop)
                     │                    │                     │
                     ▼                    ▼                     ▼
              m_data.write()      m_reference.write()    m_reference.write(loopSample)
```

**Puntos clave:**
1. **Escritura sincrónica sample-a-sample**: cada sample del generador se escribe al loop buffer en el mismo callback que cada sample del micrófono
2. **Sin race conditions**: todo ocurre en el audio callback thread (o con mutex)
3. **Ring buffers separados** para data y reference, consumidos sincrónicamente por `transform()`

### Coherencia de OSM (idéntica a la nuestra)
- FIFO circular de depth 21
- `Crr += new - old`, `Cmm += new - old`, `Crm += new - old`
- `γ = |Crm| / sqrt(Crr · Cmm)`
- Nuestra implementación (`feedCoherenceFIFO`/`computeCoherenceFIFO`) es **correcta y equivalente**

---

## Bugs en nuestra implementación

### 🔴 Bug 1: Race condition en el path SAB (CRÍTICO)

**El worklet** escribe circularmente en los SABs y señaliza con `Atomics.store(flag, 1)`.
**El main thread** lee en `requestAnimationFrame` (~16ms después).

En esos ~16ms, a 48kHz, el worklet escribe **768 samples más**, sobreescribiendo el inicio del bloque que el main thread debería leer.

```
                    ┌─── SAB buffer (8192 samples) ──────────────────────────┐
Momento de señal:   [████████ frame completo ██████████████████████████████]
                    writeIdx=0 ──────────────────────────────────────► writeIdx=0
                    
16ms después:       [▓▓▓▓▓▓▓▓██████████████████████████████████████████▓▓]
                    ↑ sobreescrito ↑                                    ↑ sobreescrito
                    samples 0-767 ya son del SIGUIENTE frame
```

> [!CAUTION]
> El main thread lee **datos contaminados**: ~768 samples del frame N+1 mezclados con ~7424 samples del frame N. Esto destruye la coherencia.

### 🔴 Bug 2: Sin reordenamiento en path SAB (con overlap)

Cuando hay overlap > 0, `writeIdx` no está en 0 al momento de la señal. El buffer circular contiene datos que empiezan en medio. El main thread lee linealmente sin reordenar.

El path postMessage SÍ reordena correctamente:
```js
for (let i = 0; i < this.fftSize; i++) {
    const readIdx = (this.refWriteIdx - this.fftSize + i + this.bufferSize) % this.bufferSize;
    refBlock[i] = this.refBuffer[readIdx];
}
```

### 🟡 Bug 3: readData poll rate (menor)

`readData()` corre en `requestAnimationFrame` (~60 fps = 16ms). Con FFT de 8192 samples a 48kHz, un frame dura 170ms. Pero con overlap 50%, un frame se entrega cada 85ms. Como readData corre cada 16ms, puede leer el mismo frame varias veces (reprocesar datos idénticos).

---

## Alternativas de solución

### Alternativa A: Eliminar SAB, usar solo postMessage

El path postMessage **ya funciona correctamente**: reordena los ring buffers y envía copias limpias.

```js
// Ya existe en el worklet (path sin SAB):
const refBlock = new Float32Array(this.fftSize);
const measBlock = new Float32Array(this.fftSize);
for (let i = 0; i < this.fftSize; i++) {
    const readIdx = (this.refWriteIdx - this.fftSize + i + this.bufferSize) % this.bufferSize;
    refBlock[i] = this.refBuffer[readIdx];
    measBlock[i] = this.measBuffer[readIdx];
}
this.port.postMessage({ type: 'DUAL_BLOCK', ref: refBlock.buffer, meas: measBlock.buffer },
    [refBlock.buffer, measBlock.buffer]);
```

**Cambio**: eliminar todo el código SAB y forzar siempre el path postMessage.

---

### Alternativa B: SAB con escritura lineal (sin ring buffer)

Reemplazar el ring buffer circular por escritura lineal directa al SAB. Cuando se completa un frame, señalizar y resetear el índice.

```js
// Worklet escribe linealmente:
this.refSab[this.writeIdx] = refCh[i];
this.measSab[this.writeIdx] = measCh[i];
this.writeIdx++;

if (this.writeIdx >= this.fftSize) {
    Atomics.store(this.flagArray, 0, 1); // frame listo
    this.writeIdx = 0;
    // Problema: ¡empieza a sobreescribir inmediatamente!
}
```

> [!WARNING]
> No resuelve la race condition. El worklet sigue sobreescribiendo desde posición 0 después de señalizar. Es equivalente al caso actual sin overlap.

---

### Alternativa C: SAB Double-Buffer (ping-pong)

Dos bancos en el SAB. El worklet escribe en uno mientras el main thread lee del otro.

```
SAB layout:
  refSab  = [banco_0 (fftSize floats) | banco_1 (fftSize floats)]  → 2× fftSize
  measSab = [banco_0 (fftSize floats) | banco_1 (fftSize floats)]  → 2× fftSize  
  flagSab = Int32Array[2]:
    [0] = readyBank (-1 = ninguno, 0 o 1 = banco listo para leer)
    [1] = (reservado)
```

**Worklet:**
```js
// Cuando frame completo → copiar ordenado al banco actual
const offset = this.currentBank * this.fftSize;
for (let i = 0; i < this.fftSize; i++) {
    const readIdx = (this.writeIdx - this.fftSize + i + this.ringSize) % this.ringSize;
    this.refSab[offset + i] = this.ringRef[readIdx];
    this.measSab[offset + i] = this.ringMeas[readIdx];
}
Atomics.store(this.flagArray, 0, this.currentBank);
this.currentBank = 1 - this.currentBank;
```

**Main thread:**
```js
const bank = Atomics.load(this.flagArray, 0);
if (bank >= 0) {
    const offset = bank * fftSize;
    const ref = Float32Array.from(new Float32Array(this.refSab, offset * 4, fftSize));
    const meas = Float32Array.from(new Float32Array(this.measSab, offset * 4, fftSize));
    Atomics.store(this.flagArray, 0, -1);
    listener.onTimeDomainData(meas, ref);
}
```

---

### Alternativa D: SAB con writeIdx compartido

Compartir el `writeIdx` via un SAB adicional (o un int dentro de flagSab). El main thread lee el writeIdx atómicamente y reordena los datos.

```js
// Worklet: al señalizar, escribir writeIdx
Atomics.store(this.flagArray, 0, 1);      // frame ready
Atomics.store(this.flagArray, 1, this.writeIdx);  // posición actual

// Main thread: leer writeIdx y reordenar
const writeIdx = Atomics.load(this.flagArray, 1);
for (let i = 0; i < fftSize; i++) {
    const readIdx = (writeIdx - fftSize + i + fftSize) % fftSize;
    refData[i] = rawRef[readIdx];
}
```

---

### Alternativa E: Mover DSP al AudioWorklet

Procesar FFT, coherencia y transfer function directamente dentro del AudioWorkletProcessor. Elimina la necesidad de transferir datos time-domain al main thread.

```js
// Dentro del worklet:
process(inputs) {
    // ... acumular samples ...
    if (frameReady) {
        this.computeFFT(refBlock, measBlock);
        this.computeCoherence();
        this.computeMagnitude();
        // Solo enviar resultados (frequency-domain) al main thread
        this.port.postMessage({ type: 'dsp-results', magnitude, phase, coherence });
    }
}
```

---

## Tabla comparativa

| | A: Solo postMessage | B: SAB lineal | C: Double-Buffer | D: WriteIdx compartido | E: DSP en Worklet |
|---|---|---|---|---|---|
| **Race condition** | ✅ Eliminada (copia atómica) | ❌ Persiste | ✅ Eliminada | ⚠️ Reducida (puede leer durante copia) | ✅ Eliminada |
| **Overlap correcto** | ✅ Ya implementado | ❌ No soporta | ✅ Sí | ✅ Sí | ✅ Sí |
| **Latencia** | ⚠️ ~1-3ms (message queue) | ✅ Mínima | ✅ Mínima | ⚠️ Race durante copia | ✅ Cero (inline) |
| **GC pressure** | ⚠️ Aloca 2× Float32Array por frame | ✅ Ninguna | ✅ Ninguna (SAB compartido) | ✅ Ninguna | ✅ Ninguna |
| **Complejidad de cambio** | 🟢 Mínima (eliminar código) | 🟢 Baja | 🟡 Media | 🟡 Media | 🔴 Alta (refactor completo) |
| **Compatibilidad browser** | ✅ Universal | ⚠️ Requiere SAB | ⚠️ Requiere SAB | ⚠️ Requiere SAB | ✅ Universal |
| **Pérdida de frames** | ⚠️ Posible (message queue llena) | ⚠️ Race condition | ✅ Solo pierde frames viejos | ⚠️ Race durante lectura | ✅ Nunca |
| **CPU extra en audio thread** | ⚠️ Copia + serialización | 🟢 Ninguna | ⚠️ Copia ordenada (8k×2 floats) | 🟢 Ninguna | 🔴 FFT completa en RT thread |
| **Datos siempre consistentes** | ✅ Sí | ❌ No | ✅ Sí | ⚠️ Solo si lectura es rápida | ✅ Sí |

---

## Análisis detallado por alternativa

### A: Solo postMessage
- **Pro principal**: ya está implementado y funciona correctamente en el fallback
- **Pro**: compatible con todos los browsers (no requiere SAB/COOP/COEP headers)
- **Contra**: ~1-3ms de latencia extra por el message loop (irrelevante para nuestro caso: el DSP corre a 24 fps)
- **Contra**: aloca y transfiere 2 ArrayBuffers por frame (~64KB cada uno con FFT 8192). Con transferables el costo es bajo, pero genera GC pressure
- **Contra**: si el main thread está ocupado, los mensajes se acumulan en la cola

### B: SAB lineal
- **No recomendada**: no resuelve el bug principal (race condition). Incluida solo para completar

### C: Double-Buffer SAB
- **Pro**: zero-copy desde el punto de vista del main thread (lee directamente del SAB)
- **Pro**: race-free por diseño (productor y consumidor nunca tocan el mismo banco)
- **Pro**: maneja overlap correctamente (el worklet copia reordenado al banco)
- **Contra**: duplica el tamaño del SAB (2× fftSize por canal = ~128KB para FFT 8192)
- **Contra**: la copia ordenada en el audio thread toma ~0.1ms (aceptable para quantums de 2.67ms)
- **Contra**: requiere SAB + COOP/COEP headers

### D: WriteIdx compartido
- **Pro**: mínimo cambio en el worklet (solo agregar una escritura atómica)
- **Contra**: **no elimina la race condition** completamente — mientras el main thread lee y reordena, el worklet puede estar sobreescribiendo esos mismos datos en el SAB circular
- **Contra**: solo funciona sin overlap (con overlap, los datos están desordenados y la ventana de race es más larga)

### E: DSP en Worklet
- **Pro**: arquitectura ideal a largo plazo (como OSM, todo en el audio thread)
- **Contra**: refactor masivo — habría que mover FFT, coherencia, deconvolución, averaging al worklet
- **Contra**: el audio thread es real-time con deadline estricto (~2.67ms por quantum de 128 samples); FFT de 8192 puntos puede exceder este deadline
- **Contra**: sin acceso a `import` en AudioWorklet (vanilla JS)

---

## Recomendación

### Corto plazo: **Alternativa A (solo postMessage)**

Es la solución más simple y ya funciona. El overhead de postMessage es despreciable para nuestro caso de uso (procesamos a 24 fps, no 375 fps):

- Latencia postMessage: ~1-3ms
- Intervalo entre frames DSP: ~42ms (24 fps)
- Ratio overhead: **< 7%**

El GC pressure de 2× Float32Array por frame (con transferables) es mínimo comparado con las alocaciones que ya hacemos en el DSP worker.

> [!TIP]
> Podemos dejar el código SAB preparado pero deshabilitado para habilitar en el futuro si adoptamos la alternativa C.

### Mediano plazo: **Alternativa C (Double-Buffer SAB)**

Si en el futuro necesitamos latencia mínima o rates DSP más altos, implementar el double-buffer. Los ~128KB extra de SAB son irrelevantes.

### Largo plazo: **Alternativa E (DSP en Worklet)**

Solo si migramos a un modelo donde el FFT se procesa incrementalmente o usamos WASM para el procesamiento pesado dentro del worklet.
