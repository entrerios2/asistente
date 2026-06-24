/**
 * useRenderLoop.ts — Core render pipeline extracted from Quadrant.svelte.
 *
 * Encapsulates the per-frame draw logic:
 * - EQ cache refresh
 * - Calculated layers update
 * - Version tracking + interpolation
 * - Pre-smoothing
 * - drawQuadrant dispatch
 *
 * The Svelte component provides a thin rAF wrapper that calls executeDraw()
 * with the current reactive state snapshot.
 */

import { drawQuadrant, type DrawParams } from '../dsp/quadrantDraw';
import { getCanvasTheme } from '../dsp/canvasTheme';
import { preSmoothBuffer } from '../dsp/quadrantHelpers';
import type { InterpolationEngine } from '../dsp/interpolationEngine';
import type { MetricConfig } from '../dsp/quadrantState';
import type { InteractionState } from '../dsp/canvasInteraction';
import type { EQBand } from './eqStore.svelte';

/**
 * Snapshot of all reactive state needed for a single frame render.
 * Collected by the Svelte component and passed to executeDraw().
 */
export interface RenderFrameParams {
    canvas: HTMLCanvasElement;
    cachedCtx: CanvasRenderingContext2D | null;

    // Reactive state snapshots
    activeMetrics: string[];
    hasTimeDomainActive: boolean;
    metricConfigs: Record<string, MetricConfig>;
    metricStyles: Record<string, { color: string; lineWidth: number; lineDash: number[] }>;
    interactionState: InteractionState;
    isDarkMode: boolean;
    sampleRate: number;
    BINS: number;

    // Interpolation engine
    interpEngine: InterpolationEngine;
    localLastVersion: number;
    dirty: boolean;

    // Pre-allocated buffers
    smoothedMagnitude: Float32Array;
    smoothedSpectrum: Float32Array;

    // Callbacks
    getPPOSmoothedValue: (bin: number, data: Float32Array, ppo: number) => number;
    getMetricValueInterpolated: (freq: number, data: Float32Array) => number;
    getImpulseValueInterpolated: (timeMs: number, data: Float32Array) => number;
    getMetricAlpha: (metric: string) => number;
    getEQResponseCached: (f: number) => number;
    getEQPhaseCached: (f: number) => number;

    // mathOrchestrator reference (for interpolateBuffers)
    mathOrchestratorRef: any;

    // External state
    showEQOverlay: boolean;
    refreshEQCache: () => void;
    updateCalculatedLayers: () => void;
    orchestratorVersion: number;

    // Layer/trace data
    liveData: Float32Array | null;
    frequencyLUT: Int32Array;
    myLayers: any[];
    quadrantLayers: any[];
    instantaneas: any[];

    // EQ state
    eqBands: EQBand[];
    hoveringEQNode: number | null;
    draggingEQNode: number | null;
    selectedEQNode: number | null;
    eqScoreBadge: any;
    eqScoreHover: boolean;

    // Spectrogram state
    offscreenCanvas: HTMLCanvasElement | null;
    offscreenCtx: CanvasRenderingContext2D | null;
    spectrogramLUT_RGBA: Uint8ClampedArray;
    spectrogramFrameCountRef: { value: number };
    initOffscreenCanvas: () => void;
    spectrogramDbHistory: Float32Array[];
    sharedImageData: ImageData | null;

    // Other external stores
    targetTrace: any;
    meterStore: any;
    hReal: Float32Array;
    hImag: Float32Array;
    outputCrestFactor: Float32Array;
}

/**
 * Result from executeDraw — allows the component to update its mutable state
 */
export interface RenderFrameResult {
    localLastVersion: number;
    dirty: boolean;
    cachedCtx: CanvasRenderingContext2D | null;
}

/**
 * Executes a single render frame. Pure function with no Svelte dependencies.
 * Returns updated state values that the component should write back.
 */
