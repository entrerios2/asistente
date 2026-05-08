# Implementación Fase 1: Motor de Calibración

## Objetivo
Transformar el andamiaje inicial (RTA básico) en una herramienta de medición acústica profesional. El operador podrá medir la respuesta de la sala (Función de Transferencia Dual-Canal), visualizar la Curva Objetivo (Spoken Word) y recibir sugerencias automáticas de ecualización (AutoEq) priorizando atenuaciones.

## Decisiones de Diseño Aprobadas
- **Librerías Matemáticas (FFT/DSP):** Se priorizará el uso de librerías JS puras (como `fft.js` y `meyda`) en lugar de módulos WASM pre-compilados complejos (C/Rust). Esto facilitará la depuración, iteración y compatibilidad inmediata con la interfaz reactiva de Svelte durante esta fase temprana del proyecto, dejando la optimización de bajo nivel para más adelante si el rendimiento lo exige.

## Open Questions
- **Log Sweep vs Ruido Rosa:** El DDS menciona ambos. El barrido logarítmico (Sweep) es excelente para sacar la Respuesta al Impulso (IR) y el STI. Sin embargo, el Ruido Rosa es mejor para el "Trace Math" interactivo. ¿Quieres que implementemos ambos métodos ahora, o priorizamos el análisis por Ruido Rosa continuo para alimentar el AutoEq interactivo?

## Proposed Changes

### 1. Dependencias
- Integrar `meyda` para la extracción de características acústicas perceptuales.
- Integrar una librería de Transformada de Fourier pura en JS (ej. `fft.js` o una implementación propia en TS) para calcular la magnitud y fase de las señales crudas entrantes, facilitando el trabajo con números complejos.

### 2. Motor DSP (Matemáticas Core)
#### [NEW] `src/lib/dsp/math.ts`
Utilidades para operaciones con números complejos (Suma, Multiplicación, Magnitud, Fase), necesarias para comparar la señal del micrófono vs la señal de referencia original.

#### [NEW] `src/lib/dsp/TransferFunction.ts`
Clase que recibe dos buffers (Referencia y Micrófono).
- **Magnitud:** Diferencia en dB entre ambos espectros.
- **Fase:** Diferencia temporal/angular desenrollada (Unwrapped Phase).
- **Coherencia ($y^2$):** Evaluación estadística de causalidad entre 0 y 1. Si es < 0.5, el semáforo marcará 🔴.

#### [NEW] `src/lib/dsp/AutoEq.ts`
Algoritmo de optimización.
- Recibe la curva medida y la Curva Objetivo.
- Calcula el "Error" (Diferencia).
- Aplica un algoritmo iterativo (Peak Finding) para sugerir filtros Biquad (Frecuencia, Ganancia negativa, Factor Q) que aplanen los picos del error.

### 3. Curva Objetivo y Estado
#### [NEW] `src/lib/stores/calibrationStore.ts`
Estado de Svelte 5 (usando `$state`) para almacenar:
- Los puntos de la Curva Objetivo (Spoken Word: plana de 250Hz a 2kHz, con roll-off en graves y agudos).
- El array de filtros sugeridos por el AutoEq.
- El snapshot de la medición inicial.

### 4. Capa HAL (Generador Interno)
#### [MODIFY] `src/lib/hal/web/WebAudioProvider.ts`
Mejorar el método `playPinkNoise()`. Ahora, el ruido generado no solo debe ir a los altavoces, sino que una copia digital exacta debe enviarse al `TransferFunction` como "Señal de Referencia" ($X(f)$) para compararla con el micrófono ($Y(f)$).

### 5. Interfaz Visual (Trace Math Visualizer)
#### [MODIFY] `src/components/RTA.svelte` -> `TraceMath.svelte`
Evolución del RTA simple a un visualizador multi-capa:
- Dibuja la curva medida (gris/azul).
- Dibuja la Curva Objetivo (línea punteada blanca).
- Dibuja la suma algrebraica (Predicted: Medición + Filtros) en color verde.
- Agrega un medidor tipo "Semáforo" (Coherencia).

#### [NEW] `src/components/FilterList.svelte`
Componente lateral que muestra la lista de filtros sugeridos por el `AutoEq`, permitiendo al usuario modificarlos manualmente y ver cómo afecta la curva predictiva en tiempo real.

## Verification Plan

### Automated/Local Tests
- **Math Tests:** Escribir pequeñas pruebas unitarias (o validar mediante consola) que la división compleja funciona (ej. si Referencia y Micrófono son idénticos, la función de transferencia es una línea plana en 0dB).
- **Meyda:** Verificar que `Meyda.extract` no bloquee el hilo principal.

### Manual Verification
- **Trace Math:** Al activar el Ruido Rosa, acercar la mano al micrófono para generar un filtro peine y confirmar que la línea de "Coherencia" baja en las frecuencias canceladas.
- **AutoEq:** Provocar un acople controlado o realzar una frecuencia en un ecualizador físico y verificar que el algoritmo sugiera un Notch exacto en esa frecuencia.
