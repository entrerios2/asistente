/**
 * Store para la gestión de la curva objetivo (Target Trace).
 */

export interface TargetPoint {
    f: number;
    g: number;
}

class TargetTraceStore {
    points = $state<TargetPoint[]>([
        { f: 20, g: 0 },
        { f: 20000, g: 0 }
    ]);
    
    visible = $state(false);
    color = $state('#00ff00');
    opacity = $state(0.5);
    offset = $state(0);
    name = $state('Flat');

    applyPreset(type: 'Flat' | 'X-Curve' | 'House' | 'BK' | 'Harman') {
        this.name = type;
        if (type === 'Flat') {
            this.points = [{ f: 20, g: 0 }, { f: 20000, g: 0 }];
        } else if (type === 'X-Curve') {
            this.points = [
                { f: 20, g: 0 },
                { f: 2000, g: 0 },
                { f: 10000, g: -3 },
                { f: 20000, g: -6 }
            ];
        } else if (type === 'House') {
            this.points = [
                { f: 20, g: 6 },
                { f: 100, g: 3 },
                { f: 1000, g: 0 },
                { f: 20000, g: -2 }
            ];
        } else if (type === 'BK') {
            // B&K cinema curve — rolloff above 2 kHz
            this.points = [
                { f: 20, g: 0 },
                { f: 2000, g: 0 },
                { f: 4000, g: -1 },
                { f: 8000, g: -3 },
                { f: 16000, g: -5 },
                { f: 20000, g: -6 }
            ];
        } else if (type === 'Harman') {
            // Harman 2019 room target
            this.points = [
                { f: 20, g: 4 },
                { f: 60, g: 3 },
                { f: 200, g: 0 },
                { f: 1500, g: 0 },
                { f: 3000, g: -1 },
                { f: 5000, g: 0 },
                { f: 8000, g: -1 },
                { f: 20000, g: -2 }
            ];
        }
    }

    getInterpolatedGain(freq: number): number {
        if (this.points.length === 0) return 0;
        if (freq <= this.points[0].f) return this.points[0].g + this.offset;
        if (freq >= this.points[this.points.length - 1].f) return this.points[this.points.length - 1].g + this.offset;

        let i = 0;
        while (i < this.points.length - 1 && this.points[i + 1].f < freq) {
            i++;
        }

        const p0 = this.points[i];
        const p1 = this.points[i + 1];
        const logF = Math.log10(freq);
        const logF0 = Math.log10(p0.f);
        const logF1 = Math.log10(p1.f);
        const t = (logF - logF0) / (logF1 - logF0 || 1);
        
        return (p0.g * (1 - t) + p1.g * t) + this.offset;
    }
}

export const targetTrace = new TargetTraceStore();
