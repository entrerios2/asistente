import { invoke } from '@tauri-apps/api/core';
import type { AudioProvider, AudioListener, AudioBufferChunk, AudioDevice, SignalType } from '../types';

export class TauriAudioProvider implements AudioProvider {
	private intervalId: any = null;

	async startCapture(listener: AudioListener): Promise<void> {
		this.intervalId = setInterval(() => {
			const data: AudioBufferChunk = new Float32Array(512);
			for (let i = 0; i < data.length; i++) {
				data[i] = Math.random() * 2 - 1;
			}
			listener.onAudioData(data);
		}, 20);
	}

	stopCapture(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	playGenerator(type: SignalType, active: boolean, freq: number, level: number, routing: 'L' | 'R' | 'Stereo'): void {
		console.info(`Tauri Generator [${type}]: ${active ? 'ON (Simulated)' : 'OFF'}`);
	}

    async listDevices(): Promise<AudioDevice[]> {
        return await invoke<AudioDevice[]>('list_audio_devices');
    }

    async selectDevice(id: string, direction: 'input' | 'output'): Promise<void> {
        await invoke('select_audio_device', { id, direction });
    }
}
