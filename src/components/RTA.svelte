<script lang="ts">
	let { audioData } = $props<{ audioData: Float32Array }>();
	let canvas: HTMLCanvasElement;

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let frameId: number;

		const draw = () => {
			const width = canvas.width;
			const height = canvas.height;
			
			ctx.clearRect(0, 0, width, height);
			ctx.fillStyle = '#f8fafc';
			ctx.fillRect(0, 0, width, height);

			ctx.beginPath();
			ctx.strokeStyle = '#0070f3';
			ctx.lineWidth = 3;
			ctx.lineJoin = 'round';

			const sliceWidth = width / audioData.length;
			let x = 0;

			for (let i = 0; i < audioData.length; i++) {
				const v = audioData[i];
				const y = (v * height) / 2 + height / 2;

				if (i === 0) {
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}

				x += sliceWidth;
			}

			ctx.stroke();
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
