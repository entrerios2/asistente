<script lang="ts">
    import { onMount } from 'svelte';
    import { calibrationStore } from '$lib/stores/calibrationStore';

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    
    // Configuración de visualización
    const freqMin = 20;
    const freqMax = 20000;
    const dbMin = -30;
    const dbMax = 30;

    /**
     * Mapea frecuencia a coordenada X (Escala Logarítmica)
     */
    function freqToX(freq: number, width: number): number {
        if (freq < freqMin) return 0;
        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const logFreq = Math.log10(freq);
        return ((logFreq - logMin) / (logMax - logMin)) * width;
    }

    /**
     * Mapea dB a coordenada Y (Escala Lineal)
     */
    function dbToY(db: number, height: number): number {
        const range = dbMax - dbMin;
        const normalized = (db - dbMin) / range;
        return height - normalized * height;
    }

    function draw() {
        if (!canvas || !calibrationStore.measuredCurve) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        // 1. Dibujar Grilla (Frecuencias Logarítmicas)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(f => {
            const x = freqToX(f, width);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        });

        // 2. Dibujar Trazo: Medición Cruda (Gris/Azul)
        drawCurve(ctx, calibrationStore.measuredCurve, 'rgba(100, 150, 200, 0.5)', 2);

        // 3. Dibujar Trazo: Respuesta Prevista (Verde Brillante)
        drawCurve(ctx, calibrationStore.predictedCurve, '#00ff88', 3);

        requestAnimationFrame(draw);
    }

    function drawCurve(ctx: CanvasRenderingContext2D, data: Float32Array, color: string, lineWidth: number) {
        const { width, height } = canvas;
        const bins = data.length;
        const sampleRate = calibrationStore.sampleRate;

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        for (let i = 0; i < bins; i++) {
            const freq = (i * (sampleRate / 2)) / bins;
            if (freq < freqMin) continue;
            if (freq > freqMax) break;

            const x = freqToX(freq, width);
            const y = dbToY(data[i], height);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
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

    // Semáforo de Coherencia (Promedio simplificado)
    const avgCoherence = $derived(0.85); // TODO: Leer de un store de coherencia real
</script>

<div class="trace-math-container" bind:this={container}>
    <canvas bind:this={canvas}></canvas>
    
    <div class="overlay-info">
        <div class="coherence-meter">
            <span class="label">COHERENCIA</span>
            <div class="bar-bg">
                <div 
                    class="bar-fill" 
                    style:width="{avgCoherence * 100}%"
                    style:background-color={avgCoherence > 0.8 ? '#00ff88' : avgCoherence > 0.5 ? '#ffcc00' : '#ff4444'}
                ></div>
            </div>
        </div>
    </div>
</div>

<style>
    .trace-math-container {
        position: relative;
        width: 100%;
        height: 400px;
        background: #121212;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }

    canvas {
        width: 100%;
        height: 100%;
        display: block;
    }

    .overlay-info {
        position: absolute;
        bottom: 16px;
        left: 16px;
        right: 16px;
        display: flex;
        justify-content: flex-start;
        pointer-events: none;
    }

    .coherence-meter {
        background: rgba(0, 0, 0, 0.6);
        padding: 8px 12px;
        border-radius: 8px;
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        gap: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .label {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
        color: rgba(255, 255, 255, 0.6);
    }

    .bar-bg {
        width: 120px;
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
    }

    .bar-fill {
        height: 100%;
        transition: width 0.3s ease, background-color 0.3s ease;
    }
</style>
