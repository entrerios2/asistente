function crc8(data: Uint8Array): number {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 0x80) crc = (crc << 1) ^ 0x07;
            else crc <<= 1;
            crc &= 0xFF;
        }
    }
    return crc;
}

function crc16(data: Uint8Array): number {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
        crc ^= (data[i] << 8);
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) crc = (crc << 1) ^ 0x8005;
            else crc <<= 1;
            crc &= 0xFFFF;
        }
    }
    return crc;
}

function toBe16(v: number): Uint8Array {
    return new Uint8Array([(v >> 8) & 0xFF, v & 0xFF]);
}

function frameNumberUtf8(n: number): Uint8Array {
    if (n < 128) return new Uint8Array([n]);
    if (n < 16384) return new Uint8Array([0xC0 | (n >> 6), 0x80 | (n & 0x3F)]);
    if (n < 2097152) return new Uint8Array([0xE0 | (n >> 12), 0x80 | ((n >> 6) & 0x3F), 0x80 | (n & 0x3F)]);
    if (n < 268435456) return new Uint8Array([0xF0 | (n >> 18), 0x80 | ((n >> 12) & 0x3F), 0x80 | ((n >> 6) & 0x3F), 0x80 | (n & 0x3F)]);
    return new Uint8Array([0xF8 | (n >> 24), 0x80 | ((n >> 18) & 0x3F), 0x80 | ((n >> 12) & 0x3F), 0x80 | ((n >> 6) & 0x3F), 0x80 | (n & 0x3F)]);
}

