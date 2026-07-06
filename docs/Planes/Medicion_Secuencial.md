# Plan de Implementación — Medición Secuencial

**Fecha:** 2026-07-06
**Estado:** Aprobado, en progreso

---

## Decisiones de diseño

| Decisión | Opción elegida |
|----------|---------------|
| Generación de segmentos | En buffer JS en vivo (sin APST Builder CLI) |
| Sincronización | FSK headers internos (Goertzel en AudioWorklet), renombrado en UI |
| Nombres de segmentos | Actualizar al protocolo (V=Path Audit, A=Alignment Level, etc.) |
| Organización de archivos | Renombrar `apst/` → `sequential/` |
| Auto-detección FSK desde Manual | Automático con notificación (toast) |
| Almacenamiento de resultados | Dentro de `Instantanea` extendiendo la interfaz |

---

## Fase 0 — Reestructuración de archivos

| Acción | Detalle |
|--------|---------|
| Renombrar `src/lib/dsp/apst/` → `src/lib/dsp/sequential/` | Mover todo el contenido |
| Eliminar `src/lib/dsp/sequential/Player.ts` | Reemplazado por generación de buffers |
| Agregar `playBuffer(buffer: Float32Array, sr: number): Promise<void>` a `AudioProvider` | HAL interface + WebAudioProvider |
| Actualizar `TabMedicion.svelte` | Renombrar labels: "Presets APST" → "Presets", eliminar "FSK" de la UI |
| Actualizar `mathOrchestrator.svelte.ts` | Renombrar `setFskEnabled` → `setHeaderDetectionEnabled` (misma funcionalidad) |

## Fase 1 — Generación de segmentos en buffer

Crear `FSKHeader.ts`:
- Codificación Lindos: Mark 1650Hz / Space 1850Hz, 110 baud, 11 bits/char
- Preámbulo 2 bits + carácter + LF variant (150/200Hz)
- `generateHeader(char: string, sr: number, type: 'HF' | 'LF'): Float32Array`

Crear `SegmentBuffer.ts`:
- `buildSegment(token, sr, headerType): Float32Array` — header + payload
- Señales por segmento en `signals/`:
  - `V`: 5 headers FSK rotados + seno 1kHz @ -18dBFS (2s) + silencio (3s)
  - `A`: seno 1kHz @ -18dBFS (5s)
  - `M`: sweeptones 1/3 octava (31 bandas, ~15s)
  - `N`: silencio (~12s)
  - `F`: sweep log 40Hz-20kHz (~15s)
  - `P`: sweep dual-canal (~15s)
  - `T`: MLS orden 16 (~5s)
  - `D`: seno 1kHz @ 0dBFS + @ -6dBFS (~8s)
  - `X`: seno 1kHz L + R (~10s)
  - `R`: ruido rosa + rampa ganancia (~15s)

## Fase 2 — Refactor Orchestrator

`Orchestrator.ts` nuevo flujo:
1. `buffer = SegmentBuffer.buildSegment(token, sr, type)`
2. `hal.playBuffer(buffer, sr)`
3. `waitForHeader(token, timeout)` — Goertzel (igual que hoy)
4. Worklet graba payload al detectar header
5. Fin playback → buffer grabado al analyzer
6. Resultado → `sequentialStore.reportResult(token, result)`
7. Todos completos → `sequentialStore.finishSequence()`

## Fase 3 — Auto-detección FSK desde Manual

En `mathOrchestrator.svelte.ts`:
- Goertzel siempre activo (no deshabilitar al salir de secuencial)
- Handler para `FSK_HEADER` incluso en manual
- Al detectar header válido:
  1. Toast: "Secuencia FSK detectada — cambiando a modo Secuencial"
  2. `uiStore.measurementMode = 'secuencial'`
  3. Arrancar Orchestrator

## Fase 4 — Store de secuencia y conexión UI

Crear `sequentialStore.svelte.ts` con:
- `isRunning`, `isOffline`, `currentSegment`, `progress`, `results`
- `runSequence()`, `stopSequence()`, `exportAsFile()`, `captureInstantaneaFromResults()`

En `TabMedicion.svelte`:
- Botón "Medir" conectado a store
- Resultados en vivo en la tabla de segmentos
- Barra de progreso
- Modo Offline: toggle + descarga WAV/FLAC
- Nombres/descripciones actualizados al protocolo
- "Calcular retardo" → ejecuta segmento T

## Fase 5 — Instantánea con resultados de segmentos

Extender `Instantanea`:
```typescript
segmentResults?: Record<string, {
    status: 'PASS' | 'WARN' | 'FAIL' | 'ERROR';
    values: Record<string, number | string>;
    message?: string;
}>;
sequenceConfig?: {
    segments: string[];
    preset: string;
    sampleRate: number;
};
```

En `TabInstantaneas.svelte`: mostrar resultados expandibles en cards de snapshots secuenciales.
Al completar secuencia: `sequentialStore.captureInstantaneaFromResults()` toma datos del mathOrchestrator + resultados → `traceManager.captureInstantaneaFromLive()`.

## Fase 6 — Analizadores faltantes

| Archivo | Análisis |
|---------|----------|
| `sequential/analyse/SegmentM.ts` | Comparar espectro recibido vs perfil de micrófono |
| `sequential/analyse/SegmentD.ts` | THD+N: FFT sobre seno, energía armónica vs fundamental |
| `sequential/analyse/SegmentR.ts` | Detectar ganancia al primer anillo de feedback |

---

## Dependencias

```
F0 → F1 → F2 ─→ F4 → F5
                ↕     ↑
              F3     F6
```

## Archivos a crear

1. `src/lib/dsp/sequential/FSKHeader.ts`
2. `src/lib/dsp/sequential/SegmentBuffer.ts`
3. `src/lib/dsp/sequential/signals/signalV.ts`
4. `src/lib/dsp/sequential/signals/signalA.ts`
5. `src/lib/dsp/sequential/signals/signalM.ts`
6. `src/lib/dsp/sequential/signals/signalN.ts`
7. `src/lib/dsp/sequential/signals/signalF.ts`
8. `src/lib/dsp/sequential/signals/signalP.ts`
9. `src/lib/dsp/sequential/signals/signalT.ts`
10. `src/lib/dsp/sequential/signals/signalD.ts`
11. `src/lib/dsp/sequential/signals/signalX.ts`
12. `src/lib/dsp/sequential/signals/signalR.ts`
13. `src/lib/stores/sequentialStore.svelte.ts`
14. `src/lib/dsp/sequential/analyse/SegmentM.ts`
15. `src/lib/dsp/sequential/analyse/SegmentD.ts`
16. `src/lib/dsp/sequential/analyse/SegmentR.ts`

## Archivos a modificar

1. `src/lib/hal/types.ts` — agregar `playBuffer()`
2. `src/lib/hal/web/WebAudioProvider.ts` — implementar `playBuffer()`
3. `src/lib/dsp/sequential/Orchestrator.ts` — refactor para buffer generation
4. `src/components/medicion/TabMedicion.svelte` — wire up UI, update labels
5. `src/components/medicion/Sidebar.svelte` — renombrar labels
6. `src/lib/stores/mathOrchestrator.svelte.ts` — renombrar + auto-detección
7. `src/lib/stores/ui.svelte.ts` — renombrar referencias
8. `src/lib/stores/traceManager.svelte.ts` — extender `Instantanea`
9. `src/components/medicion/TabInstantaneas.svelte` — mostrar resultados
10. `src/components/medicion/CaptureModal.svelte` — si corresponde

## Archivos a eliminar

1. `src/lib/dsp/sequential/Player.ts`
