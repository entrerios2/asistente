/**
 * UI Store: Estado reactivo para la interfaz de usuario y configuración global.
 */

class UIStore {
    layout = $state('1x1'); // '1x1' | '1x2' | '2x1' | '2x2' | '3x1' | '3x2'
    showSnapshots = $state(true); // Aunque ahora esté en el sidebar, mantenemos el control
    isDarkMode = $state(true);
    
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
    targetFps = $state(30);
    dspUpdateRate = $state(2); // Hz
    fftSize = $state(8192);

    // Estado del Generador de Audio
    generatorType = $state('pink'); // 'pink' | 'white' | 'brown' | 'music-noise' | 'sine' | 'sweep' | 'burst' | 'sinburst' | 'mls'
    genActive = $state(false);
    genFreq = $state(1000);
    genLevel = $state(0);
    genRouting = $state<'L' | 'R' | 'Stereo'>('Stereo');

    toggleSnapshots() {
        this.showSnapshots = !this.showSnapshots;
    }

    setLayout(newLayout: string) {
        this.layout = newLayout;
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        document.documentElement.classList.toggle('dark', this.isDarkMode);
    }
}

export const uiStore = new UIStore();
