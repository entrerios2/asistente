import type { HeaderType } from './FSKHeader';
import { generateFSKHeader } from './FSKHeader';
import { generateSignalV } from './signals/signalV';
import { generateSignalA } from './signals/signalA';
import { generateSignalM } from './signals/signalM';
import { generateSignalN } from './signals/signalN';
import { generateSignalF } from './signals/signalF';
import { generateSignalP } from './signals/signalP';
import { generateSignalT } from './signals/signalT';
import { generateSignalD } from './signals/signalD';
import { generateSignalX } from './signals/signalX';
import { generateSignalR } from './signals/signalR';

export interface BuiltSegment {
    buffer: Float32Array;
    sampleRate: number;
    headerType: HeaderType;
    /** Approximate duration in seconds */
    durationSec: number;
    /** For stereo segments, marks the sample where channel switches (0 = no switch) */
    channelSwitchSample?: number;
}

const SIGNAL_GENERATORS: Record<string, (sr: number) => Float32Array> = {
    V: generateSignalV,
    A: generateSignalA,
    M: generateSignalM,
    N: generateSignalN,
    F: generateSignalF,
    P: generateSignalP,
    T: generateSignalT,
    D: generateSignalD,
    X: generateSignalX,
    R: generateSignalR,
};

/**
 * Builds a complete segment buffer: FSK header + payload signal.
 */
export function buildSegment(
    token: string,
    sampleRate: number,
    headerType: HeaderType = 'HF',
): BuiltSegment {
    const genFn = SIGNAL_GENERATORS[token];
    if (!genFn) {
        throw new Error(`SegmentBuffer: token desconocido '${token}'`);
    }

    const header = generateFSKHeader(token, sampleRate, headerType);
    const payload = genFn(sampleRate);

    const totalSamples = header.length + payload.length;
    const buffer = new Float32Array(totalSamples);
    buffer.set(header, 0);
    buffer.set(payload, header.length);

    const durationSec = (header.length + payload.length) / sampleRate;

    let channelSwitchSample: number | undefined;
    if (token === 'X') {
        // X: first half of payload is L, second half is R
        channelSwitchSample = header.length + payload.length / 2;
    }

    return { buffer, sampleRate, headerType, durationSec, channelSwitchSample };
}

/** Builds a multi-segment buffer for offline export. */
export function buildSequence(
    tokens: string[],
    sampleRate: number,
    headerType: HeaderType = 'HF',
): Float32Array {
    const segments = tokens.map(t => buildSegment(t, sampleRate, headerType));
    const totalLength = segments.reduce((sum, s) => sum + s.buffer.length, 0);
    const full = new Float32Array(totalLength);
    let offset = 0;
    for (const seg of segments) {
        full.set(seg.buffer, offset);
        offset += seg.buffer.length;
    }
    return full;
}
