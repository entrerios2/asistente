import { palettes, type PaletteType } from "./colorPalettes";

export interface Metric {
    name: string;
    type: string;
    color: string;
    label: string;
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
];

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
};

export const defaultMetricConfigs: Record<string, any> = {
    "Spectrum": { modeY: "dB", sensorResistance: 10, smoothingPPO: 48, invertY: false, enableCoherence: false, coherenceThreshold: 0.5, yShift: 0 },
    "Magnitude": { modeY: "dB", sensorResistance: 10, smoothingPPO: 48, invertY: false, enableCoherence: false, coherenceThreshold: 0.5, yShift: 0 },
    "Simulated Magnitude": { modeY: "dB", sensorResistance: 10, smoothingPPO: 48, invertY: false, enableCoherence: false, coherenceThreshold: 0.5, yShift: 0 },
    "Phase": { unwrapMode: "±180", rotate: 0, range: 360, yShift: 0 },
    "Coherence": { cohType: "normal", showThresholdLine: false, thresholdColor: "#eab308", thresholdValue: 0.5, yShift: 0 },
    "Spectrogram": { palette: "Magma" as PaletteType },
};
