# Prompts de Implementación — Corrección de Gráficos (Suavizado Temporal + Curvas)

Este documento contiene instrucciones detalladas para corregir todos los problemas de suavizado identificados en la auditoría de gráficos. Se organiza en 3 fases:

- **Fase A:** Suavizado temporal — agregar métricas faltantes al InterpolationEngine
- **Fase B:** Suavizado de curvas — migrar todos los `lineTo` a curvas suaves
- **Fase C:** Eliminación de allocaciones por frame en hot paths

**Agente: Ejecuta cada bloque secuencialmente. Después de cada Fase, verifica que `npm run build` y `npm run check` completen sin errores.**

---

# FASE A — Suavizado Temporal (InterpolationEngine)

**Problema:** Las métricas Phase Delay, Crest Factor, Nyquist (hReal/hImag) no pasan por el motor de interpolación temporal. Se renderizan directamente desde los buffers crudos del mathOrchestrator, causando saltos abruptos entre frames DSP.

---

## Tarea A.1: Agregar buffers de interpolación al InterpolationEngine

**Archivo a modificar:** `src/lib/dsp/interpolationEngine.ts`

**Instrucción:**

Agregar buffers interpolados y previos para CrestFactor, hReal, hImag. Incluirlos en `reset()`, `interpolateBuffers()` y `updateHistory()`.

1. Después de las declaraciones existentes de `interpStep` y `prevGroupDelay` (líneas 11-16), agregar:

```diff
     public interpStep: Float32Array;
+    public interpCrestFactor: Float32Array;
+    public interpHReal: Float32Array;
+    public interpHImag: Float32Array;

     public prevMagnitude: Float32Array;
     public prevPhase: Float32Array;
     public prevCoherence: Float32Array;
     public prevGroupDelay: Float32Array;
+    public prevCrestFactor: Float32Array;
+    public prevHReal: Float32Array;
+    public prevHImag: Float32Array;
```

2. En el `constructor()`, después de `this.interpStep = new Float32Array(this.FFT_SIZE);` agregar:

```typescript
        this.interpCrestFactor = new Float32Array(this.BINS);
        this.interpHReal = new Float32Array(this.BINS);
        this.interpHImag = new Float32Array(this.BINS);

        this.prevCrestFactor = new Float32Array(this.BINS);
        this.prevHReal = new Float32Array(this.BINS);
        this.prevHImag = new Float32Array(this.BINS);
```

3. En `reset()`, dentro del loop `for (let i = 0; i < this.BINS; i++)`, agregar:

```diff
             this.interpGroupDelay[i] = 0;
+            this.interpCrestFactor[i] = 0;
+            this.interpHReal[i] = 0;
+            this.interpHImag[i] = 0;

             this.prevMagnitude[i] = -50;
             this.prevPhase[i] = 0;
             this.prevCoherence[i] = 0.98;
             this.prevGroupDelay[i] = 0;
+            this.prevCrestFactor[i] = 0;
+            this.prevHReal[i] = 0;
+            this.prevHImag[i] = 0;
```

4. En `interpolateBuffers()`, dentro del loop de frecuencia (después de la línea `this.interpGroupDelay[i] = ...`), agregar:

```diff
             this.interpGroupDelay[i] = this.prevGroupDelay[i] * (1 - t) + mathOrchestrator.outputGroupDelay[i] * t;
+            this.interpCrestFactor[i] = this.prevCrestFactor[i] * (1 - t) + (mathOrchestrator.outputCrestFactor?.[i] ?? 0) * t;
+            this.interpHReal[i] = this.prevHReal[i] * (1 - t) + (mathOrchestrator.hReal?.[i] ?? 0) * t;
+            this.interpHImag[i] = this.prevHImag[i] * (1 - t) + (mathOrchestrator.hImag?.[i] ?? 0) * t;
```

Nota: usar optional chaining `?.` y fallback `?? 0` porque `outputCrestFactor` puede tener distinto tamaño durante un cambio de FFT size.

5. En `updateHistory()`, después de `this.prevGroupDelay.set(this.interpGroupDelay);`, agregar:

```diff
         this.prevGroupDelay.set(this.interpGroupDelay);
+        this.prevCrestFactor.set(this.interpCrestFactor);
+        this.prevHReal.set(this.interpHReal);
+        this.prevHImag.set(this.interpHImag);
```

