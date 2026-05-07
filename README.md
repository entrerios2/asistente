# 🎙️ Asistente de Audio Proactivo

Copiloto acústico inteligente para operadores de sonido en asambleas. Analiza, diagnostica y guía en tiempo real — sin servidores, sin internet, sin enviar datos a ningún lado.

## Qué hace

- **Mide** la respuesta acústica de la sala (RTA, FFT dual-canal, STI Estimado)
- **Calibra** el sistema de sonido con sugerencias de ecualización seguras (AutoEq)
- **Alerta** de problemas en vivo: acoples, saturación, sibilancia, técnica de micrófono
- **Explica** cada sugerencia en lenguaje coloquial para operadores sin experiencia
- **Recuerda** calibraciones anteriores por recinto (Venue Memory)
- **Controla** consolas digitales vía OSC/MIDI con undo automático

## Arquitectura

```
100% Client-Side — Zero Backend — Offline-First
```

| Capa         | Tecnología                               |
| :----------- | :--------------------------------------- |
| UI           | Svelte 5 + Canvas API                    |
| DSP          | WebFFT (WASM) + AudioWorklet             |
| IA Local     | Transformers.js (WebGPU) + RAG vectorial |
| Telemetría   | OSC (red) / Web MIDI (USB)               |
| Persistencia | IndexedDB + JSON Schema                  |

### Dos targets, un código

| Target             | Comando             | Salida                                                |
| :----------------- | :------------------ | :---------------------------------------------------- |
| **PWA (Web)**      | `npm run build`     | Archivos estáticos → `entrerios2.github.io/asistente` |
| **Nativo (Tauri)** | `cargo tauri build` | `.exe` / `.app` con ASIO y acceso directo a hardware  |

La separación se logra mediante un **HAL (Hardware Abstraction Layer)** que abstrae la captura de audio, archivos y red. El motor DSP y la lógica de negocio son idénticos en ambos entornos.

```
asistente/
├── src/                    ← Svelte 5 (UI compartida)
│   └── lib/
│       ├── hal/            ← Interfaces de abstracción
│       │   ├── audio.ts    ← captureAudio(), playPinkNoise(), getFFT()
│       │   ├── web.ts      ← Impl: Web Audio API + AudioWorklet
│       │   └── tauri.ts    ← Impl: invoke() → Rust/cpal/ASIO
│       └── dsp/            ← Motor DSP puro (agnóstico al entorno)
├── src-tauri/              ← Backend Rust (cpal, OSC, mDNS)
├── static/
├── docs/
│   ├── Definicion.md       ← DDS (fuente de verdad técnica)
│   └── roadmap.md          ← Roadmap de fases
└── vite.config.ts
```

## Roadmap

| Fase  | Principio    | Entregable                               |
| :---: | :----------- | :--------------------------------------- |
| **0** | Que suene    | PWA + Tauri con RTA funcional + HAL      |
| **1** | Que mida     | Calibración (FFT + AutoEq + STI)         |
| **2** | Que explique | Copiloto IA (RAG + LLM + UX adaptativa)  |
| **3** | Que alerte   | Diagnóstico en vivo (Fast-Rail + AFE)    |
| **4** | Que recuerde | Stage Plot + persistencia + Venue Memory |
| **5** | Que controle | Telemetría OSC/MIDI + Guía de A/V        |
| **6** | Que prediga  | Simulación acústica avanzada             |

Detalle completo en [`docs/roadmap.md`](docs/roadmap.md).

## Documentación

- **[Definición del Sistema (DDS)](docs/Definicion.md)** — Arquitectura, módulos, protocolos y reglas de intervención
- **[Roadmap](docs/roadmap.md)** — Fases de implementación con dependencias y criterios de aceptación

## Requisitos

### PWA (Web)
- Navegador con soporte AudioWorklet + SharedArrayBuffer (Chrome, Edge, Safari 15.4+)
- Micrófono de medición (condensador omnidireccional recomendado)

### Nativo (Tauri)
- [Rust](https://rustup.rs/) + [Node.js](https://nodejs.org/) 18+
- Windows 10+ / macOS 12+
- Driver ASIO (opcional, para latencia cero)

## Licencia

Por definir.
