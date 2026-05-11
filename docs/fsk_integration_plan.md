# Plan de Integración: Secuencia de Calibración FSK (APST)

## Objetivo

Integrar la especificación de **Secuencia de Prueba FSK (Automated Proactive Sequence Testing - APST)** detallada en el documento `FSK_Secuencia_Calibracion_AV.md` dentro de la arquitectura formal del proyecto (DDS) y adaptar el Roadmap de desarrollo para acomodar este nuevo paradigma fundamental.

## Impacto Arquitectónico Central

La introducción del FSK cambia el paradigma del proyecto de ser una "herramienta de medición reactiva" (donde el usuario aprieta un botón y el sistema mide) a un **sistema de auditoría automatizada y secuencial**. 

El cambio más crítico es que **la sincronización viaja por el aire (in-band)**. El analizador (micrófono + DSP) no se comunica con el generador por variables de código, sino escuchando físicamente el tono FSK. Esto convierte a la cadena acústica completa en parte integral del protocolo de prueba, permitiendo diagnósticos de nivel de hardware antes imposibles (fallos de cable, polaridad, ruteo).

### [NUEVO] Calibración de Nodos Móviles Distribuidos

Como el FSK viaja acústicamente por el aire, **cualquier dispositivo corriendo la PWA** en la audiencia (ej. el celular de un  operador asistente) puede escuchar la secuencia de prueba que emite el PA y autocalibrarse. 

- Al escuchar el **Segmento A** (Tono de 1kHz a nivel nominal), el celular asume un SPL objetivo conocido en la sala y calibra su propio offset de micrófono, convirtiéndose en un sonómetro confiable.
- Al escuchar el **Segmento F** (Sweep), puede deducir la respuesta de su propia cápsula MEMS y aplicar una curva de compensación inversa.  
Esto permite tener "satélites" de medición de SPL e inteligibilidad (STI) distribuidos por toda la asamblea a costo cero.

### [NUEVO] Paradigma de Curva Objetivo (Separación In/Out)

- **Salida (PA Principal):** El AutoEq (Segmento F) calibrará el sistema general hacia una **Curva Neutral (Flat/Music Target)** para acomodar reproducción de video/música sin pérdida espectral.
- **Entrada (Micrófonos):** La curva de inteligibilidad "Spoken Word" (high-pass agresivo, realce de presencia) no se aplica al PA, sino que se gestiona como un *Input Channel Preset* (a ser inyectado vía OSC en la Fase 5 o aplicado manualmente por el operador).

## User Review Required

> [!WARNING]
> **Evolución del Proyecto (GAS + FSK)**  
> Originalmente el proyecto era 100% "Offline / Zero-Backend". Con tu confirmación, el proyecto evoluciona hacia una **Plataforma Colaborativa con Backend Serverless (GAS)**.
> - **Modos de Medición:** Convivencia del Wizard Automatizado y el Modo Interactivo (donde FSK es una herramienta elegible a voluntad, al igual que el Ruido Rosa o el Sweep).
> - **Sincronización (Offline-First):** El sistema guarda todo localmente (IndexedDB/LocalStorage) por defecto, siendo 100% funcional sin internet ni enlaces. Si posteriormente se vincula un backend GAS (`gas_id`), actúa como capa de sincronización en la nube subiendo el historial acumulado.  
> ¿Estás de acuerdo con cerrar el plan de integración con estos pilares y proceder a reescribir el Roadmap oficial?

## 1. Cambios Propuestos al DDS (`Definicion.md`)

Para no alterar la estructura base del DDS, se propone inyectar el FSK en las siguientes secciones:

### [NUEVO] Sección 3.9 — Módulo de Secuencia de Prueba Automatizada (APST)

Se agregará textualmente el contenido especificado en el documento FSK (Sección 15), definiendo:

