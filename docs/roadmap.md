# Roadmap de implementación — Asistente de audio y video para asambleas

Cada fase produce un entregable funcional que se puede usar y testear independientemente. Las fases se construyen sobre las anteriores.

**Principio de priorización:** Primero que suene → después que mida → después que explique → después que alerte → después que recuerde → después que controle.

### Desarrollo Dual: PWA + Tauri (Transversal)
El proyecto produce **dos targets desde el mismo código** en todas las fases:
- **PWA (Web):** `npm run build` → archivos estáticos desplegados en `entrerios2.github.io/asistente`
- **Nativo (Tauri):** `cargo tauri build` → ejecutable `.exe` / `.app` con acceso ASIO, archivos locales y VRAM sin restricciones.

La separación se logra mediante un **HAL (Hardware Abstraction Layer)** establecido en Fase 0. Toda la lógica de negocio y DSP es agnóstica al entorno; solo las implementaciones de captura, archivos y red cambian.

```
asistente/
├── src/                    ← Svelte 5 (UI compartida)
│   └── lib/
│       ├── hal/            ← Capa de abstracción (interfaces)
│       │   ├── types.ts    ← AudioProvider, AudioListener
│       │   ├── web/        ← Impl: Web Audio API + AudioWorklet
│       │   └── tauri/      ← Impl: invoke() → Rust/cpal/ASIO
│       ├── dsp/            ← Motor DSP puro (consume HAL)
│       └── utils/          ← Tier detector, helpers
├── tools/
│   └── apst-builder/      ← CLI Node/TS para generar FLAC de secuencias
├── src-tauri/              ← Backend Rust (cpal, OSC nativo, mDNS, fs)
├── static/
├── vite.config.ts          ← base: '/asistente/'
└── docs/
```

### Alineación con Bloques UX (`Organizacion_interfaz.md`)

| Bloque UX | Áreas | Fases que lo alimentan |
|:----------|:------|:----------------------|
| **Planificación** | Sistema, Inventario, Locales, Eventos | Fase 4 + Fase 6 |
| **Instalación y puesta a punto** | Armado, Herramientas, Calibración | Fase 1A + 1B + Fase 3 (parcial) |
| **Operación** | Referencia, Copiloto | Fase 2 + Fase 3 + Fase 5 |

---

## Fase 0 — Fundación, Scaffolding y HAL ✅ (Parcial)
**Objetivo:** Proyecto dual-target funcional con captura de audio y visualización básica.
**Estado:** Scaffolding, HAL y UI completados. Quedan deudas técnicas → Pre-Fase.

### Componentes completados

| Tarea | Estado |
|:------|:------:|
| Proyecto Svelte 5 + Vite + TypeScript + TailwindCSS v4 | ✅ |
| Tauri v2 backend Rust (`cargo tauri init`) | ✅ |
| HAL: interfaces (`AudioProvider`, `AudioListener`) | ✅ |
| HAL impl Web (`WebAudioProvider.ts`) | ✅ |
| HAL impl Tauri (`TauriAudioProvider.ts`, stub) | ✅ |
| HAL Factory (detección automática de entorno) | ✅ |
| Canvas RTA (magnitud vs frecuencia) | ✅ |
| Detección de Tier (0/1/2) | ✅ |
| PWA (`vite-plugin-pwa`, manifest, Service Worker) | ✅ |
| Headers COOP/COEP para SharedArrayBuffer | ✅ |

### Deudas técnicas (→ Pre-Fase)

| Tarea | Nota |
|:------|:-----|
| Motor FFT independiente (WebFFT o `fft.js` en TS) | Actualmente usa `AnalyserNode` nativo, violando el patrón HAL |
| `dsp/Analyzer.ts` (clase que consume HAL, no Web Audio directo) | No existe |
| Generador de Ruido Rosa funcional | Interfaz definida pero sin implementación |
| Deploy pipeline a GitHub Pages | No configurado |

---

## Pre-Fase — Cierre de Deudas F0 + APST Builder
**Objetivo:** Cerrar las deudas técnicas de Fase 0 y producir los assets de prueba FLAC.
**Depende de:** Fase 0 (parcial)

