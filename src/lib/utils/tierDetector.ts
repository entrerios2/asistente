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
