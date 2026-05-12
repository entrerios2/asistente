# Secuencia de Prueba FSK para Calibración A/V

## Especificación Técnica para la Plataforma PWA de Asistencia Proactiva

---

## Índice

1. [El Estándar Original: EBU 1985](#1-el-estándar-original-ebu-1985)
2. [La Innovación Lindos: Secuencias Segmentadas](#2-la-innovación-lindos-secuencias-segmentadas)
3. [Cómo Funciona el FSK Técnicamente](#3-cómo-funciona-el-fsk-técnicamente)
4. [Por Qué FSK es la Elección Correcta para Este Proyecto](#4-por-qué-fsk-es-la-elección-correcta-para-este-proyecto)
5. [Implementación FSK en el Navegador](#5-implementación-fsk-en-el-navegador)
6. [FSK como Instrumento de Diagnóstico de la Cadena de Señal](#6-fsk-como-instrumento-de-diagnóstico-de-la-cadena-de-señal)
7. [Biblioteca de Segmentos Recomendados](#7-biblioteca-de-segmentos-recomendados)
8. [Especificación Detallada de Cada Código](#8-especificación-detallada-de-cada-código)
  - [V — Verificación de Cadena de Señal (Path Audit)](#v--verificación-de-cadena-de-señal-path-audit)
  - [A — Nivel de Alineamiento](#a--nivel-de-alineamiento)
  - [M — Verificación de Perfil de Micrófono](#m--verificación-de-perfil-de-micrófono)
  - [N — Piso de Ruido](#n--piso-de-ruido)
  - [F — Respuesta en Frecuencia](#f--respuesta-en-frecuencia)
  - [P — Fase y Coherencia](#p--fase-y-coherencia)
  - [T — Alineamiento Temporal (Delay Finder)](#t--alineamiento-temporal-delay-finder)
  - [D — Distorsión THD+N](#d--distorsión-thdn)
  - [X — Diafonía y Aislamiento de Canales](#x--diafonía-y-aislamiento-de-canales)
  - [R — Margen de Retroalimentación (Ring Out)](#r--margen-de-retroalimentación-ring-out)
9. [Duración de Cada Segmento y de la Suite Completa](#9-duración-de-cada-segmento-y-de-la-suite-completa)
10. [Orden Recomendado y Cadena de Dependencias](#10-orden-recomendado-y-cadena-de-dependencias)
11. [Secuencias Compuestas Recomendadas](#11-secuencias-compuestas-recomendadas)
12. [Ecualización por Respuesta al Impulso (IR EQ)](#12-ecualización-por-respuesta-al-impulso-ir-eq)
  - [Qué Captura el Segmento T](#qué-captura-el-segmento-t)
    - [El Problema del Filtro Inverso](#el-problema-del-filtro-inverso)
    - [Los Cuatro Problemas Prácticos](#los-cuatro-problemas-prácticos)
    - [Los Tres Outputs del Sistema](#los-tres-outputs-del-sistema)
    - [Pipeline Completo de Medición a IR EQ](#pipeline-completo-de-medición-a-ir-eq)
    - [Promediado Espacial](#promediado-espacial)
    - [Nuevo Segmento I — Captura y Exportación de IR](#nuevo-segmento-i--captura-y-exportación-de-ir)
    - [Limitaciones Honestas a Documentar](#limitaciones-honestas-a-documentar)
13. [Schema de Reporte de Secuencia](#13-schema-de-reporte-de-secuencia)
14. [Correspondencia Lindos LA100 ↔ Códigos APST del Proyecto](#14-correspondencia-lindos-la100--códigos-apst-del-proyecto)

---

## 1. El Estándar Original: EBU 1985

La prueba de secuencia automatizada nació con un bloque monolítico único de 32 segundos estandarizado por la EBU en 1985. Este estándar incorporaba:

- **13 tonos** de 40 Hz a 15 kHz a −12 dB para medición de respuesta en frecuencia
- **Dos tonos de distorsión** (1024 Hz y 60 Hz a +9 dB)
- Pruebas de **diafonía y companders**
- Una señal de **sincronización FSK a 110 baudios** al inicio

Esta secuencia también se convirtió en el estándar CCITT O.33 en 1985. Su limitación fundamental era estructural: era un bloque fijo e indivisible — se ejecutaba completo o no se ejecutaba. Útil, pero inflexible.

---

## 2. La Innovación Lindos: Secuencias Segmentadas

Lindos Electronics expandió el concepto reteniendo la sincronización FSK pero inventando las **secuencias segmentadas**: cada prueba se separa en un "segmento" que comienza con un carácter identificador transmitido como FSK a 110 baudios.

La contribución intelectual clave es que en lugar de una secuencia rígida, el sistema ofrece una **gramática**: un conjunto de primitivas de prueba atómicas que se componen en cualquier secuencia que la situación demande. Los segmentos son bloques de construcción intercambiables.

El sistema de secuencias Lindos es hoy un **estándar de facto** en radiodifusión y muchas otras áreas de prueba de audio, con más de 25 tipos de segmentos diferentes reconocidos por los equipos Lindos. El estándar EBU original ya no se utiliza.

---

## 3. Cómo Funciona el FSK Técnicamente

### La Capa Física

Cada segmento de prueba consiste en la señal de audio de prueba precedida por un **header FSK**. El header dura aproximadamente 200ms y cumple dos funciones simultáneas:

1. **Sincronización:** actúa como trigger para que la unidad medidora comience a medir
2. **Identificación:** transmite el código del segmento — el analizador sabe exactamente qué está midiendo antes de que llegue la señal de prueba

### La Propiedad Crítica: Sincronización In-Band

La innovación fundamental es que **el FSK viaja a través de la cadena de señal bajo prueba**, no por un cable de control separado. Esto significa:

- La misma secuencia que funciona en una mesa de mezclas local también funciona a través de un enlace satelital
- El analizador en el extremo receptor escucha el header FSK y sabe exactamente qué medir, independientemente del tiempo de viaje de la señal
- Los **errores de velocidad en reproducción de cinta**, que desincronizarían otros sistemas, son tolerados porque cada segmento se retempla desde su propio header FSK — no hay deriva acumulada

### Codificación FSK (Estándar Lindos)

```
FSK estándar Lindos (LA100/LA101/LA102/MS20):
  Mark  (bit 1) = 1650 Hz
  Space (bit 0) = 1850 Hz
  Velocidad     = 110 baudios
  Duración de bit ≈ 9.09 ms (1/110 s)
  Duración del header ≈ 200 ms por segmento
  Tolerancia a errores de velocidad: ±4%

Framing por carácter ASCII:
  1 start bit
  7 data bits (LSB primero)
  1 bit de paridad par (even parity)
  2 stop bits
  Total = 11 bits por carácter

El tono Mark (1650 Hz) se transmite durante al menos 2 bits
before del primer carácter de datos para permitir la sincronización
del receptor.
```

> **Nota:** Las frecuencias 1200/1800 Hz corresponden al estándar V.21 (módem telefónico). El estándar Lindos utiliza 1650/1850 Hz — rango escogido deliberadamente para maximizar la robustez a través de cadenas de audio de radiodifusión (paso de banda garantizado entre ~80 Hz y ~15 kHz).

### Cabecera de Baja Frecuencia (LF Header) para Subsistemas de Graves

El FSK estándar (1650/1850 Hz) no puede atravesar dispositivos con corte por debajo de 2 kHz — caso típico de subwoofers y filtros de crossover de baja frecuencia. Para estos subsistemas se usa una cabecera alternativa:

```
FSK cabecera LF (para subsistemas de graves):
  Mark  (bit 1) = 150 Hz
  Space (bit 0) = 200 Hz
  Velocidad     = 110 baudios
  Framing       = idéntico al HF (1 start + 7 data + 1 parity + 2 stop)
```

**Criterio de selección automática:** El orquestador APST detecta el tipo de altavoz en el inventario de hardware. Si el crossover declarado del subsistema es ≤ 120 Hz, selecciona automáticamente la cabecera LF. El operador puede sobreescribir la selección manualmente (`Cabecera: Auto / HF / LF`).

**Implementación en el detector Goertzel:** El motor WASM implementa dos bancos de filtros Goertzel en paralelo — uno sintonizado a 1650/1850 Hz y otro a 150/200 Hz. El orquestador indica al banco activo antes de iniciar cada segmento.

### Direct Trigger (Disparo Directo)

Modo alternativo para situaciones donde el FSK in-band no puede decodificarse aunque la cadena de señal esté funcionando. Casos de uso:

- Subsistemas que no pasan las frecuencias FSK ni con cabecera LF (ej. altavoces con crossover a 80 Hz)
- Salas con reverberación extrema que interfiere con la decodificación FSK
- Pruebas de cable (loopback) sin altavoces activos

En Direct Trigger, el identificador de segmento se pasa internamente del generador al analizador sin necesidad de FSK in-band. La medición comienza cuando el operador confirma manualmente o el orquestador envía la instrucción. La cadena de señal sigue siendo medida normalmente — solo el mecanismo de sincronización cambia.

### Segmentos de Control de Secuencia

**Terminación `.` + conteo:** Toda secuencia bien formada termina con un segmento `.` seguido de un conteo de 4 bits (0-15) que indica el número de segmentos de medición transmitidos. El analizador compara este conteo con los segmentos recibidos — si hay discrepancia, reporta segmentos perdidos.

**Source ID `+`:** Segmento opcional que transmite un mensaje de texto libre de hasta 21 caracteres (ej. nombre del venue, ID del evento) via FSK. Útil para documentación automática en reportes.

En la implementación APST, ambos segmentos se agregan automáticamente al final de toda secuencia generada.

---

## 4. Por Qué FSK es la Elección Correcta para Este Proyecto

### Lo que FSK Hace que los Tokens en Memoria No Pueden

Una alternativa considerada inicialmente fue usar `SharedArrayBuffer` como mecanismo de sincronización entre el generador y el analizador. Esta es la elección incorrecta por una razón fundamental:

`SharedArrayBuffer` sincroniza dos hilos de software. FSK sincroniza a través de la **cadena acústica real**.

La cadena de señal relevante en este sistema es:

```
AudioWorklet (generador)
       ↓
Web Audio → DAC → Interfaz de Audio → Altavoz → Sala → Micrófono
       ↓
ADC → MediaDevices API → AudioWorklet (analizador / WASM)
```

Un token en memoria bypasea completamente el hardware, los cables y el acoplamiento acústico — que son exactamente las cosas que se quieren probar. FSK que viaja por esa cadena completa mantiene la arquitectura honesta.

### El Bono Inesperado: Diagnóstico de Fallo

Un FSK no decodificado es en sí mismo un diagnóstico. Si el analizador nunca recibe el header para el segmento F, eso indica inmediatamente que la cadena de señal entre el generador y el micrófono de medición está rota, atenuada más allá de lo utilizable, o el micrófono no está ruteado correctamente. El sistema puede reportar **"Segmento F: FSK no recibido — verificar cadena de señal"** en lugar de producir silenciosamente una medición incorrecta.

Esta propiedad no existe con tokens en memoria.

---

## 5. Implementación FSK en el Navegador

El Web Audio API provee todo lo necesario para ambos lados del enlace FSK.

### Generación (equivalente al LA101)

```javascript
// FSK estándar Lindos: mark = 1650 Hz, space = 1850 Hz (110 baudios)
// Framing: 1 start + 7 data (LSB first) + 1 even parity + 2 stop = 11 bits/char
// Referencia: LA100 Manual 6th Edition, Appendix H

const MARK_HZ  = 1650;  // bit 1
const SPACE_HZ = 1850;  // bit 0
const BAUD     = 110;   // baudios

// Para cabecera LF (subsistemas de graves, crossover ≤ 120 Hz):
// const MARK_HZ  = 150;
// const SPACE_HZ = 200;

function charToFSKBits(char) {
  const code = char.charCodeAt(0) & 0x7F;  // 7 bits ASCII
  const bits = [0];  // start bit (space)
  let parity = 0;
  for (let i = 0; i < 7; i++) {
    const b = (code >> i) & 1;
    bits.push(b);
    parity ^= b;
  }
  bits.push(parity);  // even parity bit
  bits.push(1);       // stop bit 1
  bits.push(1);       // stop bit 2
  return bits;        // 11 bits totales
}

function sendFSKHeader(segmentCode, oscillator, startTime, markHz = MARK_HZ, spaceHz = SPACE_HZ) {
  const bitDuration = 1 / BAUD;  // ~9.09 ms
  let t = startTime;

  // Preámbulo: 2 bits mark (1650 Hz) para sincronización del receptor
  oscillator.frequency.setValueAtTime(markHz, t);
  t += bitDuration * 2;

  // Carácter del segmento
  const bits = charToFSKBits(segmentCode);
  bits.forEach(bit => {
    oscillator.frequency.setValueAtTime(bit === 1 ? markHz : spaceHz, t);
    t += bitDuration;
  });
  return t;  // tiempo de fin del header (~200ms desde startTime)
  // La señal de prueba del segmento comienza inmediatamente después
}
```

### Detección (equivalente al LA102) — en WASM/AudioWorklet

El algoritmo de Goertzel es el detector óptimo para FSK. A diferencia de una FFT completa, computa la energía en una sola frecuencia objetivo con costo computacional mínimo — ideal para el AudioWorklet donde cada ciclo de CPU cuenta.

```rust
// Motor WASM — Detector FSK dual-banco (HF y LF en paralelo)
// Referencia: LA100 Manual 6th Ed. Appendix H + MS20 Manual §3.7

fn goertzel(samples: &[f32], target_freq: f32, sample_rate: f32) -> f32 {
    let k = (0.5 + (samples.len() as f32 * target_freq / sample_rate)) as usize;
    let omega = 2.0 * PI * k as f32 / samples.len() as f32;
    let coeff = 2.0 * omega.cos();
    let (mut s_prev, mut s_prev2) = (0.0f32, 0.0f32);
    for &s in samples {
        let new_s = s + coeff * s_prev - s_prev2;
        s_prev2 = s_prev;
        s_prev = new_s;
    }
    s_prev2.powi(2) + s_prev.powi(2) - coeff * s_prev * s_prev2
}

// Banco HF (estándar): 1650 / 1850 Hz
fn detect_fsk_bit_hf(samples: &[f32], sample_rate: f32) -> u8 {
    let energy_mark  = goertzel(samples, 1650.0, sample_rate);  // Mark
    let energy_space = goertzel(samples, 1850.0, sample_rate);  // Space
    if energy_mark > energy_space { 1 } else { 0 }
}

// Banco LF (subwoofers/crossover ≤ 120 Hz): 150 / 200 Hz
fn detect_fsk_bit_lf(samples: &[f32], sample_rate: f32) -> u8 {
    let energy_mark  = goertzel(samples, 150.0, sample_rate);
    let energy_space = goertzel(samples, 200.0, sample_rate);
    if energy_mark > energy_space { 1 } else { 0 }
}

// Decodificador completo con verificación de paridad
fn decode_fsk_char(bits: &[u8]) -> Option<char> {
    // bits[0] = start (debe ser 0), bits[1..7] = data, bits[8] = parity, bits[9..10] = stop
    if bits.len() < 11 || bits[0] != 0 { return None; }  // start bit inválido
    let mut code = 0u8;
    let mut parity = 0u8;
    for i in 0..7 {
        code |= bits[i + 1] << i;
        parity ^= bits[i + 1];
    }
    if parity != bits[8] { return None; }  // error de paridad
    Some(code as char)
}
```

A 110 baudios, cada bit dura ~9ms — muy por encima de la resolución temporal de cualquier tamaño de buffer de audio razonable. La decodificación es confiable incluso con SNR moderado.

### La Única Consideración Real del Navegador

La latencia de audio de ida y vuelta del navegador introduce una ventana de búsqueda en lugar de un offset fijo. El analizador simplemente **observa el burst FSK, decodifica el código de segmento, y comienza la medición**. El tiempo de viaje variable del header por la cadena acústica es irrelevante porque el header **es** la referencia de tiempo — exactamente como Lindos resolvió el problema para los enlaces satelitales.

```javascript
// Ventana de búsqueda basada en latencia reportada por el AudioContext
const baseLatency = audioContext.baseLatency + audioContext.outputLatency;
const searchWindowMs = Math.max(50, baseLatency * 1000 + 30); // +30ms margen acústico
```

### Rol Correcto del SharedArrayBuffer

`SharedArrayBuffer` tiene un rol válido pero limitado: **leer resultados** del analizador WASM de vuelta al orquestador JS después de que la medición se completa. No para sincronización — eso es trabajo del FSK.

```
SharedArrayBuffer: resultados WASM → hilo JS orchestrator ✓
FSK in-band:       sincronización generador → analizador   ✓
```

---

## 6. FSK como Instrumento de Diagnóstico de la Cadena de Señal

El FSK no es solo sincronización — es un **instrumento de diagnóstico en sí mismo**. Transporta tres propiedades simultáneamente por la cadena de señal:

1. **Presencia** — ¿llegó?
2. **Integridad** — ¿llegó decodificable?
3. **Carácter** — ¿llegó tal como fue enviado?

Cada una puede fallar independientemente, y cada modo de fallo apunta a un problema físico diferente.

---

### Nivel 1 — FSK No Recibido En Absoluto

El analizador ve silencio o ruido indiferenciado donde debería llegar el header.

**Lo que indica:**

- Cadena de señal completamente rota (no llega audio al micrófono)
- Entrada incorrecta seleccionada en la interfaz de audio
- Micrófono no conectado o phantom power ausente
- Altavoz sin alimentación o silenciado en el amplificador
- Ruteo incorrecto en la consola
- Ganancia tan baja que la señal cae por debajo del piso de ruido

**Mensaje de la PWA:**

> *"FSK no recibido en segmento T. Cadena de señal abierta. Verificar: ruteo de interfaz → alimentación de amplificador → conexión de micrófono."*

---

### Nivel 2 — FSK Recibido pero No Decodificable

El filtro Goertzel detecta energía en 1200 Hz y 1800 Hz, pero la secuencia de bits no decodifica a un código de segmento válido. Este es el nivel diagnóstico más rico.

#### 2a. Nivel Demasiado Bajo

El FSK llega pero la relación de energía mark/space es demasiado cercana al ruido. El sistema está operando cerca de su piso de ruido — las mediciones serían no confiables incluso si corrieran.

**Mensaje:** *"FSK marginal en segmento T. Aumentar ganancia o verificar posicionamiento del micrófono. Medición abortada — los resultados serían inválidos."*

#### 2b. Clipping / Saturación

El FSK llega pero está distorsionado más allá del reconocimiento. Las tonos de 1200 Hz y 1800 Hz están presentes pero dispersos harmónicamente. El path está sobrecargado en algún punto.

Detectable porque el clipping produce artefactos harmónicos predecibles: un tono de 1200 Hz llevado a hard clipping genera energía en 2400 Hz, 3600 Hz, 4800 Hz.

**Mensaje:** *"FSK distorsionado en segmento T — clipping detectado en cadena de señal. Reducir nivel de salida o ganancia del preamplificador antes de continuar."*

#### 2c. Problema Severo de Respuesta en Frecuencia

Uno de los dos tonos FSK llega atenuado respecto al otro, sesgando el balance de amplitud mark/space. Por ejemplo, un rolloff severo de bajas frecuencias hace que el tono de "space" a 1200 Hz llegue mucho más débil que el de "mark" a 1800 Hz.

**Mensaje:** *"Errores de decodificación FSK sesgados hacia frecuencia space (1200 Hz). Atenuación severa de LF en cadena de señal. Verificar filtros pasa-alto en consola o amplificador."*

#### 2d. Multitrayecto / Interferencia de Fase

En una cadena acústica (altavoz → sala → micrófono), los tonos FSK pueden llegar por múltiples reflexiones creando filtrado tipo peine. Si la diferencia de longitud de camino entre el sonido directo y una reflexión fuerte crea un notch exactamente en 1200 Hz o 1800 Hz, el FSK fallará intermitentemente — incluso con nivel de señal adecuado.

Identificable porque el fallo es específico en frecuencia y repetible. El sistema conecta esto con el generador de Sweet Spots del Módulo 3.1.

**Mensaje:** *"Esta posición de medición tiene interferencia destructiva en frecuencias FSK. Mover micrófono al Sweet Spot sugerido antes de medir."*

---

### Nivel 3 — FSK Decodificado pero Código Incorrecto

La secuencia de bits decodifica exitosamente pero a un código de segmento diferente al enviado. Causa específica: **contaminación del entorno de medición**.

Si una segunda fuente de audio está presente en la sala — otro sistema PA, un retorno de monitor, sangrado de otro canal — puede inyectar una secuencia FSK diferente en el micrófono de medición simultáneamente. Las dos corrientes FSK interfieren y el decodificador obtiene un resultado diferente.

**Mensaje:** *"Mismatch FSK: enviado 'F', recibido 'N'. Fuente de audio externa contaminando cadena de medición. Silenciar todas las fuentes excepto la señal de prueba antes de continuar."*

---

### Nivel 4 — FSK Recibido con Retardo Fuera de Ventana

El header llega, decodifica correctamente, pero llega más tarde que la ventana de ida y vuelta esperada. **Diagnóstico de latencia.**


| Retardo excedente                | Diagnóstico                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Ligeramente tarde (1–5ms)        | Longitud de cable adicional, o etapa de procesamiento digital agregando buffering                         |
| Significativamente tarde (>10ms) | Dispositivo digital no declarado en la cadena — procesador de sala, sistema inalámbrico, hop de red Dante |
| Latencia variable (jitter)       | Inestabilidad de clock — mismatch de sample rate entre dispositivos                                       |


**Comportamiento del sistema:** Mide la latencia exacta y ajusta automáticamente todos los cálculos de delay subsiguientes. No requiere intervención del operador para la compensación — solo la registra y la aplica.

**Mensaje:** *"Latencia de cadena medida: 23.4ms. Excede baseline de interfaz en 14.2ms — probable etapa de procesamiento digital en la cadena. Todos los cálculos de delay ajustados automáticamente. [Ver detalles]"*

---

### Nivel 5 — FSK Decodificado Correctamente en un Canal, No en el Otro

Prueba de cadena estéreo. Canal izquierdo decodifica, canal derecho falla o decodifica con parámetros diferentes.

**Aísla inmediatamente:**

- Falla de cable o conector en canal derecho
- Canal de amplificador derecho sin alimentación o silenciado
- Ruteo de consola: salida derecha no patcheada
- Inversión de fase en canal derecho

Este es uno de los diagnósticos más prácticamente útiles porque **los fallos de cadena estéreo son el error humano más frecuente** en el montaje de eventos en vivo.

---

## 7. Biblioteca de Segmentos Recomendados


| Código | Nombre                    | Señal de Prueba                       | Parámetro Medido                                | Tolerancia por Defecto |
| ------ | ------------------------- | ------------------------------------- | ----------------------------------------------- | ---------------------- |
| **V**  | Path Audit                | Rotación FSK + piloto + silencio      | Salud de la cadena completa                     | 5 criterios binarios   |
| **A**  | Alignment Level           | Seno 1 kHz @ −18 dBFS                 | Desviación de ganancia vs. nominal              | ±1 dB                  |
| **M**  | Mic Profile Verification  | Sweeptones de tercio de octava        | Desviación vs. curva almacenada                 | ±2 dB                  |
| **N**  | Noise Floor               | Silencio                              | SPL ponderado A, curva NC                       | NC ≤ 35                |
| **F**  | Frequency Response (Fast) | Sweep logarítmico 40 Hz–20 kHz (~15s) | Desviación de magnitud vs. respuesta plana      | ±3 dB (80 Hz–16 kHz)   |
| **S**  | Frequency Response (Slow) | Sweep logarítmico 40 Hz–20 kHz (20s)  | Respuesta de alta resolución para FIR           | ±3 dB (80 Hz–16 kHz)   |
| **P**  | Phase & Coherence         | Sweep dual-canal                      | Error de fase + coherencia < 0.85               | ±15° @ 1 kHz           |
| **T**  | Time Alignment            | Impulso MLS / sweep + deconvolución   | Tiempo de llegada vs. delay calculado           | ±0.5 ms                |
| **D**  | Distortion THD+N          | Seno 1 kHz @ 0 dBFS y −6 dBFS         | Relación THD+N                                  | ≤ 1%                   |
| **X**  | Crosstalk                 | Seno 1 kHz canal L only / R only      | Sangrado entre canales                          | ≤ −60 dB               |
| **R**  | Feedback Margin           | Ruido rosa + rampa de ganancia        | dB de headroom antes del primer anillo          | ≥ 6 dB                 |
| **H**  | Headroom / Linearity      | Seno 1 kHz en rampa 0 dBFS → clip     | Punto de compresión, disto emergente            | THD < 1% a 0 dBFS      |
| **I**  | IR Capture & Export       | (Post-procesamiento de T)             | Respuesta al impulso + filtro FIR de corrección | —                      |


---

## 8. Especificación Detallada de Cada Código

---

### V — Verificación de Cadena de Señal (Path Audit)

**Qué es:** El segmento de gateway obligatorio. El único que debe pasar antes de que cualquier otro segmento se ejecute. No mide ningún parámetro de calidad de audio — mide el **sistema de medición en sí mismo**.

**La señal — tres partes estructuradas:**

1. **Secuencia FSK** — rotación de 5 códigos consecutivos, dando al analizador múltiples intentos de decodificación para evaluar confiabilidad
2. **Tono piloto** @ −18 dBFS por 2 segundos — referencia de nivel y distorsión
3. **Ventana de silencio** por 3 segundos — captura del piso de ruido en el mismo pase

**Qué mide:**

**Confiabilidad de decodificación FSK:**  
El sistema transmite 5 códigos FSK en sucesión y cuenta cuántos decodifican correctamente.

- 5/5 = cadena limpia
- 3/5 = marginal, mediciones deben tratarse con precaución
- 0/5 = cadena rota, no proceder

**Latencia de ida y vuelta:**  
Tiempo entre la transmisión FSK y su detección en el analizador, medido con precisión de ±0.1 ms. Comparado contra el valor esperado calculado desde la latencia reportada de la interfaz. Cualquier exceso indica una etapa de procesamiento digital no declarada.

**Precisión de nivel:**  
El nivel recibido del tono piloto vs. el nivel transmitido — misma medición que el segmento A pero como parte de la auditoría, no como calibración fina.

**Preview del piso de ruido:**  
La ventana de silencio da una lectura rápida del ruido — suficiente para detectar problemas severos que invalidarían mediciones subsiguientes.

**Check de distorsión:**  
Durante la ventana del tono piloto, el analizador ejecuta una estimación rápida de THD. Si la cadena está severamente sobrecargada, aparece inmediatamente.

**La lógica de gate:**

```
FSK confiabilidad ≥ 4/5              → PASS
Latencia ida/vuelta dentro
  de ventana esperada ±5ms           → PASS (con valor de latencia registrado)
Nivel dentro de ±3 dB del esperado   → PASS
Piso de ruido < NC-50                → PASS
THD < 5%                             → PASS

Los cinco PASS  → Proceder a la secuencia
Cualquier FAIL  → Bloquear secuencia, mostrar fallo específico
```

La tolerancia de ±3 dB para nivel en V es deliberadamente más amplia que el ±1 dB de A — V no está calibrando, está confirmando que la cadena existe y funciona. La calibración fina es trabajo de A.

**Mensajes de fallo específicos:**


| Sub-test V               | Mensaje de fallo                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| FSK 0/5                  | "Sin señal recibida. Verificar: ruteo de interfaz, alimentación de amplificador, conexiones de cable."                  |
| FSK 2/5                  | "Cadena de señal marginal. Nivel demasiado bajo o interferencia presente. Verificar estructura de ganancia."            |
| Exceso de latencia >10ms | "Latencia no declarada: Xms. Posible etapa de procesamiento digital en cadena. Todos los cálculos de timing ajustados." |
| Nivel >3 dB bajo         | "Ganancia de cadena baja. Aumentar nivel de salida o verificar atenuación en cadena."                                   |
| Nivel >3 dB alto         | "Ganancia de cadena alta. Riesgo de clipping. Reducir nivel de salida antes de proceder."                               |
| Piso de ruido falla      | "Ruido ambiente excesivo (NC-XX). Las mediciones tendrán confiabilidad reducida en bajas frecuencias."                  |
| THD falla                | "Distorsión severa en cadena. Sistema sobrecargado. Reducir ganancia antes de cualquier medición."                      |


#### Pipeline de Procesamiento DSP

```
Contexto: AudioWorklet (tiempo real) — no puede bloquearse

1. DECODIFICACIÓN FSK (×5 repeticiones)
   - Buffer de entrada: ventanas de 9 ms (1 bit @ 110 baud, fs=48 kHz → 432 muestras/bit)
   - Por cada ventana de bit: Goertzel dual-banco (1650 Hz y 1850 Hz)
   - Decisión: bit = 1 si E_mark > E_space, else 0
   - Acumular 11 bits → decode_fsk_char() con verificación de paridad par
   - Contar decodificaciones correctas sobre 5 intentos → score FSK (0–5)
   - Medir timestamp de llegada del último stop bit → latencia_medida_ms
   - latencia_exceso_ms = latencia_medida_ms − (baseLatency + outputLatency) × 1000

2. NIVEL DEL TONO PILOTO (ventana 2s @ 1 kHz)
   - Ventana Hann sobre cada bloque de 4096 muestras
   - RMS: nivel_rms_dbfs = 20·log10(√(Σx²/N))
   - Comparar contra nivel_transmitido_dbfs → desviación_db

3. ESTIMACIÓN RÁPIDA THD (durante tono piloto)
   - FFT de 4096 puntos sobre ventana Hann
   - Fundamental: bin más cercano a 1000 Hz → E1
   - Armónicos: bins en 2k, 3k, 4k, 5k Hz → E2..E5
   - THD_pct = 100 × √(E2²+E3²+E4²+E5²) / E1

4. PISO DE RUIDO (ventana silencio 3s)
   - FFT de 8192 puntos, 4 promedios con overlap 50%
   - Aplicar ponderación A en dominio frecuencia
   - RMS total ponderado → nivel_dBA
   - Conversión rápida a rating NC: comparar contra curvas NC-25..NC-60 en 8 bandas de octava

Outputs al Orchestrator (vía SharedArrayBuffer):
  { fsk_score: 0-5, latency_ms, latency_excess_ms, level_deviation_db, thd_pct, noise_nc, noise_dba }
```

**Timing:** ~8 segundos

---

### A — Nivel de Alineamiento

**Qué es:** El punto de referencia para toda la sesión. Cada otra medición es relativa a este.

**La señal:** Seno único a 1 kHz transmitido a un nivel precisamente conocido — convencionalmente −18 dBFS en el dominio digital, que corresponde al nivel de alineamiento EBU de 0 dBu en equipamiento profesional.

**Por qué 1 kHz:** Se ubica en la parte más plana de la curva de respuesta de virtualmente todo micrófono y altavoz, alejado del extremo grave (donde los modos de sala interfieren) y del extremo agudo (donde la directividad y la absorción del aire distorsionan la lectura). Es la única frecuencia donde el nivel medido más probablemente representa la ganancia eléctrica real de la cadena en lugar de un artefacto acústico.

**Qué mide:**

- Nivel recibido en el micrófono de medición vs. nivel transmitido
- Desviación de ganancia de toda la cadena de señal en dB
- Si la estructura de ganancia es simétrica entre canales izquierdo y derecho

**Rol sistémico:** Segmento A establece la **referencia de normalización** para todos los segmentos subsiguientes. Las mediciones FFT en F, P y D se expresan como desviaciones del nivel establecido aquí. Si A es incorrecto, cada lectura subsiguiente es incorrecta en la misma dirección.

**Tabla diagnóstica:**


| Resultado                     | Diagnóstico                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Nivel recibido coincide ±1 dB | Estructura de ganancia correcta. Proceder.                                                    |
| Nivel ≥ −6 dB bajo objetivo   | Sistema demasiado silencioso — margen de feedback se desperdicia, rango dinámico comprometido |
| Variación >3 dB entre L y R   | Ganancia asimétrica — un canal de amplificador, cable, o salida de consola difiere            |
| Nivel sobre objetivo          | Sistema corriendo caliente — headroom reducido, riesgo de clipping elevado                    |


#### Pipeline de Procesamiento DSP

```
Contexto: AudioWorklet (tiempo real)

1. DESCARTE de los primeros 500 ms post-header FSK
   (permite que el generador y la sala se estabilicen)

2. RMS de NIVEL en 4 bloques consecutivos de 1024 muestras
   - Ventana rectangular (el tono es estacionario, no hay fuga espectral relevante)
   - nivel_rms[i] = 20·log10(√(Σx²/N))
   - Promedio de los 4 bloques → nivel_medio_dbfs
   - Varianza entre bloques: si > 0.5 dB → posible inestabilidad de nivel (reportar)

3. DESVIACIÓN vs. REFERENCIA
   - ganancia_cadena_db = nivel_medio_dbfs − nivel_tx_dbfs
   - nivel_tx_dbfs: constante definida en la configuración del generador (ej. −18.0 dBFS)

4. VERIFICACIÓN ESTÉREO (si aplica)
   - Misma operación en canal L y canal R independientemente
   - asimetría_db = |ganancia_L − ganancia_R|

5. ALMACENAMIENTO del nivel de referencia
   - nivel_referencia_dbfs = nivel_medio_dbfs
   - Escrito en SharedArrayBuffer → accesible por todos los segmentos posteriores
   - Todos los resultados de F, P, D, X se normalizan contra este valor

Outputs: { gain_db, asymmetry_db, reference_level_dbfs }
```

**Timing:** ~7 segundos

---

### M — Verificación de Perfil de Micrófono

**Qué es:** El segmento que separa lo que la sala y el altavoz hacen de lo que el micrófono de medición hace. Sin esto, cada medición de respuesta en frecuencia es una lectura combinada de sistema + micrófono, y no se puede saber cuál corregir.

**La señal:** Una secuencia de tonos de referencia conocidos — serie de tonos discretos a intervalos de tercio de octava (31 bandas) o un sweep — a un nivel precisamente controlado, generados hacia una referencia acústica conocida. Puede ser:

- Un altavoz de referencia calibrado a distancia fija de campo cercano
- Un pistófono / calibrador acoplado directamente a la cápsula del micrófono

**Cómo funciona:**

Todo micrófono tiene su propia respuesta en frecuencia. Un micrófono de medición nominalmente "plano" puede desviarse ±1–2 dB. Un SM58 usado como micrófono de medición (compromiso de campo común) puede desviarse ±6–8 dB con un pico de presencia pronunciado alrededor de 5–10 kHz y rolloff bajo 100 Hz.

El perfil almacenado en el inventario de hardware del Módulo 3.2 es la curva de respuesta especificada por el fabricante para ese modelo. Segmento M verifica que el micrófono físico en uso hoy coincide con ese perfil almacenado, confirmando:

1. El perfil de micrófono correcto está asignado
2. El micrófono físico funciona correctamente (sin cápsula dañada ni humedad afectando respuesta)
3. Los datos del perfil son precisos

**Acciones ante mismatch:**


| Desviación        | Acción del sistema                                                                |
| ----------------- | --------------------------------------------------------------------------------- |
| Menor (2–4 dB)    | Actualizar automáticamente el perfil con valores medidos                          |
| Moderada (4–8 dB) | Advertencia — pedir al operador confirmar asignación del modelo antes de proceder |
| Severa (>8 dB)    | Detener. El micrófono es el modelo incorrecto o está físicamente dañado           |


**Escenario de campo crítico:** El micrófono de medición designado fue olvidado en el estudio y el operador usa un SM58 de repuesto. Sin M, el sistema aplica la compensación incorrecta a cada medición de respuesta en frecuencia, produciendo correcciones de EQ que empeoran el sistema en lugar de mejorarlo.

#### Pipeline de Procesamiento DSP

```
Contexto: Web Worker (procesamiento offline post-grabación)

1. GRABACIÓN de la señal recibida durante los sweeptones (fs=48 kHz, Float32)

2. SEGMENTACIÓN por tono de referencia
   - Para cada banda de tercio de octava (31 bandas, 20 Hz–20 kHz):
     a. Ventana sincronizada con el header FSK del tono correspondiente
     b. Descarte de primeros 200 ms (transitorio)
     c. Bloque de medición: 1024 muestras

3. NIVEL POR BANDA
   - Goertzel en la frecuencia central de cada banda de tercio de octava
   - nivel_banda[i]_dbfs = 20·log10(√E_goertzel[i])
   - Normalizar contra nivel_referencia_dbfs del segmento A
   - curva_medida[i]_db = nivel_banda[i] − referencia

4. COMPARACIÓN CON PERFIL ALMACENADO
   - perfil_clm[i]: curva del fabricante del micrófono desde IndexedDB (31 valores en dB)
   - desviación[i]_db = curva_medida[i] − perfil_clm[i]
   - RMS de desviaciones → desviación_global_db

5. DECISIÓN
   - desviación_global ≤ 2 dB → PASS, actualizar perfil automáticamente
   - 2–8 dB → WARNING, solicitar confirmación del operador
   - > 8 dB → FAIL, bloquear mediciones hasta resolución

6. CURVA DE COMPENSACIÓN
   - curva_compensación[i]_db = −perfil_clm[i]
   - Almacenada en SharedArrayBuffer para ser aplicada en tiempo real por segmentos F, P

Outputs: { deviation_rms_db, per_band_deviation[31], mic_compensation_curve[31], pass/warn/fail }
```

**Timing:** ~20 segundos

---

### N — Piso de Ruido

**Qué es:** Una medición de todo lo que el sistema produce cuando debería producir nada. La línea base de silencio del venue y la cadena de señal combinados.

**La señal:** Silencio. El generador transmite el header FSK para armar el analizador, luego se silencia. La ventana de medición se abre y captura lo que el micrófono escucha sin señal intencional presente.

**Qué mide:**

**Nivel de ruido broadband** — expresado como lectura SPL ponderada A en dBA, o como rating de Curva NC (Noise Criterion). La ponderación A filtra la medición para coincidir con la sensibilidad del oído humano. Las curvas NC van más lejos especificando el nivel de ruido a través de bandas de octava.

El piso de ruido es el **piso de todo el rango dinámico del sistema**. Todo lo que el sistema hace — inteligibilidad de habla, margen de feedback, correcciones de EQ — está delimitado por debajo por este número.

**Fuentes que la medición captura:**

- **HVAC:** El contribuidor dominante en la mayoría de espacios de conferencia. Produce ruido broadband de baja frecuencia con forma espectral característica — alta energía bajo 250 Hz con rolloff arriba.
- **Ruido eléctrico:** Hum a 50 o 60 Hz (frecuencia de red) y sus harmónicos desde bucles de tierra, acoplamiento de transformadores, o blindaje inadecuado.
- **Ruido propio del amplificador:** El hiss del piso de amplificación, típicamente broadband de carácter blanco o rosa.
- **Ruido de sala y ambiente:** Ruido del venue mismo antes del evento.
- **Artefactos digitales:** Aliasing, ruido de clock, o artefactos de cuantización de etapas de procesamiento digital. Aparecen como tonos o ruido de banda estrecha en frecuencias relacionadas con el sample rate.

**Ratings NC recomendados para voz hablada:**


| Tipo de espacio                        | Rating NC Recomendado |
| -------------------------------------- | --------------------- |
| Sala de conferencias, boardroom        | NC 25–35              |
| Auditorio grande, sala de conferencias | NC 30–40              |
| Venue de evento en vivo                | NC 35–45              |
| Venue al aire libre o industrial       | NC 45+                |


**Forma espectral como diagnóstico:**


| Forma del ruido                            | Diagnóstico                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| Componente fuerte 50/60 Hz                 | Bucle de tierra — blindaje de cable conectado en ambos extremos              |
| Hiss broadband creciente hacia HF          | Ruido propio de preamplificador o consola — ganancia muy alta en algún punto |
| Tonos discretos en frecuencias inesperadas | Interferencia RF acoplada en entrada desbalanceada, o ruido de clock digital |
| Rumble de baja frecuencia                  | HVAC dominante, o vibración física acoplada en micrófono en pedestal         |


**Rol sistémico:** El resultado de N establece directamente el **umbral mínimo de coherencia** para el segmento P. Si el piso de ruido es alto, la coherencia naturalmente será menor en niveles de señal bajos. El sistema debe ajustar automáticamente los umbrales de advertencia de coherencia basado en el resultado de N.

#### Pipeline de Procesamiento DSP

```
Contexto: Web Worker (grabación continua + análisis offline)

1. GRABACIÓN de ventana de silencio (15 s, fs=48 kHz)
   Descarte de primeros 200 ms post-header (estabilización ADC)

2. ESPECTRO DE POTENCIA
   - FFT de N=65536 puntos (resolución: 48000/65536 ≈ 0.73 Hz/bin)
   - Ventana Hann, overlap 50%, 8 promedios espectrales
   - PSD[f] = (2/N²) · |X[f]|²  [en unidades de FS²/Hz]

3. NIVEL BROADBAND PONDERADO A
   - Curva de ponderación A: W_A(f) definida según IEC 61672-1
   - W_A(f) = (12194² · f⁴) / ((f²+20.6²) · √((f²+107.7²)(f²+737.9²)) · (f²+12194²))
   - PSD_A[f] = PSD[f] · W_A(f)²
   - nivel_dBA = 10·log10(Σ PSD_A[f] · Δf) + 94  [ref. SPL absoluta si mic calibrado]
   - Si mic sin calibración: nivel_dBFS relativo + estimación desde ganancia declarada

4. CURVAS NC (Noise Criterion)
   - Calcular potencia en 8 bandas de octava: 63, 125, 250, 500, 1k, 2k, 4k, 8k Hz
   - banda[i]_db = 10·log10(Σ PSD[f] · Δf) para f ∈ [f_low_i, f_high_i]
   - Comparar cada banda contra las curvas NC-15 a NC-70 (tabla ASHRAE)
   - NC_rating = máximo NC que ninguna banda excede

5. DIAGNÓSTICO ESPECTRAL
   - Detectar picos estrechos: bin > media_banda + 10 dB → posible tono de red o RF
   - Energía relativa en 50/60 Hz: si > −40 dBFS → posible hum eléctrico
   - Gradiente espectral: si energía cae > 6 dB/octava desde LF → perfil HVAC

6. UMBRAL DE COHERENCIA ADAPTATIVO
   - SNR_estimado[f] = PSD_señal_esperada[f] / PSD_ruido[f]
   - coherencia_umbral[f] = 0.95 − 0.3 · exp(−SNR_estimado[f] / 10)
   - Almacenado en SharedArrayBuffer para segmento P

Outputs: { noise_dba, nc_rating, nc_per_band[8], spectral_peaks[], coherence_threshold[f] }
```

**Timing:** ~15 segundos

---

### F — Respuesta en Frecuencia

**Qué es:** La medición más visualmente intuitiva y la que los operadores interactúan más directamente — la curva que muestra cuán fuerte es el sistema en cada frecuencia relativa al nivel de referencia establecido por el segmento A.

**La señal (dos variantes):**

- **Segmento F (Fast):** Sweep sinusoidal logarítmico 40 Hz–20 kHz en ~15 segundos. Velocidad estándar, resolución media. Uso principal para calibración pre-evento.
- **Segmento S (Slow):** Sweep sinusoidal logarítmico 40 Hz–20 kHz en 20 segundos. Resolución máxima, recomendado antes de computar filtros FIR de alta precisión (segmento I). Equivalente al segmento `S` del LA100.

Ambus sweeps son logarítmicos porque la audición humana es logarítmica — pasan proporcionalmente más tiempo en bajas frecuencias donde la resolución importa más para la acústica de sala.

**Cómo funciona:**

El motor WASM compara el nivel instantáneo del sweep recibido contra una referencia — el nivel que *debería* llegar en esa frecuencia si el sistema fuera perfectamente plano. La diferencia en cada frecuencia, en dB, es la desviación de respuesta en frecuencia.

**La captura cruda convuelve tres factores:**

1. Respuesta propia del altavoz
2. Contribución acústica de la sala
3. Coloración propia del micrófono

Con el perfil de micrófono aplicado desde el inventario de hardware (verificado por segmento M), lo que queda es la respuesta combinada de sala y altavoz — que es lo que se quiere ecualizar.

**Curva objetivo: Respuesta Plana (Programa Mixto)**

El tipo de eventos del sistema incluye **voz hablada en vivo, música pregrabada y reproducción de video**. La curva objetivo es por tanto una **respuesta plana extendida**, no una curva optimizada para un único tipo de contenido:


| Rango                   | Objetivo      | Tolerancia            | Razón                                      |
| ----------------------- | ------------- | --------------------- | ------------------------------------------ |
| Sub-graves (20–80 Hz)   | Plano         | −6 a −12 dB aceptable | Modos de sala dominan; EQ raramente mejora |
| Graves (80–200 Hz)      | 0 dB          | ±3 dB                 | Cuerpo del sistema                         |
| Medio-bajo (200–800 Hz) | 0 dB          | ±3 dB                 | Cuerpo de la voz                           |
| Medio (800 Hz–4 kHz)    | 0 dB          | ±3 dB                 | Presencia y claridad de consonantes        |
| Agudo (4–16 kHz)        | 0 dB          | ±3 dB                 | Aire y brillo                              |
| Muy agudo (>16 kHz)     | Sin requisito | Rolloff aceptable     | Límites de audición y absorción del aire   |


El sistema **no aplica ningún roll-off predeterminado**. Si la sala o el hardware requieren un HPF en graves (ej. 60–80 Hz), el operador lo aplica manualmente. Los roll-offs opcionales por zona están disponibles con el Motor de Simulación Nivel 2.

**Relajación de tolerancia adaptativa:** En Modo Agnóstico (sin datos CLF del hardware), la tolerancia se relaja automáticamente a ±6 dB para evitar over-EQ basado en mediciones inciertas.

**Tabla diagnóstica:**


| Resultado                                    | Diagnóstico                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Curva dentro ±3 dB del objetivo 125 Hz–8 kHz | Sistema bien comportado, EQ mínimo necesario                                          |
| Pico amplio en 250–400 Hz                    | Modo de sala o resonancia de port de altavoz — corte paramétrico                      |
| Pico estrecho en cualquier frecuencia        | Onda estacionaria de sala o resonancia de gabinete — filtro notch                     |
| Caída amplia en 2–4 kHz                      | Región de presencia comprometida — voz sonará distante y poco clara                   |
| Rolloff severo sobre 4 kHz                   | Micrófono demasiado lejos, altavoz mal orientado, o falla del driver HF               |
| Respuesta varía dramáticamente entre L y R   | Sala asimétrica, altavoces posicionados asimétricamente, o EQ diferente entre canales |


**Conexión con el Módulo 3.2:** La curva de desviación entre medición y objetivo es exactamente el filtro que el sistema necesita aplicar. Módulo 3.2 traduce ese filtro ideal a lo que el hardware físico puede implementar.

#### Pipeline de Procesamiento DSP

```
Contexto: Web Worker (grabación + análisis offline asíncrono)

1. GRABACIÓN Y EXTRACCIÓN
   - Grabación síncrona de 15s (F) o 20s (S) de sweep logarítmico (fs=48 kHz)
   - Señal de excitación (referencia) generada sintéticamente en memoria idéntica a la enviada

2. RESPUESTA AL IMPULSO (RIR) VÍA DECONVOLUCIÓN
   - X(f) = FFT(señal_excitación)
   - Y(f) = FFT(señal_recibida)
   - H(f) = Y(f) / X(f)  (división compleja)
   - h(t) = IFFT(H(f)) → Respuesta al Impulso de la Sala (RIR)

3. VENTANEO Y SUAVIZADO
   - Encontrar el pico de h(t) → t_directo
   - Aplicar ventana asimétrica (Tukey/Hann) alrededor de t_directo (ej. -10ms a +100ms)
   - Recalcular H_windowed(f) = FFT(h_windowed(t))
   - Aplicar suavizado fraccional de octava (ej. 1/6 o 1/12 octava) sobre |H_windowed(f)|

4. NORMALIZACIÓN Y COMPENSACIÓN
   - Magnitud en dB: mag_db[f] = 20·log10(|H_windowed(f)|)
   - Aplicar compensación de micrófono: mag_db_comp[f] = mag_db[f] + curva_compensación[f]
   - Normalizar contra referencia de segmento A: respuesta_final_db[f] = mag_db_comp[f] - referencia_dbfs

5. EVALUACIÓN DE TOLERANCIAS
   - Comparar respuesta_final_db[f] contra curva objetivo (Respuesta Plana extendida)
   - Calcular desviación máxima y % dentro de tolerancia (±3 dB)

Outputs: { magnitude_response[f], peak_deviation_hz, max_deviation_db, within_tolerance_pct }
```

**Timing:** ~30 segundos por posición de medición

---

### P — Fase y Coherencia

**Qué es:** El segmento técnicamente más revelador de la suite y el más frecuentemente omitido en la práctica porque requiere entender dos mediciones simultáneas.

**La señal:** El mismo sweep logarítmico que F, pero esta vez el analizador captura tanto la magnitud *como* el ángulo de fase en cada frecuencia, y computa la **coherencia** entre la salida del generador y la entrada del micrófono.

**Qué mide la fase:**

La fase es la relación temporal entre la señal del generador y la señal recibida, expresada en grados en cada frecuencia. En un sistema perfecto con delay de grupo plano, la respuesta de fase rotaría suave y predeciblemente con la frecuencia. Desviaciones de esa rotación suave indican:

- **Filtros all-pass** (redes de corrección de fase en procesadores)
- **Anomalías de fase de crossover** (donde woofer y tweeter de un altavoz de dos vías suman destructivamente)
- **Múltiples caminos de llegada** (sonido directo más una reflexión temprana fuerte llegando ligeramente después)
- **Inversiones de polaridad** (offset de fase de 180° a todas las frecuencias — cable balanceado mal cableado o conexión de altavoz invertida)

**Qué mide la coherencia:**

La coherencia (γ²) es un número entre 0 y 1 que responde a la pregunta: *"¿Cuánto de lo que el micrófono escuchó fue causado por lo que el generador envió?"*

$$\gamma^2(f) = \frac{|G_{xy}(f)|^2}{G_{xx}(f) \cdot G_{yy}(f)}$$

Donde $G_{xy}$ es el espectro cruzado, $G_{xx}$ es el autoespectro de la entrada, y $G_{yy}$ el autoespectro de la salida.

- **γ² = 1.0:** Causalidad perfecta — todo en esa frecuencia llegó del generador
- **γ² = 0.5:** La mitad de la energía en esa frecuencia vino de otro lugar

La coherencia cae en frecuencias donde:

- El piso de ruido es relativamente alto (SNR bajo)
- Ocurre interferencia destructiva (cancelación acústica)
- Está presente distorsión no-lineal

**El insight crítico:** La **baja coherencia invalida la medición de respuesta en frecuencia** en esa frecuencia. Si la coherencia en 315 Hz es 0.4, la lectura de magnitud en 315 Hz del segmento F no es confiable.

La coherencia se convierte en el **mapa de confianza** para todas las mediciones — diciéndole al sistema dónde puede confiar en los datos y dónde debe descartar resultados.

**Tabla diagnóstica:**


| Resultado                                                     | Diagnóstico                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Fase rota suavemente, coherencia >0.9 en 100 Hz–8 kHz         | Cadena limpia, mediciones confiables                                                      |
| Offset de fase de 180° a todas las frecuencias                | Inversión de polaridad en algún punto de la cadena                                        |
| Anomalía de fase en frecuencia específica con baja coherencia | Nodo de cancelación acústica — posición de medición incorrecta                            |
| Coherencia cae sobre 4 kHz                                    | Micrófono demasiado lejos para coherencia HF, o absorción de aire significativa           |
| Pendiente de fase más pronunciada que lo esperado             | Dispositivo de latencia adicional en la cadena (procesador digital, receptor inalámbrico) |


#### Pipeline de Procesamiento DSP

```
Contexto: Web Worker (análisis concurrente o post-grabación)

1. PREPARACIÓN DE DATOS (Overlap-Add)
   - Señal x[n] (referencia enviada), señal y[n] (micrófono recibido)
   - Dividir en M bloques de N=16384 muestras, con 50% o 75% de overlap
   - Aplicar ventana Hann a cada bloque

2. CÁLCULO DE AUTO Y CROSS-ESPECTROS (Por cada bloque m)
   - X_m(f) = FFT(x_m[n]), Y_m(f) = FFT(y_m[n])
   - Sxx_m(f) = X_m(f) * conj(X_m(f))  (Auto-espectro Entrada)
   - Syy_m(f) = Y_m(f) * conj(Y_m(f))  (Auto-espectro Salida)
   - Sxy_m(f) = Y_m(f) * conj(X_m(f))  (Cross-espectro)

3. PROMEDIADO ENERGÉTICO (Promedio de M bloques)
   - Sxx(f) = (1/M) * Σ Sxx_m(f)
   - Syy(f) = (1/M) * Σ Syy_m(f)
   - Sxy(f) = (1/M) * Σ Sxy_m(f)   (Nota: promedio de números complejos)

4. CÁLCULO DE COHERENCIA Y FASE
   - Función de Transferencia H(f) = Sxy(f) / Sxx(f)
   - Fase: fase_deg[f] = atan2(Im(H(f)), Re(H(f))) * (180/PI)
   - Coherencia: γ²(f) = |Sxy(f)|² / (Sxx(f) * Syy(f))

5. POST-PROCESAMIENTO
   - Desenvolver fase (Unwrap phase)
   - Restar delay de propagación puro de la fase (delay estimado en segmento T)
   - Evaluar γ²(f) contra el umbral_coherencia calculado en segmento N

Outputs: { phase_response_deg[f], coherence[f], data_quality_warnings[] }
```

**Timing:** 45–60 segundos (modo completo, 6 promedios) / 20–25 segundos (modo rápido, 2 promedios)

---

### T — Alineamiento Temporal (Delay Finder)

**Qué es:** El segmento que responde *"¿cuándo llega el sonido?"* — no solo como un número sino como una medición de precisión del tiempo de llegada de la respuesta al impulso para cada altavoz del sistema.

**La señal:** Un burst de Secuencia de Longitud Máxima (MLS) o un sweep logarítmico seguido de deconvolución. Ambas técnicas permiten al sistema extraer la **respuesta al impulso** de la cadena acústica — una imagen de cada llegada: sonido directo, reflexiones tempranas, y reverberación tardía.

**Cómo funciona:**

El generador envía una señal conocida. El motor WASM correlaciona cruzadamente la señal recibida con la referencia conocida para producir la respuesta al impulso. El primer pico significativo es el tiempo de llegada del sonido directo. El delta entre el tiempo de salida del generador y ese primer pico es el delay de propagación de la cadena — en milisegundos.

A 20°C el sonido viaja a 343 m/s, entonces 1 ms de delay corresponde a aproximadamente 34.3 cm de distancia. El sistema puede inferir la distancia acústica del altavoz al micrófono **sin cinta métrica**.

**Qué mide:**

- Delay de propagación absoluto de cada altavoz a la posición de medición
- Delay relativo entre altavoces (crítico para confirmar que los ajustes de delay line del Módulo 3.1 son correctos)
- Estructura de reflexiones tempranas — reflexiones fuertes llegando dentro de 30ms del sonido directo aparecen como picos secundarios
- Validación de compensación de temperatura — el delay medido puede compararse contra el delay calculado de la temperatura de sala ingresada en el Módulo 3.1

**Conexión sistémica:** Segmento T es el único segmento que directamente **valida la salida del Módulo 3.1**. Si T falla o produce una sorpresa, toda la geometría del stage plot es sospechosa y debe reingresarse antes de continuar.

**Tabla diagnóstica:**


| Resultado                                       | Diagnóstico                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Delay medido coincide con calculado ±0.5ms      | Ajustes de delay correctos                                                                 |
| Delay medido menor que el esperado              | Altavoz físicamente más cerca de lo que el stage plot muestra                              |
| Delay medido mayor que el esperado              | Etapa digital agrega latencia, o altavoz más lejos, o temperatura mayor a la ingresada     |
| Pico secundario fuerte a 10–15ms                | Reflexión temprana de pared paralela o techo — el más dañino para inteligibilidad de habla |
| Múltiples picos secundarios de amplitud similar | Espacio reverberante — la sala trabaja contra la claridad del habla                        |


#### Pipeline de Procesamiento DSP

```
Contexto: Web Worker (cálculo rápido post-grabación)

1. DECONVOLUCIÓN PARA OBTENER RIR (Impulse Response)
   - Si se usa MLS: Correlación circular rápida usando Transformada de Hadamard-Sylvester
   - Si se usa Sweep: h(t) = IFFT( FFT(y) / FFT(x) )
   - Filtrar pasa-banda (ej. 80 Hz - 16 kHz) para reducir ruido fuera de banda
   - Computar Envolvente de Energía temporal (ETC - Energy Time Curve): ETC(t) = |h(t)|²

2. DETECCIÓN DEL TIEMPO DE LLEGADA
   - Buscar el pico máximo global de la ETC → t_max
   - Buscar el "onset" (inicio de la energía): recorrer hacia atrás desde t_max hasta que la energía caiga X dB (ej. -20 dB) respecto al pico → t_onset
   - t_arrival = t_onset (más preciso que t_max, que depende de fase)

3. CÁLCULO DE DELAY Y LATENCIA
   - Latencia de ida y vuelta: t_round_trip = t_arrival - t_tx_start
   - Restar latencia de hardware (medida en segmento V): delay_acústico_ms = t_round_trip - latencia_medida_ms
   - Validar rango físico: si delay_acústico_ms < 0 o > max_expected → Error

4. ANÁLISIS DE REFLEXIONES (ETC)
   - Buscar picos locales en ETC después de t_max
   - Si pico local > (t_max - 10 dB) dentro de [t_max+2ms, t_max+30ms] → Reflexión Temprana Dañina detectada

Outputs: { delay_acoustic_ms, early_reflections[{time_ms, relative_level_db}], impulse_response_raw }
```

**Timing:** ~5 segundos (PA estéreo simple) / ~18–22 segundos (sistema completo con 4 altavoces de delay)

---

### D — Distorsión THD+N

**Qué es:** La medición de todo lo que la cadena de señal agregó que no estaba en la señal original.

**La señal:** Un seno único a 1 kHz al nivel operacional del sistema, mantenido durante suficiente tiempo para que el analizador se estabilice (típicamente 3–5 segundos). Debe correrse en **dos niveles**: −18 dBFS y −6 dBFS para una imagen completa de la linealidad del sistema.

**Cómo funciona THD+N:**

El analizador aplica un filtro notch muy estrecho exactamente a 1 kHz a la señal recibida, removiendo el fundamental. Todo lo que queda — harmónicos (2 kHz, 3 kHz, 4 kHz...) más ruido broadband — es el residuo de "distorsión + ruido". THD+N se expresa como la relación de ese residuo al nivel fundamental original:

$$\text{THD+N} = \frac{\sqrt{V_2^2 + V_3^2 + V_4^2 + ... + V_N^2}}{V_1} \times 100$$

**Qué dice la estructura harmónica:**


| Harmónico dominante                         | Causa probable                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 2° harmónico (octava)                       | Soft clipping — transformador saturado o etapa analógica corriendo levemente caliente. Suena "cálido".     |
| 3° harmónico (octava + quinta)              | Hard clipping — limitador digital en techo, amplificador sobre límite térmico, driver excediendo excursión |
| Harmónicos impares crecientes (5°, 7°, 9°)  | Distorsión de crossover en amplificador Clase B, o suspensión no-lineal del driver                         |
| Piso de ruido broadband creciente con señal | Piso de ruido dependiente de señal — bucle de tierra o fuente de alimentación mal diseñada                 |


**Relevancia para voz hablada:** La distorsión es especialmente destructiva para la inteligibilidad del habla. La región de presencia de 1–4 kHz, que porta las consonantes que hacen comprensible el habla, es extremadamente sensible a la distorsión harmónica. Incluso 3% THD en esta región reduce notablemente la inteligibilidad para asistentes con pérdida auditiva.

**Tabla diagnóstica:**


| Resultado                                    | Diagnóstico                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| THD+N < 0.5% al nivel operacional            | Limpio. Proceder.                                                                  |
| THD+N 0.5–2%, 2° harmónico dominante         | Etapa analógica ligeramente sobrecargada — reducir ganancia 3–6 dB                 |
| THD+N > 2%, 3° harmónico dominante           | Hard clipping — encontrar etapa sobrecargada y reducir ganancia significativamente |
| THD+N crece abruptamente en HF               | Driver distorsionando — cerca del límite de excursión o límite térmico de bobina   |
| Distorsión presente incluso en niveles bajos | Bucle de tierra, interferencia RF, o componente defectuoso en la cadena            |


#### Pipeline de Procesamiento DSP

```
Contexto: Web Worker (análisis concurrente o post-grabación)

1. FILTRADO NOTCH DIGITAL
   - Generar filtro IIR Notch de 2º orden centrado exactamente en la frecuencia fundamental detectada (f0 ≈ 1 kHz)
   - Q elevado (ej. Q=10) para remover la fundamental sin atenuar excesivamente el 2º armónico
   - x_notch[n] = filter(x[n])

2. SEPARACIÓN DE ENERGÍAS
   - Calcular energía total de la señal original: E_total = Σ(x[n]²)
   - Calcular energía del residuo (ruido + armónicos): E_residuo = Σ(x_notch[n]²)
   - Energía de la fundamental: E_fund = E_total - E_residuo

3. CÁLCULO THD+N BROAD-BAND
   - THD_N_ratio = √(E_residuo / E_fund)
   - THD_N_pct = THD_N_ratio * 100
   - Nota: si E_residuo > E_fund, el sistema está severamente no lineal (THD > 100%)

4. ANÁLISIS ESPECTRAL DEL RESIDUO (OPCIONAL/DIAGNÓSTICO)
   - FFT(x[n]) con ventana Blackman-Harris (minimiza fuga espectral de la fundamental)
   - Medir magnitud en bins correspondientes a 2·f0, 3·f0, 4·f0, 5·f0
   - Identificar el armónico dominante para diagnóstico

Outputs: { thd_n_pct, thd_n_db, dominant_harmonic, raw_residue_rms }
```

**Timing:** ~16–18 segundos (dos niveles, estéreo)

---

### X — Diafonía y Aislamiento de Canales

**Qué es:** La medición de cuánta señal de un canal sangra hacia el otro — el grado en que una señal que debería estar presente solo en el canal izquierdo aparece en el derecho.

**La señal:** Un seno a 1 kHz al nivel de alineamiento, inyectado al **canal izquierdo únicamente** con la salida del canal derecho en silencio. El analizador mide el nivel en ambos canales simultáneamente. Luego la prueba se repite con la señal en el canal derecho únicamente.

**Qué mide:**

La diafonía se expresa en dB — el nivel de la señal filtrada en el canal silencioso relativo a la señal completa en el canal activo.

- −60 dB = inaudible
- −20 dB = claramente audible como un fantasma del canal opuesto

**Fuentes de diafonía:**


| Fuente                                     | Característica espectral | Diagnóstico                                            |
| ------------------------------------------ | ------------------------ | ------------------------------------------------------ |
| Acoplamiento capacitivo (cables paralelos) | Crece con la frecuencia  | Cables demasiado juntos o sin blindaje                 |
| Acoplamiento inductivo                     | Varía con geometría      | Cables sin blindaje cerca de transformadores           |
| Error de ruteo de consola                  | Plano                    | Asignación de aux o grupo duplicando señal             |
| Separación interna de amplificador         | Plano                    | Amplificador estéreo con separación insuficiente       |
| Acoplamiento mecánico                      | Picos en resonancias     | Gabinetes de altavoces montados en la misma estructura |


**Relevancia para voz hablada estéreo:** En una configuración PA estéreo para conferencia, un orador posicionado en el escenario izquierdo físicamente proyecta su voz principalmente hacia la mitad izquierda de la audiencia. Si el sistema tiene diafonía severa, las diferencias de nivel y EQ cuidadosamente elaboradas entre canales colapsan, y la claridad espacial del sistema se pierde.

**Versión con sweep de frecuencias:** La diafonía como función de la frecuencia revela:

- **Diafonía creciente con frecuencia:** Acoplamiento capacitivo entre cables
- **Diafonía plana a través de frecuencias:** Acoplamiento resistivo — existe una conexión física entre canales que no debería estar
- **Diafonía solo en frecuencias específicas:** Resonancia mecánica entre gabinetes de altavoces

#### Pipeline de Procesamiento DSP

```
Contexto: AudioWorklet / Web Worker

1. MEDICIÓN DE NIVEL SIMULTÁNEA
   - Canal activo transmite tono 1 kHz, canal silencioso transmite silencio digital
   - Aplicar filtro pasabanda estrecho centrado en 1 kHz en AMBOS canales receptores (L y R)
   - Filtrar mejora la lectura de diafonía aislando la señal del ruido de fondo

2. RMS POR CANAL
   - nivel_activo = RMS(filtrado_activo[n])
   - nivel_silencioso = RMS(filtrado_silencioso[n])

3. CÁLCULO DE DIAFONÍA
   - crosstalk_db = 20·log10(nivel_silencioso / nivel_activo)

4. MODO SWEEP (Para caracterización de frecuencia)
   - Mismo pipeline pero trackeando la frecuencia instantánea del sweep
   - Evaluar si la pendiente de la curva de diafonía es de ~6 dB/octava (acoplamiento capacitivo) o plana (acoplamiento resistivo/ruteo)

Outputs: { crosstalk_db, frequency_dependence_slope_db_oct, failure_reason }
```

**Timing:** ~15–25 segundos dependiendo del modo (tono único vs. sweep de frecuencias)

---

### R — Margen de Retroalimentación (Ring Out)

**Qué es:** El único segmento que mide no lo que el sistema hace, sino lo que *está por hacer* — el headroom restante antes de que la retroalimentación acústica se vuelva incontrolable.

**La señal:** Ruido rosa a nivel bajo, con la ganancia del sistema incrementada en pasos conocidos de 1 dB mientras el analizador observa la firma característica del inicio de la retroalimentación.

**Cómo se detecta el inicio del feedback:**

El feedback no comienza como un aullido completo. Comienza como una frecuencia de banda estrecha — una sola frecuencia donde la ganancia del bucle (sensibilidad del micrófono × ganancia del amplificador × salida del altavoz × acústica de sala × patrón polar del micrófono en ese ángulo) primero excede la unidad.

El analizador monitorea la **flatness espectral** de la señal recibida durante la rampa de ganancia. Cuando una frecuencia comienza a crecer más rápido que el espectro circundante — específicamente cuando su tasa de crecimiento excede un umbral — eso es el precursor del feedback.

**Qué mide:**

- **Margen de feedback:** Cuántos dB de ganancia adicional pueden aplicarse antes de que la primera frecuencia comience a repicar. Expresado como "X dB por debajo del feedback."
- **Frecuencia más vulnerable:** La frecuencia específica donde ocurrirá primero el feedback — objetivo primario para el filtro notch del Módulo 3.6
- **Carácter del feedback:** Si el inicio es agudo (indica resonancia acústica estrecha — fácil de notchear) o amplio (indica modo de sala difuso — más difícil de tratar)

**Tabla de interpretación:**


| Margen                                            | Diagnóstico                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| > 12 dB                                           | Excelente. El sistema tiene headroom amplio para el evento.                                                                        |
| 6–12 dB                                           | Adecuado. Estándar para la mayoría de eventos en vivo. Aplicar uno o dos notches preventivos.                                      |
| 3–6 dB                                            | Marginal. El sistema está cerca del límite. El posicionamiento del micrófono o el ángulo del PA necesitan ajuste antes del evento. |
| < 3 dB                                            | Peligroso. No proceder sin cambios físicos — posición del micrófono, ángulo del monitor, o dirección del PA.                       |
| Múltiples frecuencias activándose simultáneamente | El patrón polar del micrófono apunta directamente al altavoz — toda la geometría es incorrecta.                                    |


**Conexión con el Módulo 3.6:** Segmento R corre antes del evento en condiciones controladas. La frecuencia que identifica como la más vulnerable se convierte en el **objetivo de notch pre-cargado** en el módulo AFE. Cuando el monitor Centinela se activa durante el evento, ya conoce la frecuencia de problema más probable y puede reaccionar más rápido porque la está observando específicamente en lugar de escanear todo el espectro ciegamente.

#### Pipeline de Procesamiento DSP

```
Contexto: AudioWorklet (monitoreo en tiempo real) + Módulo de Control de Ganancia

1. ESTIMACIÓN ESPECTRAL CONTINUA
   - FFT de 8192 puntos, overlapping de 75%, ventana Hann
   - Calcular Power Spectral Density (PSD) en tiempo real
   - Aplicar suavizado de "leaky integrator": PSD_smoothed[f] = α·PSD_current[f] + (1-α)·PSD_smoothed[f]

2. DETECCIÓN DE ONSET DE FEEDBACK (Medida de Flatness/Peak-to-Average)
   - Para cada bin espectral, calcular la relación Pico-a-Promedio-Local (Peak-to-Local-Average Ratio - PLAR)
   - PLAR[f] = PSD[f] / Media(PSD en banda adyacente ±1/3 octava)
   - Trackear la derivada de PSD[f]: dPSD[f]/dt. Si una frecuencia crece monótonamente mientras la ganancia sube, es candidata a feedback

3. TRIGGER DE UMBRAL
   - Si PLAR[f] > Umbral_Detección (ej. 12 dB) Y dPSD[f]/dt es positivo durante N tramas consecutivas
   - Declarar ONSET DE FEEDBACK en frecuencia f_critical

4. REGISTRO DE MARGEN
   - margen_db = (ganancia_sistema_al_momento_del_onset) - (ganancia_sistema_nominal)
   - Interrumpir inmediatamente la señal para evitar howling

Outputs: { feedback_margin_db, critical_frequency_hz, severity_index }
```

**Timing:** ~12–15 segundos (solo mains) / ~35–45 segundos (mains + 2 monitores)

---

### H — Headroom y Linealidad

**Qué es:** El segmento que mide si el sistema puede reproducir el nivel máximo previsto sin colapsar en distorsión o compresión no deseada. A diferencia del segmento D (que mide distorsión en condición estática), H ejecuta una **rampa de nivel** para detectar el punto exacto donde el sistema abandona el comportamiento lineal.

**La señal:** Seno a 1 kHz (o frecuencia configurada por el operador) cuyo nivel sube progresivamente desde −18 dBFS hasta 0 dBFS en escalones de 3 dB. El analizador mide THD en cada escalon.

**Qué mide:**

- **Punto de compresión:** Nivel al que la salida deja de crecer 1 dB por cada 1 dB de incremento de entrada (primera señal de limitación)
- **Knee de distorsión:** Nivel al que THD supera el 1% — umbral clásico de calidad profesional
- **Headroom efectivo:** Diferencia entre el nivel operacional nominal (establecido por A) y el Knee de distorsión, en dB

**Casos de uso:**

- *Comisionamiento:* Confirmar que cada etapa de la cadena (consola, amplificador, altavoz) tiene headroom suficiente para los picos transientes del programa
- *Diagnóstico de compresión térmica:* Correr H al inicio y al final del soundcheck; si el knee cae, el amplificador está limitando por temperatura
- *Subwoofers:* Usar cabecera LF (150/200 Hz) automáticamente; frecuencia de prueba configurable (ej. 80 Hz) para evaluar el punto de excursión máxima del woofer

**Tabla de interpretación:**


| Resultado                                 | Diagnóstico                                                           |
| ----------------------------------------- | --------------------------------------------------------------------- |
| Headroom ≥ 18 dB sobre nominal            | Excelente. Margen amplio para picos transientes                       |
| Headroom 12–18 dB                         | Adecuado para voz y reproducción estándar                             |
| Headroom 6–12 dB                          | Marginal. Picos de percusión o música pueden limitar                  |
| Headroom < 6 dB                           | Peligroso. Distorsión audible en material dinámico                    |
| Knee a nivel bajo + 2° armónico dominante | Transformador o etapa analógica saturando antes del digital           |
| Knee abrupto con 3° armónico              | Hard clip digital — compresor o limitador ajustado demasiado agresivo |


**Conexión con segmento D:** El segmento H es una visión dinámica de la linealidad; D es una visión estática en un nivel fijo. Juntos dan un mapa completo del comportamiento del sistema.

#### Pipeline de Procesamiento DSP

```
Contexto: Web Worker (análisis paso a paso post-grabación)

1. SEGMENTACIÓN POR ESCALÓN DE NIVEL
   - La grabación contiene 6 segmentos de ~2 segundos, cada uno 3 dB más fuerte
   - Extraer el bloque estable del centro de cada segmento (ej. 1 segundo) descartando transitorios de cambio de ganancia

2. ANÁLISIS DE CADA ESCALÓN (Iterativo)
   - Nivel RMS Entrada (estimado desde diseño): L_in[i]
   - Nivel RMS Salida Medido: L_out[i] = 20·log10(RMS(y_i[n]))
   - THD+N Medido: THD_i = pipeline_THD(y_i[n])

3. CÁLCULO DE COMPRESIÓN (Punto de Compresión)
   - ganancia_paso[i] = L_out[i] - L_in[i]
   - ganancia_referencia = ganancia_paso[0] (el paso más bajo, asumido lineal)
   - compresion[i] = ganancia_referencia - ganancia_paso[i]
   - Interpolar para encontrar el nivel de entrada donde compresion = 1.0 dB (Punto de Compresión a 1dB)

4. CÁLCULO DE LINEALIDAD (Knee de Distorsión)
   - Interpolar para encontrar el L_out donde THD cruza el umbral objetivo (ej. 1.0%)
   - headroom_efectivo_db = L_out_al_1_pct_THD - nivel_operacional_nominal_db

Outputs: { headroom_db, compression_point_dbfs, distortion_knee_dbfs, step_data[{level_in, level_out, thd}] }
```

**Timing:** ~10–15 segundos (6 escalones × ~2s/escalon)

---

## 9. Duración de Cada Segmento y de la Suite Completa

### Breakdown de Timing por Segmento


| Código | Segmento                 | Duración                  | Notas                                    |
| ------ | ------------------------ | ------------------------- | ---------------------------------------- |
| **V**  | Path Audit               | ~8s                       | Siempre el primero                       |
| **A**  | Alignment Level          | ~7s                       | Incluye L+R secuencialmente              |
| **M**  | Mic Profile Verification | ~20s                      | Sweep de 31 bandas                       |
| **N**  | Noise Floor              | ~15s                      | Ventana larga para precisión estadística |
| **F**  | Frequency Response       | ~30s                      | 3 promedios por posición                 |
| **P**  | Phase & Coherence        | ~50s (full) / ~25s (fast) | El segmento más largo de la suite        |
| **T**  | Time Alignment           | ~5–22s                    | Varía con número de altavoces            |
| **D**  | Distortion THD+N         | ~18s                      | Dos niveles, estéreo                     |
| **X**  | Crosstalk                | ~20s                      | Sweep de frecuencias completo            |
| **R**  | Feedback Margin          | ~15–45s                   | Varía con número de monitores            |


### Totales por Alcance


| Alcance                              | Secuencia                     | Duración Estimada |
| ------------------------------------ | ----------------------------- | ----------------- |
| Sanity check rápido                  | `V A T R`                     | ~35 segundos      |
| Pre-evento estándar                  | `V A M N F P T D R`           | ~3 minutos        |
| Comisionamiento completo             | `V A M N F P T D X R I`       | ~4–5 minutos      |
| Con múltiples posiciones de medición | Suite completa × 3 posiciones | ~8–10 minutos     |


### La Dominancia del Segmento P

El segmento P (45–60 segundos de ~120 total) domina el tiempo de la suite. La PWA debe ofrecer dos modos de sweep:

- **P Fast** (2 promedios, ~20 segundos): Suficiente para verificar polaridad, problemas de fase gruesos y fallos evidentes de coherencia. Para re-verificación rápida.
- **P Full** (6 promedios, ~55 segundos): Confianza estadística completa en coherencia. Para comisionamiento inicial y documentación.

Predeterminar P Fast durante eventos y P Full durante el setup da al operador la herramienta correcta para cada contexto sin hacerlo pensar en la diferencia.

---

## 10. Orden Recomendado y Cadena de Dependencias

El orden `V A M N F P T D X R` no es arbitrario — cada segmento valida o invalida las suposiciones del siguiente. Es una **cadena de dependencias**, no solo una lista.

```
V ─── ¿Existe la cadena de señal?
 └─ NO  → Detener. Corregir infraestructura.
 └─ YES ↓

A ─── ¿Es correcta la estructura de ganancia?
 └─ NO  → Corregir ganancia, re-correr A antes de continuar.
 └─ YES ↓

M ─── ¿Es confiable la herramienta de medición?
 └─ NO  → Asignar perfil correcto de micrófono o reemplazar micrófono.
 └─ YES ↓

N ─── ¿Cuál es el piso de ruido?
        (Establece umbrales de coherencia para P y F)
        ↓

F ─── ¿Cómo suena el sistema en realidad?
        (Produce el objetivo de corrección EQ)
        ↓

P ─── ¿Cuáles frecuencias en F pueden confiarse?
        (Invalida lecturas de F donde coherencia < umbral)
        ↓

T ─── ¿Es correcta la geometría?
 └─ NO  → Actualizar stage plot, recalcular delays.
 └─ YES ↓

D ─── ¿Es el sistema lineal?
 └─ NO  → Corregir estructura de ganancia, re-correr D.
 └─ YES ↓

X ─── ¿Son independientes los canales?
 └─ NO  → Encontrar y corregir fuente de diafonía.
 └─ YES ↓

R ─── ¿Cuánto headroom existe antes del feedback?
        (Arma el Módulo 3.6 con objetivos específicos de notch)
        → EL EVENTO COMIENZA
```

Si el operador llega a R y pasa, **cada capa del sistema debajo del evento ha sido verificada** — no asumida.

---

## 11. Secuencias Compuestas Recomendadas (Catálogo APST)

Las secuencias se escriben como strings de códigos. El catálogo canónico del sistema APST es:


| String                  | Nombre APST       | Duración aprox. | Uso                                        |
| ----------------------- | ----------------- | --------------- | ------------------------------------------ |
| `V A T R`               | Quick Check       | ~35s            | Verificación rápida entre sets             |
| `V A R`                 | Monitor Tuning    | ~20s            | Tuning de monitores de escenario           |
| `V A F R`               | Fast Pre-Show     | ~60s            | 30 minutos antes del evento                |
| `V P T`                 | Subsystem Align   | ~30s            | Alineamiento de subsistemas (subs + mains) |
| `V A M N F P T D R`     | Wizard Base       | ~3 min          | Setup estándar de evento — wizard guiado   |
| `V A M N S P`           | AutoEq Master     | ~3 min          | AutoEq de alta resolución para derivar FIR |
| `V H`                   | Headroom Audit    | ~15s            | Auditoría de linealidad / compresión       |
| `V A M N F P T D X R`   | Full Commission   | ~4 min          | Comisionamiento de nueva instalación       |
| `V A M N F P T D X R I` | Full + IR Capture | ~5 min          | Documentación completa con captura de IR   |
| `T R`                   | Between-Set Check | ~20s            | Verificación entre presentadores           |
| `F D`                   | EQ Verify         | ~48s            | Re-verificación post-corrección EQ         |
| `R`                     | Ring Out Only     | ~15s            | Check de margen de feedback aislado        |


**Reglas de Orquestación Obligatorias:**

- Toda secuencia debe comenzar con `V` o `A` (verificación de cadena / normalización de nivel)
- `AutoEq` requiere un segmento `N` previo con SNR > 15 dB; si no pasa, el orquestador bloquea y notifica
- El segmento `P` actúa como juez de calidad de datos: coherencia baja → resultados de EQ marcados con advertencia
- `S` se usa en lugar de `F` cuando el objetivo es derivar filtros FIR (mayor resolución temporal)
- Toda secuencia generada termina automáticamente con `.` + conteo de segmentos + `+EventID` (Source ID)
- El operador puede saltarse pasos opcionales en el Wizard vía *Escape Hatch* individual por segmento

## 12. Ecualización por Respuesta al Impulso (IR EQ)

### Qué Captura el Segmento T

Cuando el segmento T ejecuta su sweep logarítmico y deconvolución, el motor WASM produce la **Room Impulse Response (RIR)** como subproducto. Esta es una señal en el dominio del tiempo que describe completamente la función de transferencia acústica entre el altavoz y el micrófono en esa posición.

La relación matemática es:

$$y(t) = x(t) * h(t)$$

Donde $x(t)$ es la señal seca, $h(t)$ es la respuesta al impulso, y $y(t)$ es lo que la sala hace con ella. La deconvolución recupera $h(t)$ de la medición. Esta no es una aproximación — es una descripción matemática exacta del sistema, lo que significa que su inverso es un filtro de corrección exacto.

---

### El Problema del Filtro Inverso

Si la función de transferencia de la sala es $H(f)$, el filtro inverso es $H^{-1}(f)$. Aplicándolo:

$$H(f) \cdot H^{-1}(f) = 1$$

Respuesta plana en la posición de medición. Ecualización perfecta en teoría.

En la práctica, el filtro inverso se computa en el dominio de la frecuencia:

$$H^{-1}(f) = \frac{H^*(f)}{|H(f)|^2 + \beta}$$

Donde $H^*(f)$ es el conjugado complejo de la función de transferencia y $\beta$ es un término de regularización — un valor pequeño que previene que el inverso amplifique frecuencias donde la respuesta original era muy pequeña (nulls profundos) en spikes de ganancia catastróficos.

---

### Los Cuatro Problemas Prácticos

#### Problema 1 — Dependencia de Posición

La respuesta al impulso solo es perfectamente válida en la **posición exacta de medición**. Mover el micrófono 30 cm y se tiene una respuesta al impulso diferente. El filtro inverso corrige perfectamente en un punto y crea errores en todos los demás.

- Para instalaciones fijas (sala de juntas con micrófono de cámara fijo o podio fijo): aceptable.
- Para eventos en vivo donde el orador camina por el escenario: no aceptable.

**Mitigación:** Promediar múltiples respuestas al impulso tomadas en varias posiciones a través del área de audiencia o escenario. La IR promediada representa un compromiso espacial — menos perfecta en cualquier punto único pero mejor a través del área de cobertura (**promediado espacial**).

#### Problema 2 — Inversión de Tiempo (Pre-ringing)

Un filtro inverso de fase mínima verdadera es causal. Pero muchos problemas de sala no son de fase mínima. Las reflexiones llegan *después* del sonido directo, lo que significa que el inverso matemático de una reflexión debe llegar *antes* del sonido directo — pre-ringing en el dominio del tiempo.

El pre-ringing es perceptualmente más dañino que la reflexión original para el habla. El sistema auditivo usa la llegada del sonido directo como ancla temporal; una mancha antes de ella destruye esa ancla.

**Mitigación:** Usar una **extracción de fase mínima** de la respuesta al impulso en lugar de la IR completa. El equivalente de fase mínima corrige respuesta de magnitud sin introducir pre-ringing, al costo de no corregir la fase en exceso. Para inteligibilidad del habla, la corrección de magnitud importa mucho más que la corrección de fase en la mayoría de frecuencias.

#### Problema 3 — Los Nulls Profundos No Pueden Corregirse

Una frecuencia donde la sala produce salida casi nula (un null de interferencia destructiva) requiere ganancia casi infinita del filtro inverso para correger. Esto es físicamente imposible y cualquier intento produce feedback o clipping.

El término de regularización $\beta$ previene esto limitando la ganancia máxima del filtro inverso, pero significa que los nulls profundos quedan parcial o enteramente sin corregir.

**Mitigación:** Los datos de coherencia del segmento P ya identifican estos nulls — aparecen como frecuencias donde la coherencia cae hacia cero. El cálculo del filtro inverso puede programarse para:

- Aplicar regularización mínima en frecuencias de alta coherencia (donde la inversión es segura y precisa)
- Aplicar regularización pesada en frecuencias de baja coherencia (nulls profundos)

**La coherencia se convierte en el mapa de confianza para la inversión** — diciéndole al algoritmo dónde puede empujar fuerte y dónde debe ceder.

#### Problema 4 — Latencia

Un EQ de IR basado en convolución introduce latencia igual a la mitad de la longitud de la respuesta al impulso. Una IR de 1 segundo a 48 kHz son 48,000 muestras — el filtro FIR de convolución tiene 48,000 taps, introduciendo ~500ms de latencia. Inaceptable para un micrófono de voz en vivo.

**Mitigación:** Truncar la respuesta al impulso. Para habla en vivo, solo los primeros 50–100ms de la IR importan para la inteligibilidad. Las reflexiones llegando después de 80ms son generalmente integradas por el sistema auditivo (efecto Haas / efecto de precedencia) en lugar de percibirse como ecos discretos.

Una IR de 100ms a 48 kHz son 4,800 muestras — ~50ms de latencia.

**Mejor solución:** Convertir la IR truncada de fase mínima en un **filtro FIR de fase mínima** usando la transformada de Hilbert, lo que elimina la latencia inherente de la convolución de fase lineal completamente.

---

### Los Tres Outputs del Sistema

```javascript
// Output A — IR completa de fase lineal (referencia / documentación)
const irBuffer = wasmEngine.getImpulseResponse();  // Float32Array
const wavBlob  = encodeWAV(irBuffer, sampleRate);
const urlA     = URL.createObjectURL(wavBlob);
// → ir_full_{eventId}_{timestamp}.wav (descargable)

// Output B — Filtro FIR de fase mínima (despliegue en vivo)
const coherenceMap  = wasmEngine.getCoherenceData();  // γ²(f) desde segmento P
const minPhaseFIR   = wasmEngine.computeMinPhaseInverse(irBuffer, coherenceMap);
// → ir_correction_{eventId}_{timestamp}.wav
// Latencia: near-zero. Apto para AudioWorklet en vivo.

// Output C — EQ paramétrico equivalente (para hardware físico)
const parametricEQ  = module32.translateFIRtoParametric(minPhaseFIR, eqInventory);
// → ir_parametric_{eventId}_{timestamp}.json
// Para consolas y procesadores físicos sin capacidad de convolución.
```


| Output                 | Formato                    | Latencia      | Uso                                                  |
| ---------------------- | -------------------------- | ------------- | ---------------------------------------------------- |
| A — IR Completa        | WAV 32-bit float           | N/A (offline) | Documentación, análisis externo, import en REW/Dirac |
| B — FIR de fase mínima | WAV / coeficientes raw     | Near-zero     | Convolución en vivo via AudioWorklet                 |
| C — EQ paramétrico     | JSON (parámetros de banda) | N/A           | Implementación en hardware físico vía Módulo 3.2     |


---

### Pipeline Completo de Medición a IR EQ

```
Segmento T (sweep logarítmico + deconvolución)
         ↓
    RIR Cruda — h(t)
         ↓
    ┌────────────────────────────────────┐
    │  Datos de coherencia Segmento P    │
    │  → Mapa de confianza γ²(f)         │
    └────────────────┬───────────────────┘
                     ↓
    Windowing + truncar a 100ms
    Aplicar regularización ponderada por coherencia:
      β(f) = β_max × (1 - γ²(f))
         ↓
    Extracción de fase mínima (Transformada de Hilbert)
         ↓
    ┌─────────────────────────────────────────────┐
    │             Tres outputs                     │
    ├─────────────────────────────────────────────┤
    │  A. IR Completa WAV → documentación          │
    │  B. FIR fase mínima → AudioWorklet en vivo   │
    │  C. EQ Paramétrico → Módulo 3.2 hardware     │
    └─────────────────────────────────────────────┘
```

---

### Promediado Espacial

Con múltiples posiciones de medición (dirigidas por el generador de Sweet Spots del Módulo 3.1), el sistema puede promediar esas IRs antes de computar el filtro inverso.

El promediado simple en el dominio de la frecuencia puede causar cancelación de fase entre posiciones. La forma correcta es el **promediado de energía**:

$$|\bar{H}(f)|^2 = \frac{1}{N} \sum_{i=1}^{N} |H_i(f)|^2$$

Promediar los espectros de potencia, no los espectros complejos. Luego derivar la respuesta de fase mínima desde el espectro de potencia promediado. Esto preserva la información de magnitud a través de posiciones sin artefactos de cancelación de fase.

---

### Nuevo Segmento I — Captura y Exportación de IR

La captura de IR emerge naturalmente del pipeline de medición existente y merece su propio segmento formal:

**Segmento I — IR Capture & Export**

- Se dispara automáticamente después de que el segmento T completa (o puede correrse independientemente)
- Realiza promediado espacial si se midieron múltiples posiciones
- Computa el filtro FIR de corrección de fase mínima con ponderación de coherencia
- Exporta tres artefactos a IndexedDB y opcionalmente a la File API:
  - `ir_full_{eventId}_{timestamp}.wav` — IR completa de fase lineal
  - `ir_correction_{eventId}_{timestamp}.wav` — Filtro FIR de fase mínima
  - `ir_parametric_{eventId}_{timestamp}.json` — EQ paramétrico equivalente

**La IR como documento viviente:**

Porque la IR se almacena en IndexedDB junto con el JSON de configuración del evento (Módulo 3.8), se convierte en parte del estado portable. El ingeniero puede exportar el archivo de configuración y el filtro de corrección juntos — el operador en el venue carga el JSON, hidrata el estado de la aplicación, y el AudioWorklet inmediatamente carga el filtro FIR pre-computado para esa sala.

**La sala ha sido pre-caracterizada remotamente, antes de que el operador llegue al venue.** El ingeniero no solo envía ajustes de EQ — envía una corrección de sala matemáticamente derivada medida en esa sala específica en una ocasión anterior.

---

### Limitaciones Honestas a Documentar

Tres cosas que el sistema debe comunicar explícitamente al operador en lugar de ocultar:

**1. La corrección es válida solo para la geometría altavoz-micrófono medida.** Si el arreglo de altavoces se mueve o el layout del escenario cambia, la IR debe re-medirse. El sistema debe detectar cambios de geometría en el Módulo 3.1 e invalidar automáticamente los archivos IR almacenados.

**2. El FIR de fase mínima corrige magnitud, no reflexiones.** No puede remover reflexiones tardías de la sala — eso requiere tratamiento acústico físico. Lo que hace es asegurar que el camino de sonido directo sea espectralmente plano, que es la porción de la respuesta que porta el habla inteligible. Las reflexiones más allá de 50ms están fuera de la ventana de corrección intencionalmente.

**3. Los nulls profundos permanecen.** La regularización ponderada por coherencia previene spikes de ganancia peligrosos en frecuencias de null pero esas frecuencias permanecen sin corregir en el output. El sistema debe visualizar estas en el display de respuesta en frecuencia como regiones sombreadas de "no corregible" para que el operador entienda los límites de lo que la corrección puede lograr.

---

## 13. Schema de Reporte de Secuencia

```json
{
  "sequenceId": "VAMNFPTDXRI",
  "schemaVersion": "1.0",
  "event": "Conferencia Anual 2026 - Sala A",
  "timestamp": "2026-05-08T19:45:00Z",
  "venue": {
    "width_m": 18.5,
    "length_m": 24.0,
    "temperature_c": 21.3
  },
  "hardware": {
    "mic": "SM58 (Profile v2)",
    "pa_main": "QSC K12.2 (Profile v1)",
    "eq_type": "parametric",
    "topology": "independent_lr"
  },
  "segments": [
    {
      "code": "V",
      "name": "Path Audit",
      "result": "PASS",
      "fsk_reliability": "5/5",
      "round_trip_latency_ms": 23.4,
      "latency_excess_ms": 14.2,
      "level_deviation_db": -0.8,
      "noise_nc": 32,
      "thd_pct": 0.3,
      "note": "Latencia no declarada detectada: +14.2ms. Etapa digital en cadena. Ajuste aplicado.",
      "duration_ms": 8200
    },
    {
      "code": "F",
      "name": "Frequency Response",
      "result": "FAIL",
      "worst_deviation_hz": 315,
      "worst_deviation_db": -4.1,
      "within_tolerance_pct": 78,
      "note": "Déficit fuera de tolerancia en 315 Hz. Sugiere +2 dB EQ.",
      "suggested_eq": [
        { "type": "peak", "freq_hz": 315, "gain_db": 2.1, "q": 2.4 }
      ],
      "duration_ms": 28400
    }
  ],
  "ir_files": {
    "full_ir": "ir_full_sala_a_20260508.wav",
    "correction_fir": "ir_correction_sala_a_20260508.wav",
    "parametric_eq": "ir_parametric_sala_a_20260508.json"
  },
  "overall": "CONDITIONAL_PASS",
  "action_items": [
    "Corregir 315 Hz antes de iniciar evento",
    "Verificar fuente de latencia adicional de 14.2ms"
  ]
}
```

---

## 14. Correspondencia Lindos LA100 ↔ Códigos APST del Proyecto

El sistema APST del proyecto adopta la filosofía de segmentos Lindos pero redefine los códigos de letra para que sean semánticamente intuitivos en el contexto de calibración AV en vivo. La siguiente tabla mapea cada código APST a su equivalente funcional en el LA100.


| Código APST | Nombre APST                | Equivalente LA100                           | Diferencias notables                                                                         |
| ----------- | -------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `V`         | Path Audit                 | `T` (Test Level 1 kHz) + `V` (400 Hz)       | APST agrega rotación FSK ×5 + ventana de silencio + THD instantáneo                          |
| `A`         | Alignment Level            | `T` (Test Level 1 kHz)                      | Igual en concepto; APST es la referencia explícita de ganancia de la sesión                  |
| `M`         | Mic Profile Verification   | Sin equivalente directo                     | Nuevo: verifica la curva del micrófono de medición contra el inventario CLF                  |
| `N`         | Noise Floor                | `M` / `N` (Noise CCIR-468)                  | APST usa ponderación A + curva NC; Lindos usa CCIR 468-4                                     |
| `F`         | Frequency Response (Fast)  | `U` (Sweep 5s) / `P` (Sweep 5s a −20 dB)    | APST normaliza contra respuesta plana; LA100 normaliza contra TL OUT                         |
| `S`         | Frequency Response (Slow)  | `S` (Sweep 20s)                             | Equivalente directo. Mismo concepto, misma duración                                          |
| `P`         | Phase & Coherence          | `Y` / `Z` (Phase a frecuencias discretas)   | APST agrega coherencia γ²; Lindos LA100 solo mide fase en 6 frecuencias discretas            |
| `T`         | Time Alignment (IR)        | Sin equivalente directo en LA100            | LA100 no tiene deconvolución; APST usa MLS o sweep + IFFT para extraer RIR                   |
| `D`         | Distortion THD+N           | `D` / `F` / `G` (Distorsión en frecuencias) | Equivalente cercano. APST agrega 2 niveles simultáneos                                       |
| `X`         | Crosstalk                  | `A` / `B` / `C` (Crosstalk a 6 frecuencias) | Equivalente funcional. APST es estero simple (L↔R)                                           |
| `R`         | Feedback Margin (Ring Out) | Sin equivalente en LA100                    | Nuevo: la rampa de ganancia con detección de onset de feedback es específica del uso en vivo |
| `H`         | Headroom / Linearity       | `H` (3% MOL en 1 kHz)                       | Equivalente parcial. APST agrega rampa progresiva y punto de compresión                      |
| `I`         | IR Capture & Export        | Sin equivalente                             | Nuevo: post-procesamiento sobre resultado de `T`; exporta FIR + EQ paramétrico               |


### Segmentos LA100 No Adoptados en APST

Los siguientes segmentos del LA100 no tienen equivalente en el sistema APST porque pertenecen a contextos de radiodifusión o hardware no relevantes para calibración AV en vivo:


| Código LA100    | Descripción                                                       | Razón de exclusión                                                                             |
| --------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `W`             | Wow & Flutter (3.125 kHz)                                         | Específico de medidores de reproducción de cinta                                               |
| `E` / `I` LA100 | Distorsión multi-nivel (+8 dBu / −10 dBu)                         | Niveles de referencia de radiodifusión; cubierto por `D` + `H`                                 |
| `d` (min.)      | Distorsión de diferencia de frecuencias (70 Hz, 2° orden a 1 kHz) | Medición de productores de cinta; innecesaria para PA en vivo                                  |
| `h` (min.)      | 3% MOL a 315 Hz                                                   | Específico de sistemas de cinta a alta velocidad                                               |
| `K`             | Niveles de usuario (1 kHz, 6 escalones)                           | Cubierto por `H` con rampa continua                                                            |
| `–`             | Secuencia CCITT O.33                                              | Compatibilidad con estándar legado; no relevante                                               |
| `+`             | Source ID (texto)                                                 | *Sí adoptado:* se incluye automáticamente al final de toda secuencia APST con el ID del evento |
| `.`             | Terminación de secuencia                                          | *Sí adoptado:* terminación + conteo de segmentos incluida automáticamente                      |


### Compatibilidad de Nivel de Señal


| Parámetro           | Lindos LA100/MS20        | APST (PWA)                                         |
| ------------------- | ------------------------ | -------------------------------------------------- |
| Nivel nominal FSK   | 0 dBu                    | −18 dBFS (nivel de referencia digital)             |
| Rango operativo FSK | −30 a +20 dBu            | Determinado por estructura de ganancia del sistema |
| Medición de nivel   | TL OUT (absoluto en dBu) | Relativo al nivel establecido por segmento `A`     |
| Autoranging         | Sí (LA102)               | Sí (WASM con normalización por segmento `A`)       |


---

*Documento generado como especificación técnica complementaria al DDS principal.*  
*Versión: 2.0 | Proyecto: Plataforma PWA de Asistencia Proactiva para Calibración A/V*  
*Fuente de referencia: Lindos LA100 Manual 6th Edition, MS20 Manual 2nd Edition (via corpus RAG NotebookLM §7.1)*