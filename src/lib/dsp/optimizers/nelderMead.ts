/**
 * Nelder-Mead (Simplex Downhill) optimizer — pure TypeScript, zero dependencies.
 * Used for local refinement of AutoEQ filter parameters.
 */

export interface NMOptions {
    maxIterations: number;
    tolerance: number;
    alpha: number;   // reflection coeff (1.0)
    gamma: number;   // expansion coeff (2.0)
    rho: number;     // contraction coeff (0.5)
    sigma: number;   // shrink coeff (0.5)
}

export interface NMResult {
    x: number[];
    fval: number;
    iterations: number;
}

const DEFAULTS: NMOptions = {
    maxIterations: 200,
    tolerance: 1e-6,
    alpha: 1.0,
    gamma: 2.0,
    rho: 0.5,
    sigma: 0.5,
};

/**
 * Nelder-Mead simplex optimization.
 * @param fn  Objective function to minimize
 * @param x0  Initial point (N-dimensional)
 * @param opts  Options (partial, merged with defaults)
 * @param bounds  Optional soft bounds [min, max] per dimension — enforced via penalty
 * @param onProgress  Optional callback per iteration
 */
export function nelderMead(
    fn: (x: number[]) => number,
    x0: number[],
    opts?: Partial<NMOptions>,
    bounds?: [number, number][],
    onProgress?: (iter: number, fval: number) => void,
): NMResult {
    const o = { ...DEFAULTS, ...opts };
    const n = x0.length;

    // Wrap function with bounds penalty
    const evaluate = bounds
        ? (x: number[]): number => {
            let penalty = 0;
            for (let i = 0; i < n; i++) {
                if (x[i] < bounds[i][0]) penalty += (bounds[i][0] - x[i]) * 1000;
                if (x[i] > bounds[i][1]) penalty += (x[i] - bounds[i][1]) * 1000;
            }
            return fn(x) + penalty;
        }
        : fn;

    // Initialize simplex: N+1 vertices
    const simplex: number[][] = new Array(n + 1);
    const fvals: number[] = new Array(n + 1);

    simplex[0] = [...x0];
    fvals[0] = evaluate(x0);

    for (let i = 0; i < n; i++) {
        const vertex = [...x0];
        // Initial step: 5% of value or 0.05 if near zero
        vertex[i] += Math.abs(x0[i]) > 1e-10 ? x0[i] * 0.05 : 0.05;
        simplex[i + 1] = vertex;
        fvals[i + 1] = evaluate(vertex);
    }

    let iterations = 0;

    for (; iterations < o.maxIterations; iterations++) {
        // Sort simplex by function value
        const indices = Array.from({ length: n + 1 }, (_, i) => i);
        indices.sort((a, b) => fvals[a] - fvals[b]);
        const sorted = indices.map(i => simplex[i]);
        const sortedF = indices.map(i => fvals[i]);
        for (let i = 0; i <= n; i++) {
            simplex[i] = sorted[i];
            fvals[i] = sortedF[i];
        }

        // Convergence check
        if (Math.abs(fvals[n] - fvals[0]) < o.tolerance) break;

        // Centroid of all vertices except the worst
        const centroid = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                centroid[j] += simplex[i][j];
            }
        }
        for (let j = 0; j < n; j++) centroid[j] /= n;

        // Reflection
        const xr = new Array(n);
        for (let j = 0; j < n; j++) xr[j] = centroid[j] + o.alpha * (centroid[j] - simplex[n][j]);
        const fr = evaluate(xr);

        if (fr < fvals[0]) {
            // Expansion
            const xe = new Array(n);
            for (let j = 0; j < n; j++) xe[j] = centroid[j] + o.gamma * (xr[j] - centroid[j]);
            const fe = evaluate(xe);
            if (fe < fr) {
                simplex[n] = xe;
                fvals[n] = fe;
            } else {
                simplex[n] = xr;
                fvals[n] = fr;
            }
        } else if (fr < fvals[n - 1]) {
            simplex[n] = xr;
            fvals[n] = fr;
        } else {
            // Contraction
            const xc = new Array(n);
            if (fr < fvals[n]) {
                // Outside contraction
                for (let j = 0; j < n; j++) xc[j] = centroid[j] + o.rho * (xr[j] - centroid[j]);
            } else {
                // Inside contraction
                for (let j = 0; j < n; j++) xc[j] = centroid[j] + o.rho * (simplex[n][j] - centroid[j]);
            }
            const fc = evaluate(xc);

            if (fc < Math.min(fr, fvals[n])) {
                simplex[n] = xc;
                fvals[n] = fc;
            } else {
                // Shrink — move all vertices toward the best
                for (let i = 1; i <= n; i++) {
                    for (let j = 0; j < n; j++) {
                        simplex[i][j] = simplex[0][j] + o.sigma * (simplex[i][j] - simplex[0][j]);
                    }
                    fvals[i] = evaluate(simplex[i]);
                }
            }
        }

        if (onProgress) onProgress(iterations, fvals[0]);
    }

    // Find best
    let bestIdx = 0;
    for (let i = 1; i <= n; i++) {
        if (fvals[i] < fvals[bestIdx]) bestIdx = i;
    }

    return {
        x: simplex[bestIdx],
        fval: fvals[bestIdx],
        iterations,
    };
}
