# Prompts de Implementación: Fase 1 (Motor de Calibración)

Este documento contiene la secuencia de prompts para ejecutar la Fase 1 del Asistente de Audio Proactivo usando Gemini 3 Flash. 

## Instrucciones de uso
1. Abre un nuevo chat con Gemini 3 Flash.
2. Copia y pega cada bloque marcado como **[PROMPT]** secuencialmente.
3. Aplica los cambios en tu proyecto antes de enviar el siguiente prompt.

---

### [PROMPT 1] Preparación y Librerías Matemáticas
```text
Actúa como un Ingeniero de Audio DSP y Desarrollador Svelte 5 Senior. Estamos en la "Fase 1" de nuestro Asistente de Audio Proactivo (una PWA de calibración acústica). Ya tenemos el scaffolding con Vite, Tailwind y el HAL de audio funcionando.

Nuestro objetivo es implementar el "Motor de Calibración" capaz de medir la Función de Transferencia Dual-Canal (Magnitud, Fase y Coherencia).

Paso 1: Instalación de dependencias.
Dame el comando para instalar `meyda` (para extracción de características acústicas) y `fft.js` (una implementación pura en JS para la Transformada de Fourier).

Paso 2: Utilidades de matemáticas complejas y FFT.
Para calcular la función de transferencia ($H(f) = Y(f) / X(f)$) necesitamos dividir los resultados de las FFT.
Crea el archivo `src/lib/dsp/math.ts` y exporta:
1. Una interfaz `Complex` `{ re: number, im: number }`.
2. Funciones puras para operaciones: `complexDiv(a: Complex, b: Complex): Complex`, `complexMag(c: Complex): number` (en dB: $20 * \log10(\sqrt{re^2 + im^2})$), y `complexPhase(c: Complex): number`.
3. Una función matemática `unwrapPhase(phases: number[]): number[]` que elimine los saltos bruscos de fase mayores a $\pi$ o $-\pi$.
4. Una función envoltorio `performFFT(signal: number[]): Complex[]` que inicialice `FFT` de `fft.js`, reciba un bloque de muestras de tamaño potencia de 2, ejecute la transformada forward y retorne el array de complejos.

Genera el comando de instalación y el código completo de `math.ts`.
```

---

### [PROMPT 2] Motor de Función de Transferencia
```text
Excelente. Ahora vamos a construir el núcleo matemático de la medición.

Crea el archivo `src/lib/dsp/TransferFunction.ts`.
Esta clase debe encargarse de comparar la señal que sale de la computadora (Referencia) contra la señal que entra por el micrófono (Medición).

Reglas para la clase `TransferFunction`:
1. Debe tener un método `process(refSpectrum: Complex[], micSpectrum: Complex[])`. (Asume que los arrays ya vienen de una FFT previa).
2. Calcula la Magnitud de la Función de Transferencia en dB: $20 * \log10(\text{Magnitud}(mic / ref))$.
3. Calcula la Fase (usando la función que creaste antes).
4. Estima la Coherencia (entre 0 y 1). Para simplificar en esta iteración, implementa una versión simulada o una métrica basada en el SNR si no quieres implementar el promediado de auto-espectros cruzados completo ($S_{xy} / \sqrt{S_{xx}S_{yy}}$). Puedes usar un buffer simple para promediar las últimas N magnitudes y detectar inestabilidad.
5. Retorna un objeto `{ magnitudeDB: number[], phase: number[], coherence: number[] }`.

Muestra solo el código de `TransferFunction.ts`.
```

---

