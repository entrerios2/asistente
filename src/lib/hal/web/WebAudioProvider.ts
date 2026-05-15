import { base } from '$app/paths';
import type { AudioProvider, AudioListener } from '../types';
import { meterStore } from '../../stores/meterStore.svelte';

export class WebAudioProvider implements AudioProvider {
	private audioContext: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private sab: SharedArrayBuffer | null = null;
	private sharedArray: Float32Array | null = null;
	private analyserNode: AnalyserNode | null = null;
	private freqDataArray: Float32Array | null = null;
	private animationFrameId: number | null = null;

	// Nodos del generador
	private generatorNode: AudioNode | null = null;
	private generatorGainNode: GainNode | null = null;
	private pannerNode: StereoPannerNode | null = null;

	async startCapture(listener: AudioListener): Promise<void> {
		if (!this.audioContext) {
			this.audioContext = new AudioContext({ sampleRate: 48000 });
		}

		if (this.audioContext.state === 'suspended') {
			await this.audioContext.resume();
		}

		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
				channelCount: 2
			}
		});

		await this.audioContext.audioWorklet.addModule(`${base}/worklets/audio-capture-processor.js`);

		const source = this.audioContext.createMediaStreamSource(this.stream);

		// Analyser para RTA (Fast-Path)
		this.analyserNode = this.audioContext.createAnalyser();
		this.analyserNode.fftSize = 8192; // Mayor resolución para RTA
		this.analyserNode.smoothingTimeConstant = 0.2;
		this.freqDataArray = new Float32Array(this.analyserNode.frequencyBinCount);
		source.connect(this.analyserNode);

		const bufferSize = 48000;
		this.sab = new SharedArrayBuffer(bufferSize * Float32Array.BYTES_PER_ELEMENT);
		this.sharedArray = new Float32Array(this.sab);

		this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');
		this.workletNode.port.postMessage({ sab: this.sab });

		source.connect(this.workletNode);

		const readData = () => {
			if (this.sharedArray) {
				listener.onAudioData(this.sharedArray);
				
				// Cálculo de niveles para Vúmetros IN
				let maxIn = 0;
				for (let i = 0; i < 128; i++) { // Revisamos solo el bloque actual aprox
					const val = Math.abs(this.sharedArray[i]);
					if (val > maxIn) maxIn = val;
				}
				const dbIn = 20 * Math.log10(maxIn || 1e-6);
				meterStore.updateIn([dbIn, dbIn]); // Simulación stereo desde mono
			}

			if (this.analyserNode && this.freqDataArray && listener.onFrequencyData) {
				this.analyserNode.getFloatFrequencyData(this.freqDataArray);
				listener.onFrequencyData(this.freqDataArray);
			}

			this.animationFrameId = requestAnimationFrame(readData);
		};

		readData();
	}

	stopCapture(): void {
		if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
		if (this.workletNode) this.workletNode.disconnect();
		if (this.analyserNode) this.analyserNode.disconnect();
		if (this.stream) this.stream.getTracks().forEach(track => track.stop());
		
		this.stream = null;
		this.workletNode = null;
		this.analyserNode = null;
		this.freqDataArray = null;
	}

	playGenerator(type: string, active: boolean, freq: number, level: number, routing: 'L' | 'R' | 'Stereo'): void {
		if (!this.audioContext) {
			this.audioContext = new AudioContext({ sampleRate: 48000 });
		}

		if (this.generatorNode) {
			this.generatorNode.disconnect();
			this.generatorNode = null;
		}
		if (this.generatorGainNode) {
			this.generatorGainNode.disconnect();
			this.generatorGainNode = null;
		}

		if (!active) {
			meterStore.updateOut([-60, -60]);
			return;
		}

		meterStore.updateOut([level, level]);

		this.generatorGainNode = this.audioContext.createGain();
		this.generatorGainNode.gain.setValueAtTime(Math.pow(10, level / 20), this.audioContext.currentTime);

		this.pannerNode = this.audioContext.createStereoPanner();
		this.pannerNode.pan.setValueAtTime(routing === 'L' ? -1 : routing === 'R' ? 1 : 0, this.audioContext.currentTime);

		const sampleRate = this.audioContext.sampleRate;

		if (type === 'sweep') {
			// Barrido Logarítmico Puro via AudioBuffer
			const duration = 5;
			const f1 = 10; // Start below 20Hz
			const f2 = 20000;
			const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
			const data = buffer.getChannelData(0);
			const L = duration / Math.log(f2 / f1);
			
			for (let i = 0; i < data.length; i++) {
				const t = i / sampleRate;
				data[i] = Math.sin(2 * Math.PI * f1 * L * (Math.exp(t / L) - 1));
			}

			const source = this.audioContext.createBufferSource();
			source.buffer = buffer;
			source.loop = true;
			source.start();
			this.generatorNode = source;
		} else if (type === 'white' || type === 'brown') {
			const bufferSize = 2 * sampleRate;
			const buffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
			const data = buffer.getChannelData(0);
			let lastOut = 0;
			
			for (let i = 0; i < bufferSize; i++) {
				const white = Math.random() * 2 - 1;
				if (type === 'white') {
					data[i] = white;
				} else {
					// Brown noise (leaked integrator)
					data[i] = (lastOut + (0.02 * white)) / 1.02;
					lastOut = data[i];
					data[i] *= 3.5; // Gain compensation
				}
			}
			const source = this.audioContext.createBufferSource();
			source.buffer = buffer;
			source.loop = true;
			source.start();
			this.generatorNode = source;
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
		} else {
			// Sine fallback
			const osc = this.audioContext.createOscillator();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
			osc.start();
			this.generatorNode = osc;
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