export function executeDraw(p: RenderFrameParams): RenderFrameResult | null {
    const canvas = p.canvas;
    if (!canvas) return null;

    let ctx = p.cachedCtx;
    if (!ctx) ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (canvas.width === 0 || canvas.height === 0) return null;

    // Detect context loss
    if (typeof ctx.isContextLost === 'function' && ctx.isContextLost()) return null;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Apply transform (defensive against resets from resize)
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    // Fill with canvas theme background — ensures bg matches grid colors
    // even when canvas theme differs from UI theme
    const canvasTheme = getCanvasTheme();
    ctx.fillStyle = canvasTheme.bg;
    ctx.fillRect(0, 0, width, height);

    let localLastVersion = p.localLastVersion;
    let dirty = p.dirty;

    try {
        // Refresh EQ cache at render-loop speed (60fps)
        if (p.showEQOverlay) {
            p.refreshEQCache();
        }

        // Update calculated layers
        p.updateCalculatedLayers();

        const liveData = p.liveData;

        const currentVersion = p.orchestratorVersion;
        if (currentVersion !== localLastVersion) {
            localLastVersion = currentVersion;
            p.interpEngine.updateHistory();
        }

        // Temporal interpolation at 60+ FPS
        p.interpEngine.interpolateBuffers(dirty, p.mathOrchestratorRef);
        if (dirty) {
            dirty = false;
        }

        // Pre-smooth curves
        const magPPO = p.metricConfigs["Magnitude"]?.smoothingPPO || 48;
        preSmoothBuffer(p.smoothedMagnitude, p.interpEngine.interpMagnitude, p.BINS, magPPO, p.sampleRate);

        const specPPO = p.metricConfigs["Spectrum"]?.smoothingPPO || 48;
        const hasLive = liveData && liveData.length > 0;
        const rawSpec = hasLive ? liveData : p.interpEngine.interpMagnitude;
        preSmoothBuffer(p.smoothedSpectrum, rawSpec, p.BINS, specPPO, p.sampleRate);

        drawQuadrant({
            ctx,
            width,
            height,
            activeMetrics: p.activeMetrics,
            hasTimeDomainActive: p.hasTimeDomainActive,
            metricConfigs: p.metricConfigs,
            metricStyles: p.metricStyles,
            interactionState: p.interactionState,
            isDarkMode: p.isDarkMode,
            sampleRate: p.sampleRate,
            BINS: p.BINS,
            interpEngine: p.interpEngine,
            liveData,
            frequencyLUT: p.frequencyLUT,
            smoothedMagnitude: p.smoothedMagnitude,
            smoothedSpectrum: p.smoothedSpectrum,
            getPPOSmoothedValue: p.getPPOSmoothedValue,
            getMetricValueInterpolated: p.getMetricValueInterpolated,
            getImpulseValueInterpolated: p.getImpulseValueInterpolated,
            getMetricAlpha: p.getMetricAlpha,
            getEQResponseCached: p.getEQResponseCached,
            getEQPhaseCached: p.getEQPhaseCached,
            myLayers: p.myLayers,
            quadrantLayers: p.quadrantLayers,
            instantaneas: p.instantaneas,
            showEQOverlay: p.showEQOverlay,
            eqBands: p.eqBands,
            hoveringEQNode: p.hoveringEQNode,
            draggingEQNode: p.draggingEQNode,
            selectedEQNode: p.selectedEQNode,
            eqScoreBadge: p.eqScoreBadge,
            eqScoreHover: p.eqScoreHover,
            offscreenCanvas: p.offscreenCanvas,
            offscreenCtx: p.offscreenCtx,
            spectrogramLUT_RGBA: p.spectrogramLUT_RGBA,
            spectrogramFrameCountRef: p.spectrogramFrameCountRef,
            initOffscreenCanvas: p.initOffscreenCanvas,
            spectrogramDbHistory: p.spectrogramDbHistory,
            sharedImageData: p.sharedImageData,
            targetTrace: p.targetTrace,
            meterStore: p.meterStore,
            hReal: p.hReal,
            hImag: p.hImag,
            outputCrestFactor: p.outputCrestFactor,
            containerWidth: width,
            containerHeight: height,
            customPPOSmooth: (idx: number, arr: Float32Array) => arr[idx],
        } as DrawParams);
    } catch {
        // Silent error — prevent render loop crash
    }

    return { localLastVersion, dirty, cachedCtx: ctx };
}

/**
 * Initialize canvas sizing, ResizeObserver, and the FPS-limited rAF render loop.
 * Returns a cleanup function to disconnect the observer and cancel the animation frame.
 *
 * Extracted from Quadrant.svelte's onMount to reduce component complexity.
 */
export function initCanvasAndLoop(
    container: HTMLDivElement,
    canvas: HTMLCanvasElement,
    draw: () => void,
    getTargetFps: () => number,
    onResize: (width: number, height: number) => void,
): () => void {
    // Initialize canvas with correct dimensions before first draw
    if (container && canvas) {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        onResize(rect.width, rect.height);
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
    }

    // ResizeObserver for physical container dimension changes
    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            onResize(width, height);
            if (canvas) {
                const dpr = window.devicePixelRatio || 1;
                const targetW = Math.round(width * dpr);
                const targetH = Math.round(height * dpr);
                if (canvas.width !== targetW || canvas.height !== targetH) {
                    canvas.width = targetW;
                    canvas.height = targetH;
                    canvas.style.width = `${width}px`;
                    canvas.style.height = `${height}px`;
                }
            }
        }
    });

    if (container) observer.observe(container);

    // FPS-limited rAF render loop
    let animationId: number;
    let lastDrawTime = performance.now();
    function renderLoop() {
        animationId = requestAnimationFrame(renderLoop);
        const now = performance.now();
        const interval = 1000 / getTargetFps();
        const elapsed = now - lastDrawTime;

        if (elapsed >= interval) {
            lastDrawTime = now - (elapsed % interval);
            draw();
        }
    }
    renderLoop();

    // Cleanup function
    return () => {
        observer.disconnect();
        cancelAnimationFrame(animationId);
    };
}
