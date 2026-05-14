export type AudioBufferChunk = Float32Array;

export interface AudioListener {
	onAudioData(data: AudioBufferChunk): void;
}

export interface AudioDevice {
    id: string;
    name: string;
    backend: string;
    direction: 'input' | 'output';
}

export interface AudioProvider {
	startCapture(listener: AudioListener): Promise<void>;
	stopCapture(): void;
	playGenerator(type: 'pink' | 'white' | 'sweep', active: boolean, freq: number, level: number, routing: 'L' | 'R' | 'Stereo'): void;
	playSample?(url: string): Promise<void>;
	onMessage?(callback: (message: any) => void): void;
    listDevices?(): Promise<AudioDevice[]>;
    selectDevice?(id: string, direction: 'input' | 'output'): Promise<void>;
	getSharedBuffer?(): SharedArrayBuffer | null;
}
