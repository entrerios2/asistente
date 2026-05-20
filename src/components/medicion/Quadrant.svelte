<script lang="ts">
    import { onMount } from 'svelte';
    import { traceManager, type Trace } from '$lib/stores/traceManager.svelte';

    interface Props {
        id: string;
    }

    let { id }: Props = $props();

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    let settingsBtn: HTMLButtonElement;
    
    let metric = $state('Magnitud'); 
    let smoothing = $state(1/48); 
    let showSelector = $state(false);
    let popoverPos = $state({ top: 0, left: 0 });

    // Zoom & Pan state
    let scaleX = $state(1);
    let scaleY = $state(1);
    let offsetX = $state(0);
    let offsetY = $state(0);
    let isDragging = $state(false);
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Crosshair state
    let mouseX = $state(0);
    let mouseY = $state(0);
    let showCrosshair = $state(false);

    // Configuración de visualización
    const freqMin = 20;
    const freqMax = 20000;
    const dbMin = -30;
    const dbMax = 30;

    function freqToX(freq: number, width: number): number {
        if (freq < freqMin) return offsetX;
        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const logFreq = Math.log10(freq);
        const base = ((logFreq - logMin) / (logMax - logMin)) * width;
        return base * scaleX + offsetX;
    }

    function xToFreq(x: number, width: number): number {
        const adjustedX = (x - offsetX) / scaleX;
        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const logFreq = (adjustedX / width) * (logMax - logMin) + logMin;
        return Math.pow(10, logFreq);
    }

    function valToY(val: number, height: number): number {
        let min = dbMin, max = dbMax;
        if (metric === 'Fase') { min = -180; max = 180; }
        else if (metric === 'Coherencia') { min = 0; max = 1; }
        else if (metric === 'RTA') { min = -120; max = 10; }
        
        const range = max - min;
        const normalized = (val - min) / range;
        const base = height - normalized * height;
        return base * scaleY + offsetY;
    }

    function yToVal(y: number, height: number): number {
        const adjustedY = (y - offsetY) / scaleY;
        let min = dbMin, max = dbMax;
        if (metric === 'Fase') { min = -180; max = 180; }
        else if (metric === 'Coherencia') { min = 0; max = 1; }
        else if (metric === 'RTA') { min = -120; max = 10; }
        
        const range = max - min;
        return min + (1 - adjustedY / height) * range;
    }

    // Caché reactivo Svelte 5 para respuesta en frecuencia del EQ (Playground)
    const eqResponseCache = $derived.by(() => {
        const size = 4096; // Resolucion correspondiente a la mitad de 8192 FFT
        const cache = new Float32Array(size);
        const sr = 48000;
        for (let i = 0; i < size; i++) {
            const freq = (i * sr / 2) / size;
            let totalGain = 0;
            for (let b = 0; b < traceManager.eqBands.length; b++) {
                const band = traceManager.eqBands[b];
                const fo = band.freq;
                const G = band.gain;
                const Q = band.q;
                
                // Aproximación de campana (Peaking Filter)
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

    /**
     * Decimación logarítmica (Logarithmic Binning) con prefix sums para query O(1).
     * Reduce 4096 bins de FFT a 400 puntos logarítmicos óptimos para pantalla.
     */
    function smoothDataLog(data: Float32Array, octaveFraction: number): DataPoint[] {
        const sr = 48000;
        const numPoints = 400; // Suficientes puntos para visualización perfecta en cualquier resolución
        const points: DataPoint[] = [];

        // 1. Prefix Sums para cálculo instantáneo del promedio de cualquier ventana
        const prefixSums = new Float32Array(data.length + 1);
        for (let i = 0; i < data.length; i++) {
            prefixSums[i + 1] = prefixSums[i] + data[i];
        }

        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const binWidth = (sr / 2) / data.length;

        for (let i = 0; i < numPoints; i++) {
            const logFreq = logMin + (i / (numPoints - 1)) * (logMax - logMin);
            const freq = Math.pow(10, logFreq);

            // Ancho de banda de la ventana logarítmica (fracción de octava)
            const frac = octaveFraction > 0 ? octaveFraction : 1/48;
            const f_start = freq * Math.pow(2, -frac / 2);
            const f_end = freq * Math.pow(2, frac / 2);

            const startBin = Math.max(0, Math.round(f_start / binWidth));
            const endBin = Math.min(data.length - 1, Math.round(f_end / binWidth));

            let val = 0;
            if (endBin >= startBin) {
                const sum = prefixSums[endBin + 1] - prefixSums[startBin];
                val = sum / (endBin - startBin + 1);
            } else {
                const binIdx = Math.min(data.length - 1, Math.round(freq / binWidth));
                val = data[binIdx];
            }

            points.push({ freq, val });
        }

        return points;
    }

    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        ctx.clearRect(0, 0, width, height);

        // 1. Grilla
        drawGrid(ctx, width, height);

        // 2. Trazo en Vivo (Rojo)
        const liveTrace = traceManager.traces.find(t => t.id === 'live-1' && t.visible);
        if (liveTrace) {
            const points = smoothDataLog(liveTrace.data, smoothing);
            drawPath(ctx, points, width, height, '#ff4444', 2);

            // 3. Trazo Predictivo (Cian punteado) = Live + EQ
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                const x = freqToX(p.freq, width);
                const eqGain = getEQResponseCached(p.freq);
                const y = valToY(p.val + eqGain, height);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = '#00ffff';
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 4. Trazo EQ (Verde)
        ctx.beginPath();
        for (let f = freqMin; f <= freqMax; f *= 1.05) {
            const x = freqToX(f, width);
            const y = valToY(getEQResponseCached(f), height);
            if (f === freqMin) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 5. Otros trazos (Snapshots)
        traceManager.traces.filter(t => t.type === 'snapshot' && t.visible).forEach(t => {
            const points = smoothDataLog(t.data, smoothing);
            drawPath(ctx, points, width, height, t.color, 1.5, t.style === 'dashed');
        });

        if (showCrosshair) drawCrosshair(ctx, width, height);

        requestAnimationFrame(draw);
    }

    function drawPath(ctx: CanvasRenderingContext2D, points: DataPoint[], width: number, height: number, color: string, lw: number, dashed = false) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        if (dashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
        ctx.beginPath();
        let first = true;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const x = freqToX(p.freq, width);
            const y = valToY(p.val, height);
            if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillStyle = '#666';
        ctx.font = '10px Inter';
        [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(f => {
            const x = freqToX(f, width);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
            ctx.fillText(f >= 1000 ? `${f/1000}k` : `${f}`, x + 2, height - 5);
        });

        let min = dbMin, max = dbMax;
        let step = 10;
        let unit = 'dB';
        if (metric === 'Fase') { min = -180; max = 180; step = 60; unit = '°'; }
        else if (metric === 'Coherencia') { min = 0; max = 1; step = 0.2; unit = ''; }
        else if (metric === 'RTA') { min = -120; max = 10; step = 20; unit = 'dB'; }

        for (let val = min; val <= max; val += step) {
            const y = valToY(val, height);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
            ctx.fillText(`${val}${unit}`, width - 35, y - 2);
        }
    }

    function drawCrosshair(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(mouseX, 0); ctx.lineTo(mouseX, height);
        ctx.moveTo(0, mouseY); ctx.lineTo(width, mouseY);
        ctx.stroke();
        ctx.setLineDash([]);
        const freq = xToFreq(mouseX, width);
        const val = yToVal(mouseY, height);
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.round(freq)} Hz / ${val.toFixed(1)} dB`, mouseX + 5, mouseY - 5);
    }

    function toggleSelector() {
        showSelector = !showSelector;
        if (showSelector && settingsBtn) {
            const rect = settingsBtn.getBoundingClientRect();
            popoverPos = { top: rect.bottom + 5, left: rect.left };
        }
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        if (e.shiftKey) scaleX *= factor;
        else if (e.ctrlKey || e.metaKey) scaleY *= factor;
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

    onMount(() => {
        const ctx = canvas.getContext('2d');
        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = container.clientWidth;
            const h = container.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx?.scale(dpr, dpr);
        };
        window.addEventListener('resize', resize);
        resize();
        draw();
        return () => window.removeEventListener('resize', resize);
    });
</script>

<div 
    class="quadrant-container" 
    bind:this={container} 
    onmousemove={handleMouseMove} 
    onmousedown={(e) => { isDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; }}
    onmouseup={() => isDragging = false}
    onmouseleave={() => { showCrosshair = false; isDragging = false; }}
    onwheel={handleWheel}
>
    <canvas bind:this={canvas}></canvas>
    
    <button bind:this={settingsBtn} class="settings-btn" onclick={toggleSelector}>
        <span class="material-symbols-outlined">settings</span>
    </button>
</div>

{#if showSelector}
    <div class="selector-popover" style="top: {popoverPos.top}px; left: {popoverPos.left}px;">
        <label>Métrica</label>
        <div class="metrics-grid">
            {#each ['Magnitud', 'Fase', 'RTA', 'Coherencia'] as m}
                <button class:active={metric === m} onclick={() => metric = m}>{m}</button>
            {/each}
        </div>
        <div class="divider"></div>
        <label>Suavizado</label>
        <div class="smoothing-options">
            {#each [0, 1/3, 1/12, 1/48] as s}
                <button class:active={smoothing === s} onclick={() => smoothing = s}>
                    {s === 0 ? 'Off' : `1/${Math.round(1/s)}`}
                </button>
            {/each}
        </div>
        <button class="reset-btn" onclick={() => { scaleX=1; scaleY=1; offsetX=0; offsetY=0; }}>
            Reiniciar Vista
        </button>
    </div>
{/if}

<style>
    .quadrant-container {
        position: relative;
        background: #0f0f12;
        border: 1px solid rgba(255, 255, 255, 0.05);
        overflow: hidden;
        cursor: crosshair;
    }

    canvas {
        display: block;
        width: 100%;
        height: 100%;
    }

    .settings-wrapper {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 200;
        pointer-events: auto;
    }

    .settings-btn {
        background: rgba(10, 10, 12, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .selector-popover {
        position: absolute;
        top: 40px;
        left: 0;
        width: 220px;
        background: #1a1a20;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        z-index: 300;
    }

    .selector-popover label {
        font-size: 0.65rem;
        color: #666;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.5px;
    }

    .metrics-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
    }

    .selector-popover button:not(.reset-btn):not(.action-btn) {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: #aaa;
        padding: 6px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.75rem;
        text-align: left;
    }

    .selector-popover button.active {
        background: #3b82f6;
        color: #fff;
        border-color: #3b82f6;
    }

    .smoothing-options {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: #ccc !important;
        text-transform: none !important;
        font-size: 0.8rem !important;
    }

    .action-btn {
        background: #333;
        color: #fff;
        border: none;
        padding: 8px;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
        font-size: 0.8rem;
    }

    .reset-btn {
        background: #ef4444;
        color: #fff;
        border: none;
        padding: 8px;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
        font-size: 0.8rem;
    }
</style>

