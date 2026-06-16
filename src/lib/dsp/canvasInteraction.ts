export const freqMin = 10;    // Hz (sub-bajo audible)
export const freqMax = 22000; // Hz (cercano a Nyquist @ 44.1kHz)
export const timeMin = -10; // ms
export const timeMax = 100; // ms
export const dbMin = -30; // dB
export const dbMax = 30; // dB

export interface InteractionState {
    zoomX: number;     // Zoom independiente eje X (frecuencia)
    zoomY: number;     // Zoom independiente eje Y (amplitud)
    zoomMode: 'XY' | 'X' | 'Y'; // Modo de zoom activo
    offsetX: number;
    offsetY: number;
    isDragging: boolean;
    lastMouseX: number;
    lastMouseY: number;
    touchStartDist: number;
    touchStartScaleX: number;
    touchStartScaleY: number;
    isPinching: boolean;
    mouseX: number;
    mouseY: number;
    showCrosshair: boolean;
}

export function valToX(val: number, width: number, hasTimeDomainActive: boolean, state: InteractionState): number {
    if (hasTimeDomainActive) {
        // Eje X Lineal (Tiempo en milisegundos: -10ms a 100ms)
        const range = timeMax - timeMin;
        const normalized = (val - timeMin) / range;
        return normalized * width * state.zoomX + state.offsetX;
    } else {
        // Eje X Logarítmico (Frecuencia en hercios: 10Hz a 22kHz)
        if (val < freqMin) val = freqMin;
        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const logFreq = Math.log10(val);
        const normalized = (logFreq - logMin) / (logMax - logMin);
        return normalized * width * state.zoomX + state.offsetX;
    }
}

export function xToVal(x: number, width: number, hasTimeDomainActive: boolean, state: InteractionState): number {
    const adjustedX = (x - state.offsetX) / state.zoomX;
    if (hasTimeDomainActive) {
        const range = timeMax - timeMin;
        return timeMin + (adjustedX / width) * range;
    } else {
        const logMin = Math.log10(freqMin);
        const logMax = Math.log10(freqMax);
        const logFreq = (adjustedX / width) * (logMax - logMin) + logMin;
        return Math.pow(10, logFreq);
    }
}

/** Límites absolutos de pan en Y (dB). El usuario no puede hacer pan más allá de estos valores. */
export const dbPanMin = -80; // dB - límite de pan/zoom
export const dbPanMax = 80;  // dB - límite de pan/zoom

/**
 * Clamp de pan: impide que el usuario haga pan más allá de los límites.
 * Eje X: freqMin/freqMax (solo en modo frecuencia, no en time domain).
 * Eje Y: dbPanMin/dbPanMax (±60 dB).
 * Debe llamarse después de cada modificación de state.offsetX/offsetY o state.zoomX/zoomY.
 */
export function clampPan(
    state: InteractionState,
    width: number,
    height: number,
    hasTimeDomainActive: boolean,
    metricType: string,
    metricConfigs: Record<string, any>
): void {
    // Clamp eje X (solo en modo frecuencia)
    if (!hasTimeDomainActive) {
        const xMin = valToX(freqMin, width, false, state);
        const xMax = valToX(freqMax, width, false, state);
        if (xMin > 0) state.offsetX -= xMin;
        if (xMax < width) state.offsetX += width - xMax;
    }
    // Clamp eje Y (±80 dB)
    const yTop = valToY(dbPanMax, height, metricType, metricConfigs, state);
    const yBottom = valToY(dbPanMin, height, metricType, metricConfigs, state);
    if (yTop > 0) state.offsetY -= yTop;
    if (yBottom < height) state.offsetY += height - yBottom;
}

