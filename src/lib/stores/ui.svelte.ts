/**
 * UI Store: Estado reactivo para la interfaz de usuario.
 */

class UIStore {
    layout = $state('2x2'); // '1x1' | '2x1' | '2x2' | '3x2'
    showSnapshots = $state(true);
    isDarkMode = $state(true);

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
