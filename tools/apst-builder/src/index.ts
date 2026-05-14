import fs from 'fs';
import path from 'path';
import wavefile from 'wavefile';
const { WaveFile } = wavefile;
import { encodeFSK } from './generators/fsk.js';
import { generateTone } from './generators/tone.js';
import { generateLogSweep } from './generators/sweep.js';

/**
 * APST Builder - Generador de Señales Estandarizadas
 */

interface Config {
    sequences: string[];
    sampleRates: number[];
    isSubOptions: boolean[];
    formats: string[];
}

function parseArgs(): Config {
    const args = process.argv.slice(2);
    const config: Config = {
        sequences: ['VANFP'],
        sampleRates: [48000],
        isSubOptions: [false],
        formats: ['wav']
    };

    args.forEach(arg => {
        const [key, value] = arg.split('=');
        if (key === '--sequence') config.sequences = value.split(',');
        if (key === '--samplerate') config.sampleRates = value.split(',').map(Number);
        if (key === '--sub') config.isSubOptions = value.split(',').map(v => v === 'true');
        if (key === '--format') config.formats = value.split(',');
    });

    return config;
}

function getSegmentBuffer(code: string, type: 'HF' | 'LF', sr: number): Float32Array {
    const header = encodeFSK(code, type, sr);
    let payload: Float32Array;

    switch (code) {
        case 'V':
            const toneV = generateTone(1000, 2, sr);
            const silenceV = new Float32Array(3 * sr);
            payload = new Float32Array(toneV.length + silenceV.length);
            payload.set(toneV);
            payload.set(silenceV, toneV.length);
            break;
        case 'A':
            payload = generateTone(1000, 10, sr);
            break;
        case 'N':
            payload = new Float32Array(5 * sr); // Silencio
            break;
        case 'F':
        case 'P':
            payload = generateLogSweep(40, 20000, 15, sr);
            break;
        case 'X':
            payload = generateTone(1000, 5, sr);
            break;
        default:
            payload = new Float32Array(0);
    }

    const combined = new Float32Array(header.length + payload.length);
    combined.set(header);
    combined.set(payload, header.length);
    return combined;
}

async function main() {
    const config = parseArgs();
    console.log('--- APST Builder 2.0 ---');
    console.log('Configuración detectada:', config);

    for (const seq of config.sequences) {
        for (const sr of config.sampleRates) {
            for (const isSub of config.isSubOptions) {
                for (const format of config.formats) {
                    
                    const type = isSub ? 'LF' : 'HF';
                    const canal = isSub ? 'sub' : 'main';
                    const srK = Math.floor(sr / 1000);
                    
                    console.log(`Generando: ${seq} @ ${sr}Hz (${canal}) [${format}]...`);

                    const segments = seq.split('');
                    let totalLength = 0;
                    const segmentBuffers: Float32Array[] = [];

                    for (const code of segments) {
                        const buf = getSegmentBuffer(code, type, sr);
                        segmentBuffers.push(buf);
                        totalLength += buf.length;
                    }

                    const finalBuffer = new Float32Array(totalLength);
                    let offset = 0;
                    for (const buf of segmentBuffers) {
                        finalBuffer.set(buf, offset);
                        offset += buf.length;
                    }

                    const outputName = `apst_${seq.toLowerCase()}_${srK}k_${canal}.${format}`;
                    const outputPath = path.join(process.cwd(), outputName);

                    if (format === 'wav') {
                        const wav = new WaveFile();
                        wav.fromScratch(1, sr, '32f', finalBuffer);
                        fs.writeFileSync(outputPath, wav.toBuffer());
                    } else if (format === 'flac') {
                        console.warn(`[!] El formato FLAC no está soportado nativamente aún. Generando WAV como fallback.`);
                        const fallbackPath = outputPath.replace('.flac', '.wav');
                        const wav = new WaveFile();
                        wav.fromScratch(1, sr, '32f', finalBuffer);
                        fs.writeFileSync(fallbackPath, wav.toBuffer());
                    }

                    console.log(`  -> Guardado: ${outputName}`);
                }
            }
        }
    }

    console.log('\n--- Proceso finalizado ---');
}

main().catch(err => {
    console.error('Error crítico:', err);
});
