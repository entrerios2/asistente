import { Orchestrator, type OrchestratorEvent } from '../dsp/sequential/Orchestrator';
import { buildSequence } from '../dsp/sequential/SegmentBuffer';
import { encodeFlac } from '../dsp/sequential/FlacEncoder';
import { getAudioProvider } from '../hal';
import { uiStore } from './ui.svelte';
import { traceManager, type SegmentResultData } from './traceManager.svelte';

class SequentialStore {
    isRunning = $state(false);
    currentSegment = $state<string | null>(null);
    progress = $state(0);
    results = $state<Record<string, SegmentResultData>>({});
    sequentialTokens: string[] = [];

    private _orchestrator: Orchestrator | null = null;

    private get orchestrator(): Orchestrator {
        if (!this._orchestrator) {
            this._orchestrator = new Orchestrator(getAudioProvider());
            this._orchestrator.subscribe((event) => this.handleEvent(event));
        }
        return this._orchestrator;
    }

    private handleEvent(event: OrchestratorEvent) {
        if (event.currentHeader && event.state !== 'COMPLETADO' && event.state !== 'ABORTADO') {
            this.currentSegment = event.currentHeader;
        }

        if (event.state === 'REPRODUCIENDO_AUDIO') {
            const idx = this.sequentialTokens.indexOf(event.currentHeader || '');
            this.progress = Math.round((idx / this.sequentialTokens.length) * 100);
        }

        if (event.state === 'ERROR_TIMEOUT' && event.currentHeader) {
            this.results[event.currentHeader] = { status: 'ERROR', values: {}, message: event.message || 'Timeout' };
        }

        if (event.state === 'PROCESANDO_SEGMENTO' && event.currentHeader && event.analysis) {
            this.results[event.currentHeader] = event.analysis;
            if (event.analysis.spectral) {
                traceManager.updateSpectralLayer(event.analysis.spectral);
            }
        }

        if (event.state === 'COMPLETADO' || event.state === 'ABORTADO') {
            this.isRunning = false;
            this.currentSegment = null;
            if (event.state === 'COMPLETADO' && this.sequentialTokens.length > 0) {
                this.progress = 100;
                uiStore.showToast('Secuencia completada');
                const seqLayer = traceManager.layers.find(l => l.name === 'secuencial');
                const spectralData = seqLayer?.multiMetricData || {};
                traceManager.captureInstantaneaFromSequential(
                    'Secuencia automática',
                    spectralData as Record<string, Float32Array>,
                    this.results,
                    { segments: this.sequentialTokens, preset: '', sampleRate: uiStore.sampleRate },
                );
            }
        }
    }

    async runSequence(tokens: string[]) {
        if (this.isRunning || tokens.length === 0) return;
        this.sequentialTokens = tokens;
        this.isRunning = true;
        this.progress = 0;
        this.currentSegment = null;
        this.results = {};
        traceManager.clearSequentialLayer();

        try {
            await this.orchestrator.runSequence(tokens.join(' '));
        } catch (e) {
            console.error('[SequentialStore] Error en secuencia:', e);
            this.isRunning = false;
        }
    }

    stopSequence() {
        if (this._orchestrator) {
            this._orchestrator.abortSequence('Usuario detuvo la secuencia');
        }
        this.isRunning = false;
        this.currentSegment = null;
    }

    async downloadSequence(tokens: string[], format: 'wav' | 'flac' = 'wav') {
        try {
            const sampleRate = uiStore.sampleRate;
            const buffer = buildSequence(tokens, sampleRate);
            if (format === 'flac') {
                const flac = encodeFlac(buffer, sampleRate);
                const blob = new Blob([flac.buffer as ArrayBuffer], { type: 'audio/flac' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `secuencia-${tokens.join('-')}.flac`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const wav = this.encodeWav(buffer, sampleRate);
                const blob = new Blob([wav], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `secuencia-${tokens.join('-')}.wav`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error('[SequentialStore] Error al descargar:', e);
            uiStore.showToast('Error al generar el archivo');
        }
    }

    private encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * bitsPerSample / 8;
        const blockAlign = numChannels * bitsPerSample / 8;
        const dataSize = samples.length * blockAlign;
        const headerSize = 44;
        const buf = new ArrayBuffer(headerSize + dataSize);
        const view = new DataView(buf);

        const writeStr = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };

        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }

        return buf;
    }
}

export const sequentialStore = new SequentialStore();
