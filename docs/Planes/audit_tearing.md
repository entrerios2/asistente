# Análisis: Tearing / Snap-back en gráficos al medir

## Pipeline completo (timing)

```
┌─ Audio thread (worklet) ─────────────┐
│ process() cada ~2.67ms (128 samples) │
│ → Acumula en ring buffer             │
│ → Atomics.store(flag, 1) al llegar   │
│   a fftSize (8192) samples           │
└──────────────────────────────────────┘
           ↓ SAB + Atomics flag
┌─ Main thread: readData rAF ──────────┐
│ 60fps: lee SAB si flag === 1         │
│ → feedTimeDomain(meas, ref)          │
│ → dirty = true                       │
└──────────────────────────────────────┘
           ↓ dirty flag
┌─ Main thread: setInterval 15Hz ──────┐
│ run() → si dirty:                    │
│   lastMathTime = performance.now()   │
│   worker.postMessage(datos)          │
│   dirty = false                      │
└──────────────────────────────────────┘
           ↓ worker postMessage
┌─ Worker thread: dspWorker ───────────┐
│ FFT, transfer function, etc          │
│ → postMessage('dsp-results', ...)    │
└──────────────────────────────────────┘
           ↓ onmessage
┌─ Main thread: handleWorkerMessage ───┐
│ outputMagnitude = new Float32Array   │
│ version++                            │
└──────────────────────────────────────┘
           ↓ version change
┌─ Main thread: renderLoop rAF 60fps ──┐
│ if (version changed):                │
│   updateHistory() → prev = interp    │
│ interpolateBuffers(dirty, orch):     │
│   t = (now - lastMathTime) / throttle│  ← BUG AQUÍ
│   interp = prev*(1-t) + current*t    │
│ draw()                               │
└──────────────────────────────────────┘
```

## Causa raíz: desfase temporal en la interpolación

### El problema

En [interpolationEngine.ts:83](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/interpolationEngine.ts#L83):

```typescript
const t = snap ? 1.0 : Math.max(0, Math.min(1.0, timeElapsed / throttleMs));
```

Donde `timeElapsed = now - mathOrchestrator.lastMathTime`.

**El timeline real es:**

```
T0: run() → lastMathTime = now, envía al worker
T0+5ms: worker responde → version++, outputMagnitude actualizado
T0+16ms: renderLoop detecta version cambió
         → updateHistory(): prev = interp (que era ~el valor ANTERIOR)
         → interpolateBuffers: t = (T0+16 - T0) / 66ms = 0.24
         → interp = prev * 0.76 + output * 0.24
T0+33ms: renderLoop
         → t = (T0+33 - T0) / 66ms = 0.50
         → interp = prev * 0.50 + output * 0.50  (progresando...)
T0+66ms: t = 1.0 → interp = output (llegó)
T0+66ms: run() dispara de nuevo → lastMathTime = T0+66
T0+71ms: worker responde → version++
T0+83ms: renderLoop detecta nuevo version
         → updateHistory(): prev = interp (era output viejo)
         → t = (T0+83 - T0+66) / 66ms = 0.26
         → interp = prev * 0.74 + NEW_output * 0.26  ← SNAP BACK A prev
```

### ¿Por qué se ve como "tearing"?

1. **El `updateHistory()` se ejecuta cuando `version` cambia** — pero en ese instante, el render loop ya avanzó `t` casi hasta 1.0 (la curva está mostrando el output actual)
2. **Al hacer `prev = interp`**, prev queda como una mezcla del valor actual y el anterior
3. **Inmediatamente después, `t` resetea a ~0.25** porque `lastMathTime` ya se actualizó
4. **La curva salta hacia atrás** desde `output_actual` a `prev * 0.75 + output_nuevo * 0.25`

El efecto es un movimiento **diente de sierra**: avanza suavemente → salta atrás → avanza suavemente → salta atrás.

### Factores agravantes

- **`lastMathTime` se setea en `run()`** (cuando se envía al worker), no cuando el resultado llega. Esto crea un gap de ~5-15ms donde `t` ya avanzó pero los datos no cambiaron.
- **La respuesta del worker es asíncrona**: entre `run()` y `handleWorkerMessage()` pasan varios ms, durante los cuales `t` sigue creciendo pero interpola contra datos viejos.

## Solución propuesta

Cambiar `lastMathTime` para que se setee cuando **llegan los resultados**, no cuando se envían:

```diff
// mathOrchestrator.svelte.ts

  private handleWorkerMessage(data: any) {
      if (data.type === 'dsp-results') {
+         this.lastMathTime = performance.now(); // ← Mover aquí
          this.outputMagnitude = new Float32Array(data.outputMagnitude);
          ...
          this.version++;
      }
  }

  run() {
      ...
-     this.lastMathTime = performance.now();
      if (this.worker) {
          ...
      }
  }
```

Y en `interpolateBuffers`, guardar el timestamp del **prev** snapshot para que la interpolación sea entre el resultado anterior y el nuevo:

```diff
// interpolationEngine.ts

  public updateHistory() {
+     this.historyTime = performance.now();
      this.prevMagnitude.set(this.interpMagnitude);
      ...
  }

  public interpolateBuffers(snap, mathOrchestrator) {
      const now = performance.now();
-     const timeElapsed = now - mathOrchestrator.lastMathTime;
-     if (!snap && timeElapsed > throttleMs * 2) return;
-     const t = snap ? 1.0 : Math.max(0, Math.min(1.0, timeElapsed / throttleMs));
+     const timeSinceNew = now - mathOrchestrator.lastMathTime;
+     const interval = mathOrchestrator.lastMathTime - this.historyTime;
+     if (!snap && timeSinceNew > throttleMs * 2) return;
+     const t = snap ? 1.0 : Math.min(1.0, timeSinceNew / Math.max(interval, throttleMs));
  }
```

Esto asegura que `t` interpole suavemente entre el resultado previo y el actual, basándose en el **intervalo real entre resultados** en vez del throttle teórico.

## ¿Querés que lo implemente?