6. Actualizar el guard `freqLen` en `interpolateBuffers()` para incluir los nuevos buffers:

```diff
         const freqLen = Math.min(
             this.BINS,
             mathOrchestrator.outputMagnitude?.length ?? this.BINS,
             mathOrchestrator.outputPhase?.length ?? this.BINS,
             mathOrchestrator.outputCoherence?.length ?? this.BINS,
             mathOrchestrator.outputGroupDelay?.length ?? this.BINS,
+            mathOrchestrator.outputCrestFactor?.length ?? this.BINS,
+            mathOrchestrator.hReal?.length ?? this.BINS,
+            mathOrchestrator.hImag?.length ?? this.BINS,
         );
```

---

## Tarea A.2: Pasar buffers interpolados al render loop

**Archivo a modificar:** `src/lib/stores/useRenderLoop.ts`

**Instrucción:**

En la función `executeDraw()`, donde se construye el objeto `DrawParams` (alrededor de líneas 173-221), cambiar las referencias crudas del orchestrator por las interpoladas:

```diff
             hReal: p.hReal,
             hImag: p.hImag,
             outputCrestFactor: p.outputCrestFactor,
```

Esto ya recibe los valores desde `Quadrant.svelte`, así que no se necesita cambiar aquí. El cambio está en `Quadrant.svelte` (Tarea A.3).

---

## Tarea A.3: Actualizar Quadrant.svelte para pasar datos interpolados

**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

**Instrucción:**

En la función `draw()` (alrededor de línea 314-315), cambiar las referencias directas al mathOrchestrator por las del interpEngine:

```diff
-            hReal: mathOrchestrator.hReal, hImag: mathOrchestrator.hImag,
-            outputCrestFactor: mathOrchestrator.outputCrestFactor,
+            hReal: interpEngine.interpHReal, hImag: interpEngine.interpHImag,
+            outputCrestFactor: interpEngine.interpCrestFactor,
```

---

## Verificación Fase A

```bash
npm run build
npm run check
```

Verificación visual: activar Crest Factor, Phase Delay o Nyquist y observar que las transiciones entre frames DSP son ahora suaves en lugar de saltos abruptos.

---

# FASE B — Suavizado de Curvas (lineTo → curvas suaves)

**Problema:** Múltiples funciones de rendering usan `lineTo` produciendo curvas con segmentos rectos visibles. Se deben migrar a interpolación cuadrática o cúbica.

---

## Tarea B.1: `drawSimulatedMagnitudePath` — lineTo → quadraticCurveTo

**Archivo a modificar:** `src/lib/dsp/renderers/metricRenderers.ts`

**Instrucción:**

En la función `drawSimulatedMagnitudePath`, reemplazar el bloque de dibujo (alrededor de líneas 279-286) que usa `lineTo`:

```diff
     if (points.length > 1) {
         const path = new Path2D();
         path.moveTo(points[0].x, points[0].y);
-        for (let i = 1; i < points.length; i++) {
-            path.lineTo(points[i].x, points[i].y);
+        for (let i = 1; i < points.length - 1; i++) {
+            const midX = (points[i].x + points[i + 1].x) / 2;
+            const midY = (points[i].y + points[i + 1].y) / 2;
+            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
         }
+        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
         ctx.stroke(path);
     }
```

Esto es el mismo patrón exacto que ya usan `drawMetricPath` y `drawSpectrumPath`.

---

## Tarea B.2: `drawPhasePath` — pixel-per-pixel → decimación + quadraticCurveTo

**Archivo a modificar:** `src/lib/dsp/renderers/metricRenderers.ts`

**Instrucción:**

Reescribir `drawPhasePath` para usar el mismo patrón de decimación por bins que `drawMetricPath`, con soporte para "breaks" en envolvimiento de fase. Reemplazar toda la función `drawPhasePath` por:

