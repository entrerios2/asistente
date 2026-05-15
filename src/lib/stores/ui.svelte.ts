/**
 * UI Store: Estado reactivo para la interfaz de usuario y configuración global.
 */

class UIStore {
    layout = $state('2x2'); // '1x1' | '1x2' | '1x3' | '2x1' | '2x2' | '2x3'
    showSnapshots = $state(true); // Aunque ahora esté en el sidebar, mantenemos el control
    isDarkMode = $state(true);
    
    // Configuración de Audio
    audioInDevice = $state('');
    audioOutDevice = $state('');
    inChannels = $state([true, false]); // Canal 1 activo, Canal 2 inactivo (ejemplo)
    outChannels = $state([true, true]);
    referenceChannel = $state('Loopback'); // 'Loopback' o índice del canal

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
