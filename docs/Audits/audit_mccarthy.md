# Auditoría Técnica: Implementación DSP vs. McCarthy (3ra Ed.)

Comparación de la implementación actual contra las prácticas y métricas establecidas en *Sound Systems: Design and Optimization* de Bob McCarthy (3ra edición, capítulos 1, 12 y 13).

---

## Resumen Ejecutivo

La implementación actual cubre correctamente las **métricas fundamentales** que McCarthy identifica como esenciales para un analizador FFT dual-channel (§12.12):

> *"The optimization stage is driven by these basic FFT analyzer functions: single-channel spectrum, transfer function amplitude, phase, coherence and impulse response."* — §12.12

| Métrica McCarthy | Implementada | Corrección Necesaria |
|------------------|:---:|:---:|
| Transfer Function Amplitude (§12.7) | ✅ | — |
| Transfer Function Phase (§12.8) | ✅ | Menor |
| Coherence (§12.10) | ⚠️ | **Media** |
| Impulse Response (§12.11) | ✅ | Menor |
| Step Response (§1.3.5) | ✅ | — |
| Single-channel Spectrum (§12.5) | ✅ | — |
| Signal Averaging (§12.9) | ✅ | Menor |
| Phase Delay (§12.8.3) | ✅ | — |
| Group Delay (§12.8.5) | ✅ | — |
| Nyquist Plot | ✅ | — |
| Spectrogram | ✅ | Menor |
| EQ Filter Phase (§12.8.6) | ✅ | — |

---

## ✅ Conformidades Destacadas

### C1: Transfer Function H(f) = Y(f) / X(f)

McCarthy §12.7:
> *"Transfer function amplitude is simplistically modeled as division: Output/Input = Transfer function amplitude"*

