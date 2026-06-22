/**
 * Genetic Algorithm optimizer — pure TypeScript, zero dependencies.
 * Global optimizer for AutoEQ filter parameters.
 */

export interface GAOptions {
    population: number;
    maxIterations: number;
    mutationRate: number;
    crossoverRate: number;
    elitism: number;        // number of top individuals that pass directly
    tournamentSize: number;
}

export interface GAResult {
    x: number[];
    fval: number;
    iterations: number;
}

const DEFAULTS: GAOptions = {
    population: 50,
    maxIterations: 200,
    mutationRate: 0.1,
    crossoverRate: 0.8,
    elitism: 2,
    tournamentSize: 3,
};

/**
 * Genetic Algorithm optimization.
 * @param fn  Objective function to minimize
 * @param dimensions  Number of parameters
 * @param bounds  [min, max] per dimension
 * @param opts  Options
 * @param x0  Optional initial best guess (seeded into population)
 * @param onProgress  Optional callback per generation
 */
export function geneticOptimize(
    fn: (x: number[]) => number,
    dimensions: number,
    bounds: [number, number][],
    opts?: Partial<GAOptions>,
    x0?: number[],
    onProgress?: (gen: number, bestCost: number) => void,
): GAResult {
    const o = { ...DEFAULTS, ...opts };
    const N = o.population;
    const D = dimensions;

    // Initialize population
    let population: number[][] = new Array(N);
    let fitness: number[] = new Array(N);

    for (let i = 0; i < N; i++) {
        const individual = new Array(D);
        for (let d = 0; d < D; d++) {
            const lo = bounds[d][0];
            const hi = bounds[d][1];
            individual[d] = (i === 0 && x0) ? x0[d] : lo + Math.random() * (hi - lo);
        }
        population[i] = individual;
        fitness[i] = fn(individual);
    }

    let bestIdx = 0;
    for (let i = 1; i < N; i++) {
        if (fitness[i] < fitness[bestIdx]) bestIdx = i;
    }
    let gBest = [...population[bestIdx]];
    let gBestCost = fitness[bestIdx];

    // Tournament selection
    function select(): number[] {
        let bestT = Math.floor(Math.random() * N);
        for (let t = 1; t < o.tournamentSize; t++) {
            const candidate = Math.floor(Math.random() * N);
            if (fitness[candidate] < fitness[bestT]) bestT = candidate;
        }
        return [...population[bestT]];
    }

    // Uniform crossover
    function crossover(p1: number[], p2: number[]): number[] {
        const child = new Array(D);
        for (let d = 0; d < D; d++) {
            child[d] = Math.random() < 0.5 ? p1[d] : p2[d];
        }
        return child;
    }

    // Gaussian mutation
    function mutate(individual: number[]) {
        for (let d = 0; d < D; d++) {
            if (Math.random() < o.mutationRate) {
                const range = bounds[d][1] - bounds[d][0];
                const perturbation = (Math.random() * 2 - 1) * range * 0.1;
                individual[d] = Math.max(bounds[d][0], Math.min(bounds[d][1], individual[d] + perturbation));
            }
        }
    }

    let iterations = 0;
    for (; iterations < o.maxIterations; iterations++) {
        const newPop: number[][] = new Array(N);
        const newFit: number[] = new Array(N);

        // Sort by fitness for elitism
        const indices = Array.from({ length: N }, (_, i) => i);
        indices.sort((a, b) => fitness[a] - fitness[b]);

        // Elitism: copy top individuals directly
        for (let i = 0; i < o.elitism && i < N; i++) {
            newPop[i] = [...population[indices[i]]];
            newFit[i] = fitness[indices[i]];
        }

        // Fill rest with offspring
        for (let i = o.elitism; i < N; i++) {
            const p1 = select();
            if (Math.random() < o.crossoverRate) {
                const p2 = select();
                newPop[i] = crossover(p1, p2);
            } else {
                newPop[i] = p1;
            }
            mutate(newPop[i]);
            newFit[i] = fn(newPop[i]);
        }

        population = newPop;
        fitness = newFit;

        // Update global best
        for (let i = 0; i < N; i++) {
            if (fitness[i] < gBestCost) {
                gBestCost = fitness[i];
                gBest = [...population[i]];
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