```typescript
export function drawPhasePath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: { color: string, lineWidth: number, lineDash: number[] },
    frequencyLUT: Int32Array,
    interpPhase: Float32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    interpCoherence?: Float32Array
) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    ctx.setLineDash(style.lineDash || []);
    
    const cfg = metricConfigs["Phase"] || { rotate: 0, unwrapMode: "±180", yShift: 0 };
    const magCfg = metricConfigs["Magnitude"] || { enableCoherence: false, coherenceThreshold: 0.5 };

    // Phase unwrap mode
    const phaseMode = cfg.unwrapMode || '±180';
    let phaseToRender = interpPhase;

    if (phaseMode === 'Unwrap') {
        const unwrapped = new Float32Array(interpPhase.length);
        unwrapped[0] = interpPhase[0];
        let accumulated = interpPhase[0];
        for (let k = 1; k < interpPhase.length; k++) {
            let diff = interpPhase[k] - interpPhase[k - 1];
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            accumulated += diff;
            unwrapped[k] = accumulated;
        }
        phaseToRender = unwrapped;
    }

    // Build points array with decimation (bin-based like drawMetricPath)
    const bins = interpPhase.length;
    const sampleRate = (bins * 2) * ((freqMax - freqMin) / bins) || 48000; // fallback
    const binWidth = sampleRate > 0 ? (sampleRate / 2) / bins : 1;

    // Collect segments (break on coherence gaps or phase wrapping jumps)
    const segments: { x: number, y: number }[][] = [];
    let currentSeg: { x: number, y: number }[] = [];
    let lastY = 0;

    for (let bin = 0; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        // Coherence masking
        if (interpCoherence && magCfg.enableCoherence && interpCoherence[bin] < (magCfg.coherenceThreshold ?? 0.5)) {
            if (currentSeg.length > 0) {
                segments.push(currentSeg);
                currentSeg = [];
            }
            continue;
        }

        let val = phaseToRender[bin];
        
        // Rotar fase
        val = val + (cfg.rotate || 0);
        
        // Envoltura/Unwrap mode
        if (cfg.unwrapMode === "360") {
            val = ((val % 360) + 360) % 360;
        } else if (cfg.unwrapMode === "Unwrap") {
            // No wrapping
        } else {
            val = (val + 180) % 360;
            if (val < 0) val += 360;
            val -= 180;
        }

        const y = valToY(val, height, "Phase", metricConfigs, state) + (cfg.yShift || 0);

        // Break segment on large Y jumps (phase wrapping)
        if (currentSeg.length > 0 && Math.abs(y - lastY) > height * 0.65) {
            segments.push(currentSeg);
            currentSeg = [];
        }

        currentSeg.push({ x, y });
        lastY = y;
    }
    if (currentSeg.length > 0) segments.push(currentSeg);

    // Draw each segment with quadratic spline
    const path = new Path2D();
    for (const seg of segments) {
        if (seg.length < 2) {
            if (seg.length === 1) {
                path.moveTo(seg[0].x, seg[0].y);
                path.lineTo(seg[0].x + 0.5, seg[0].y);
            }
            continue;
        }
        path.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length - 1; i++) {
            const midX = (seg[i].x + seg[i + 1].x) / 2;
            const midY = (seg[i].y + seg[i + 1].y) / 2;
            path.quadraticCurveTo(seg[i].x, seg[i].y, midX, midY);
        }
        path.lineTo(seg[seg.length - 1].x, seg[seg.length - 1].y);
    }
    ctx.stroke(path);
    ctx.setLineDash([]);
}
```

**Nota:** Esta función necesita los imports de `freqMin` y `freqMax` que ya están importados en el archivo.

**Importante:** La función original recibía `sampleRate` implícitamente del `binWidth`. Ahora necesitamos calcularlo desde los bins. Como el `sampleRate` no se pasa como parámetro a `drawPhasePath`, debemos **agregar `sampleRate` como parámetro nuevo** al final de la firma. Actualizar todas las llamadas a `drawPhasePath` en `quadrantDraw.ts` para pasar `p.sampleRate` como último argumento.

Actualizar la firma de la función:

```diff
 export function drawPhasePath(
     ctx: CanvasRenderingContext2D,
     width: number,
     height: number,
     style: { color: string, lineWidth: number, lineDash: number[] },
     frequencyLUT: Int32Array,
     interpPhase: Float32Array,
     metricConfigs: Record<string, MetricConfig>,
     state: InteractionState,
-    interpCoherence?: Float32Array
+    interpCoherence?: Float32Array,
+    sampleRate: number = 48000
 ) {
```

Y dentro de la función, usar ese `sampleRate`:

```typescript
    const binWidth = (sampleRate / 2) / bins;
```

**Archivos a actualizar con el nuevo parámetro:**

En `src/lib/dsp/quadrantDraw.ts`, buscar todas las llamadas a `drawPhasePath` y agregar `p.sampleRate` al final:

