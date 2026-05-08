import type { AudioProvider } from './types';

export function getAudioProvider(): AudioProvider {
	// @ts-ignore - Verificamos si estamos en el entorno de Tauri
	if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
		throw new Error('Tauri provider not implemented yet');
	}

	throw new Error('Web provider not implemented yet');
}
