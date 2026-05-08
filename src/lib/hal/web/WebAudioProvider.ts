import type { AudioProvider, AudioListener } from '../types';

export class WebAudioProvider implements AudioProvider {
	private audioContext: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private sab: SharedArrayBuffer | null = null;
	private sharedArray: Float32Array | null = null;
	private animationFrameId: number | null = null;

	async startCapture(listener: AudioListener): Promise<void> {
		// 1. AudioContext con sample rate fijo a 48kHz
		this.audioContext = new AudioContext({ sampleRate: 48000 });

		// 2. Pedir permisos con procesamiento desactivado
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false
			}
		});

		// 3. Cargar el módulo del worklet
		await this.audioContext.audioWorklet.addModule('/asistente/worklets/audio-capture-processor.js');

		const source = this.audioContext.createMediaStreamSource(this.stream);

		// 4. Configurar SharedArrayBuffer (1 segundo a 48kHz)
		const bufferSize = 48000;
		this.sab = new SharedArrayBuffer(bufferSize * Float32Array.BYTES_PER_ELEMENT);
		this.sharedArray = new Float32Array(this.sab);

		this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');
		
		// Enviamos el SAB al Worklet
		this.workletNode.port.postMessage({ sab: this.sab });

		source.connect(this.workletNode);

		// 5. Lectura proactiva mediante requestAnimationFrame
		const readData = () => {
			if (this.sharedArray) {
				// Pasamos el buffer completo al listener.
				// El consumidor deberá manejar la lógica de Ring Buffer mediante índices.
				listener.onAudioData(this.sharedArray);
			}
			this.animationFrameId = requestAnimationFrame(readData);
		};

		readData();
	}

	stopCapture(): void {
		if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
		if (this.workletNode) this.workletNode.disconnect();
		if (this.stream) this.stream.getTracks().forEach(track => track.stop());
		if (this.audioContext) this.audioContext.close();
		
		this.audioContext = null;
		this.stream = null;
		this.workletNode = null;
	}

	playPinkNoise(active: boolean): void {
		console.info(`Pink Noise: ${active ? 'ON' : 'OFF'}`);
	}
}