export function valToY(
    val: number,
    height: number,
    metricType: string,
    metricConfigs: Record<string, any>,
    state: InteractionState
): number {
    let min = dbMin,
        max = dbMax;

    const cfg = metricConfigs[metricType];

    if (metricType === "Spectrum" || metricType === "Magnitude" || metricType === "Simulated Magnitude") {
        const currentCfg = metricConfigs[metricType] || { modeY: "dB" };
        if (currentCfg.modeY === "Linear") {
            min = 0;
            max = 1;
        } else if (currentCfg.modeY === "Impedance") {
            min = 0;
            max = 100;
        } else {
            min = metricType === "Spectrum" ? -120 : dbMin;
            max = metricType === "Spectrum" ? 10 : dbMax;
        }
    } else if (metricType === "Phase") {
        const phaseCfg = metricConfigs["Phase"] || { range: 360 };
        min = -phaseCfg.range / 2;
        max = phaseCfg.range / 2;
    } else if (metricType === "Coherence") {
        const cohCfg = metricConfigs["Coherence"] || { cohType: "normal" };
        if (cohCfg.cohType === "SNR") {
            min = -20;
            max = 40;
        } else {
            min = 0;
            max = 1;
        }
    } else if (metricType === "Group Delay") {
        min = -5;
        max = 25;
    } else if (metricType === "Impulse" || metricType === "Step") {
        min = -1;
        max = 1;
    }

    if (cfg && cfg.invertY) {
        const temp = min;
        min = max;
        max = temp;
    }

    const range = max - min;
    const normalized = (val - min) / range;
    const base = height - normalized * height;
    return base * state.zoomY + state.offsetY;
}

export function yToVal(
    y: number,
    height: number,
    metricType: string,
    state: InteractionState
): number {
    const adjustedY = (y - state.offsetY) / state.zoomY;
    let min = dbMin,
        max = dbMax;
    if (metricType === "Spectrum") {
        min = -120;
        max = 10;
    } else if (metricType === "Phase") {
        min = -180;
        max = 180;
    } else if (metricType === "Coherence") {
        min = 0;
        max = 1;
    } else if (metricType === "Group Delay") {
        min = -5;
        max = 25;
    } else if (metricType === "Impulse" || metricType === "Step") {
        min = -1;
        max = 1;
    }

    const range = max - min;
    return min + (1 - adjustedY / height) * range;
}

export function handleWheel(
    e: WheelEvent,
    state: InteractionState,
    canvasElement: HTMLCanvasElement,
    containerWidth: number,
    containerHeight: number,
    activeMetrics: string[],
    metricConfigs: Record<string, any>,
    hasTimeDomainActive: boolean
): void {
    e.preventDefault();
    const rect = canvasElement.getBoundingClientRect();
    const mX = e.clientX - rect.left;
    const mY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;

    // --- DETECCIÓN INTELIGENTE DE EJE ---
    const Y_LABEL_ZONE = 45;  // Margen izquierdo (zona de labels Y)
    const X_LABEL_ZONE = 25;  // Margen inferior (zona de labels X)

    let zoomX = false;
    let zoomY = false;

    if (mX <= Y_LABEL_ZONE) {
        // Mouse sobre labels del eje Y → zoom solo Y
        zoomY = true;
    } else if (mY >= containerHeight - X_LABEL_ZONE) {
        // Mouse sobre labels del eje X → zoom solo X
        zoomX = true;
    } else if (e.altKey) {
        zoomY = true;
    } else if (e.shiftKey) {
        zoomX = true;
    } else {
        // Área central: zoom XY proporcional
        zoomX = true;
        zoomY = true;
    }

    if (zoomX) {
        const valBefore = xToVal(mX, containerWidth, hasTimeDomainActive, state);
        state.zoomX = Math.max(0.5, Math.min(4, state.zoomX * delta));
        const xAfter = valToX(valBefore, containerWidth, hasTimeDomainActive, state);
        state.offsetX += mX - xAfter;
    }

    if (zoomY) {
        const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
        const valBefore = yToVal(mY, containerHeight, refMetric, state);
        state.zoomY = Math.max(0.5, Math.min(4, state.zoomY * delta));
        const yAfter = valToY(valBefore, containerHeight, refMetric, metricConfigs, state);
        state.offsetY += mY - yAfter;
    }

    // Clamp X + Y: reusar la función helper de Prompt 1
    const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
    clampPan(state, containerWidth, containerHeight, hasTimeDomainActive, refMetric, metricConfigs);
}

export function handleMouseMove(
    e: MouseEvent,
    state: InteractionState,
    canvasElement: HTMLCanvasElement,
    containerWidth: number,
    containerHeight: number,
    hasTimeDomainActive: boolean,
    activeMetrics: string[],
    metricConfigs: Record<string, any>
) {
    const rect = canvasElement.getBoundingClientRect();
    state.mouseX = e.clientX - rect.left;
    state.mouseY = e.clientY - rect.top;
    state.showCrosshair = true;

    if (state.isDragging) {
        state.offsetX += e.clientX - state.lastMouseX;
        state.offsetY += e.clientY - state.lastMouseY;
        state.lastMouseX = e.clientX;
        state.lastMouseY = e.clientY;
        const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
        clampPan(state, containerWidth, containerHeight, hasTimeDomainActive, refMetric, metricConfigs);
    }
}

