export type HeaderType = 'HF' | 'LF';

const BAUD = 110;

const HEADER_FREQS: Record<HeaderType, { mark: number; space: number }> = {
    HF: { mark: 1650, space: 1850 },
    LF: { mark: 150, space: 200 },
};

function charToFSKBits(char: string): number[] {
    const code = char.charCodeAt(0) & 0x7F;
    const bits: number[] = [0];
    let parity = 0;
    for (let i = 0; i < 7; i++) {
        const b = (code >> i) & 1;
        bits.push(b);
        parity ^= b;
    }
    bits.push(parity);
    bits.push(1, 1);
    return bits;
}

/**
 * Generates a sine tone segment.
 */
function generateTone(samples: number, freq: number, sampleRate: number): Float32Array {
    const buf = new Float32Array(samples);
    const phaseStep = (2 * Math.PI * freq) / sampleRate;
    for (let i = 0; i < samples; i++) {
        buf[i] = Math.sin(i * phaseStep);
    }
    return buf;
}

/**
 * Generates an FSK header for a single character.
 * Format: 2 preamble mark bits + 11 data bits (start + 7 data + parity + 2 stop) = 13 bits total.
 */
export function generateFSKHeader(char: string, sampleRate: number, type: HeaderType = 'HF'): Float32Array {
    const { mark, space } = HEADER_FREQS[type];
    const samplesPerBit = Math.round(sampleRate / BAUD);
    const preamble = 2;
    const dataBits = charToFSKBits(char);
    const totalSamples = (preamble + dataBits.length) * samplesPerBit;

    const buffer = new Float32Array(totalSamples);

    for (let b = 0; b < preamble; b++) {
        buffer.set(generateTone(samplesPerBit, mark, sampleRate), b * samplesPerBit);
    }
    for (let b = 0; b < dataBits.length; b++) {
        const freq = dataBits[b] === 1 ? mark : space;
        buffer.set(generateTone(samplesPerBit, freq, sampleRate), (preamble + b) * samplesPerBit);
    }

    return buffer;
}

/** Generates multiple FSK headers concatenated (for V's rotation test). */
export function generateFSKRotation(char: string, count: number, sampleRate: number, type: HeaderType = 'HF'): Float32Array {
    const header = generateFSKHeader(char, sampleRate, type);
    const buf = new Float32Array(header.length * count);
    for (let i = 0; i < count; i++) {
        buf.set(header, i * header.length);
    }
    return buf;
}
