/**
 * SpectrogramManager — Encapsulates offscreen canvas, history buffer,
 * ImageData, and frame count for spectrogram rendering.
 *
 * Extracted from Quadrant.svelte to reduce component complexity.
 * This is a plain class (no Svelte reactivity) — the component passes
 * the snapshot into executeDraw() via getState().
 */

const MAX_HISTORY = 100;

export class SpectrogramManager {
    offscreenCanvas: HTMLCanvasElement | null = null;
    offscreenCtx: CanvasRenderingContext2D | null = null;
    sharedImageData: ImageData | null = null;
    frameCount = { value: 0 };
    dbHistory: Float32Array[] = [];

    /**
     * Initialize (or reinitialize) the offscreen canvas for spectrogram rendering.
     * @param width - current container width in CSS pixels
     */
    init(width: number): void {
        if (typeof document === "undefined") return;
        this.offscreenCanvas = document.createElement("canvas");
        const w = Math.round(width) || 800;
        this.offscreenCanvas.width = w;
        this.offscreenCanvas.height = MAX_HISTORY;
        this.offscreenCtx = this.offscreenCanvas.getContext("2d");
        if (this.offscreenCtx) {
            this.offscreenCtx.fillStyle = "#000000";
            this.offscreenCtx.fillRect(0, 0, w, MAX_HISTORY);
            this.sharedImageData = this.offscreenCtx.createImageData(w, 1);
        } else {
            this.sharedImageData = null;
        }
        this.dbHistory = [];
    }
}