- La biblioteca de segmentos ampliada (V, A, M, N, F, S, P, T, D, X, R, H). Se añaden los segmentos **S** (Sweep Lento de 20s para ecualización de alta resolución) y **H** (Headroom/Linealidad). **Nota:** El segmento X (Diafonía) será estrictamente opcional. Todas las secuencias deben iniciar obligatoriamente con un segmento de normalización (A o V) para que el analizador fije su ganancia de entrada. Además, el AutoEq exigirá el paso del segmento N (Ruido) para garantizar un SNR > 15dB; de lo contrario, rechazará la medición.
- La arquitectura de orquestación (Generador -> Aire -> Worklet con Goertzel -> Aggregator).
- **Direct Trigger Escape (El problema del Subwoofer):** Dado que la cabecera FSK (1650/1850 Hz) no puede atravesar subwoofers o filtros LPF, la orquestación debe incluir un modo de disparo interno directo (manual o temporizado) para calibrar subsistemas de bajas frecuencias.
- **Arquitectura de Procesamiento Híbrido (Real-Time vs Offline):** Para evitar dropouts (glitching) de audio en dispositivos de gama baja durante FFTs pesadas, el análisis de FSK utiliza un modelo híbrido automático por *Tier*. El `AudioWorklet` (tiempo real) detecta la cabecera FSK (trigger); luego, el audio crudo se graba en un buffer para ser procesado offline por un Web Worker, garantizando una precisión matemática impecable. Sin embargo, existirá un ajuste en la interfaz para empoderar al operador: "Automático (Por Tier)", "Forzar Tiempo Real (Feedback visual inmediato)" o "Forzar Offline (Máxima precisión y re-procesamiento)".
- El Schema del Reporte de Secuencia JSON.
- Protocolo de Calibración Móvil (Listen-Only Mode): Dispositivos secundarios que escuchan pasivamente los segmentos A y F del PA principal para autocalibrar sus cápsulas. **Una vez calibrado, este dispositivo puede utilizar cualquier otro método manual (Ruido Rosa, Sweep) y los resultados estarán compensados matemáticamente**, funcionando como un nodo de medición alternativo aunque no el principal.

### [NUEVO] Arquitectura de Modos de Operación (UX)

Se documentará formalmente cómo interactúa el operador con las distintas herramientas de medición:

**1. Wizard de Calibración Asistida (Por Defecto)**  
El flujo automatizado y guiado. Utiliza secuencias FSK orquestadas (ej. `V A M N F P T R`) y le dice al operador exactamente dónde pararse y qué mutear. 

- **Escape Hatch (Salida de Emergencia Segura):** En cualquier momento del Wizard, el usuario puede pausar el flujo, realizar una medición o ajuste manual con su método preferido (Ruido Rosa, Sweep, etc.), y luego **retomar el Wizard** exactamente donde lo dejó sin que el progreso se interrumpa.

**2. Modo de Calibración Manual (A Voluntad)**  
El operador experto tiene control total del entorno. Puede elegir entre:

- Ruido Rosa Continuo (para ajustes en tiempo real viendo el RTA).
- Sweep Logarítmico Manual.
- **FSK a Medida:** Puede componer y disparar su propia cadena de segmentos FSK en cualquier momento (ej. si solo quiere verificar Diafonía y Distorsión, escribe y dispara `X D`).

**3. Herramienta de Instalación: Testeador de Cables FSK**  
Antes de encender los altavoces, durante la fase de tirada de cables, la PWA puede usarse en un circuito cerrado (loopback). Conectando la salida a la entrada a través de un cable o manguera de escenario (snake), se lanzan los segmentos V, P y X para diagnosticar instantáneamente: continuidad, inversión de polaridad y cortocircuitos/diafonía. **Detección Binaria de Polaridad:** El Segmento P evaluará la fase a 1 kHz; si registra 180° o un primer impulso negativo, el sistema reportará un fallo explícito de "Pines 2 y 3 invertidos", convirtiendo la PWA en un tester de cables de grado avanzado.

**4. AutoEq Universal**  
Sin importar el método de recolección de datos elegido (Ruido Rosa, Sweep Manual, o Segmento F del FSK), el motor de **AutoEq siempre está disponible**. La matemática subyacente consume la curva capturada, sin importarle cómo se obtuvo, para generar las sugerencias de filtros.

