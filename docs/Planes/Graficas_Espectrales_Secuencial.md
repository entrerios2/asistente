# Gráficas Espectrales en Medición Secuencial

## Arquitectura

Una sola capa snapshot (`sequentialLayer`) acumula los datos espectrales de todos los segmentos.
No se crean capas por segmento. Los cuadrantes dibujan automáticamente las métricas activas
que tengan datos en `multiMetricData`. No se modifica el pipeline manual (mathOrchestrator).

## Flujo

[Inicio secuencia]
  → traceManager.getOrCreateSequentialLayer()  // sourceType: 'snapshot'
       multiMetricData = {}

[Por cada segmento con datos espectrales]
  → Orchestrator.processToken(token)
  → Analyzer(ref?, meas, sr) → SegmentAnalysis { status, spectral? }
  → sequentialLayer.multiMetricData += token.spectral
  → cuadrantes dibujan métricas activas que tengan datos

[COMPLETADO]
  → traceManager.captureInstantaneaFromSequential(name, sequentialLayer.multiMetricData,
       segmentResults, sequenceConfig)
  → pendingCaptureForModal = ins → CaptureModal
  → GUARDAR: layer.instantaneaId = ins.id (persiste)
  → DESCARTAR: deleteInstantanea(ins.id), layer sigue visible

## Segmentos y Métricas

| Seg | Clave multiMetricData | Métrica allMetrics | Tipo dato | Renderer |
|-----|----------------------|--------------------|-----------|----------|
| F | "Magnitude" | Magnitude (existente) | Float32Array dB | drawMetricPath |
| F | "Phase" | Phase (existente) | Float32Array ° | drawPhasePath |
| F | "Coherence" | Coherence (existente) | Float32Array [0,1] | drawMetricPath |
| T | "Impulse" | Impulse (existente) | Float32Array time | drawTimeDomainPath |
| T | "GroupDelay" | Group Delay (existente) | Float32Array ms | drawMetricPath |
| T | "PhaseDelay" | Phase Delay (existente) | Float32Array ms | drawPhaseDelay |
| D | "Harmonics" | Harmonics (nueva) | Float32Array[4][BINS] | drawHarmonicSet (nuevo) |
| M | "OctaveBands" | OctaveBands (nueva) | {freqs, levels} | drawBarChart (nuevo) |
| N | "Spectrum" | Spectrum (existente) | Float32Array dBFS | drawMetricPath |
| X | "Magnitude" | Magnitude (existente) | Float32Array dB | drawMetricPath |
| P | "Phase" | Phase (existente) | Float32Array ° | drawPhasePath |
| R/V/A | — | — | solo tabla resultados | — |

## Etapas

### Etapa 1 — Fundación (Segmento F)
Archivos:
- `src/lib/dsp/sequential/analyse/SegmentF.ts` — Welch overlapping (Hann 50%), cross-spectrum Gxy, auto-spectra Gxx/Gyy, H1 = Gxy/Gxx → mag dB, phase °, coherence γ² = |Gxy|²/(Gxx·Gyy)
- `Orchestrator.ts` — añadir interface SpectralData { magnitude?, phase?, coherence?, frequencies?, sampleRate }, ampliar firma ANALYZERS a (meas: Float32Array, ref: Float32Array | undefined, sr: number) => SegmentAnalysis, pasar segment.buffer como ref para F
- `traceManager.svelte.ts` — getOrCreateSequentialLayer(): busca layer con name='secuencial' o crea uno en el primer cuadrante activo, sourceType:'snapshot'; updateSequentialLayer(token, spectral): mergea multiMetricData; captureInstantaneaFromSequential(): construye Instantanea desde multiMetricData acumulado
- `sequentialStore.svelte.ts` — handleEvent(PROCESANDO_SEGMENTO): si analysis.spectral existe, llama updateSequentialLayer; handleEvent(COMPLETADO): siempre llama captureInstantaneaFromSequential + pendingCaptureForModal (independiente de autoSaveSnapshotOnStop)

### Etapa 2 — T, N, X (Time Alignment, Noise Floor, Crosstalk)
Archivos:
- `analyse/SegmentT.ts` — cross-correlation delay detect + TF → impulse, group delay (derivada fase unwrapped), phase delay (Δfase/Δfreq)
- `analyse/SegmentN.ts` — FFT → |Y|² dBFS
- `analyse/SegmentX.ts` — TF Magnitude (misma lógica que F pero midiendo canal opuesto)

### Etapa 3 — D, M (Distorsión Armónica, Mic Profile)
Archivos:
- `analyse/SegmentD.ts` — añadir spectral.harmonics: { h2, h3, h4, h5: Float32Array }
- `analyse/SegmentM.ts` — añadir spectral.octaveBands: { frequencies, levels }
- `renderers/harmonicRenderers.ts` — drawHarmonicSet(): 4 curvas colores #ff4444/#ff8800/#ffcc00/#88ccff
- `renderers/barChartRenderer.ts` — drawBarChart(): barras proporcionales a ancho de banda 1/3‑octava

### Etapa 4 — P (Polaridad)
- `segments/SegmentP.ts` — migrar a devolver SegmentAnalysis { status, spectral: { phase } } en vez de boolean

## Lo que NO se toca
- mathOrchestrator.svelte.ts — pipeline live intacto
- quadrantDraw.ts — ya soporta multiMetricData en snapshot layers (línea 247-306)
- Quadrant.svelte — ya filtra layers por quadrantId
- CaptureModal.svelte — se reusa sin cambios
- TabMedicion.svelte — tabla resultados escalares igual
- TabInstantaneas.svelte — instantáneas existentes igual
- allMetrics existentes — no se modifican, solo se agregan Harmonics y OctaveBands
