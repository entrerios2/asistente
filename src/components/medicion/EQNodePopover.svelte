<script lang="ts">
    import { eqStore } from "$lib/stores/eqStore.svelte";
    import { filterSvgIcons } from "$lib/icons/filterIcons";
    import { filterTypeColors, filterTypeName } from "$lib/dsp/eqNodeIcons";

    let {
        nodeIndex,
        containerWidth,
        onClose,
    }: {
        nodeIndex: number;
        containerWidth: number;
        onClose: () => void;
    } = $props();

    const band = $derived(eqStore.activeBands[nodeIndex]);
    const color = $derived(filterTypeColors[band?.type] || 'var(--accent-yellow)');

    const filterTypes = ['peaking', 'low_shelf', 'high_shelf', 'lowpass', 'highpass', 'notch', 'bandpass'] as const;

    // Knob drag state
    let draggingKnob: string | null = $state(null);
    let knobStartY = 0;
    let knobStartValue = 0;

    function handleKnobDown(param: string, startVal: number) {
        return (e: MouseEvent) => {
            e.preventDefault();
            draggingKnob = param;
            knobStartY = e.clientY;
            knobStartValue = startVal;
            window.addEventListener('mousemove', handleKnobMove);
            window.addEventListener('mouseup', handleKnobUp);
        };
    }

    function handleKnobMove(e: MouseEvent) {
        if (!draggingKnob) return;
        const dy = knobStartY - e.clientY;
        if (draggingKnob === 'freq') {
            const logStart = Math.log10(knobStartValue || 20);
            const logNew = logStart + dy * 0.005;
            const newFreq = Math.max(20, Math.min(20000, Math.round(Math.pow(10, logNew))));
            eqStore.updateBand(nodeIndex, 'freq', newFreq);
        } else if (draggingKnob === 'gain') {
            const newGain = Math.max(-30, Math.min(30, Math.round((knobStartValue + dy * 0.1) * 10) / 10));
            eqStore.updateBand(nodeIndex, 'gain', newGain);
        } else if (draggingKnob === 'q') {
            const newQ = Math.max(0.1, Math.min(20, Math.round((knobStartValue + dy * 0.02) * 10) / 10));
            eqStore.updateBand(nodeIndex, 'q', newQ);
        }
    }

    function handleKnobUp() {
        draggingKnob = null;
        window.removeEventListener('mousemove', handleKnobMove);
        window.removeEventListener('mouseup', handleKnobUp);
    }

    // Knob visual rotation (-135° to +135°)
    function knobAngle(value: number, min: number, max: number): number {
        const normalized = (value - min) / (max - min);
        return -135 + normalized * 270;
    }

    function handleBypass() {
        eqStore.updateBand(nodeIndex, 'gain', 0);
    }

    function handleReset() {
        eqStore.updateBand(nodeIndex, 'gain', 0);
        eqStore.updateBand(nodeIndex, 'q', 1.0);
    }

    function handleDelete() {
        if (eqStore.eqType === 'parametrico') {
            eqStore.parametricFilters = eqStore.parametricFilters.filter((_, i) => i !== nodeIndex);
        }
        onClose();
    }

    // Fixed at bottom center
    const popoverW = containerWidth > 500 ? 420 : Math.min(containerWidth - 16, 340);
    const adaptedX = $derived(Math.round((containerWidth - popoverW) / 2));


    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') onClose();
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="eq-popover"
    style="left: {adaptedX}px; bottom: 8px; width: {popoverW}px; --node-color: {color};"
    onclick={(e) => e.stopPropagation()}
    onmousedown={(e) => e.stopPropagation()}
    onwheel={(e) => e.stopPropagation()}
