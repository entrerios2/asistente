<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface AudioDevice {
		id: string;
		name: string;
		backend: string;
		direction: 'input' | 'output';
	}

	let devices = $state<AudioDevice[]>([]);
	let selectedInput = $state('');
	let selectedOutput = $state('');

	const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

	onMount(async () => {
		if (isTauri) {
			try {
				devices = await invoke('list_audio_devices');
			} catch (err) {
				console.error('Fallo al obtener dispositivos de audio:', err);
			}
		}
	});

	async function updateInput(e: Event) {
		const id = (e.target as HTMLSelectElement).value;
		selectedInput = id;
		if (isTauri) await invoke('select_audio_device', { id, direction: 'input' });
	}

	async function updateOutput(e: Event) {
		const id = (e.target as HTMLSelectElement).value;
		selectedOutput = id;
		if (isTauri) await invoke('select_audio_device', { id, direction: 'output' });
	}

	// Agrupación de dispositivos por Backend (ASIO, WASAPI, etc)
	const backends = $derived([...new Set(devices.map(d => d.backend))]);
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl p-6 bg-slate-50 rounded-2xl border border-slate-200">
	<!-- Selector de Entrada -->
	<div class="space-y-2">
		<label for="input-device" class="block text-xs font-bold uppercase tracking-widest text-slate-400">
			Entrada (Micrófono / Interfaz)
		</label>
		<select
			id="input-device"
			bind:value={selectedInput}
			onchange={updateInput}
			class="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-medium focus:border-orange-500 outline-none transition-colors"
		>
			<option value="">Seleccionar dispositivo...</option>
			{#each backends as backend}
				<optgroup label={backend}>
					{#each devices.filter(d => d.backend === backend && d.direction === 'input') as device}
						<option value={device.id}>{device.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>

	<!-- Selector de Salida -->
	<div class="space-y-2">
		<label for="output-device" class="block text-xs font-bold uppercase tracking-widest text-slate-400">
			Salida (Monitores / Auriculares)
		</label>
		<select
			id="output-device"
			bind:value={selectedOutput}
			onchange={updateOutput}
			class="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-medium focus:border-orange-500 outline-none transition-colors"
		>
			<option value="">Seleccionar dispositivo...</option>
			{#each backends as backend}
				<optgroup label={backend}>
					{#each devices.filter(d => d.backend === backend && d.direction === 'output') as device}
						<option value={device.id}>{device.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>
</div>

{#if !isTauri}
	<p class="text-xs text-slate-400 mt-2 italic">
		* Los drivers ASIO/Nativos solo están disponibles en la versión de escritorio.
	</p>
{/if}
