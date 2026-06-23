/**
 * eqInteractionHandlers.ts — Pure EQ interaction logic extracted from Quadrant.svelte.
 *
 * Each handler receives the current state as a context object and returns
 * a result describing what state mutations should be applied.
 * The Svelte component applies these mutations to its $state.
 */

import { hitTestEQNodes, mouseToEQParams } from './quadrantHelpers';
import type { MetricConfig } from './quadrantState';
import type { InteractionState } from './canvasInteraction';
import type { EQBand } from '../stores/eqStore.svelte';

/** Context snapshot passed to EQ interaction handlers */
export interface EQContext {
    showEQOverlay: boolean;
    eqType: 'grafico' | 'parametrico';
    activeBands: EQBand[];
    hoveringEQNode: number | null;
    draggingEQNode: number | null;
    eqScoreHover: boolean;
    eqScoreBadge: any;
    containerWidth: number;
    containerHeight: number;
    metricConfigs: Record<string, MetricConfig>;
    interactionState: InteractionState;
    // Badge geometry
    badgeX: number;
    badgeYOffset: number;
    badgeWCompact: number;
    badgeHCompact: number;
    badgeWExpanded: number;
    badgeHExpanded: number;
}

/** Result of an EQ interaction — describes what to mutate */
export interface EQInteractionResult {
    hoveringEQNode?: number | null;
    draggingEQNode?: number | null;
    selectedEQNode?: number | null;
    eqScoreHover?: boolean;
    popoverPos?: { x: number; y: number };
    /** Band updates to apply via eqStore.updateBand() */
    bandUpdates?: { index: number; field: 'freq' | 'gain' | 'q'; value: number }[];
    /** If true, the event was consumed and the caller should NOT delegate to pan/zoom */
    consumed: boolean;
}

/**
 * Handle wheel event for EQ Q adjustment.
 * Returns null if EQ didn't consume the event (delegate to pan/zoom).
 */
export function handleEQWheel(
    deltaY: number,
    ctx: EQContext,
): EQInteractionResult | null {
    if (!ctx.showEQOverlay || ctx.hoveringEQNode === null || ctx.eqType !== 'parametrico') {
        return null;
    }
    const band = ctx.activeBands[ctx.hoveringEQNode];
    if (!band) return null;

    const delta = deltaY > 0 ? -0.1 : 0.1;
    const newQ = Math.max(0.1, Math.min(20, Math.round((band.q + delta) * 10) / 10));

    return {
        consumed: true,
        bandUpdates: [{ index: ctx.hoveringEQNode, field: 'q', value: newQ }],
    };
}

/**
 * Handle mouse move for EQ: node hover, badge hover, and drag.
 * Always returns a result (may be partial).
 */
export function handleEQMouseMove(
    mouseX: number,
    mouseY: number,
    shiftKey: boolean,
    ctrlKey: boolean,
    ctx: EQContext,
): EQInteractionResult {
    const result: EQInteractionResult = { consumed: false };

    // Hit-test EQ nodes
    if (ctx.showEQOverlay && ctx.draggingEQNode === null && ctx.activeBands.length > 0) {
        result.hoveringEQNode = hitTestEQNodes(
            mouseX, mouseY, ctx.activeBands,
            ctx.containerWidth, ctx.containerHeight,
            ctx.metricConfigs, ctx.interactionState,
        );
    } else if (!ctx.showEQOverlay) {
        result.hoveringEQNode = null;
    }

    // Hit-test EQ score badge
    if (ctx.showEQOverlay && ctx.eqScoreBadge) {
        const badgeW = ctx.eqScoreHover ? ctx.badgeWExpanded : ctx.badgeWCompact;
        const badgeH = ctx.eqScoreHover ? ctx.badgeHExpanded : ctx.badgeHCompact;
        const badgeY = ctx.containerHeight - ctx.badgeYOffset - badgeH;
        result.eqScoreHover = mouseX >= ctx.badgeX && mouseX <= ctx.badgeX + badgeW
            && mouseY >= badgeY && mouseY <= badgeY + badgeH + ctx.badgeYOffset;
    } else {
        result.eqScoreHover = false;
    }

    // Active drag of EQ node
    if (ctx.draggingEQNode !== null) {
        const { freq, gain } = mouseToEQParams(
            mouseX, mouseY, ctx.containerWidth, ctx.containerHeight,
            ctx.interactionState, shiftKey, ctrlKey,
        );
        if (ctx.eqType === 'grafico') {
            result.bandUpdates = [{ index: ctx.draggingEQNode, field: 'gain', value: gain }];
        } else {
            result.bandUpdates = [
                { index: ctx.draggingEQNode, field: 'freq', value: freq },
                { index: ctx.draggingEQNode, field: 'gain', value: gain },
            ];
        }
    }

    return result;
}

/**
 * Handle mouse down for EQ: node selection + drag start.
 * Returns null if no EQ node was clicked (delegate to pan/zoom).
 */
export function handleEQMouseDown(
    mouseX: number,
    mouseY: number,
    ctx: EQContext,
): EQInteractionResult | null {
    if (!ctx.showEQOverlay || ctx.hoveringEQNode === null) {
        return { consumed: false, selectedEQNode: null };
    }
    return {
        consumed: true,
        draggingEQNode: ctx.hoveringEQNode,
        selectedEQNode: ctx.hoveringEQNode,
        popoverPos: { x: mouseX, y: mouseY },
    };
}

/**
 * Handle mouse up for EQ: end drag.
 * Returns null if no drag was active (delegate to pan/zoom).
 */
export function handleEQMouseUp(
    ctx: EQContext,
): EQInteractionResult | null {
    if (ctx.draggingEQNode === null) return null;
    return {
        consumed: true,
        draggingEQNode: null,
    };
}
