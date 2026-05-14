# Informe Post-Fase 1: Estado, Decisiones y Backlog Arquitectónico

Este documento sirve como puente entre la Fase 1 (donde construimos los bloques fundamentales de DSP y APST) y la Fase 2 (Orquestación End-to-End). Aquí documentamos el estado actual, las decisiones arquitectónicas que hemos tomado sobre la marcha, y el backlog de deudas técnicas o funcionalidades diferidas.

---

## 1. Estado Actual (Fin de Fase 1)

El andamiaje de medición y calibración está operativo en su nivel fundamental:
- **Infraestructura APST:** El orquestador base, el reproductor de archivos, el detector Goertzel y los 6 segmentos atómicos (`V, A, N, F, P, T`) están implementados en TypeScript puro.
- **Calibración Interactiva:** El estado reactivo con Svelte 5, el motor `AutoEq` con muros de seguridad básicos, y el `TraceMath` (con sus 3 capas visuales) están funcionales.
- **Hardware Abstraction Layer (HAL):** Se abstrajo con éxito la selección de dispositivos para Tauri utilizando Rust (`cpal`) y se mantiene un fallback para WebAudio.
- **Bugs corregidos:** La función de Transformada Inversa Rápida de Fourier (IFFT) fue implementada para asegurar cálculos correctos en el Segmento T (Alineamiento Temporal).

---

## 2. Nueva Decisión Arquitectónica: Procesamiento Dual (Fast-Path / Slow-Path)

A partir de la discusión post-Fase 1, hemos adoptado formalmente el patrón de **Procesamiento Dual Híbrido** para las secuencias de medición APST largas. Esta decisión resuelve el problema de la latencia en el feedback al usuario (no esperar un minuto para enterarse de un error) y optimiza el rendimiento.

### Fast-Path (Tiempo Real / Baja Resolución)
Ocurre concurrentemente mientras la secuencia de audio se está grabando en el `SharedArrayBuffer`:
- **Propósito:** Detección de "Showstoppers" (errores fatales) y feedback visual en vivo.
- **Mecanismo:** Procesamiento ligero en el hilo principal o un worker auxiliar rápido.
- **Comportamientos:**
  - **RMS Constante:** Si el nivel cae drásticamente o entra en *clipping*, se aborta la secuencia al instante protegiendo los oídos del operador y los equipos.
  - **Live RTA (Baja Res):** Ejecución de FFTs pequeñas (ej. 1024 bins) para dar feedback visual fluido en el `TraceMath` indicando que el sistema "está escuchando".
  - **Degradación Automática (Modo Ciego):** Si el CPU del dispositivo se satura (ej. Tier 0 antiguo), el *Fast-Path* se suicida dinámicamente. La UI pasa a un simple spinner de "Grabando..." y se pierde la detección de *showstoppers*, pero se asegura la grabación de audio crudo sin *underruns* para el *Slow-Path*.

### Slow-Path (Offline / Alta Resolución)
Ocurre solo si la secuencia completa sobrevive sin disparar ningún showstopper en el Fast-Path:
- **Propósito:** Precisión matemática total para calibración.
- **Mecanismo:** Web Worker pesado procesando el volcado completo del `SharedArrayBuffer`.
- **Comportamientos:**
  - Aplica ventanas Hanning grandes con overlap y FFTs masivas (ej. 65536 bins) para una resolución espectral óptima (≤ 1 Hz/bin).
  - Calcula la Coherencia estadística y la Función de Transferencia fina.
  - Extrae el retardo temporal exacto (Segmento T) y corre el AutoEq.

*Esta arquitectura deberá ser la base para construir el Orquestador End-to-End en la Fase 2.*

---

## 3. Backlog y Deudas Técnicas Diferidas

Los siguientes elementos fueron planificados originalmente para la Fase 1 pero, de manera consciente, se han diferido porque requieren que el flujo "End-to-End" de la Fase 2 esté operativo para poder testearlos o alimentarlos con datos reales:

### 3.1. Estimador STI (Speech Transmission Index)
- **Estado:** No implementado.
- **Dependencia:** Requiere una Respuesta al Impulso (IR) real, larga y limpia obtenida del Segmento T y F para poder analizar la relación energía temprana/tardía en bandas de octava.
- **Plan:** Implementar en Fase 2 o 3, una vez que el sistema pueda grabar impulsos acústicos reales de un recinto.

### 3.2. Integración de Meyda.js
- **Estado:** No instalada.
- **Dependencia:** Extrae características perceptuales (MFCC, Flatness). Solo es útil para la clasificación de perfiles de micrófono o para el "Fast-Rail" (Fase 3).
- **Plan:** Diferida hasta Fase 3 para no engordar el bundle prematuramente.

### 3.3. Perfiles Agnósticos Formales
- **Estado:** Funciona el booleano `agnosticMode` en `AutoEq` (prohibe ganancias positivas), pero faltan las matrices de datos de los perfiles específicos (Variante A y B).
- **Dependencia:** Para que sean útiles, necesitamos inyectar curvas de compensación de micrófono reales.
- **Plan:** Abordar en paralelo con la estabilización de la Fase 2.

### 3.4. Coherencia Real en la UI
- **Estado:** El semáforo de coherencia en el componente `TraceMath` está *hardcodeado* a `0.85`.
- **Dependencia:** Requiere el pipeline Slow-Path entregando el array de coherencia matemática calculado por el `TransferFunction`.
- **Plan:** Cablear el semáforo y la escala de colores al `calibrationStore` en la Fase 2.

### 3.5. Generación Masiva y Compatibilidad del APST Builder
- **Estado:** El builder CLI funciona y ensambla archivos FLAC validos, pero el script actual está configurado para generar solo 1 archivo de prueba por defecto.
- **Plan:** Extender el script (o automatizarlo en el CI) para generar la matriz completa de ~57 archivos de prueba.
  - **Formato Universal (WAV):** Implementar la exportación principal en `.wav` sin compresión para máxima compatibilidad con el puerto USB de consolas digitales para playback offline.
  - **Veto a Formatos Lossy:** Se documenta la política estricta de prohibir la generación o el uso de MP3/AAC/OGG, ya que la compresión psicoacústica destruye la información de fase (invalidando Segmento P) e introduce artefactos temporales que invalidan la Respuesta al Impulso (Segmento T).

### 3.6. Ampliación del Testeador de Cables (Loopback)
- **Estado:** La utilidad base (`CableTester.ts`) está implementada y diagnostica Continuidad y Polaridad Invertida usando la secuencia `V P`.
- **Plan:** Expandir la funcionalidad para diagnosticar salud física y eléctrica del cable.
  - Incorporar el **Segmento N** a la secuencia para detectar bucles de masa (picos en 50/60 Hz) y fallas de blindaje (elevado piso de ruido).
  - Incorporar el **Segmento X** (Crosstalk) en la secuencia para evaluar diafonía en cables multipar o estéreo, pero mantener su evaluación matemática como **opcional** en la UI para cables mono estándar.
  - **Puntuación e Inventario:** Calcular un **Puntaje de Salud (Cable Score)** basado en la atenuación (A) y la relación señal/ruido (N). A futuro, cuando el módulo de inventario esté operativo, este puntaje se guardará automáticamente en la base de datos asociado al ID/Código de Barras del cable físico, permitiendo predecir fallas y registrar su degradación a lo largo de los años.
