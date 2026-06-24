/**
 * Canvas Theme — computes canvas 2D rendering colors directly from store state.
 * No CSS variable reading needed — avoids cascade/timing issues.
 */

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
    watermarkStroke: string;
}

const DARK: CanvasThemeColors = {
    bg: '#08080c',
    grid: 'rgba(255, 255, 255, 0.05)',
    gridMajor: 'rgba(255, 255, 255, 0.10)',
    gridMinor: 'rgba(255, 255, 255, 0.025)',
    label: 'rgba(255, 255, 255, 0.45)',
    crosshair: 'rgba(255, 255, 255, 0.25)',
    tooltipBg: 'rgba(8, 8, 12, 0.95)',
    tooltipBorder: 'rgba(255, 255, 255, 0.15)',
    tooltipText: '#eaeaf0',
    watermark: 'rgba(255, 255, 255, 0.08)',
    watermarkStroke: 'rgba(255, 255, 255, 0.15)',
};

const LIGHT: CanvasThemeColors = {
    bg: '#f8f8fa',
    grid: 'rgba(0, 0, 0, 0.06)',
    gridMajor: 'rgba(0, 0, 0, 0.14)',
    gridMinor: 'rgba(0, 0, 0, 0.035)',
    label: 'rgba(0, 0, 0, 0.6)',
    crosshair: 'rgba(0, 0, 0, 0.25)',
    tooltipBg: 'rgba(245, 245, 247, 0.95)',
    tooltipBorder: 'rgba(0, 0, 0, 0.15)',
    tooltipText: '#0f0f1e',
    watermark: 'rgba(0, 0, 0, 0.08)',
    watermarkStroke: 'rgba(0, 0, 0, 0.15)',
};

/** Current resolved dark/light mode for the canvas */
let _canvasIsDark = true;

/**
 * Set canvas dark mode. Call this whenever theme or canvasTheme changes.
 */
export function setCanvasDarkMode(isDark: boolean): void {
    _canvasIsDark = isDark;
}

/**
 * Get canvas theme colors — returns DARK or LIGHT palette directly.
 * No CSS variable reading, no caching issues.
 */
export function getCanvasTheme(): CanvasThemeColors {
    return _canvasIsDark ? DARK : LIGHT;
}

/** @deprecated Use setCanvasDarkMode instead */
export function invalidateCanvasTheme(): void {
    // no-op, kept for backward compat
}

/** Unified font constants for canvas 2D rendering */
export const CANVAS_FONT = {
    label: '9px Inter, system-ui, sans-serif',
    labelBold: 'bold 9px Inter, system-ui, sans-serif',
    tooltip: '8px Inter, system-ui, sans-serif',
    tooltipBold: 'bold 8px Inter, system-ui, sans-serif',
    tooltipTitle: 'bold 8px Inter, system-ui, sans-serif',
    mono: '9px JetBrains Mono, monospace',
    monoBold: 'bold 9px JetBrains Mono, monospace',
    nodeLabel: '600 9px Inter, system-ui, sans-serif',
    scoreBold: 'bold 10px Inter, system-ui, sans-serif',
    scoreBoldLarge: 'bold 11px Inter, system-ui, sans-serif',
    scoreNormal: '9px Inter, system-ui, sans-serif',
    scoreSmall: '8px Inter, system-ui, sans-serif',
} as const;
