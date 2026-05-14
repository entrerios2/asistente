import { base } from '$app/paths';
import type { AudioProvider, AudioListener } from '../types';

export class WebAudioProvider implements AudioProvider {
	private audioContext: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private sab: SharedArrayBuffer | null = null;
	private sharedArray: Float32Array | null = null;
	private animationFrameId: number | null = null;
	
	// Nodos del generador universal
	private generatorNode: AudioNode | null = null;
	private generatorGainNode: GainNode | null = null;
	private pannerNode: StereoPannerNode | null = null;

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

	playGenerator(type: 'pink' | 'white' | 'sweep' | 'sine', active: boolean, freq: number, level: number, routing: 'L' | 'R' | 'Stereo'): void {
		if (!this.audioContext) {
			this.audioContext = new AudioContext({ sampleRate: 48000 });
		}

		// Limpieza de nodos existentes si están activos
		if (this.generatorNode) {
			this.generatorNode.disconnect();
			this.generatorNode = null;
		}
		if (this.generatorGainNode) {
			this.generatorGainNode.disconnect();
			this.generatorGainNode = null;
		}
		if (this.pannerNode) {
			this.pannerNode.disconnect();
			this.pannerNode = null;
		}

		if (!active) return;

		this.generatorGainNode = this.audioContext.createGain();
		this.generatorGainNode.gain.value = Math.pow(10, level / 20);

		this.pannerNode = this.audioContext.createStereoPanner();
		this.pannerNode.pan.value = routing === 'L' ? -1 : routing === 'R' ? 1 : 0;

		if (type === 'sweep') {
			const osc = this.audioContext.createOscillator();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
			osc.frequency.exponentialRampToValueAtTime(20000, this.audioContext.currentTime + 5);
			osc.start();
			this.generatorNode = osc;
		} else if (type === 'sine') {
			const osc = this.audioContext.createOscillator();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
			osc.start();
			this.generatorNode = osc;
		} else if (type === 'white') {
			const bufferSize = 2 * this.audioContext.sampleRate;
			const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
			const output = noiseBuffer.getChannelData(0);
			for (let i = 0; i < bufferSize; i++) {
				output[i] = Math.random() * 2 - 1;
			}
			const whiteNoise = this.audioContext.createBufferSource();
			whiteNoise.buffer = noiseBuffer;
			whiteNoise.loop = true;
			whiteNoise.start();
			this.generatorNode = whiteNoise;
		} else if (type === 'pink') {
			const node = this.audioContext.createScriptProcessor(4096, 1, 1);
			let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
			node.onaudioprocess = (e) => {
				const out = e.outputBuffer.getChannelData(0);
				for (let i = 0; i < out.length; i++) {
					const white = Math.random() * 2 - 1;
					b0 = 0.99886 * b0 + white * 0.0555179;
					b1 = 0.99332 * b1 + white * 0.0750759;
					b2 = 0.96900 * b2 + white * 0.1538520;
					b3 = 0.86650 * b3 + white * 0.3104856;
					b4 = 0.55000 * b4 + white * 0.5329522;
					b5 = -0.7616 * b5 - white * 0.0168980;
					const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
					b6 = white * 0.115926;
					out[i] = pink * 0.11;
				}
			};
			this.generatorNode = node;
		}

		if (this.generatorNode && this.generatorGainNode && this.pannerNode) {
			this.generatorNode.connect(this.generatorGainNode);
			this.generatorGainNode.connect(this.pannerNode);
			this.pannerNode.connect(this.audioContext.destination);
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

	getSharedBuffer(): SharedArrayBuffer | null {
		return this.sab;
	}
}