### [MODIFICAR] Sección 4.3 — Asistente de Calibración

Se reescribirá el flujo operativo para reflejar la dinámica FSK basada en aislamiento, que varía según el subsistema:

**A. Flujo para PA + Delays:**

1. **Auditoría:** Segmento V por altavoz aislado.
2. **EQ (Segmento F):** Medición de Main y Delay aislados en sus respectivos Sweet Spots, buscando la Curva Neutral.
3. **Alineamiento (Segmento T):** Medición en zonas de transición (crossover acústico) reproduciendo primero Main, luego Delay, calculando el delta para alinear.
4. **Validación (Segmento P):** Medición de fase con ambos encendidos para detectar cancelaciones.

**B. Flujo para Monitores de Escenario:**

1. **Micrófono:** Se descarta el mic de medición omnidireccional. Se usa el **micrófono vocal real (cardioide)** en la posición exacta del orador.
2. **Prioridad de GBF:** El enfoque no es la "fidelidad". El **Segmento R (Ring Out)** es la herramienta principal para encontrar el margen de feedback y generar notches defensivos.

### [MODIFICAR] Sección 4.7.1 — Fast-Rail (Diagnóstico Rápido)

Se aclarará la barrera estricta entre medición activa y pasiva:

- **Pre-Show (Activo):** El sistema FSK dispara señales audibles para auditar hardware y configurar pre-requisitos (ej. encontrar la frecuencia de Ring Out con el Segmento R).
- **Durante el Evento (Pasivo):** El FSK **NUNCA** se emite durante el programa. El Fast-Rail opera puramente escuchando la señal del evento, pero **se nutre de los datos previos del FSK**. (Ej: El Fast-Rail sabe exactamente en qué frecuencia buscar el acople porque el Segmento R FSK ya se lo informó antes de que llegue la audiencia).

### [NUEVO] Evolución Arquitectónica: Integración Backend GAS

Se documentará la alternativa tanto de un sistema puramente local (IndexedDB) o un **Ecosistema Colaborativo respaldado por Google Apps Script (GAS)**. Esta integración potenciará todas las etapas del proyecto:

**1. Sincronización Global (Todas las fases):**

- **Planificación:** El Stage Plot y la topología se guardan en GAS, permitiendo que cualquier dispositivo del equipo cargue el evento.
- **Auditoría FSK:** Al finalizar la secuencia pre-show, el reporte detallado (Schema JSON) y los perfiles de AutoEq se suben automáticamente al GSheet para registro histórico.
- **Portabilidad:** Se elimina la dependencia estricta de descargar archivos `.json` a mano; el `gas_id` actúa como la llave maestra del evento.

**2. Módulo de Telemetría Distribuida (En Vivo):**

- **El Concepto:** Visualización de un "Mapa de Calor" (Heatmap) en el Dashboard del Operador Principal que muestra los niveles de presión sonora (SPL) e inteligibilidad (STI) en distintas zonas del predio.
- **Flujo Operativo (Simple y Robusto):**
  1. El Operador indica a su equipo técnico tomar muestras en zonas específicas (ej. Zona C3).
  2. Los técnicos, con sus dispositivos previamente calibrados vía FSK, se ubican en la zona y aprietan "Capturar".
  3. El dispositivo captura y analiza 10 segundos de audio. Si está vinculado a GAS, hace un único `POST` silencioso con los resultados; si no, queda en el log local.
  4. El Operador aprieta "Actualizar Mapa" en su dashboard para renderizar los datos recopilados.
- **Ventajas:** Cero polling continuo de red, cero riesgo de saturar la cuota de Google, y tolerancia total a la desconexión (si no hay internet, la muestra se guarda localmente hasta tener señal).

---

## 2. Cambios Propuestos al Roadmap (`roadmap.md`)

El paradigma FSK segmenta el trabajo. En lugar de hacer todo el DSP en la Fase 1, lo distribuiremos:

