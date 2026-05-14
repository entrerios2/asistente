export type Tier = 'TIER_0' | 'TIER_1' | 'TIER_2';

export function detectTier(): Tier {
	if (typeof navigator === 'undefined') return 'TIER_0';

	// TIER_2: Soporte para WebGPU
	// @ts-ignore
	if (navigator.gpu) {
		return 'TIER_2';
	}

	// TIER_1: Memoria decente (>= 4GB)
	// @ts-ignore
	if (navigator.deviceMemory && navigator.deviceMemory >= 4) {
		return 'TIER_1';
	}

	return 'TIER_0';
}

/**
 * Evalúa el lag del Event Loop durante un periodo corto.
 * @param durationMs Duración de la ventana de evaluación.
 * @returns Promedio de lag en ms.
 */
export async function measureEventLoopLag(durationMs: number = 500): Promise<number> {
    return new Promise((resolve) => {
        const start = performance.now();
        let lastTick = start;
        let totalLag = 0;
        let ticks = 0;

        const check = () => {
            const now = performance.now();
            const lag = now - lastTick - (1000 / 60); // Asumiendo 60fps (~16.6ms por tick)
            if (lag > 0) totalLag += lag;
            ticks++;
            lastTick = now;

            if (now - start < durationMs) {
                requestAnimationFrame(check);
            } else {
                resolve(totalLag / ticks);
            }
        };

        requestAnimationFrame(check);
    });
}
