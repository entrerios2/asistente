/**
 * canvasRenderers.ts — Barrel re-export module.
 *
 * All rendering functions are now split into focused modules under ./renderers/:
 *   - gridRenderers:    drawGrid, drawCrosshair
 *   - overlayRenderers: drawCoherenceBackground, applyCoherenceMask, drawSpectrogram,
 *                       drawLevelOverlay, drawNumericOverlay, drawTargetTrace, drawScope, hexToRgba
 *   - metricRenderers:  drawMetricPath, drawSpectrumPath, drawTimeDomainPath,
 *                       drawSimulatedMagnitudePath, drawNyquistPath, drawPhasePath,
 *                       drawCrestFactor, drawPhaseDelay
 *   - eqRenderers:      drawEQOverlayPath, drawEQPhaseOverlayPath, drawIndividualFilterCurve
 *
 * This file re-exports everything so existing imports remain unchanged.
 */

export { drawGrid, drawCrosshair } from './renderers/gridRenderers';

export {
    hexToRgba,
    drawCoherenceBackground,
    applyCoherenceMask,
    drawSpectrogram,
    drawLevelOverlay,
    drawNumericOverlay,
    drawTargetTrace,
    drawScope,
} from './renderers/overlayRenderers';

export {
    drawMetricPath,
    drawSpectrumPath,
    drawTimeDomainPath,
    drawSimulatedMagnitudePath,
    drawNyquistPath,
    drawPhasePath,
    drawCrestFactor,
    drawPhaseDelay,
    drawHarmonics,
    drawBarChart,
} from './renderers/metricRenderers';

export {
    drawEQOverlayPath,
    drawEQPhaseOverlayPath,
    drawIndividualFilterCurve,
} from './renderers/eqRenderers';