```diff
                     drawPhasePath(
                         p.ctx, p.width, p.height,
                         { color: snapColor, lineWidth, lineDash: snapDash },
                         p.frequencyLUT, adjustedBuffer, p.metricConfigs,
-                        p.interactionState, p.interpEngine.interpCoherence
+                        p.interactionState, p.interpEngine.interpCoherence, p.sampleRate
                     );
```

```diff
                 drawPhasePath(
                     ctx,
                     p.width,
                     p.height,
                     { color, lineWidth: lw, lineDash },
                     p.frequencyLUT,
                     rawBuffer,
                     p.metricConfigs,
                     p.interactionState,
-                    p.interpEngine.interpCoherence
+                    p.interpEngine.interpCoherence,
+                    p.sampleRate
                 );
```

---

## Tarea B.3: `drawPhaseDelay` — pixel-per-pixel → decimación + quadraticCurveTo

**Archivo a modificar:** `src/lib/dsp/renderers/metricRenderers.ts`

**Instrucción:**

Reemplazar la función `drawPhaseDelay` para usar el patrón de decimación + quadraticCurveTo:

```typescript
export function drawPhaseDelay(
    ctx: CanvasRenderingContext2D,
    phaseData: Float32Array,
    width: number,
    height: number,
    color: string,
    lw: number,
    frequencyLUT: Int32Array,
    metricConfigs: Record<string, MetricConfig>,
    state: InteractionState,
    bins: number,
    sampleRate: number = 48000
) {
    if (frequencyLUT.length === 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const sr = sampleRate;
    const binWidth = sr / 2 / bins;

    // Build points array with decimation
    const points: { x: number, y: number }[] = [];

    for (let bin = 1; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        const phaseRad = (phaseData[bin] * Math.PI) / 180;
        const phaseDelayMs = (-phaseRad / (2 * Math.PI * freq)) * 1000;
        const clampedDelay = Math.max(-5, Math.min(25, phaseDelayMs));

        const y = valToY(clampedDelay, height, 'Phase Delay', metricConfigs, state);
        points.push({ x, y });
    }

    // Draw with quadratic spline
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }
}
```

**Nota:** Se necesita agregar `freqMin, freqMax` al import si no están ya importados (ya lo están en este archivo).

---

## Tarea B.4: `drawCrestFactor` — pixel-per-pixel → decimación + quadraticCurveTo

**Archivo a modificar:** `src/lib/dsp/renderers/metricRenderers.ts`

**Instrucción:**

Reemplazar la función `drawCrestFactor`:

```typescript
export function drawCrestFactor(
    ctx: CanvasRenderingContext2D,
    crestFactorData: Float32Array,
    width: number,
    height: number,
    frequencyLUT: Int32Array,
    state: InteractionState,
    color: string
) {
    if (frequencyLUT.length === 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    // Build points with decimation
    const points: { x: number, y: number }[] = [];

    for (let x = 0; x < width; x++) {
        const binIndex = frequencyLUT[x];
        if (binIndex === undefined) continue;

        const val = crestFactorData[binIndex];
        const y = valToY(val, height, "Crest Factor", {}, state);
        points.push({ x, y });
    }

    // Draw with quadratic spline
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }
}
```

---

## Tarea B.5: `drawNyquistPath` — lineTo → quadraticCurveTo

**Archivo a modificar:** `src/lib/dsp/renderers/metricRenderers.ts`

**Instrucción:**

Reemplazar la función `drawNyquistPath` para usar curvas suaves:

```typescript
export function drawNyquistPath(
    ctx: CanvasRenderingContext2D,
    hReal: Float32Array,
    hImag: Float32Array,
    width: number,
    height: number,
    color: string,
    lw: number
) {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRad = Math.min(width, height) / 2 * 0.9;

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;

    // Build points
    const points: { x: number, y: number }[] = [];
    for (let k = 0; k < hReal.length; k++) {
        const x = centerX + hReal[k] * maxRad;
        const y = centerY - hImag[k] * maxRad;
        points.push({ x, y });
    }

    // Draw with quadratic spline
    if (points.length > 1) {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke(path);
    }
}
```

---

## Tarea B.6: `drawTimeDomainPath` — lineTo → quadraticCurveTo

**Archivo a modificar:** `src/lib/dsp/renderers/metricRenderers.ts`

**Instrucción:**

