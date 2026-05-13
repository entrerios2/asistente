<script lang="ts">
	import { Analyzer } from '$lib/dsp/Analyzer.svelte';
	
	let { audioData } = $props<{ audioData: Float32Array }>();
	let canvas: HTMLCanvasElement;
	
	// Instanciamos el analizador (DSP Engine)
	const analyzer = new Analyzer(2048);

	// Alimentamos el analizador cada vez que llegan datos nuevos
	$effect(() => {
		if (audioData && audioData.length > 0) {
			analyzer.processChunk(audioData);
		}
	});

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let frameId: number;

		const draw = () => {
			const width = canvas.width;
			const height = canvas.height;
			const spectrum = analyzer.spectrum;
			
			ctx.clearRect(0, 0, width, height);
			
			// Fondo premium
			ctx.fillStyle = '#0f172a';
			ctx.fillRect(0, 0, width, height);

			const minFreq = 20;
			const maxFreq = 22050;
			const sampleRate = 48000;
			const bins = spectrum.length;

			// Dibujamos las barras
			const barWidth = 4;
			const gap = 1;
			
			ctx.fillStyle = '#38bdf8'; // Azul eléctrico

			for (let i = 0; i < bins; i++) {
				const freq = (i * (sampleRate / 2)) / bins;
				if (freq < minFreq) continue;
				if (freq > maxFreq) break;

				// Escala Logarítmica para X
				const x = ((Math.log10(freq) - Math.log10(minFreq)) / 
						  (Math.log10(maxFreq) - Math.log10(minFreq))) * width;
				
				// Escala para Y (dBFS). Rango: -100dB a 0dB.
				const db = spectrum[i];
				const normalizedDb = Math.max(0, (db + 100) / 100); 
				const barHeight = normalizedDb * height;

				// Dibujar barra
				ctx.fillRect(x, height - barHeight, barWidth, barHeight);
			}

			frameId = requestAnimationFrame(draw);
		};

		draw();

		return () => {
			if (frameId) cancelAnimationFrame(frameId);
		};
	});
</script>

<div class="overflow-hidden rounded-xl border-2 border-slate-200 shadow-inner bg-slate-50">
	<canvas
		bind:this={canvas}
		class="w-full h-64 block"
		width="1200"
		height="400"
	></canvas>
</div>
