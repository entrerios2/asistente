export type AudioBufferChunk = Float32Array;

export interface AudioListener {
	onAudioData(data: AudioBufferChunk): void;
}

export interface AudioProvider {
	startCapture(listener: AudioListener): Promise<void>;
	stopCapture(): void;
	playPinkNoise(active: boolean): void;
}
