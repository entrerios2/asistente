class AudioCaptureProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.sharedBuffer = null;
		this.writeIndex = 0;
		this.bufferSize = 0;

		// Recibimos el SharedArrayBuffer desde el hilo principal
		this.port.onmessage = (event) => {
			if (event.data && event.data.sab) {
				this.sharedBuffer = new Float32Array(event.data.sab);
				this.bufferSize = this.sharedBuffer.length;
			}
		};
	}

	process(inputs) {
		const input = inputs[0];
		if (!input || !input[0] || !this.sharedBuffer) return true;

		const channelData = input[0];
		const length = channelData.length;

		// Copia cíclica de muestras (Ring Buffer)
		for (let i = 0; i < length; i++) {
			this.sharedBuffer[this.writeIndex] = channelData[i];
			this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
		}

		return true;
	}
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