### [PROMPT 3] Curva Objetivo y Algoritmo AutoEq
```text
El Asistente debe comparar la respuesta medida de la sala con una curva ideal y sugerir filtros (AutoEq).

Crea el archivo `src/lib/dsp/AutoEq.ts`.
Reglas:
1. Exporta un tipo `FilterSuggestion`: `{ freq: number, gainDB: number, q: number, type: 'peq' | 'notch' }`.
2. Crea una función `generateTargetCurve(fftSize: number, sampleRate: number): number[]`. Esta curva debe representar el "Spoken Word Profile": plana a 0dB entre 250Hz y 2kHz, con una caída (roll-off) suave en graves (high-pass effect) y agudos.
3. Crea la función principal `calculateAutoEq(measuredMagnitudeDB: number[], targetCurveDB: number[], freqs: number[]): FilterSuggestion[]`.
   - Paso A: Calcula el array de Error: `measured - target`.
   - Paso B: Algoritmo de "Peak Finding" simple. Encuentra los picos locales del array de error que superen los +3dB (sobre la curva objetivo).
   - Paso C: Por cada pico grave (>3dB), genera una sugerencia de atenuación (`gainDB = -error`). Prioriza fuertemente realizar *cortes* (ganancia negativa) en lugar de *boosts*.

Dame el código completo de `AutoEq.ts`.
```

---

### [PROMPT 4] Gestión de Estado (Svelte Runes)
```text
Vamos a conectar el DSP con la UI usando el sistema reactivo de Svelte 5.

Crea el archivo `src/lib/stores/calibrationStore.ts`.
Usa `$state` para definir un almacén reactivo (una clase o un objeto exportado).
Debe contener:
- `isMeasuring`: boolean.
- `measuredMagnitude`: number[] vacío.
- `targetMagnitude`: number[] vacío.
- `predictedMagnitude`: number[] vacío (la suma de medida + filtros).
- `suggestedFilters`: FilterSuggestion[] vacío.
- `coherenceScore`: number (promedio de coherencia, 0 a 1).

Exporta métodos para actualizar estos estados: `updateMeasurement(mag, coherence)`, `calculateFilters()`, y `applyFilter(filter)`. Usa la función de AutoEq que creamos para poblar `suggestedFilters`.

Genera el código usando la sintaxis de Svelte 5 (`$state()`).
```

---

### [PROMPT 5] UI: Trace Math Visualizer (Canvas Multicapa)
```text
Es hora de mejorar el Canvas. El viejo RTA de una sola línea ahora será el "Trace Math Visualizer".

Sobrescribe (o renombra a) `src/components/TraceMath.svelte`.
Reglas de renderizado (usa `requestAnimationFrame` en un `$effect`):
1. **Fondo:** Usa tema claro de alto contraste. Dibuja una grilla semitransparente con guías de frecuencia logarítmica (100Hz, 1kHz, 10kHz).
2. **Medición Real:** Dibuja el array `calibrationStore.measuredMagnitude` en color Gris Oscuro/Azul Marino (`stroke`).
3. **Curva Objetivo:** Dibuja `calibrationStore.targetMagnitude` como una línea Punteada Blanca o Gris Clara (usa `setLineDash`).
4. **Respuesta Predictiva:** Dibuja `calibrationStore.predictedMagnitude` en color Verde Vibrante.
5. **Semáforo de Coherencia:** En una esquina del Canvas, dibuja un pequeño círculo o barra indicadora que cambie de color (Rojo < 0.4, Amarillo < 0.7, Verde > 0.7) según el `coherenceScore`.

Muestra el código del componente de Svelte.
```

---

### [PROMPT 6] UI: Controles de Calibración
```text
Para terminar la Fase 1, necesitamos la interfaz del operador.

Crea `src/components/CalibrationPanel.svelte`.
Diseña un panel lateral (TailwindCSS) que muestre:
1. Botón "Emitir Ruido Rosa". Al activarlo, llama al HAL para generar ruido, y arranca la medición del `calibrationStore`.
2. Botón "AutoEq: Sugerir Filtros". Al presionarlo, dispara `calculateFilters()`.
3. Una lista iterativa de los `suggestedFilters` (mostrando Freq, Gain, Q). Permite al usuario eliminar un filtro de la lista, lo cual debería recalcular y actualizar `predictedMagnitude` automáticamente.

Luego, actualiza `src/App.svelte` para importar e integrar `TraceMath.svelte` en el área principal y `CalibrationPanel.svelte` en una barra lateral.

Dame el código de ambos componentes.
```
