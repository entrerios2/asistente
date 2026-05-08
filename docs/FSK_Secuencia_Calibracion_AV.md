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
12. [Timeline Operativo Pre-Evento](#12-timeline-operativo-pre-evento)
13. [Ecualización por Respuesta al Impulso (IR EQ)](#13-ecualización-por-respuesta-al-impulso-ir-eq)
    - [Qué Captura el Segmento T](#qué-captura-el-segmento-t)
    - [El Problema del Filtro Inverso](#el-problema-del-filtro-inverso)
    - [Los Cuatro Problemas Prácticos](#los-cuatro-problemas-prácticos)
    - [Los Tres Outputs del Sistema](#los-tres-outputs-del-sistema)
    - [Pipeline Completo de Medición a IR EQ](#pipeline-completo-de-medición-a-ir-eq)
    - [Promediado Espacial](#promediado-espacial)
    - [Nuevo Segmento I — Captura y Exportación de IR](#nuevo-segmento-i--captura-y-exportación-de-ir)
    - [Limitaciones Honestas a Documentar](#limitaciones-honestas-a-documentar)
14. [Arquitectura de Integración en la PWA](#14-arquitectura-de-integración-en-la-pwa)
15. [Módulo §3.9 — Especificación para el DDS](#15-módulo-39--especificación-para-el-dds)

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

### Codificación

```
FSK estándar Lindos:
  Mark (bit 1) = 1800 Hz
  Space (bit 0) = 1200 Hz
  Velocidad = 110 baudios
  Duración de bit ≈ 9ms
  Duración del header ≈ 200ms
```

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
// FSK de dos frecuencias: mark = 1800 Hz, space = 1200 Hz (110 baudios)
// Idéntico al enfoque del hardware Lindos
const oscillator = audioContext.createOscillator();

function charToBits(char) {
  // 7-bit ASCII + bit de start + bit de stop = 9 bits por carácter
  const code = char.charCodeAt(0);
  const bits = [0]; // start bit
  for (let i = 0; i < 7; i++) {
    bits.push((code >> i) & 1);
  }
  bits.push(1); // stop bit
  return bits;
}

function sendFSKHeader(segmentCode) {
  const bits = charToBits(segmentCode);
  let t = audioContext.currentTime;
  const bitDuration = 1 / 110; // 110 baudios → ~9.09ms por bit

  bits.forEach(bit => {
    oscillator.frequency.setValueAtTime(
      bit === 1 ? 1800 : 1200, // mark / space
      t
    );
    t += bitDuration;
  });
  // Después del header, continúa inmediatamente con la señal de prueba del segmento
}
```

### Detección (equivalente al LA102) — en WASM/AudioWorklet

El algoritmo de Goertzel es el detector óptimo para FSK. A diferencia de una FFT completa, computa la energía en una sola frecuencia objetivo con costo computacional mínimo — ideal para el AudioWorklet donde cada ciclo de CPU cuenta.

```rust
// En el motor WASM — Algoritmo de Goertzel para detección FSK
fn goertzel(samples: &[f32], target_freq: f32, sample_rate: f32) -> f32 {
    let k = (0.5 + (samples.len() as f32 * target_freq / sample_rate)) as usize;
    let omega = 2.0 * PI * k as f32 / samples.len() as f32;
    let coeff = 2.0 * omega.cos();
    let (mut s_prev, mut s_prev2) = (0.0f32, 0.0f32);

    for &sample in samples {
        let s = sample + coeff * s_prev - s_prev2;
        s_prev2 = s_prev;
        s_prev = s;
    }
    // Retorna energía en la frecuencia objetivo
    s_prev2.powi(2) + s_prev.powi(2) - coeff * s_prev * s_prev2
}

fn detect_fsk_bit(samples: &[f32], sample_rate: f32) -> u8 {
    let energy_mark  = goertzel(samples, 1800.0, sample_rate);
    let energy_space = goertzel(samples, 1200.0, sample_rate);
    if energy_mark > energy_space { 1 } else { 0 }
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

| Retardo excedente | Diagnóstico |
|---|---|
| Ligeramente tarde (1–5ms) | Longitud de cable adicional, o etapa de procesamiento digital agregando buffering |
| Significativamente tarde (>10ms) | Dispositivo digital no declarado en la cadena — procesador de sala, sistema inalámbrico, hop de red Dante |
| Latencia variable (jitter) | Inestabilidad de clock — mismatch de sample rate entre dispositivos |

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

| Código | Nombre | Señal de Prueba | Parámetro Medido | Tolerancia por Defecto |
|---|---|---|---|---|
| **V** | Path Audit | Rotación FSK + piloto + silencio | Salud de la cadena completa | 5 criterios binarios |
| **A** | Alignment Level | Seno 1 kHz @ −18 dBFS | Desviación de ganancia vs. nominal | ±1 dB |
| **M** | Mic Profile Verification | Sweeptones de tercio de octava | Desviación vs. curva almacenada | ±2 dB |
| **N** | Noise Floor | Silencio | SPL ponderado A, curva NC | NC ≤ 35 |
| **F** | Frequency Response | Sweep logarítmico 40 Hz–16 kHz | Desviación de magnitud vs. curva objetivo | ±3 dB (125 Hz–8 kHz) |
| **P** | Phase & Coherence | Sweep dual-canal | Error de fase + coherencia < 0.85 | ±15° @ 1 kHz |
| **T** | Time Alignment | Impulso MLS / sweep + deconvolución | Tiempo de llegada vs. delay calculado | ±0.5 ms |
| **D** | Distortion THD+N | Seno 1 kHz @ 0 dBFS y −6 dBFS | Relación THD+N | ≤ 1% |
| **X** | Crosstalk | Seno 1 kHz canal L only / R only | Sangrado entre canales | ≤ −60 dB |
| **R** | Feedback Margin | Ruido rosa + rampa de ganancia | dB de headroom antes del primer anillo | ≥ 6 dB |
| **I** | IR Capture & Export | (Post-procesamiento de T) | Respuesta al impulso + filtro FIR de corrección | — |

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

| Sub-test V | Mensaje de fallo |
|---|---|
| FSK 0/5 | "Sin señal recibida. Verificar: ruteo de interfaz, alimentación de amplificador, conexiones de cable." |
| FSK 2/5 | "Cadena de señal marginal. Nivel demasiado bajo o interferencia presente. Verificar estructura de ganancia." |
| Exceso de latencia >10ms | "Latencia no declarada: Xms. Posible etapa de procesamiento digital en cadena. Todos los cálculos de timing ajustados." |
| Nivel >3 dB bajo | "Ganancia de cadena baja. Aumentar nivel de salida o verificar atenuación en cadena." |
| Nivel >3 dB alto | "Ganancia de cadena alta. Riesgo de clipping. Reducir nivel de salida antes de proceder." |
| Piso de ruido falla | "Ruido ambiente excesivo (NC-XX). Las mediciones tendrán confiabilidad reducida en bajas frecuencias." |
| THD falla | "Distorsión severa en cadena. Sistema sobrecargado. Reducir ganancia antes de cualquier medición." |

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

| Resultado | Diagnóstico |
|---|---|
| Nivel recibido coincide ±1 dB | Estructura de ganancia correcta. Proceder. |
| Nivel ≥ −6 dB bajo objetivo | Sistema demasiado silencioso — margen de feedback se desperdicia, rango dinámico comprometido |
| Variación >3 dB entre L y R | Ganancia asimétrica — un canal de amplificador, cable, o salida de consola difiere |
| Nivel sobre objetivo | Sistema corriendo caliente — headroom reducido, riesgo de clipping elevado |

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

| Desviación | Acción del sistema |
|---|---|
| Menor (2–4 dB) | Actualizar automáticamente el perfil con valores medidos |
| Moderada (4–8 dB) | Advertencia — pedir al operador confirmar asignación del modelo antes de proceder |
| Severa (>8 dB) | Detener. El micrófono es el modelo incorrecto o está físicamente dañado |

**Escenario de campo crítico:** El micrófono de medición designado fue olvidado en el estudio y el operador usa un SM58 de repuesto. Sin M, el sistema aplica la compensación incorrecta a cada medición de respuesta en frecuencia, produciendo correcciones de EQ que empeoran el sistema en lugar de mejorarlo.

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

| Tipo de espacio | Rating NC Recomendado |
|---|---|
| Sala de conferencias, boardroom | NC 25–35 |
| Auditorio grande, sala de conferencias | NC 30–40 |
| Venue de evento en vivo | NC 35–45 |
| Venue al aire libre o industrial | NC 45+ |

**Forma espectral como diagnóstico:**

| Forma del ruido | Diagnóstico |
|---|---|
| Componente fuerte 50/60 Hz | Bucle de tierra — blindaje de cable conectado en ambos extremos |
| Hiss broadband creciente hacia HF | Ruido propio de preamplificador o consola — ganancia muy alta en algún punto |
| Tonos discretos en frecuencias inesperadas | Interferencia RF acoplada en entrada desbalanceada, o ruido de clock digital |
| Rumble de baja frecuencia | HVAC dominante, o vibración física acoplada en micrófono en pedestal |

**Rol sistémico:** El resultado de N establece directamente el **umbral mínimo de coherencia** para el segmento P. Si el piso de ruido es alto, la coherencia naturalmente será menor en niveles de señal bajos. El sistema debe ajustar automáticamente los umbrales de advertencia de coherencia basado en el resultado de N.

**Timing:** ~15 segundos

---

### F — Respuesta en Frecuencia

**Qué es:** La medición más visualmente intuitiva y la que los operadores interactúan más directamente — la curva que muestra cuán fuerte es el sistema en cada frecuencia relativa al nivel de referencia establecido por el segmento A.

**La señal:** Un sweep sinusoidal logarítmico de 20 Hz a 20 kHz (en práctica 40 Hz–16 kHz para voz hablada). Logarítmico porque la audición humana es logarítmica — el sweep pasa proporcionalmente más tiempo en bajas frecuencias donde la resolución importa más para la acústica de sala.

**Cómo funciona:**

El motor WASM compara el nivel instantáneo del sweep recibido contra una referencia — el nivel que *debería* llegar en esa frecuencia si el sistema fuera perfectamente plano. La diferencia en cada frecuencia, en dB, es la desviación de respuesta en frecuencia.

**La captura cruda convuelve tres factores:**
1. Respuesta propia del altavoz
2. Contribución acústica de la sala
3. Coloración propia del micrófono

Con el perfil de micrófono aplicado desde el Módulo 3.2 (verificado por segmento M), lo que queda es la respuesta combinada de sala y altavoz — que es lo que se quiere ecualizar.

**La curva objetivo para voz hablada:**

Investigación sobre inteligibilidad del habla (ITU-T P.800, IEC 60268-16 STI) muestra consistentemente que un ligero boost de presencia y rolloff de graves controlado mejora la inteligibilidad sobre una respuesta plana:

| Rango | Objetivo | Razón |
|---|---|---|
| Sub-graves (20–80 Hz) | −6 a −12 dB aceptable | Modos de sala dominan, EQ rara vez mejora |
| Graves (80–200 Hz) | Plano a −3 dB | Calidez suficiente sin turbidez |
| Bajo-medio (200–800 Hz) | Plano ±2 dB | El cuerpo de la voz vive aquí |
| Presencia (1–4 kHz) | Plano a +2 dB | Claridad de consonantes e inteligibilidad |
| Alta presencia (4–8 kHz) | Plano a −3 dB | Control de sibilantes |
| Aire (8–16 kHz) | −6 dB o mayor rolloff aceptable | Umbrales auditivos y absorción del aire |

**Tabla diagnóstica:**

| Resultado | Diagnóstico |
|---|---|
| Curva dentro ±3 dB del objetivo 125 Hz–8 kHz | Sistema bien comportado, EQ mínimo necesario |
| Pico amplio en 250–400 Hz | Modo de sala o resonancia de port de altavoz — corte paramétrico |
| Pico estrecho en cualquier frecuencia | Onda estacionaria de sala o resonancia de gabinete — filtro notch |
| Caída amplia en 2–4 kHz | Región de presencia comprometida — voz sonará distante y poco clara |
| Rolloff severo sobre 4 kHz | Micrófono demasiado lejos, altavoz mal orientado, o falla del driver HF |
| Respuesta varía dramáticamente entre L y R | Sala asimétrica, altavoces posicionados asimétricamente, o EQ diferente entre canales |

**Conexión con el Módulo 3.2:** La curva de desviación entre medición y objetivo es exactamente el filtro que el sistema necesita aplicar. Módulo 3.2 traduce ese filtro ideal a lo que el hardware físico puede implementar.

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

| Resultado | Diagnóstico |
|---|---|
| Fase rota suavemente, coherencia >0.9 en 100 Hz–8 kHz | Cadena limpia, mediciones confiables |
| Offset de fase de 180° a todas las frecuencias | Inversión de polaridad en algún punto de la cadena |
| Anomalía de fase en frecuencia específica con baja coherencia | Nodo de cancelación acústica — posición de medición incorrecta |
| Coherencia cae sobre 4 kHz | Micrófono demasiado lejos para coherencia HF, o absorción de aire significativa |
| Pendiente de fase más pronunciada que lo esperado | Dispositivo de latencia adicional en la cadena (procesador digital, receptor inalámbrico) |

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

| Resultado | Diagnóstico |
|---|---|
| Delay medido coincide con calculado ±0.5ms | Ajustes de delay correctos |
| Delay medido menor que el esperado | Altavoz físicamente más cerca de lo que el stage plot muestra |
| Delay medido mayor que el esperado | Etapa digital agrega latencia, o altavoz más lejos, o temperatura mayor a la ingresada |
| Pico secundario fuerte a 10–15ms | Reflexión temprana de pared paralela o techo — el más dañino para inteligibilidad de habla |
| Múltiples picos secundarios de amplitud similar | Espacio reverberante — la sala trabaja contra la claridad del habla |

**Timing:** ~5 segundos (PA estéreo simple) / ~18–22 segundos (sistema completo con 4 altavoces de delay)

---

### D — Distorsión THD+N

**Qué es:** La medición de todo lo que la cadena de señal agregó que no estaba en la señal original.

**La señal:** Un seno único a 1 kHz al nivel operacional del sistema, mantenido durante suficiente tiempo para que el analizador se estabilice (típicamente 3–5 segundos). Debe correrse en **dos niveles**: −18 dBFS y −6 dBFS para una imagen completa de la linealidad del sistema.

**Cómo funciona THD+N:**

El analizador aplica un filtro notch muy estrecho exactamente a 1 kHz a la señal recibida, removiendo el fundamental. Todo lo que queda — harmónicos (2 kHz, 3 kHz, 4 kHz...) más ruido broadband — es el residuo de "distorsión + ruido". THD+N se expresa como la relación de ese residuo al nivel fundamental original:

$$\text{THD+N} = \frac{\sqrt{V_2^2 + V_3^2 + V_4^2 + ... + V_N^2}}{V_1} \times 100\%$$

**Qué dice la estructura harmónica:**

| Harmónico dominante | Causa probable |
|---|---|
| 2° harmónico (octava) | Soft clipping — transformador saturado o etapa analógica corriendo levemente caliente. Suena "cálido". |
| 3° harmónico (octava + quinta) | Hard clipping — limitador digital en techo, amplificador sobre límite térmico, driver excediendo excursión |
| Harmónicos impares crecientes (5°, 7°, 9°) | Distorsión de crossover en amplificador Clase B, o suspensión no-lineal del driver |
| Piso de ruido broadband creciente con señal | Piso de ruido dependiente de señal — bucle de tierra o fuente de alimentación mal diseñada |

**Relevancia para voz hablada:** La distorsión es especialmente destructiva para la inteligibilidad del habla. La región de presencia de 1–4 kHz, que porta las consonantes que hacen comprensible el habla, es extremadamente sensible a la distorsión harmónica. Incluso 3% THD en esta región reduce notablemente la inteligibilidad para asistentes con pérdida auditiva.

**Tabla diagnóstica:**

| Resultado | Diagnóstico |
|---|---|
| THD+N < 0.5% al nivel operacional | Limpio. Proceder. |
| THD+N 0.5–2%, 2° harmónico dominante | Etapa analógica ligeramente sobrecargada — reducir ganancia 3–6 dB |
| THD+N > 2%, 3° harmónico dominante | Hard clipping — encontrar etapa sobrecargada y reducir ganancia significativamente |
| THD+N crece abruptamente en HF | Driver distorsionando — cerca del límite de excursión o límite térmico de bobina |
| Distorsión presente incluso en niveles bajos | Bucle de tierra, interferencia RF, o componente defectuoso en la cadena |

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

| Fuente | Característica espectral | Diagnóstico |
|---|---|---|
| Acoplamiento capacitivo (cables paralelos) | Crece con la frecuencia | Cables demasiado juntos o sin blindaje |
| Acoplamiento inductivo | Varía con geometría | Cables sin blindaje cerca de transformadores |
| Error de ruteo de consola | Plano | Asignación de aux o grupo duplicando señal |
| Separación interna de amplificador | Plano | Amplificador estéreo con separación insuficiente |
| Acoplamiento mecánico | Picos en resonancias | Gabinetes de altavoces montados en la misma estructura |

**Relevancia para voz hablada estéreo:** En una configuración PA estéreo para conferencia, un orador posicionado en el escenario izquierdo físicamente proyecta su voz principalmente hacia la mitad izquierda de la audiencia. Si el sistema tiene diafonía severa, las diferencias de nivel y EQ cuidadosamente elaboradas entre canales colapsan, y la claridad espacial del sistema se pierde.

**Versión con sweep de frecuencias:** La diafonía como función de la frecuencia revela:
- **Diafonía creciente con frecuencia:** Acoplamiento capacitivo entre cables
- **Diafonía plana a través de frecuencias:** Acoplamiento resistivo — existe una conexión física entre canales que no debería estar
- **Diafonía solo en frecuencias específicas:** Resonancia mecánica entre gabinetes de altavoces

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

| Margen | Diagnóstico |
|---|---|
| > 12 dB | Excelente. El sistema tiene headroom amplio para el evento. |
| 6–12 dB | Adecuado. Estándar para la mayoría de eventos en vivo. Aplicar uno o dos notches preventivos. |
| 3–6 dB | Marginal. El sistema está cerca del límite. El posicionamiento del micrófono o el ángulo del PA necesitan ajuste antes del evento. |
| < 3 dB | Peligroso. No proceder sin cambios físicos — posición del micrófono, ángulo del monitor, o dirección del PA. |
| Múltiples frecuencias activándose simultáneamente | El patrón polar del micrófono apunta directamente al altavoz — toda la geometría es incorrecta. |

**Conexión con el Módulo 3.6:** Segmento R corre antes del evento en condiciones controladas. La frecuencia que identifica como la más vulnerable se convierte en el **objetivo de notch pre-cargado** en el módulo AFE. Cuando el monitor Centinela se activa durante el evento, ya conoce la frecuencia de problema más probable y puede reaccionar más rápido porque la está observando específicamente en lugar de escanear todo el espectro ciegamente.

**Timing:** ~12–15 segundos (solo mains) / ~35–45 segundos (mains + 2 monitores)

---

## 9. Duración de Cada Segmento y de la Suite Completa

### Breakdown de Timing por Segmento

| Código | Segmento | Duración | Notas |
|---|---|---|---|
| **V** | Path Audit | ~8s | Siempre el primero |
| **A** | Alignment Level | ~7s | Incluye L+R secuencialmente |
| **M** | Mic Profile Verification | ~20s | Sweep de 31 bandas |
| **N** | Noise Floor | ~15s | Ventana larga para precisión estadística |
| **F** | Frequency Response | ~30s | 3 promedios por posición |
| **P** | Phase & Coherence | ~50s (full) / ~25s (fast) | El segmento más largo de la suite |
| **T** | Time Alignment | ~5–22s | Varía con número de altavoces |
| **D** | Distortion THD+N | ~18s | Dos niveles, estéreo |
| **X** | Crosstalk | ~20s | Sweep de frecuencias completo |
| **R** | Feedback Margin | ~15–45s | Varía con número de monitores |

### Totales por Alcance

| Alcance | Secuencia | Duración Estimada |
|---|---|---|
| Sanity check rápido | `V A T R` | ~35 segundos |
| Pre-evento estándar | `V A M N F P T D R` | ~3 minutos |
| Comisionamiento completo | `V A M N F P T D X R I` | ~4–5 minutos |
| Con múltiples posiciones de medición | Suite completa × 3 posiciones | ~8–10 minutos |

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

## 11. Secuencias Compuestas Recomendadas

Las secuencias se escriben como strings de códigos, exactamente como el sistema Lindos:

| String | Nombre | Duración | Uso |
|---|---|---|---|
| `V A T R` | Quick Check | ~35s | Verificación rápida entre sets |
| `V A F R` | Fast Pre-Show | ~60s | 30 minutos antes del evento |
| `V A M N F P T D R` | Standard Pre-Event | ~3min | Setup estándar de evento |
| `V A M N F P T D X R` | Full Commission | ~4min | Comisionamiento de nueva instalación |
| `V A M N F P T D X R I` | Full + IR Capture | ~5min | Documentación completa con IR |
| `T R` | Between-Set Check | ~20s | Verificación entre presentadores |
| `F D` | EQ Verify | ~48s | Re-verificación post-corrección EQ |
| `R` | Ring Out Only | ~15s | Check de margen de feedback aislado |

---

## 12. Timeline Operativo Pre-Evento

```
T-60 min   Cargar JSON de configuración, puertas del venue cerradas
           ↓
           Correr V (path audit) — 8 seg
           Corregir cualquier fallo de cadena antes de continuar
           ↓
T-58 min   Correr A T (alineamiento + timing) — 12 seg
           Verificar que ajustes de delay coincidan con stage plot
           ↓
T-56 min   Correr M N (verificación de micrófono + piso de ruido) — 35 seg
           Confirmar perfil de micrófono correcto
           ↓
T-55 min   Correr F (respuesta en frecuencia) — 30 seg
           Revisar desviaciones mayores de la curva objetivo
           ↓
T-54 min   Correr P (fase y coherencia) — 50 seg
           Identificar posiciones de medición malas
           Ajustar Sweet Spot si es necesario
           ↓
T-52 min   Aplicar correcciones EQ sugeridas por Módulo 3.2
           Re-correr F para verificar — 30 seg
           ↓
T-51 min   Correr D (distorsión en dos niveles) — 18 seg
           Corregir estructura de ganancia si es necesario, re-correr D
           ↓
T-49 min   Correr X (diafonía) — 20 seg
           Verificar integridad de canales estéreo
           ↓
T-48 min   Correr R (margen de feedback, mains) — 15 seg
           Aplicar notches preventivos, registrar margen
           ↓
T-45 min   Correr R (monitores) si aplica — 15 seg por mix
           ↓
T-43 min   Correr I (captura IR) — 30 seg
           Exportar archivos de corrección a IndexedDB
           ↓
T-30 min   Monitor Centinela armado, evento comienza

Tiempo total de medición automatizada:    ~3 minutos
Tiempo total incluyendo respuesta del operador: ~15 minutos
Headroom restante antes del evento:       ~45 minutos para soundcheck
```

---

## 13. Ecualización por Respuesta al Impulso (IR EQ)

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

| Output | Formato | Latencia | Uso |
|---|---|---|---|
| A — IR Completa | WAV 32-bit float | N/A (offline) | Documentación, análisis externo, import en REW/Dirac |
| B — FIR de fase mínima | WAV / coeficientes raw | Near-zero | Convolución en vivo via AudioWorklet |
| C — EQ paramétrico | JSON (parámetros de banda) | N/A | Implementación en hardware físico vía Módulo 3.2 |

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

## 14. Arquitectura de Integración en la PWA

### Arquitectura del Sistema de Secuencia

```
┌─────────────────────────────────────────────────────────┐
│          ORCHESTRATOR DE SECUENCIA (Hilo JS Principal)   │
│  Parsea string de secuencia → despacha segmentos         │
│  Gestiona timing, inyección de tokens, agregación        │
└────────────────┬────────────────────────────────────────┘
                 │ Tokens SharedArrayBuffer (solo resultados)
     ┌───────────▼───────────┐      ┌────────────────────┐
     │  GENERADOR DE SEÑAL   │      │  MOTOR WASM DSP    │
     │  (AudioWorklet)       │─────▶│  FFT, THD, Fase,  │
     │  1. Síntesis header   │ FSK  │  Coherencia,       │
     │     FSK in-band       │ ac.  │  Delay finder,     │
     │  2. Señal de prueba   │ path │  Curva NC,         │
     │     del segmento      │      │  Deconvolución IR  │
     └───────────────────────┘      └────────┬───────────┘
                                             │ Resultados @ 20fps poll
                                    ┌────────▼───────────┐
                                    │  RESULT AGGREGATOR  │
                                    │  Pass/Fail + valores │
                                    │  → IndexedDB log    │
                                    │  → Sequence Report  │
                                    │  → Smart Toasts     │
                                    └────────────────────┘
```

### Integración con Módulos Existentes del DDS

| Módulo | Integración con APST |
|---|---|
| **3.1 Stage Plot** | Sweet Spot generator dicta la posición de medición para segmentos F, P, T. Segmento T valida la geometría del stage plot. |
| **3.2 Hardware Translation** | Los límites de tolerancia de segmento F se adaptan al inventario de EQ. La curva de desviación de F es el input del filtro de traducción de Módulo 3.2. |
| **3.3 Calibration Assistant** | APST reemplaza el loop manual "dicta el punto de medición" con ejecución automatizada de segmentos. |
| **3.5 Local RAG** | Fallos de segmento pueden disparar consultas RAG: si D falla con THD de 3° harmónico, el sistema consulta literatura sobre distorsión de crossover. |
| **3.6 AFE** | Segmento R cuantifica formalmente el headroom antes de que el monitor Centinela tome el control. La frecuencia vulnerable de R se pre-carga como objetivo de notch en AFE. |
| **3.7 Smart Toasts** | Los fallos de segmento generan toasts de Carril Rápido inmediatamente con la acción correctiva específica. |
| **3.8 Portability** | Los resultados de la secuencia se agregan al JSON exportado como array `calibrationLog`. La IR exportada por segmento I viaja junto con el JSON de configuración. |

### Schema de Reporte de Secuencia

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

### Flujo Operativo del Operador

```
Operador carga JSON de configuración
        ↓
Sistema sugiere: "¿Correr secuencia VAMNFPTDXR antes del soundcheck? (~3 min)"
        ↓
  [ Correr Suite Completa ]  [ Check Rápido VATR ]  [ Solo R ]  [ Omitir ]
        ↓
Operador coloca micrófono en Sweet Spot (mostrado en Stage Plot)
        ↓
Sistema corre segmentos automáticamente, uno por uno
Cada segmento:
  1. Genera header FSK in-band
  2. Transmite señal de prueba
  3. Detecta FSK en analizador → confirma cadena → mide
  4. Genera veredicto Pass/Fail
  5. Si FAIL → Smart Toast con corrección específica
        ↓
Resultado: "8/10 PASS — F y D requieren atención"
  → Toasts de Carril Rápido con correcciones EQ específicas
  → Operador resuelve → toca [ Re-correr F ] para verificar
        ↓
PASS completo → IR capturada y almacenada → Monitor Centinela activo → Evento comienza
```

---

## 15. Módulo §3.9 — Especificación para el DDS

Esta sección documenta el contenido que debe agregarse al Documento de Definición del Sistema como **§3.9 — Módulo de Secuencia de Prueba Automatizada (APST)**.

### §3.9.1 Descripción General

El Módulo APST implementa el paradigma de secuencia segmentada inspirado en el sistema Lindos, adaptado para operar íntegramente en el navegador a través de la cadena acústica física. Cada segmento de prueba está compuesto por un header FSK de 110 baudios transmitido in-band seguido por la señal de prueba específica. El header viaja por la cadena bajo prueba, eliminando la necesidad de canales de control separados y convirtiendo al FSK mismo en un instrumento de diagnóstico de la cadena de señal.

### §3.9.2 Biblioteca de Segmentos

Ver Sección 7 de este documento.

### §3.9.3 Arquitectura de Orquestación

Ver Sección 14, subsección "Arquitectura del Sistema de Secuencia".

### §3.9.4 Tabla de Tolerancias Pass/Fail

Las tolerancias se adaptan dinámicamente al inventario de EQ declarado en el Módulo 3.2: un EQ gráfico de 31 bandas recibe tolerancias más amplias (±4 dB) que un EQ paramétrico (±2 dB) porque su resolución de corrección es menor. Las tolerancias base son las documentadas en la Sección 7.

### §3.9.5 Schema del Reporte de Secuencia

Ver Sección 14, subsección "Schema de Reporte de Secuencia".

### §3.9.6 Integración con Módulos Existentes

Ver Sección 14, subsección "Integración con Módulos Existentes del DDS".

### §3.9.7 Implementación FSK en AudioWorklet/WASM

Ver Sección 5 de este documento.

### §3.9.8 Diagnóstico de Cadena de Señal por FSK

Ver Sección 6 de este documento.

### §3.9.9 Captura y Exportación de Respuesta al Impulso (Segmento I)

Ver Sección 13 completa de este documento.

---

*Documento generado como especificación técnica complementaria al DDS principal.*
*Versión: 1.0 | Proyecto: Plataforma PWA de Asistencia Proactiva para Calibración A/V*