### Componentes

| Tarea | Sección DDS | Target | Complejidad |
|:------|:----------:|:------:|:-----------:|
| Motor FFT independiente (`fft.js` o impl TS pura) | 2.2 | Ambos | 🟡 |
| `dsp/Analyzer.ts`: migrar análisis de `AnalyserNode` al motor FFT propio | 2.2, 2.4 | Ambos | 🟡 |
| Generador de Ruido Rosa funcional (vía HAL) | 4.3.2 | Ambos | 🟢 |
| Deploy pipeline a `entrerios2.github.io/asistente` | — | PWA | 🟢 |
| **APST Builder** (CLI Node/TS): genera FLAC con cabeceras FSK HF/LF a 44.1/48/96 kHz | 2.5 | Ambos | 🟡 |
| **Selección de dispositivo de audio** (multi-backend: WASAPI Shared/Exclusive, ASIO, CoreAudio) | 2.4 | Nativo | 🟡 |
| **UI DeviceSelector** (dropdown agrupado por backend con badges, entrada + salida) | 2.4 | Nativo | 🟡 |

> **APST Builder:** Utilidad de línea de comandos en Node.js/TypeScript que pre-renderiza las secuencias acústicas y cabeceras FSK como archivos `.flac` lossless. La lógica de síntesis (tonos, sweeps, FSK encoding) es reutilizable en el browser para generación en tiempo real futura (Tier 2). Ver especificación completa en [Protocolo APST §2.5](./Protocolo_APST.md).

### Criterios de Aceptación
- [x] El RTA funciona con el motor FFT propio (sin `AnalyserNode`)
- [x] El código DSP no importa Web Audio API directamente (solo HAL)
- [x] El Ruido Rosa suena limpio por los altavoces
- [x] La PWA se despliega y es instalable desde `entrerios2.github.io/asistente`
- [x] El APST Builder genera los 12 segmentos atómicos + 7 secuencias compuestas en FLAC
- [x] En Tauri, el selector de dispositivos enumera todas las interfaces de audio disponibles (WASAPI, ASIO si hay drivers) y permite seleccionar entrada/salida independientemente

---

## Fase 1A — Infraestructura de Medición y APST Core
**Objetivo:** El sistema reproduce secuencias FSK, detecta cabeceras Goertzel y ejecuta segmentos de medición.
**Depende de:** Pre-Fase

### Componentes

| Tarea | Sección DDS | Complejidad |
|:------|:----------:|:-----------:|
| Motor de Playback FSK (reproducción FLAC, selección automática por sample rate) | 4.13 | 🟡 |
| Detector Goertzel en AudioWorklet (bancos HF 1650/1850 Hz y LF 150/200 Hz) | 4.13, 2.2 | 🟡 |
| Orquestador de secuencias (parser de cadenas `V A F P`, máquina de estados) | 4.13 | 🟡 |
| Segmentos `V`, `A`, `N`, `F`, `P`, `T` | 4.13 | 🟡 |
| Modelo Híbrido Real-Time/Offline Buffer (según Tier) | 2.2 | 🟡 |
| Función de Transferencia dual-canal (Magnitud + Fase + Coherencia) | 4.3.2 | 🔴 |
| Integración Meyda.js para descriptores acústicos | 2.3 | 🟢 |
| Testeador de Cables (modo Loopback: `V P` sin altavoces) | 4.13 | 🟢 |

### Criterios de Aceptación
- [ ] La PWA reproduce una secuencia FLAC y el Goertzel detecta la cabecera FSK
- [ ] El orquestador ejecuta `V A N F P` de principio a fin
- [ ] El segmento `P` detecta correctamente una inversión de polaridad simulada
- [ ] La Función de Transferencia calcula magnitud, fase y coherencia
- [ ] El modo Loopback verifica continuidad de un cable en circuito cerrado

---

## Fase 1B — Calibración Interactiva y AutoEq
**Objetivo:** El operador ve su medición, la compara con la curva objetivo y recibe sugerencias de EQ.
**Depende de:** Fase 1A

### Componentes

