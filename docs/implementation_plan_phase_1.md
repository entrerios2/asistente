# Implementación Fase 1: APST Core + Calibración Interactiva

Este documento cubre las dos sub-fases de medición: **Fase 1A** (infraestructura APST y DSP core) y **Fase 1B** (calibración interactiva con AutoEq).

---

## Fase 1A — Infraestructura de Medición y APST Core

### Objetivo
Transformar el andamiaje inicial en un sistema capaz de reproducir secuencias FSK pregrabadas, detectar cabeceras Goertzel en tiempo real y ejecutar los segmentos de medición fundamentales del protocolo APST. Al finalizar, el sistema puede orquestar una secuencia completa `V A N F P T` sin intervención manual.

### Decisiones de Diseño Aprobadas
- **Playback de secuencias:** Se reproducen archivos FLAC pre-generados por el APST Builder (Pre-Fase). No se sintetiza audio en tiempo real en esta fase.
- **Detección FSK:** Algoritmo Goertzel implementado directamente en el `AudioWorkletProcessor`, con dos bancos paralelos (HF: 1650/1850 Hz, LF: 150/200 Hz).
- **Modelo Híbrido:** Para segmentos largos (ej. Sweep `S` de 20s), el Worklet actúa solo como trigger: detecta la cabecera, inicia la grabación en `SharedArrayBuffer`, y un Web Worker procesa el buffer completo offline al finalizar. El modo se selecciona por Tier (0/1 → Offline; 2 → Real-Time) y es configurable.
- **Librerías:** Se prioriza JS/TS puro. Se reutiliza el motor FFT de la Pre-Fase para la Función de Transferencia.

### Proposed Changes

#### 1. Playback FSK

##### [NEW] `src/lib/dsp/apst/Player.ts`
Módulo de reproducción de secuencias FLAC. Detecta el sample rate del `AudioContext` y selecciona la versión exacta del archivo para evitar resampling.

##### [MODIFY] `src/lib/hal/types.ts`
Extender `AudioProvider` con `playSample(url: string): Promise<void>` para reproducir archivos de audio pregrabados.

#### 2. Detector Goertzel

##### [NEW] `src/lib/dsp/apst/GoertzelDetector.ts`
Implementación del algoritmo Goertzel para detectar las frecuencias FSK (1650 y 1850 Hz para HF, 150 y 200 Hz para LF) dentro del flujo de audio del `AudioWorklet`. Decodifica el framing de 110 baudios (1 start, 7 data, 1 parity even, 2 stop) y emite el código del segmento identificado.

#### 3. Orquestador de Secuencias

##### [NEW] `src/lib/dsp/apst/Orchestrator.ts`
Máquina de estados que parsea cadenas de segmentos (ej. `"V A N F P"`), valida las reglas de orquestación (toda secuencia comienza con `V` o `A`; `AutoEq` requiere `N` previo con SNR > 15 dB) y ejecuta cada paso secuencialmente: reproduce el FLAC → espera detección Goertzel del siguiente segmento → procesa el resultado → avanza.

#### 4. Implementación de Segmentos

##### [NEW] `src/lib/dsp/apst/segments/`
Un módulo por segmento con la lógica de procesamiento post-captura:
- `SegmentV.ts` — Verificación de integridad: confirma que el audio viaja (energía > umbral).
- `SegmentA.ts` — Normalización: mide nivel del tono 1 kHz, calcula offset de ganancia.
- `SegmentN.ts` — Ruido de fondo: mide RMS en silencio, calcula SNR vs Segmento A. Bloquea si < 15 dB.
- `SegmentF.ts` — Respuesta en frecuencia: captura sweep, calcula magnitud espectral.
- `SegmentP.ts` — Coherencia + polaridad: evalúa coherencia dual-canal, detecta inversión 180°.
- `SegmentT.ts` — Alineamiento temporal: extrae IR vía IFFT, calcula delta-delay en ms.

#### 5. Función de Transferencia Dual-Canal

##### [NEW] `src/lib/dsp/TransferFunction.ts`
Clase que recibe dos buffers (Referencia y Micrófono):
- **Magnitud:** Diferencia en dB entre ambos espectros (`H(f) = Y(f) / X(f)`).
- **Fase:** Diferencia angular desenrollada (unwrapped phase).
- **Coherencia (γ²):** Evaluación estadística de causalidad entre 0 y 1.

##### [NEW] `src/lib/dsp/math.ts`
Utilidades para números complejos: suma, multiplicación, magnitud, fase, conjugado.

#### 6. Meyda.js

##### [NEW] Dependencia `meyda`
Integrar para extracción de características perceptuales (MFCC, Spectral Flatness, ZCR) que alimentarán el Fast-Rail en Fase 3.

#### 7. Testeador de Cables (Loopback)

