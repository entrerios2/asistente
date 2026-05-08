import type { AudioProvider } from './types';
import { WebAudioProvider } from './web/WebAudioProvider';
import { TauriAudioProvider } from './tauri/TauriAudioProvider';

export function getAudioProvider(): AudioProvider {
	// @ts-ignore - Verificamos si estamos en el entorno de Tauri
	if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
		return new TauriAudioProvider();
	}

	return new WebAudioProvider();
}