| Tarea | Sección DDS | Complejidad |
|:------|:----------:|:-----------:|
| Curva Objetivo plana con parámetros editables (±3 dB, roll-offs opcionales) | 4.3.1 | 🟢 |
| Motor AutoEq: derivación de filtros PEQ (cortes prioritarios) | 4.3.3 | 🔴 |
| Trace Math Visualizer (3 capas: Medición + Filtro + Predicted) | 4.3.3 | 🟡 |
| Gráfico de Coherencia ("Semáforo") como gate del AutoEq | 4.7.1 | 🟡 |
| Alineamiento Temporal (Fase Desenrollada) | 4.3.2 | 🟡 |
| STI-Estimado desde IR | 4.3.2 | 🟡 |
| Snapshot Antes/Después + Auditoría STI-Est | 4.3.2 | 🟢 |
| Perfiles Genéricos de Seguridad (Agnóstico A/B/Desconocido) | 4.1 | 🟡 |
| Generador de Log Sweep manual (modo no-FSK) | 4.3.2 | 🟡 |

### Criterios de Aceptación
- [ ] El Trace Math muestra 3 capas superpuestas con respuesta predicha
- [ ] AutoEq sugiere filtros que nunca exceden los límites de seguridad
- [ ] El Semáforo de Coherencia bloquea sugerencias donde coherencia < 50%
- [ ] En modo Agnóstico B (mic vocal), tolerancia ±6 dB y boosts prohibidos

---

## Fase 2 — Motor Semántico (Copiloto IA)
**Objetivo:** El copiloto entiende lenguaje natural, explica sus sugerencias y educa al operador novato.
**Depende de:** Fase 1B

### Componentes

| Tarea | Sección DDS | Complejidad |
|:------|:----------:|:-----------:|
| RAG: vectorización del corpus + búsqueda por similitud | 4.5 | 🟡 |
| Corpus RAG: fragmentación de fuentes primarias | 4.5.1 | 🟡 |
| LLM local: Transformers.js + WebGPU (Tier 2) | 2.0 | 🔴 |
| LLM CPU: ONNX Runtime Web (Tier 1) | 2.0 | 🟡 |
| Ecualización Semántica ("suena encajonado" → PEQ) | 4.4 | 🟡 |
| UX Adaptativa: niveles Básico/Intermedio/Avanzado | 4.9 | 🟡 |
| Tiered Prompts (mensajes adaptativos por nivel de usuario) | 4.9 | 🟢 |
| Glosario Contextual vinculado al RAG | 4.9 | 🟢 |
| Tutorial Introductorio de Sonido en Vivo | 4.9 | 🟡 |
| Plantillas estáticas pre-compiladas para Tier 0 | 2.1 | 🟢 |

### Criterios de Aceptación
- [ ] "¿Por qué suena nasal?" genera una respuesta coherente con sugerencia de EQ
- [ ] El RAG recupera fragmentos relevantes del corpus técnico
- [ ] En Tier 0 (sin IA), las plantillas estáticas cubren los diagnósticos comunes

---

## Fase 3 — Diagnóstico en Vivo (Fast-Rail + AFE)
**Objetivo:** Dashboard de operación con alertas inteligentes en tiempo real.
**Depende de:** Fase 1A + Fase 2

### Componentes

| Tarea | Sección DDS | Complejidad |
|:------|:----------:|:-----------:|
| Algoritmo AFE: detección de feedback (crecimiento + tonalidad) | 4.6.1 | 🟡 |
| Fast-Rail: 5 heurísticas (feedback, clipping, proximidad, sibilancia, caja) | 4.7.1 | 🟡 |
| Smart Toasts con Indicador de Confianza (🟢/🟡/🔴) | 4.7.1 | 🟡 |
| Health Score (1-10) en el dashboard | 4.7.1 | 🟢 |
| Carril Semántico para diagnósticos complejos | 4.7.1 | 🟡 |
| Waterfall Plot (2D Tier 0, 3D Tier 2) | 4.7.1 | 🟡 |
| Monitoreo SPL opcional | 4.7.1 | 🟢 |
| Botón de Pánico | 4.8.2 | 🟢 |
| Macro-Perfiles de Orador (One-Tap) | 4.10 | 🟢 |
| Detector de Técnica de Micrófono | 4.10 | 🟡 |
| Segmento `R` (Ring-Out con mic vocal real) | 4.13 | 🟡 |
| Modo Ensayo / Rehearsal Mode + Cheat Sheet | 4.3.2b | 🟢 |
| Promediado Espacial Multi-punto (medición guiada) | 4.3.2a | 🟡 |

