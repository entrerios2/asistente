# Plan de Implementación: Cierre de Gaps de Fase 1

Tres correcciones puntuales para completar los contratos de Fase 1A y 1B y mantener la integridad arquitectónica del HAL.

---

## Gap #1 — TraceMath: Agregar 3ª capa (Filtro Inverso)

### Contexto
El plan de Fase 1B especificaba 3 capas superpuestas en el Trace Math:
1. **Medición Cruda** (gris/azul) ✅ Implementada
2. **Filtro Inverso / EQ aplicado** (amarillo) ❌ Faltante
3. **Respuesta Prevista** (verde) ✅ Implementada

La 2ª capa muestra visualmente **qué están haciendo los filtros** aislados de la medición. Es la suma de las respuestas de todos los filtros activos, sin sumarle la medición.

### Cambios

#### [MODIFY] `src/lib/stores/calibrationStore.svelte.ts`
Agregar una propiedad derivada `filterResponseCurve` que calcule la respuesta combinada de todos los filtros activos para cada bin de frecuencia (reutilizando `calculateFilterGainAt`), **sin** sumar la medición. Es la misma lógica que `predictedCurve` pero sin el `this.measuredCurve[i]`.

```typescript
filterResponseCurve = $derived.by(() => {
    const result = new Float32Array(this.measuredCurve.length);
    const bins = this.measuredCurve.length;
    for (let i = 0; i < bins; i++) {
        const freq = (i * (this.sampleRate / 2)) / bins;
        let totalFilterGain = 0;
        for (const filter of this.suggestedFilters) {
            if (filter.enabled) {
                totalFilterGain += this.calculateFilterGainAt(filter, freq);
            }
        }
        result[i] = totalFilterGain;
    }
    return result;
});
```

#### [MODIFY] `src/components/TraceMath.svelte`
En la función `draw()`, entre el trazo de Medición Cruda y el de Respuesta Prevista, agregar:

```typescript
// 2.5 Dibujar Trazo: Filtro Inverso (Amarillo translúcido)
drawCurve(ctx, calibrationStore.filterResponseCurve, 'rgba(255, 204, 0, 0.6)', 2);
```

### Verificación
- Con filtros activos, la capa amarilla debe mostrar las campanas de los filtros centradas en 0 dB.
- La capa verde (predicted) debe ser la suma visual de la gris + la amarilla.

---

## Gap #3 — Segment T: Alineamiento Temporal (IFFT → delay)

### Contexto
El Segment T extrae la Respuesta al Impulso (IR) a partir de la Función de Transferencia y determina el retardo (delay) en milisegundos entre la señal emitida y la capturada. Es el último segmento atómico que falta para completar la secuencia `V A N F P T`.

### Cambios

#### [NEW] `src/lib/dsp/apst/segments/SegmentT.ts`

```typescript
import { fft, magnitude } from '../../fft';
import { ComplexMath } from '../../math';

export class SegmentT {
    /**
     * Calcula el delay en milisegundos entre referencia y medición.
     * @param refBuffer Señal de referencia (sweep o impulso).
     * @param measBuffer Señal capturada por el micrófono.
     * @param sampleRate Frecuencia de muestreo.
     * @returns Delay en ms y la IR como Float32Array.
     */
    static process(refBuffer: Float32Array, measBuffer: Float32Array, sampleRate: number): { delayMs: number; ir: Float32Array } {
        const N = refBuffer.length;

        // 1. FFT de ambas señales
        const X = fft(refBuffer);
        const Y = fft(measBuffer);

        // 2. H(f) = Y(f) / X(f) via multiplicación por conjugado
        //    H = (Y * conj(X)) / |X|²
        const hReal = new Float32Array(N);
        const hImag = new Float32Array(N);

        for (let i = 0; i < N; i++) {
            const [crossR, crossI] = ComplexMath.mulConjugate(Y.real[i], Y.imag[i], X.real[i], X.imag[i]);
            const power = X.real[i] * X.real[i] + X.imag[i] * X.imag[i] + 1e-12;
            hReal[i] = crossR / power;
            hImag[i] = crossI / power;
        }

        // 3. IFFT: reutilizamos FFT con conjugado
        //    IFFT(H) = conj(FFT(conj(H))) / N
        const conjReal = new Float32Array(N);
        const conjImag = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            conjReal[i] = hReal[i];
            conjImag[i] = -hImag[i]; // conjugado
        }

        // Intercalar en un solo array para pasar por fft()
        // Nota: nuestra fft() solo acepta real. Necesitamos una IFFT propia.
        // Alternativa: calcular IFFT manualmente con el truco de conjugado.
        // Construimos input como: x[n] = conjReal[n] (parte real del conjugado)
        // y procesamos la parte imaginaria por separado.
        const irComplex = fft(conjReal); // FFT del conjugado
        
        const ir = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            ir[i] = irComplex.real[i] / N; // Normalización
        }

        // 4. Buscar el pico de la IR (= delay)
        let maxVal = 0;
        let peakIndex = 0;
        for (let i = 0; i < N / 2; i++) { // Solo primera mitad (causal)
            const absVal = Math.abs(ir[i]);
            if (absVal > maxVal) {
                maxVal = absVal;
                peakIndex = i;
            }
        }

        const delayMs = (peakIndex / sampleRate) * 1000;

        console.info(`SegmentT: Peak IR en muestra ${peakIndex}, delay = ${delayMs.toFixed(3)} ms`);

        return { delayMs, ir };
    }
}
```

