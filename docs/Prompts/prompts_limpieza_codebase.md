# Prompts de Implementación — Limpieza de Codebase (Fases 1-3)

Este documento contiene instrucciones detalladas para que un agente ejecute la limpieza completa del codebase en 3 fases. Surge de una auditoría exhaustiva que identificó archivos muertos, bugs, dependencias innecesarias y oportunidades de optimización.

**Agente: Ejecuta cada bloque secuencialmente. Después de cada Fase, verifica que `npm run build` y `npm run check` completen sin errores.**

---

# FASE 1 — Limpieza Rápida (Sin Riesgo)

---

## Tarea 1.1: Mover archivos muertos a `src/_deprecated/`

**Instrucción:**

Crea el directorio `src/_deprecated/` con la siguiente estructura y mueve cada archivo a su destino. Estos archivos fueron identificados como código huérfano: ninguno es importado por ningún otro archivo del proyecto.

| Origen | Destino |
|--------|---------|
| `src/components/RTA.svelte` | `src/_deprecated/components/RTA.svelte` |
| `src/components/TraceMath.svelte` | `src/_deprecated/components/TraceMath.svelte` |
| `src/components/FilterList.svelte` | `src/_deprecated/components/FilterList.svelte` |
| `src/components/DeviceSelector.svelte` | `src/_deprecated/components/DeviceSelector.svelte` |
| `src/lib/dsp/Analyzer.svelte.ts` | `src/_deprecated/dsp/Analyzer.svelte.ts` |
| `src/lib/dsp/mathSource.ts` | `src/_deprecated/dsp/mathSource.ts` |
| `src/lib/dsp/TransferFunction.ts` | `src/_deprecated/dsp/TransferFunction.ts` |
| `src/lib/dsp/equalLoudness.ts` | `src/_deprecated/dsp/equalLoudness.ts` |
| `src/lib/dsp/deviationMetrics.ts` | `src/_deprecated/dsp/deviationMetrics.ts` |
| `src/lib/dsp/AutoEq.ts` | `src/_deprecated/dsp/AutoEq.ts` |
| `src/lib/utils/tierDetector.ts` | `src/_deprecated/utils/tierDetector.ts` |

Usa `mkdir -p` (o equivalente en Windows) para crear los subdirectorios y `git mv` para mover los archivos preservando el historial.

---

## Tarea 1.2: Eliminar dependencias muertas

**Archivo a modificar:** `package.json`

**Instrucción:**

1. En la sección `"dependencies"`, elimina la entrada `"headroom-ai"`. Este paquete nunca es importado en ningún archivo del proyecto.
2. En la sección `"devDependencies"`, elimina la entrada `"@sveltejs/adapter-auto"`. El proyecto usa exclusivamente `@sveltejs/adapter-static`.
3. Ejecuta `npm install` para regenerar el `package-lock.json`.

**Resultado esperado:**
```json
"dependencies": {
    "webfft": "^1.0.3"
}
```

---

## Tarea 1.3: Corregir idioma del HTML

**Archivo a modificar:** `src/app.html`

**Instrucción:**

En la línea 2, cambia el atributo `lang` de inglés a español:

```diff
-<html lang="en">
+<html lang="es">
```

La aplicación está completamente en español y esto afecta accesibilidad y SEO.

---

## Tarea 1.4: Limpiar imports y hack _dummy en MathOrchestrator