En la función `drawTimeDomainPath`, reemplazar el bloque de dibujo (alrededor de líneas 208-226) para usar `quadraticCurveTo`:

```diff
     ctx.strokeStyle = color;
     ctx.lineWidth = lw;
     ctx.setLineDash(lineDash || []);
-    ctx.beginPath();
-    let first = true;
+
+    // Build points array
+    const points: { x: number, y: number }[] = [];
     const numPoints = 350;
     for (let i = 0; i < numPoints; i++) {
         const t = timeMin + (i / (numPoints - 1)) * (timeMax - timeMin);
         const x = valToX(t, width, hasTimeDomainActive, state);
         const val = getImpulseValueInterpolated(t, data);
         const y = valToY(val, height, metricType, metricConfigs || {}, state);

-        if (x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50) {
-            if (first) {
-                ctx.moveTo(x, y);
-                first = false;
-            } else {
-                ctx.lineTo(x, y);
-            }
+        if (x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50) {
+            points.push({ x, y });
         }
     }
-    ctx.stroke();
+
+    // Draw with quadratic spline
+    if (points.length > 1) {
+        const path = new Path2D();
+        path.moveTo(points[0].x, points[0].y);
+        for (let i = 1; i < points.length - 1; i++) {
+            const midX = (points[i].x + points[i + 1].x) / 2;
+            const midY = (points[i].y + points[i + 1].y) / 2;
+            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
+        }
+        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
+        ctx.stroke(path);
+    }
     ctx.setLineDash([]);
```

Agregar el import de `timeMin` y `timeMax` si no están ya en los imports del archivo. Verificar que `timeMin` y `timeMax` ya se importan desde `canvasInteraction` al inicio del archivo — si no, agregarlos:

```diff
 import {
     valToX,
     valToY,
+    timeMin,
+    timeMax,
     freqMin,
     freqMax,
     type InteractionState
 } from '../canvasInteraction';
```

---

## Tarea B.7: `drawEQPhaseOverlayPath` — lineTo → bezierCurveTo

**Archivo a modificar:** `src/lib/dsp/renderers/eqRenderers.ts`

**Instrucción:**

En la función `drawEQPhaseOverlayPath`, reemplazar el dibujo lineal por bezierCurveTo para consistencia con `drawEQOverlayPath`. Cambiar el bloque de dibujo (alrededor de líneas 139-158):

```diff
-    const path = new Path2D();
-    const freqs = getEqFreqLUT(bins, sampleRate);
-    let started = false;
+    const freqs = getEqFreqLUT(bins, sampleRate);
+    const xs = new Float64Array(EQ_CURVE_POINTS);
+    const ys = new Float64Array(EQ_CURVE_POINTS);
+    let count = 0;

     for (let i = 0; i < EQ_CURVE_POINTS; i++) {
         const freq = freqs[i];
         const x = valToX(freq, width, false, state);
         if (x < -10 || x > width + 10) continue;

         const phaseRad = getEQPhaseCached(freq);
         const phaseDeg = phaseRad * (180 / Math.PI);
         const y = valToY(phaseDeg, height, "Phase", metricConfigs, state);

-        if (!started) { path.moveTo(x, y); started = true; }
-        else { path.lineTo(x, y); }
+        xs[count] = x;
+        ys[count] = y;
+        count++;
     }

-    if (started) {
+    if (count > 1) {
+        const path = new Path2D();
+        path.moveTo(xs[0], ys[0]);
+        for (let i = 1; i < count; i++) {
+            const cpx = (xs[i - 1] + xs[i]) / 2;
+            path.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i]);
+        }
         ctx.stroke(path);
     }
```

---

## Tarea B.8: `drawTargetTrace` — lineTo → quadraticCurveTo

**Archivo a modificar:** `src/lib/dsp/renderers/overlayRenderers.ts`

**Instrucción:**

En la función `drawTargetTrace`, reemplazar el bloque de dibujo (alrededor de líneas 308-322):

