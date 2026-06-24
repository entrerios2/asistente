# Mejora General del Sistema de Temas

## Diagnóstico Completo

### Variables CSS vs Hardcoded

| Categoría | Variables definidas | Instancias hardcodeadas |
|---|---|---|
| Colores hex en `.svelte` | 11 vars | **324** |
| `text-gray-*` tailwind | 0 vars | **268** (87x gray-500, 55x gray-400, 48x gray-200/300) |
| `bg-[#...]` backgrounds | 4 vars | **167** |
| Font sizes | 0 vars | **287** (131x 10px, 68x 9px, 33x 8px, 19x 12px, 18x 14px) |
| Border radius | 0 vars | **157** (64x md, 56x lg, 15x full, 14x xl) |
| Transitions | 0 vars | **110** |
| Fuentes referenciadas sin cargar | `"Outfit"`, `"Inter Tight"` | Solo `Inter` está en `app.html` |
| Canvas fonts | 0 vars | 6 combinaciones distintas (`monospace`, `system-ui`, `"Outfit"`, `"Inter"`) |

### Problemas de contraste
- `text-gray-500` (#6b7280) sobre `#121216` → ratio **~2.5:1** ❌ (WCAG AA = 4.5:1)
- `text-gray-400` (#9ca3af) sobre `#121216` → ratio **~3.5:1** ❌
- `--text-muted` (#666678) sobre `--bg-tertiary` (#121216) → ratio **~2.8:1** ❌

---

## Propuesta

### Fase 1: Design System Completo en `layout.css`

#### [MODIFY] [layout.css](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/layout.css)

Reescribir con todas las variables organizadas por categoría:

```css
:root {
  /* ── Font Stacks ── */
  --font-ui: 'Inter', -apple-system, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  --font-canvas: 'Inter', system-ui, sans-serif;

  /* ── Font Sizes ── */
  --text-2xs: 8px;
  --text-xs: 9px;
  --text-sm: 10px;
  --text-base: 11px;
  --text-md: 12px;
  --text-lg: 14px;
  --text-xl: 16px;

  /* ── Border Radius ── */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* ── Transitions ── */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;

  /* ── Backgrounds ── */
  --bg-primary: #f5f5f7;
  --bg-secondary: #ffffff;
  --bg-tertiary: #eaeaef;
  --bg-surface: #f0f0f4;
  --bg-elevated: #e2e2e8;
  --bg-deep: #d8d8e0;
  --bg-overlay: rgba(0,0,0,0.45);

  /* ── Borders ── */
  --border-primary: #bbbbc5;
  --border-secondary: #d0d0d8;

  /* ── Text (alto contraste) ── */
  --text-primary: #0f0f1e;
  --text-secondary: #2d2d42;
  --text-muted: #505065;
  --text-disabled: #7a7a8c;

  /* ── Accent ── */
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-muted: rgba(37,99,235,0.12);
  --accent-green: #059669;
  --accent-red: #dc2626;
  --accent-yellow: #d97706;
  --accent-cyan: #0891b2;

  /* ── Canvas (tema independiente del UI) ── */
  --canvas-bg: #f8f8fa;
  --canvas-grid: rgba(0,0,0,0.06);
  --canvas-grid-major: rgba(0,0,0,0.14);
  --canvas-grid-minor: rgba(0,0,0,0.035);
  --canvas-label: rgba(0,0,0,0.6);
  --canvas-crosshair: rgba(0,0,0,0.25);
  --canvas-tooltip-bg: rgba(245,245,247,0.95);
  --canvas-tooltip-border: rgba(0,0,0,0.15);
  --canvas-tooltip-text: #0f0f1e;
  --canvas-watermark: rgba(0,0,0,0.08);

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.12);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.18);
}

.dark {
  --bg-primary: #08080c;
  --bg-secondary: #0e0e14;
  --bg-tertiary: #161620;
  --bg-surface: #0c0c12;
  --bg-elevated: #1e1e2a;
  --bg-deep: #040406;
  --bg-overlay: rgba(0,0,0,0.7);

  --border-primary: #2a2a38;
  --border-secondary: #363648;

  --text-primary: #eaeaf0;
  --text-secondary: #b8b8ca;
  --text-muted: #8888a0;
  --text-disabled: #555566;

  --accent: #3b82f6;
  --accent-hover: #60a5fa;
  --accent-muted: rgba(59,130,246,0.12);
  --accent-green: #00ff88;
  --accent-red: #ef4444;
  --accent-yellow: #fbbf24;
  --accent-cyan: #00e5ff;

  --canvas-bg: #08080c;
  --canvas-grid: rgba(255,255,255,0.05);
  --canvas-grid-major: rgba(255,255,255,0.10);
  --canvas-grid-minor: rgba(255,255,255,0.025);
  --canvas-label: rgba(255,255,255,0.45);
  --canvas-crosshair: rgba(255,255,255,0.25);
  --canvas-tooltip-bg: rgba(8,8,12,0.95);
  --canvas-tooltip-border: rgba(255,255,255,0.15);
  --canvas-tooltip-text: #eaeaf0;
  --canvas-watermark: rgba(255,255,255,0.08);

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);
}

/* ── Tema de cuadrante independiente ── */
/* El usuario puede elegir dark canvas + light UI o viceversa */
[data-canvas-theme="dark"] {
  --canvas-bg: #08080c;
  --canvas-grid: rgba(255,255,255,0.05);
  --canvas-grid-major: rgba(255,255,255,0.10);
  --canvas-grid-minor: rgba(255,255,255,0.025);
  --canvas-label: rgba(255,255,255,0.45);
  --canvas-crosshair: rgba(255,255,255,0.25);
  --canvas-tooltip-bg: rgba(8,8,12,0.95);
  --canvas-tooltip-border: rgba(255,255,255,0.15);
  --canvas-tooltip-text: #eaeaf0;
  --canvas-watermark: rgba(255,255,255,0.08);
}

[data-canvas-theme="light"] {
  --canvas-bg: #f8f8fa;
  --canvas-grid: rgba(0,0,0,0.06);
  --canvas-grid-major: rgba(0,0,0,0.14);
  --canvas-grid-minor: rgba(0,0,0,0.035);
  --canvas-label: rgba(0,0,0,0.6);
  --canvas-crosshair: rgba(0,0,0,0.25);
  --canvas-tooltip-bg: rgba(245,245,247,0.95);
  --canvas-tooltip-border: rgba(0,0,0,0.15);
  --canvas-tooltip-text: #0f0f1e;
  --canvas-watermark: rgba(0,0,0,0.08);
}
```

#### Body global

```css
body {
  font-family: var(--font-ui);
  color: var(--text-primary);
  background: var(--bg-primary);
}
```

---

### Fase 2: Fix Fonts

#### [MODIFY] [app.html](file:///c:/Users/Abel/Documents/Asistente/asistente/src/app.html)

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet">
```

Eliminar referencias a `"Outfit"` e `"Inter Tight"` de todos los componentes (nunca cargaron).

---

### Fase 3: 10 Paletas + Tema de Cuadrante Independiente

#### [MODIFY] [layout.css](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/layout.css) — agregar paletas

```css
[data-palette="midnight"] { --accent: #6366f1; --accent-hover: #818cf8; --accent-muted: rgba(99,102,241,0.12); --accent-green: #34d399; --accent-cyan: #a78bfa; }
[data-palette="ocean"]    { --accent: #06b6d4; --accent-hover: #22d3ee; --accent-muted: rgba(6,182,212,0.12); --accent-green: #2dd4bf; --accent-cyan: #67e8f9; }
[data-palette="sunset"]   { --accent: #f97316; --accent-hover: #fb923c; --accent-muted: rgba(249,115,22,0.12); --accent-green: #facc15; --accent-cyan: #fdba74; }
[data-palette="rose"]     { --accent: #e11d48; --accent-hover: #fb7185; --accent-muted: rgba(225,29,72,0.12); --accent-green: #f472b6; --accent-cyan: #fda4af; }
[data-palette="forest"]   { --accent: #16a34a; --accent-hover: #4ade80; --accent-muted: rgba(22,163,74,0.12); --accent-green: #86efac; --accent-cyan: #34d399; }
[data-palette="violet"]   { --accent: #8b5cf6; --accent-hover: #a78bfa; --accent-muted: rgba(139,92,246,0.12); --accent-green: #c084fc; --accent-cyan: #d8b4fe; }
[data-palette="slate"]    { --accent: #64748b; --accent-hover: #94a3b8; --accent-muted: rgba(100,116,139,0.12); --accent-green: #94a3b8; --accent-cyan: #cbd5e1; }
[data-palette="amber"]    { --accent: #d97706; --accent-hover: #f59e0b; --accent-muted: rgba(217,119,6,0.12); --accent-green: #fbbf24; --accent-cyan: #fcd34d; }
[data-palette="neon"]     { --accent: #00ff41; --accent-hover: #39ff14; --accent-muted: rgba(0,255,65,0.12); --accent-green: #00ffff; --accent-cyan: #00ff41; }
```

#### [MODIFY] [ui.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/ui.svelte.ts)

```typescript
palette = $state<string>('default');
canvasTheme = $state<'auto' | 'dark' | 'light'>('auto');

setPalette(name: string) {
    this.palette = name;
    this.applyPalette();
}

applyPalette() {
    if (typeof document !== 'undefined') {
        if (this.palette === 'default') {
            document.documentElement.removeAttribute('data-palette');
        } else {
            document.documentElement.setAttribute('data-palette', this.palette);
        }
    }
}

setCanvasTheme(mode: 'auto' | 'dark' | 'light') {
    this.canvasTheme = mode;
    this.applyCanvasTheme();
}

applyCanvasTheme() {
    if (typeof document !== 'undefined') {
        if (this.canvasTheme === 'auto') {
            document.documentElement.removeAttribute('data-canvas-theme');
        } else {
            document.documentElement.setAttribute('data-canvas-theme', this.canvasTheme);
        }
    }
}
```

#### [MODIFY] [TabConfig.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabConfig.svelte)

Agregar junto al selector de tema visual:

- **Selector de paleta**: Grid de 10 círculos con preview del color accent
- **Selector de tema de cuadrante**: Radio `Auto | Claro | Oscuro` (independiente del tema UI)

---

### Fase 4: Migración de Componentes → Variables

#### [NEW] [canvasTheme.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/canvasTheme.ts)

Módulo que lee CSS variables del DOM y las expone como objeto para canvas 2D:

```typescript
export interface CanvasThemeColors {
  bg: string;
  grid: string;
  gridMajor: string;
  gridMinor: string;
  label: string;
  crosshair: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  watermark: string;
}

let _cached: CanvasThemeColors | null = null;
let _cacheKey = '';

export function getCanvasTheme(): CanvasThemeColors {
  const root = getComputedStyle(document.documentElement);
  const key = root.getPropertyValue('--canvas-bg').trim();
  if (_cached && _cacheKey === key) return _cached;
  _cached = {
    bg: root.getPropertyValue('--canvas-bg').trim(),
    grid: root.getPropertyValue('--canvas-grid').trim(),
    // ... all vars
  };
  _cacheKey = key;
  return _cached;
}

// Font constants for canvas
export const CANVAS_FONT = {
  label: '9px Inter, system-ui, sans-serif',
  labelBold: 'bold 9px Inter, system-ui, sans-serif',
  tooltip: '8px Inter, system-ui, sans-serif',
  tooltipBold: 'bold 8px Inter, system-ui, sans-serif',
  mono: '9px JetBrains Mono, monospace',
};
```

#### Migración componente por componente

Cada componente se migra con estas sustituciones:

| Hardcoded | Variable CSS |
|---|---|
| `bg-[#121216]` | `bg-[var(--bg-tertiary)]` |
| `bg-[#0d0d14]`, `bg-[#0a0a0c]` | `bg-[var(--bg-secondary)]` |
| `bg-[#2a2a3a]` | `bg-[var(--bg-elevated)]` |
| `border-[#1a1a24]` | `border-[var(--border-primary)]` |
| `border-[#222233]` | `border-[var(--border-secondary)]` |
| `text-gray-500`, `text-gray-600` | `text-[var(--text-muted)]` |
| `text-gray-400` | `text-[var(--text-secondary)]` |
| `text-gray-200`, `text-gray-300` | `text-[var(--text-primary)]` |
| `text-[#3b82f6]` | `text-[var(--accent)]` |
| `text-[#00ff88]` | `text-[var(--accent-green)]` |
| `text-[#ef4444]` | `text-[var(--accent-red)]` |
| `text-[10px]` | `text-[var(--text-sm)]` |
| `text-[9px]` | `text-[var(--text-xs)]` |
| `text-[8px]` | `text-[var(--text-2xs)]` |
| `text-[12px]` | `text-[var(--text-md)]` |
| `text-[14px]` | `text-[var(--text-lg)]` |
| `rounded-md` | `rounded-[var(--radius-md)]` |
| `rounded-lg` | `rounded-[var(--radius-lg)]` |
| `rounded-xl` | `rounded-[var(--radius-xl)]` |
| `transition-all` | `transition-all duration-[var(--transition-fast)]` |
| `font: "9px monospace"` (canvas) | `CANVAS_FONT.mono` |

Orden por impacto:

| # | Archivo | ~Instancias |
|---|---|---|
| 1 | [TabConfig.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabConfig.svelte) | ~80 |
| 2 | [TabEcualizar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabEcualizar.svelte) | ~60 |
| 3 | [TabMedicion.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabMedicion.svelte) | ~50 |
| 4 | [TabInstantaneas.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabInstantaneas.svelte) | ~40 |
| 5 | [Header.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte) | ~25 |
| 6 | [Sidebar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Sidebar.svelte) | ~47 (`:global()` overrides → eliminar) |
| 7 | [LayerPanel.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/LayerPanel.svelte) | ~20 |
| 8 | [EQNodePopover.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/EQNodePopover.svelte) | ~15 |
| 9 | [MetricConfigPopover.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/MetricConfigPopover.svelte) | ~15 |
| 10 | [gridRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/renderers/gridRenderers.ts) | ~15 (usa `canvasTheme.ts`) |
| 11 | Otros (ZoomControls, AddMetric, CaptureModal, SnapshotPicker, ViewGrid) | ~20 |

---

## Archivos afectados (resumen)

| Acción | Archivo | Fase |
|---|---|---|
| [MODIFY] | [layout.css](file:///c:/Users/Abel/Documents/Asistente/asistente/src/routes/layout.css) | 1, 3 |
| [MODIFY] | [app.html](file:///c:/Users/Abel/Documents/Asistente/asistente/src/app.html) | 2 |
| [NEW] | `src/lib/dsp/canvasTheme.ts` | 4 |
| [MODIFY] | [ui.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/ui.svelte.ts) | 3 |
| [MODIFY] | 11 componentes `.svelte` listados arriba | 4 |
| [MODIFY] | [gridRenderers.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/renderers/gridRenderers.ts) | 4 |
| [MODIFY] | [configPersistence.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/utils/configPersistence.ts) | 3 (persistir palette + canvasTheme) |

## Orden de ejecución

1. **Fase 1** → Design system en `layout.css` (bajo riesgo)
2. **Fase 2** → Fonts en `app.html` + body style (bajo riesgo)
3. **Fase 3** → Paletas + canvas theme independiente en `ui.svelte.ts` + `TabConfig`
4. **Fase 4** → Migración componente por componente (compilar tras cada uno)

## Verificación

- Inspección visual en modo claro y oscuro
- Verificar contraste WCAG AA (4.5:1 texto normal, 3:1 texto grande)
- `npx svelte-check` sin errores tras cada componente
- Probar cambio de paleta y tema de cuadrante independiente en tiempo real
