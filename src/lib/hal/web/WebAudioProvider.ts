import { base } from '$app/paths';
import type { AudioProvider, AudioListener, SignalType, AudioDevice } from '../types';
import { meterStore } from '../../stores/meterStore.svelte';
import { uiStore } from '../../stores/ui.svelte';
import { LeqCalculator } from '../../dsp/leq';
import {
	generateWhiteNoise,
	generatePinkNoise,
	generateBrownNoise,
	generateMusicNoise,
	generateLogSweep,
	generateBurst,
	generateSinBurst,
	generateMLS
} from '../../dsp/signalGenerators';

export class WebAudioProvider implements AudioProvider {
	private audioContext: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private analyserNode: AnalyserNode | null = null;
	private freqDataArray: Float32Array | null = null;
	private animationFrameId: number | null = null;
	private leqCalculator: LeqCalculator | null = null;

	private analyserRef: AnalyserNode | null = null;
	private splitterNode: ChannelSplitterNode | null = null;
	private refSab: SharedArrayBuffer | null = null;
	private measSab: SharedArrayBuffer | null = null;
	private flagSab: SharedArrayBuffer | null = null;
	private flagArray: Int32Array | null = null;
	private refTimeDomain: Float32Array | null = null;
	private measTimeDomain: Float32Array | null = null;

	// Nodos del generador
	private generatorNode: AudioNode | null = null;
	private generatorGainNode: GainNode | null = null;
	private pannerNode: StereoPannerNode | null = null;

	// Pre-allocated buffers for hot path (avoid allocations per frame)
	private leqTimeData: Float32Array | null = null;
	private sabRefBuf: Float32Array | null = null;
	private sabMeasBuf: Float32Array | null = null;

	// Generator state tracking (prevent unnecessary recreation)
	private lastGenType: string | null = null;
	private lastGenActive: boolean = false;
	private lastGenFreq: number = 0;
	private lastGenLevel: number = 0;
	private lastGenRouting: string = '';

	// Noise worklet loading state
	private noiseWorkletLoaded: Promise<void> | null = null;

	// Stored external message handlers (re-applied when workletNode is created)
	private pendingMessageHandlers: ((message: any) => void)[] = [];

