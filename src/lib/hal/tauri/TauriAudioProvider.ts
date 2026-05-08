import type { AudioProvider, AudioListener, AudioBufferChunk } from '../types';

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

	playPinkNoise(active: boolean): void {
		console.info(`Tauri Pink Noise: ${active ? 'ON (Simulated)' : 'OFF'}`);
	}
}