### Criterios de Aceptación
- [ ] Un acople simulado dispara un Smart Toast en < 200ms
- [ ] El Health Score refleja el estado real del sistema
- [ ] El Botón de Pánico funciona (pantalla completa sin OSC)

---

## Fase 4 — Planificación Espacial, Persistencia y Modelo de Datos
**Objetivo:** Stage Plot MVP + entidades Inventario/Local/Evento + Venue Memory.
**Depende de:** Fase 1B

### Componentes

| Tarea | Sección DDS | Complejidad |
|:------|:----------:|:-----------:|
| **Modelo de datos: Inventario** (catálogo de activos, estados, metadatos) | 4.1.3 | 🟡 |
| **Modelo de datos: Local** (Árbol de Zonas, diseño geométrico reutilizable) | 4.1.3 | 🟡 |
| **Modelo de datos: Evento** (Local + Inventario, reservas, validación) | 4.1.3 | 🟡 |
| Stage Plot: lienzo Canvas con sala rectangular + posiciones XY | 4.1 | 🟡 |
| Árbol de Zonas aditivo (zona raíz + zonas hijas con inclinación) | 4.1.2 | 🟡 |
| Cálculo RT60 (Sabine) | 4.1 | 🟢 |
| Modos de Sala | 4.1 | 🟢 |
| Reglas Geométricas (3:1, Inversa del Cuadrado, Mic/Monitor) | 4.1 | 🟡 |
| Delays multi-altavoz compensados por temperatura | 4.1 | 🟢 |
| Generador de Sweet Spots | 4.1 | 🟢 |
| Importación CLF (.clf / .cf2) + Aproximación Paramétrica (fallback) | 4.1 | 🟡 |
| Persistencia IndexedDB (Nivel 1: local puro) | 2.6 | 🟡 |
| Exportar/Importar JSON (`AvSetupPayload` con schema draft-07) | 4.8.1 | 🟡 |
| Venue Memory: historial indexado por recinto | 4.12 | 🟡 |
| Reporte Post-Evento (PDF vía jsPDF) | 4.8.3 | 🟡 |
| Modo de Emergencia (PDF + QR) | 4.8.2 | 🟢 |

### Criterios de Aceptación
- [ ] Se puede diseñar una sala, posicionar equipos y calcular delays
- [ ] Las reglas geométricas disparan advertencias proactivas
- [ ] Un payload exportado se importa correctamente en otra instancia
- [ ] Al volver a un recinto, el sistema ofrece cargar la calibración anterior

---

## Fase 5 — Telemetría y Control de Consola
**Objetivo:** Integración bidireccional con consolas + Guía A/V + backend GAS opcional.
**Depende de:** Fase 3

### Componentes

| Tarea | Sección DDS | Complejidad |
|:------|:----------:|:-----------:|
| Cliente OSC bidireccional (enviar/recibir) | 4.2 | 🟡 |
| Web MIDI API para consolas USB | 4.2 | 🟡 |
| HAL: interfaz de telemetría | 2.4 | 🟡 |
| Gemelo Digital: lectura de estado (mutes, faders, EQ, meters) | 4.2 | 🟡 |
| Niveles de Autorización (Estricto / Semiautomático) | 4.2 | 🟢 |
| Undo/Rollback OSC (Snapshot de Canal) | 4.2 | 🟡 |
| Auto-descubrimiento mDNS (Tauri) | 4.2 | 🟡 |
| Modo Centinela: monitoreo pasivo + triage dirigido via Solo | 4.6.2 | 🔴 |
| Gain Staging Wizard (con y sin telemetría) | 4.7.2 | 🟡 |
| Hardware Wizard: checklist pre-vuelo + loopback | 4.7.2 | 🟡 |
| Guía de A/V: ingesta JSON + timeline + alertas mute/unmute | 4.11 | 🟡 |
| Suspensión AFE en secciones de video | 4.11 | 🟢 |
| Integración GAS opcional (Nivel 3 de persistencia) | 2.6 | 🟡 |
| Telemetría Distribuida: mapa de calor SPL/STI | 4.14 | 🟡 |
| Calibración Distribuida (Listen-Only Mode) | 4.13 | 🟡 |