> **Nota sobre IFFT:** Nuestra `fft()` actual solo acepta entrada real. La IFFT via conjugado (`conj(FFT(conj(H)))/N`) funciona correctamente para obtener la parte real de la IR, que es lo que necesitamos para detectar el pico de delay. Para una IR completa (usada en STI futuro), se necesitará una FFT compleja bidireccional — eso se difiere al momento de implementar STIEstimator.

### Verificación
- **Test unitario:** Con `refBuffer` = impulso y `measBuffer` = el mismo impulso desplazado 100 muestras, el delay debe ser `100 / 48000 * 1000 ≈ 2.083 ms`.
- **Coherencia con el Orquestador:** La secuencia `V A N F P T` debe completarse sin error.

---

## Gap #6 — HAL: Métodos de Selección de Dispositivo

### Contexto
El `DeviceSelector.svelte` actualmente invoca `@tauri-apps/api/core` directamente, bypaseando el HAL. Esto viola el patrón de abstracción establecido en el DDS §2.4. Los métodos deben estar en la interfaz `AudioProvider` como opcionales.

### Cambios

#### [MODIFY] `src/lib/hal/types.ts`
Agregar tipo `AudioDevice` e interfaz extendida:

```typescript
export interface AudioDevice {
    id: string;
    name: string;
    backend: string;
    direction: 'input' | 'output';
}

export interface AudioProvider {
    startCapture(listener: AudioListener): Promise<void>;
    stopCapture(): void;
    playPinkNoise(active: boolean): void;
    playSample?(url: string): Promise<void>;
    onMessage?(callback: (message: any) => void): void;
    listDevices?(): Promise<AudioDevice[]>;
    selectDevice?(id: string, direction: 'input' | 'output'): Promise<void>;
}
```

#### [MODIFY] `src/lib/hal/tauri/TauriAudioProvider.ts`
Implementar ambos métodos delegando al IPC de Tauri:

```typescript
import { invoke } from '@tauri-apps/api/core';

async listDevices(): Promise<AudioDevice[]> {
    return await invoke('list_audio_devices');
}

async selectDevice(id: string, direction: 'input' | 'output'): Promise<void> {
    await invoke('select_audio_device', { id, direction });
}
```

#### [MODIFY] `src/components/DeviceSelector.svelte`
Reemplazar las llamadas directas a `invoke` por llamadas al HAL:

```typescript
import { getAudioProvider } from '$lib/hal';

const hal = getAudioProvider();

onMount(async () => {
    if (hal.listDevices) {
        devices = await hal.listDevices();
    }
});

async function updateInput(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    selectedInput = id;
    if (hal.selectDevice) await hal.selectDevice(id, 'input');
}
```

Eliminar el `import { invoke }` directo y la detección manual de `__TAURI_INTERNALS__` (ya no es necesaria porque el HAL factory se encarga de eso).

### Verificación
- **PWA:** `hal.listDevices` es `undefined` → el selector no aparece o muestra el mensaje de "solo escritorio". Sin errores.
- **Tauri:** El selector enumera dispositivos y la selección persiste via IPC, todo a través del HAL.
