import { defaultMetricStyles, defaultMetricConfigs, type MetricConfig } from "$lib/dsp/quadrantState";

interface MetricStyle {
    color: string;
    lineWidth: number;
    lineDash: number[];
}

export interface QuadrantData {
    activeMetrics: string[];
    metricStyles: Record<string, MetricStyle>;
    metricConfigs: Record<string, MetricConfig>;
}

interface SerializableQuadrantData {
    activeMetrics: string[];
    metricStyles?: Record<string, MetricStyle>;
    metricConfigs?: Record<string, Record<string, unknown>>;
}

class QuadrantConfigStore {
    quadrants = $state<Record<string, QuadrantData>>({});

    /** Incrementado por loadFromConfig para que los cuadrantes re-sincronicen */
    loadVersion = $state(0);

    /** Incrementado por syncFromQuadrant para que el saveConfig $effect se dispare */
    saveVersion = $state(0);

    /** Llamado por cada Quadrant para reflejar sus cambios locales en el store */
    syncFromQuadrant(id: string, data: QuadrantData): void {
        this.quadrants[id] = data;
        this.saveVersion++;
    }

    loadFromConfig(config: { quadrants?: Record<string, SerializableQuadrantData> }): void {
        if (config.quadrants) {
            for (const [qId, qData] of Object.entries(config.quadrants)) {
                const styles = qData.metricStyles
                    ? JSON.parse(JSON.stringify(qData.metricStyles)) as Record<string, MetricStyle>
                    : JSON.parse(JSON.stringify(defaultMetricStyles));
                for (const key of Object.keys(styles)) {
                    if (!Array.isArray(styles[key].lineDash)) styles[key].lineDash = [];
                }
                this.quadrants[qId] = {
                    activeMetrics: qData.activeMetrics ?? ["Magnitude"],
                    metricStyles: styles,
                    metricConfigs: qData.metricConfigs
                        ? JSON.parse(JSON.stringify(qData.metricConfigs))
                        : JSON.parse(JSON.stringify(defaultMetricConfigs)),
                };
            }
            this.loadVersion++;
            this.saveVersion++;
        }
    }

    toConfig(): { quadrants?: Record<string, SerializableQuadrantData> } {
        if (Object.keys(this.quadrants).length === 0) return {};
        return { quadrants: JSON.parse(JSON.stringify(this.quadrants)) };
    }

    resetQuadrants(): void {
        this.quadrants = {};
        this.loadVersion++;
        this.saveVersion++;
    }
}

export const quadrantConfigStore = new QuadrantConfigStore();
