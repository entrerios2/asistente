<script lang="ts">
    import { onMount } from 'svelte';
    import { uiStore } from '$lib/stores/ui.svelte';

    let devices = $state<MediaDeviceInfo[]>([]);
    let selectedDevice = $state('');

    onMount(async () => {
        try {
            // Pedir permiso primero para obtener etiquetas reales
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            devices = allDevices.filter(d => d.kind === 'audioinput');
            if (devices.length > 0) selectedDevice = devices[0].deviceId;
        } catch (e) {
            console.error('Error enumerando dispositivos:', e);
        }
    });
</script>

<header class="global-header">
    <div class="header-left">
        <div class="selector-group">
            <span class="label">Micrófono</span>
            <select bind:value={selectedDevice} class="header-select">
                {#each devices as device}
                    <option value={device.deviceId}>{device.label || 'Micrófono desconocido'}</option>
                {/each}
            </select>
        </div>
    </div>

    <div class="header-center">
        <div class="selector-group">
            <span class="label">Cuadrícula</span>
            <select 
                value={uiStore.layout} 
                onchange={(e) => uiStore.setLayout((e.target as HTMLSelectElement).value)}
                class="header-select"
            >
                <option value="1x1">1x1 - Individual</option>
                <option value="2x1">2x1 - Doble</option>
                <option value="2x2">2x2 - Cuádruple</option>
                <option value="3x2">3x2 - Estudio</option>
            </select>
        </div>
    </div>

    <div class="header-right">
        <button class="icon-btn" onclick={() => uiStore.toggleTheme()} title="Cambiar tema">
            {uiStore.isDarkMode ? '🌙' : '☀️'}
        </button>
        <button 
            class="text-btn" 
            class:active={uiStore.showSnapshots}
            onclick={() => uiStore.toggleSnapshots()}
        >
            {uiStore.showSnapshots ? 'Ocultar instantáneas' : 'Mostrar instantáneas'}
        </button>
    </div>
</header>

<style>
    .global-header {
        height: 50px;
        background: #0a0a0c;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 1rem;
        color: #e0e0e0;
        font-family: 'Inter', sans-serif;
        box-sizing: border-box;
        flex-shrink: 0;
    }

    .header-left, .header-center, .header-right {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    .selector-group {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .label {
        font-size: 0.65rem;
        color: #666;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.5px;
    }

    .header-select {
        background: #1a1a20;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.8rem;
        outline: none;
        cursor: pointer;
    }

    .icon-btn {
        background: none;
        border: none;
        color: #fff;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: background 0.2s;
    }

    .icon-btn:hover {
        background: rgba(255, 255, 255, 0.05);
    }

    .text-btn {
        background: transparent;
        border: 1px solid #3b82f6;
        color: #3b82f6;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 0.75rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
    }

    .text-btn.active {
        background: #3b82f6;
        color: #fff;
    }
</style>
