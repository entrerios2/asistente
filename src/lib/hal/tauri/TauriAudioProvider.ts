import { invoke } from '@tauri-apps/api/core';
import type { AudioProvider, AudioListener, AudioBufferChunk, AudioDevice, SignalType } from '../types';
import { uiStore } from '../../stores/ui.svelte';

export class TauriAudioProvider implements AudioProvider {
	private intervalId: any = null;

	async startCapture(listener: AudioListener): Promise<void> {
		console.warn('[TauriAudioProvider] ⚠️ Usando datos simulados — backend nativo no implementado');
		this.intervalId = setInterval(() => {
			const data: AudioBufferChunk = new Float32Array(512);
			for (let i = 0; i < data.length; i++) {
				data[i] = Math.random() * 2 - 1;
			}
			listener.onAudioData(data);

			if (uiStore.enableLeq) {
				// Simulación de Leq dinámica alrededor de un nivel calibrado
				uiStore.leqValue = 75 + Math.sin(Date.now() / 3000) * 4 + Math.random() * 0.5;
			}
		}, 20);
	}

	stopCapture(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	playGenerator(type: SignalType, active: boolean, _freq: number, _level: number, _routing: 'L' | 'R' | 'Stereo'): void {
		console.warn(`[TauriAudioProvider] ⚠️ Generador no implementado en modo Tauri [${type}]: ${active ? 'ON' : 'OFF'}`);
	}

	async playBuffer(_buffer: Float32Array, _sampleRate: number): Promise<void> {
		console.warn('[TauriAudioProvider] ⚠️ playBuffer no implementado en modo Tauri');
	}

    async listDevices(): Promise<AudioDevice[]> {
        return await invoke<AudioDevice[]>('list_audio_devices');
    }

    async selectDevice(id: string, direction: 'input' | 'output'): Promise<void> {
        await invoke('select_audio_device', { id, direction });
    }
}
