# Plan de Refinamiento v5 — Iconos SVG, Contraste Modo Claro, Sombra Header

---

## Problema 1: Reemplazar iconos de filtro paramétrico por SVGs custom

### Contexto actual
- Los botones de tipo de filtro en el EQ paramétrico ([Sidebar.svelte L1484-1507](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L1484-L1507)) usan iconos de Material Symbols (`graphic_eq`, `arrow_downward`, etc.)
- En la carpeta [images/](file:///c:/Users/Abel/Documents/Asistente/asistente/images) hay 7 SVGs custom con curvas de respuesta en frecuencia reales para cada tipo de filtro

### Mapeo SVG → tipo de filtro

| Archivo SVG | Tipo de filtro | Label |
|-------------|---------------|-------|
| `pk.svg` | `peaking` | Peak |
| `lp.svg` | `lowpass` | LP |
| `hp.svg` | `highpass` | HP |
| `ls.svg` | `low_shelf` | LS |
| `hs.svg` | `high_shelf` | HS |
| `notch.svg` | `notch` | Notch |
| `bp.svg` | `bandpass` | BP |

> [!IMPORTANT]
> El tipo `shelving` se separa en `low_shelf` y `high_shelf`. Esto requiere cambios en 12 puntos del código de Sidebar.svelte (ver detalle abajo). No hay impacto DSP ya que no existe lógica de procesamiento que dependa de este tipo.

### Problema técnico con los SVGs
- Los SVGs usan `stroke="black"` hardcodeado. Para que funcionen con el tema (claro/oscuro), necesitan usar `stroke="currentColor"`.
- Son SVGs simples (un solo `<path>` o `<g>` con paths). Se pueden convertir a SVG inline en Svelte o mover a `static/icons/` y cargarlos con `<img>`.

### Cambio requerido

**Opción recomendada**: SVG inline en Svelte (mejor control de color con `currentColor`).

1. Copiar los SVGs a `src/lib/icons/` (o similar) limpiándolos: eliminar DOCTYPE, metadatos, y cambiar `stroke="black"` por `stroke="currentColor"`.

2. Crear un componente o mapa de SVG inline.

3. Reemplazar `<span class="material-symbols-outlined">` por el SVG inline.

### Archivos a modificar

#### [NEW] `src/lib/icons/filterIcons.ts`

Crear un archivo que exporte un mapa de SVGs inline limpios como strings HTML:

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

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. Importar `filterSvgIcons` en el `<script>`.

2. Reemplazar la línea `<span class="material-symbols-outlined text-[16px]">{icons[type] || 'tune'}</span>` (L1507) por:

```svelte
{@html filterSvgIcons[type] || ''}
```

3. Agregar estilos al SVG inline para dimensionarlo correctamente. Envolver en un contenedor:

```svelte
<span class="w-5 h-3 inline-flex items-center justify-center">
    {@html filterSvgIcons[type] || ''}
</span>
```

4. Eliminar el mapa `icons` de constantes inline (L1484-1491) ya que ya no se usa.

5. Actualizar el mapa `labels` inline (L1492-1499) para los nuevos tipos:
```typescript
{@const labels = {
    peaking: 'Peak',
    lowpass: 'LP',
    highpass: 'HP',
    low_shelf: 'LS',
    high_shelf: 'HS',
    notch: 'Notch',
    bandpass: 'BP',
}}
```

### Cambios adicionales para separar shelving → low_shelf + high_shelf

Todos en [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte):

6. **L68** — Tipo en interface `ParametricFilter`:
```typescript
// ANTES:
type: string; // 'peaking' | 'lowpass' | 'highpass' | 'shelving' | 'notch' | 'bandpass'
// DESPUÉS:
type: string; // 'peaking' | 'lowpass' | 'highpass' | 'low_shelf' | 'high_shelf' | 'notch' | 'bandpass'
```

7. **L79-86** — `supportedTypes` del filtro 1 (80Hz):
```typescript
// ANTES:
supportedTypes: ["peaking", "lowpass", "highpass", "shelving", "notch", "bandpass"],
// DESPUÉS:
supportedTypes: ["peaking", "lowpass", "highpass", "low_shelf", "high_shelf", "notch", "bandpass"],
```

8. **L95** — `supportedTypes` del filtro 2 (500Hz):
```typescript
// ANTES:
supportedTypes: ["peaking", "shelving", "notch"],
// DESPUÉS:
supportedTypes: ["peaking", "low_shelf", "high_shelf", "notch"],
```

9. **L113** — `supportedTypes` del filtro 4 (8kHz):
```typescript
// ANTES:
supportedTypes: ["peaking", "lowpass", "shelving"],
// DESPUÉS:
supportedTypes: ["peaking", "lowpass", "low_shelf", "high_shelf"],
```

10. **L1409** — Lista de tipos en la sección de checkboxes de config:
```typescript
// ANTES:
{#each ["peaking", "lowpass", "highpass", "shelving", "notch", "bandpass"] as type}
// DESPUÉS:
{#each ["peaking", "lowpass", "highpass", "low_shelf", "high_shelf", "notch", "bandpass"] as type}
```

11. **L1465-1466** — Etiqueta de checkboxes (el bloque ternario de nombres):
```typescript
// Agregar los dos casos nuevos al chain de ternarios:
type === "low_shelf" ? "Low Shelf" : type === "high_shelf" ? "High Shelf" : ...
```

12. **L1584** — Condición para mostrar ganancia:
```typescript
// ANTES:
{#if ["peaking", "shelving"].includes(filter.type)}
// DESPUÉS:
{#if ["peaking", "low_shelf", "high_shelf"].includes(filter.type)}
```

13. **L1623** — `supportedTypes` del botón "Agregar Filtro":
```typescript
// ANTES:
supportedTypes: ['peaking', 'lowpass', 'highpass', 'shelving', 'notch', 'bandpass'],
// DESPUÉS:
supportedTypes: ['peaking', 'lowpass', 'highpass', 'low_shelf', 'high_shelf', 'notch', 'bandpass'],
```

---

## Problema 2: Modo claro — Mejorar contraste de texto

### Contexto actual
- `--text-primary: #1a1a2e` — oscuro suficiente ✅
- `--text-secondary: #555566` — ratio de contraste sobre `#f5f5f7`: ~5.2:1 (WCAG AA, pero borderline)
- `--text-muted: #888899` — ratio de contraste sobre `#f5f5f7`: ~3.0:1 (**no pasa WCAG AA** para texto normal)

### Cambio requerido
- Oscurecer `--text-secondary` y `--text-muted` para mejorar legibilidad
- `--text-primary` ya es suficiente

### Archivos a modificar

#### [MODIFY] [layout.css](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/layout.css)

1. En el bloque `:root`, cambiar:
```css
/* ANTES: */
--text-secondary: #555566;
--text-muted: #888899;

/* DESPUÉS: */
--text-secondary: #3d3d50;
--text-muted: #6b6b80;
```

> [!NOTE]
> `#3d3d50` sobre `#f5f5f7` = ~7.5:1 (WCAG AAA). `#6b6b80` sobre `#f5f5f7` = ~4.6:1 (WCAG AA).

---

## Problema 3: Eliminar sombra del header

### Contexto actual
- [Header.svelte L311](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte#L311): `box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);`

### Cambio requerido
- Eliminar la línea `box-shadow` de `.global-header`

### Archivos a modificar

#### [MODIFY] [Header.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte)

1. Eliminar la línea:
```css
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
```

---

## Problema 4: BUG DSP — Los filtros paramétricos ignoran el tipo de filtro

> [!CAUTION]
> Bug crítico: cuando el usuario selecciona lowpass, highpass, low_shelf, high_shelf, notch o bandpass en el EQ paramétrico del sidebar, **el DSP sigue aplicando coeficientes peaking**. Esto hace que el tipo de filtro sea puramente cosmético.

### Causa raíz

Hay **3 niveles** de procesamiento DSP, y 2 de ellos ignoran `band.type`:

1. **`calibrationStore.calculateFilterGainAt`** ([calibrationStore.svelte.ts L78-91](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/calibrationStore.svelte.ts#L78-L91)):
   - ✅ **Correcto** — Switch peaking/lowshelf/highshelf con `getCoefficients()`

2. **`mathOrchestrator.updateEQCache`** ([mathOrchestrator.svelte.ts L250-256](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts#L250-L256)):
   - ❌ **BUG** — Siempre `peakingCoeffs(band.freq, band.gain, band.q, sr)`, ignora `band.type`

3. **`mathOrchestrator.getPhaseValueRadians`** ([mathOrchestrator.svelte.ts L286-292](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts#L286-L292)):
   - ❌ **BUG** — Siempre `peakingCoeffs(band.freq, band.gain, band.q, 48000)`, ignora `band.type`

4. **`dspWorker.getPhaseValueRadians`** ([dspWorker.ts L54-82](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/dspWorker.ts#L54-L82)):
   - ❌ **BUG** — Siempre calcula coeficientes peaking inline, ignora `band.type`

5. **`mathOrchestrator.checkDirty`** ([mathOrchestrator.svelte.ts L214-218](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts#L214-L218)):
   - ❌ **BUG** — El hash no incluye `band.type`. Si el usuario cambia el tipo de filtro sin cambiar freq/gain/q, el DSP **no detecta el cambio** y no recalcula el caché de EQ.
   - Mismo problema con `filter.type` de calibrationStore (L220-222).

6. **`dspWorker.getCoherenceValue`** ([dspWorker.ts L147-163](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/dspWorker.ts#L147-L163)):
   - ⚠️ **Menor** — Solo simula caída de coherencia para `band.gain < -5`, lo cual tiene sentido para peaking. Para lowpass/highpass/notch, la atenuación se produce de forma diferente (no por gain negativo). No es un bug funcional pero la coherencia simulada no reflejará correctamente la presencia de filtros LP/HP/notch.

> [!NOTE]
> **EQ Gráfico**: La implementación del EQ gráfico está **correcta**. Usa `type: "peaking"` y `q: 1.414` para todas las bandas (L144-149 de Sidebar.svelte), lo cual es el estándar para EQ gráfico (constant-Q). Las frecuencias se generan con espaciado logarítmico entre 20Hz y 20kHz (L161-168). El DSP procesa correctamente estas bandas porque siempre son peaking.

### Problema adicional: Faltan funciones biquad para lowpass, highpass, notch, bandpass

El archivo [biquad.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/biquad.ts) solo tiene:
- `peakingCoeffs` ✅
- `lowShelfCoeffs` ✅
- `highShelfCoeffs` ✅
- `lowpassCoeffs` ❌ **Falta**
- `highpassCoeffs` ❌ **Falta**
- `notchCoeffs` ❌ **Falta**
- `bandpassCoeffs` ❌ **Falta**

### Cambio requerido

#### [MODIFY] [biquad.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/biquad.ts)

1. Agregar las funciones faltantes (RBJ Audio EQ Cookbook):

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

2. Agregar una función helper que mapee tipo a coeficientes:

```typescript
export function getCoeffsForType(
    type: string, fc: number, gain: number, Q: number, fs: number
): number[] {
    switch (type) {
        case 'peaking':    return peakingCoeffs(fc, gain, Q, fs);
        case 'low_shelf':  return lowShelfCoeffs(fc, gain, Q, fs);
        case 'high_shelf': return highShelfCoeffs(fc, gain, Q, fs);
        case 'lowpass':    return lowpassCoeffs(fc, gain, Q, fs);
        case 'highpass':   return highpassCoeffs(fc, gain, Q, fs);
        case 'notch':      return notchCoeffs(fc, gain, Q, fs);
        case 'bandpass':   return bandpassCoeffs(fc, gain, Q, fs);
        default:           return peakingCoeffs(fc, gain, Q, fs);
    }
}
```

> [!IMPORTANT]
> Los tipos usados en la UI del sidebar (`low_shelf`, `high_shelf`) difieren de los usados en `calibrationStore` (`lowshelf`, `highshelf`). El helper `getCoeffsForType` debe aceptar ambas variantes, o bien actualizar `calibrationStore` para usar los nuevos nombres. **Decisión recomendada**: agregar alias en el switch:
> ```typescript
> case 'low_shelf': case 'lowshelf':  return lowShelfCoeffs(fc, gain, Q, fs);
> case 'high_shelf': case 'highshelf': return highShelfCoeffs(fc, gain, Q, fs);
> ```

#### [MODIFY] [mathOrchestrator.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts)

3. Importar `getCoeffsForType` de biquad.ts (agregar al import existente).

4. En `updateEQCache` (L250-256), reemplazar:
```typescript
// ANTES (L253):
const coeffs = peakingCoeffs(band.freq, band.gain, band.q, sr);

// DESPUÉS:
const coeffs = getCoeffsForType(band.type, band.freq, band.gain, band.q, sr);
```

5. Además, en este bloque, la condición `if (band.gain !== 0)` solo es correcta para peaking/shelf. Para lowpass/highpass/notch/bandpass, el filtro tiene efecto incluso con gain=0. Cambiar a:
```typescript
// ANTES:
if (band.gain !== 0) {

// DESPUÉS:
if (band.gain !== 0 || !['peaking', 'low_shelf', 'high_shelf'].includes(band.type)) {
```

6. En `getPhaseValueRadians` (L286-292), mismo patrón:
```typescript
// ANTES (L289):
const coeffs = peakingCoeffs(band.freq, band.gain, band.q, 48000);

// DESPUÉS:
const coeffs = getCoeffsForType(band.type, band.freq, band.gain, band.q, 48000);
```

Y la misma corrección de la condición:
```typescript
// ANTES:
if (band.gain !== 0) {

// DESPUÉS:
if (band.gain !== 0 || !['peaking', 'low_shelf', 'high_shelf'].includes(band.type)) {
```

#### [MODIFY] [dspWorker.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/dspWorker.ts)

7. En `getPhaseValueRadians` del worker (L54-82), el bloque de `eqBands` calcula coeficientes peaking inline. Reemplazar con un switch equivalente al de `calibrationFilters` (L85-137). El bloque debe quedar:

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

> [!NOTE]
> El worker no puede importar módulos (es un Web Worker autónomo), por eso los coeficientes se calculan inline en vez de usar `getCoeffsForType`.

#### Fix para Bug #5: checkDirty no detecta cambio de tipo

Volver a [mathOrchestrator.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/mathOrchestrator.svelte.ts):

8. En `checkDirty` (L214-222), incluir `band.type` y `filter.type` en el hash:
```typescript
// ANTES (L217):
bandsHash += band.freq * 1e6 + band.gain * 1e3 + band.q;

// DESPUÉS:
bandsHash += band.freq * 1e6 + band.gain * 1e3 + band.q + (band.type ? band.type.charCodeAt(0) * 100 : 0);
```

```typescript
// ANTES (L221):
bandsHash += filter.frequency * 1e6 + filter.gain * 1e3 + filter.q + (filter.enabled ? 1 : 0);

// DESPUÉS:
bandsHash += filter.frequency * 1e6 + filter.gain * 1e3 + filter.q + (filter.enabled ? 1 : 0) + (filter.type ? filter.type.charCodeAt(0) * 100 : 0);
```

#### Fix para Bug #6: getCoherenceValue para filtros no-peaking (menor)

En [dspWorker.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/dspWorker.ts):

9. En `getCoherenceValue` (L152-158), ampliar la lógica para simular caída de coherencia también para lowpass/highpass/notch:
```typescript
// ANTES:
for (let b = 0; b < eqBands.length; b++) {
    const band = eqBands[b];
    if (band.gain < -5) {
        const dist = Math.abs(Math.log2(freq / band.freq));
        if (dist < 0.25) coh -= 0.18 * (1 - dist / 0.25);
    }
}

// DESPUÉS:
for (let b = 0; b < eqBands.length; b++) {
    const band = eqBands[b];
    if (band.gain < -5) {
        const dist = Math.abs(Math.log2(freq / band.freq));
        if (dist < 0.25) coh -= 0.18 * (1 - dist / 0.25);
    }
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
}
```

#### [MODIFY] [calibrationStore.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/calibrationStore.svelte.ts)

8. Actualizar la interfaz `EQFilter` (L12) para aceptar los nuevos tipos:
```typescript
// ANTES:
type: 'peaking' | 'highshelf' | 'lowshelf';

// DESPUÉS:
type: 'peaking' | 'highshelf' | 'lowshelf' | 'high_shelf' | 'low_shelf' | 'lowpass' | 'highpass' | 'notch' | 'bandpass';
```

9. Actualizar `getCoefficients` (L78-91) para aceptar los nuevos tipos:
```typescript
getCoefficients(filter: EQFilter): number[] | null {
    const fc = filter.frequency;
    const G = filter.gain;
    const Q = filter.q;
    const fs = this.sampleRate;

    switch (filter.type) {
        case 'peaking':    return peakingCoeffs(fc, G, Q, fs);
        case 'lowshelf':   case 'low_shelf':  return lowShelfCoeffs(fc, G, Q, fs);
        case 'highshelf':  case 'high_shelf': return highShelfCoeffs(fc, G, Q, fs);
        case 'lowpass':    return lowpassCoeffs(fc, G, Q, fs);
        case 'highpass':   return highpassCoeffs(fc, G, Q, fs);
        case 'notch':      return notchCoeffs(fc, G, Q, fs);
        case 'bandpass':   return bandpassCoeffs(fc, G, Q, fs);
        default:           return null;
    }
}
```

10. Actualizar el import de biquad.ts para incluir las funciones nuevas:
```typescript
import { peakingCoeffs, lowShelfCoeffs, highShelfCoeffs, lowpassCoeffs, highpassCoeffs, notchCoeffs, bandpassCoeffs, biquadResponse } from '../dsp/biquad';
```

---

## Problema 5: Simulated Magnitude usa gráfico escalonado en vez de curva suave

### Contexto actual

Las funciones de dibujado de magnitud usan dos patrones distintos:

| Función | Método | Resultado |
|---------|--------|-----------|
| `drawMetricPath` (L534-628) | Puntos por bin FFT → `quadraticCurveTo` spline | **Suave** ✅ |
| `drawSpectrumPath` (L630-708) | Puntos por bin FFT → `quadraticCurveTo` spline | **Suave** ✅ |
| `drawSimulatedMagnitudePath` (L748-808) | Pixel por pixel → `lineTo` | **Escalonado** ❌ |

### Causa
`drawSimulatedMagnitudePath` itera `for (x = 0; x < width; x++)` y usa `lineTo(x, y)` directamente. La resolución pixel-a-pixel con `frequencyLUT` (que mapea pixel→bin) produce saltos escalonados porque múltiples pixeles consecutivos pueden mapear al mismo bin FFT.

### Cambio requerido

#### [MODIFY] [canvasRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts)

Refactorizar `drawSimulatedMagnitudePath` (L748-808) para usar el mismo patrón de puntos + spline que `drawMetricPath`:

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

    // Construir array de puntos por bin FFT (igual que drawMetricPath)
    const points: {x: number, y: number}[] = [];

    for (let bin = 0; bin < bins; bin++) {
        const freq = bin * binWidth;
        if (freq < freqMin || freq > freqMax) continue;
        const x = valToX(freq, width, false, state);
        if (x < -10 || x > width + 10) continue;

        // Coherence masking
        if (cfg.enableCoherence && interpCoherence[bin] < cfg.coherenceThreshold) continue;

        // Smooth data log based on PPO config
        let val = getPPOSmoothedValue(bin, interpMagnitude, cfg.smoothingPPO);
        const f = bin * binWidth || 1e-6;
        const eqGain = getEQResponseCached(f);
        
        val = val + eqGain;

        // Mode Y transformations
        if (cfg.modeY === "Linear") {
            val = Math.pow(10, val / 20);
        } else if (cfg.modeY === "Impedance") {
            val = Math.pow(10, val / 20) * (cfg.sensorResistance || 10);
        }

        const y = valToY(val, height, "Simulated Magnitude", metricConfigs, state) + (cfg.yShift || 0);
        points.push({ x, y });
    }

    // Dibujar con spline (quadratic curve through midpoints)
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

> [!NOTE]
> El cambio principal es: en vez de iterar por pixel (`for x`) y usar `frequencyLUT[x]` para obtener el bin, ahora iteramos por bin FFT directamente (igual que `drawMetricPath`) y calculamos la posición x con `valToX`. Esto produce una curva suave porque los puntos se interpolan con `quadraticCurveTo`.

---

## Problema 6: Zoom out en X permite ver más allá de 10Hz-22kHz

### Contexto actual
- El mínimo de `zoomX` es `0.5` ([canvasInteraction.ts L217](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts#L217) y [L323](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts#L323))
- A `zoomX = 1.0`, el rango visible es exactamente `freqMin` (10Hz) a `freqMax` (22kHz) → cubre la pantalla
- A `zoomX = 0.5`, el rango visible es el doble, mostrando frecuencias fuera de los límites útiles
- `clampPan` solo impide que se haga *pan* más allá de los límites, pero no impide que al hacer zoom out se vea área vacía

### Cambio requerido

#### [MODIFY] [canvasInteraction.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasInteraction.ts)

1. En `handleWheel` (L217), cambiar el mínimo de zoomX:
```typescript
// ANTES:
state.zoomX = Math.max(0.5, Math.min(4, state.zoomX * delta));

// DESPUÉS:
state.zoomX = Math.max(1, Math.min(4, state.zoomX * delta));
```

2. En `handleTouchMove` (L323), mismo cambio:
```typescript
// ANTES:
state.zoomX = Math.max(0.5, Math.min(4, state.touchStartScaleX * factor));

// DESPUÉS:
state.zoomX = Math.max(1, Math.min(4, state.touchStartScaleX * factor));
```

> [!NOTE]
> El mínimo de `zoomY` se mantiene en `0.5` (L225 y L324) porque en Y tiene sentido poder ver más rango de dB. Solo el eje X se clampea a `1.0` porque las frecuencias fuera de 10Hz-22kHz no tienen datos útiles.

---

## Problema 7: Capa de visualización y manipulación interactiva de EQ

> [!IMPORTANT]
> Feature nueva de dos niveles: (1) Visualizar la curva de EQ aislada como capa en el cuadrante, (2) Manipular filtros arrastrando nodos directamente en el gráfico.

### Arquitectura

La capa de EQ es **diferente** a las capas de medición normales (`MeasurementLayer`). Las capas normales tienen un `Float32Array` de datos medidos. La capa de EQ genera sus datos **analíticamente** desde `mathOrchestrator.eqResponseCache` y muestra nodos interactivos.

Se implementa como una **capa virtual permanente y fija** en el cuadrante. Siempre está presente en la lista de capas, pero puede ocultarse con un toggle de visibilidad (igual que las demás capas). No se agrega ni se quita desde el menú "Agregar capa".

### Nivel 1: Visualización pasiva (curva de EQ)

#### Estado

En [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte):

```typescript
let showEQOverlay = $state(true); // Permanente, visible por defecto, ocultable
```

#### Dibujado

##### [NEW] Función `drawEQOverlayPath` en [canvasRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasRenderers.ts)

```typescript
/**
 * Dibuja la curva aislada de EQ (respuesta en frecuencia de los filtros, centrada en 0dB).
 * Usa el patrón de puntos + spline quadrática para curva suave.
 */
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

    // Spline suave
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
        ctx.fillStyle = style.color.replace(')', ', 0.08)').replace('rgb', 'rgba');
        ctx.fill(fillPath);
    }

    ctx.setLineDash([]);
}
```

##### Invocación en el render loop de Quadrant.svelte

En la función `drawFrame` (después de dibujar capas, antes del crosshair), agregar:

```typescript
// Dibujar capa de EQ overlay
if (showEQOverlay) {
    drawEQOverlayPath(
        ctx, width, height,
        { color: '#fbbf24', lineWidth: 2, lineDash: [] },
        metricConfigs, interactionState,
        (f) => mathOrchestrator.getEQResponseCached(f),
        mathOrchestrator.BINS
    );

    // Dibujar nodos de filtros (Nivel 2)
    drawEQFilterNodes(ctx, width, height, interactionState, metricConfigs);
}
```

#### Capa fija en la lista de capas del dropdown

En el dropdown de capas (`showLayerDropdown`, L1271-1365 de Quadrant.svelte), agregar una entrada fija **al inicio** de la lista de capas (antes del `{#each quadrantLayers}`):

```svelte
<!-- Capa fija de EQ (siempre presente) -->
<div class="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]"
     style="background: {showEQOverlay ? '#fbbf2410' : 'transparent'}">
    <button
        class="w-4 h-4 flex items-center justify-center cursor-pointer"
        onclick={() => showEQOverlay = !showEQOverlay}
        title={showEQOverlay ? 'Ocultar EQ' : 'Mostrar EQ'}>
        <span class="material-symbols-outlined text-[12px]" style="color: {showEQOverlay ? '#fbbf24' : 'var(--text-muted)'}">
            {showEQOverlay ? 'visibility' : 'visibility_off'}
        </span>
    </button>
    <span class="material-symbols-outlined text-[12px]" style="color: #fbbf24">equalizer</span>
    <span class="font-semibold" style="color: {showEQOverlay ? '#fbbf24' : 'var(--text-muted)'}">Ecualización</span>
</div>
<div class="border-t my-0.5" style="border-color: var(--border-primary)"></div>
```

---

### Nivel 2: Manipulación interactiva (nodos arrastrables)

#### Estado adicional en Quadrant.svelte

```typescript
// Estado para drag interactivo de nodos EQ
let draggingEQNode = $state<number | null>(null); // Índice del filtro siendo arrastrado
let hoveringEQNode = $state<number | null>(null);  // Índice del filtro bajo el cursor
```

#### Función de dibujado de nodos

En el render loop, después de dibujar la curva de EQ:

```typescript
function drawEQFilterNodes(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: InteractionState,
    metricConfigs: Record<string, any>
) {
    const bands = traceManager.eqBands;
    for (let i = 0; i < bands.length; i++) {
        const band = bands[i];
        const x = valToX(band.freq, width, false, state);
        const gain = mathOrchestrator.getEQResponseCached(band.freq);
        const y = valToY(gain, height, "Magnitude", metricConfigs, state);

        const isHovered = hoveringEQNode === i;
        const isDragging = draggingEQNode === i;
        const radius = isDragging ? 8 : isHovered ? 7 : 5;

        // Sombra
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = isDragging ? 12 : isHovered ? 8 : 0;

        // Círculo
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDragging ? '#fbbf24' : isHovered ? '#fcd34d' : '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Label (freq + gain)
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

#### Hit-testing y manejo de eventos

En [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte), agregar lógica de hit-test en los handlers de mouse existentes:

##### En `onmousemove` del canvas:

```typescript
// Hit-test nodos EQ (solo si overlay está activo)
if (showEQOverlay && !draggingEQNode) {
    let found = -1;
    for (let i = 0; i < traceManager.eqBands.length; i++) {
        const band = traceManager.eqBands[i];
        const nx = valToX(band.freq, containerWidth, false, interactionState);
        const gain = mathOrchestrator.getEQResponseCached(band.freq);
        const ny = valToY(gain, containerHeight, "Magnitude", metricConfigs, interactionState);
        const dx = mouseX - nx;
        const dy = mouseY - ny;
        if (Math.sqrt(dx*dx + dy*dy) < 12) {
            found = i;
            break;
        }
    }
    hoveringEQNode = found >= 0 ? found : null;
}

// Drag activo de nodo EQ
if (draggingEQNode !== null) {
    const freq = xToVal(mouseX, containerWidth, false, interactionState);
    const gain = yToVal(mouseY, containerHeight, "Magnitude", interactionState);
    // Clamp freq a 20-20000
    const clampedFreq = Math.max(20, Math.min(20000, Math.round(freq)));
    // Clamp gain a ±30dB
    const clampedGain = Math.max(-30, Math.min(30, parseFloat(gain.toFixed(1))));
    traceManager.updateEQBand(draggingEQNode, 'freq', clampedFreq);
    traceManager.updateEQBand(draggingEQNode, 'gain', clampedGain);
}
```

##### En `onmousedown` del canvas:

```typescript
// Iniciar drag de nodo EQ si hover activo
if (showEQOverlay && hoveringEQNode !== null) {
    draggingEQNode = hoveringEQNode;
    e.preventDefault();
    e.stopPropagation(); // No iniciar pan del canvas
    return;
}
```

##### En `onmouseup`:

```typescript
if (draggingEQNode !== null) {
    draggingEQNode = null;
    return;
}
```

#### Cursor

Actualizar `cursorStyle` para reflejar nodos EQ:

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

> [!NOTE]
> **Diseño**: La capa de EQ es permanente en el cuadrante (no se agrega/quita). Se oculta/muestra con `showEQOverlay`. Los nodos se mapean directamente a `traceManager.eqBands`, que es la misma fuente de datos que usa el sidebar de EQ paramétrico — por lo tanto, arrastrar un nodo actualiza automáticamente los sliders del sidebar y viceversa.

> [!IMPORTANT]
> **yToVal para Magnitude**: Actualmente `yToVal` recibe `metricType: string` y devuelve el valor en la unidad de esa métrica. Verificar que acepta `"Magnitude"` y devuelve dB. Si la implementación actual de `yToVal` no soporta métricas por nombre, habrá que agregar esa lógica.

---

## Problema 8: AutoEQ con selección de capa fuente

> [!IMPORTANT]
> Actualmente `runAutoEQ` (L181-199 de Sidebar.svelte) genera valores aleatorios. El motor real `AutoEq.deriveFilters` (en `AutoEq.ts`) existe pero no está conectado. Este problema conecta el motor real y agrega selección de capa.

### Estado actual

- [AutoEq.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/AutoEq.ts) tiene `deriveFilters(measured, target, coherence, agnosticMode, sampleRate)` que devuelve `EQFilter[]`
- [Sidebar.svelte L181-199](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte#L181-L199) — `runAutoEQ` usa `Math.random()` como placeholder
- Las capas de medición (`traceManager.layers`) contienen `data: Float32Array` con datos de magnitud

### Cambio requerido

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. Agregar estado para selección de capa fuente:
```typescript
let autoEQSourceLayer = $state<string>('active'); // 'active' | layer.id
```

2. Agregar UI de selección de capa antes del botón AutoEQ (L1244):
```svelte
<div class="flex flex-col gap-1">
    <label class="text-[9px] font-bold uppercase" style="color: var(--text-muted)">Capa fuente</label>
    <select
        class="w-full rounded-md text-xs py-1.5 px-2"
        style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-primary)"
        bind:value={autoEQSourceLayer}>
        <option value="active">Capa activa</option>
        {#each traceManager.layers as layer}
            <option value={layer.id}>{layer.name}</option>
        {/each}
    </select>
</div>
```

3. Reemplazar `runAutoEQ` (L181-199) para conectar con el motor real:
```typescript
import { AutoEq } from '$lib/dsp/AutoEq';
import { mathOrchestrator } from '$lib/stores/mathOrchestrator.svelte';

function runAutoEQ() {
    isCalculatingAutoEQ = true;
    statusText = "Calculando curva de corrección AutoEQ...";
    
    setTimeout(() => {
        // 1. Obtener datos de la capa fuente
        let sourceData: Float32Array;
        if (autoEQSourceLayer === 'active') {
            sourceData = mathOrchestrator.outputMagnitude;
        } else {
            const layer = traceManager.layers.find(l => l.id === autoEQSourceLayer);
            sourceData = layer?.data || mathOrchestrator.outputMagnitude;
        }
        
        if (!sourceData || sourceData.length === 0) {
            statusText = "Error: no hay datos en la capa seleccionada";
            isCalculatingAutoEQ = false;
            return;
        }
        
        // 2. Generar curva objetivo (flat a 0dB, o configurable en el futuro)
        const target = new Float32Array(sourceData.length); // flat = 0dB
        
        // 3. Obtener coherencia
        const coherence = mathOrchestrator.outputCoherence || new Float32Array(sourceData.length).fill(1);
        
        // 4. Derivar filtros
        const filters = AutoEq.deriveFilters(sourceData, target, coherence, false, 48000);
        
        // 5. Aplicar filtros derivados al EQ paramétrico
        if (filters.length > 0) {
            parametricFilters = filters.map((f, i) => ({
                freq: f.frequency,
                gain: f.gain,
                q: f.q,
                type: f.type || 'peaking',
                supportedTypes: ['peaking', 'lowpass', 'highpass', 'low_shelf', 'high_shelf', 'notch', 'bandpass'],
                showConfig: false,
            }));
            eqType = 'parametrico';
        }
        
        isCalculatingAutoEQ = false;
        statusText = `AutoEQ: ${filters.length} filtros generados`;
    }, 100);
}
```

> [!NOTE]
> La curva objetivo por ahora es flat (0dB). En el futuro podría configurarse como "target curve" personalizada (ej: Harman, house curve, etc).

---

## Problema 9: Rediseño del panel de EQ — separación de conceptos

### Tres conceptos distintos

| # | Concepto | Qué es | Dónde se controla | Cómo se visualiza |
|---|----------|--------|-------------------|-------------------|
| 1 | **Capa de ecualizador** | Curva de EQ aislada + nodos | Switch en sidebar + toggle en dropdown de capas | Curva dorada + nodos arrastrables |
| 2 | **Respuesta simulada** | Magnitud + EQ aplicada | **Pill** en el cuadrante (como cualquier métrica) | Curva cyan "Simulated Magnitude" |
| 3 | **Cálculo de ecualización** | AutoEQ: derivar parámetros | Sección en sidebar con selector de capa + botón | Sin visualización propia |

### Contexto actual

El panel de EQ en [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte) tiene:
1. **Checkbox "Habilitar Ecualización"** (L1229-1242) — controla `showEQ`, oculta el panel y limpia `eqBands`
2. **Botón grande "Simular Respuesta"** (L1649-1669) — toggle de `uiStore.isSimulating` anclado al fondo

Ambos se reemplazan.

### Cambio requerido

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

1. **Reemplazar** el bloque "Controles Superiores" (L1225-1258) por:

```svelte
<!-- Controles Superiores -->
<div class="flex flex-col gap-3 rounded-lg p-4"
     style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">

    <!-- Switch: Capa de ecualizador -->
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
        <!-- Atajo: agregar pill "Simulated Magnitude" a todos los cuadrantes -->
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

2. **Mover** el selector de tipo EQ (Gráfico/Paramétrico) y controles de filtros **fuera** del `{#if showEQ}`. El panel de controles siempre se muestra.

3. **Reemplazar** la sección de AutoEQ. El botón actual (L1244-1257) se integra en una sección dedicada al final de los controles:

```svelte
<!-- Sección: Cálculo de ecualización -->
<div class="flex flex-col gap-2 rounded-lg p-3"
     style="background: var(--bg-tertiary); border: 1px solid var(--border-primary)">
    <span class="text-[9px] font-bold uppercase tracking-wider"
          style="color: var(--text-muted)">Cálculo de ecualización</span>

    <!-- Selector de capa fuente -->
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

    <!-- Botón calcular -->
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

4. **Eliminar** el botón "Simular Respuesta" anclado al fondo (L1649-1670).

5. **Eliminar** el `{#if showEQ}` / `{:else}` (L1260, L1637-1647). El panel siempre se muestra.

#### [MODIFY] [ui.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/ui.svelte.ts)

Agregar método helper para el atajo de respuesta simulada:

```typescript
/**
 * Emite un evento para que todos los cuadrantes agreguen "Simulated Magnitude" a sus métricas activas.
 */
addSimulatedMagnitudeToAll() {
    this.simulatedMagnitudeRequest = (this.simulatedMagnitudeRequest || 0) + 1;
}
simulatedMagnitudeRequest = $state(0);
```

#### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

Agregar `$effect` que escucha el request y agrega la métrica:

```typescript
$effect(() => {
    const _ = uiStore.simulatedMagnitudeRequest;
    if (_ > 0 && !activeMetrics.includes("Simulated Magnitude")) {
        activeMetrics = [...activeMetrics, "Simulated Magnitude"];
    }
});
```

> [!IMPORTANT]
> **`showEQ` sigue existiendo**. Controla si la ecualización se aplica al DSP (L138 limpia `eqBands` al desactivar) y la visibilidad de la capa de ecualizador en el cuadrante (P7). La etiqueta es "Capa de ecualizador", color dorado `#fbbf24`.

> [!NOTE]
> **La respuesta simulada es un pill**, no un switch. El botón "+ Resp. Simulada" es solo un atajo para agregarla a todos los cuadrantes de una vez. El usuario también puede agregarla manualmente desde el menú de métricas de cada cuadrante individual.

---

## Problema 10: Tabla de desviación de respuesta en el panel de EQ

### Concepto

Mostrar una tabla compacta en el panel de EQ que evalúe la calidad de la respuesta por capa:

```
┌─────────────────────────────────────────────┐
│ DESVIACIÓN vs TARGET                        │
│                                             │
│ Capa          │ Original     │ Ecualizada   │
│───────────────┼──────────────┼──────────────│
│ Capa 1        │ 5.2rms/+14p  │ 1.8rms/+4.2p │
│ Avg           │ 4.8rms/+11p  │ 1.5rms/+3.1p │
└─────────────────────────────────────────────┘
```

- **Original**: desviación de la magnitud cruda vs target
- **Ecualizada**: desviación de la magnitud + EQ aplicada vs target
- **Target**: flat (0dB) por defecto, configurable a futuro
- **Ponderación por coherencia**: bins con coherencia < 0.5 se ignoran

### Cambio requerido

#### [NEW] Función `computeDeviation` en [biquad.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/biquad.ts) o archivo nuevo `deviationMetrics.ts`

```typescript
export interface DeviationResult {
    rms: number;   // dB RMS deviation
    peak: number;  // dB peak (absolute max) deviation
    count: number; // bins válidos usados
}

/**
 * Calcula la desviación RMS y pico de una respuesta vs un target,
 * ponderada por coherencia.
 * @param magnitude  - Float32Array con valores en dB
 * @param target     - Float32Array target (o null = flat 0dB)
 * @param coherence  - Float32Array coherencia (0-1), bins < threshold se ignoran
 * @param bins       - cantidad de bins
 * @param sampleRate - sample rate (para calcular rango de freq)
 * @param freqMin    - frecuencia mínima del rango (default 20)
 * @param freqMax    - frecuencia máxima del rango (default 20000)
 * @param cohThreshold - umbral de coherencia (default 0.5)
 */
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

        // Filtrar por coherencia
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

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

Agregar la tabla después de la sección "Cálculo de ecualización":

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
            {#each traceManager.layers.filter(l => l.visible && l.data.length > 0) as layer}
                {@const orig = computeDeviation(layer.data, null, mathOrchestrator.outputCoherence, mathOrchestrator.BINS)}
                {@const eqd = computeDeviationWithEQ(layer.data, null, mathOrchestrator.outputCoherence, mathOrchestrator, mathOrchestrator.BINS)}
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

La función `computeDeviationWithEQ` es un wrapper que suma `getEQResponseCached(freq)` a cada bin antes de calcular:

```typescript
function computeDeviationWithEQ(
    magnitude: Float32Array,
    target: Float32Array | null,
    coherence: Float32Array | null,
    orchestrator: MathOrchestrator,
    bins: number
): DeviationResult {
    const sampleRate = 48000;
    const binWidth = (sampleRate / 2) / bins;
    const adjusted = new Float32Array(bins);
    for (let i = 0; i < bins; i++) {
        const freq = i * binWidth || 1e-6;
        adjusted[i] = (magnitude[i] || 0) + orchestrator.getEQResponseCached(freq);
    }
    return computeDeviation(adjusted, target, coherence, bins, sampleRate);
}
```

> [!NOTE]
> Los colores del valor RMS usan semáforo: verde `<3dB` (excelente), dorado `3-6dB` (aceptable), rojo `>6dB` (pobre). Esto es consistente con los estándares de la industria de audio profesional.

---

## Problema 11: Selector de curva de referencia (target curve)

### Concepto

Un selector compartido de curva de referencia que alimenta:
- **P10**: tabla de desviación (compara medición vs target)
- **P8**: cálculo de ecualización (AutoEQ busca acercar la respuesta al target)
- **P7**: opcionalmente, dibujar la curva target como línea punteada en el cuadrante

### Curvas predefinidas

| Nombre | Descripción | Fórmula |
|--------|-------------|---------|
| **Flat** | 0dB en todo el rango | `target[i] = 0` |
| **House curve** | +3dB en graves, -3dB en agudos, transición suave | Tilt lineal en log-freq |
| **B&K house** | Curva Brüel & Kjær para salas de cine | Rolloff gradual desde 2kHz |
| **Harman** | Curva de preferencia Harman 2019 | Boost en graves, dip en presencia |
| **Personalizada** | Importada desde archivo JSON | Array de puntos `{freq, dB}` |

### Cambio requerido

#### [MODIFY] [traceManager.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/traceManager.svelte.ts)

Agregar estado reactivo para la curva target:

```typescript
// Curva de referencia (target)
targetCurveType = $state<'flat' | 'house' | 'bk' | 'harman' | 'custom'>('flat');
targetCurveCustom = $state<Float32Array | null>(null); // Solo para 'custom'

/**
 * Genera el Float32Array de la curva target para N bins.
 */
getTargetCurve(bins: number, sampleRate: number = 48000): Float32Array {
    const target = new Float32Array(bins);
    const binWidth = (sampleRate / 2) / bins;

    switch (this.targetCurveType) {
        case 'flat':
            // target ya es 0dB (Float32Array inicializa en 0)
            break;

        case 'house':
            // Tilt: +3dB @ 20Hz, 0dB @ 1kHz, -3dB @ 20kHz (lineal en log-freq)
            for (let i = 0; i < bins; i++) {
                const freq = Math.max(i * binWidth, 1);
                const logPos = (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20));
                target[i] = 3 - 6 * logPos; // +3 to -3
            }
            break;

        case 'bk':
            // B&K: flat hasta 2kHz, rolloff -1dB/octava después
            for (let i = 0; i < bins; i++) {
                const freq = Math.max(i * binWidth, 1);
                if (freq > 2000) {
                    target[i] = -3.32 * Math.log10(freq / 2000); // -1dB/octava ≈ -3.32*log10(ratio)
                }
            }
            break;

        case 'harman':
            // Harman 2019 simplificada: +4dB bass shelf < 200Hz, -1dB 2-4kHz dip
            for (let i = 0; i < bins; i++) {
                const freq = Math.max(i * binWidth, 1);
                let gain = 0;
                // Bass shelf
                if (freq < 200) gain += 4 * (1 - Math.log10(freq / 20) / Math.log10(200 / 20));
                // Presence dip
                if (freq > 1500 && freq < 5000) {
                    const center = 3000;
                    const width = 1.5; // octavas
                    const dist = Math.abs(Math.log2(freq / center));
                    if (dist < width) gain -= 1 * (1 - dist / width);
                }
                // Treble rolloff suave
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

#### [MODIFY] [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte)

Agregar selector de curva target en la sección de "Cálculo de ecualización" (antes del selector de capa fuente):

```svelte
<!-- Curva de referencia -->
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

Función de importación:
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
        // Formato esperado: { points: [{freq, dB}, ...] } o array directo
        const points = data.points || data;
        // Interpolar a bins
        const bins = mathOrchestrator.BINS;
        const curve = new Float32Array(bins);
        const binWidth = 24000 / bins;
        for (let i = 0; i < bins; i++) {
            const freq = i * binWidth;
            // Interpolación lineal entre puntos
            curve[i] = interpolatePoints(points, freq);
        }
        traceManager.targetCurveCustom = curve;
    };
    input.click();
}
```

#### Integración con P8 y P10

En `runAutoEQ` (P8), reemplazar la línea de target flat:
```typescript
// ANTES:
const target = new Float32Array(sourceData.length); // flat = 0dB

// DESPUÉS:
const target = traceManager.getTargetCurve(sourceData.length, 48000);
```

En la tabla de desviación (P10), pasar el target:
```typescript
// ANTES:
computeDeviation(layer.data, null, ...)

// DESPUÉS:
const target = traceManager.getTargetCurve(mathOrchestrator.BINS, 48000);
computeDeviation(layer.data, target, ...)
```

> [!NOTE]
> Las curvas predefinidas (house, B&K, Harman) son **aproximaciones analíticas** simplificadas. Son suficientes para uso práctico. En el futuro se podrían reemplazar por datos tabulados de alta precisión.

---

## Problema 12: Simplificar topbar — solo iconos, sin labels, menos altura

### Contexto actual

El [Header.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte) tiene:
- Logo + título largo ("Herramienta para mediciones de audio")
- Generador: botón toggle + label "Generador" + nombre de señal (2 líneas de texto)
- Medición: botón modo + botón "Medir/Midiendo" **con texto**
- Grilla: icono + label "2x1" dentro de contenedor con padding
- Vúmetro: IN/OUT con LED
- Altura: `54px`, contenedores con `p-1.5 px-3 rounded-xl` que agregan padding vertical innecesario
- `box-shadow` debajo (ya eliminada en P3, pero verificar)

### Cambio requerido

#### [MODIFY] [Header.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte)

1. **Reducir altura** de `54px` a `38px` en `.global-header`

2. **Reemplazar** toda la estructura del `header-right` por botones de icono puro + separadores:

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
        class="header-btn"
        style="color: {uiStore.isMeasuring ? '#ef4444' : 'var(--text-muted)'};"
        onclick={toggleMeasurement}
        title={uiStore.isMeasuring ? "Detener medición" : "Iniciar medición"}
    >
        <span class="material-symbols-outlined text-[16px]">podcasts</span>
    </button>

    <div class="header-sep"></div>

    <!-- AutoEQ -->
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
        <!-- Dropdown de grilla (se mantiene igual internamente) -->
        {#if showGridDropdown}
            ...existing dropdown...
        {/if}
    </div>

    <div class="header-sep"></div>

    <!-- Vúmetro compacto -->
    <div class="vu-outer-container" ...>
        ...existing VU meters...
    </div>
</div>
```

3. **Agregar estilos** para los botones y separadores:

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
}

.header-btn:hover {
    background: var(--bg-tertiary);
}

.header-sep {
    width: 1px;
    height: 18px;
    background: var(--border-primary);
}
```

4. **Eliminar** del template:
   - La etiqueta "Generador" + nombre de señal (div L123-137)
   - El texto "Medir"/"Midiendo" del botón de medición (L168)
   - El label "2x1" del botón de grilla (L184-185)
   - El contenedor `rounded-xl` con padding (L99-101)
   - El botón de modo de medición (L144-155) — innecesario, el sidebar ya tiene eso

5. **Reducir** el vúmetro: quitar `min-height: 40px`, reducir `padding` a `4px 8px`

6. **Título**: acortar a solo el ícono + texto breve o solo ícono

> [!NOTE]
> Los tooltips (`title`) compensan la falta de labels. Al hacer hover sobre cada botón, el usuario ve qué hace y su estado actual.

---

## Verificación

- `npm run dev` sin errores
- Los botones de filtro muestran las curvas SVG correctas con color adaptado al tema
- En modo claro, el texto muted es legible (no gris lavado)
- No hay sombra debajo del header
- **DSP**: Filtros paramétricos reflejan el tipo seleccionado
- **Simulated Magnitude**: Curva suave con spline
- **Zoom X**: Máximo zoom out muestra 10Hz-22kHz completo
- **EQ Overlay**: Capa de ecualizador fija en dropdown de capas
- **EQ Nodos**: Nodos arrastrables con actualización bidireccional
- **AutoEQ**: Selector de capa fuente + "Calcular ecualización"
- **Panel EQ**: Switch "Capa de ecualizador" + atajo "+ Resp. Simulada"
- **Desviación**: Tabla RMS/pico por capa con semáforo
- **Target curve**: Selector de curva de referencia compartido
- **Topbar**: Solo iconos, separadores finos, altura reducida, sin labels

