<script lang="ts">
	import { onMount } from 'svelte';
	import { detectTier } from '$lib/utils/tierDetector';
	import { getAudioProvider } from '$lib/hal';
	import type { AudioBufferChunk } from '$lib/hal/types';
	import RTA from '../components/RTA.svelte';

	let tier = $state<string | null>(null);
	let isCapturing = $state(false);
	let audioData = $state(new Float32Array(512));
	
	const provider = getAudioProvider();

	onMount(() => {
		tier = detectTier();
	});

	async function toggleCapture() {
		if (isCapturing) {
			provider.stopCapture();
			isCapturing = false;
		} else {
			try {
				await provider.startCapture({
					onAudioData: (data: AudioBufferChunk) => {
						audioData = data;
					}
				});
				isCapturing = true;
			} catch (error) {
				console.error('Error al iniciar captura:', error);
				alert('No se pudo acceder al micrófono.');
			}
		}
	}
</script>

<main class="min-h-screen bg-white text-slate-900 p-6 md:p-12 flex flex-col items-center gap-10">
	<header class="max-w-2xl w-full text-center space-y-4">
		<h1 class="text-5xl font-black tracking-tighter text-black uppercase">
			Asistente Audio <span class="text-orange-600">Proactivo</span>
		</h1>
		<div class="inline-block px-4 py-1 bg-slate-100 rounded-full text-xs font-bold tracking-widest text-slate-500 uppercase">
			Hardware Status: <span class="text-black">{tier ?? 'Detectando...'}</span>
		</div>
	</header>

	<section class="w-full max-w-5xl space-y-6">
		<RTA {audioData} />
	</section>

	<footer class="flex flex-col items-center gap-4">
		<button
			onclick={toggleCapture}
			class="group relative px-12 py-6 rounded-full font-black text-xl tracking-widest uppercase transition-all duration-300 active:scale-95 shadow-2xl
			{isCapturing 
				? 'bg-red-600 text-white hover:bg-red-700' 
				: 'bg-black text-white hover:bg-slate-800'}"
		>
			<span class="relative z-10">
				{isCapturing ? 'Detener Análisis' : 'Iniciar Captura'}
			</span>
			<div class="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
		</button>
		
		<p class="text-slate-400 text-sm font-medium">
			{isCapturing ? 'Analizando flujo de audio en tiempo real...' : 'Listo para procesar audio de alta fidelidad.'}
		</p>
	</footer>
</main>

<style>
	:global(body) {
		background-color: white;
		margin: 0;
		font-family: system-ui, -apple-system, sans-serif;
	}
</style>
