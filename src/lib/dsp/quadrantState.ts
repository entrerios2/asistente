import { type PaletteType } from "./colorPalettes";

export interface Metric {
    name: string;
    type: string;
    color: string;
    label: string;
}

// --- Global metric defaults & per-metric override system ---

export interface GlobalMetricCommon {
    lineWidth: number;
    lineDash: number[];
    smoothingPPO: number;
    invertY: boolean;
    yShift: number;
}

export interface GlobalMagnitudeDefaults {
    modeY: string;
    enableCoherence: boolean;
    coherenceThreshold: number;
    coherenceMode: 'attenuate' | 'color';
    coherenceColor: string;
}

export interface GlobalPhaseDefaults {
    unwrapMode: string;
    rotate: number;
    range: number;
}

export interface GlobalCoherenceDefaults {
    cohType: string;
    showLine: boolean;
    showBackground: boolean;
    bgPalette: string;
    showThresholdLine: boolean;
    thresholdValue: number;
    thresholdColor: string;
}

export interface GlobalSpectrogramDefaults {
    palette: string;
}

export interface GlobalImpulseDefaults {
    modeY: string;
}

export interface GlobalMetricDefaults {
    common: GlobalMetricCommon;
    magnitude: GlobalMagnitudeDefaults;
    phase: GlobalPhaseDefaults;
    coherence: GlobalCoherenceDefaults;
    spectrogram: GlobalSpectrogramDefaults;
    impulse: GlobalImpulseDefaults;
}

export const defaultGlobalMetricDefaults: GlobalMetricDefaults = {
    common: {
        lineWidth: 1,
        lineDash: [],
        smoothingPPO: 48,
        invertY: false,
        yShift: 0,
    },
    magnitude: {
        modeY: 'dB',
        enableCoherence: true,
        coherenceThreshold: 0.2,
        coherenceMode: 'attenuate',
        coherenceColor: '#666666',
    },
    phase: {
        unwrapMode: '±180',
        rotate: 0,
        range: 360,
    },
    coherence: {
        cohType: 'normal',
        showLine: true,
        showBackground: true,
        bgPalette: 'RedTransparent',
        showThresholdLine: true,
        thresholdValue: 0.2,
        thresholdColor: '#eab308',
    },
    spectrogram: {
        palette: 'Magma',
    },
    impulse: {
        modeY: 'Linear',
    },
};

/**
 * Resolves the effective value for a metric config field.
 * If the per-metric override has a value, use it; otherwise fall back to global.
 */
export function getEffectiveConfig<T>(
    overrideValue: T | undefined,
    globalValue: T
): T {
    return overrideValue !== undefined ? overrideValue : globalValue;
}

/**
 * Returns true if a MetricConfig has any overrides (non-undefined fields besides 'hidden').
 */
export function hasOverrides(config: MetricConfig | undefined): boolean {
    if (!config) return false;
    return Object.entries(config).some(
        ([key, val]) => key !== 'hidden' && val !== undefined
    );
}

export const allMetrics: Metric[] = [
    {
        name: "Spectrum",
        type: "frequency",
        color: "#a855f7",
        label: "Spectrum [Absoluto]",
    },
    {
        name: "Magnitude",
        type: "frequency",
        color: "#ff4444",
        label: "Magnitude [Relativo]",
    },
    {
        name: "Simulated Magnitude",
        type: "frequency",
        color: "#00ffff",
        label: "Magnitud Simulada (EQ)",
    },
    {
        name: "Phase",
        type: "frequency",
        color: "#d946ef",
        label: "Phase [Fase]",
    },
    {
        name: "Coherence",
        type: "frequency",
        color: "#eab308",
        label: "Coherence",
    },
    {
        name: "Group Delay",
        type: "frequency",
        color: "#10b981",
        label: "Group Delay",
    },
    {
        name: "Spectrogram",
        type: "frequency",
        color: "#ec4899",
        label: "Spectrogram 2D",
    },
    {
        name: "Impulse",
        type: "time",
        color: "#3b82f6",
        label: "Impulse [Tiempo]",
    },
    {
        name: "Step",
        type: "time",
        color: "#f97316",
        label: "Step [Escalón]",
    },
    {
        name: "Level",
        type: "visual",
        color: "#06b6d4",
        label: "Level [VU]",
    },
    {
        name: "Numeric",
        type: "visual",
        color: "#14b8a6",
        label: "Numeric [HUD]",
    },
    {
        name: "Nyquist",
        type: "frequency",
        color: "#ffffff",
        label: "Nyquist Plot",
    },
    {
        name: "Scope",
        type: "time",
        color: "#00ff00",
        label: "Oscilloscope",
    },
    {
        name: "Phase Delay",
        type: "frequency",
        color: "#f43f5e",
        label: "Phase Delay",
    },
    {
        name: "Crest Factor",
        type: "frequency",
        color: "#60a5fa",
        label: "Crest Factor",
    },
    {
        name: "Harmonics",
        type: "frequency",
        color: "#ff4444",
        label: "Harmonics (H₂–H₅)",
    },
    {
        name: "Octave Bands",
        type: "frequency",
        color: "#22c55e",
        label: "Octave Bands 1/3",
    },
];

