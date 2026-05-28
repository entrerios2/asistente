# Prompts de Implementación para Optimización de Rendimiento V2

Este documento contiene un conjunto de instrucciones detalladas paso a paso para que un agente implemente las tareas pendientes de la auditoría de rendimiento. 

**Agente: Por favor, ejecuta cada bloque de instrucciones secuencialmente usando tus herramientas de edición de archivos (`replace_file_content` o `multi_replace_file_content`).**

---

## Tarea 1: Añadir Configuración Global al uiStore
**Archivo a modificar:** `src/lib/stores/ui.svelte.ts`

**Instrucción:**
1. Dentro de la clase `UIStore`, justo debajo de los estados de "NUEVOS ESTADOS COMPARTIDOS FASE 2A.3" (línea ~22), añade las siguientes propiedades reactivas de Svelte 5 usando `$state`:
```typescript
    // Configuración de Rendimiento y DSP (Fase 2)
    targetFps = $state(30);
    dspUpdateRate = $state(2); // Hz
    fftSize = $state(8192);
```

---

## Tarea 2: Limpieza de UI (Remover blur y marca de OSM)
**Archivos a modificar:** 
1. `src/components/TraceMath.svelte`
2. `src/components/medicion/Quadrant.svelte`

**Instrucción:**
1. En `TraceMath.svelte`, busca el bloque CSS bajo la clase `.trace-math-container` (alrededor de la línea 155) y **elimina** la línea `backdrop-filter: blur(4px);`.
2. En `Quadrant.svelte`, busca la clase CSS `.quadrant-header`. **Elimina** las líneas `backdrop-filter: blur(12px);` y `-webkit-backdrop-filter: blur(12px);`. Cambia el background por: `background: #0c0c10;`.
3. En `Quadrant.svelte`, busca la clase CSS `.selector-popover`. **Elimina** las líneas `backdrop-filter: blur(16px);` y `-webkit-backdrop-filter: blur(16px);`. Cambia su background por: `background: #0e0e14;`.
4. En `Quadrant.svelte` (línea ~1440), busca el label:
`<label class="popover-section-label">Métricas de Open Sound Meter</label>`
Reemplázalo por:
`<label class="popover-section-label">Métricas de Medición</label>`
5. En `src/lib/dsp/osmMetrics.ts`, busca el comentario (línea ~6): ` * el cálculo en tiempo real de las 10 métricas de Open Sound Meter (OSM).` y cámbialo a ` * el cálculo en tiempo real de las métricas acústicas.`

---

## Tarea 3: Modificar MathOrchestrator (Desacople y Zero-Allocation dinámico)
**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`

**Instrucción:**
1. Elimina las constantes `BINS` y `FFT_SIZE` globales. 
2. Dentro de la clase `MathOrchestrator`, define propiedades de clase inicializadas y un objeto reactivo para llevar el rastro de las métricas:
```typescript
    activeMetricsByQuadrant = $state<Record<string, string[]>>({});
    private BINS = 4096;
    private FFT_SIZE = 8192;
```
3. Añade los getters y métodos de registro:
```typescript
    registerQuadrantMetrics(id: string, metrics: string[]) {
        this.activeMetricsByQuadrant[id] = metrics;
    }

    unregisterQuadrant(id: string) {
        delete this.activeMetricsByQuadrant[id];
    }

    get globalActiveMetrics(): Set<string> {
        const active = new Set<string>();
        for (const id in this.activeMetricsByQuadrant) {
            for (const metric of this.activeMetricsByQuadrant[id]) {
                active.add(metric);
            }
        }
        return active;
    }
```
4. Añade un método `reallocateBuffers(newFftSize: number)` que actualice las propiedades `this.FFT_SIZE = newFftSize` y `this.BINS = newFftSize / 2`, y vuelva a asignar (`new Float32Array(...)`) todos los buffers de la clase (`fftInputReal`, `outputMagnitude`, etc.). Añade un `$effect` en Svelte que escuche `uiStore.fftSize` para llamar a esta función cuando cambie el store.
5. Modifica el getter `throttleMs` para que ignore `uiStore.layout` y en su lugar retorne: `return 1000 / uiStore.dspUpdateRate;`.
6. En el método `run()`, justo antes de los cálculos de las métricas (`// 1. Magnitude`), envuelve la lógica para que sólo se ejecute si es necesario según `globalActiveMetrics`:
```typescript
        const metrics = this.globalActiveMetrics;
        const needMagnitude = metrics.has("Magnitude") || metrics.has("Spectrum") || metrics.has("Spectrogram") || metrics.has("Impulse") || metrics.has("Step");
        const needPhase = metrics.has("Phase") || metrics.has("Group Delay");
        const needImpulse = metrics.has("Impulse") || metrics.has("Step");

        if (needMagnitude) {
            calculateMagnitude(...);
        }
        if (needPhase) {
            calculatePhase(...);
        }
        if (needImpulse) {
            calculateImpulseResponse(...);
        }
        if (metrics.has("Step")) {
            calculateStepResponse(this.outputImpulse, this.outputStep);
        }
        if (metrics.has("Group Delay")) {
            // bucle de tempPhaseRadians
            calculateGroupDelay(...);
        }
```

