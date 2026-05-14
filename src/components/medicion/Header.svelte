<script lang="ts">
    import { onMount } from 'svelte';

    let currentTime = $state(new Date().toLocaleTimeString('es-ES'));
    let isDarkMode = $state(true);

    onMount(() => {
        const timer = setInterval(() => {
            currentTime = new Date().toLocaleTimeString('es-ES');
        }, 1000);
        return () => clearInterval(timer);
    });

    function toggleTheme() {
        isDarkMode = !isDarkMode;
        document.documentElement.classList.toggle('dark', isDarkMode);
    }
</script>

<header class="global-header">
    <div class="header-left">
        <select class="hal-selector">
            <option>Interfaz Web Audio</option>
            <option>Backend Tauri</option>
        </select>
    </div>

    <div class="header-center">
        <span class="status-indicator">● CONECTADO</span>
        <span class="spl-meter">102 dB SPL</span>
    </div>

    <div class="header-right">
        <button class="theme-switch" onclick={toggleTheme} aria-label="Cambiar tema">
            <span class="icon">{isDarkMode ? '🌙' : '☀️'}</span>
            <div class="switch-track" class:active={isDarkMode}>
                <div class="switch-thumb"></div>
            </div>
        </button>
        <span class="clock">{currentTime}</span>
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

    .hal-selector {
        background: #1a1a20;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        outline: none;
    }

    .status-indicator {
        color: #00ff88;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 1px;
    }

    .spl-meter {
        font-family: monospace;
        font-size: 1.1rem;
        font-weight: 700;
        color: #3b82f6;
    }

    .theme-switch {
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        color: inherit;
    }

    .switch-track {
        width: 36px;
        height: 18px;
        background: #333;
        border-radius: 9px;
        position: relative;
        transition: background 0.2s;
    }

    .switch-track.active {
        background: #3b82f6;
    }

    .switch-thumb {
        width: 14px;
        height: 14px;
        background: #fff;
        border-radius: 50%;
        position: absolute;
        top: 2px;
        left: 2px;
        transition: transform 0.2s;
    }

    .switch-track.active .switch-thumb {
        transform: translateX(18px);
    }

    .clock {
        font-size: 0.9rem;
        color: #888;
        min-width: 80px;
        text-align: right;
    }
</style>
