/**
 * Persistencia de configuración del usuario con throttle y schema versioning.
 */

const CONFIG_KEY = 'asistente_config';
const CONFIG_VERSION = 3;
const SAVE_DEBOUNCE_MS = 1000;

export interface PersistedConfig {
    _version: number;
    layout: string;
    themeMode: 'system' | 'light' | 'dark';
    audioInDevice: string;
    audioOutDevice: string;
    inChannels: boolean[];
    outChannels: boolean[];
    referenceChannel: string;
    sampleRate: number;
    fftSize: number;
    dspUpdateRate: number;
    eqType?: 'grafico' | 'parametrico';
    eqShowEQ?: boolean;
    eqGraphicBands?: { freq: number; gain: number }[];
    eqParametricFilters?: { id: number; freq: number; gain: number; q: number; type: string; supportedTypes: string[] }[];
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
