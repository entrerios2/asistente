# Fix Pipeline de Captura: postMessage + Double-Buffer SAB

Arreglar la race condition en el path SAB que destruye la coherencia. Implementar en dos fases: primero postMessage como fix inmediato, luego Double-Buffer SAB como path principal.

## Fase 1: postMessage como path principal

### Cambios mínimos — usar el path que ya funciona correctamente.

---

#### [MODIFY] [WebAudioProvider.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/hal/web/WebAudioProvider.ts)

1. **Eliminar la creación de SABs** en `startCapture()` (líneas 96-104)
2. **Eliminar el path SAB** en `readData()` (líneas 147-154): quitar el bloque `if (hasSAB && ...)`, dejar solo el path postMessage
3. **Simplificar init del worklet**: no enviar SABs al worklet
4. **Registrar listener de postMessage** para recibir `DUAL_BLOCK`:
   ```ts
   this.workletNode.port.addEventListener('message', (event) => {
       if (event.data?.type === 'DUAL_BLOCK') {
           this.refTimeDomain = new Float32Array(event.data.ref);
           this.measTimeDomain = new Float32Array(event.data.meas);
       }
   });
   this.workletNode.port.start();
   ```
5. En `readData()`, usar los datos recibidos via postMessage y llamar a `listener.onTimeDomainData()` solo cuando hay datos nuevos

#### [MODIFY] [audio-capture-processor.js](file:///c:/Users/Abel/Documents/Asistente/asistente/static/worklets/audio-capture-processor.js)

No requiere cambios — el path postMessage ya está implementado correctamente (líneas 134-147). Sin SABs, siempre toma el path `!this.hasSAB`.

---

## Fase 2: Double-Buffer SAB (con postMessage como fallback)

### Arquitectura

```
Worklet (audio thread)                    Main thread
┌───────────────────────┐                ┌────────────────────┐
│ Ring buffer local      │                │                    │
│ (ref + meas)          │                │ readData() en rAF  │
│         │             │                │         │          │
│         ▼             │                │         ▼          │
│ Frame completo?       │                │ Atomics.load(flag) │
│    │                  │                │    │               │
│    ▼                  │                │    ▼               │
│ Copiar ordenado a     │   ◄── SAB ──►  │ Leer del banco     │
│ banco SAB (A o B)     │                │ señalizado         │
│    │                  │                │    │               │
│    ▼                  │                │    ▼               │
│ Atomics.store(ready)  │                │ feedTimeDomain()   │
│ Swap banco            │                │                    │
└───────────────────────┘                └────────────────────┘
```

---

#### [MODIFY] [WebAudioProvider.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/hal/web/WebAudioProvider.ts)

1. **Crear SABs con tamaño doble** para double-buffer:
   ```ts
   this.refSab = new SharedArrayBuffer(fftSize * 2 * Float32Array.BYTES_PER_ELEMENT);
   this.measSab = new SharedArrayBuffer(fftSize * 2 * Float32Array.BYTES_PER_ELEMENT);
   this.flagSab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
   // flagArray[0] = readyBank (-1=ninguno, 0=banco A, 1=banco B)
   // flagArray[1] = (reservado)
   this.flagArray = new Int32Array(this.flagSab);
   Atomics.store(this.flagArray, 0, -1);
   ```

2. **Path SAB en readData()**: leer del banco señalizado
   ```ts
   const bank = Atomics.load(this.flagArray, 0);
   if (bank >= 0) {
       const offset = bank * fftSize;
       const refData = new Float32Array(fftSize);
       const measData = new Float32Array(fftSize);
       // Copiar desde el banco correcto del SAB
       refData.set(new Float32Array(this.refSab, offset * 4, fftSize));
       measData.set(new Float32Array(this.measSab, offset * 4, fftSize));
       Atomics.store(this.flagArray, 0, -1); // marcar como leído
       listener.onTimeDomainData(measData, refData);
   }
   ```

3. **Mantener fallback postMessage** si SAB no está disponible

#### [MODIFY] [audio-capture-processor.js](file:///c:/Users/Abel/Documents/Asistente/asistente/static/worklets/audio-capture-processor.js)

1. **Agregar ring buffers locales** (no SAB) para la escritura circular:
   ```js
   this.ringRef = new Float32Array(this.bufferSize);
   this.ringMeas = new Float32Array(this.bufferSize);
   ```

2. **Escribir al ring buffer local** (no al SAB):
   ```js
   this.ringRef[this.writeIdx] = refCh[i];
   this.ringMeas[this.writeIdx] = measCh[i];
   this.writeIdx = (this.writeIdx + 1) % this.bufferSize;
   ```

3. **Al completar un frame, copiar ordenado al banco SAB**:
   ```js
   if (this.samplesAccumulated >= this.fftSize) {
       if (this.hasSAB) {
           const offset = this.currentBank * this.fftSize;
           for (let i = 0; i < this.fftSize; i++) {
               const readIdx = (this.writeIdx - this.fftSize + i + this.bufferSize) % this.bufferSize;
               this.refBuffer[offset + i] = this.ringRef[readIdx];
               this.measBuffer[offset + i] = this.ringMeas[readIdx];
           }
           Atomics.store(this.flagArray, 0, this.currentBank);
           this.currentBank = 1 - this.currentBank;
       } else {
           // postMessage fallback (ya existente)
       }
   }
   ```

4. **Inicializar `currentBank = 0`** en el constructor y en `init`

---

## Verificación

1. **Fase 1**: activar medición con generador + loopback → verificar que la coherencia es alta (>0.8 en la mayor parte del rango)
2. **Fase 2**: verificar que la coherencia es idéntica o mejor que en Fase 1
3. **Fallback**: verificar que sin SAB (ej. Firefox sin headers COOP/COEP) sigue funcionando via postMessage