>
    {#if band}
        <!-- Header -->
        <div class="popover-header">
            <span class="filter-icon" style="color: {color}">
                {@html filterSvgIcons[band.type] || filterSvgIcons['peaking']}
            </span>
            <span class="filter-title" style="color: {color}">Filtro #{nodeIndex + 1}</span>
            <button class="close-btn" onclick={onClose} title="Cerrar">✕</button>
        </div>

        <!-- Filter type toggle buttons -->
        <div class="type-toggle">
            {#each filterTypes as ft}
                <button
                    class="type-btn"
                    class:active={band.type === ft}
                    style="--btn-color: {filterTypeColors[ft]}"
                    title={filterTypeName(ft)}
                    onclick={() => eqStore.updateBand(nodeIndex, 'type', ft)}
                >
                    <span class="type-icon">{@html filterSvgIcons[ft] || ''}</span>
                </button>
            {/each}
        </div>

        <!-- Knobs row -->
        <div class="knobs-row">
            <!-- Freq knob -->
            <div class="knob-group">
                <div
                    class="knob"
                    style="--angle: {knobAngle(Math.log10(band.freq), Math.log10(20), Math.log10(20000))}deg; --knob-color: {color}"
                    onmousedown={handleKnobDown('freq', band.freq)}
                    role="slider"
                    tabindex="0"
                    aria-label="Frecuencia"
                    aria-valuenow={band.freq}
                >
                    <div class="knob-indicator"></div>
                </div>
                <input
                    type="number"
                    class="knob-input"
                    value={band.freq}
                    min="20"
                    max="20000"
                    step="1"
                    onchange={(e) => eqStore.updateBand(nodeIndex, 'freq', Math.max(20, Math.min(20000, Number(e.currentTarget.value))))}
                />
                <span class="knob-label">Hz</span>
            </div>

            <!-- Gain knob -->
            <div class="knob-group">
                <div
                    class="knob"
                    style="--angle: {knobAngle(band.gain, -30, 30)}deg; --knob-color: {band.gain > 0 ? 'var(--accent-green)' : band.gain < 0 ? 'var(--accent-red)' : '#888'}"
                    onmousedown={handleKnobDown('gain', band.gain)}
                    role="slider"
                    tabindex="0"
                    aria-label="Ganancia"
                    aria-valuenow={band.gain}
                >
                    <div class="knob-indicator"></div>
                </div>
                <input
                    type="number"
                    class="knob-input"
                    value={band.gain}
                    min="-30"
                    max="30"
                    step="0.1"
                    onchange={(e) => eqStore.updateBand(nodeIndex, 'gain', Math.max(-30, Math.min(30, Number(e.currentTarget.value))))}
                />
                <span class="knob-label">dB</span>
            </div>

            <!-- Q knob -->
            <div class="knob-group">
                <div
                    class="knob"
                    style="--angle: {knobAngle(band.q, 0.1, 20)}deg; --knob-color: var(--accent)"
                    onmousedown={handleKnobDown('q', band.q)}
                    role="slider"
                    tabindex="0"
                    aria-label="Factor Q"
                    aria-valuenow={band.q}
                >
                    <div class="knob-indicator"></div>
                </div>
                <input
                    type="number"
                    class="knob-input"
                    value={band.q}
                    min="0.1"
                    max="20"
                    step="0.1"
                    onchange={(e) => eqStore.updateBand(nodeIndex, 'q', Math.max(0.1, Math.min(20, Number(e.currentTarget.value))))}
                />
                <span class="knob-label">Q</span>
            </div>
        </div>

        <!-- Action buttons -->
        <div class="action-row">
            <button class="action-btn" onclick={handleBypass} title="Poner ganancia en 0dB">Silenciar</button>
            <button class="action-btn" onclick={handleReset} title="Restablecer valores">Resetear</button>
            <button class="action-btn action-btn--danger" onclick={handleDelete} title="Eliminar este filtro">Eliminar</button>
        </div>
    {/if}
</div>

<style>
    .eq-popover {
        position: absolute;
        z-index: 50;
        background: rgba(12, 12, 18, 0.96);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 8px 12px;
        box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        gap: 6px;
        pointer-events: all;
        user-select: none;
    }

    .popover-header {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .filter-icon {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
    }

    .filter-icon :global(svg) {
        width: 14px;
        height: 14px;
    }

    .filter-title {
        font-size: 11px;
        font-weight: 700;
        flex: 1;
    }

    .close-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        font-size: 12px;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        transition: all 0.15s;
    }

    .close-btn:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
    }

    .type-toggle {
        display: flex;
        gap: 2px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 6px;
        padding: 2px;
    }

    .type-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px 2px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.35);
        transition: all 0.15s;
    }

    .type-btn:hover {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.7);
    }

    .type-btn.active {
        background: color-mix(in srgb, var(--btn-color) 15%, transparent);
        border-color: color-mix(in srgb, var(--btn-color) 30%, transparent);
        color: var(--btn-color);
    }

    .type-icon {
        width: 16px;
        height: 10px;
        display: flex;
        align-items: center;
    }

    .type-icon :global(svg) {
        width: 16px;
        height: 10px;
    }

    .knobs-row {
        display: flex;
        justify-content: space-between;
        gap: 6px;
    }

    .knob-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        flex: 1;
    }

    .knob {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: radial-gradient(circle at 40% 35%, #2a2a35, #151518);
        border: 2px solid rgba(255, 255, 255, 0.08);
        position: relative;
        cursor: grab;
        transition: border-color 0.15s;
    }

    .knob:hover {
        border-color: var(--knob-color, #888);
    }

    .knob:active {
        cursor: grabbing;
    }

    .knob-indicator {
        position: absolute;
        width: 2px;
        height: 10px;
        background: var(--knob-color, #888);
        border-radius: 1px;
        top: 4px;
        left: 50%;
        transform-origin: bottom center;
        transform: translateX(-50%) rotate(var(--angle, 0deg));
        box-shadow: 0 0 4px var(--knob-color, #888);
    }

    .knob-input {
        width: 52px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        color: #e0e0e0;
        font-size: 9px;
        text-align: center;
        padding: 2px 4px;
        outline: none;
        -moz-appearance: textfield;
    }

    .knob-input::-webkit-inner-spin-button,
    .knob-input::-webkit-outer-spin-button {
        -webkit-appearance: none;
    }

    .knob-input:focus {
        border-color: var(--node-color, #888);
    }

    .knob-label {
        font-size: 8px;
        color: rgba(255, 255, 255, 0.35);
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .action-row {
        display: flex;
        gap: 4px;
    }

    .action-btn {
        flex: 1;
        padding: 4px 6px;
        border-radius: 5px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.5);
        font-size: 9px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
    }

    .action-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
    }

    .action-btn--danger {
        color: rgba(239, 68, 68, 0.7);
    }

    .action-btn--danger:hover {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
        border-color: rgba(239, 68, 68, 0.2);
    }
</style>
