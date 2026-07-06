/**
 * UI Store: Estado reactivo para la interfaz de usuario y configuración global.
 */

import { setCanvasDarkMode } from '$lib/dsp/canvasTheme';

export const DSP_BASE_RATES = [1, 2, 4, 5, 15, 30, 60];
export const FPS_MULTIPLIERS = [1, 2, 4];
export const METRIC_DECIMATIONS = [1, 2, 4, 8];

class UIStore {
    layout = $state('1x1'); // '1x1' | '1x2' | '2x1' | '2x2' | '3x1' | '3x2'
    themeMode = $state<'system' | 'light' | 'dark'>('dark');
    palette = $state<string>('default');
    canvasTheme = $state<'auto' | 'dark' | 'light'>('auto');
    showSidebar = $state(true);
    showAdvanced = $state(true);
    showMinorGrid = $state(true);
    
    // Configuración de Audio
    audioInDevice = $state('');
    audioOutDevice = $state('');
    isSimulating = $state(false);

    // NUEVOS ESTADOS COMPARTIDOS FASE 2A.3
    activeTab = $state('medicion'); // 'medicion' | 'eq' | 'snaps' | 'config'
    measurementMode = $state('manual'); // 'manual' | 'secuencial'
    isMeasuring = $state(false);

    dspBaseRate = $state(30);    // Hz — 1,2,4,5,15,30,60
    targetFpsMultiplier = $state(2);  // ×1, ×2, ×4
    fftSize = $state(16384);

    /** FPS resultante = base × multiplier */
    get currentFps(): number {
        return Math.min(this.dspBaseRate * this.targetFpsMultiplier, 60);
    }

    /** Máximo multiplicador válido para la base actual (no superar 60 fps) */
    get maxFpsMultiplier(): number {
        const max = Math.floor(60 / this.dspBaseRate);
        if (max <= 0) return 1;
        return FPS_MULTIPLIERS.slice().reverse().find(m => m <= max) || 1;
    }

    /** Factor de decimación por métrica (1=siempre, 8=cada 8 frames DSP) */
    metricDecimation = $state<Record<string, number>>({
        magnitude: 1,
        phase: 2,
        coherence: 2,
        impulse: 4,
        step: 4,
        spectrum: 1,
        crest: 1,
        gd: 4,
    });
    sampleRate = $state(48000); // 44100 | 48000 | 96000

    // Estado del Generador de Audio
    generatorType = $state('pink'); // 'pink' | 'white' | 'brown' | 'music-noise' | 'sine' | 'sweep' | 'burst' | 'sinburst' | 'mls'
    genActive = $state(false);
    genFreq = $state(1000);
    genLevel = $state(0);
    genRouting = $state<'L' | 'R' | 'Stereo'>('Stereo');

    // ESTADOS AVANZADOS COMPORTAMIENTO HAL Y CAPAS
    autoSaveSnapshotOnStop = $state(false);
    linkGeneratorToMeasurement = $state(true);
    activeLayerId = $state('');

    // NUEVOS CONTROLES DE CALIBRACIÓN GLOBAL Y GANANCIA (PROMPT 7)
    inputGain = $state(0); // Ganancia de entrada en dB (-20 a +20)
    displayOffset = $state(0); // Offset de visualización en dB (-100 a +100)
    polarity = $state(false);  // Inversión de fase del canal de medición

    // NUEVOS CONTROLES DSP AVANZADOS - PARIDAD OSM (PROMPT 9)
    weightingType = $state<'A' | 'B' | 'C' | 'Z'>('Z');
    averagingType = $state<'None' | 'FIFO' | 'EMA' | 'LPF'>('LPF');
    averagingDepth = $state(8);
    averagingAlpha = $state(0.1);
    besselSpeed = $state<'Slow' | 'Medium' | 'Fast'>('Slow'); // 0.25, 0.5, 1.0 Hz
    ppoSmoothing = $state(0); // 0=off, valores comunes: 1,3,6,12,24,48 PPO
    fftOverlap = $state<0 | 50 | 75>(50); // 0%, 50%, 75% overlap
    windowType = $state<'Rectangular' | 'Hann' | 'Hamming' | 'FlatTop' | 'BlackmanHarris' | 'HFT223D' | 'Exponential'>('Hann');
    enableLeq = $state(false);
    leqWindowSeconds = $state(10);
    leqValue = $state(-120); // Valor Leq actual en dBSPL
    enableSourceWindow = $state(false);
    sourceWindowWidthMs = $state(10.0);
    sourceWindowOffsetMs = $state(0.0);
    // Routing de canales dual-channel
    refChannel = $state(-1);          // -1=Loop (generador), 0=L, 1=R
    measChannel = $state(1);          // Canal físico para medición (0=L, 1=R)

    // Toast notification
    toastMessage = $state('');
    private toastTimer: ReturnType<typeof setTimeout> | null = null;

    showToast(message: string, durationMs = 4000) {
        this.toastMessage = message;
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.toastMessage = ''; }, durationMs);
    }

    // Input filter pre-FFT (como OSM)
    inputFilter = $state<'None' | 'Notch1k' | 'BP100' | 'LP200'>('None');

    // Delay compensation
    compensationDelayMs = $state(0);       // Delay manual en ms
    autoDelayCompensation = $state(true);  // Auto-detect desde IR

    // Averaging threshold
    averagingThresholdDb = $state(-60);    // dBFS threshold para amplitude gating

    constructor() {
        if (typeof window !== 'undefined') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (this.themeMode === 'system') {
                    this.applyTheme();
                }
            });
            // Esperar a que se cargue la configuración de localStorage si existe
            setTimeout(() => {
                this.applyTheme();
                this.applyPalette();
                this.applyCanvasTheme();
            }, 0);
        }
    }

    setLayout(newLayout: string) {
        this.layout = newLayout;
    }

    get isDarkMode(): boolean {
        if (this.themeMode === 'system') {
            return typeof window !== 'undefined'
                ? window.matchMedia('(prefers-color-scheme: dark)').matches
                : true;
        }
        return this.themeMode === 'dark';
    }

    /** Resolved dark mode for the canvas (considering canvasTheme override) */
    get isCanvasDark(): boolean {
        if (this.canvasTheme === 'dark') return true;
        if (this.canvasTheme === 'light') return false;
        return this.isDarkMode; // auto → follow UI theme
    }

    setThemeMode(mode: 'system' | 'light' | 'dark') {
        this.themeMode = mode;
        this.applyTheme();
    }

    applyTheme() {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', this.isDarkMode);
            this._syncCanvasDarkMode();
        }
    }

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
            this._syncCanvasDarkMode();
        }
    }

    /** Sync the canvas 2D rendering theme with the resolved dark mode */
    private _syncCanvasDarkMode() {
        setCanvasDarkMode(this.isCanvasDark);
    }

    simulatedMagnitudeRequest = $state(0);

    addSimulatedMagnitudeToAll() {
        this.simulatedMagnitudeRequest = (this.simulatedMagnitudeRequest || 0) + 1;
    }
}

export const uiStore = new UIStore();
