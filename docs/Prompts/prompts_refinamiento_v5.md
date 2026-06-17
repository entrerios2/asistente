# Prompts de Refinamiento v5 — Instrucciones Atómicas

> **INSTRUCCIONES GENERALES PARA EL AGENTE:**
> - Apegate **estrictamente** a cada prompt. No innoves, no agregues features, no refactorices código fuera del alcance de cada prompt.
> - **NO avances al siguiente prompt** excepto que el usuario te lo instruya explícitamente con una frase como "ejecuta el prompt N".
> - Un mensaje como "continue", "ok", "bien" o "siguiente" **NO es autorización para avanzar**. Esperá instrucciones explícitas.
> - Después de cada prompt, reportá los cambios realizados y esperá confirmación.
> - Si encontrás un conflicto o ambigüedad, preguntá antes de proceder.
> - Ejecutá `npm run dev` después de cada prompt para verificar que no hay errores de compilación.

---

## Prompt 1: Crear archivo de iconos SVG para filtros

**Archivo a crear**: `src/lib/icons/filterIcons.ts`

Crear este archivo con el siguiente contenido exacto:

```typescript
export const filterSvgIcons: Record<string, string> = {
    peaking: `<svg viewBox="0 0 10314.6 5913.6" fill="none" stroke="currentColor" stroke-width="734" stroke-linecap="round" stroke-linejoin="round"><path d="M9947.6 5545.8c-658,0 -1251.2,-65.9 -1877.3,-129.5 -1602.1,-162.6 -1892.5,-1662.1 -2201,-3236.7 -87,-443.9 -216.6,-1678.4 -647.3,-1812.5 -472.1,16.4 -659,1263.1 -755.5,1747.8 -149.9,752.5 -279.9,1232.2 -517,1942 -525.8,1574.1 -2111.3,1488.9 -3582.6,1488.9"/></svg>`,
    lowpass: `<svg viewBox="0 0 86853.8 45206.4" fill="none" stroke="currentColor" stroke-width="6703.5" stroke-linecap="round" stroke-linejoin="round"><path d="M83501.8 41854.3c-5287.9,-7952.8 -11599.5,-24407.8 -18563.6,-31389 -7820.8,-7840.2 -14062,-7094.6 -24831.5,-7094.6 -8276.9,0 -28478,0 -36755,0"/></svg>`,
    highpass: `<svg viewBox="0 0 86855 45206.9" fill="none" stroke="currentColor" stroke-width="6703.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3352.1 41854.8c5287.9,-7952.9 11599.7,-24408.2 18563.8,-31389.4 7820.9,-7840.3 14062.2,-7094.7 24831.8,-7094.7 8277,0 28478.4,0 36755.4,0"/></svg>`,
    low_shelf: `<svg viewBox="0 0 19715.7 10602.3" fill="none" stroke="currentColor" stroke-width="1463.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15793.9 5301.1c-6390.9,0 -4569.6,-1712.6 -7546.1,-3667.2 -1904.8,-1250.9 -4550.3,-836.4 -7516.1,-836.4"/><line x1="15793.9" y1="5301.1" x2="18983.9" y2="5301.1"/><path d="M15793.9 5301.1c-6390.9,0 -4569.6,1712.6 -7546.1,3667.2 -1904.8,1250.9 -4550.3,836.4 -7516.1,836.4"/></svg>`,
    high_shelf: `<svg viewBox="0 0 19715.7 10602.3" fill="none" stroke="currentColor" stroke-width="1463.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3921.8 5301.1c6390.9,0 4569.6,-1712.6 7546.1,-3667.2 1904.8,-1250.9 4550.3,-836.4 7516.1,-836.4"/><line x1="3921.8" y1="5301.1" x2="731.8" y2="5301.1"/><path d="M3921.8 5301.1c6390.9,0 4569.6,1712.6 7546.1,3667.2 1904.8,1250.9 4550.3,836.4 7516.1,836.4"/></svg>`,
    notch: `<svg viewBox="0 0 23405.4 12684.7" fill="none" stroke="currentColor" stroke-width="1644.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22583 836.9c-3400.3,0 -5930.3,-391.7 -7688.9,2901.4 -1640.7,3072.4 -1760.3,7319.6 -3046.3,8124 -1345.9,-387 -1715.1,-4920.5 -3091,-7978.9 -1518.1,-3374.4 -4648.6,-3046.5 -7934.3,-3046.5"/></svg>`,
    bandpass: `<svg viewBox="0 0 108525.4 58387.1" fill="none" stroke="currentColor" stroke-width="7580.1" stroke-linecap="round" stroke-linejoin="round"><path d="M104736.3 54598c-23577.6,-1811.5 -24207.1,-50778.2 -50807.8,-50808 -24727.1,-27.5 -25824.1,48939.9 -50139.4,50808"/></svg>`,
};
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 2: Reemplazar iconos Material Symbols por SVGs custom y separar shelving

**Archivo**: `src/components/medicion/Sidebar.svelte`

1. En el bloque `<script lang="ts">`, agregar el import:
```typescript
import { filterSvgIcons } from '$lib/icons/filterIcons';
```

2. Localizar la interface `ParametricFilter` (aprox L68). Cambiar el comentario del campo `type`:
```typescript
// ANTES:
type: string; // 'peaking' | 'lowpass' | 'highpass' | 'shelving' | 'notch' | 'bandpass'
// DESPUÉS:
type: string; // 'peaking' | 'lowpass' | 'highpass' | 'low_shelf' | 'high_shelf' | 'notch' | 'bandpass'
```

3. En los objetos de filtro predefinidos `parametricFilters`, reemplazar cada ocurrencia de `"shelving"` por `"low_shelf"` en los `supportedTypes`. Hay 4 filtros predefinidos:

   - **Filtro 1 (80Hz)** (aprox L79-86):
   ```typescript
   // ANTES:
   supportedTypes: ["peaking", "lowpass", "highpass", "shelving", "notch", "bandpass"],
   // DESPUÉS:
   supportedTypes: ["peaking", "lowpass", "highpass", "low_shelf", "high_shelf", "notch", "bandpass"],
   ```

   - **Filtro 2 (500Hz)** (aprox L95):
   ```typescript
   // ANTES:
   supportedTypes: ["peaking", "shelving", "notch"],
   // DESPUÉS:
   supportedTypes: ["peaking", "low_shelf", "high_shelf", "notch"],
   ```

   - **Filtro 4 (8kHz)** (aprox L113):
   ```typescript
   // ANTES:
   supportedTypes: ["peaking", "lowpass", "shelving"],
   // DESPUÉS:
   supportedTypes: ["peaking", "lowpass", "low_shelf", "high_shelf"],
   ```

4. Localizar el bloque de checkboxes de tipos (aprox L1409):
```typescript
// ANTES:
{#each ["peaking", "lowpass", "highpass", "shelving", "notch", "bandpass"] as type}
// DESPUÉS:
{#each ["peaking", "lowpass", "highpass", "low_shelf", "high_shelf", "notch", "bandpass"] as type}
```

5. En el bloque ternario de nombres de tipo (aprox L1465-1466), agregar los dos casos nuevos. Buscar la cadena de ternarios y agregar:
```typescript
type === "low_shelf" ? "Low Shelf" : type === "high_shelf" ? "High Shelf" :
```

6. Localizar la condición para mostrar ganancia (aprox L1584):
```typescript
// ANTES:
{#if ["peaking", "shelving"].includes(filter.type)}
// DESPUÉS:
{#if ["peaking", "low_shelf", "high_shelf"].includes(filter.type)}
```

7. Localizar el `supportedTypes` del botón "Agregar Filtro" (aprox L1623):
```typescript
// ANTES:
supportedTypes: ['peaking', 'lowpass', 'highpass', 'shelving', 'notch', 'bandpass'],
// DESPUÉS:
supportedTypes: ['peaking', 'lowpass', 'highpass', 'low_shelf', 'high_shelf', 'notch', 'bandpass'],
```

8. Localizar el mapa `icons` (aprox L1484-1491). **Eliminarlo completamente**.

9. Localizar el mapa `labels` (aprox L1492-1499). Reemplazarlo por:
```typescript
{@const labels: Record<string, string> = {
    peaking: 'Peak',
    lowpass: 'LP',
    highpass: 'HP',
    low_shelf: 'LS',
    high_shelf: 'HS',
    notch: 'Notch',
    bandpass: 'BP',
}}
```

10. Localizar la línea que renderiza el icono Material Symbol del tipo (aprox L1507, buscar `<span class="material-symbols-outlined text-[16px]">{icons[type]`). Reemplazarla por:
```svelte
<span class="w-5 h-3 inline-flex items-center justify-center">
    {@html filterSvgIcons[type] || ''}
</span>
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 3: Modo claro — mejorar contraste de texto

**Archivo**: `src/routes/layout.css`

1. Localizar el bloque `:root` (modo claro, la sección que NO está dentro de `[data-theme="dark"]`). Buscar las variables `--text-secondary` y `--text-muted`. Cambiar sus valores:

```css
/* ANTES: */
--text-secondary: #555566;
--text-muted: #888899;

/* DESPUÉS: */
--text-secondary: #3d3d50;
--text-muted: #6b6b80;
```

**No tocar `--text-primary` (ya tiene buen contraste). No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 4: Eliminar sombra del header

**Archivo**: `src/components/medicion/Header.svelte`

1. Localizar la clase `.global-header` en el bloque `<style>` (aprox L300-312). Buscar la línea:
```css
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
```

2. **Eliminar esa línea completamente**. No reemplazarla, simplemente borrarla.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 5: Agregar funciones biquad faltantes + helper getCoeffsForType

**Archivo**: `src/lib/dsp/biquad.ts`

1. Agregar las siguientes 4 funciones **después** de `highShelfCoeffs` (al final del archivo, antes del cierre):

```typescript
export function lowpassCoeffs(fc: number, _gain: number, Q: number, fs: number): number[] {
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 = (1 - cosW0) / 2;
    const b1 =  1 - cosW0;
    const b2 = (1 - cosW0) / 2;
    const a0 =  1 + alpha;
    const a1 = -2 * cosW0;
    const a2 =  1 - alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

export function highpassCoeffs(fc: number, _gain: number, Q: number, fs: number): number[] {
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 =  (1 + cosW0) / 2;
    const b1 = -(1 + cosW0);
    const b2 =  (1 + cosW0) / 2;
    const a0 =  1 + alpha;
    const a1 = -2 * cosW0;
    const a2 =  1 - alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

export function notchCoeffs(fc: number, _gain: number, Q: number, fs: number): number[] {
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 =  1;
    const b1 = -2 * cosW0;
    const b2 =  1;
    const a0 =  1 + alpha;
    const a1 = -2 * cosW0;
    const a2 =  1 - alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}

export function bandpassCoeffs(fc: number, _gain: number, Q: number, fs: number): number[] {
    const w0 = 2 * Math.PI * fc / fs;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 =  alpha;
    const b1 =  0;
    const b2 = -alpha;
    const a0 =  1 + alpha;
    const a1 = -2 * cosW0;
    const a2 =  1 - alpha;

    return [b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0];
}
```

2. Agregar la función helper **después** de las funciones anteriores:

```typescript
export function getCoeffsForType(
    type: string, fc: number, gain: number, Q: number, fs: number
): number[] {
    switch (type) {
        case 'peaking':                        return peakingCoeffs(fc, gain, Q, fs);
        case 'low_shelf':  case 'lowshelf':    return lowShelfCoeffs(fc, gain, Q, fs);
        case 'high_shelf': case 'highshelf':   return highShelfCoeffs(fc, gain, Q, fs);
        case 'lowpass':                        return lowpassCoeffs(fc, gain, Q, fs);
        case 'highpass':                       return highpassCoeffs(fc, gain, Q, fs);
        case 'notch':                          return notchCoeffs(fc, gain, Q, fs);
        case 'bandpass':                       return bandpassCoeffs(fc, gain, Q, fs);
        default:                               return peakingCoeffs(fc, gain, Q, fs);
    }
}
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 6: Fix DSP — mathOrchestrator ignora band.type

**Archivo**: `src/lib/stores/mathOrchestrator.svelte.ts`

1. Agregar `getCoeffsForType` al import existente de biquad.ts. Buscar la línea de import (al inicio del archivo) y agregar `getCoeffsForType`:
```typescript
import { peakingCoeffs, lowShelfCoeffs, highShelfCoeffs, getCoeffsForType, biquadResponse } from '../dsp/biquad';
```

2. Localizar `updateEQCache` (aprox L250-256). Reemplazar la línea que genera coeficientes:
```typescript
// ANTES:
const coeffs = peakingCoeffs(band.freq, band.gain, band.q, sr);
// DESPUÉS:
const coeffs = getCoeffsForType(band.type, band.freq, band.gain, band.q, sr);
```

3. En el mismo bloque, cambiar la condición de skip:
```typescript
// ANTES:
if (band.gain !== 0) {
// DESPUÉS:
if (band.gain !== 0 || !['peaking', 'low_shelf', 'high_shelf'].includes(band.type)) {
```

4. Localizar `getPhaseValueRadians` (aprox L286-292). Hacer los mismos dos cambios:
```typescript
// ANTES:
const coeffs = peakingCoeffs(band.freq, band.gain, band.q, 48000);
// DESPUÉS:
const coeffs = getCoeffsForType(band.type, band.freq, band.gain, band.q, 48000);
```
Y la condición:
```typescript
// ANTES:
if (band.gain !== 0) {
// DESPUÉS:
if (band.gain !== 0 || !['peaking', 'low_shelf', 'high_shelf'].includes(band.type)) {
```

5. Localizar `checkDirty` (aprox L214-222). Incluir `band.type` en el hash:
```typescript
// ANTES:
bandsHash += band.freq * 1e6 + band.gain * 1e3 + band.q;
// DESPUÉS:
bandsHash += band.freq * 1e6 + band.gain * 1e3 + band.q + (band.type ? band.type.charCodeAt(0) * 100 : 0);
```

Y para `calibrationFilters`:
```typescript
// ANTES:
bandsHash += filter.frequency * 1e6 + filter.gain * 1e3 + filter.q + (filter.enabled ? 1 : 0);
// DESPUÉS:
bandsHash += filter.frequency * 1e6 + filter.gain * 1e3 + filter.q + (filter.enabled ? 1 : 0) + (filter.type ? filter.type.charCodeAt(0) * 100 : 0);
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 7: Fix DSP — dspWorker ignora band.type

**Archivo**: `src/lib/dsp/dspWorker.ts`

1. Localizar `getPhaseValueRadians` (aprox L54-82). Dentro del loop `for (let b = 0; b < eqBands.length; b++)`, el bloque actual calcula coeficientes peaking inline. Reemplazar **todo el cuerpo del loop** por un switch que maneje todos los tipos. El bloque completo debe quedar:

```typescript
for (let b = 0; b < eqBands.length; b++) {
    const band = eqBands[b];
    if (band.gain !== 0 || !['peaking', 'low_shelf', 'high_shelf'].includes(band.type)) {
        const fc = band.freq;
        const G = band.gain;
        const Q = band.q;
        const A = Math.pow(10, G / 40);
        const w0 = 2 * Math.PI * fc / 48000;
        const sinW0 = Math.sin(w0);
        const cosW0 = Math.cos(w0);
        
        let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
        
        if (band.type === 'peaking') {
            const alpha = sinW0 / (2 * Q);
            b0 = 1 + alpha * A; b1 = -2 * cosW0; b2 = 1 - alpha * A;
            a0 = 1 + alpha / A; a1 = -2 * cosW0; a2 = 1 - alpha / A;
        } else if (band.type === 'low_shelf' || band.type === 'lowshelf') {
            const alpha = sinW0 / 2 * Math.sqrt((A + 1/A) * (1/Q - 1) + 2);
            const sqrtA2alpha = 2 * Math.sqrt(A) * alpha;
            b0 = A * ((A + 1) - (A - 1) * cosW0 + sqrtA2alpha);
            b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
            b2 = A * ((A + 1) - (A - 1) * cosW0 - sqrtA2alpha);
            a0 = (A + 1) + (A - 1) * cosW0 + sqrtA2alpha;
            a1 = -2 * ((A - 1) + (A + 1) * cosW0);
            a2 = (A + 1) + (A - 1) * cosW0 - sqrtA2alpha;
        } else if (band.type === 'high_shelf' || band.type === 'highshelf') {
            const alpha = sinW0 / 2 * Math.sqrt((A + 1/A) * (1/Q - 1) + 2);
            const sqrtA2alpha = 2 * Math.sqrt(A) * alpha;
            b0 = A * ((A + 1) + (A - 1) * cosW0 + sqrtA2alpha);
            b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
            b2 = A * ((A + 1) + (A - 1) * cosW0 - sqrtA2alpha);
            a0 = (A + 1) - (A - 1) * cosW0 + sqrtA2alpha;
            a1 = 2 * ((A - 1) - (A + 1) * cosW0);
            a2 = (A + 1) - (A - 1) * cosW0 - sqrtA2alpha;
        } else if (band.type === 'lowpass') {
            const alpha = sinW0 / (2 * Q);
            b0 = (1 - cosW0) / 2; b1 = 1 - cosW0; b2 = (1 - cosW0) / 2;
            a0 = 1 + alpha; a1 = -2 * cosW0; a2 = 1 - alpha;
        } else if (band.type === 'highpass') {
            const alpha = sinW0 / (2 * Q);
            b0 = (1 + cosW0) / 2; b1 = -(1 + cosW0); b2 = (1 + cosW0) / 2;
            a0 = 1 + alpha; a1 = -2 * cosW0; a2 = 1 - alpha;
        } else if (band.type === 'notch') {
            const alpha = sinW0 / (2 * Q);
            b0 = 1; b1 = -2 * cosW0; b2 = 1;
            a0 = 1 + alpha; a1 = -2 * cosW0; a2 = 1 - alpha;
        } else if (band.type === 'bandpass') {
            const alpha = sinW0 / (2 * Q);
            b0 = alpha; b1 = 0; b2 = -alpha;
            a0 = 1 + alpha; a1 = -2 * cosW0; a2 = 1 - alpha;
        } else {
            // Fallback peaking
            const alpha = sinW0 / (2 * Q);
            b0 = 1 + alpha * A; b1 = -2 * cosW0; b2 = 1 - alpha * A;
            a0 = 1 + alpha / A; a1 = -2 * cosW0; a2 = 1 - alpha / A;
        }

        const w = 2 * Math.PI * freq / 48000;
        const cosW = Math.cos(w);
        const sinW = Math.sin(w);
        const cos2W = Math.cos(2 * w);
        const sin2W = Math.sin(2 * w);

        const nI = -(b1 * sinW + b2 * sin2W);
        const nR = b0 + b1 * cosW + b2 * cos2W;
        const dI = -(a1 * sinW + a2 * sin2W);
        const dR = a0 + a1 * cosW + a2 * cos2W;

        phase += Math.atan2(nI, nR) - Math.atan2(dI, dR);
    }
}
```

2. Localizar `getCoherenceValue` (aprox L147-163). Dentro del loop de `eqBands`, **después** del bloque `if (band.gain < -5)`, agregar:
```typescript
    // Simular caída de coherencia en zonas de atenuación de filtros LP/HP/notch
    if (band.type === 'lowpass' && freq > band.freq) {
        const octaves = Math.log2(freq / band.freq);
        coh -= Math.min(0.4, octaves * 0.15);
    } else if (band.type === 'highpass' && freq < band.freq) {
        const octaves = Math.log2(band.freq / freq);
        coh -= Math.min(0.4, octaves * 0.15);
    } else if (band.type === 'notch') {
        const dist = Math.abs(Math.log2(freq / band.freq));
        if (dist < 0.15) coh -= 0.25 * (1 - dist / 0.15);
    }
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 8: Fix DSP — calibrationStore para nuevos tipos

**Archivo**: `src/lib/stores/calibrationStore.svelte.ts`

1. Actualizar el import de biquad.ts (buscar la línea de import al inicio). Agregar las funciones nuevas:
```typescript
import { peakingCoeffs, lowShelfCoeffs, highShelfCoeffs, lowpassCoeffs, highpassCoeffs, notchCoeffs, bandpassCoeffs, biquadResponse } from '../dsp/biquad';
```

2. Localizar la interfaz `EQFilter` (aprox L12). Actualizar el tipo:
```typescript
// ANTES:
type: 'peaking' | 'highshelf' | 'lowshelf';
// DESPUÉS:
type: 'peaking' | 'highshelf' | 'lowshelf' | 'high_shelf' | 'low_shelf' | 'lowpass' | 'highpass' | 'notch' | 'bandpass';
```

3. Localizar `getCoefficients` (aprox L78-91). Reemplazar el cuerpo del switch por:
```typescript
getCoefficients(filter: EQFilter): number[] | null {
    const fc = filter.frequency;
    const G = filter.gain;
    const Q = filter.q;
    const fs = this.sampleRate;

    switch (filter.type) {
        case 'peaking':                        return peakingCoeffs(fc, G, Q, fs);
        case 'lowshelf':   case 'low_shelf':   return lowShelfCoeffs(fc, G, Q, fs);
        case 'highshelf':  case 'high_shelf':  return highShelfCoeffs(fc, G, Q, fs);
        case 'lowpass':                        return lowpassCoeffs(fc, G, Q, fs);
        case 'highpass':                       return highpassCoeffs(fc, G, Q, fs);
        case 'notch':                          return notchCoeffs(fc, G, Q, fs);
        case 'bandpass':                       return bandpassCoeffs(fc, G, Q, fs);
        default:                               return null;
    }
}
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 9: Refactorizar drawSimulatedMagnitudePath para curva suave

**Archivo**: `src/lib/dsp/canvasRenderers.ts`

1. Localizar la función `drawSimulatedMagnitudePath` (aprox L748-808). **Reemplazar su cuerpo completo** por la siguiente implementación que usa puntos por bin FFT + spline `quadraticCurveTo` (el mismo patrón que `drawMetricPath`):

```typescript
export function drawSimulatedMagnitudePath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: { color: string, lineWidth: number, lineDash: number[] },
    frequencyLUT: Int32Array,
    interpCoherence: Float32Array,
    interpMagnitude: Float32Array,
    metricConfigs: Record<string, any>,
    state: InteractionState,
    getPPOSmoothedValue: (binIndex: number, dataArray: Float32Array, ppo: number) => number,
    getEQResponseCached: (f: number) => number,
    bins: number
) {
    ctx.setLineDash(style.lineDash || []);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    
    const cfg = metricConfigs["Simulated Magnitude"] || { modeY: "dB", smoothingPPO: 48, enableCoherence: false, coherenceThreshold: 0.5 };
    
    const path = new Path2D();
    const sr = 48000;
    const binWidth = sr / 2 / bins;

    const points: {x: number, y: number}[] = [];

    for (let bin = 0; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        if (cfg.enableCoherence && interpCoherence[bin] < cfg.coherenceThreshold) continue;

        let val = getPPOSmoothedValue(bin, interpMagnitude, cfg.smoothingPPO);
        const f = bin * binWidth || 1e-6;
        const eqGain = getEQResponseCached(f);
        val = val + eqGain;

        if (cfg.modeY === "Linear") {
            val = Math.pow(10, val / 20);
        } else if (cfg.modeY === "Impedance") {
            val = Math.pow(10, val / 20) * (cfg.sensorResistance || 10);
        }

        const y = valToY(val, height, "Simulated Magnitude", metricConfigs, state) + (cfg.yShift || 0);
        points.push({ x, y });
    }

    if (points.length > 0) {
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        if (points.length > 1) {
            const last = points[points.length - 1];
            path.lineTo(last.x, last.y);
        }
    }

    ctx.stroke(path);
    ctx.setLineDash([]);
}
```

**Mantener la firma de la función exactamente como está** (mismos parámetros), ya que el caller en Quadrant.svelte los pasa todos. Solo cambia la implementación interna.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 10: Zoom X mínimo = 1.0

**Archivo**: `src/lib/dsp/canvasInteraction.ts`

1. Localizar `handleWheel` (aprox L217). Cambiar el mínimo de zoomX:
```typescript
// ANTES:
state.zoomX = Math.max(0.5, Math.min(4, state.zoomX * delta));
// DESPUÉS:
state.zoomX = Math.max(1, Math.min(4, state.zoomX * delta));
```

2. Localizar `handleTouchMove` (aprox L323). Mismo cambio:
```typescript
// ANTES:
state.zoomX = Math.max(0.5, Math.min(4, state.touchStartScaleX * factor));
// DESPUÉS:
state.zoomX = Math.max(1, Math.min(4, state.touchStartScaleX * factor));
```

**IMPORTANTE**: Solo cambiar el mínimo de `zoomX`. **NO** cambiar el mínimo de `zoomY` (que debe seguir en `0.5`).

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 11: Simplificar topbar — solo iconos, sin labels

**Archivo**: `src/components/medicion/Header.svelte`

1. En el bloque `<style>`, cambiar la altura de `.global-header`:
```css
/* ANTES: */
height: 54px;
/* DESPUÉS: */
height: 38px;
```

2. Verificar que la línea `box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);` fue eliminada en el Prompt 4. Si sigue ahí, eliminarla.

3. Reemplazar **todo** el contenido del `<div class="header-right">` (L97-296) por la siguiente estructura de botones de solo icono + separadores:

```svelte
<div class="header-right">
    <!-- Generador -->
    <button
        class="header-btn"
        style="color: {uiStore.genActive ? '#00ff88' : 'var(--text-muted)'};"
        onclick={toggleGenerator}
        title={uiStore.genActive
            ? `Generador: ${signalNames[uiStore.generatorType]} (activo)`
            : "Iniciar generador"}
    >
        <span class="material-symbols-outlined text-[16px]">
            {uiStore.genActive ? 'volume_up' : 'volume_mute'}
        </span>
    </button>

    <div class="header-sep"></div>

    <!-- Medir -->
    <button
        class="header-btn {uiStore.isMeasuring ? 'measuring' : ''}"
        onclick={toggleMeasurement}
        title={uiStore.isMeasuring ? "Detener medición" : "Iniciar medición"}
    >
        <span class="material-symbols-outlined text-[16px]">podcasts</span>
    </button>

    <div class="header-sep"></div>

    <!-- EQ -->
    <button
        class="header-btn"
        style="color: var(--text-muted);"
        onclick={() => { uiStore.activeTab = 'eq'; }}
        title="Ecualización"
    >
        <span class="material-symbols-outlined text-[16px]">equalizer</span>
    </button>

    <div class="header-sep"></div>

    <!-- Grilla -->
    <div class="relative">
        <button
            class="header-btn"
            onclick={() => (showGridDropdown = !showGridDropdown)}
            title="Configurar grilla ({uiStore.layout})"
        >
            <span class="material-symbols-outlined text-[16px]">grid_view</span>
        </button>

        {#if showGridDropdown}
            <div
                class="fixed inset-0 z-40"
                onclick={() => (showGridDropdown = false)}
            ></div>

            <div
                class="absolute right-0 mt-2 rounded-xl p-3 shadow-[0_10px_30px_#000000] z-50 min-w-[140px] flex flex-col gap-2"
                style="background: var(--bg-surface); border: 1px solid var(--border-primary);"
            >
                <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 select-none">
                    Configurar Rejilla
                </div>

                <div
                    class="grid grid-cols-2 gap-1.5 p-2 rounded-lg cursor-pointer transition-colors"
                    style="background: var(--bg-tertiary); border: 1px solid var(--border-primary);"
                    onmouseleave={() => { hoverCol = 0; hoverRow = 0; }}
                >
                    {#each [1, 2, 3] as row}
                        {#each [1, 2] as col}
                            <div
                                class="w-6 h-6 rounded-[4px] border transition-all duration-150"
                                style="{isHighlighted(col, row)
                                    ? 'background: rgba(0,255,136,0.2); border-color: #00ff88; box-shadow: 0 0 8px rgba(0,255,136,0.15); transform: scale(1.05);'
                                    : 'background: var(--bg-secondary); border-color: var(--border-primary);'}"
                                onmouseenter={() => { hoverCol = col; hoverRow = row; }}
                                onclick={() => selectLayout(col, row)}
                            ></div>
                        {/each}
                    {/each}
                </div>

                <div class="text-[9px] font-mono text-center font-bold text-[#00ff88] mt-1 bg-[#001a0e] py-1.5 rounded border border-[#004d29] tracking-wide select-none">
                    {getLayoutLabel()}
                </div>
            </div>
        {/if}
    </div>

    <div class="header-sep"></div>

    <!-- Vúmetro compacto -->
    <div
        class="vu-outer-container cursor-pointer"
        onclick={() => { uiStore.activeTab = "config"; }}
        title="Hacer clic para ir a Configuración de Audio"
    >
        <div class="vu-container">
            <div class="vu-group">
                <span class="vu-label">IN</span>
                <div class="vu-bars">
                    {#each meterStore.inLevels as level}
                        <div class="vu-track">
                            <div class="vu-fill in" style="width: {getVuWidth(level)}%"></div>
                        </div>
                    {/each}
                </div>
            </div>
            <div class="vu-group">
                <span class="vu-label">OUT</span>
                <div class="vu-bars">
                    {#each meterStore.outLevels as level}
                        <div class="vu-track">
                            <div class="vu-fill out" style="width: {getVuWidth(level)}%"></div>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
        <div class="led-container">
            <div
                class="led-indicator {isCalibrated ? 'active' : ''}"
                title={isCalibrated
                    ? "Sistema Calibrado (Nivel IN/OUT empatado)"
                    : "Sistema no calibrado o señal inactiva"}
            ></div>
        </div>
    </div>
</div>
```

4. Agregar los siguientes estilos **dentro** del bloque `<style>` existente (al final, antes del cierre `</style>`):

```css
.header-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    color: var(--text-muted);
}

.header-btn:hover {
    background: var(--bg-tertiary);
}

.header-btn.measuring {
    color: #ef4444;
    animation: pulse-measure 1.5s infinite;
}

@keyframes pulse-measure {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

.header-sep {
    width: 1px;
    height: 18px;
    background: var(--border-primary);
    flex-shrink: 0;
}
```

5. Cambiar el padding y min-height del `.vu-outer-container`:
```css
/* ANTES: */
padding: 6px 12px;
...
min-height: 40px;
/* DESPUÉS: */
padding: 4px 8px;
...
min-height: 30px;
```

6. Eliminar la función `openManualMeasurement` (L48-51) y `openModeMeasurement` (L53-55) ya que los botones que las usaban se eliminaron.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 12: Panel EQ — switch "Capa de ecualizador" + atajo Resp. Simulada

**Archivo**: `src/components/medicion/Sidebar.svelte`

1. Localizar el bloque "Controles Superiores" (aprox L1225-1258, el div que contiene "Habilitar Ecualización" + botón AutoEQ). Reemplazarlo **completo** por:

```svelte
<!-- Controles Superiores -->
<div class="flex flex-col gap-3 rounded-lg p-4"
     style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
    <div class="flex justify-between items-center">
        <label class="flex items-center gap-2 cursor-pointer">
            <input
                type="checkbox"
                bind:checked={showEQ}
                class="accent-[#fbbf24] w-3.5 h-3.5 cursor-pointer"
            />
            <span class="text-[10px] font-semibold" style="color: {showEQ ? '#fbbf24' : 'var(--text-muted)'}">
                <span class="material-symbols-outlined text-[12px] align-middle mr-0.5">equalizer</span>
                Capa de ecualizador
            </span>
        </label>
        <button
            class="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold transition-all cursor-pointer"
            style="color: #00ffff; background: #00ffff10; border: 1px solid #00ffff20"
            onclick={() => uiStore.addSimulatedMagnitudeToAll()}
            title="Agregar pill de respuesta simulada a todos los cuadrantes"
        >
            <span class="material-symbols-outlined text-[11px]">insights</span>
            + Resp. Simulada
        </button>
    </div>
</div>
```

2. Localizar el `{#if showEQ}` (aprox L1260) y su correspondiente `{:else}` / `{/if}` (aprox L1637-1647). **Eliminar** los delimitadores `{#if showEQ}`, `{:else}` y `{/if}`. Dejar el contenido interior del `{#if}` siempre visible. Eliminar el bloque `{:else}` completo (que muestra un mensaje de "Active el switch").

3. Localizar el botón "Simular Respuesta" anclado al fondo (aprox L1649-1670, el `<div class="mt-auto pt-4 border-t...">`). **Eliminar todo el div** que contiene el botón grande de simular.

**Archivo**: `src/lib/stores/ui.svelte.ts`

4. En la clase/objeto `uiStore`, agregar:
```typescript
simulatedMagnitudeRequest = $state(0);

addSimulatedMagnitudeToAll() {
    this.simulatedMagnitudeRequest = (this.simulatedMagnitudeRequest || 0) + 1;
}
```

**Archivo**: `src/components/medicion/Quadrant.svelte`

5. En el bloque `<script>`, agregar un `$effect` que escuche el request:
```typescript
$effect(() => {
    const req = uiStore.simulatedMagnitudeRequest;
    if (req > 0 && !activeMetrics.includes("Simulated Magnitude")) {
        activeMetrics = [...activeMetrics, "Simulated Magnitude"];
    }
});
```

**No avanzar al siguiente prompt.**

---

## Prompt 13: Sección "Cálculo de ecualización" con selector de capa fuente

**Archivo**: `src/components/medicion/Sidebar.svelte`

1. Agregar estado para la selección de capa fuente (en el bloque `<script>`, junto a las otras variables de estado de EQ):
```typescript
let autoEQSourceLayer = $state<string>('active');
```

2. Localizar el botón de AutoEQ actual (el que tiene `onclick={runAutoEQ}`, aprox L1244-1257 original, la posición exacta depende de los cambios del Prompt 12). Reemplazarlo por una sección dedicada:

```svelte
<!-- Sección: Cálculo de ecualización -->
<div class="flex flex-col gap-2 rounded-lg p-3"
     style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
    <span class="text-[9px] font-bold uppercase tracking-wider"
          style="color: var(--text-muted)">Cálculo de ecualización</span>

    <div class="flex flex-col gap-1">
        <label class="text-[9px] font-bold uppercase" style="color: var(--text-muted)">Capa fuente</label>
        <select
            class="w-full rounded-md text-xs py-1.5 px-2"
            style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)"
            bind:value={autoEQSourceLayer}>
            <option value="active">Capa activa</option>
            {#each traceManager.layers as layer}
                <option value={layer.id}>{layer.name}</option>
            {/each}
        </select>
    </div>

    <button
        class="w-full min-h-[38px] bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 border border-[#00ff88]/20 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
        onclick={runAutoEQ}
        disabled={!showEQ || isCalculatingAutoEQ}
    >
        <span class="material-symbols-outlined text-sm"
            >{isCalculatingAutoEQ ? "sync" : "auto_awesome"}</span>
        {isCalculatingAutoEQ
            ? "Calculando..."
            : "Calcular ecualización"}
    </button>
</div>
```

3. La función `runAutoEQ` (aprox L181-199) sigue siendo un placeholder por ahora (valores aleatorios). **No la modifiques en este prompt** — se conectará al motor real en un prompt futuro.

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 14: Capa de ecualizador — estado + renderizado de curva

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. En el bloque `<script>`, agregar las variables de estado:
```typescript
let showEQOverlay = $state(true);
let draggingEQNode = $state<number | null>(null);
let hoveringEQNode = $state<number | null>(null);
```

2. En el dropdown de capas (`showLayerDropdown`, aprox L1271), agregar una entrada fija **al inicio** del listado de capas (antes de `{#each quadrantLayers}`):

```svelte
<!-- Capa fija de EQ (siempre presente) -->
<div class="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]"
     style="background: {showEQOverlay ? '#fbbf2410' : 'transparent'}">
    <button
        class="w-4 h-4 flex items-center justify-center cursor-pointer"
        onclick={() => showEQOverlay = !showEQOverlay}
        title={showEQOverlay ? 'Ocultar ecualizador' : 'Mostrar ecualizador'}>
        <span class="material-symbols-outlined text-[12px]" style="color: {showEQOverlay ? '#fbbf24' : 'var(--text-muted)'}">
            {showEQOverlay ? 'visibility' : 'visibility_off'}
        </span>
    </button>
    <span class="material-symbols-outlined text-[12px]" style="color: #fbbf24">equalizer</span>
    <span class="font-semibold" style="color: {showEQOverlay ? '#fbbf24' : 'var(--text-muted)'}">Ecualizador</span>
</div>
<div class="border-t my-0.5" style="border-color: var(--border-primary)"></div>
```

3. En la función de renderizado del canvas (`drawFrame` o donde se dibujan las capas), **después** de dibujar las capas de medición y **antes** del crosshair, agregar:

```typescript
if (showEQOverlay) {
    drawEQOverlayPath(
        ctx, width, height,
        { color: '#fbbf24', lineWidth: 2, lineDash: [] },
        metricConfigs, interactionState,
        (f) => mathOrchestrator.getEQResponseCached(f),
        mathOrchestrator.BINS
    );
}
```

4. Importar `drawEQOverlayPath` de `canvasRenderers.ts` (se creará en el siguiente prompt).

**No avanzar al siguiente prompt.**

---

## Prompt 15: Función drawEQOverlayPath + nodos de filtro

**Archivo**: `src/lib/dsp/canvasRenderers.ts`

1. Agregar la siguiente función **al final** del archivo:

```typescript
export function drawEQOverlayPath(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: { color: string, lineWidth: number, lineDash: number[] },
    metricConfigs: Record<string, any>,
    state: InteractionState,
    getEQResponseCached: (f: number) => number,
    bins: number
) {
    ctx.setLineDash(style.lineDash || []);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;

    const path = new Path2D();
    const sr = 48000;
    const binWidth = sr / 2 / bins;
    const points: { x: number; y: number }[] = [];

    for (let bin = 1; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        const val = getEQResponseCached(freq);
        const y = valToY(val, height, "Magnitude", metricConfigs, state);
        points.push({ x, y });
    }

    if (points.length > 0) {
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
        if (points.length > 1) {
            path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        }
    }

    ctx.stroke(path);

    // Fill semitransparente bajo la curva hasta 0dB
    const zeroY = valToY(0, height, "Magnitude", metricConfigs, state);
    if (points.length > 1) {
        const fillPath = new Path2D();
        fillPath.moveTo(points[0].x, zeroY);
        for (const p of points) fillPath.lineTo(p.x, p.y);
        fillPath.lineTo(points[points.length - 1].x, zeroY);
        fillPath.closePath();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
        ctx.fill(fillPath);
    }

    ctx.setLineDash([]);
}
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 16: Nodos EQ interactivos — hit testing y drag

**Archivo**: `src/components/medicion/Quadrant.svelte`

1. En el render loop, **después** de la llamada a `drawEQOverlayPath` (agregada en Prompt 14), agregar el dibujado de nodos:

```typescript
if (showEQOverlay) {
    // ... drawEQOverlayPath ya existente ...
    
    // Dibujar nodos de filtros
    const bands = traceManager.eqBands;
    for (let i = 0; i < bands.length; i++) {
        const band = bands[i];
        const x = valToX(band.freq, containerWidth, false, interactionState);
        const gain = mathOrchestrator.getEQResponseCached(band.freq);
        const y = valToY(gain, containerHeight, "Magnitude", metricConfigs, interactionState);

        const isHovered = hoveringEQNode === i;
        const isDragging = draggingEQNode === i;
        const radius = isDragging ? 8 : isHovered ? 7 : 5;

        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = isDragging ? 12 : isHovered ? 8 : 0;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDragging ? '#fbbf24' : isHovered ? '#fcd34d' : '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (isHovered || isDragging) {
            ctx.font = '10px monospace';
            ctx.fillStyle = '#fbbf24';
            ctx.textAlign = 'center';
            ctx.fillText(
                `${band.freq >= 1000 ? (band.freq/1000).toFixed(1)+'k' : band.freq}Hz`,
                x, y - radius - 12
            );
            ctx.fillText(
                `${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)}dB`,
                x, y - radius - 2
            );
        }
    }
}
```

2. En el handler `onmousemove` del canvas, agregar **al inicio** (antes de la lógica de pan):

```typescript
// Hit-test nodos EQ
if (showEQOverlay && draggingEQNode === null) {
    let found = -1;
    for (let i = 0; i < traceManager.eqBands.length; i++) {
        const band = traceManager.eqBands[i];
        const nx = valToX(band.freq, containerWidth, false, interactionState);
        const gain = mathOrchestrator.getEQResponseCached(band.freq);
        const ny = valToY(gain, containerHeight, "Magnitude", metricConfigs, interactionState);
        const dx = mouseX - nx;
        const dy = mouseY - ny;
        if (Math.sqrt(dx*dx + dy*dy) < 12) { found = i; break; }
    }
    hoveringEQNode = found >= 0 ? found : null;
}

// Drag activo de nodo EQ
if (draggingEQNode !== null) {
    const freq = xToVal(mouseX, containerWidth, false, interactionState);
    const gain = yToVal(mouseY, containerHeight, "Magnitude", interactionState);
    const clampedFreq = Math.max(20, Math.min(20000, Math.round(freq)));
    const clampedGain = Math.max(-30, Math.min(30, parseFloat(gain.toFixed(1))));
    traceManager.updateEQBand(draggingEQNode, 'freq', clampedFreq);
    traceManager.updateEQBand(draggingEQNode, 'gain', clampedGain);
}
```

3. En el handler `onmousedown` del canvas, agregar **al inicio** (antes de la lógica de pan):
```typescript
if (showEQOverlay && hoveringEQNode !== null) {
    draggingEQNode = hoveringEQNode;
    e.preventDefault();
    e.stopPropagation();
    return;
}
```

4. En el handler `onmouseup`, agregar **al inicio**:
```typescript
if (draggingEQNode !== null) {
    draggingEQNode = null;
    return;
}
```

5. Actualizar la variable `cursorStyle` derivada para incluir los nodos EQ:
```typescript
let cursorStyle = $derived.by(() => {
    if (draggingEQNode !== null) return 'grabbing';
    if (hoveringEQNode !== null) return 'grab';
    if (interactionState.isDragging) return 'grabbing';
    const mX = interactionState.mouseX;
    const mY = interactionState.mouseY;
    if (mX <= 45) return 'ns-resize';
    if (mY >= containerHeight - 25) return 'ew-resize';
    return 'crosshair';
});
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 17: Función computeDeviation + tabla de desviación en sidebar

**Archivo a crear**: `src/lib/dsp/deviationMetrics.ts`

Crear con este contenido:

```typescript
export interface DeviationResult {
    rms: number;
    peak: number;
    count: number;
}

export function computeDeviation(
    magnitude: Float32Array,
    target: Float32Array | null,
    coherence: Float32Array | null,
    bins: number,
    sampleRate: number = 48000,
    freqMin: number = 20,
    freqMax: number = 20000,
    cohThreshold: number = 0.5
): DeviationResult {
    const binWidth = (sampleRate / 2) / bins;
    let sumSq = 0;
    let maxAbs = 0;
    let count = 0;

    for (let i = 0; i < bins; i++) {
        const freq = i * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        if (coherence && coherence[i] < cohThreshold) continue;

        const measured = magnitude[i] || 0;
        const tgt = target ? (target[i] || 0) : 0;
        const diff = measured - tgt;

        sumSq += diff * diff;
        maxAbs = Math.max(maxAbs, Math.abs(diff));
        count++;
    }

    return {
        rms: count > 0 ? Math.sqrt(sumSq / count) : 0,
        peak: maxAbs,
        count
    };
}
```

**No avanzar al siguiente prompt.**

---

## Prompt 18: Tabla de desviación en el sidebar EQ

**Archivo**: `src/components/medicion/Sidebar.svelte`

1. Importar `computeDeviation` y `DeviationResult`:
```typescript
import { computeDeviation, type DeviationResult } from '$lib/dsp/deviationMetrics';
```

2. Agregar función helper `computeDeviationWithEQ` en el bloque `<script>`:
```typescript
function computeDeviationWithEQ(
    magnitude: Float32Array,
    target: Float32Array | null,
    coherence: Float32Array | null,
    bins: number
): DeviationResult {
    const sampleRate = 48000;
    const binWidth = (sampleRate / 2) / bins;
    const adjusted = new Float32Array(bins);
    for (let i = 0; i < bins; i++) {
        const freq = i * binWidth || 1e-6;
        adjusted[i] = (magnitude[i] || 0) + mathOrchestrator.getEQResponseCached(freq);
    }
    return computeDeviation(adjusted, target, coherence, bins, sampleRate);
}
```

3. Agregar la tabla **después** de la sección "Cálculo de ecualización" (creada en Prompt 13):

```svelte
<!-- Tabla de desviación -->
<div class="flex flex-col gap-1.5 rounded-lg p-3"
     style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
    <span class="text-[9px] font-bold uppercase tracking-wider"
          style="color: var(--text-muted)">Desviación vs target</span>

    <table class="w-full text-[9px]" style="color: var(--text-secondary)">
        <thead>
            <tr class="border-b" style="border-color: var(--border-primary)">
                <th class="text-left py-1 font-semibold" style="color: var(--text-muted)">Capa</th>
                <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">Original</th>
                <th class="text-right py-1 font-semibold" style="color: var(--text-muted)">Ecualizada</th>
            </tr>
        </thead>
        <tbody>
            {#each traceManager.layers.filter(l => l.visible && l.data && l.data.length > 0) as layer}
                {@const target = traceManager.getTargetCurve(mathOrchestrator.BINS, 48000)}
                {@const orig = computeDeviation(layer.data, target, mathOrchestrator.outputCoherence, mathOrchestrator.BINS)}
                {@const eqd = computeDeviationWithEQ(layer.data, target, mathOrchestrator.outputCoherence, mathOrchestrator.BINS)}
                <tr class="border-b" style="border-color: var(--border-primary)">
                    <td class="py-1 truncate max-w-[80px]" title={layer.name}>{layer.name}</td>
                    <td class="text-right py-1 font-mono">
                        <span style="color: {orig.rms > 6 ? '#ff4444' : orig.rms > 3 ? '#fbbf24' : '#00ff88'}">{orig.rms.toFixed(1)}</span>
                        <span style="color: var(--text-muted)">rms</span>
                        / <span>{orig.peak.toFixed(1)}</span>
                        <span style="color: var(--text-muted)">p</span>
                    </td>
                    <td class="text-right py-1 font-mono">
                        <span style="color: {eqd.rms > 6 ? '#ff4444' : eqd.rms > 3 ? '#fbbf24' : '#00ff88'}">{eqd.rms.toFixed(1)}</span>
                        <span style="color: var(--text-muted)">rms</span>
                        / <span>{eqd.peak.toFixed(1)}</span>
                        <span style="color: var(--text-muted)">p</span>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
```

**No avanzar al siguiente prompt.**

---

## Prompt 19: Selector de curva de referencia (target curve)

**Archivo**: `src/lib/stores/traceManager.svelte.ts`

1. Agregar las siguientes propiedades y método a la clase/objeto `traceManager`:

```typescript
targetCurveType = $state<'flat' | 'house' | 'bk' | 'harman' | 'custom'>('flat');
targetCurveCustom = $state<Float32Array | null>(null);

getTargetCurve(bins: number, sampleRate: number = 48000): Float32Array {
    const target = new Float32Array(bins);
    const binWidth = (sampleRate / 2) / bins;

    switch (this.targetCurveType) {
        case 'flat':
            break;
        case 'house':
            for (let i = 0; i < bins; i++) {
                const freq = Math.max(i * binWidth, 1);
                const logPos = (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20));
                target[i] = 3 - 6 * logPos;
            }
            break;
        case 'bk':
            for (let i = 0; i < bins; i++) {
                const freq = Math.max(i * binWidth, 1);
                if (freq > 2000) {
                    target[i] = -3.32 * Math.log10(freq / 2000);
                }
            }
            break;
        case 'harman':
            for (let i = 0; i < bins; i++) {
                const freq = Math.max(i * binWidth, 1);
                let gain = 0;
                if (freq < 200) gain += 4 * (1 - Math.log10(freq / 20) / Math.log10(200 / 20));
                if (freq > 1500 && freq < 5000) {
                    const dist = Math.abs(Math.log2(freq / 3000));
                    if (dist < 1.5) gain -= 1 * (1 - dist / 1.5);
                }
                if (freq > 8000) gain -= 2 * Math.log10(freq / 8000) / Math.log10(20000 / 8000);
                target[i] = gain;
            }
            break;
        case 'custom':
            if (this.targetCurveCustom && this.targetCurveCustom.length === bins) {
                target.set(this.targetCurveCustom);
            }
            break;
    }
    return target;
}
```

**No avanzar al siguiente prompt.**

---

## Prompt 20: UI del selector de curva de referencia en sidebar

**Archivo**: `src/components/medicion/Sidebar.svelte`

1. En la sección "Cálculo de ecualización" (creada en Prompt 13), agregar el selector de curva de referencia **antes** del selector de capa fuente:

```svelte
<div class="flex flex-col gap-1">
    <label class="text-[9px] font-bold uppercase" style="color: var(--text-muted)">Curva de referencia</label>
    <div class="flex gap-1">
        <select
            class="flex-1 rounded-md text-xs py-1.5 px-2"
            style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary)"
            bind:value={traceManager.targetCurveType}>
            <option value="flat">Flat (0dB)</option>
            <option value="house">House curve</option>
            <option value="bk">B&K cinema</option>
            <option value="harman">Harman 2019</option>
            <option value="custom">Personalizada</option>
        </select>
        {#if traceManager.targetCurveType === 'custom'}
            <button
                class="px-2 py-1 rounded text-[9px] font-semibold cursor-pointer"
                style="color: var(--text-muted); border: 1px solid var(--border-primary)"
                onclick={importTargetCurve}
                title="Importar curva target desde JSON">
                <span class="material-symbols-outlined text-[11px]">upload</span>
            </button>
        {/if}
    </div>
</div>
```

2. Agregar la función de importación en el bloque `<script>`:

```typescript
function importTargetCurve() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);
        const points: {freq: number, dB: number}[] = data.points || data;
        const bins = mathOrchestrator.BINS;
        const curve = new Float32Array(bins);
        const binWidth = 24000 / bins;
        for (let i = 0; i < bins; i++) {
            const freq = i * binWidth;
            // Interpolación lineal entre puntos
            let lo = points[0], hi = points[points.length - 1];
            for (let p = 0; p < points.length - 1; p++) {
                if (points[p].freq <= freq && points[p + 1].freq >= freq) {
                    lo = points[p];
                    hi = points[p + 1];
                    break;
                }
            }
            if (hi.freq === lo.freq) { curve[i] = lo.dB; }
            else { curve[i] = lo.dB + (hi.dB - lo.dB) * (freq - lo.freq) / (hi.freq - lo.freq); }
        }
        traceManager.targetCurveCustom = curve;
    };
    input.click();
}
```

**No tocar ningún otro archivo. No avanzar al siguiente prompt.**

---

## Prompt 21: Verificación final

Ejecutar `npm run dev` y verificar los siguientes puntos manualmente:

1. Los botones de tipo de filtro paramétrico muestran las curvas SVG correctas
2. Los SVGs se adaptan al color del tema (currentColor)
3. `low_shelf` y `high_shelf` son tipos separados y funcionales
4. En modo claro, el texto muted es legible
5. No hay sombra debajo del header
6. La topbar es compacta (38px), solo iconos, sin labels
7. Al cambiar el tipo de filtro en el EQ paramétrico, la curva simulada refleja el tipo correcto
8. La curva "Simulated Magnitude" se dibuja suave (sin escalonado)
9. Al hacer zoom out máximo en X, el gráfico muestra exactamente 10Hz a 22kHz
10. La capa de ecualizador aparece en el dropdown de capas con toggle de visibilidad
11. Los nodos de EQ se pueden arrastrar para cambiar freq/gain
12. El switch "Capa de ecualizador" + botón "+ Resp. Simulada" funcionan correctamente
13. La sección "Cálculo de ecualización" muestra selector de capa fuente y curva de referencia
14. La tabla de desviación muestra RMS y pico por capa, con semáforo de colores

Si hay errores de compilación o comportamiento inesperado, reportalos **sin** intentar arreglarlos automáticamente.

**Este es el último prompt. No hay más.**