**Implementación** en [osmMetrics.ts:L62-85](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/osmMetrics.ts#L62-L85):
```typescript
const hReal = (inputReal[k] * refReal[k] + inputImag[k] * refImag[k]) / denominator;
const hImag = (inputImag[k] * refReal[k] - inputReal[k] * refImag[k]) / denominator;
```

✅ **Correcto.** Usa la fórmula de división compleja estándar `H(f) = Y(f) · conj(X(f)) / |X(f)|²` con regularización `1e-12` para evitar divisiones por cero.

---

### C2: Phase como atan2(Im, Re) en grados

McCarthy §12.8:
> *"A frequency response is a series of solitary amplitude and phase values."*

**Implementación** en [osmMetrics.ts:L92-108](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/osmMetrics.ts#L92-L108):
```typescript
output[k] = Math.atan2(hImag, hReal) * (180.0 / Math.PI);
```

✅ **Correcto.** Phase calculada sobre H(f), no sobre los canales raw. Resultado en grados ±180°.

---

### C3: Impulse Response via IFFT de H(f)

McCarthy §12.11:
> *"The impulse response is a mathematical construction... an FFT of the amplitude and phase over frequency, which converts us back to the time domain, termed the Inverse Fourier Transform (IFT)."*

**Implementación** en [dspWorker.ts:L461-515](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/dspWorker.ts#L461-L515):
- Usa deconvolución `H(f) = Y(f)/X(f)` + IFFT con espejo hermítico.
- WebFFT acelerado con fallback a Radix-2.
- Source windowing y window function post-IFFT.

✅ **Correcto.** Sigue exactamente el proceso descrito: FFT → Transfer Function → IFT = Impulse Response.

---

### C4: Step Response como integral de impulso

McCarthy §1.3.5:
> *"The impulse response... we can find delay offsets between speakers with extreme accuracy."*

**Implementación** en [osmMetrics.ts:L151-160](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/osmMetrics.ts#L151-L160):
```typescript
cumulativeSum += impulseResponse[i] * dt * 1000.0;
output[i] = cumulativeSum;
```

✅ **Correcto.** Integral acumulada escalada por `dt = 1/sampleRate`.

---

### C5: Group Delay como derivada de fase

McCarthy §12.8.5:
> *"Many audio devices have frequency-dependent delay (phase delay over frequency)."*

**Implementación** en [osmMetrics.ts:L188-206](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/osmMetrics.ts#L188-L206):
```typescript
output[k] = (-dPhase / dOmega) * 1000.0; // ms
```

✅ **Correcto.** Derivada con unwrap `±π`, resultado en ms.

---

### C6: Filtros EQ con coeficientes biquad Audio EQ Cookbook

McCarthy §12.8.6:
> *"Phase delay is inversely proportional to the center frequency... each filter topology has specific phase delay characteristics."*

**Implementación** en [dspWorker.ts:L49-186](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/dspWorker.ts#L49-L186): Implementa peaking, low_shelf, high_shelf, lowpass, highpass, notch, bandpass usando los coeficientes estándar de Robert Bristow-Johnson.

✅ **Correcto.** Los coeficientes biquad son la referencia de la industria. La fase calculada analíticamente desde la función de transferencia z es más precisa que evaluarla numéricamente.

---

### C7: Averaging FIFO y LPF (Exponencial)

McCarthy §12.9.1:
> *"The 'first in, first out' (FIFO) style... new data pushes out old data so there is never a need for restarting."*
> *"Exponential averaging gives younger samples higher weighting than older ones."*

**Implementación**: FIFO y LPF (exponencial) en [averaging.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/averaging.ts).

✅ **Conforme.** Los dos tipos de averaging que McCarthy recomienda para transfer function están implementados.

---

## ⚠️ Discrepancias Menores

### D1: Phase Wraparound mode ±180° vs. 360° — falta "Unwrap"

McCarthy §12.8.2:
> *"Some analyzers expand the phase vertical scale up to thousands of degrees to eliminate wraparound, achieving a response similar to the unwrapped scenarios."*

**Estado actual:** [MetricConfigPopover.svelte:L105-108](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/MetricConfigPopover.svelte#L105-L108) ofrece `±180°` y `0..360°`, pero **no "Unwrap"** (escala expandida sin wraparound).

**Impacto:** McCarthy reconoce que "unwrap" puede ser "informative but also error prone" (§12.8.9), por lo que su ausencia no es crítica. Pero es un feature standard de SIM/SMAART.

> [!NOTE]
> Agregar un modo "Unwrap" opcional que acumule el ángulo continuamente (sin resetear en ±180°). Útil para identificar latencia frecuencia-dependiente en speakers multi-vía.

---

### D2: Spectrogram — resolución fija, no hay Constant-Q

McCarthy §12.5:
> *"Fixed points/octave (Constant Q Transform)... resolución constante en escala log."*

**Estado actual:** El spectrogram en [quadrantDraw.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/quadrantDraw.ts) interpola linealmente sobre un eje log de frecuencia, pero la resolución subyacente es FFT lineal (bins equiespaciados en Hz). Esto significa que la resolución en LF es pobre comparada con un CQT verdadero.

**Impacto:** McCarthy argumenta que la resolución fixed PPO (Constant Q) es superior para percepción tonal porque "a consistent ratio of direct to delayed wavelengths is classified as causal" (§12.10.3). Sin embargo, la mayoría de los analizadores de campo (SMAART, SysTune) usan FFT con múltiples time records, no CQT puro.

> [!NOTE]
> El enfoque actual es consistente con la mayoría de las herramientas del mercado. Un CQT verdadero sería un upgrade significativo pero no prioritario.

---

### D3: Averaging — falta amplitude thresholding

McCarthy §12.9.3:
> *"The mechanism is amplitude thresholding, which operates in principle like the noise gates on drum mics. Each sample is screened for level over frequency."*

**Estado actual:** El averaging FIFO y LPF en [averaging.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/averaging.ts) no implementa thresholding por amplitud. Todos los samples se incluyen en el promedio independientemente de su nivel.

**Impacto:** En ambientes ruidosos, esto permite que samples con baja SNR contaminen el promedio. McCarthy nota que "not all dual-channel FFT analyzers utilize this capability" (§12.9.3), pero los que lo hacen tienen "higher stability and noise immunity."

> [!TIP]
> Implementar un threshold configurable que descarte samples cuyo nivel por bin esté por debajo de un umbral (e.g., -60 dBFS). Esto mejoraría significativamente la estabilidad del transfer function en mediciones acústicas reales.

---

### D4: Impulse Response — falta display en dB (Hilbert Transform)

McCarthy §12.11:
> *"The Hilbert Transform is a popular modification of the impulse response... the negative half is folded upward and added to the positive, which eases reflection identification. Level is in dB."*

**Estado actual:** El impulse response se muestra en escala lineal. No hay opción de log/dB display (Energy Time Curve / ETC).

**Impacto:** En escala lineal, es difícil identificar reflexiones débiles que están 20-30 dB por debajo del directo. La ETC log hace que estas reflexiones sean claramente visibles.

> [!TIP]
> Agregar un toggle "ETC" (Energy Time Curve) al display de Impulse que aplique `20*log10(abs(impulse))` para mostrar en dB. Esto es standard en SMAART y SIM3.

---

## 🔴 Gaps Significativos

### G1: Coherence — simulada, no calculada estadísticamente

McCarthy §12.10.1:
> *"Coherence is a statistical value, derived from the deviations between the amplitude and phase values in the averager."*

> *"Coherence is calculated for each frequency bin on a scale of 0 to 1 (1 being perfect stability with no noise)."*

**Fórmula estándar:**
$$\gamma^2(f) = \frac{|G_{xy}(f)|^2}{G_{xx}(f) \cdot G_{yy}(f)}$$

**Estado actual:** [dspWorker.ts:L188-215](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/dspWorker.ts#L188-L215) calcula coherencia con una **fórmula heurística** basada en la frecuencia y los EQ bands, no estadísticamente:
```typescript
let coh = 0.98;
if (freq < 45) coh -= 0.35 * (1 - freq / 45);
if (freq > 16000) coh -= (0.12 * (freq - 16000)) / 4000;
```

Esto es una **simulación cosmética** que no refleja la definición real de coherencia. La función `calculateCoherence()` en [osmMetrics.ts:L166-182](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/osmMetrics.ts#L166-L182) tiene la fórmula correcta de `|Gxy|² / (Gxx · Gyy)`, pero **no se usa**.

> [!IMPORTANT]
> La coherencia real requiere múltiples promedios del cross-spectrum `Gxy`, auto-spectrum de input `Gxx` y auto-spectrum de output `Gyy`. Esto necesita acumular datos sobre N frames antes de computar un valor de coherencia válido. La implementación actual en `averaging.ts` (FIFO/LPF) opera sobre el espectro complejo crudo, pero no mantiene las auto/cross spectra necesarias para coherencia real.

**Plan de corrección:**
1. Acumular `Gxx(f)`, `Gyy(f)`, `Gxy(f)` en el averager (con FIFO o exponencial)
2. Calcular `γ²(f) = |Gxy|² / (Gxx · Gyy)` después del averaging
3. Reemplazar la función heurística por el cálculo real

---

### G2: Coherencia como gating para Transfer Function

McCarthy §12.10.2:
> *"Very high coherence tells us we can make adjustments with confidence... Low coherence means that there is more going on here than meets the ear."*

> *"We use coherence to make decisions, and most importantly to not make decisions."*

**Estado actual:** La coherencia no se usa para controlar la calidad del transfer function. Los valores de amplitud y fase se muestran independientemente de la coherencia.

**Impacto:** En mediciones reales, bins con coherencia < 0.5 deberían tener datos de amplitud y fase visualmente atenuados o descartados, ya que "the analyzer is just making it up" a esas frecuencias.

> [!NOTE]
> Sería ideal atenuar visualmente (o no dibujar) la curva de Magnitude y Phase en bins donde la coherencia < umbral configurable. Esto evitaría que el usuario intente ecualizar artefactos de ruido.

---

### G3: Transfer Function Phase — no hay compensación de delay del analyzer

McCarthy §12.6.2:
> *"The two channels must be synchronized when they arrive at the analyzer inputs... This is handled by placing a delay line in series with the analyzer inputs."*

**Estado actual:** No existe un mecanismo de "analyzer delay compensation" que permita al usuario sincronizar la señal de referencia con la medición. La fase se calcula asumiendo que input y output están sincronizados.

**Impacto:** En mediciones acústicas reales, la propagación del sonido añade delay. Sin compensación, la fase muestra una pendiente constante (slope de latencia) que enmascara la fase real del sistema. McCarthy indica que esto es un **requisito fundamental** del analizador (§12.12.2).

> [!IMPORTANT]
> Implementar un "compensation delay" configurable (en ms o samples) que se aplique a la referencia antes del cálculo de TF. Idealmente con auto-detect basado en el pico del impulse response.

---

## Métricas Adicionales Mencionadas pero Opcionales

McCarthy §12.12 menciona estas métricas como existentes pero **no necesarias** para el trabajo de optimización:

> *"There are Nyquist plots, cepstrum responses, Wigner distributions, time spectrographs, the modulation transfer function, intensity computations, RASTI, STI II... My conclusion as a practitioner... is that we don't need them."*

La app ya implementa **Nyquist** (✅), **Crest Factor** y **Level/Numeric overlays**, que van más allá del set mínimo de McCarthy.

---

## Resumen de Prioridades

| # | Hallazgo | Prio | Esfuerzo |
|---|----------|:----:|:--------:|
| G1 | Coherencia real (Gxy/Gxx·Gyy) | 🔴 Alto | Alto |
| G3 | Delay compensation en analyzer | 🔴 Alto | Medio |
| G2 | Coherencia como gate visual de TF | 🟡 Medio | Bajo |
| D4 | ETC / Hilbert log display | 🟡 Medio | Bajo |
| D1 | Phase Unwrap mode | 🟢 Bajo | Bajo |
| D3 | Amplitude thresholding en averaging | 🟢 Bajo | Medio |
| D2 | Constant-Q spectrogram | 🟢 Bajo | Alto |
