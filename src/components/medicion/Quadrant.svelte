<script lang="ts">
    import { onMount } from 'svelte';
    import { traceManager, type Trace } from '$lib/stores/traceManager.svelte';

    interface Props {
        id: string;
    }

    let { id }: Props = $props();

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    
    let metric = $state('Magnitud'); 
    let smoothing = $state(1/48); 
    let coherenceThreshold = $state(0.5);
    let coherenceMasking = $state(false);
    let showSelector = $state(false);

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
        
        const range = max - min;
        return min + (1 - adjustedY / height) * range;
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
        const relevantTraces = traceManager.traces.filter(t => t.visible && (t.metric === metric || metric === 'Magnitud'));
        
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
        let first = true;
        for (let i = 0; i < data.length; i++) {
            const freq = (i * sr / 2) / data.length;
            if (freq < freqMin) continue;
            if (freq > freqMax) break;

            const x = freqToX(freq, width);
            const y = valToY(data[i] + trace.offsetY, height);

            if (first) {
                ctx.moveTo(x, y);
                first = false;
            } else {
                ctx.lineTo(x, y);
            }
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
        ctx.fillText(`${Math.round(freq)} Hz / ${val.toFixed(1)} ${metric === 'Fase' ? '°' : 'dB'}`, mouseX + 5, mouseY - 5);
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        if (e.shiftKey) {
            scaleX *= zoomFactor;
        } else if (e.ctrlKey || e.metaKey) {
            scaleY *= zoomFactor;
        }
    }

    function handleMouseDown(e: MouseEvent) {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }

    function handleMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        showCrosshair = true;

        if (isDragging) {
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            offsetX += dx;
            offsetY += dy;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    }

    function handleMouseUp() {
        isDragging = false;
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

<div 
    class="quadrant-container" 
    bind:this={container} 
    onmousemove={handleMouseMove} 
    onmousedown={handleMouseDown}
    onmouseup={handleMouseUp}
    onmouseleave={() => { showCrosshair = false; handleMouseUp(); }}
    onwheel={handleWheel}
>
    <canvas bind:this={canvas}></canvas>
    
    <div class="quadrant-header">
        <button class="settings-btn" onclick={() => showSelector = !showSelector} aria-label="Ajustes">
            ⚙️
        </button>
        <span class="id-badge">{id} - {metric}</span>
    </div>

    {#if showSelector}
        <div class="selector-modal">
            <header>
                <span>Configuración de cuadrante</span>
                <button onclick={() => showSelector = false}>×</button>
            </header>

            <label>Métrica</label>
            <div class="metrics-grid">
                {#each ['Magnitud', 'Fase', 'RTA', 'Coherencia', 'Espectro', 'Nivel', 'Respuesta al impulso', 'Retardo de grupo'] as m}
                    <button 
                        class:active={metric === m} 
                        onclick={() => metric = m}
                    >
                        {m}
                    </button>
                {/each}
            </div>

            <div class="divider"></div>
            
            <label>Suavizado de octava</label>
            <div class="smoothing-options">
                {#each [0, 1/3, 1/6, 1/12, 1/24, 1/48] as s}
                    <button 
                        class:active={smoothing === s} 
                        onclick={() => smoothing = s}
                    >
                        {s === 0 ? 'Desactivado' : `1/${Math.round(1/s)}`}
                    </button>
                {/each}
            </div>

            <div class="divider"></div>

            <label class="checkbox-label">
                <input type="checkbox" bind:checked={coherenceMasking} />
                Ocultamiento por coherencia
            </label>

            {#if metric === 'Fase'}
                <button class="action-btn">Desenvolvimiento de fase</button>
            {/if}

            {#if metric === 'Respuesta al impulso' || metric === 'RTA'}
                <button class="action-btn" onclick={() => console.log('Modal FFT abierto')}>
                    Ajustes profundos
                </button>
            {/if}

            <button class="reset-btn" onclick={() => { scaleX=1; scaleY=1; offsetX=0; offsetY=0; }}>
                Restablecer vista
            </button>
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

    .settings-btn {
        pointer-events: auto;
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
    }

    .id-badge {
        background: rgba(0, 0, 0, 0.6);
        color: rgba(255, 255, 255, 0.6);
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        backdrop-filter: none;
    }

    .selector-modal {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #1a1a20;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        z-index: 100;
        box-sizing: border-box;
        overflow-y: auto;
    }

    .selector-modal header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .selector-modal header span {
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.9rem;
        color: #3b82f6;
    }

    .selector-modal header button {
        background: none;
        border: none;
        color: #fff;
        font-size: 1.5rem;
        cursor: pointer;
    }

    .selector-modal label {
        font-size: 0.7rem;
        color: #888;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.5px;
    }

    .metrics-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    .selector-modal button:not(.reset-btn):not(.action-btn) {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: #aaa;
        padding: 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.8rem;
        text-align: left;
    }

    .selector-modal button.active {
        background: #3b82f6;
        color: #fff;
        border-color: #3b82f6;
    }

    .smoothing-options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        color: #ccc !important;
        text-transform: none !important;
    }

    .action-btn {
        background: #333;
        color: #fff;
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
    }

    .reset-btn {
        margin-top: auto;
        background: #ef4444;
        color: #fff;
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
    }
</style>

