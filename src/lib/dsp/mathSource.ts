/**
 * Operaciones matemáticas entre trazos y capas de medición.
 */

export function addTraces(a: Float32Array, b: Float32Array, out: Float32Array): void {
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] + b[i];
    }
}

export function subtractTraces(a: Float32Array, b: Float32Array, out: Float32Array): void {
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] - b[i];
    }
}

export function averagePower(traces: Float32Array[], out: Float32Array): void {
    if (traces.length === 0) return;
    const N = out.length;
    out.fill(0);
    for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let j = 0; j < traces.length; j++) {
            // Promedio de potencia: 10 * log10(sum(10^(db/10)) / n)
            sum += Math.pow(10, traces[j][i] / 10);
        }
        out[i] = 10 * Math.log10(sum / traces.length + 1e-12);
    }
}

export function invertTrace(a: Float32Array, out: Float32Array): void {
    for (let i = 0; i < a.length; i++) {
        out[i] = -a[i];
    }
}

export function maxTrace(traces: Float32Array[], out: Float32Array): void {
    if (traces.length === 0) return;
    out.set(traces[0]);
    for (let j = 1; j < traces.length; j++) {
        for (let i = 0; i < out.length; i++) {
            if (traces[j][i] > out[i]) out[i] = traces[j][i];
        }
    }
}
