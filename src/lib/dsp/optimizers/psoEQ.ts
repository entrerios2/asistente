/**
 * Particle Swarm Optimization (PSO) — pure TypeScript, zero dependencies.
 * Global optimizer for AutoEQ filter parameters.
 */

export interface PSOOptions {
    population: number;
    maxIterations: number;
    inertia: number;       // w: 0.7
    cognitive: number;     // c1: 1.5
    social: number;        // c2: 1.5
}

export interface PSOResult {
    x: number[];
    fval: number;
    iterations: number;
}

const DEFAULTS: PSOOptions = {
    population: 30,
    maxIterations: 200,
    inertia: 0.7,
    cognitive: 1.5,
    social: 1.5,
};

/**
 * Particle Swarm Optimization.
 * @param fn  Objective function to minimize
 * @param dimensions  Number of parameters
 * @param bounds  [min, max] per dimension
 * @param opts  Options
 * @param x0  Optional initial best guess (seeded as first particle)
 * @param onProgress  Optional callback per iteration
 */
export function particleSwarm(
    fn: (x: number[]) => number,
    dimensions: number,
    bounds: [number, number][],
    opts?: Partial<PSOOptions>,
    x0?: number[],
    onProgress?: (iter: number, bestCost: number) => void,
): PSOResult {
    const o = { ...DEFAULTS, ...opts };
    const N = o.population;
    const D = dimensions;

    // Initialize particles
    const positions: number[][] = new Array(N);
    const velocities: number[][] = new Array(N);
    const pBest: number[][] = new Array(N);
    const pBestCost: number[] = new Array(N);

    let gBest: number[] = new Array(D);
    let gBestCost = Infinity;

    for (let i = 0; i < N; i++) {
        const pos = new Array(D);
        const vel = new Array(D);

        for (let d = 0; d < D; d++) {
            const lo = bounds[d][0];
            const hi = bounds[d][1];
            const range = hi - lo;
            // First particle uses x0 if provided
            pos[d] = (i === 0 && x0) ? x0[d] : lo + Math.random() * range;
            vel[d] = (Math.random() - 0.5) * range * 0.1;
        }

        positions[i] = pos;
        velocities[i] = vel;
        pBest[i] = [...pos];

        const cost = fn(pos);
        pBestCost[i] = cost;

        if (cost < gBestCost) {
            gBestCost = cost;
            gBest = [...pos];
        }
    }

    let iterations = 0;
    for (; iterations < o.maxIterations; iterations++) {
        for (let i = 0; i < N; i++) {
            const pos = positions[i];
            const vel = velocities[i];

            // Update velocity and position
            for (let d = 0; d < D; d++) {
                const r1 = Math.random();
                const r2 = Math.random();
                vel[d] = o.inertia * vel[d]
                    + o.cognitive * r1 * (pBest[i][d] - pos[d])
                    + o.social * r2 * (gBest[d] - pos[d]);

                pos[d] += vel[d];

                // Clamp to bounds
                if (pos[d] < bounds[d][0]) { pos[d] = bounds[d][0]; vel[d] *= -0.5; }
                if (pos[d] > bounds[d][1]) { pos[d] = bounds[d][1]; vel[d] *= -0.5; }
            }

            // Evaluate
            const cost = fn(pos);

            if (cost < pBestCost[i]) {
                pBestCost[i] = cost;
                pBest[i] = [...pos];

                if (cost < gBestCost) {
                    gBestCost = cost;
                    gBest = [...pos];
                }
            }
        }

        if (onProgress) onProgress(iterations, gBestCost);
    }

    return {
        x: gBest,
        fval: gBestCost,
        iterations,
    };
}
