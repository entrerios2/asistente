import fs from 'fs';
import path from 'path';
import wavefile from 'wavefile';
const { WaveFile } = wavefile;
import { encodeFSK } from './generators/fsk.js';
import { generateTone } from './generators/tone.js';

/**
 * APST Builder - Ensamblador de Señales
 * Genera el segmento de prueba V_HF_48k
 */

async function main() {
    const SAMPLE_RATE = 48000;
    
    console.log('--- APST Builder ---');
    console.log('Generando Secuencia V (HF)...');

    // 1. Generar cabecera FSK para 'V'
    const fskHeader = encodeFSK('V', 'HF', SAMPLE_RATE);
    
    // 2. Generar Tono de Referencia (1kHz, 5s)
    const referenceTone = generateTone(1000, 5, SAMPLE_RATE);

    // 3. Concatenar buffers
    const totalLength = fskHeader.length + referenceTone.length;
    const finalBuffer = new Float32Array(totalLength);
    finalBuffer.set(fskHeader, 0);
    finalBuffer.set(referenceTone, fskHeader.length);

    // 4. Crear archivo WAV (32-bit Float)
    const wav = new WaveFile();
    // Wavefile espera un array normal de números o un TypedArray
    wav.fromScratch(1, SAMPLE_RATE, '32f', finalBuffer);

    // 5. Guardar a disco
    const outputName = 'segmento_V_HF_48k.wav';
    const outputPath = path.join(process.cwd(), outputName);
    
    fs.writeFileSync(outputPath, wav.toBuffer());

    console.log(`¡Éxito! Archivo generado en: ${outputPath}`);
    console.log(`Duración: ${(totalLength / SAMPLE_RATE).toFixed(2)}s`);
}

main().catch(err => {
    console.error('Error durante la generación:', err);
});