---

## Tarea 4: Modificar Quadrant.svelte (FPS Limit y Ejes)
**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

**Instrucción:**
1. Modifica la función `isMetricDisabled(name: string)`. Elimina estas líneas para permitir usar Magnitude y Spectrum simultáneamente:
```typescript
        if (name === "Spectrum" && hasMagnitudeActive) return true;
        if (name === "Magnitude" && hasSpectrumActive) return true;
```
2. Modifica el registro en el Orchestrator: dentro de `Quadrant.svelte`, añade un `$effect` que observe `activeMetrics`:
```typescript
    $effect(() => {
        mathOrchestrator.registerQuadrantMetrics(id, activeMetrics);
    });
```
*(Asegúrate también de llamar a `mathOrchestrator.unregisterQuadrant(id)` en el onMount return o onDestroy).*
3. Modifica la función `renderLoop` (alrededor de la línea 1345) para limitar los FPS:
```typescript
        let lastDrawTime = performance.now();
        function renderLoop() {
            animationId = requestAnimationFrame(renderLoop);
            const now = performance.now();
            const interval = 1000 / uiStore.targetFps;
            const elapsed = now - lastDrawTime;
            
            if (elapsed >= interval) {
                lastDrawTime = now - (elapsed % interval);
                draw();
            }
        }
```
4. Actualiza `drawGrid` para el eje Y secundario (Spectrum). Al lado derecho, si `Spectrum` está activo, dibuja los ticks desde -120 a 10 con la etiqueta `dBSPL` (usando `valToY` de Spectrum), dibujando el texto en `width - 40` con color `#a855f7`.

---

## Tarea 5: Espectrograma Vertical Coincidente
**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

**Instrucción:**
1. En `initOffscreenCanvas`, invierte ancho y alto: `width = containerWidth || 800` y `height = maxHistory`.
2. En `draw()`, dentro del bloque que actualiza el offscreen canvas del Spectrogram, cambia la dirección de desplazamiento de horizontal a vertical:
```typescript
    offscreenCtx.drawImage(
        offscreenCanvas,
        0, 0, width, maxHistory - 1,
        0, -1, width, maxHistory - 1
    );
```
*(Nota: Ajusta los parámetros de `drawImage` para tomar la porción superior y moverla 1 píxel hacia arriba `(y=-1)` o viceversa, pero debe desplazarse en el eje Y).*
3. Luego, dibuja la nueva línea en `y = maxHistory - 1`. Usa interpolación logarítmica para que el bin de frecuencia coincida exactamente con la escala logarítmica de fondo a lo ancho de los pixeles de `x`.

---

## Tarea 6: Estilos Personalizados por Métrica
**Archivo a modificar:** `src/components/medicion/Quadrant.svelte`

**Instrucción:**
1. Añade un estado `$state` para la configuración de las líneas:
```typescript
let metricStyles = $state<Record<string, { color: string, lineWidth: number, lineDash: number[] }>>({
    "Spectrum": { color: "#a855f7", lineWidth: 2, lineDash: [] },
    "Magnitude": { color: "#ff4444", lineWidth: 2, lineDash: [] },
    "Phase": { color: "#d946ef", lineWidth: 1.6, lineDash: [] },
    // ... haz lo mismo para Coherence, Group Delay, Impulse y Step
});
```
2. Modifica los callbacks `drawMetricPath`, `drawSpectrumPath` y `drawTimeDomainPath` para que apliquen `ctx.lineWidth = lw`, `ctx.strokeStyle = color` y `ctx.setLineDash(lineDash)`.
3. Al renderizar las métricas en la función `draw()`, pasa las variables desde `metricStyles[m].color`, `lineWidth` y `lineDash` en lugar de strings duros (hardcodeados).
4. (Opcional si es complejo): En el bloque del popover de UI (`selector-popover`), añade botones pequeños (engranaje) al lado de los checkboxes para modificar el `metricStyles` correspondiente a ese ítem.