```diff
-    ctx.beginPath();
-    let first = true;
-    for (let i = 0; i < targetStore.points.length; i++) {
-        const p = targetStore.points[i];
-        const x = valToX(p.f, width, false, state);
-        const y = valToY(p.g + targetStore.offset, height, "Magnitude", {}, state);
-
-        if (first) {
-            ctx.moveTo(x, y);
-            first = false;
-        } else {
-            ctx.lineTo(x, y);
-        }
-    }
-    ctx.stroke();
+    // Build points array
+    const points: { x: number, y: number }[] = [];
+    for (let i = 0; i < targetStore.points.length; i++) {
+        const p = targetStore.points[i];
+        const x = valToX(p.f, width, false, state);
+        const y = valToY(p.g + targetStore.offset, height, "Magnitude", {}, state);
+        points.push({ x, y });
+    }
+
+    // Draw with quadratic spline
+    if (points.length > 1) {
+        const path = new Path2D();
+        path.moveTo(points[0].x, points[0].y);
+        for (let i = 1; i < points.length - 1; i++) {
+            const midX = (points[i].x + points[i + 1].x) / 2;
+            const midY = (points[i].y + points[i + 1].y) / 2;
+            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
+        }
+        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
+        ctx.stroke(path);
+    }
```

---

## Tarea B.9: `drawScope` — lineTo → quadraticCurveTo

**Archivo a modificar:** `src/lib/dsp/renderers/overlayRenderers.ts`

**Instrucción:**

Reemplazar la función `drawScope`:

```diff
 export function drawScope(
     ctx: CanvasRenderingContext2D,
     timeData: Float32Array,
     width: number,
     height: number,
     color: string,
     lw: number
 ) {
     ctx.strokeStyle = color;
     ctx.lineWidth = lw;
-    ctx.beginPath();
+
+    // Build points
+    const points: { x: number, y: number }[] = [];
     const step = width / timeData.length;
     for (let i = 0; i < timeData.length; i++) {
         const x = i * step;
         const y = (height / 2) - (timeData[i] * height / 2);
-        if (i === 0) ctx.moveTo(x, y);
-        else ctx.lineTo(x, y);
+        points.push({ x, y });
     }
-    ctx.stroke();
+
+    // Draw with quadratic spline
+    if (points.length > 1) {
+        const path = new Path2D();
+        path.moveTo(points[0].x, points[0].y);
+        for (let i = 1; i < points.length - 1; i++) {
+            const midX = (points[i].x + points[i + 1].x) / 2;
+            const midY = (points[i].y + points[i + 1].y) / 2;
+            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
+        }
+        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
+        ctx.stroke(path);
+    }
 }
```

---

## Verificación Fase B

```bash
npm run build
npm run check
```

Verificación visual: todas las curvas deben verse suaves y sin dientes de sierra. Comparar especialmente:
- Simulated Magnitude vs Magnitude (deben verse igualmente suaves)
- EQ Phase overlay vs EQ Magnitude overlay (consistentes)
- Phase Delay y Crest Factor (curvas fluidas)
- Target Trace (suave entre puntos definidos)

---

# FASE C — Eliminación de Allocaciones en Hot Path

**Problema:** Varias funciones crean arrays de objetos `{x, y}` cada frame, generando presión de GC. Se deben migrar a `Float64Array` pre-alocados a nivel de módulo, como ya hace `eqRenderers.ts`.

---

## Tarea C.1: Pre-alocar buffers en `metricRenderers.ts`

**Archivo a modificar:** `src/lib/dsp/renderers/metricRenderers.ts`

**Instrucción:**

1. Al inicio del archivo (después de los imports), agregar buffers pre-alocados a nivel de módulo:

```typescript
// Pre-allocated coordinate buffers to avoid GC pressure (max 8192 bins)
const MAX_POINTS = 8192;
let _xs = new Float64Array(MAX_POINTS);
let _ys = new Float64Array(MAX_POINTS);
```

2. Reemplazar el patrón `const points: {x, y}[] = []` por acumulación en los buffers estáticos en las siguientes funciones:

- `drawMetricPath`
- `drawSpectrumPath`
- `drawSimulatedMagnitudePath`
- `drawPhaseDelay`
- `drawCrestFactor`
- `drawNyquistPath`
- `drawTimeDomainPath`

Para cada una, cambiar:

```diff
-    const points: {x: number, y: number}[] = [];
+    let pointCount = 0;
```

Y en el loop donde se pushean puntos:

```diff
-        points.push({ x, y });
+        _xs[pointCount] = x;
+        _ys[pointCount] = y;
+        pointCount++;
```

Y en el bloque de dibujo:

