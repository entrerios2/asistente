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
        this.sharedBuffer = null;
        this.writeIndex = 0;
        this.bufferSize = 0;
        this.sampleRate = 48000;

        // Parámetros FSK
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

        // 1. Lógica de Ring Buffer para el hilo principal
        for (let i = 0; i < length; i++) {
            const sample = channelData[i];
            this.sharedBuffer[this.writeIndex] = sample;
            this.writeIndex = (this.writeIndex + 1) % this.bufferSize;

            // 2. Lógica de Demodulación FSK (Procesamiento por bloques para Goertzel)
            this.samplesCount++;
            
            // Cada 'blockSize' muestras, evaluamos la frecuencia dominante
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

            // 3. Máquina de Estados UART (110 baud)
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
