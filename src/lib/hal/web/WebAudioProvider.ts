import { base } from '$app/paths';
import type { AudioProvider, AudioListener, SignalType } from '../types';
import { meterStore } from '../../stores/meterStore.svelte';
import {
	generateWhiteNoise,
	generatePinkNoise,
	generateBrownNoise,
	generateMusicNoise,
	generateSineBuffer,
	generateLogSweep,
	generateBurst,
	generateSinBurst,
	generateMLS
} from '../../dsp/signalGenerators';

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
		let writeIndex = 0;
		const hasSAB = typeof SharedArrayBuffer !== 'undefined';

		if (hasSAB) {
			this.sab = new SharedArrayBuffer(bufferSize * Float32Array.BYTES_PER_ELEMENT);
			this.sharedArray = new Float32Array(this.sab);
		} else {
			console.warn('[AudioProvider] SharedArrayBuffer no disponible. Usando fallback ArrayBuffer.');
			this.sab = null;
			this.sharedArray = new Float32Array(bufferSize);
		}

		this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');
		
		if (hasSAB) {
			this.workletNode.port.postMessage({ sab: this.sab });
		} else {
			this.workletNode.port.addEventListener('message', (event) => {
				if (event.data && event.data.type === 'AUDIO_CHUNK' && event.data.buffer) {
					const chunk = new Float32Array(event.data.buffer);
					if (this.sharedArray) {
						for (let i = 0; i < chunk.length; i++) {
							this.sharedArray[writeIndex] = chunk[i];
							writeIndex = (writeIndex + 1) % bufferSize;
						}
					}
				}
			});
			this.workletNode.port.start();
		}

		source.connect(this.workletNode);

		const readData = () => {
			if (this.sharedArray) {
				listener.onAudioData(this.sharedArray);
			}

			if (this.analyserNode && this.freqDataArray && listener.onFrequencyData) {
				this.analyserNode.getFloatFrequencyData(this.freqDataArray as any);
				listener.onFrequencyData(this.freqDataArray as any);
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

	playGenerator(type: SignalType, active: boolean, freq: number, level: number, routing: 'L' | 'R' | 'Stereo'): void {
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

		if (type === 'sine') {
			// Seno continuo: usar OscillatorNode nativo (máxima eficiencia)
			const osc = this.audioContext.createOscillator();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
			osc.start();
			this.generatorNode = osc;
		} else if (type === 'sweep') {
			// Sweep Logarítmico (Farina): buffer pre-renderizado de 5 segundos
			const duration = 5;
			const f1 = 10;
			const f2 = 20000;
			const numSamples = Math.round(duration * sampleRate);
			const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
			const data = audioBuffer.getChannelData(0);
			generateLogSweep(data, numSamples, f1, f2, duration, sampleRate);

			const source = this.audioContext.createBufferSource();
			source.buffer = audioBuffer;
			source.loop = true;
			source.start();
			this.generatorNode = source;
		} else if (type === 'mls') {
			// MLS+: LFSR Galois orden 16 (65535 muestras ≈ 1.37s @ 48kHz)
			const mlsData = generateMLS(16);
			const audioBuffer = this.audioContext.createBuffer(1, mlsData.length, sampleRate);
			audioBuffer.getChannelData(0).set(mlsData);

			const source = this.audioContext.createBufferSource();
			source.buffer = audioBuffer;
			source.loop = true;
			source.start();
			this.generatorNode = source;
		} else {
			// Señales basadas en buffer pre-renderizado de 2 segundos
			// (white, pink, brown, music-noise, burst, sinburst)
			const burstDuration = 0.05;  // 50ms de ráfaga
			const totalDuration = 0.5;   // 500ms periodo total (burst/sinburst)
			const isBurstType = type === 'burst' || type === 'sinburst';
			const bufferLength = isBurstType
				? Math.round(totalDuration * sampleRate)
				: 2 * sampleRate;

			const audioBuffer = this.audioContext.createBuffer(1, bufferLength, sampleRate);
			const data = audioBuffer.getChannelData(0);

			switch (type) {
				case 'white':
					generateWhiteNoise(data, bufferLength);
					break;
				case 'pink':
					generatePinkNoise(data, bufferLength);
					break;
				case 'brown':
					generateBrownNoise(data, bufferLength);
					break;
				case 'music-noise':
					generateMusicNoise(data, bufferLength, sampleRate);
					break;
				case 'burst':
					generateBurst(data, bufferLength, freq, burstDuration, sampleRate);
					break;
				case 'sinburst':
					generateSinBurst(data, bufferLength, freq, burstDuration, sampleRate);
					break;
			}

			const source = this.audioContext.createBufferSource();
			source.buffer = audioBuffer;
			source.loop = true;
			source.start();
			this.generatorNode = source;
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
