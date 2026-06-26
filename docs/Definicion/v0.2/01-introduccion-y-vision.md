# 1. Introducción y Visión del Sistema

---

## 1.1. ¿Qué es?

**Asistente de audio y video para asambleas** es un copiloto acústico inteligente diseñado para operadores de sonido en eventos en vivo (asambleas, conferencias, conciertos). Es una aplicación 100% client-side, offline-first, que funciona como PWA en el navegador o como aplicación nativa de escritorio vía Tauri.

El sistema mide la acústica de la sala en tiempo real, calibra sistemas de sonido con sugerencias de EQ seguras, alerta sobre problemas en vivo (realimentación, saturación, sibilancias), recuerda calibraciones anteriores por recinto, y explica sus sugerencias en lenguaje simple para operadores sin experiencia técnica profunda.

---

## 1.2. Propósito

El problema que resuelve: la calibración de sistemas de sonido en vivo requiere conocimiento especializado en acústica, procesamiento de señales y diseño de sistemas de sonido. La mayoría de los operadores de sonido en eventos pequeños y medianos no tienen esta formación. El sistema actúa como un "copiloto" que:

1. **Mide** la respuesta acústica del recinto en tiempo real
2. **Analiza** usando DSP de alta calidad (FFT, función de transferencia, coeficiencia, respuesta al impulso)
3. **Recomienda** ajustes de EQ, delays, niveles y posicionamiento
4. **Alerta** sobre problemas acústicos antes de que arruinen el evento
5. **Aprende** del recinto, guardando calibraciones anteriores para reutilizarlas
6. **Explica** en lenguaje natural por qué hace cada recomendación (futuro, Fase 2)

---

## 1.3. Principios de diseño

| Principio | Descripción |
|-----------|-------------|
| **Offline-first** | Todo el procesamiento ocurre en el dispositivo del usuario. Sin backend, sin conexión a internet requerida para operar |
| **Zero backend** | No hay servidores. La app es completamente autónoma. Los datos se almacenan en IndexedDB y localStorage |
| **Privacidad por diseño** | El audio nunca sale del dispositivo. No hay telemetría ni cuentas de usuario |
| **Degradación elegante** | Funciona en cualquier hardware, degradando capacidades semánticas (IA) pero nunca las de seguridad acústica (DSP) |
| **Latencia cero** | El procesamiento de audio usa AudioWorklet + SharedArrayBuffer para mínimo overhead |
| **Dual target** | Misma base de código para Web (PWA) y escritorio nativo (Tauri) |

---

## 1.4. Público objetivo

| Perfil | Necesidad | Cómo lo usa |
|--------|-----------|-------------|
| Operador de sonido en asambleas | Calibrar sistema rápidamente sin conocimientos de acústica | Modo automático: conecta micrófono de medición, presiona "Medir", aplica EQ sugerida |
| Ingeniero de sonido | Análisis detallado + ajuste fino | Modo manual: usa las trazas en vivo, ajusta EQ paramétrico, compara instantáneas |
| Técnico de AV | Verificación rápida del sistema | Test de cableado, respuesta plana, cobertura |
| Integrador de sistemas | Documentación y calibración de recintos | Guarda sesiones por venue, exporta datos |

---

## 1.5. Capacidades actuales (v0.2)

### Implementado

- **Captura de audio en tiempo real** dual-channel (referencia + medición) vía Web Audio API (AudioWorklet)
- **Análisis FFT** con múltiples ventanas (Hann, Hamming, Blackman-Harris, FlatTop, HFT223D, Exponential, Rectangular)
- **Función de Transferencia** (magnitud, fase, coeficiencia, respuesta al impulso, respuesta al escalón, retardo de grupo)
- **EQ Gráfico y Paramétrico** con respuesta en superposición en vivo
- **AutoEQ** con 4 algoritmos de optimización: Greedy, Nelder-Mead, Particle Swarm, Genético
- **Filtros biquad** implementación completa RBJ Cookbook
- **Ponderación frecuencial** A, B, C, Z
- **Promediación** FIFO, EMA, LPF con compuerta de amplitud
- **Suavizado PPO** (Per-Period Octave) para trazas legibles
- **Interpolación temporal** para renderizado fluido a 60fps
- **Leq** (nivel continuo equivalente)
- **Curvas target** Flat, X-Curve, House Curve, BK, Harman
- **Calibración de micrófono** con archivo de curva de calibración
- **Gestión de instantáneas** con persistencia en IndexedDB
- **Sesiones** por recinto/evento
- **Sistema de capas** (live, instantáneas, calculadas)
- **Espectrograma** en tiempo real
- **APST** (Acoustic Protocol for System Testing) — protocolo de medición estandarizado con generación de señales y detección automática por FSK
- **10 paletas de color** con tema claro/oscuro independiente para canvas
- **Layout responsive** de cuadrantes (1×1 hasta 3×2)
- **Exportación/Importación** de instantáneas como JSON
- **Tauri v2** con backend Rust para enumeración de dispositivos de audio
- **PWA** instalable con Service Worker

### No implementado (próximas fases)

- Integración con IA/LLM para explicaciones en lenguaje natural (Fase 2)
- Sistema de alertas en vivo: realimentación, saturación, sibilancias (Fase 3)
- OSC/MIDI para control remoto (Fase 5)
- Memoria de venues / Stage Plot (Fase 4)
- Simulación acústica avanzada (Fase 6)
- Backend Tauri nativo para captura de audio real (actualmente usa datos simulados en Tauri)

---

## 1.6. Mapa de ruta

| Fase | Enfoque | Estado |
|------|---------|--------|
| **Fase 0** | PWA + Tauri con RTA funcional + HAL | Completado |
| **Fase 1** | Calibración (FFT + AutoEQ + STI) | En progreso |
| **Fase 2** | Copiloto IA (RAG + LLM + UX adaptativa) | Pendiente |
| **Fase 3** | Diagnóstico en vivo (Fast-Rail + AFE) | Pendiente |
| **Fase 4** | Stage Plot + Memoria de venues | Pendiente |
| **Fase 5** | Telemetría OSC/MIDI + AV Guide | Pendiente |
| **Fase 6** | Simulación acústica avanzada | Pendiente |

---

## 1.7. Stack tecnológico (resumen)

| Capa | Tecnología |
|------|-----------|
| UI | Svelte 5 (Runes) + Canvas 2D API |
| Estilos | Tailwind CSS v4 |
| DSP | Web Audio API, AudioWorklet, Web Worker, webfft (WASM) |
| Estado | Svelte 5 Runes (Clases reactivas) |
| Persistencia | IndexedDB + localStorage |
| Desktop | Tauri v2 + Rust (cpal) |
| PWA | @vite-pwa/sveltekit |
| Build | Vite 8 |
| Adapter | @sveltejs/adapter-static → GitHub Pages |

> **Nota**: Para el stack detallado con versiones y justificación, ver [06-despliegue-y-configuracion.md](./06-despliegue-y-configuracion.md).
