import type { Player } from './Player';
import type { AudioProvider } from '../../hal/types';

export type OrchestratorState = 
    | 'IDLE'
    | 'REPRODUCIENDO_AUDIO'
    | 'ESPERANDO_CABECERA'
    | 'PROCESANDO_SEGMENTO'
    | 'ERROR_TIMEOUT'
    | 'COMPLETADO';

export interface OrchestratorEvent {
    state: OrchestratorState;
    currentHeader?: string;
    message?: string;
}

/**
 * APST Orchestrator: Coordina la secuencia de medición acústica.
 */
export class Orchestrator {
    private state: OrchestratorState = 'IDLE';
    private onEvent?: (event: OrchestratorEvent) => void;
    private resolveHeader?: (value: boolean) => void;
    private expectedHeader?: string;

    constructor(
        private player: Player,
        private hal: AudioProvider
    ) {
        // Suscribirse a los mensajes del Worklet a través del HAL
        if (this.hal.onMessage) {
            this.hal.onMessage((msg) => this.handleWorkletMessage(msg));
        }
    }

    /**
     * Registra un callback para recibir actualizaciones de estado.
     */
    subscribe(callback: (event: OrchestratorEvent) => void) {
        this.onEvent = callback;
    }

    /**
     * Ejecuta una secuencia de orquestación (ej: "V A N F P").
     */
    async runSequence(sequenceString: string): Promise<void> {
        const tokens = sequenceString.split(/\s+/);
        console.info(`Orchestrator: Iniciando secuencia [${tokens.join(', ')}]`);

        for (const token of tokens) {
            try {
                await this.processToken(token);
            } catch (error) {
                console.error(`Orchestrator: Error en token ${token}:`, error);
                this.emit('ERROR_TIMEOUT', token, `No se detectó la cabecera ${token} a tiempo.`);
                throw error;
            }
        }

        this.emit('COMPLETADO', undefined, 'Secuencia terminada con éxito.');
        this.state = 'IDLE';
    }

    private async processToken(token: string): Promise<void> {
        // 1. Reproducir el audio del segmento
        this.emit('REPRODUCIENDO_AUDIO', token);
        // Asumimos que los archivos se llaman segmento_V, segmento_A, etc.
        await this.player.playSequence(`segmento_${token}`, 48000, 'HF');

        // 2. Esperar cabecera acústica
        this.emit('ESPERANDO_CABECERA', token);
        const detected = await this.waitForHeader(token, 3000);

        if (!detected) {
            throw new Error(`Timeout esperando cabecera ${token}`);
        }

        // 3. Procesar segmento (aquí se invocaría al procesador de audio real en el futuro)
        this.emit('PROCESANDO_SEGMENTO', token);
        await new Promise(r => setTimeout(r, 500)); // Simulación de procesamiento
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
            console.info(`Orchestrator: Cabecera detectada por mic: ${msg.payload}`);
            
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