##### [NEW] `src/lib/dsp/apst/CableTester.ts`
Modo Loopback: ejecuta `V P` en circuito cerrado (salida → cable → entrada) para diagnosticar continuidad, inversión de polaridad y diafonía sin altavoces.

### Verification Plan

#### Automated Tests
- **Goertzel:** Test unitario con señal sinusoidal a 1650 Hz: debe reportar "Mark". A 1850 Hz: "Space". A 1000 Hz: silencio.
- **Orquestador:** Test de secuencia `V A N F P` con audio simulado: debe avanzar por todos los estados sin errores.
- **TF:** Si Referencia = Micrófono, la función de transferencia es 0 dB plano con coherencia 1.0.

#### Manual Verification
- Reproducir una secuencia FLAC por altavoz, capturar con micrófono, confirmar que el Goertzel detecta las cabeceras.
- Conectar cable de salida a entrada (loopback): el Testeador debe reportar "Cable OK" o "Polaridad invertida".

---

## Fase 1B — Calibración Interactiva y AutoEq

### Objetivo
Dotar al operador de las herramientas visuales e interactivas para interpretar las mediciones (Trace Math Visualizer), comparar contra una curva objetivo y recibir sugerencias de ecualización automática con muros de seguridad.

### Decisiones de Diseño Aprobadas
- **Curva Objetivo:** Respuesta plana (0 dB) de 20 Hz a 20 kHz con tolerancia ±3 dB (80 Hz – 16 kHz). En modo Agnóstico, tolerancia relajada a ±6 dB.
- **AutoEq:** Prioriza cortes (atenuaciones) sobre boosts. En modo Agnóstico B (mic vocal), los boosts están prohibidos. Máximo de boost permitido: +3 dB para altavoz desconocido.
- **STI:** Se etiqueta como "STI-Estimado (desde IR)" en la UI. No es medición STIPA real.

### Proposed Changes

#### 1. Curva Objetivo

##### [NEW] `src/lib/stores/calibrationStore.ts`
Estado Svelte 5 (`$state`) para la curva objetivo, los filtros sugeridos, el snapshot inicial y el modo agnóstico activo.

#### 2. Motor AutoEq

##### [NEW] `src/lib/dsp/AutoEq.ts`
Recibe la curva medida y la curva objetivo. Calcula el error (diferencia). Aplica un algoritmo iterativo (Peak Finding) para sugerir filtros Biquad (Frecuencia, Ganancia, Q). Restricciones de seguridad:
- Nunca sugiere boost > +3 dB (modo general) o > 0 dB (modo Agnóstico B).
- Prioriza cortes.
- Respeta el gate de coherencia (no sugiere donde coherencia < 50%).

#### 3. Trace Math Visualizer

##### [NEW] `src/components/TraceMath.svelte`
Evolución del RTA. Canvas con 3 capas superpuestas:
1. **Medición Cruda** (gris/azul): espectro capturado.
2. **Filtro Inverso / EQ Target** (amarillo): sugerencia del AutoEq.
3. **Respuesta Prevista** (verde): suma algebraica `R_prevista = R_medida + R_filtro`.

Incluye medidor tipo "Semáforo" (Coherencia).

##### [NEW] `src/components/FilterList.svelte`
Lista lateral de filtros sugeridos. Editable: el operador puede modificar ganancia, Q y frecuencia manualmente. Cada cambio recalcula la curva predicha en tiempo real.

#### 4. Alineamiento Temporal

##### [MODIFY] `src/lib/dsp/TransferFunction.ts`
Añadir cálculo de fase desenrollada (Unwrapped Phase) y derivación de delay (ms) entre subsistemas.

#### 5. STI-Estimado

##### [NEW] `src/lib/dsp/STIEstimator.ts`
Calcula el Speech Transmission Index estimado a partir de la Respuesta al Impulso. Analiza la relación energía temprana / tardía en 7 bandas de octava.

#### 6. Perfiles Genéricos de Seguridad

##### [NEW] `src/lib/dsp/AgnosticProfiles.ts`
Implementa Variante A (Condensador Omnidireccional: fade-out de confianza en extremos), Variante B (Dinámico Cardioide: curva inversa promedio, boosts prohibidos) y Altavoz Desconocido (boost máx +3 dB).

### Verification Plan

#### Automated Tests
- **AutoEq Safety:** Test con señal con pico extremo de +20 dB: el filtro sugerido nunca debe exceder los límites.
- **Coherencia Gate:** Test con coherencia simulada < 0.5: el AutoEq no debe sugerir filtros en esa zona.

#### Manual Verification
- Activar Ruido Rosa, acercar la mano al micrófono (filtro peine): confirmar que la coherencia baja y el semáforo cambia a rojo.
- Provocar un pico con ecualizador físico: verificar que AutoEq sugiere un Notch exacto en esa frecuencia.
- Verificar el Trace Math: las 3 capas deben ser visualmente distinguibles y la curva predicha debe coincidir con la suma algebraica.
