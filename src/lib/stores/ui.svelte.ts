/**
 * UI Store: Estado reactivo para la interfaz de usuario y configuración global.
 */

class UIStore {
    layout = $state('1x1'); // '1x1' | '1x2' | '2x1' | '2x2' | '3x1' | '3x2'
    showSnapshots = $state(true); // Aunque ahora esté en el sidebar, mantenemos el control
    themeMode = $state<'system' | 'light' | 'dark'>('dark');
    showSidebar = $state(true);
    
    // Configuración de Audio
    audioInDevice = $state('');
    audioOutDevice = $state('');
    inChannels = $state([true, false]); // Canal 1 activo, Canal 2 inactivo (ejemplo)
    outChannels = $state([true, true]);
    referenceChannel = $state('Loopback'); // 'Loopback' o índice del canal
    isSimulating = $state(false);

    // NUEVOS ESTADOS COMPARTIDOS FASE 2A.3
    activeTab = $state('medicion'); // 'medicion' | 'eq' | 'snaps' | 'config'
    measurementMode = $state('manual'); // 'manual' | 'secuencial'
    isMeasuring = $state(false);

    // Configuración de Rendimiento y DSP (Fase 2)
    targetFps = $state(10);
    dspUpdateRate = $state(2); // Hz
    fftSize = $state(8192);
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
    eqType = $state<'grafico' | 'parametrico'>('grafico'); // 'grafico' | 'parametrico'

    // NUEVOS CONTROLES DE CALIBRACIÓN GLOBAL Y GANANCIA (PROMPT 7)
    inputGain = $state(0); // Ganancia de entrada en dB (-20 a +20)
    displayOffset = $state(0); // Offset de visualización en dB (-100 a +100)

    // NUEVOS CONTROLES DSP AVANZADOS - PARIDAD OSM (PROMPT 9)
    weightingType = $state<'A' | 'B' | 'C' | 'Z'>('Z');
    averagingType = $state<'None' | 'FIFO' | 'LPF'>('LPF');
    averagingDepth = $state(16);
    averagingAlpha = $state(0.1);
    windowType = $state<'Rectangular' | 'Hann' | 'Hamming' | 'FlatTop' | 'BlackmanHarris' | 'HFT223D' | 'Exponential'>('Hann');
    enableLeq = $state(false);
    leqWindowSeconds = $state(10);
    leqValue = $state(-120); // Valor Leq actual en dBSPL
    enableSourceWindow = $state(false);
    sourceWindowWidthMs = $state(10.0);
    sourceWindowOffsetMs = $state(0.0);

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
            }, 0);
        }
    }

    toggleSnapshots() {
        this.showSnapshots = !this.showSnapshots;
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

    setThemeMode(mode: 'system' | 'light' | 'dark') {
        this.themeMode = mode;
        this.applyTheme();
    }

    applyTheme() {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', this.isDarkMode);
        }
    }

    simulatedMagnitudeRequest = $state(0);

    addSimulatedMagnitudeToAll() {
        this.simulatedMagnitudeRequest = (this.simulatedMagnitudeRequest || 0) + 1;
    }
}

export const uiStore = new UIStore();