	async startCapture(listener: AudioListener): Promise<void> {
		if (!this.audioContext) {
			this.audioContext = new AudioContext({ sampleRate: uiStore.sampleRate });
		}

		// Enrutar salida al dispositivo seleccionado (Chrome 110+)
		if (uiStore.audioOutDevice && 'setSinkId' in this.audioContext) {
			try {
				await (this.audioContext as any).setSinkId(uiStore.audioOutDevice);
			} catch (e) {
				console.warn('[WebAudioProvider] setSinkId failed:', e);
			}
		}

		if (this.audioContext.state === 'suspended') {
			await this.audioContext.resume();
		}

		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: uiStore.audioInDevice ? { exact: uiStore.audioInDevice } : undefined,
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
				channelCount: 2
			}
		});

		await this.audioContext.audioWorklet.addModule(`${base}/worklets/audio-capture-processor.js`);

		const source = this.audioContext.createMediaStreamSource(this.stream);

		// Dual-channel: separar L/R para captura independiente
		this.splitterNode = this.audioContext.createChannelSplitter(2);
		source.connect(this.splitterNode);

		// Analyser para RTA — conectar SOLO el canal de medición (no el source directo)
		this.analyserNode = this.audioContext.createAnalyser();
		this.analyserNode.fftSize = 8192;
		this.analyserNode.smoothingTimeConstant = 0.2;
		this.freqDataArray = new Float32Array(this.analyserNode.frequencyBinCount);

		// AnalyserNode dedicado para canal de referencia
		this.analyserRef = this.audioContext.createAnalyser();
		this.analyserRef.fftSize = uiStore.fftSize;
		this.analyserRef.smoothingTimeConstant = 0;

		// Conectar cada canal del splitter a su analyser dedicado
		const refCh = uiStore.refChannel;
		const measCh = uiStore.measChannel;
		if (refCh >= 0) {
			this.splitterNode.connect(this.analyserRef, refCh);
		}
		if (measCh >= 0) {
			this.splitterNode.connect(this.analyserNode, measCh);
		}

		// Buffers time-domain para dual-channel
		this.refTimeDomain = new Float32Array(uiStore.fftSize);
		this.measTimeDomain = new Float32Array(uiStore.fftSize);

		const fftSize = uiStore.fftSize;

		this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor', {
			channelCount: 2,
			channelCountMode: 'explicit',
			numberOfInputs: 2,
		});

		// Intentar crear SABs double-buffer para transferencia sin copia
		let hasSAB = false;
		try {
			if (typeof SharedArrayBuffer !== 'undefined') {
				this.refSab = new SharedArrayBuffer(fftSize * 2 * Float32Array.BYTES_PER_ELEMENT);
				this.measSab = new SharedArrayBuffer(fftSize * 2 * Float32Array.BYTES_PER_ELEMENT);
				this.flagSab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
				this.flagArray = new Int32Array(this.flagSab);
				Atomics.store(this.flagArray, 0, -1); // -1 = ningún banco listo
				hasSAB = true;
			}
		} catch {
			// SAB no disponible (sin COOP/COEP headers)
			hasSAB = false;
		}

		// Init worklet con SABs si están disponibles, sino usa postMessage
		if (hasSAB) {
			this.workletNode.port.postMessage({
				type: 'init',
				fftSize,
				refSab: this.refSab,
				measSab: this.measSab,
				flagSab: this.flagSab
			});
		} else {
			this.workletNode.port.postMessage({ type: 'init', fftSize });
		}

		// Flag para evitar re-procesar el mismo bloque en cada rAF tick (fallback postMessage)
		let hasNewData = false;

		this.workletNode.port.addEventListener('message', (event) => {
			if (event.data && event.data.type === 'DUAL_BLOCK') {
				this.refTimeDomain = new Float32Array(event.data.ref);
				this.measTimeDomain = new Float32Array(event.data.meas);
				hasNewData = true;
			}
		});
		// Re-aplicar todos los handlers externos al nuevo workletNode
		for (const handler of this.pendingMessageHandlers) {
			this.workletNode.port.addEventListener('message', (event) => {
				handler(event.data);
			});
		}
		this.workletNode.port.start();

		source.connect(this.workletNode, 0, 0); // Mic → worklet input 0

		// Reconectar generador existente al nuevo worklet para loopback
		// (si el generador ya estaba activo antes de iniciar captura,
		// sigue conectado al viejo workletNode — hay que reconectar)
		if (this.generatorGainNode) {
			this.generatorGainNode.connect(this.workletNode, 0, 1);
		}

		// Enviar refChannel y measChannel iniciales al worklet
		this.workletNode.port.postMessage({ type: 'setRefChannel', channel: uiStore.refChannel });
		this.workletNode.port.postMessage({ type: 'setMeasChannel', channel: uiStore.measChannel });

		const readData = () => {
			// Fast-path RTA (AnalyserNode de medición, solo para Spectrum)
			if (this.analyserNode && this.freqDataArray && listener.onFrequencyData) {
				this.analyserNode.getFloatFrequencyData(this.freqDataArray as any);
				listener.onFrequencyData(this.freqDataArray as any);
			}

			// Dual-channel time-domain para el worker DSP
			// Path 1: SAB double-buffer (preferido — zero-copy)
			if (hasSAB && this.flagArray && listener.onTimeDomainData) {
				const bank = Atomics.load(this.flagArray, 0);
				if (bank >= 0) {
					const offset = bank * fftSize;
					// Reuse preallocated buffers
					if (!this.sabRefBuf || this.sabRefBuf.length !== fftSize) {
						this.sabRefBuf = new Float32Array(fftSize);
						this.sabMeasBuf = new Float32Array(fftSize);
					}
					const refView = new Float32Array(this.refSab!, offset * Float32Array.BYTES_PER_ELEMENT, fftSize);
					const measView = new Float32Array(this.measSab!, offset * Float32Array.BYTES_PER_ELEMENT, fftSize);
					this.sabRefBuf!.set(refView);
					this.sabMeasBuf!.set(measView);
					Atomics.store(this.flagArray, 0, -1); // marcar como leído
					listener.onTimeDomainData(this.sabMeasBuf!, this.sabRefBuf!);
				}
			// Path 2: postMessage fallback
			} else if (listener.onTimeDomainData && hasNewData && this.refTimeDomain && this.measTimeDomain) {
				hasNewData = false;
				listener.onTimeDomainData(this.measTimeDomain, this.refTimeDomain);
			}

			// Leq calculator (mantener existente)
			if (this.analyserNode && uiStore.enableLeq) {
				if (!this.leqCalculator) {
					this.leqCalculator = new LeqCalculator(uiStore.leqWindowSeconds, uiStore.sampleRate);
				} else {
					this.leqCalculator.setWindowSeconds(uiStore.leqWindowSeconds);
				}
				if (!this.leqTimeData || this.leqTimeData.length !== this.analyserNode.fftSize) {
					this.leqTimeData = new Float32Array(this.analyserNode.fftSize);
				}
				this.analyserNode.getFloatTimeDomainData(this.leqTimeData as Float32Array<ArrayBuffer>);
				uiStore.leqValue = this.leqCalculator.processBlock(this.leqTimeData);
			} else {
				this.leqCalculator = null;
			}

			this.animationFrameId = requestAnimationFrame(readData);
		};

		readData();
	}

	stopCapture(): void {
		if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
		if (this.workletNode) this.workletNode.disconnect();
		if (this.analyserNode) this.analyserNode.disconnect();
		if (this.analyserRef) this.analyserRef.disconnect();
		if (this.splitterNode) this.splitterNode.disconnect();
		if (this.stream) this.stream.getTracks().forEach(track => track.stop());
		
		this.stream = null;
		this.workletNode = null;
		this.analyserNode = null;
		this.analyserRef = null;
		this.splitterNode = null;
		this.freqDataArray = null;
		this.refTimeDomain = null;
		this.measTimeDomain = null;
	}

	sendWorkletMessage(msg: any): void {
		if (this.workletNode) {
			this.workletNode.port.postMessage(msg);
		}
	}

	async playWavFile(file: File, level: number): Promise<void> {
		if (!this.audioContext) {
			this.audioContext = new AudioContext({ sampleRate: uiStore.sampleRate });
		}
		const arrayBuffer = await file.arrayBuffer();
		const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
		
		if (this.generatorNode) this.generatorNode.disconnect();
		
		const source = this.audioContext.createBufferSource();
		source.buffer = audioBuffer;
		source.loop = true;
		
		this.generatorGainNode = this.audioContext.createGain();
		this.generatorGainNode.gain.setValueAtTime(Math.pow(10, level / 20), this.audioContext.currentTime);
		
		source.connect(this.generatorGainNode);
		this.generatorGainNode.connect(this.audioContext.destination);
		
		source.start();
		this.generatorNode = source;
	}

	async playGenerator(type: SignalType, active: boolean, freq: number, level: number, routing: 'L' | 'R' | 'Stereo'): Promise<void> {
		// Skip if nothing changed — prevents glitch on reactive re-evaluation
		if (
			type === this.lastGenType &&
			active === this.lastGenActive &&
			freq === this.lastGenFreq &&
			level === this.lastGenLevel &&
			routing === this.lastGenRouting
		) {
			return;
		}
		this.lastGenType = type;
		this.lastGenActive = active;
		this.lastGenFreq = freq;
		this.lastGenLevel = level;
		this.lastGenRouting = routing;

		if (!this.audioContext) {
			this.audioContext = new AudioContext({ sampleRate: uiStore.sampleRate });
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
		} else if (['white', 'pink', 'brown', 'music-noise'].includes(type)) {
			// Real-time noise generation via AudioWorklet (no buffer loops)
			if (!this.noiseWorkletLoaded) {
				this.noiseWorkletLoaded = this.audioContext.audioWorklet.addModule(
					`${base}/worklets/noise-generator-processor.js`
				);
			}
			try {
				await this.noiseWorkletLoaded;
				const noiseNode = new AudioWorkletNode(this.audioContext, 'noise-generator-processor', {
					outputChannelCount: [1],
				});
				noiseNode.port.postMessage({ type, sampleRate });
				this.generatorNode = noiseNode;
			} catch (e) {
				console.warn('[WebAudioProvider] AudioWorklet not available, falling back to buffer loop', e);
				// Fallback: pre-rendered buffer (2 seconds, will loop)
				const bufferLength = 2 * sampleRate;
				const audioBuffer = this.audioContext.createBuffer(1, bufferLength, sampleRate);
				const data = audioBuffer.getChannelData(0);
				if (type === 'white') generateWhiteNoise(data, bufferLength);
				else if (type === 'pink') generatePinkNoise(data, bufferLength, sampleRate);
				else if (type === 'brown') generateBrownNoise(data, bufferLength);
				else generateMusicNoise(data, bufferLength, sampleRate);
				const source = this.audioContext.createBufferSource();
				source.buffer = audioBuffer;
				source.loop = true;
				source.start();
				this.generatorNode = source;
			}
		} else {
			// Señales periódicas basadas en buffer pre-renderizado
			// (burst, sinburst)
			const burstDuration = 0.05;  // 50ms de ráfaga
			const totalDuration = 0.5;   // 500ms periodo total
			const bufferLength = Math.round(totalDuration * sampleRate);

			const audioBuffer = this.audioContext.createBuffer(1, bufferLength, sampleRate);
			const data = audioBuffer.getChannelData(0);

			if (type === 'burst') {
				generateBurst(data, bufferLength, freq, burstDuration, sampleRate);
			} else if (type === 'sinburst') {
				generateSinBurst(data, bufferLength, freq, burstDuration, sampleRate);
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

			// Tap pre-panner: conectar generador al worklet input 1 para loopback
			if (this.workletNode) {
				this.generatorGainNode.connect(this.workletNode, 0, 1);
			}
		}
	}

	async playSample(url: string): Promise<void> {
		if (!this.audioContext) {
			this.audioContext = new AudioContext({ sampleRate: uiStore.sampleRate });
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

	async playBuffer(buffer: Float32Array, sampleRate: number): Promise<void> {
		if (!this.audioContext) {
			this.audioContext = new AudioContext({ sampleRate });
		}

		if (this.audioContext.state === 'suspended') {
			await this.audioContext.resume();
		}

		const audioBuffer = this.audioContext.createBuffer(1, buffer.length, sampleRate);
		audioBuffer.getChannelData(0).set(buffer);

		return new Promise((resolve) => {
			const source = this.audioContext!.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(this.audioContext!.destination);

			// Conectar también al worklet (input 1) para detección FSK en loopback
			if (this.workletNode) {
				source.connect(this.workletNode, 0, 1);
			}

			source.onended = () => {
				source.disconnect();
				resolve();
			};

			source.start(0);
		});
	}

	onMessage(callback: (message: any) => void): void {
		this.pendingMessageHandlers.push(callback);
		if (this.workletNode) {
			this.workletNode.port.addEventListener('message', (event) => {
				callback(event.data);
			});
		}
	}

	getSharedBuffer(): SharedArrayBuffer | null {
		return this.refSab;
	}

	async listDevices(): Promise<AudioDevice[]> {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			const audioDevices: AudioDevice[] = [];
			devices.forEach((d) => {
				if (d.kind === 'audioinput' || d.kind === 'audiooutput') {
					audioDevices.push({
						id: d.deviceId,
						name: d.label || (d.kind === 'audioinput' ? 'Micrófono Web' : 'Salida de Audio Web'),
						backend: 'WebAudio',
						direction: d.kind === 'audioinput' ? 'input' : 'output',
						channels: 2, // Fallback estricto de 2 canales en la versión web
					});
				}
			});
			return audioDevices;
		} catch (e) {
			return [
				{ id: 'default-in', name: 'Micrófono por Defecto', backend: 'WebAudio', direction: 'input', channels: 2 },
				{ id: 'default-out', name: 'Salida por Defecto', backend: 'WebAudio', direction: 'output', channels: 2 }
			];
		}
	}

	async selectDevice(id: string, direction: 'input' | 'output'): Promise<void> {
		console.info(`WebAudioProvider: Selección de dispositivo simulada [${direction}]: ${id}`);
	}
}
