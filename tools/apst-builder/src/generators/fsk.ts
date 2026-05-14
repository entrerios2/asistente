/**
 * Modulador FSK (Frequency-Shift Keying).
 */

export function encodeFSK(
    text: string, 
    type: 'HF' | 'LF', 
    sampleRate: number
): Float32Array {
    const baudRate = 110;
    const samplesPerBit = Math.floor(sampleRate / baudRate);
    
    // Configuración de frecuencias según el tipo
    const freqs = type === 'HF' 
        ? { mark: 1650, space: 1850 } // HF: 1=1650, 0=1850
        : { mark: 150, space: 200 };   // LF: 1=150, 0=200

    // Construcción de la cadena de bits (Framing UART)
    const bits: number[] = [];
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        
        // 1. Start Bit (Space / 0)
        bits.push(0);
        
        // 2. Data Bits (7 bits, LSB first)
        let onesCount = 0;
        for (let j = 0; j < 7; j++) {
            const bit = (charCode >> j) & 1;
            bits.push(bit);
            if (bit === 1) onesCount++;
        }
        
        // 3. Parity Bit (Even)
        bits.push(onesCount % 2 === 0 ? 0 : 1);
        
        // 4. Stop Bits (Mark / 1 x 2)
        bits.push(1, 1);
    }

    const totalSamples = bits.length * samplesPerBit;
    const buffer = new Float32Array(totalSamples);
    
    let currentPhase = 0;

    // Modulación CPFSK (Continuous Phase FSK)
    for (let b = 0; b < bits.length; b++) {
        const bit = bits[b];
        const freq = bit === 1 ? freqs.mark : freqs.space;
        const phaseInc = (2 * Math.PI * freq) / sampleRate;

        for (let s = 0; s < samplesPerBit; s++) {
            const idx = b * samplesPerBit + s;
            buffer[idx] = Math.sin(currentPhase);
            currentPhase += phaseInc;
        }
    }

    return buffer;
}