```diff
-    if (points.length > 1) {
+    if (pointCount > 1) {
         const path = new Path2D();
-        path.moveTo(points[0].x, points[0].y);
-        for (let i = 1; i < points.length - 1; i++) {
-            const midX = (points[i].x + points[i + 1].x) / 2;
-            const midY = (points[i].y + points[i + 1].y) / 2;
-            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
+        path.moveTo(_xs[0], _ys[0]);
+        for (let i = 1; i < pointCount - 1; i++) {
+            const midX = (_xs[i] + _xs[i + 1]) / 2;
+            const midY = (_ys[i] + _ys[i + 1]) / 2;
+            path.quadraticCurveTo(_xs[i], _ys[i], midX, midY);
         }
-        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
+        path.lineTo(_xs[pointCount - 1], _ys[pointCount - 1]);
         ctx.stroke(path);
     }
```

**Nota:** Las funciones se ejecutan secuencialmente dentro de `drawQuadrant`, así que compartir los mismos buffers `_xs`/`_ys` es seguro — no hay ejecución concurrente.

---

## Tarea C.2: Pre-alocar buffer ETC en `metricRenderers.ts`

**Archivo a modificar:** `src/lib/dsp/renderers/metricRenderers.ts`

**Instrucción:**

Al inicio del archivo, agregar un buffer pre-alocado para el modo ETC:

```typescript
// Pre-allocated ETC buffer (reused across frames)
let _etcBuffer: Float32Array | null = null;
let _etcBufferSize = 0;
```

En `drawTimeDomainPath`, reemplazar la allocación del modo ETC:

```diff
     if (metricType === "Impulse" && metricConfigs?.["Impulse"]?.modeY === 'ETC') {
-        const etcData = new Float32Array(data.length);
+        if (!_etcBuffer || _etcBufferSize !== data.length) {
+            _etcBuffer = new Float32Array(data.length);
+            _etcBufferSize = data.length;
+        }
+        const etcData = _etcBuffer;
         let peakVal = 0;
```

---

## Tarea C.3: Pre-alocar buffer de espectrograma en `quadrantDraw.ts`

**Archivo a modificar:** `src/lib/dsp/quadrantDraw.ts`

**Instrucción:**

Al inicio del archivo (después de los imports), agregar:

```typescript
// Pre-allocated spectrogram row buffer
let _spectroRow: Float32Array | null = null;
let _spectroRowWidth = 0;
```

En el bloque de espectrograma (alrededor de línea 172), reemplazar:

```diff
-                const dbRow = new Float32Array(w);
+                if (!_spectroRow || _spectroRowWidth !== w) {
+                    _spectroRow = new Float32Array(w);
+                    _spectroRowWidth = w;
+                }
+                const dbRow = _spectroRow;
```

**Importante:** El `push` al historial en la línea 196 necesita hacer una copia porque `_spectroRow` se reutiliza:

```diff
-                p.spectrogramDbHistory.push(dbRow);
+                p.spectrogramDbHistory.push(new Float32Array(dbRow));
```

---

## Verificación Fase C

```bash
npm run build
npm run check
```

Verificación de performance: abrir DevTools → Performance tab → grabar 5 segundos con medición activa → verificar que no hay picos frecuentes de minor GC que correspondan a allocación de Float32Array en el render loop.

---

# Resumen de cambios por archivo

| Archivo | Fase | Cambio |
|---------|------|--------|
| `src/lib/dsp/interpolationEngine.ts` | A | +6 buffers (interpCrestFactor, interpHReal, interpHImag + prev*), actualizar interpolateBuffers y updateHistory |
| `src/components/medicion/Quadrant.svelte` | A | Pasar interpEngine.interpCrestFactor/interpHReal/interpHImag al draw |
| `src/lib/dsp/renderers/metricRenderers.ts` | B, C | Reescribir 7 funciones (SimMag, Phase, PhaseDelay, CrestFactor, Nyquist, TimeDomain); pre-alocar buffers |
| `src/lib/dsp/renderers/eqRenderers.ts` | B | Reescribir drawEQPhaseOverlayPath |
| `src/lib/dsp/renderers/overlayRenderers.ts` | B | Reescribir drawTargetTrace y drawScope |
| `src/lib/dsp/quadrantDraw.ts` | A, C | Actualizar DrawParams; actualizar calls a drawPhasePath; pre-alocar spectro row |
| `src/lib/stores/useRenderLoop.ts` | A | Sin cambios (ya recibe valores de Quadrant.svelte) |