### Fase 1 Redefinida: "Protocolo FSK y Secuencia Base"

- **Objetivo:** Orquestador APST funcional con Tx/Rx de FSK y diagnósticos vitales.
- **Nuevos Componentes:**
  - Motor de Playback FSK (Ensamblaje Offline por Descarga: El sistema descarga los assets/fragmentos de sonido pregrabados -exclusivamente en formato FLAC para garantizar compresión sin pérdida en el sample rate nativo- y los ensambla/concatena localmente en memoria usando `OfflineAudioContext` para generar el buffer final de la secuencia. Este resultado queda en caché para su uso directo, evitando síntesis en tiempo real. Adicionalmente, las secuencias de uso más frecuente, como la del Wizard, podrán estar pre-generadas completamente en archivos FLAC listas para descargar).
  - Detector Goertzel en el `AudioWorkletProcessor` (Tx/Rx in-band).
  - Orquestador de Secuencia JS (parser de strings para armar rutinas como el Wizard por defecto `V A M N F P T R`).
  - Implementación de **la librería completa de Segmentos Base** requeridos para el flujo automatizado (V, A, M, N, F, S, P, T, R, H), tal como lo define la especificación.

### Catálogo de Secuencias Pre-Generadas (Assets)

Para optimizar el rendimiento y evitar el ensamblaje offline en el 90% de los casos de uso, el servidor de la PWA alojará las siguientes rutinas completas como archivos `.flac` estáticos listos para descargar y reproducir:

- **Wizard Base (`V A M N F P T D R`):** Calibración automatizada estándar (~3 min).
- **Fast Check (`V A T R`):** Diagnóstico rápido pre-show para validar cableado y delays (~35s).
- **Tuning de Monitores (`V A R`):** Rutina corta enfocada en encontrar la frecuencia de acople en el escenario (~20s).
- **Alineamiento de Subsistemas (`V P T`):** Enfoque estricto en fase y tiempo de llegada para arreglos con delay (~30s).
- **AutoEq Máster (`V A M N S P`):** Utiliza el Segmento S (Sweep de 20s) para ecualizaciones críticas y sistemas FIR de alta resolución.
- **Auditoría de Headroom (`V H`):** Chequeo de protección que evalúa la linealidad del sistema antes de que ocurra clipping audible.
- **Comisionamiento Completo (`V A M N F P T D X R I`):** Secuencia de instalación profunda que suma prueba de diafonía y extracción de IR (~5 min).  
El motor de ensamblaje JS solo actuará cuando el operador componga una secuencia "a medida" en el Modo Manual, o cuando se requiera el **Direct Trigger Escape** para subwoofers que no pueden reproducir la cabecera FSK aguda.

### Impacto en Fases Posteriores

- **Fase 3 (Alertas y Diagnóstico):** Se nutrirá fuertemente de los diagnósticos de fallo del FSK (Latencia excesiva, Mismatch estéreo, Clipping). Además, aquí se habilitará el **"Listen-Only Mode"** para que dispositivos móviles (Tier 0/1) puedan usarse como medidores de SPL distribuidos en la audiencia, autocalibrados mediante el Segmento A.
- **Fase 4 (Planificación / Stage Plot):** Aquí se implementará el **Segmento T** (Time Alignment / Delay Finder) y la Extracción IR (**Segmento I**), ya que se correlaciona con la geometría de la sala.
- **Fase 5 (Control de Consola):** Aquí se sumará el **Segmento R** (Feedback Margin / Ring Out), ya que el AFE necesita interactuar con los faders de la consola.

## Próximos Pasos sugeridos

1. Aprobar este plan de integración.
2. Autorizarme a modificar el `docs/Definicion.md` y `docs/roadmap.md` reales del repositorio para inyectar estos cambios.
3. Volver a generar los Prompts de la Fase 1, esta vez enfocados en construir el **Generador FSK, el filtro Goertzel en WASM/Worklet y el Segmento V (Path Audit)**.