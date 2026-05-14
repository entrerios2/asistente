# Prompts de Implementación: Fix Gaps Fase 1 (Para Gemini 3 Flash)

Esta secuencia de prompts corrige tres deudas técnicas (gaps) identificadas tras la Fase 1: la capa faltante en TraceMath, el Segmento T (Alineamiento Temporal) y la abstracción HAL para la selección de dispositivos en Tauri.

---

### [PROMPT 23] Fix Gap 1: TraceMath 3ª Capa (Filtro Inverso)
```text
Actúa como un Desarrollador Svelte/TypeScript Senior. En nuestra UI de medición (TraceMath), necesitamos agregar la capa visual que muestra la respuesta aislada de los filtros de ecualización activos (sin sumar la medición original).

1. Modifica `src/lib/stores/calibrationStore.svelte.ts`:
   - Agrega un nuevo estado derivado llamado `filterResponseCurve`.
   - La lógica es idéntica a `predictedCurve`, iterando por los bins y calculando la suma de las respuestas de los filtros usando `calculateFilterGainAt`, pero NO debes sumar `this.measuredCurve[i]`. Devuelve el `Float32Array` resultante.

2. Modifica `src/components/TraceMath.svelte`:
   - En la función `draw()`, añade una nueva llamada a `drawCurve` entre la medición cruda y la respuesta prevista.
   - Pasa como datos `calibrationStore.filterResponseCurve`.
   - Usa un color amarillo translúcido: `'rgba(255, 204, 0, 0.6)'` y grosor `2`.

Genera el código modificado para ambos archivos respetando la sintaxis de Svelte 5.
```

---

### [PROMPT 24] Fix Gap 3: Segment T (Alineamiento Temporal)
```text
Actúa como un Ingeniero de DSP y TypeScript. Necesitamos implementar el último segmento del protocolo APST: el Segmento T (Time Alignment).

1. Crea el archivo `src/lib/dsp/apst/segments/SegmentT.ts`.
   - Exporta una clase estática `SegmentT`.
   - El método `process(refBuffer: Float32Array, measBuffer: Float32Array, sampleRate: number)` debe calcular el delay en milisegundos.
   - Usa nuestras funciones `fft` (de `../../fft`) y `ComplexMath` (de `../../math`).
   - Algoritmo a implementar:
     a) Calcula FFT de referencia (X) y medición (Y).
     b) Calcula H(f) = Y(f) * conj(X(f)) / |X(f)|².
     c) Calcula la IFFT de H(f) para obtener la Respuesta al Impulso (IR). Como nuestra `fft` solo toma inputs reales, utiliza el truco del conjugado: IFFT(H) = conj(FFT(conj(H))) / N. Aplica este truco construyendo un input real a partir de la parte real del conjugado.
     d) Busca el índice del valor absoluto máximo en la primera mitad del resultado (la IR).
     e) Retorna `delayMs = (peakIndex / sampleRate) * 1000` y el array de la IR.

Asegúrate de manejar divisiones por cero agregando un pequeño epsilon (ej. 1e-12) en el cálculo de potencia. Genera el código TypeScript.
```

---

### [PROMPT 25] Fix Gap 6: HAL Device Selection
```text
Actúa como un Arquitecto TypeScript. Necesitamos abstraer la selección de dispositivos de Tauri detrás de nuestra interfaz HAL para no violar la arquitectura.

1. Modifica `src/lib/hal/types.ts`:
   - Define y exporta la interfaz `AudioDevice` (id, name, backend, direction: 'input' | 'output').
   - Extiende `AudioProvider` con dos métodos opcionales: `listDevices?(): Promise<AudioDevice[]>` y `selectDevice?(id: string, direction: 'input' | 'output'): Promise<void>`.

2. Modifica `src/lib/hal/tauri/TauriAudioProvider.ts` (crea el archivo si no existe, asumiendo que debe implementar `AudioProvider`):
   - Implementa los métodos `listDevices` y `selectDevice` usando `invoke('list_audio_devices')` y `invoke('select_audio_device', { id, direction })` del `@tauri-apps/api/core`.

3. Refactoriza `src/components/DeviceSelector.svelte`:
   - Elimina la importación directa de `invoke` y el chequeo de `__TAURI_INTERNALS__`.
   - Usa el factory del HAL: `import { getAudioProvider } from '$lib/hal'; const hal = getAudioProvider();`.
   - Cambia las llamadas en `onMount`, `updateInput` y `updateOutput` para usar `hal.listDevices()` y `hal.selectDevice()`. Usa condicionales `if (hal.listDevices)` para mostrar o no la funcionalidad.

Genera el código TypeScript y Svelte para aplicar este refactor.
```

---

### [PROMPT 26] Fix Bug: Implementación de IFFT y corrección en Segment T
```text
Actúa como un Ingeniero DSP. Durante la revisión del `SegmentT.ts` detectamos un bug en la línea `const fftOfConj = fft(hReal, hConjImag);`. Nuestra función actual `fft()` en `src/lib/dsp/fft.ts` solo acepta una entrada real (un único `Float32Array`) y asume entrada imaginaria cero, por lo que ignora el segundo argumento. Para calcular correctamente la IFFT de la función de transferencia compleja, necesitamos soporte para entradas complejas o una función `ifft` dedicada.

1. Modifica `src/lib/dsp/fft.ts`:
   - Refactoriza el algoritmo interno para soportar entradas complejas. Puedes crear una función interna `coreFFT(real: Float32Array, imag: Float32Array, inverse: boolean)` que contenga la lógica iterativa Radix-2. Si `inverse` es true, el ángulo de rotación cambia de signo (o conjugas antes y después) y al final divides los resultados por N.
   - Mantén la firma actual de `export function fft(input: Float32Array)` pero haz que llame al core internamente pasando un array de ceros para la parte imaginaria.
   - Agrega y exporta una nueva función `export function ifft(real: Float32Array, imag: Float32Array): Float32Array`. Esta función llama al core con `inverse = true` y devuelve solo la parte real del resultado (ya que la IR física es puramente real).

2. Modifica `src/lib/dsp/apst/segments/SegmentT.ts`:
   - Cambia la importación para incluir `ifft`.
   - Reemplaza todo el bloque "c) Calcular IFFT(H)" usando directamente la nueva función: `const ir = ifft(hReal, hImag);`.
   - Elimina la lógica sucia del conjugado manual y la división manual por N (ya que `ifft` se encargará de ello).

Genera el código TypeScript para `fft.ts` y la versión limpia de `SegmentT.ts`.
```
