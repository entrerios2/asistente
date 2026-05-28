<script lang="ts">
    import { onMount } from "svelte";
    import { traceManager, type Trace } from "$lib/stores/traceManager.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { meterStore } from "$lib/stores/meterStore.svelte";
    import { mathOrchestrator } from "$lib/stores/mathOrchestrator.svelte";

    interface Props {
        id: string;
    }

    let { id }: Props = $props();

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    let settingsBtn: HTMLButtonElement;

    // Lista de métricas activas
    let activeMetrics = $state<string[]>(["Magnitude"]);
    let smoothing = $state(1 / 48);
    let showSelector = $state(false);

    let metricStyles = $state<Record<string, { color: string, lineWidth: number, lineDash: number[] }>>({
        "Spectrum": { color: "#a855f7", lineWidth: 2, lineDash: [] },
        "Magnitude": { color: "#ff4444", lineWidth: 2, lineDash: [] },
        "Phase": { color: "#d946ef", lineWidth: 1.6, lineDash: [] },
        "Coherence": { color: "#eab308", lineWidth: 1.8, lineDash: [] },
        "Group Delay": { color: "#10b981", lineWidth: 1.8, lineDash: [] },
        "Impulse": { color: "#3b82f6", lineWidth: 2, lineDash: [] },
        "Step": { color: "#f97316", lineWidth: 2, lineDash: [] },
    });

    let editingStyleMetric = $state<string | null>(null);

    let frequencyLUT = $state<Int32Array>(new Int32Array(0));

    function rebuildFrequencyLUT(width: number) {
        if (width <= 0) return;
        const lut = new Int32Array(Math.round(width));
        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const binWidth = 24000 / BINS; // 48000 Hz / 2 / BINS

        for (let x = 0; x < width; x++) {
            // Calcular frecuencia logarítmica correspondiente al píxel X
            const adjustedX = (x - offsetX) / scaleX;
            const logFreq = (adjustedX / width) * (logMax - logMin) + logMin;
            const freq = Math.pow(10, logFreq);
            
            // Mapear al bin FFT correspondiente
            const binIndex = Math.max(0, Math.min(BINS - 1, Math.round(freq / binWidth)));
            lut[x] = binIndex;
        }
        frequencyLUT = lut;
    }

    $effect(() => {
        rebuildFrequencyLUT(containerWidth);
    });

    // Dimensiones reactivas del contenedor físico
    let containerWidth = $state(0);
    let containerHeight = $state(0);

    // Zoom & Pan state
    let scaleX = $state(1);
    let scaleY = $state(1);
    let offsetX = $state(0);
    let offsetY = $state(0);
    let isDragging = $state(false);
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Mobile gesture zoom
    let touchStartDist = 0;
    let touchStartScaleX = 1;
    let touchStartScaleY = 1;
    let isPinching = false;

    // Crosshair state
    let mouseX = $state(0);
    let mouseY = $state(0);
    let showCrosshair = $state(false);

    // Control de recalculo y throttling
    let dirty = $state(true);
    let lastMathTime = 0;
    const MATH_THROTTLE_MS = 50;

    // Puente reactivo de Svelte 5 para marcar dirty = true
    $effect(() => {
        // Observar cambios en variables que alteran el cálculo
        const _bands = JSON.stringify(traceManager.eqBands);
        const _metrics = activeMetrics.join(",");
        const _measuring = uiStore.isMeasuring;
        const _simulating = uiStore.isSimulating;
        dirty = true;
    });

    // Caché e historial del espectrograma optimizado
    const maxHistory = 100;
    const numFreqs = 70;
    let spectrogramFrameCount = 0;
    let offscreenCanvas: HTMLCanvasElement | null = null;
    let offscreenCtx: CanvasRenderingContext2D | null = null;

    // Precomputar LUT de colores para el espectrograma (256 colores)
    const spectrogramLUT = new Array<string>(256);
    for (let i = 0; i < 256; i++) {
        const norm = i / 255;
        let r = 0,
            g = 0,
            b = 0;
        if (norm < 0.3) {
            r = Math.round((norm / 0.3) * 80);
            g = Math.round((norm / 0.3) * 10);
            b = Math.round(50 + (norm / 0.3) * 100);
        } else if (norm < 0.7) {
            const t = (norm - 0.3) / 0.4;
            r = Math.round(80 + t * 150);
            g = Math.round(10 + t * 60);
            b = Math.round(150 - t * 120);
        } else {
            const t = (norm - 0.7) / 0.3;
            r = 230 + Math.round(t * 25);
            g = 70 + Math.round(t * 185);
            b = 30 + Math.round(t * 180);
        }
        spectrogramLUT[i] = `rgb(${r},${g},${b})`;
    }

    function initOffscreenCanvas() {
        if (typeof document === "undefined") return;
        offscreenCanvas = document.createElement("canvas");
        const w = Math.round(containerWidth) || 800;
        offscreenCanvas.width = w;
        offscreenCanvas.height = maxHistory;
        offscreenCtx = offscreenCanvas.getContext("2d");
        if (offscreenCtx) {
            offscreenCtx.fillStyle = "#000000";
            offscreenCtx.fillRect(0, 0, w, maxHistory);
        }
    }

    // Configuración de rangos acústicos estándar
    const freqMin = 20; // Hz
    const freqMax = 20000; // Hz
    const timeMin = -10; // ms
    const timeMax = 100; // ms
    const dbMin = -30; // dB
    const dbMax = 30; // dB

    // === PIPELINE MATEMÁTICO CENTRALIZADO Y SUAVIZADO ===
    const BINS = 4096;
    const FFT_SIZE = 8192;

    // Buffers de interpolación temporal (Exponential Smoothing) para renderizado a 60+ FPS
    const interpMagnitude = new Float32Array(BINS);
    const interpPhase = new Float32Array(BINS);
    const interpCoherence = new Float32Array(BINS);
    const interpGroupDelay = new Float32Array(BINS);
    const interpImpulse = new Float32Array(FFT_SIZE);
    const interpStep = new Float32Array(FFT_SIZE);

    // Factor de suavizado temporal (0.15 = ~100ms de tiempo de asentamiento para transiciones ultra-suaves)
    const SMOOTHING_FACTOR = 0.15;

    // Inicializar buffers de interpolación con valores por defecto razonables
    for (let i = 0; i < BINS; i++) {
        interpMagnitude[i] = -50;
        interpPhase[i] = 0;
        interpCoherence[i] = 0.98;
        interpGroupDelay[i] = 0;
    }
    for (let i = 0; i < FFT_SIZE; i++) {
        interpImpulse[i] = 0;
        interpStep[i] = 0;
    }

    // Ayudante de interpolación de frecuencia logarítmica para los buffers de bins
    function getMetricValueInterpolated(
        freq: number,
        dataArray: Float32Array,
    ): number {
        const sr = 48000;
        const bins = dataArray.length;
        const idx = (freq * bins) / (sr / 2);
        const i0 = Math.max(0, Math.min(bins - 1, Math.floor(idx)));
        const i1 = Math.max(0, Math.min(bins - 1, Math.ceil(idx)));
        const frac = idx - i0;
        return dataArray[i0] * (1 - frac) + dataArray[i1] * frac;
    }

    // Ayudante de interpolación circular para el dominio del tiempo
    function getImpulseValueInterpolated(
        timeMs: number,
        impulseArray: Float32Array,
    ): number {
        const size = impulseArray.length;
        const sampleRate = 48000;
        const sampleIdx = (timeMs / 1000) * sampleRate;

        let idx = sampleIdx;
        if (idx < 0) {
            idx += size;
        }
        idx = Math.max(0, Math.min(size - 1, idx));

        const i0 = Math.floor(idx);
        const i1 = (i0 + 1) % size;
        const frac = idx - i0;
        return impulseArray[i0] * (1 - frac) + impulseArray[i1] * frac;
    }

    /**
     * Realiza la interpolación temporal (Exponential Smoothing) de los buffers de salida
     * del MathOrchestrator hacia los buffers locales de renderizado.
     * Si snap es true, copia directamente los valores para una respuesta instantánea.
     */
    function interpolateBuffers(snap: boolean) {
        const factor = snap ? 1.0 : SMOOTHING_FACTOR;

        // Interpolación de buffers de frecuencia (BINS)
        for (let i = 0; i < BINS; i++) {
            interpMagnitude[i] +=
                (mathOrchestrator.outputMagnitude[i] - interpMagnitude[i]) *
                factor;
            interpPhase[i] +=
                (mathOrchestrator.outputPhase[i] - interpPhase[i]) * factor;
            interpCoherence[i] +=
                (mathOrchestrator.outputCoherence[i] - interpCoherence[i]) *
                factor;
            interpGroupDelay[i] +=
                (mathOrchestrator.outputGroupDelay[i] - interpGroupDelay[i]) *
                factor;
        }

        // Interpolación de buffers de tiempo (FFT_SIZE)
        for (let i = 0; i < FFT_SIZE; i++) {
            interpImpulse[i] +=
                (mathOrchestrator.outputImpulse[i] - interpImpulse[i]) * factor;
            interpStep[i] +=
                (mathOrchestrator.outputStep[i] - interpStep[i]) * factor;
        }
    }

    // Definición de las 10 métricas de OSM
    const allMetrics = [
        {
            name: "Spectrum",
            type: "frequency",
            color: "#a855f7",
            label: "Spectrum [Absoluto]",
        },
        {
            name: "Magnitude",
            type: "frequency",
            color: "#ff4444",
            label: "Magnitude [Relativo]",
        },
        {
            name: "Phase",
            type: "frequency",
            color: "#d946ef",
            label: "Phase [Fase]",
        },
        {
            name: "Coherence",
            type: "frequency",
            color: "#eab308",
            label: "Coherence",
        },
        {
            name: "Group Delay",
            type: "frequency",
            color: "#10b981",
            label: "Group Delay",
        },
        {
            name: "Spectrogram",
            type: "frequency",
            color: "#ec4899",
            label: "Spectrogram 2D",
        },
        {
            name: "Impulse",
            type: "time",
            color: "#3b82f6",
            label: "Impulse [Tiempo]",
        },
        {
            name: "Step",
            type: "time",
            color: "#f97316",
            label: "Step [Escalón]",
        },
        {
            name: "Level",
            type: "visual",
            color: "#06b6d4",
            label: "Level [VU]",
        },
        {
            name: "Numeric",
            type: "visual",
            color: "#14b8a6",
            label: "Numeric [HUD]",
        },
    ];

    // Lógica reactiva derivada para exclusiones Cartesianas
    const hasTimeDomainActive = $derived(
        activeMetrics.includes("Impulse") || activeMetrics.includes("Step"),
    );
    const hasFreqDomainActive = $derived(
        activeMetrics.some((m) =>
            [
                "Spectrum",
                "Magnitude",
                "Phase",
                "Coherence",
                "Group Delay",
                "Spectrogram",
            ].includes(m),
        ),
    );
    const hasSpectrumActive = $derived(activeMetrics.includes("Spectrum"));
    const hasMagnitudeActive = $derived(activeMetrics.includes("Magnitude"));

    function isMetricDisabled(name: string): boolean {
        if (
            [
                "Spectrum",
                "Magnitude",
                "Phase",
                "Coherence",
                "Group Delay",
                "Spectrogram",
            ].includes(name)
        ) {
            if (hasTimeDomainActive) return true;
        }
        if (["Impulse", "Step"].includes(name)) {
            if (hasFreqDomainActive) return true;
        }
        return false;
    }

    function toggleMetric(name: string) {
        if (isMetricDisabled(name)) return;
        if (activeMetrics.includes(name)) {
            activeMetrics = activeMetrics.filter((m) => m !== name);
        } else {
            activeMetrics.push(name);
        }
    }

    // Conversiones de coordenadas cartesianas integrando escala y offset
    function valToX(val: number, width: number): number {
        if (hasTimeDomainActive) {
            // Eje X Lineal (Tiempo en milisegundos: -10ms a 100ms)
            const range = timeMax - timeMin;
            const normalized = (val - timeMin) / range;
            return normalized * width * scaleX + offsetX;
        } else {
            // Eje X Logarítmico (Frecuencia en hercios: 20Hz a 20kHz)
            if (val < freqMin) val = freqMin;
            const logMin = Math.log10(freqMin);
            const logMax = Math.log10(freqMax);
            const logFreq = Math.log10(val);
            const normalized = (logFreq - logMin) / (logMax - logMin);
            return normalized * width * scaleX + offsetX;
        }
    }

    function xToVal(x: number, width: number): number {
        const adjustedX = (x - offsetX) / scaleX;
        if (hasTimeDomainActive) {
            const range = timeMax - timeMin;
            return timeMin + (adjustedX / width) * range;
        } else {
            const logMin = Math.log10(freqMin);
            const logMax = Math.log10(freqMax);
            const logFreq = (adjustedX / width) * (logMax - logMin) + logMin;
            return Math.pow(10, logFreq);
        }
    }

    function valToY(val: number, height: number, metricType: string): number {
        let min = dbMin,
            max = dbMax;
        if (metricType === "Spectrum") {
            min = -120;
            max = 10;
        } else if (metricType === "Phase") {
            min = -180;
            max = 180;
        } else if (metricType === "Coherence") {
            min = 0;
            max = 1;
        } else if (metricType === "Group Delay") {
            min = -5;
            max = 25;
        } else if (metricType === "Impulse" || metricType === "Step") {
            min = -1;
            max = 1;
        }

        const range = max - min;
        const normalized = (val - min) / range;
        const base = height - normalized * height;
        return base * scaleY + offsetY;
    }

    function yToVal(y: number, height: number, metricType: string): number {
        const adjustedY = (y - offsetY) / scaleY;
        let min = dbMin,
            max = dbMax;
        if (metricType === "Spectrum") {
            min = -120;
            max = 10;
        } else if (metricType === "Phase") {
            min = -180;
            max = 180;
        } else if (metricType === "Coherence") {
            min = 0;
            max = 1;
        } else if (metricType === "Group Delay") {
            min = -5;
            max = 25;
        } else if (metricType === "Impulse" || metricType === "Step") {
            min = -1;
            max = 1;
        }

        const range = max - min;
        return min + (1 - adjustedY / height) * range;
    }

    // Caché reactivo de EQ (Playground)
    const eqResponseCache = $derived.by(() => {
        const size = 4096;
        const cache = new Float32Array(size);
        const sr = 48000;
        for (let i = 0; i < size; i++) {
            const freq = (i * sr) / 2 / size;
            let totalGain = 0;
            for (let b = 0; b < traceManager.eqBands.length; b++) {
                const band = traceManager.eqBands[b];
                const fo = band.freq;
                const G = band.gain;
                const Q = band.q;

                const bw = fo / Q;
                const dist = Math.abs(Math.log2(freq / fo || 1e-6));
                const octBw = bw / fo;
                const weight = Math.exp(-Math.pow(dist / (octBw * 1.2), 2));
                totalGain += G * weight;
            }
            cache[i] = totalGain;
        }
        return cache;
    });

    function getEQResponseCached(f: number): number {
        const binWidth = 24000 / 4096;
        const idx = Math.round(f / binWidth);
        if (idx < 0) return eqResponseCache[0];
        if (idx >= 4096) return eqResponseCache[4095];
        return eqResponseCache[idx];
    }

    interface DataPoint {
        freq: number;
        val: number;
    }

    // Reducción logarítmica de bins de frecuencia
    function smoothDataLog(
        data: Float32Array,
        octaveFraction: number,
    ): DataPoint[] {
        const sr = 48000;
        const numPoints = 400;
        const points: DataPoint[] = [];

        if (!data || data.length === 0) {
            for (let i = 0; i < numPoints; i++) {
                const logFreq =
                    Math.log10(freqMin) +
                    (i / (numPoints - 1)) *
                        (Math.log10(freqMax) - Math.log10(freqMin));
                points.push({ freq: Math.pow(10, logFreq), val: -60 });
            }
            return points;
        }

        const prefixSums = new Float32Array(data.length + 1);
        for (let i = 0; i < data.length; i++) {
            prefixSums[i + 1] = prefixSums[i] + data[i];
        }

        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const binWidth = sr / 2 / data.length;

        for (let i = 0; i < numPoints; i++) {
            const logFreq = logMin + (i / (numPoints - 1)) * (logMax - logMin);
            const freq = Math.pow(10, logFreq);

            const frac = octaveFraction > 0 ? octaveFraction : 1 / 48;
            const f_start = freq * Math.pow(2, -frac / 2);
            const f_end = freq * Math.pow(2, frac / 2);

            const startBin = Math.max(0, Math.round(f_start / binWidth));
            const endBin = Math.min(
                data.length - 1,
                Math.round(f_end / binWidth),
            );

            let val = 0;
            if (endBin >= startBin) {
                const sum = prefixSums[endBin + 1] - prefixSums[startBin];
                val = sum / (endBin - startBin + 1);
            } else {
                const binIdx = Math.min(
                    data.length - 1,
                    Math.round(freq / binWidth),
                );
                val = data[binIdx];
            }

            points.push({ freq, val });
        }

        return points;
    }

    // SIMULACIÓN DE MÉTRICAS ACÚSTICAS PROFESIONALES (DSP)
    function getCoherenceValue(freq: number, isMeasuring: boolean): number {
        let coh = 0.98;
        if (freq < 45) coh -= 0.35 * (1 - freq / 45);
        if (freq > 16000) coh -= (0.12 * (freq - 16000)) / 4000;

        for (let b = 0; b < traceManager.eqBands.length; b++) {
            const band = traceManager.eqBands[b];
            if (band.gain < -5) {
                const dist = Math.abs(Math.log2(freq / band.freq));
                if (dist < 0.25) coh -= 0.18 * (1 - dist / 0.25);
            }
        }
        if (isMeasuring) {
            coh += (Math.random() - 0.5) * 0.015;
        }
        return Math.max(0.01, Math.min(1, coh));
    }

    // CORE DRAW ENGINE
    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        ctx.clearRect(0, 0, width, height);

        // 1. Dibujar Grilla de Fondo
        drawGrid(ctx, width, height);

        const liveTrace = traceManager.traces.find((t) => t.id === "live-1");

        // Ejecutar el pipeline matemático centralizado en el MathOrchestrator
        // El MathOrchestrator se encarga de aplicar el throttling adaptativo y EQ caching
        mathOrchestrator.run(liveTrace);

        // Realizar la interpolación temporal (Exponential Smoothing) a 60+ FPS
        // Si dirty es true, forzamos un snap instantáneo para que la UI responda de inmediato
        interpolateBuffers(dirty);
        if (dirty) {
            dirty = false;
        }

        // Alimentar buffer de Espectrograma en vivo optimizado con offscreen canvas
        if (
            liveTrace &&
            liveTrace.data &&
            liveTrace.data.length > 0 &&
            activeMetrics.includes("Spectrogram") &&
            !hasTimeDomainActive
        ) {
            spectrogramFrameCount++;
            if (spectrogramFrameCount % 3 === 0) {
                const w = Math.round(width) || 800;
                if (!offscreenCanvas || offscreenCanvas.width !== w) {
                    initOffscreenCanvas();
                }
                if (offscreenCtx && offscreenCanvas) {
                    // Desplazar el espectrograma existente 1 píxel hacia arriba
                    offscreenCtx.drawImage(
                        offscreenCanvas,
                        0,
                        1,
                        w,
                        maxHistory - 1,
                        0,
                        0,
                        w,
                        maxHistory - 1,
                    );

                    // Dibujar la nueva fila en el extremo inferior
                    const data = liveTrace.data;
                    const yRow = maxHistory - 1;
                    const logMin = Math.log10(freqMin);
                    const logMax = Math.log10(freqMax);

                    for (let x = 0; x < w; x++) {
                        const logFreq = (x / w) * (logMax - logMin) + logMin;
                        const freq = Math.pow(10, logFreq);
                        const val = getMetricValueInterpolated(freq, data);

                        const db = Math.max(-60, Math.min(15, val));
                        const norm = (db + 60) / 75;
                        const lutIdx = Math.max(
                            0,
                            Math.min(255, Math.floor(norm * 255)),
                        );

                        offscreenCtx.fillStyle = spectrogramLUT[lutIdx];
                        offscreenCtx.fillRect(x, yRow, 1, 1);
                    }
                }
            }
        }

        // 2. Renderizado de Espectrograma 2D (Fondo)
        if (activeMetrics.includes("Spectrogram") && !hasTimeDomainActive) {
            drawSpectrogram(ctx, width, height);
        }

        // 3. Renderizar cada métrica seleccionada con zero-allocation helpers usando los buffers interpolados
        if (activeMetrics.includes("Magnitude") && !hasTimeDomainActive) {
            const style = metricStyles["Magnitude"];
            drawMetricPath(
                ctx,
                interpMagnitude,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Magnitude",
                1.03,
            );

            if (uiStore.isSimulating && frequencyLUT.length > 0) {
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
                ctx.lineWidth = 1.5;
                const pathSim = new Path2D();
                let firstSim = true;
                const sr = 48000;
                const binWidth = sr / 2 / BINS;

                for (let x = 0; x < width; x++) {
                    const binIndex = frequencyLUT[x];
                    if (binIndex === undefined) continue;

                    const val = interpMagnitude[binIndex];
                    const f = binIndex * binWidth || 1e-6;
                    const eqGain = getEQResponseCached(f);
                    const y = valToY(val + eqGain, height, "Magnitude");

                    if (firstSim) {
                        pathSim.moveTo(x, y);
                        firstSim = false;
                    } else {
                        pathSim.lineTo(x, y);
                    }
                }
                ctx.stroke(pathSim);
                ctx.setLineDash([]);
            }
        }

        if (activeMetrics.includes("Spectrum") && !hasTimeDomainActive) {
            const style = metricStyles["Spectrum"];
            drawSpectrumPath(ctx, liveTrace, width, height, style.color, style.lineWidth, style.lineDash);
        }

        if (activeMetrics.includes("Phase") && !hasTimeDomainActive && frequencyLUT.length > 0) {
            const style = metricStyles["Phase"];
            ctx.strokeStyle = style.color;
            ctx.lineWidth = style.lineWidth;
            ctx.setLineDash(style.lineDash || []);
            
            const path = new Path2D();
            let lastY = 0;
            let first = true;

            for (let x = 0; x < width; x++) {
                const binIndex = frequencyLUT[x];
                if (binIndex === undefined) continue;

                const val = interpPhase[binIndex];
                const y = valToY(val, height, "Phase");

                if (first) {
                    path.moveTo(x, y);
                    first = false;
                } else {
                    if (Math.abs(y - lastY) > height * 0.65) {
                        path.moveTo(x, y); // Salto circular sin dibujar línea vertical de descarte
                    } else {
                        path.lineTo(x, y);
                    }
                }
                lastY = y;
            }
            ctx.stroke(path);
            ctx.setLineDash([]);
        }

        if (activeMetrics.includes("Coherence") && !hasTimeDomainActive) {
            const style = metricStyles["Coherence"];
            drawMetricPath(
                ctx,
                interpCoherence,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Coherence",
                1.04,
            );
        }

        if (activeMetrics.includes("Group Delay") && !hasTimeDomainActive) {
            const style = metricStyles["Group Delay"];
            drawMetricPath(
                ctx,
                interpGroupDelay,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Group Delay",
                1.04,
            );
        }

        if (activeMetrics.includes("Impulse") && hasTimeDomainActive) {
            const style = metricStyles["Impulse"];
            drawTimeDomainPath(
                ctx,
                interpImpulse,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Impulse",
            );
        }

        if (activeMetrics.includes("Step") && hasTimeDomainActive) {
            const style = metricStyles["Step"];
            drawTimeDomainPath(
                ctx,
                interpStep,
                width,
                height,
                style.color,
                style.lineWidth,
                style.lineDash,
                "Step",
            );
        }

        // 4. Overlays Especiales
        if (activeMetrics.includes("Level")) {
            drawLevelOverlay(ctx, width, height);
        }

        if (activeMetrics.includes("Numeric")) {
            drawNumericOverlay(ctx, width, height);
        }

        // 5. Retícula Crosshair Interactiva
        if (showCrosshair) {
            drawCrosshair(ctx, width, height);
        }
    }

    // Zero-allocation drawing helper for standard frequency metrics (Magnitude, Coherence, Group Delay)
    function drawMetricPath(
        ctx: CanvasRenderingContext2D,
        dataArray: Float32Array,
        width: number,
        height: number,
        color: string,
        lw: number,
        lineDash: number[],
        metricType: string
    ) {
        if (frequencyLUT.length === 0) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.setLineDash(lineDash || []);
        
        const path = new Path2D();
        let first = true;

        for (let x = 0; x < width; x++) {
            const binIndex = frequencyLUT[x];
            if (binIndex === undefined) continue;

            const val = dataArray[binIndex];
            const y = valToY(val, height, metricType);

            if (first) {
                path.moveTo(x, y);
                first = false;
            } else {
                path.lineTo(x, y);
            }
        }

        ctx.stroke(path);
        ctx.setLineDash([]);
    }

    // Zero-allocation drawing helper for Spectrum metric (which has a fallback/offset logic)
    function drawSpectrumPath(
        ctx: CanvasRenderingContext2D,
        liveTrace: Trace | undefined,
        width: number,
        height: number,
        color: string,
        lw: number,
        lineDash: number[],
    ) {
        if (frequencyLUT.length === 0) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.setLineDash(lineDash || []);
        
        const path = new Path2D();
        let first = true;
        const hasLive =
            liveTrace && liveTrace.data && liveTrace.data.length > 0;
        const dataArray = hasLive ? liveTrace.data : interpMagnitude;
        const offset = hasLive ? 0 : 68;

        for (let x = 0; x < width; x++) {
            const binIndex = frequencyLUT[x];
            if (binIndex === undefined) continue;

            let val = 0;
            if (hasLive) {
                const mapIdx = Math.floor((binIndex * dataArray.length) / BINS);
                val = dataArray[mapIdx] || -120;
            } else {
                val = dataArray[binIndex] + offset;
            }
            const y = valToY(val, height, "Spectrum");

            if (first) {
                path.moveTo(x, y);
                first = false;
            } else {
                path.lineTo(x, y);
            }
        }
        ctx.stroke(path);
        ctx.setLineDash([]);
    }

    // Zero-allocation drawing helper for Time Domain metrics (Impulse, Step)
    function drawTimeDomainPath(
        ctx: CanvasRenderingContext2D,
        dataArray: Float32Array,
        width: number,
        height: number,
        color: string,
        lw: number,
        lineDash: number[],
        metricType: string,
    ) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.setLineDash(lineDash || []);
        ctx.beginPath();
        let first = true;
        const numPoints = 350;
        for (let i = 0; i < numPoints; i++) {
            const t = timeMin + (i / (numPoints - 1)) * (timeMax - timeMin);
            const x = valToX(t, width);
            const val = getImpulseValueInterpolated(t, dataArray);
            const y = valToY(val, height, metricType);

            if (x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50) {
                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawGrid(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillStyle = "rgba(156, 163, 175, 0.6)";
        ctx.font = "9px monospace";

        // Vertical ticks (X axis)
        if (hasTimeDomainActive) {
            for (let t = -10; t <= 100; t += 10) {
                const x = valToX(t, width);
                if (x >= 0 && x <= width) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                    ctx.stroke();
                    ctx.fillText(`${t}ms`, x + 3, height - 6);
                }
            }
        } else {
            const freqs = [
                20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000,
            ];
            freqs.forEach((f) => {
                const x = valToX(f, width);
                if (x >= 0 && x <= width) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                    ctx.stroke();
                    ctx.fillText(
                        f >= 1000 ? `${f / 1000}kHz` : `${f}Hz`,
                        x + 3,
                        height - 6,
                    );
                }
            });
        }

        // Horizontal ticks (Left Y axis)
        const mainMetric =
            activeMetrics.find(
                (m) => m !== "Phase" && m !== "Level" && m !== "Numeric",
            ) || activeMetrics[0];
        if (mainMetric && mainMetric !== "Spectrogram") {
            let min = dbMin,
                max = dbMax,
                step = 10,
                unit = "dB";
            if (mainMetric === "Spectrum") {
                min = 20;
                max = 100;
                step = 10;
                unit = "dBSPL";
            } else if (mainMetric === "Coherence") {
                min = 0;
                max = 1;
                step = 0.2;
                unit = "";
            } else if (mainMetric === "Group Delay") {
                min = -5;
                max = 25;
                step = 5;
                unit = "ms";
            } else if (mainMetric === "Impulse" || mainMetric === "Step") {
                min = -1;
                max = 1;
                step = 0.5;
                unit = "";
            }

            for (let val = min; val <= max; val += step) {
                const y = valToY(val, height, mainMetric);
                if (y >= 0 && y <= height) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                    ctx.fillText(
                        `${val.toFixed(mainMetric === "Coherence" ? 1 : 0)}${unit}`,
                        8,
                        y - 4,
                    );
                }
            }
        }

        // Horizontal ticks (Right secondary Y axis for Phase)
        if (activeMetrics.includes("Phase") && !hasTimeDomainActive) {
            ctx.fillStyle = "rgba(217, 70, 239, 0.75)";
            for (let val = -180; val <= 180; val += 60) {
                const y = valToY(val, height, "Phase");
                if (y >= 0 && y <= height) {
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(217, 70, 239, 0.08)";
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                    ctx.fillText(`${val}°`, width - 35, y - 4);
                }
            }
        }

        // Horizontal ticks (Right secondary Y axis for Spectrum)
        if (activeMetrics.includes("Spectrum") && !hasTimeDomainActive) {
            ctx.fillStyle = "#a855f7";
            for (let val = -120; val <= 10; val += 20) {
                const y = valToY(val, height, "Spectrum");
                if (y >= 0 && y <= height) {
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(168, 85, 247, 0.08)";
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                    ctx.fillText(`${val} dBSPL`, width - 40, y - 4);
                }
            }
        }
    }

    function drawSpectrogram(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ) {
        if (!offscreenCanvas) return;
        ctx.drawImage(offscreenCanvas, 0, 0, width, height);
    }

    function drawLevelOverlay(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ) {
        const barWidth = 14;
        const barHeight = height * 0.55;
        const xStart = width - 48;
        const yStart = (height - barHeight) / 2 + 10;

        ctx.fillStyle = "rgba(6, 10, 15, 0.85)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(
            xStart - 10,
            yStart - 15,
            barWidth * 2 + 25,
            barHeight + 30,
            8,
        );
        ctx.fill();
        ctx.stroke();

        const inVal = meterStore.inLevels[0] || -60;
        const outVal = meterStore.outLevels[0] || -60;

        ctx.fillStyle = "#bbb";
        ctx.font = "8px monospace";
        const dbTicks = [0, -10, -20, -30, -45, -60];
        dbTicks.forEach((db) => {
            const pct = (db + 60) / 60;
            const y = yStart + barHeight - pct * barHeight;
            ctx.fillText(`${db}`, xStart + barWidth * 2 + 8, y + 3);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.beginPath();
            ctx.moveTo(xStart - 5, y);
            ctx.lineTo(xStart + barWidth * 2 + 5, y);
            ctx.stroke();
        });

        const drawBar = (dbValue: number, xPos: number, isInput: boolean) => {
            ctx.fillStyle = "#060608";
            ctx.fillRect(xPos, yStart, barWidth, barHeight);

            const pct = Math.max(0, Math.min(1, (dbValue + 60) / 60));
            const fillHeight = pct * barHeight;
            const yFill = yStart + barHeight - fillHeight;

            const grad = ctx.createLinearGradient(
                xPos,
                yStart + barHeight,
                xPos,
                yStart,
            );
            grad.addColorStop(0, "#00ff88");
            grad.addColorStop(0.7, "#eab308");
            grad.addColorStop(1, "#ef4444");

            ctx.fillStyle = grad;
            ctx.fillRect(xPos, yFill, barWidth, fillHeight);

            ctx.fillStyle = "#999";
            ctx.fillText(
                isInput ? "IN" : "OUT",
                xPos + 1,
                yStart + barHeight + 11,
            );
        };

        drawBar(inVal, xStart, true);
        drawBar(outVal, xStart + barWidth + 5, false);
    }

    function drawNumericOverlay(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ) {
        const panelWidth = 170;
        const panelHeight = 115;
        const xPos = 16;
        const yPos = 46;

        ctx.fillStyle = "rgba(8, 8, 12, 0.85)";
        ctx.strokeStyle = "rgba(20, 184, 166, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(xPos, yPos, panelWidth, panelHeight, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#14b8a6";
        ctx.font = 'bold 9px "Outfit", sans-serif';
        ctx.fillText("ANÁLISIS ACÚSTICO HUD", xPos + 12, yPos + 18);

        ctx.strokeStyle = "rgba(20, 184, 166, 0.12)";
        ctx.beginPath();
        ctx.moveTo(xPos + 10, yPos + 24);
        ctx.lineTo(xPos + panelWidth - 10, yPos + 24);
        ctx.stroke();

        const inVal = meterStore.inLevels[0] || -60;
        const outVal = meterStore.outLevels[0] || -60;
        const snr = inVal - -65;

        const rows = [
            {
                label: "RMS Entrada:",
                val: `${inVal.toFixed(1)} dB`,
                color: "#fff",
            },
            {
                label: "RMS Salida:",
                val: `${outVal.toFixed(1)} dB`,
                color: "#fff",
            },
            {
                label: "SNR Estimado:",
                val: `${snr.toFixed(1)} dB`,
                color: "#eab308",
            },
            {
                label: "Distancia Alt.:",
                val: hasTimeDomainActive ? "4.82 m" : "N/A",
                color: "#3b82f6",
            },
            {
                label: "RT60 Sala:",
                val: hasTimeDomainActive ? "0.36 s" : "N/A",
                color: "#10b981",
            },
        ];

        rows.forEach((r, idx) => {
            const y = yPos + 38 + idx * 14;
            ctx.fillStyle = "#9ca3af";
            ctx.font = '8px "Inter", sans-serif';
            ctx.fillText(r.label, xPos + 12, y);

            ctx.fillStyle = r.color;
            ctx.font = "bold 8px monospace";
            ctx.fillText(r.val, xPos + panelWidth - 55, y);
        });
    }

    function drawCrosshair(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ) {
        const liveTrace = traceManager.traces.find((t) => t.id === "live-1");
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(mouseX, 0);
        ctx.lineTo(mouseX, height);
        ctx.moveTo(0, mouseY);
        ctx.lineTo(width, mouseY);
        ctx.stroke();
        ctx.setLineDash([]);

        const xVal = xToVal(mouseX, width);

        ctx.fillStyle = "rgba(8, 8, 12, 0.95)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";

        const labelWidth = 145;
        const labelHeight = 65;
        let lx = mouseX + 12;
        let ly = mouseY - labelHeight - 12;

        if (lx + labelWidth > width) lx = mouseX - labelWidth - 12;
        if (ly < 0) ly = mouseY + 12;

        ctx.beginPath();
        ctx.roundRect(lx, ly, labelWidth, labelHeight, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = 'bold 8px "Outfit", sans-serif';

        if (hasTimeDomainActive) {
            ctx.fillText(`Tiempo: ${xVal.toFixed(2)} ms`, lx + 8, ly + 14);
            ctx.fillStyle = "#9ca3af";
            ctx.font = "8px monospace";

            let rowIdx = 0;
            if (activeMetrics.includes("Impulse")) {
                const val = getImpulseValueInterpolated(xVal, interpImpulse);
                ctx.fillText(
                    `Impulso: ${val.toFixed(3)}`,
                    lx + 8,
                    ly + 28 + rowIdx * 12,
                );
                rowIdx++;
            }
            if (activeMetrics.includes("Step")) {
                const val = getImpulseValueInterpolated(xVal, interpStep);
                ctx.fillText(
                    `Escalón: ${val.toFixed(3)}`,
                    lx + 8,
                    ly + 28 + rowIdx * 12,
                );
            }
        } else {
            ctx.fillText(`Frec: ${xVal.toFixed(1)} Hz`, lx + 8, ly + 14);
            ctx.font = "8px monospace";

            let rowIdx = 0;
            if (activeMetrics.includes("Magnitude")) {
                const val = getMetricValueInterpolated(xVal, interpMagnitude);
                ctx.fillStyle = "#ff4444";
                ctx.fillText(
                    `Magnitud: ${val.toFixed(1)} dB`,
                    lx + 8,
                    ly + 28 + rowIdx * 12,
                );
                rowIdx++;
            }
            if (activeMetrics.includes("Spectrum")) {
                const val = getMetricValueInterpolated(
                    xVal,
                    liveTrace && liveTrace.data && liveTrace.data.length > 0
                        ? liveTrace.data
                        : interpMagnitude,
                );
                const offset =
                    liveTrace && liveTrace.data && liveTrace.data.length > 0
                        ? 0
                        : 68;
                ctx.fillStyle = "#a855f7";
                ctx.fillText(
                    `Espectro: ${(val + offset).toFixed(1)} dBSPL`,
                    lx + 8,
                    ly + 28 + rowIdx * 12,
                );
                rowIdx++;
            }
            if (activeMetrics.includes("Phase")) {
                const val = getMetricValueInterpolated(xVal, interpPhase);
                ctx.fillStyle = "#d946ef";
                ctx.fillText(
                    `Fase: ${val.toFixed(0)}°`,
                    lx + 8,
                    ly + 28 + rowIdx * 12,
                );
                rowIdx++;
            }
            if (activeMetrics.includes("Coherence")) {
                const val = getMetricValueInterpolated(xVal, interpCoherence);
                ctx.fillStyle = "#eab308";
                ctx.fillText(
                    `Coherencia: ${val.toFixed(2)}`,
                    lx + 8,
                    ly + 28 + rowIdx * 12,
                );
                rowIdx++;
            }
        }
    }

    // GESTORES DE EVENTOS (PAN & ZOOM)
    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mX = e.clientX - rect.left;
        const mY = e.clientY - rect.top;

        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;

        const zoomX = !e.ctrlKey;
        const zoomY = !e.shiftKey;

        if (zoomX) {
            const valBefore = xToVal(mX, containerWidth);
            scaleX = Math.max(0.1, Math.min(80, scaleX * zoomFactor));
            const xAfter = valToX(valBefore, containerWidth);
            offsetX += mX - xAfter;
        }

        if (zoomY) {
            const refMetric =
                activeMetrics.find((m) => m !== "Phase") || "Magnitude";
            const valBefore = yToVal(mY, containerHeight, refMetric);
            scaleY = Math.max(0.1, Math.min(80, scaleY * zoomFactor));
            const yAfter = valToY(valBefore, containerHeight, refMetric);
            offsetY += mY - yAfter;
        }
    }

    function handleMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        showCrosshair = true;

        if (isDragging) {
            offsetX += e.clientX - lastMouseX;
            offsetY += e.clientY - lastMouseY;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    }

    function handleMouseDown(e: MouseEvent) {
        if (
            showSelector &&
            settingsBtn &&
            settingsBtn.contains(e.target as Node)
        )
            return;
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }

    function handleTouchStart(e: TouchEvent) {
        if (e.touches.length === 1) {
            isDragging = true;
            lastMouseX = e.touches[0].clientX;
            lastMouseY = e.touches[0].clientY;
            isPinching = false;
        } else if (e.touches.length === 2) {
            isDragging = false;
            isPinching = true;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDist = Math.sqrt(dx * dx + dy * dy);
            touchStartScaleX = scaleX;
            touchStartScaleY = scaleY;
        }
    }

    function handleTouchMove(e: TouchEvent) {
        const rect = canvas.getBoundingClientRect();
        if (e.touches.length === 1 && isDragging) {
            const touch = e.touches[0];
            offsetX += touch.clientX - lastMouseX;
            offsetY += touch.clientY - lastMouseY;
            lastMouseX = touch.clientX;
            lastMouseY = touch.clientY;

            mouseX = touch.clientX - rect.left;
            mouseY = touch.clientY - rect.top;
            showCrosshair = true;
        } else if (e.touches.length === 2 && isPinching) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0 && touchStartDist > 0) {
                const factor = dist / touchStartDist;
                scaleX = Math.max(0.1, Math.min(80, touchStartScaleX * factor));
                scaleY = Math.max(0.1, Math.min(80, touchStartScaleY * factor));
            }
        }
    }

    function handleTouchEnd() {
        isDragging = false;
        isPinching = false;
        showCrosshair = false;
    }

    function handleDoubleClick() {
        scaleX = 1;
        scaleY = 1;
        offsetX = 0;
        offsetY = 0;
    }

    function toggleSelector(e: MouseEvent) {
        e.stopPropagation();
        showSelector = !showSelector;
    }

    onMount(() => {
        // Observer del redimensionamiento físico del cuadrante
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                containerWidth = width;
                containerHeight = height;
            }
        });

        if (container) observer.observe(container);

        // Bucle continuo de animación con límite de FPS
        let animationId: number;
        let lastDrawTime = performance.now();
        function renderLoop() {
            animationId = requestAnimationFrame(renderLoop);
            const now = performance.now();
            const interval = 1000 / uiStore.targetFps;
            const elapsed = now - lastDrawTime;
            
            if (elapsed >= interval) {
                lastDrawTime = now - (elapsed % interval);
                draw();
            }
        }
        renderLoop();

        return () => {
            observer.disconnect();
            cancelAnimationFrame(animationId);
            mathOrchestrator.unregisterQuadrant(id);
        };
    });

    $effect(() => {
        mathOrchestrator.registerQuadrantMetrics(id, activeMetrics);
    });

    // Ajustar canvas reactivamente multiplicándolo por dpr para nitidez absoluta
    $effect(() => {
        if (canvas && containerWidth > 0 && containerHeight > 0) {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = containerWidth * dpr;
            canvas.height = containerHeight * dpr;
            canvas.style.width = `${containerWidth}px`;
            canvas.style.height = `${containerHeight}px`;

            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.resetTransform();
                ctx.scale(dpr, dpr);
            }
        }
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="quadrant-container"
    bind:this={container}
    onmousemove={handleMouseMove}
    onmousedown={handleMouseDown}
    onmouseup={() => (isDragging = false)}
    onmouseleave={() => {
        showCrosshair = false;
        isDragging = false;
    }}
    onwheel={handleWheel}
    ondblclick={handleDoubleClick}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
>
    <!-- CABECERA PREMIUM DE CADA CUADRANTE -->
    <div class="quadrant-header">
        <div class="quadrant-title-group">
            <span class="quadrant-id">{id.toUpperCase()}</span>
            <div class="active-metrics-badges">
                {#each activeMetrics as m}
                    <span
                        class="metric-badge badge-{m
                            .toLowerCase()
                            .replace(' ', '-')}">{m}</span
                    >
                {/each}
            </div>
        </div>
        <button
            bind:this={settingsBtn}
            class="settings-btn"
            onclick={toggleSelector}
            title="Configurar Métricas"
        >
            <span class="material-symbols-outlined text-[16px]">settings</span>
        </button>
    </div>

    <!-- CANVAS DEL GRÁFICO -->
    <canvas bind:this={canvas}></canvas>

    <!-- POPOVER FLOTANTE ABSOLUTO OSM -->
    {#if showSelector}
        <!-- Capturador de clics del fondo -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="popover-backdrop"
            onclick={() => (showSelector = false)}
        ></div>

        <div class="selector-popover">
            <div class="popover-header">
                <span class="popover-title">Configuración del Gráfico</span>
                <button
                    class="popover-close"
                    onclick={() => (showSelector = false)}
                >
                    <span class="material-symbols-outlined text-xs">close</span>
                </button>
            </div>

            <label class="popover-section-label"
                >Métricas de Medición</label
            >
            <div class="metrics-checkbox-list">
                {#each allMetrics as m}
                    {@const disabled = isMetricDisabled(m.name)}
                    {@const active = activeMetrics.includes(m.name)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        class="metric-checkbox-item flex flex-col gap-1"
                        class:disabled
                        class:active
                        style="--metric-color: {metricStyles[m.name]?.color || m.color}"
                    >
                        <div class="flex items-center w-full">
                            <label class="flex items-center flex-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={active}
                                    {disabled}
                                    onclick={() => toggleMetric(m.name)}
                                />
                                <span
                                    class="checkbox-custom"
                                    style="background-color: {active
                                        ? (metricStyles[m.name]?.color || m.color)
                                        : 'transparent'}; border-color: {active
                                        ? (metricStyles[m.name]?.color || m.color)
                                        : 'rgba(255,255,255,0.2)'}"
                                ></span>
                                <span class="metric-name-text">{m.label}</span>
                            </label>
                            {#if metricStyles[m.name]}
                                <button
                                    type="button"
                                    class="mini-style-edit-btn"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        editingStyleMetric = editingStyleMetric === m.name ? null : m.name;
                                    }}
                                    title="Personalizar Estilo"
                                >
                                    <span class="material-symbols-outlined text-[12px]">tune</span>
                                </button>
                            {/if}
                            {#if disabled}
                                <span class="disabled-badge ml-1">
                                    {hasTimeDomainActive
                                        ? "Frec."
                                        : hasFreqDomainActive
                                          ? "Temp."
                                          : "Excl."}
                                </span>
                            {/if}
                        </div>

                        {#if editingStyleMetric === m.name && metricStyles[m.name]}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div class="style-customizer-panel w-full" onclick={(e) => e.stopPropagation()}>
                                <div class="customizer-row">
                                    <span class="customizer-label">Color</span>
                                    <input
                                        type="color"
                                        value={metricStyles[m.name].color}
                                        oninput={(e) => {
                                            metricStyles[m.name].color = (e.target as HTMLInputElement).value;
                                        }}
                                        class="color-picker-input"
                                    />
                                </div>
                                <div class="customizer-row">
                                    <span class="customizer-label">Ancho ({metricStyles[m.name].lineWidth}px)</span>
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        step="0.5"
                                        value={metricStyles[m.name].lineWidth}
                                        oninput={(e) => {
                                            metricStyles[m.name].lineWidth = parseFloat((e.target as HTMLInputElement).value);
                                        }}
                                        class="width-slider"
                                    />
                                </div>
                                <div class="customizer-row">
                                    <span class="customizer-label">Línea</span>
                                    <div class="style-toggle-buttons">
                                        <button
                                            type="button"
                                            class="style-toggle-btn"
                                            class:active={metricStyles[m.name].lineDash.length === 0}
                                            onclick={() => {
                                                metricStyles[m.name].lineDash = [];
                                            }}
                                        >
                                            Solid
                                        </button>
                                        <button
                                            type="button"
                                            class="style-toggle-btn"
                                            class:active={metricStyles[m.name].lineDash.length > 0}
                                            onclick={() => {
                                                metricStyles[m.name].lineDash = [4, 4];
                                            }}
                                        >
                                            Dash
                                        </button>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>

            <div class="divider"></div>

            <div class="popover-controls-group">
                <div>
                    <label class="popover-section-label">Suavizado</label>
                    <div class="smoothing-options">
                        {#each [0, 1 / 3, 1 / 12, 1 / 48] as s}
                            <button
                                class="smoothing-btn"
                                class:active={smoothing === s}
                                onclick={() => (smoothing = s)}
                            >
                                {s === 0 ? "Off" : `1/${Math.round(1 / s)}`}
                            </button>
                        {/each}
                    </div>
                </div>

                <button
                    class="action-btn w-full flex items-center justify-center gap-1.5 mt-2"
                    onclick={handleDoubleClick}
                >
                    <span class="material-symbols-outlined text-xs"
                        >restart_alt</span
                    > Reiniciar Vista
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .quadrant-container {
        position: relative;
        background: #060608;
        border: 1px solid rgba(255, 255, 255, 0.04);
        overflow: hidden;
        cursor: crosshair;
        width: 100%;
        height: 100%;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    canvas {
        display: block;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, #0a0a0e 0%, #050507 100%);
    }

    /* Cabecera Premium */
    .quadrant-header {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 38px;
        background: #0c0c10;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        z-index: 30;
        box-sizing: border-box;
    }

    .quadrant-title-group {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .quadrant-id {
        font-family: "Outfit", sans-serif;
        font-size: 11px;
        font-weight: 800;
        color: #00ff88;
        letter-spacing: 0.05em;
        text-shadow: 0 0 10px rgba(0, 255, 136, 0.2);
    }

    .active-metrics-badges {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
    }

    .metric-badge {
        font-family: "Outfit", sans-serif;
        font-size: 8px;
        font-weight: 700;
        padding: 1.5px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    /* Colores correspondientes de insignias */
    .badge-magnitude {
        background: rgba(255, 68, 68, 0.12);
        border: 1px solid rgba(255, 68, 68, 0.3);
        color: #ff4444;
    }
    .badge-spectrum {
        background: rgba(168, 85, 247, 0.12);
        border: 1px solid rgba(168, 85, 247, 0.3);
        color: #c084fc;
    }
    .badge-phase {
        background: rgba(217, 70, 239, 0.12);
        border: 1px solid rgba(217, 70, 239, 0.3);
        color: #f472b6;
    }
    .badge-coherence {
        background: rgba(234, 179, 8, 0.12);
        border: 1px solid rgba(234, 179, 8, 0.3);
        color: #facc15;
    }
    .badge-group-delay {
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #34d399;
    }
    .badge-spectrogram {
        background: rgba(236, 72, 153, 0.12);
        border: 1px solid rgba(236, 72, 153, 0.3);
        color: #f472b6;
    }
    .badge-impulse {
        background: rgba(59, 130, 246, 0.12);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #60a5fa;
    }
    .badge-step {
        background: rgba(249, 115, 22, 0.12);
        border: 1px solid rgba(249, 115, 22, 0.3);
        color: #fb923c;
    }
    .badge-level {
        background: rgba(6, 182, 212, 0.12);
        border: 1px solid rgba(6, 182, 212, 0.3);
        color: #22d3ee;
    }
    .badge-numeric {
        background: rgba(20, 184, 166, 0.12);
        border: 1px solid rgba(20, 184, 166, 0.3);
        color: #2dd4bf;
    }

    .settings-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #9ca3af;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .settings-btn:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(255, 255, 255, 0.18);
        color: #fff;
    }

    /* Popover Flotante */
    .popover-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 40;
    }

    .selector-popover {
        position: absolute;
        top: 44px;
        right: 12px;
        width: 236px;
        background: #0e0e14;
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.85);
        z-index: 50;
    }

    .popover-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        padding-bottom: 6px;
    }

    .popover-title {
        font-family: "Outfit", sans-serif;
        font-size: 11px;
        font-weight: 700;
        color: #f3f4f6;
    }

    .popover-close {
        background: transparent;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .popover-close:hover {
        color: #fff;
    }

    .popover-section-label {
        font-family: "Outfit", sans-serif;
        font-size: 8px;
        color: #4b5563;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.08em;
        margin-bottom: 2px;
    }

    .metrics-checkbox-list {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-height: 240px;
        overflow-y: auto;
        padding-right: 2px;
    }

    /* Scrollbar personalizada para popover */
    .metrics-checkbox-list::-webkit-scrollbar {
        width: 3px;
    }
    .metrics-checkbox-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 1.5px;
    }

    .metric-checkbox-item {
        display: flex;
        align-items: center;
        padding: 5px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        background: rgba(255, 255, 255, 0.015);
        border: 1px solid rgba(255, 255, 255, 0.02);
        position: relative;
    }

    .metric-checkbox-item input {
        display: none; /* Esconder checkbox nativo */
    }

    .checkbox-custom {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        border: 1px solid rgba(255, 255, 255, 0.25);
        margin-right: 8px;
        display: inline-block;
        transition: all 0.15s ease;
        flex-shrink: 0;
    }

    .metric-name-text {
        font-family: "Inter", sans-serif;
        font-size: 10px;
        color: #9ca3af;
        transition: color 0.15s ease;
    }

    .metric-checkbox-item:hover:not(.disabled) {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.08);
    }

    .metric-checkbox-item:hover:not(.disabled) .metric-name-text {
        color: #fff;
    }

    .metric-checkbox-item.active .metric-name-text {
        color: #fff;
        font-weight: 600;
    }

    .metric-checkbox-item.disabled {
        opacity: 0.3;
        cursor: not-allowed;
        background: transparent;
    }

    .disabled-badge {
        position: absolute;
        right: 6px;
        font-family: "Outfit", sans-serif;
        font-size: 7px;
        font-weight: 800;
        background: rgba(239, 68, 68, 0.18);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444;
        padding: 0.5px 4px;
        border-radius: 3px;
        text-transform: uppercase;
    }

    .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
    }

    .popover-controls-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .smoothing-options {
        display: flex;
        gap: 3px;
        margin-top: 3px;
    }

    .smoothing-btn {
        flex: 1;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: #888;
        padding: 4px 0;
        border-radius: 5px;
        cursor: pointer;
        font-size: 8px;
        font-family: "Inter", sans-serif;
        transition: all 0.15s ease;
    }

    .smoothing-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ccc;
    }

    .smoothing-btn.active {
        background: #00ff88;
        color: #050507;
        border-color: #00ff88;
        font-weight: 700;
    }

    .action-btn {
        background: rgba(255, 255, 255, 0.05);
        color: #e5e7eb;
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 6px;
        border-radius: 6px;
        font-weight: 700;
        cursor: pointer;
        font-size: 9px;
        font-family: "Outfit", sans-serif;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.18);
        color: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .mini-style-edit-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        margin-left: auto;
        border-radius: 4px;
        transition: all 0.15s ease;
    }

    .mini-style-edit-btn:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
    }

    .style-customizer-panel {
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 2px;
        margin-bottom: 4px;
        box-sizing: border-box;
    }

    .customizer-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .customizer-label {
        font-family: "Outfit", sans-serif;
        font-size: 8px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        font-weight: 700;
    }

    .color-picker-input {
        background: transparent;
        border: none;
        width: 24px;
        height: 18px;
        cursor: pointer;
        padding: 0;
    }

    .width-slider {
        flex: 1;
        max-width: 90px;
        accent-color: #00ff88;
        height: 3px;
        cursor: pointer;
    }

    .style-toggle-buttons {
        display: flex;
        gap: 4px;
    }

    .style-toggle-btn {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: #888;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 7px;
        font-family: "Inter", sans-serif;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .style-toggle-btn.active {
        background: rgba(0, 255, 136, 0.12);
        border-color: #00ff88;
        color: #00ff88;
        font-weight: 700;
    }
</style>
