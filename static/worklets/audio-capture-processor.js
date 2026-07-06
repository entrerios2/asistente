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
        // Dual-channel ring buffers (always local, never SAB)
        this.ringRef = null;  // Local ring buffer for ref
        this.ringMeas = null; // Local ring buffer for meas
        this.refBuffer = null;  // SAB view for double-buffer (banco A + B)
        this.measBuffer = null; // SAB view for double-buffer (banco A + B)
        this.refWriteIdx = 0;
        this.measWriteIdx = 0;
        this.bufferSize = 0;
        this.hasSAB = false;
        this.flagArray = null; // Int32Array para Atomics sync
        this.currentBank = 0; // Double-buffer: 0=banco A, 1=banco B

        // Acumulación de bloques FFT
        this.fftSize = 8192;
        this.samplesAccumulated = 0;
        this.overlapFraction = 0; // Overlap controlado por dspWorker (UI)
        this.refChannel = -1; // -1=loop (input[1]), 0=L, 1=R de input[0]
        this.measChannel = 1; // 0=L, 1=R de input[0]

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
        this.fskEnabled = false; // Solo activo en modo secuencial

        this.port.onmessage = (event) => {
            if (event.data && event.data.type === 'init') {
                this.fftSize = event.data.fftSize || 8192;
                this.bufferSize = this.fftSize;
                // Ring buffers locales (siempre locales, nunca SAB)
                this.ringRef = new Float32Array(this.bufferSize);
                this.ringMeas = new Float32Array(this.bufferSize);
                if (event.data.refSab && event.data.measSab) {
                    // SAB double-buffer: 2x fftSize para bancos A y B
                    this.refBuffer = new Float32Array(event.data.refSab);
                    this.measBuffer = new Float32Array(event.data.measSab);
                    this.hasSAB = true;
                    this.currentBank = 0;
                    if (event.data.flagSab) {
                        this.flagArray = new Int32Array(event.data.flagSab);
                    }
                } else {
                    this.refBuffer = null;
                    this.measBuffer = null;
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
            if (event.data && event.data.type === 'setFskEnabled') {
                this.fskEnabled = !!event.data.enabled;
            }
            if (event.data && event.data.type === 'setRefChannel') {
                this.refChannel = event.data.channel; // -1=loop, 0=L, 1=R
            }
            if (event.data && event.data.type === 'setMeasChannel') {
                this.measChannel = event.data.channel; // -1=loop, 0=L, 1=R
            }
        };
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;
        if (!this.ringRef || !this.ringMeas) return true;

        // Selección de canales según refChannel y measChannel
        let measCh;
        if (this.measChannel === -1 && inputs[1] && inputs[1][0]) {
            // Loop: medición = generador (input 1)
            measCh = inputs[1][0];
        } else {
            measCh = input[Math.max(0, this.measChannel)] || input[0];
        }
        let refCh;
        if (this.refChannel === -1 && inputs[1] && inputs[1][0]) {
            // Loopback: referencia = generador (input 1)
            refCh = inputs[1][0];
        } else {
            // Canal físico: 0=L, 1=R
            const chIdx = Math.max(0, this.refChannel);
            refCh = input[chIdx] || input[0];
        }
        const len = input[0].length;

        // Escribir en ring buffers locales (nunca directamente al SAB)
        for (let i = 0; i < len; i++) {
            this.ringRef[this.refWriteIdx] = refCh[i];
            this.ringMeas[this.measWriteIdx] = measCh[i];
            this.refWriteIdx = (this.refWriteIdx + 1) % this.bufferSize;
            this.measWriteIdx = (this.measWriteIdx + 1) % this.bufferSize;
        }

        this.samplesAccumulated += len;

        // Cuando tenemos fftSize muestras, emitir frame completo
        if (this.samplesAccumulated >= this.fftSize) {
            if (this.hasSAB && this.refBuffer && this.measBuffer && this.flagArray) {
                // Double-buffer SAB: copiar ordenado del ring buffer al banco actual
                const offset = this.currentBank * this.fftSize;
                for (let i = 0; i < this.fftSize; i++) {
                    const readIdx = (this.refWriteIdx - this.fftSize + i + this.bufferSize) % this.bufferSize;
                    this.refBuffer[offset + i] = this.ringRef[readIdx];
                    this.measBuffer[offset + i] = this.ringMeas[readIdx];
                }
                // Señalizar que el banco está listo y swap
                Atomics.store(this.flagArray, 0, this.currentBank);
                this.currentBank = 1 - this.currentBank;
            } else {
                // postMessage fallback
                const refBlock = new Float32Array(this.fftSize);
                const measBlock = new Float32Array(this.fftSize);
                for (let i = 0; i < this.fftSize; i++) {
                    const readIdx = (this.refWriteIdx - this.fftSize + i + this.bufferSize) % this.bufferSize;
                    refBlock[i] = this.ringRef[readIdx];
                    measBlock[i] = this.ringMeas[readIdx];
                }
                this.port.postMessage({
                    type: 'DUAL_BLOCK',
                    ref: refBlock.buffer,
                    meas: measBlock.buffer
                }, [refBlock.buffer, measBlock.buffer]);
            }

            // Overlap: retroceder el contador
            const hopSize = Math.round(this.fftSize * (1 - this.overlapFraction));
            this.samplesAccumulated -= hopSize;
        }

        // FSK/Goertzel solo en modo secuencial
        if (this.fskEnabled) {
            const channelData = input[0];
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
        
        // Emitimos si es una letra mayúscula (cabecera V, A, M, N, F, P, T, D, X, R)
        if (char >= 'A' && char <= 'Z') {
            this.port.postMessage({ type: 'FSK_HEADER', payload: char });
        }
    }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
