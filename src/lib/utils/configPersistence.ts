/**
 * Persistencia de configuración del usuario con throttle y schema versioning.
 */

const CONFIG_KEY = 'asistente_config';
const CONFIG_VERSION = 5;
const SAVE_DEBOUNCE_MS = 1000;

export interface PersistedConfig {
    _version: number;
    layout: string;
    themeMode: 'system' | 'light' | 'dark';
    audioInDevice: string;
    audioOutDevice: string;
    sampleRate: number;
    fftSize: number;
    dspUpdateRate: number;
    eqType?: 'grafico' | 'parametrico';
    eqShowEQ?: boolean;
    eqGraphicBands?: { freq: number; gain: number }[];
    eqParametricFilters?: { id: number; freq: number; gain: number; q: number; type: string; supportedTypes: string[] }[];

    // DSP advanced (v4)
    weightingType?: string;
    averagingType?: string;
    averagingDepth?: number;
    averagingAlpha?: number;
    besselSpeed?: string;
    ppoSmoothing?: number;
    fftOverlap?: number;
    windowType?: string;
    inputGain?: number;
    displayOffset?: number;
    polarity?: boolean;
    inputFilter?: string;
    compensationDelayMs?: number;
    autoDelayCompensation?: boolean;
    refChannel?: number;
    measChannel?: number;
    generatorType?: string;
    genLevel?: number;
    genRouting?: string;
    targetFps?: number;
    linkGeneratorToMeasurement?: boolean;
    enableLeq?: boolean;
    enableSourceWindow?: boolean;
    sourceWindowWidthMs?: number;
    sourceWindowOffsetMs?: number;

    // UI preferences (v4)
    showAdvanced?: boolean;
    showMinorGrid?: boolean;
    globalMetricDefaults?: Record<string, unknown>;

    // Theme (v6)
    palette?: string;
    canvasTheme?: 'auto' | 'dark' | 'light';

    // ─── v5: Nuevos campos ───

    // uiStore faltantes
    genFreq?: number;
    autoSaveSnapshotOnStop?: boolean;
    measurementMode?: string;
    leqWindowSeconds?: number;
    averagingThresholdDb?: number;

    // Target trace
    targetPoints?: { f: number; g: number }[];
    targetVisible?: boolean;
    targetColor?: string;
    targetOpacity?: number;
    targetOffset?: number;
    targetName?: string;

    // Calibración
    calibrationPoints?: { frequency: number; gain: number }[];
    calibrationFilename?: string;

    // Captura
    metricsToCapture?: Record<string, boolean>;
    tagPresets?: { ubicacion: string[]; posicion: string[] };

    // AutoEQ config
    autoEQAlgorithm?: string;
    autoEQCostDomain?: string;
    autoEQMaxBoost?: number;
    autoEQMaxCut?: number;
    autoEQMinQ?: number;
    autoEQMaxQ?: number;
    autoEQMaxIterations?: number;
    autoEQCoherenceThreshold?: number;
    autoEQTrebleAveraging?: boolean;
    autoEQTrebleFreq?: number;
    autoEQOnlyCorrectPeaks?: boolean;
    autoEQPSOPopulation?: number;
    autoEQPSOInertia?: number;
    autoEQPSOCognitive?: number;
    autoEQPSOSocial?: number;
    autoEQGAPopulation?: number;
    autoEQGAMutationRate?: number;
    autoEQGACrossoverRate?: number;
    autoEQGAElitism?: number;

    // Legacy (kept for migration)
    inChannels?: boolean[];
    outChannels?: boolean[];
    referenceChannel?: string;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Carga la configuración persistida, aplicando migraciones si es necesario.
 */
export function loadConfig(): Partial<PersistedConfig> | null {
    try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);

        // Migración v1 → v2: isDarkMode → themeMode
        if (!parsed._version || parsed._version < 2) {
            if (parsed.isDarkMode !== undefined && !parsed.themeMode) {
                parsed.themeMode = parsed.isDarkMode ? 'dark' : 'light';
            }
            delete parsed.isDarkMode;
            parsed._version = CONFIG_VERSION;
        }

        return parsed as Partial<PersistedConfig>;
    } catch (e) {
        console.error('[configPersistence] Error cargando configuración:', e);
        return null;
    }
}

/**
 * Guarda la configuración con debounce para evitar escrituras excesivas.
 */
export function saveConfig(config: PersistedConfig): void {
    if (saveTimer) {
        clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
        } catch (e) {
            console.error('[configPersistence] Error guardando configuración:', e);
        }
        saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
}

/**
 * Exporta la configuración actual como JSON string para guardar como archivo .ca.json.
 */
export function exportConfig(config: PersistedConfig): string {
    return JSON.stringify({ ...config, _exportedAt: Date.now() }, null, 2);
}

/**
 * Importa configuración desde un JSON string (archivo .ca.json).
 * Valida y retorna los datos parseados, o null si es inválido.
 */
export function importConfig(json: string): Partial<PersistedConfig> | null {
    try {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object') return null;
        // Aceptar tanto con como sin _version
        return parsed as Partial<PersistedConfig>;
    } catch (e) {
        console.error('[configPersistence] Error importando configuración:', e);
        return null;
    }
}
