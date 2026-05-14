<script lang="ts">
    import { onMount } from 'svelte';
    import { traceManager, type Trace } from '$lib/stores/traceManager.svelte';

    interface Props {
        id: string;
    }

    let { id }: Props = $props();

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    
    let metric = $state('Magnitude'); // 'Magnitude', 'Phase', 'RTA', 'Coherence'
    let smoothing = $state(1/48); // 1/3, 1/12, 1/48
    let coherenceThreshold = $state(0.5);
    let showSelector = $state(false);

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
        if (freq < freqMin) return 0;
        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const logFreq = Math.log10(freq);
        return ((logFreq - logMin) / (logMax - logMin)) * width;
    }

    function xToFreq(x: number, width: number): number {
        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const logFreq = (x / width) * (logMax - logMin) + logMin;
        return Math.pow(10, logFreq);
    }

    function valToY(val: number, height: number): number {
        let min = dbMin, max = dbMax;
        if (metric === 'Phase') { min = -180; max = 180; }
        else if (metric === 'Coherence') { min = 0; max = 1; }
        
        const range = max - min;
        const normalized = (val - min) / range;
        return height - normalized * height;
    }

    function yToVal(y: number, height: number): number {
        let min = dbMin, max = dbMax;
        if (metric === 'Phase') { min = -180; max = 180; }
        else if (metric === 'Coherence') { min = 0; max = 1; }
        
        const range = max - min;
        return min + (1 - y / height) * range;
    }

    /**
     * Aplica suavizado fraccional de octava.
     */
    function smoothData(data: Float32Array, octaveFraction: number): Float32Array {
        if (octaveFraction === 0) return data;
        const smoothed = new Float32Array(data.length);
        const sr = 48000; // Asumido
        
        for (let i = 0; i < data.length; i++) {
            const freq = (i * sr / 2) / data.length;
            const bandwidth = freq * (Math.pow(2, octaveFraction / 2) - Math.pow(2, -octaveFraction / 2));
            const binWidth = (sr / 2) / data.length;
            const windowSize = Math.max(1, Math.round(bandwidth / binWidth));
            
            let sum = 0;
            let count = 0;
            for (let j = Math.max(0, i - windowSize); j <= Math.min(data.length - 1, i + windowSize); j++) {
                sum += data[j];
                count++;
            }
            smoothed[i] = sum / count;
        }
        return smoothed;
    }

    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        // 1. Dibujar Grilla
        drawGrid(ctx, width, height);

        // 2. Filtrar y dibujar trazos del manager
        const relevantTraces = traceManager.traces.filter(t => t.visible && (t.metric === metric || metric === 'Magnitude'));
        
        relevantTraces.forEach(trace => {
            const data = smoothData(trace.data, smoothing);
            drawTrace(ctx, data, trace, width, height);
        });

        // 3. Dibujar Crosshair
        if (showCrosshair) {
            drawCrosshair(ctx, width, height);
        }

        requestAnimationFrame(draw);
    }

    function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        // Frecuencias
        [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(f => {
            const x = freqToX(f, width);
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        });
        // Niveles
        for (let db = dbMin; db <= dbMax; db += 10) {
            const y = valToY(db, height);
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
    }

    function drawTrace(ctx: CanvasRenderingContext2D, data: Float32Array, trace: Trace, width: number, height: number) {
        ctx.strokeStyle = trace.color;
        ctx.lineWidth = 2;
        if (trace.style === 'dashed') ctx.setLineDash([5, 5]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        const sr = 48000;
        for (let i = 0; i < data.length; i++) {
            const freq = (i * sr / 2) / data.length;
            if (freq < freqMin) continue;
            if (freq > freqMax) break;

            const x = freqToX(freq, width);
            const y = valToY(data[i] + trace.offsetY, height);

            // Coherence Blanking (Simulado si no hay array de coherencia)
            // En una impl real, chequearíamos el array de coherencia del traceManager
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    function drawCrosshair(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([2, 2]);
        
        ctx.beginPath();
        ctx.moveTo(mouseX, 0); ctx.lineTo(mouseX, height);
        ctx.moveTo(0, mouseY); ctx.lineTo(width, mouseY);
        ctx.stroke();
        
        const freq = xToFreq(mouseX, width);
        const val = yToVal(mouseY, height);
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(`${Math.round(freq)} Hz / ${val.toFixed(1)} ${metric === 'Phase' ? '°' : 'dB'}`, mouseX + 5, mouseY - 5);
    }

    function handleMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        showCrosshair = true;
    }

    onMount(() => {
        const resize = () => {
            if (container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        };
        window.addEventListener('resize', resize);
        resize();
        draw();
        return () => window.removeEventListener('resize', resize);
    });
</script>

<div class="quadrant-container" bind:this={container} onmousemove={handleMouseMove} onmouseleave={() => showCrosshair = false}>
    <canvas bind:this={canvas}></canvas>
    
    <div class="quadrant-header">
        <button class="metric-selector" onclick={() => showSelector = !showSelector}>
            {metric} ▾
        </button>
        <span class="id-badge">{id}</span>
    </div>

    {#if showSelector}
        <div class="selector-modal">
            {#each ['Magnitude', 'Phase', 'RTA', 'Coherence'] as m}
                <button 
                    class:active={metric === m} 
                    onclick={() => { metric = m; showSelector = false; }}
                >
                    {m}
                </button>
            {/each}
            <div class="divider"></div>
            <label>Smoothing</label>
            <div class="smoothing-options">
                {#each [0, 1/3, 1/12, 1/48] as s}
                    <button 
                        class:active={smoothing === s} 
                        onclick={() => smoothing = s}
                    >
                        {s === 0 ? 'Off' : `1/${Math.round(1/s)}`}
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>

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

    .quadrant-header {
        position: absolute;
        top: 8px;
        left: 8px;
        right: 8px;
        display: flex;
        justify-content: space-between;
        pointer-events: none;
    }

    .metric-selector {
        pointer-events: auto;
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 0.75rem;
        cursor: pointer;
        backdrop-filter: blur(4px);
    }

    .id-badge {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.4);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.65rem;
        font-weight: bold;
    }

    .selector-modal {
        position: absolute;
        top: 40px;
        left: 8px;
        background: #1a1a20;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 10;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }

    .selector-modal button {
        background: transparent;
        border: none;
        color: #aaa;
        padding: 6px 16px;
        text-align: left;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
    }

    .selector-modal button:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
    }

    .selector-modal button.active {
        background: #3b82f6;
        color: #fff;
    }

    .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 4px 0;
    }

    .selector-modal label {
        font-size: 0.65rem;
        color: #666;
        text-transform: uppercase;
        margin: 4px 8px;
    }

    .smoothing-options {
        display: flex;
        gap: 2px;
    }

    .smoothing-options button {
        padding: 4px 8px;
        font-size: 0.7rem;
    }
</style>
