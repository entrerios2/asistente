/**
 * eqNodeIcons.ts — Filter type colors, names, and canvas icon rendering.
 * Used by quadrantDraw.ts to draw filter nodes with embedded type icons.
 */

/** Color palette per filter type — peaking is cyan to distinguish from the yellow total EQ curve */
export const filterTypeColors: Record<string, string> = {
    peaking:    '#22d3ee',
    low_shelf:  '#f97316',
    lowshelf:   '#f97316',
    high_shelf: '#a855f7',
    highshelf:  '#a855f7',
    lowpass:    '#ef4444',
    highpass:   '#3b82f6',
    notch:      '#6b7280',
    bandpass:   '#10b981',
};

/** Get a display-friendly name for the filter type */
export function filterTypeName(type: string): string {
    switch (type) {
        case 'peaking': return 'Peaking';
        case 'low_shelf': case 'lowshelf': return 'Low Shelf';
        case 'high_shelf': case 'highshelf': return 'High Shelf';
        case 'lowpass': return 'Lowpass';
        case 'highpass': return 'Highpass';
        case 'notch': return 'Notch';
        case 'bandpass': return 'Bandpass';
        default: return type;
    }
}

/**
 * Draw a filter type icon directly onto a canvas context.
 * Uses simple stroked paths — no external SVG loading needed.
 * Call this in the draw loop after drawing the node circle.
 *
 * @param ctx - The canvas 2D context
 * @param cx - Center X of the node
 * @param cy - Center Y of the node
 * @param r - Radius of the node
 * @param type - Filter type string
 * @param color - Stroke color for the icon
 */
export function drawFilterIcon(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, r: number,
    type: string, color: string
): void {
    const s = r * 0.55; // icon scale factor
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, r * 0.15);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    switch (type) {
        case 'peaking':
            // Bell curve: ∩
            ctx.moveTo(cx - s, cy + s * 0.3);
            ctx.quadraticCurveTo(cx - s * 0.3, cy + s * 0.3, cx, cy - s * 0.6);
            ctx.quadraticCurveTo(cx + s * 0.3, cy + s * 0.3, cx + s, cy + s * 0.3);
            break;

        case 'low_shelf': case 'lowshelf':
            // Step up on left: ─╱─
            ctx.moveTo(cx - s, cy - s * 0.4);
            ctx.lineTo(cx - s * 0.2, cy - s * 0.4);
            ctx.lineTo(cx + s * 0.2, cy + s * 0.4);
            ctx.lineTo(cx + s, cy + s * 0.4);
            break;

        case 'high_shelf': case 'highshelf':
            // Step up on right: ─╲─ (mirror of low shelf)
            ctx.moveTo(cx - s, cy + s * 0.4);
            ctx.lineTo(cx - s * 0.2, cy + s * 0.4);
            ctx.lineTo(cx + s * 0.2, cy - s * 0.4);
            ctx.lineTo(cx + s, cy - s * 0.4);
            break;

        case 'lowpass':
            // Flat then drop: ─╲
            ctx.moveTo(cx - s, cy - s * 0.2);
            ctx.lineTo(cx - s * 0.1, cy - s * 0.2);
            ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.2, cx + s, cy + s * 0.6);
            break;

        case 'highpass':
            // Rise then flat: ╱─
            ctx.moveTo(cx - s, cy + s * 0.6);
            ctx.quadraticCurveTo(cx - s * 0.3, cy - s * 0.2, cx + s * 0.1, cy - s * 0.2);
            ctx.lineTo(cx + s, cy - s * 0.2);
            break;

        case 'notch':
            // Narrow dip: ─╲╱─
            ctx.moveTo(cx - s, cy - s * 0.2);
            ctx.lineTo(cx - s * 0.3, cy - s * 0.2);
            ctx.lineTo(cx, cy + s * 0.6);
            ctx.lineTo(cx + s * 0.3, cy - s * 0.2);
            ctx.lineTo(cx + s, cy - s * 0.2);
            break;

        case 'bandpass':
            // Narrow peak: ─╱╲─
            ctx.moveTo(cx - s, cy + s * 0.3);
            ctx.lineTo(cx - s * 0.3, cy + s * 0.3);
            ctx.lineTo(cx, cy - s * 0.5);
            ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
            ctx.lineTo(cx + s, cy + s * 0.3);
            break;

        default:
            // Generic dot
            ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
            break;
    }

    ctx.stroke();
    ctx.restore();
}