export interface MetricConfig {
    // Magnitude/Spectrum/Simulated Magnitude
    modeY?: 'dB' | 'Linear' | 'Impedance' | 'ETC';
    sensorResistance?: number;
    smoothingPPO?: number;
    invertY?: boolean;
    enableCoherence?: boolean;
    coherenceThreshold?: number;
    coherenceMode?: 'attenuate' | 'color';  // Atenuar transparencia o cambiar color
    coherenceColor?: string;                 // Color para modo 'color'
    yShift?: number;
    hidden?: boolean;
    // Phase
    unwrapMode?: '±180' | '360' | 'Unwrap';
    rotate?: number;
    range?: number;
    // Coherence — visualización propia
    cohType?: string;
    showLine?: boolean;           // Mostrar curva de coherencia
    showBackground?: boolean;     // Mostrar fondo mask de coherencia
    bgPalette?: string;           // 'RedTransparent' | PaletteType
    showThresholdLine?: boolean;
    thresholdColor?: string;
    thresholdValue?: number;
    // Spectrogram
    palette?: PaletteType;
    // Harmonics — colores individuales por armónico
    harmonicColorH2?: string;
    harmonicColorH3?: string;
    harmonicColorH4?: string;
    harmonicColorH5?: string;
    // Octave Bands — modo de color
    octaveColorMode?: 'pass_warn_fail' | 'solid';
}

export interface MetricStyle {
    color: string;
    lineWidth: number;
    lineDash: number[];
}

export const defaultMetricStyles: Record<string, MetricStyle> = {
    "Spectrum": { color: "#a855f7", lineWidth: 1, lineDash: [] },
    "Magnitude": { color: "#ff4444", lineWidth: 1, lineDash: [] },
    "Phase": { color: "#d946ef", lineWidth: 1, lineDash: [] },
    "Coherence": { color: "#eab308", lineWidth: 1, lineDash: [] },
    "Group Delay": { color: "#10b981", lineWidth: 1, lineDash: [] },
    "Impulse": { color: "#3b82f6", lineWidth: 1, lineDash: [] },
    "Step": { color: "#f97316", lineWidth: 1, lineDash: [] },
    "Simulated Magnitude": { color: "#00ffff", lineWidth: 1, lineDash: [4, 4] },
    "Harmonics": { color: "#ff4444", lineWidth: 1, lineDash: [] },
    "Octave Bands": { color: "#22c55e", lineWidth: 1, lineDash: [] },
};

export const defaultMetricConfigs: Record<string, MetricConfig> = {
    "Spectrum": { modeY: "dB", sensorResistance: 10, smoothingPPO: 48, invertY: false, enableCoherence: false, coherenceMode: "attenuate", coherenceColor: "#666666", yShift: 0 },
    "Magnitude": { modeY: "dB", sensorResistance: 10, smoothingPPO: 48, invertY: false, enableCoherence: true, coherenceMode: "attenuate", coherenceColor: "#666666", yShift: 0 },
    "Simulated Magnitude": { modeY: "dB", sensorResistance: 10, smoothingPPO: 48, invertY: false, enableCoherence: false, coherenceMode: "attenuate", coherenceColor: "#666666", yShift: 0 },
    "Phase": { unwrapMode: "±180", rotate: 0, range: 360, yShift: 0 },
    "Coherence": { cohType: "normal", showLine: true, showBackground: true, bgPalette: "RedTransparent", showThresholdLine: true, thresholdColor: "#eab308", thresholdValue: 0.2, yShift: 0 },
    "Spectrogram": { palette: "Magma" as PaletteType },
    "Harmonics": { smoothingPPO: 48, harmonicColorH2: "#ff4444", harmonicColorH3: "#f97316", harmonicColorH4: "#eab308", harmonicColorH5: "#a855f7" },
    "Octave Bands": { smoothingPPO: 48, octaveColorMode: "pass_warn_fail" },
};
