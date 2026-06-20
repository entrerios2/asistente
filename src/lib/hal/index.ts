import type { AudioProvider } from './types';
import { WebAudioProvider } from './web/WebAudioProvider';
import { TauriAudioProvider } from './tauri/TauriAudioProvider';

let _instance: AudioProvider | null = null;

export function getAudioProvider(): AudioProvider {
	if (_instance) return _instance;

	// @ts-ignore - Verificamos si estamos en el entorno de Tauri
	if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
		_instance = new TauriAudioProvider();
	} else {
		_instance = new WebAudioProvider();
	}

	return _instance;
}