**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`

**Instrucción:**

1. En la línea del import de biquad (L12), elimina `peakingCoeffs`, `lowShelfCoeffs` y `highShelfCoeffs`. Solo se usan indirectamente a través de `getCoeffsForType` que ya los importa internamente. Deja el import así:

```diff
-import { peakingCoeffs, lowShelfCoeffs, highShelfCoeffs, getCoeffsForType, biquadResponse } from '../dsp/biquad';
+import { getCoeffsForType, biquadResponse } from '../dsp/biquad';
```

2. Elimina la propiedad `_dummy` (L37):

```diff
-    // Bridge for unused imports check
-    _dummy = [peakingCoeffs, biquadResponse];
```

Este hack existía para prevenir tree-shaking de `peakingCoeffs`, pero `getCoeffsForType` ya la usa internamente, y `biquadResponse` se usa directamente en `checkDirty()`, así que no necesita el bridge.

---

## Tarea 1.5: Eliminar hotkey D residual

**Archivo a modificar:** `src/routes/+page.svelte`

**Instrucción:**

Dentro del handler `handleKey` (alrededor de L15-17), elimina el bloque del hotkey D que solo hace un `console.log` sin funcionalidad:

```diff
             if (e.code === 'Space') {
                 e.preventDefault();
                 traceManager.captureSnapshot('live-1', 'Captura manual', 'manual');
-            } else if (e.code === 'KeyD') {
-                console.log("Disparando Find Delay");
             } else if (e.key >= '1' && e.key <= '9') {
```

---

## Verificación Fase 1

```bash
npm run build
npm run check
```

Abrir la app en el navegador y verificar que todo funciona igual que antes. Los archivos movidos no deberían afectar nada ya que no eran importados.

---

# FASE 2 — Bug Fixes

---

## Tarea 2.1: Corregir rama muerta en `loadFromDB()`

**Archivo a modificar:** `src/lib/stores/traceManager.svelte.ts`

**Instrucción:**

En el método `loadFromDB()` (alrededor de L168-176), el `if/else` tiene ambas ramas idénticas. Simplifica eliminando la condición innecesaria:

```diff
             this.instantaneas = items.map((item: any) => {
                 const data: Record<string, Float32Array> = {};
                 for (const metric in item.data) {
-                    if (item.data[metric] instanceof ArrayBuffer || Array.isArray(item.data[metric]) || item.data[metric].buffer) {
-                        data[metric] = new Float32Array(item.data[metric]);
-                    } else {
-                        data[metric] = new Float32Array(item.data[metric]);
-                    }
+                    data[metric] = new Float32Array(item.data[metric]);
                 }
```

`new Float32Array()` ya acepta ArrayBuffer, Array, TypedArray y cualquier iterable, así que la condición no aportaba nada.

---

## Tarea 2.2: Filtrar hotkeys dentro de inputs

**Archivo a modificar:** `src/routes/+page.svelte`

**Instrucción:**

Dentro del handler `handleKey`, al inicio de la función (antes de cualquier `if`), agrega un guard que ignore los eventos cuando el foco está en un campo de texto:

```diff
         const handleKey = (e: KeyboardEvent) => {
+            // No interceptar hotkeys cuando el usuario escribe en inputs
+            const tag = (e.target as HTMLElement)?.tagName;
+            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
+
             if (e.code === 'Space') {
```

**Problema que resuelve:** Sin este guard, presionar Space en cualquier campo de texto (como renombrar una instantánea o ajustar un valor numérico) dispara una captura de snapshot en vez de escribir un espacio.

---

## Tarea 2.3: Singleton de conexión IndexedDB

**Archivo a modificar:** `src/lib/utils/db.ts`

**Instrucción:**

El código actual abre una nueva conexión a IndexedDB en cada operación (save, load, delete) y nunca la cierra. En sesiones largas con muchas operaciones, esto puede acumular conexiones.

Reemplaza la función `openDB()` actual por un patrón singleton:

```typescript
const DB_NAME = 'asistente_db';
const DB_VERSION = 1;
const STORE_NAME = 'instantaneas';

let cachedDB: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
    if (cachedDB) return Promise.resolve(cachedDB);

    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB no está soportado en este entorno.'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => {
            cachedDB = request.result;
            // Si la conexión se cierra externamente, limpiar el cache
            cachedDB.onclose = () => { cachedDB = null; };
            resolve(cachedDB);
        };
        request.onerror = () => reject(request.error);
    });
}
```

El resto de las funciones (`saveInstantanea`, `loadAllInstantaneas`, `deleteInstantanea`) no necesitan cambios porque ya llaman a `openDB()`.

---

## Verificación Fase 2

```bash
npm run build
npm run check
```

Verificación manual:
1. Abrir la app → verificar que las instantáneas guardadas en IndexedDB se cargan correctamente al arrancar
2. Capturar una nueva instantánea → verificar que se guarda en IndexedDB (recargar la página y comprobar que aparece)
3. Eliminar una instantánea → verificar que desaparece también tras recargar
4. Ir a la pestaña de configuración → escribir en un campo de texto numérico → verificar que Space no dispara una captura
5. Presionar Space fuera de un input → verificar que sí captura

---

# FASE 3 — Optimizaciones de Performance

---

## Tarea 3.1: Transferable arrays en Worker → Main Thread

**Archivo a modificar:** `src/lib/dsp/dspWorker.ts`

**Instrucción:**

Al final del handler `self.onmessage`, donde se hace `postMessage` con los resultados (alrededor de L525-535), el código actual usa `.slice().buffer` para cada buffer, lo que crea copias en el worker y luego las serializa al main thread. Con `Transferable`, el browser transfiere ownership del ArrayBuffer sin copiar bytes (zero-copy).

1. Reemplaza el bloque de `postMessage` actual por:

```typescript
        // Crear copias para transferir (el worker pierde ownership)
        const magBuf = outputMagnitude.buffer;
        const phaseBuf = outputPhase.buffer;
        const cohBuf = outputCoherence.buffer;
        const gdBuf = outputGroupDelay.buffer;
        const impBuf = outputImpulse.buffer;
        const stepBuf = outputStep.buffer;
        const cfBuf = outputCrestFactor.buffer;

        (self as any).postMessage({
            type: 'dsp-results',
            outputMagnitude: magBuf,
            outputPhase: phaseBuf,
            outputCoherence: cohBuf,
            outputGroupDelay: gdBuf,
            outputImpulse: impBuf,
            outputStep: stepBuf,
            outputCrestFactor: cfBuf,
            dbIn
        }, [magBuf, phaseBuf, cohBuf, gdBuf, impBuf, stepBuf, cfBuf]);

        // Reallocar buffers en el worker (los anteriores fueron transferidos)
        outputMagnitude = new Float32Array(BINS);
        outputPhase = new Float32Array(BINS);
        outputCoherence = new Float32Array(BINS);
        outputGroupDelay = new Float32Array(BINS);
        outputImpulse = new Float32Array(FFT_SIZE);
        outputStep = new Float32Array(FFT_SIZE);
        outputCrestFactor = new Float32Array(BINS);
```

**Nota:** Se usan las variables `BINS` y `FFT_SIZE` que están en el scope del worker (`currentBins` y `currentFftSize`) para la reasignación. Asegurate de usar los valores correctos: `currentBins` para los buffers de BINS y `currentFftSize` para los de FFT_SIZE.

---

## Tarea 3.2: Eliminar doble copia en `handleWorkerMessage`

**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`

**Instrucción:**

En el método `handleWorkerMessage` (alrededor de L116-126), el código actual hace:
```typescript
this.outputMagnitude.set(new Float32Array(data.outputMagnitude));
```

Esto es una doble copia: primero crea un `Float32Array` view sobre el `ArrayBuffer` recibido, y luego copia sus valores con `.set()` al buffer existente. Como los outputs son `$state.raw`, reasignar la referencia directamente es la forma correcta de notificar la reactividad en Svelte 5.

Reemplaza las líneas de `.set(new Float32Array(...))` por reasignaciones directas:

```diff
     private handleWorkerMessage(data: any) {
         if (data.type === 'dsp-results') {
-            this.outputMagnitude.set(new Float32Array(data.outputMagnitude));
-            this.outputPhase.set(new Float32Array(data.outputPhase));
-            this.outputCoherence.set(new Float32Array(data.outputCoherence));
-            this.outputGroupDelay.set(new Float32Array(data.outputGroupDelay));
-            this.outputImpulse.set(new Float32Array(data.outputImpulse));
-            this.outputStep.set(new Float32Array(data.outputStep));
-            if (data.outputCrestFactor) {
-                this.outputCrestFactor.set(new Float32Array(data.outputCrestFactor));
-            }
+            this.outputMagnitude = new Float32Array(data.outputMagnitude);
+            this.outputPhase = new Float32Array(data.outputPhase);
+            this.outputCoherence = new Float32Array(data.outputCoherence);
+            this.outputGroupDelay = new Float32Array(data.outputGroupDelay);
+            this.outputImpulse = new Float32Array(data.outputImpulse);
+            this.outputStep = new Float32Array(data.outputStep);
+            if (data.outputCrestFactor) {
+                this.outputCrestFactor = new Float32Array(data.outputCrestFactor);
+            }
```

**Justificación:** Con `$state.raw`, Svelte 5 detecta cambios por referencia (no por valor profundo). Al reasignar la referencia, Svelte sabe que el buffer cambió. La operación `.set()` sobre el mismo objeto no dispara reactividad de forma fiable con `$state.raw`.

**Importante:** Verificar que `InterpolationEngine.interpolateBuffers()` y cualquier otro consumer lean los buffers por referencia en cada frame (no cacheen la referencia vieja). Si `interpolateBuffers` accede a `mathOrchestrator.outputMagnitude` directamente en cada llamada, funciona correctamente.

---

## Verificación Fase 3

```bash
npm run build
npm run check
```

Verificación manual de performance:
1. Abrir la app → verificar que el canvas sigue renderizando métricas correctamente
2. Activar medición → verificar que la magnitud, fase, coherencia se actualizan en tiempo real
3. Abrir DevTools → Performance tab → verificar que el `postMessage` del worker ya no muestra copias grandes (el tiempo de serialización debería ser mínimo)
4. Verificar que al cambiar FFT size, los buffers se reallocan correctamente en el worker
5. Capturar una instantánea durante la medición → verificar que los datos capturados son correctos (no están vacíos ni corruptos por el transfer)

---

# Resumen de cambios por archivo

| Archivo | Fase | Cambio |
|---------|------|--------|
| 11 archivos huérfanos | F1 | Movidos a `src/_deprecated/` |
| `package.json` | F1 | Eliminar `headroom-ai` y `adapter-auto` |
| `src/app.html` | F1 | `lang="en"` → `lang="es"` |
| `src/lib/stores/mathOrchestrator.svelte.ts` | F1, F3 | Limpiar imports/dummy (F1), eliminar doble copia (F3) |
| `src/routes/+page.svelte` | F1, F2 | Eliminar hotkey D (F1), filtrar inputs (F2) |
| `src/lib/stores/traceManager.svelte.ts` | F2 | Simplificar loadFromDB |
| `src/lib/utils/db.ts` | F2 | Singleton de conexión |
| `src/lib/dsp/dspWorker.ts` | F3 | Transferable arrays |
