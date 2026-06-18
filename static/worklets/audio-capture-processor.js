/**
 * Goertzel implementation for Worklet (Vanilla JS)
 */
class Goertzel {
    constructor(targetFreq, sampleRate, blockSize) {
        const k = Math.round((blockSize * targetFreq) / sampleRate);
        const omega = (2 * Math.PI * k) / blockSize;
        this.coeff = 2 * Math.cos(omega);
        this.q1 = 0;
        this.q2 = 0;
    }

    process(samples) {
        this.q1 = 0;
        this.q2 = 0;
        for (let i = 0; i < samples.length; i++) {
            const q0 = this.coeff * this.q1 - this.q2 + samples[i];
            this.q2 = this.q1;
            this.q1 = q0;
        }
        return this.q1 * this.q1 + this.q2 * this.q2 - this.q1 * this.q2 * this.coeff;
    }
}

class AudioCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Dual-channel ring buffers
        this.refBuffer = null;
        this.measBuffer = null;
        this.refWriteIdx = 0;
        this.measWriteIdx = 0;
        this.bufferSize = 0;
        this.hasSAB = false;

        // Acumulación de bloques FFT
        this.fftSize = 8192;
        this.samplesAccumulated = 0;
        this.overlapFraction = 0.5; // 50% overlap default

        // Parámetros FSK
        this.sampleRate = 48000;
        this.baudRate = 110;
        this.samplesPerBit = Math.round(this.sampleRate / this.baudRate); // ~436
        this.blockSize = 128; // Tamaño de ventana para Goertzel
        this.threshold = 0.001; // Umbral de energía (ajustable)

        // Detectores
        this.markDetector = new Goertzel(1650, this.sampleRate, this.blockSize);
        this.spaceDetector = new Goertzel(1850, this.sampleRate, this.blockSize);

        // Estado del Demodulador
        this.state = 'IDLE';
        this.bitBuffer = [];
        this.samplesCount = 0;
        this.currentBit = 1;

        this.port.onmessage = (event) => {
            if (event.data && event.data.type === 'init') {
                this.fftSize = event.data.fftSize || 8192;
                this.bufferSize = this.fftSize;
                if (event.data.refSab && event.data.measSab) {
                    this.refBuffer = new Float32Array(event.data.refSab);
                    this.measBuffer = new Float32Array(event.data.measSab);
                    this.hasSAB = true;
                } else {
                    this.refBuffer = new Float32Array(this.bufferSize);
                    this.measBuffer = new Float32Array(this.bufferSize);
                    this.hasSAB = false;
                }
                this.refWriteIdx = 0;
                this.measWriteIdx = 0;
                this.samplesAccumulated = 0;
            }
            if (event.data && event.data.type === 'updateFftSize') {
                this.fftSize = event.data.fftSize;
                this.bufferSize = this.fftSize;
                this.refBuffer = new Float32Array(this.bufferSize);
                this.measBuffer = new Float32Array(this.bufferSize);
                this.refWriteIdx = 0;
                this.measWriteIdx = 0;
                this.samplesAccumulated = 0;
                this.hasSAB = false;
            }
            if (event.data && event.data.type === 'setOverlap') {
                this.overlapFraction = event.data.overlap;
            }
            // Mantener compatibilidad con el protocolo SAB antiguo
            if (event.data && event.data.sab) {
                // Legacy single-channel SAB — ignorar o migrar
            }
        };
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;
        if (!this.refBuffer || !this.measBuffer) return true;

        const ch0 = input[0];                  // Canal 0
        const ch1 = input[1] || input[0];      // Canal 1 (fallback mono)
        const len = ch0.length;

        // Escribir en ring buffers duales
        for (let i = 0; i < len; i++) {
            this.refBuffer[this.refWriteIdx] = ch0[i];
            this.measBuffer[this.measWriteIdx] = ch1[i];
            this.refWriteIdx = (this.refWriteIdx + 1) % this.bufferSize;
            this.measWriteIdx = (this.measWriteIdx + 1) % this.bufferSize;
        }

        this.samplesAccumulated += len;

        // Cuando tenemos fftSize muestras, notificar al main thread
        if (this.samplesAccumulated >= this.fftSize) {
            if (!this.hasSAB) {
                // Extraer bloque ordenado del ring buffer circular
                const refBlock = new Float32Array(this.fftSize);
                const measBlock = new Float32Array(this.fftSize);
                for (let i = 0; i < this.fftSize; i++) {
                    const readIdx = (this.refWriteIdx - this.fftSize + i + this.bufferSize) % this.bufferSize;
                    refBlock[i] = this.refBuffer[readIdx];
                    measBlock[i] = this.measBuffer[readIdx];
                }
                this.port.postMessage({
                    type: 'DUAL_BLOCK',
                    ref: refBlock.buffer,
                    meas: measBlock.buffer
                }, [refBlock.buffer, measBlock.buffer]);
            } else {
                // SAB: notificar que hay un bloque listo
                this.port.postMessage({ type: 'BLOCK_READY' });
            }

            // Overlap: retroceder el contador
            const hopSize = Math.round(this.fftSize * (1 - this.overlapFraction));
            this.samplesAccumulated -= hopSize;
        }

        // Mantener lógica FSK/Goertzel existente sobre ch0
        const channelData = ch0;
        for (let i = 0; i < len; i++) {
            this.samplesCount++;
            if (this.samplesCount % this.blockSize === 0) {
                const block = channelData.slice(Math.max(0, i - this.blockSize + 1), i + 1);
                const markEnergy = this.markDetector.process(block);
                const spaceEnergy = this.spaceDetector.process(block);
                if (markEnergy > spaceEnergy && markEnergy > this.threshold) {
                    this.currentBit = 1;
                } else if (spaceEnergy > markEnergy && spaceEnergy > this.threshold) {
                    this.currentBit = 0;
                }
            }
            this.handleFskState();
        }

        return true;
    }

    handleFskState() {
        switch (this.state) {
            case 'IDLE':
                // Buscamos el Start Bit (Transición a Space / 0)
                if (this.currentBit === 0) {
                    this.state = 'START_BIT';
                    this.bitTimer = Math.round(this.samplesPerBit * 1.5); // Saltamos a la mitad del primer bit de datos
                    this.bitBuffer = [];
                }
                break;

            case 'START_BIT':
                this.bitTimer--;
                if (this.bitTimer <= 0) {
                    this.state = 'DATA_BITS';
                    this.bitTimer = this.samplesPerBit;
                }
                break;

            case 'DATA_BITS':
                this.bitTimer--;
                if (this.bitTimer <= 0) {
                    this.bitBuffer.push(this.currentBit);
                    this.bitTimer = this.samplesPerBit;

                    if (this.bitBuffer.length === 8) { // 7 datos + 1 paridad (simplificado)
                        this.decodeFskByte(this.bitBuffer);
                        this.state = 'IDLE';
                    }
                }
                break;
        }
    }

    decodeFskByte(bits) {
        // Extraemos los 7 bits de datos
        const dataBits = bits.slice(0, 7);
        let charCode = 0;
        for (let i = 0; i < 7; i++) {
            if (dataBits[i] === 1) charCode |= (1 << i);
        }

        const char = String.fromCharCode(charCode);
        
        // Emitimos si es un caracter válido (ej. cabecera 'V')
        if (char === 'V') {
            this.port.postMessage({ type: 'FSK_HEADER', payload: char });
        }
    }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
