export type AudioBufferChunk = Float32Array;

export interface AudioListener {
	onAudioData(data: AudioBufferChunk): void;
	onFrequencyData?(data: Float32Array): void;
	onTimeDomainData?(measSamples: Float32Array, refSamples?: Float32Array): void;
}

export interface AudioDevice {
    id: string;
    name: string;
    backend: string;
    direction: 'input' | 'output';
    channels: number;
}

export type SignalType = 'white' | 'pink' | 'brown' | 'music-noise' | 'sine' | 'sweep' | 'burst' | 'sinburst' | 'mls';

export interface AudioProvider {
	startCapture(listener: AudioListener): Promise<void>;
	stopCapture(): void;
	playGenerator(type: SignalType, active: boolean, freq: number, level: number, routing: 'L' | 'R' | 'Stereo'): void | Promise<void>;
	playSample?(url: string): Promise<void>;
	onMessage?(callback: (message: any) => void): void;
    listDevices?(): Promise<AudioDevice[]>;
    selectDevice?(id: string, direction: 'input' | 'output'): Promise<void>;
	getSharedBuffer?(): SharedArrayBuffer | null;
	sendWorkletMessage?(msg: any): void;
}