export function encodeFlac(samples: Float32Array, sampleRate: number): Uint8Array {
    const channels = 1;
    const bps = 16;
    const blockSize = 4096;
    const totalSamples = samples.length;

    const chunks: Uint8Array[] = [];

    // fLaC marker
    chunks.push(new Uint8Array([0x66, 0x4C, 0x61, 0x43]));

    // STREAMINFO metadata block (header: 4 bytes, body: 34 bytes)
    const streamInfo = new Uint8Array(38);
    let off = 0;
    // metadata block header: is_last=0x80 | type(STREAMINFO=0) = 0x80
    streamInfo[off++] = 0x80;
    // length (34 bytes)
    streamInfo[off++] = 0;
    streamInfo[off++] = 0;
    streamInfo[off++] = 34;
    // min/max block size
    streamInfo[off++] = (blockSize >> 8) & 0xFF;
    streamInfo[off++] = blockSize & 0xFF;
    streamInfo[off++] = (blockSize >> 8) & 0xFF;
    streamInfo[off++] = blockSize & 0xFF;
    // min/max frame size (unknown, set to 0)
    streamInfo[off++] = 0; streamInfo[off++] = 0; streamInfo[off++] = 0;
    streamInfo[off++] = 0; streamInfo[off++] = 0; streamInfo[off++] = 0;
    // packed fields (8 bytes)
    // SR: 20 bits, CH-1: 3 bits, BPS-1: 5 bits, TotalSamples: 36 bits
    const sr = sampleRate;
    const ch = channels - 1;
    const bps1 = bps - 1;
    const ts = totalSamples;
    streamInfo[off++] = (sr >> 12) & 0xFF;
    streamInfo[off++] = (sr >> 4) & 0xFF;
    streamInfo[off++] = ((sr & 0x0F) << 4) | ((ch & 0x07) << 1) | ((bps1 >> 4) & 0x01);
    streamInfo[off++] = ((bps1 & 0x0F) << 4) | ((ts >> 32) & 0x0F);
    streamInfo[off++] = (ts >> 24) & 0xFF;
    streamInfo[off++] = (ts >> 16) & 0xFF;
    streamInfo[off++] = (ts >> 8) & 0xFF;
    streamInfo[off++] = ts & 0xFF;
    // MD5 (zeros)
    for (let i = 0; i < 16; i++) streamInfo[off++] = 0;
    chunks.push(streamInfo);

    // Block size code for 4096: 1100 = 0xC
    const blockSizeCode = 0xC;
    // Sample rate code
    const srCode = getSampleRateCode(sampleRate);
    // Channel assignment: 0000 (independent)
    const chAssign = 0;
    // Sample size code: 100 (16 bits)
    const bpsCode = 4; // 100

    const int16Samples = new Int16Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const totalFrames = Math.ceil(totalSamples / blockSize);
    const paddedLen = totalFrames * blockSize;
    const paddedSamples = new Int16Array(paddedLen);
    paddedSamples.set(int16Samples);

    for (let frame = 0; frame < totalFrames; frame++) {
        const start = frame * blockSize;
        const thisBlockSize = blockSize;

        const frameNum = frameNumberUtf8(frame);
        const srExtra = sampleRateByte(sampleRate);

        // Frame header (variable length)
        const headerLen = 4 + frameNum.length + (srExtra.length);
        const header = new Uint8Array(headerLen);
        let hOff = 0;
        header[hOff++] = 0xFF;
        header[hOff++] = 0xF8;
        header[hOff++] = (blockSizeCode << 4) | srCode;
        header[hOff++] = (chAssign << 4) | (bpsCode << 1);
        // frame number
        for (let i = 0; i < frameNum.length; i++) header[hOff++] = frameNum[i];
        // optional sample rate extra bytes
        for (let i = 0; i < srExtra.length; i++) header[hOff++] = srExtra[i];
        // CRC-8 of header (before CRC byte)
        const crcVal = crc8(header);
        const headerWithCrc = new Uint8Array(headerLen + 1);
        headerWithCrc.set(header);
        headerWithCrc[headerLen] = crcVal;

        const subframeHeader = 0x02;

        // subframe data: raw samples
        const subframeDataLen = thisBlockSize * 2; // 16-bit = 2 bytes per sample
        const subframe = new Uint8Array(1 + subframeDataLen);
        subframe[0] = subframeHeader;
        for (let i = 0; i < thisBlockSize; i++) {
            const idx = start + i;
            subframe[1 + i * 2] = (paddedSamples[idx] >> 8) & 0xFF;
            subframe[1 + i * 2 + 1] = paddedSamples[idx] & 0xFF;
        }

        // Frame footer: CRC-16 over header (with CRC-8) + subframe
        const toChecksum = new Uint8Array(headerWithCrc.length + subframe.length);
        toChecksum.set(headerWithCrc);
        toChecksum.set(subframe, headerWithCrc.length);
        const crc16Val = crc16(toChecksum);
        const footer = new Uint8Array(2);
        footer[0] = (crc16Val >> 8) & 0xFF;
        footer[1] = crc16Val & 0xFF;

        const frameData = new Uint8Array(headerWithCrc.length + subframe.length + 2);
        frameData.set(headerWithCrc);
        frameData.set(subframe, headerWithCrc.length);
        frameData.set(footer, headerWithCrc.length + subframe.length);
        chunks.push(frameData);
    }

    const totalLen = chunks.reduce((a, c) => a + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

function getSampleRateCode(sr: number): number {
    const map: [number, number][] = [
        [88200, 1], [176400, 2], [192000, 3],
        [8000, 4], [16000, 5], [22050, 6], [24000, 7],
        [32000, 8], [44100, 9], [48000, 10], [96000, 11],
    ];
    for (const [rate, code] of map) {
        if (sr === rate) return code;
    }
    // Use explicit sample rate encoding
    return 0; // get from STREAMINFO
}

function sampleRateByte(sr: number): Uint8Array {
    const code = getSampleRateCode(sr);
    if (code >= 12) {
        const srKHz = Math.round(sr / 1000);
        if (code === 12) return new Uint8Array([srKHz]); // 8-bit kHz
        if (code === 13) return toBe16(sr); // 16-bit Hz
        if (code === 14) return toBe16(Math.round(sr / 10)); // 16-bit tens of Hz
    }
    return new Uint8Array(0);
}
