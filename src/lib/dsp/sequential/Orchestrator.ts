import type { AudioProvider } from '../../hal/types';
import { measureEventLoopLag } from '../../utils/tierDetector';

export type OrchestratorState = 
    | 'IDLE'
    | 'REPRODUCIENDO_AUDIO'
    | 'ESPERANDO_CABECERA'
    | 'PROCESANDO_SEGMENTO'
    | 'ERROR_TIMEOUT'
    | 'ABORTADO'
    | 'COMPLETADO';

export interface OrchestratorEvent {
    state: OrchestratorState;
    currentHeader?: string;
    message?: string;
}

/**
 * Orchestrator: Coordina la secuencia de medición secuencial.
 * Fase 2: reemplazará el stub de reproducción por SegmentBuffer + playBuffer.
 */
export class Orchestrator {
    private state: OrchestratorState = 'IDLE';
    private onEvent?: (event: OrchestratorEvent) => void;
    private resolveHeader?: (value: boolean) => void;
    private expectedHeader?: string;
    
    private isBlindMode: boolean = false;
    private fastPathWorker: Worker | null = null;
    private isAborted: boolean = false;

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
        this.state = 'IDLE';
    }

    private async processToken(token: string): Promise<void> {
        // 1. Generar y reproducir buffer del segmento (stub: duración simulada)
        this.emit('REPRODUCIENDO_AUDIO', token);
        const durationMs = token === 'S' ? 20000 : token === 'F' ? 15000 : token === 'N' ? 12000 : token === 'R' ? 15000 : 5000;
        await new Promise(r => setTimeout(r, durationMs));

        // 2. Esperar cabecera
        this.emit('ESPERANDO_CABECERA', token);
        const detected = await this.waitForHeader(token, 3000);

        if (!detected) {
            throw new Error(`Timeout esperando cabecera ${token}`);
        }

        // --- Inicio de Procesamiento Dual ---
        
        // Evaluación de Modo Ciego (Lag del hilo principal)
        // Lo hacemos en los primeros 500ms del primer segmento real o periódicamente
        if (token === 'V' || token === 'F') {
            const lag = await measureEventLoopLag(500);
            if (lag > 20) {
                console.warn(`Orchestrator: Modo Ciego activado (Lag = ${lag.toFixed(2)}ms). Fast-Path desactivado.`);
                this.isBlindMode = true;
            }
        }

        this.emit('PROCESANDO_SEGMENTO', token);

        // Si es un segmento largo, activar monitoreo y grabación
        const isLong = ['F', 'T', 'S'].includes(token);
        if (isLong) {
            await this.startDualProcessing(token);
        } else {
            await new Promise(r => setTimeout(r, 500)); // Simulación para cortos
        }
    }

    private async startDualProcessing(token: string): Promise<void> {
        const sab = this.hal.getSharedBuffer?.();
        
        // Instanciar Fast-Path Worker (Monitoreo de Clipping y RMS)
        if (!this.isBlindMode && sab) {
            this.fastPathWorker = new Worker(new URL('./workers/FastPathWorker.ts', import.meta.url), { type: 'module' });
            this.fastPathWorker.onmessage = (e) => {
                if (e.data.type === 'CLIPPING_DETECTED') {
                    this.abortSequence("Clipping sostenido detectado. Reduzca la ganancia.");
                }
            };
            this.fastPathWorker.postMessage({ sab, sampleRate: 48000 });
        }

        // Slow-Path (Grabación de largo aliento en SharedArrayBuffer)
        // Aquí el worklet sigue escribiendo en el SAB. En el futuro, un SlowPathWorker 
        // leería de aquí para acumular en un buffer persistente.
        const durationMs = token === 'S' ? 20000 : 15000;
        
        // Esperamos la duración del segmento o el aborto
        await new Promise((resolve) => {
            const timeout = setTimeout(resolve, durationMs);
            // Si se aborta externamente, necesitamos limpiar este timeout (simplificado aquí)
        });

        this.stopDualProcessing();
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

    private emit(state: OrchestratorState, currentHeader?: string, message?: string) {
        this.state = state;
        if (this.onEvent) {
            this.onEvent({ state, currentHeader, message });
        }
    }
}