export function handleMouseDown(
    e: MouseEvent,
    state: InteractionState,
    showSelector: boolean,
    settingsBtn: HTMLButtonElement | undefined
) {
    if (
        showSelector &&
        settingsBtn &&
        settingsBtn.contains(e.target as Node)
    )
        return;
    state.isDragging = true;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
}

export function handleTouchStart(
    e: TouchEvent,
    state: InteractionState
) {
    if (e.touches.length === 1) {
        state.isDragging = true;
        state.lastMouseX = e.touches[0].clientX;
        state.lastMouseY = e.touches[0].clientY;
        state.isPinching = false;
    } else if (e.touches.length === 2) {
        state.isDragging = false;
        state.isPinching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        state.touchStartDist = Math.sqrt(dx * dx + dy * dy);
        state.touchStartScaleX = state.zoomX;
        state.touchStartScaleY = state.zoomY;
    }
}

export function handleTouchMove(
    e: TouchEvent,
    state: InteractionState,
    canvasElement: HTMLCanvasElement,
    activeMetrics: string[],
    metricConfigs: Record<string, any>
) {
    const rect = canvasElement.getBoundingClientRect();
    if (e.touches.length === 1 && state.isDragging) {
        const touch = e.touches[0];
        state.offsetX += touch.clientX - state.lastMouseX;
        state.offsetY += touch.clientY - state.lastMouseY;
        state.lastMouseX = touch.clientX;
        state.lastMouseY = touch.clientY;

        state.mouseX = touch.clientX - rect.left;
        state.mouseY = touch.clientY - rect.top;
        state.showCrosshair = true;
        const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
        clampPan(state, rect.width, rect.height, false, refMetric, metricConfigs);
    } else if (e.touches.length === 2 && state.isPinching) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && state.touchStartDist > 0) {
            const factor = dist / state.touchStartDist;
            state.zoomX = Math.max(0.5, Math.min(4, state.touchStartScaleX * factor));
            state.zoomY = Math.max(0.5, Math.min(4, state.touchStartScaleY * factor));
        }
        const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
        clampPan(state, rect.width, rect.height, false, refMetric, metricConfigs);
    }
}

export function handleTouchEnd(
    state: InteractionState,
    width: number,
    height: number,
    hasTimeDomainActive: boolean,
    activeMetrics: string[],
    metricConfigs: Record<string, any>
) {
    state.isDragging = false;
    state.isPinching = false;
    state.showCrosshair = false;
    const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
    clampPan(state, width, height, hasTimeDomainActive, refMetric, metricConfigs);
}

export function handleMouseUp(
    state: InteractionState,
    width: number,
    height: number,
    hasTimeDomainActive: boolean,
    activeMetrics: string[],
    metricConfigs: Record<string, any>
): void {
    state.isDragging = false;
    const refMetric = activeMetrics.find(m => m !== "Phase") || "Magnitude";
    clampPan(state, width, height, hasTimeDomainActive, refMetric, metricConfigs);
}

export function handleDoubleClick(state: InteractionState): void {
    state.zoomX = 1;
    state.zoomY = 1;
    state.offsetX = 0;
    state.offsetY = 0;
}

export function rebuildFrequencyLUT(
    width: number,
    state: InteractionState,
    bins: number
): Int32Array {
    if (width <= 0) return new Int32Array(0);
    const lut = new Int32Array(Math.round(width));
    const logMin = Math.log10(freqMin);
    const logMax = Math.log10(freqMax);
    const binWidth = 24000 / bins; // 48000 Hz / 2 / bins

    for (let x = 0; x < width; x++) {
        // Calcular frecuencia logarítmica correspondiente al píxel X
        const adjustedX = (x - state.offsetX) / state.zoomX;
        const logFreq = (adjustedX / width) * (logMax - logMin) + logMin;
        const freq = Math.pow(10, logFreq);
        
        // Mapear al bin FFT correspondiente
        const binIndex = Math.max(0, Math.min(bins - 1, Math.round(freq / binWidth)));
        lut[x] = binIndex;
    }
    return lut;
}