### Criterios de Aceptación
- [ ] La app lee los meters de una X32 en tiempo real
- [ ] Un comando OSC enviado se puede deshacer
- [ ] La Guía de A/V alerta si un mic está muteado cuando debería estar activo
- [ ] El mapa de calor muestra datos de nodos calibrados distribuidos

---

## Fase 6 — Simulación Avanzada e Integración SPA (Futuro)
**Objetivo:** Predicción acústica sin encender el sistema de sonido.
**Depende de:** Todas las fases anteriores

> **Nota:** Esta fase es aspiracional y no forma parte del MVP ni del roadmap comprometido.

### Componentes potenciales
- Motor de Simulación Nivel 2 (cobertura por bandas de octava)
- Motor de Simulación Nivel 3 (reflexiones tempranas ISM, ≤ 5 rebotes)
- Ciclo de Autocorrección (Simulación v1 → Medición → Ajuste → Simulación v2)
- Importación GLL con dispersión 3D
- Mapeo SPL con isobáricas + detección visual de Comb Filtering
- Integración bidireccional con la SPA de Gestión AV (§9 del DDS)

---

## Diagrama de Dependencias

```mermaid
graph TD
    F0["Fase 0 ✅<br/>(Scaffolding + HAL)"]
    PF["Pre-Fase<br/>(Deudas F0 + APST Builder)"]
    F1A["Fase 1A<br/>APST Core + DSP<br/>(FSK + Goertzel + TF)"]
    F1B["Fase 1B<br/>Calibración Interactiva<br/>(AutoEq + Trace Math)"]
    F2["Fase 2<br/>Copiloto IA<br/>(RAG + LLM + UX)"]
    F3["Fase 3<br/>Diagnóstico en Vivo<br/>(Fast-Rail + AFE)"]
    F4["Fase 4<br/>Planificación + Persistencia<br/>(Stage Plot + Inv/Local/Evento)"]
    F5["Fase 5<br/>Telemetría + Consola<br/>(OSC + GAS + Guía A/V)"]
    F6["Fase 6<br/>Simulación Avanzada<br/>(ISM + GLL + SPA)"]

    F0 --> PF
    PF --> F1A
    F1A --> F1B
    F1B --> F2
    F2 --> F3
    F1A --> F3
    F1B --> F4
    F3 --> F5
    F4 --> F6
    F5 --> F6
```

---

## Resumen Ejecutivo

| Fase | Entregable | Módulos DDS | Bloque UX | Principio |
|:----:|:-----------|:------------|:----------|:----------|
| **0** ✅ | Scaffolding + HAL + RTA básico | 2.0, 2.1, 2.4 | — | Que suene |
| **Pre** | Motor FFT propio + Ruido Rosa + APST Builder CLI | 2.2, 2.5 | — | Que suene (cierre) |
| **1A** | Orquestador APST funcional + TF dual-canal | 2.2, 2.3, 4.13 | Calibración | Que mida (FSK) |
| **1B** | AutoEq + Trace Math + STI-Est | 4.3, 4.7.1 | Calibración | Que mida (interactivo) |
| **2** | Copiloto conversacional con IA | 4.4, 4.5, 4.9 | Referencia | Que explique |
| **3** | Dashboard con alertas en tiempo real | 4.6, 4.7, 4.10 | Copiloto | Que alerte |
| **4** | Stage Plot + Inventario/Local/Evento + Persistencia | 4.1, 4.1.3, 4.8, 4.12 | Planificación | Que recuerde |
| **5** | Control de consola + GAS + Telemetría | 4.2, 4.11, 4.14, 2.6 | Operación | Que controle |
| **6** | Simulación predictiva avanzada + integración SPA | 4.1 (full), 9 | Planificación+ | Que prediga |
