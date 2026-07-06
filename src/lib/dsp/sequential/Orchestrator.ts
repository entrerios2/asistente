import type { AudioProvider } from '../../hal/types';
import { buildSegment } from './SegmentBuffer';
import { uiStore } from '../../stores/ui.svelte';
import { SegmentM } from './analyse/SegmentM';
import { SegmentD } from './analyse/SegmentD';
import { SegmentR } from './analyse/SegmentR';

export type OrchestratorState = 
    | 'IDLE'
    | 'REPRODUCIENDO_AUDIO'
    | 'ESPERANDO_CABECERA'
    | 'PROCESANDO_SEGMENTO'
    | 'ERROR_TIMEOUT'
    | 'ABORTADO'
    | 'COMPLETADO';

export interface SegmentAnalysis {
    status: 'PASS' | 'WARN' | 'FAIL' | 'ERROR';
    values: Record<string, number | string>;
    message?: string;
}

export interface OrchestratorEvent {
    state: OrchestratorState;
    currentHeader?: string;
    message?: string;
    analysis?: SegmentAnalysis;
}

const LONG_SEGMENTS = new Set(['F', 'T', 'S']);

const ANALYZERS: Record<string, (buf: Float32Array, sr: number) => SegmentAnalysis> = {
    M: (buf, sr) => SegmentM.process(buf, sr) as SegmentAnalysis,
    D: (buf, sr) => SegmentD.process(buf, sr) as SegmentAnalysis,
    R: (buf, sr) => SegmentR.process(buf, sr) as SegmentAnalysis,
};

export class Orchestrator {
    private _state: OrchestratorState = 'IDLE';
    private onEvent?: (event: OrchestratorEvent) => void;

    get state(): OrchestratorState { return this._state; }
    private resolveHeader?: (value: boolean) => void;
    private expectedHeader?: string;

    private isBlindMode: boolean = false;
    private fastPathWorker: Worker | null = null;
    private isAborted: boolean = false;
    private captureStarted: boolean = false;
    private captureChunks: Float32Array[] = [];
    private captureBeforeSegment: number = 0;

    constructor(
        private hal: AudioProvider
    ) {
        if (this.hal.onMessage) {
            this.hal.onMessage((msg) => this.handleWorkletMessage(msg));
        }
    }

    subscribe(callback: (event: OrchestratorEvent) => void) {
        this.onEvent = callback;
    }

    async runSequence(sequenceString: string): Promise<void> {
        const tokens = sequenceString.split(/\s+/);
        console.info(`Orchestrator: Iniciando secuencia [${tokens.join(', ')}]`);
        this.isAborted = false;
        this.captureChunks = [];

        if (this.hal.startCapture) {
            await this.hal.startCapture({
                onAudioData: (data) => { this.captureChunks.push(data); },
                onTimeDomainData: () => {},
            });
            this.captureStarted = true;
        }

        for (const token of tokens) {
            if (this.isAborted) break;
            try {
                await this.processToken(token);
            } catch (error) {
                if (this.isAborted) return;
                console.error(`Orchestrator: Error en token ${token}:`, error);
                this.emit('ERROR_TIMEOUT', token, `Error en segmento ${token}.`);
                throw error;
            }
        }

        if (!this.isAborted) {
            this.emit('COMPLETADO', undefined, 'Secuencia terminada con éxito.');
        }

        this.endCapture();
        this._state = 'IDLE';
    }

    private endCapture() {
        if (this.captureStarted) {
            this.hal.stopCapture?.();
            this.captureStarted = false;
        }
    }

