import { base } from '$app/paths';
import type { AudioProvider, AudioListener } from '../types';

export class WebAudioProvider implements AudioProvider {
	private audioContext: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private sab: SharedArrayBuffer | null = null;
	private sharedArray: Float32Array | null = null;
	private animationFrameId: number | null = null;
	
	// Estado para el generador de ruido rosa
	private pinkNoiseNode: ScriptProcessorNode | null = null;
	private b0 = 0;
	private b1 = 0;
	private b2 = 0;
	private b3 = 0;
	private b4 = 0;
	private b5 = 0;
	private b6 = 0;

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

		// 3. Cargar el módulo del worklet usando la ruta dinámica
		await this.audioContext.audioWorklet.addModule(`${base}/worklets/audio-capture-processor.js`);

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
		if (active) {
			if (this.pinkNoiseNode) return; // Ya está activo
			
			if (!this.audioContext) {
				this.audioContext = new AudioContext({ sampleRate: 48000 });
			}

			// Buffer de 4096 para eficiencia
			this.pinkNoiseNode = this.audioContext.createScriptProcessor(4096, 1, 1);
			
			this.pinkNoiseNode.onaudioprocess = (e) => {
				const output = e.outputBuffer.getChannelData(0);
				for (let i = 0; i < output.length; i++) {
					const white = Math.random() * 2 - 1;
					
					// Algoritmo de Paul Kellet (Voss-McCartney)
					this.b0 = 0.99886 * this.b0 + white * 0.0555179;
					this.b1 = 0.99332 * this.b1 + white * 0.0750759;
					this.b2 = 0.96900 * this.b2 + white * 0.1538520;
					this.b3 = 0.86650 * this.b3 + white * 0.3104856;
					this.b4 = 0.55000 * this.b4 + white * 0.5329522;
					this.b5 = -0.7616 * this.b5 - white * 0.0168980;
					
					const pink = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
					this.b6 = white * 0.115926;
					
					// Compensación de ganancia (~-20dB)
					output[i] = pink * 0.11;
				}
			};

			this.pinkNoiseNode.connect(this.audioContext.destination);
			console.info('Pink Noise: ON');
		} else {
			if (this.pinkNoiseNode) {
				this.pinkNoiseNode.disconnect();
				this.pinkNoiseNode = null;
				console.info('Pink Noise: OFF');
			}
		}
	}

	async playSample(url: string): Promise<void> {
		if (!this.audioContext) {
			this.audioContext = new AudioContext({ sampleRate: 48000 });
		}

		if (this.audioContext.state === 'suspended') {
			await this.audioContext.resume();
		}

		const response = await fetch(url);
		const arrayBuffer = await response.arrayBuffer();
		const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

		return new Promise((resolve) => {
			const source = this.audioContext!.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(this.audioContext!.destination);
			
			source.onended = () => {
				source.disconnect();
				resolve();
			};

			source.start(0);
		});
	}

	onMessage(callback: (message: any) => void): void {
		if (this.workletNode) {
			this.workletNode.port.onmessage = (event) => {
				callback(event.data);
			};
		} else {
			console.warn('WebAudioProvider: No se puede registrar el callback porque el workletNode no ha sido inicializado.');
		}
	}
}