    private async processToken(token: string): Promise<void> {
        this.emit('REPRODUCIENDO_AUDIO', token);
        this.captureBeforeSegment = this.totalCapturedSamples();

        const segment = buildSegment(token, uiStore.sampleRate, 'HF');

        const headerTimeout = Math.max(3000, segment.durationSec * 1000 + 2000);
        const headerPromise = this.waitForHeader(token, headerTimeout);

        const isLong = LONG_SEGMENTS.has(token);

        if (isLong) {
            this.startDualProcessing();
        }

        if (this.hal.playBuffer) {
            await this.hal.playBuffer(segment.buffer, segment.sampleRate);
        }

        if (isLong) {
            this.stopDualProcessing();
        }

        const segmentEnd = this.totalCapturedSamples();
        const segmentBuffer = this.extractSegmentBuffer(segmentEnd);

        this.emit('ESPERANDO_CABECERA', token);
        const detected = await headerPromise;

        if (!detected) {
            throw new Error(`Timeout esperando cabecera ${token}`);
        }

        if (segmentBuffer.length > 0) {
            const analyze = ANALYZERS[token];
            if (analyze) {
                const result = analyze(segmentBuffer, uiStore.sampleRate);
                this.emit('PROCESANDO_SEGMENTO', token, result.message, result);
            } else {
                this.emit('PROCESANDO_SEGMENTO', token);
            }
        } else {
            this.emit('PROCESANDO_SEGMENTO', token);
        }

        if (!isLong) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    private totalCapturedSamples(): number {
        return this.captureChunks.reduce((a, c) => a + c.length, 0);
    }

    private extractSegmentBuffer(endSample: number): Float32Array {
        const startSample = this.captureBeforeSegment;
        if (startSample >= endSample) return new Float32Array(0);

        const result = new Float32Array(endSample - startSample);
        let offset = 0;
        let accumulated = 0;
        for (const ch of this.captureChunks) {
            const chEnd = accumulated + ch.length;
            if (chEnd > startSample && accumulated < endSample) {
                const copyStart = Math.max(0, startSample - accumulated);
                const copyEnd = Math.min(ch.length, endSample - accumulated);
                const len = copyEnd - copyStart;
                if (len > 0) {
                    result.set(ch.subarray(copyStart, copyEnd), offset);
                    offset += len;
                }
            }
            accumulated = chEnd;
            if (accumulated >= endSample) break;
        }

        return result.slice(0, offset);
    }

    private startDualProcessing(): void {
        const sab = this.hal.getSharedBuffer?.();

        if (!this.isBlindMode && sab) {
            try {
                this.fastPathWorker = new Worker(
                    new URL('./workers/FastPathWorker.ts', import.meta.url),
                    { type: 'module' }
                );
                this.fastPathWorker.onmessage = (e) => {
                    if (e.data.type === 'CLIPPING_DETECTED') {
                        this.abortSequence("Clipping sostenido detectado. Reduzca la ganancia.");
                    }
                };
                this.fastPathWorker.postMessage({ sab, sampleRate: uiStore.sampleRate });
            } catch (e) {
                console.warn('[Orchestrator] No se pudo iniciar FastPathWorker:', e);
            }
        }
    }

    private stopDualProcessing() {
        if (this.fastPathWorker) {
            this.fastPathWorker.terminate();
            this.fastPathWorker = null;
        }
    }

    public abortSequence(reason: string) {
        console.warn(`Orchestrator: Abortando secuencia. Razón: ${reason}`);
        this.isAborted = true;
        this.stopDualProcessing();
        this.endCapture();
        this.emit('ABORTADO', undefined, reason);
    }

    private waitForHeader(header: string, timeoutMs: number): Promise<boolean> {
        this.expectedHeader = header;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.resolveHeader = undefined;
                this.expectedHeader = undefined;
                resolve(false);
            }, timeoutMs);

            this.resolveHeader = (success: boolean) => {
                clearTimeout(timeout);
                resolve(success);
            };
        });
    }

    private handleWorkletMessage(msg: any) {
        if (msg.type === 'FSK_HEADER') {
            if (this.resolveHeader && msg.payload === this.expectedHeader) {
                const resolve = this.resolveHeader;
                this.resolveHeader = undefined;
                this.expectedHeader = undefined;
                resolve(true);
            }
        }
    }

    private emit(state: OrchestratorState, currentHeader?: string, message?: string, analysis?: SegmentAnalysis) {
        this._state = state;
        if (this.onEvent) {
            this.onEvent({ state, currentHeader, message, analysis });
        }
    }
}
