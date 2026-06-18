# Prompts de Implementación — Correcciones Pipeline DSP Real

Este documento contiene instrucciones atómicas para corregir bugs y agregar controles UI faltantes al pipeline DSP dual-channel. El proyecto es una SPA SvelteKit con Svelte 5 runes (`$state`, `$derived`, `$effect`).

## ⛔ REGLAS OBLIGATORIAS — Leer antes de empezar

1. **NO AVANCES al siguiente Grupo (A→B→C→D) sin recibir aprobación explícita del usuario.** Al terminar cada grupo, reporta lo hecho y ESPERA instrucciones.
2. **NO MODIFIQUES archivos que no estén explícitamente listados en la tarea.** Si descubrís que se necesita un cambio adicional, reportalo y esperá aprobación.
3. **NO AGREGUES funcionalidad nueva** que no esté especificada en la tarea. No refactorices código adyacente "de paso". No agregues logs, tests, ni comentarios extra.
4. **NO ELIMINES comentarios existentes** a menos que la tarea lo indique expresamente.
5. **NO CAMBIES la lógica de negocio** salvo que la tarea lo especifique.
6. **Verificá con `npm run build` al final de cada grupo.** Si falla, corregí solo lo necesario para que compile sin inventar soluciones propias.
7. **Si algo no queda claro, PREGUNTÁ** en vez de asumir.

---

# GRUPO A — Bugs críticos en WebAudioProvider y TabMedicion

---

## Tarea A1: Fix race condition SAB — copias defensivas

**Archivo a modificar:** `src/lib/hal/web/WebAudioProvider.ts`

**Contexto:** En `readData()` (~L135-139), cuando `hasSAB=true`, se crea un `new Float32Array(this.refSab)` que es una **VIEW** sobre el SharedArrayBuffer, no una copia. El worklet sigue escribiendo en el SAB mientras el main thread lee, causando datos parcialmente sobrescritos y medición intermitente.

**Instrucción:** Reemplazar las views por copias defensivas. Buscar (~L135-139):

```typescript
				if (hasSAB && this.refSab && this.measSab) {
					// Leer desde SAB (el worklet ya los llena)
					const refData = new Float32Array(this.refSab);
					const measData = new Float32Array(this.measSab);
					listener.onTimeDomainData(measData, refData);
```

Reemplazar por:

```typescript
				if (hasSAB && this.refSab && this.measSab) {
					// Copias defensivas — el worklet sigue escribiendo en el SAB
					const refData = Float32Array.from(new Float32Array(this.refSab));
					const measData = Float32Array.from(new Float32Array(this.measSab));
					listener.onTimeDomainData(measData, refData);
```

---

## Tarea A2: Fix doble conexión del AnalyserNode

**Archivo a modificar:** `src/lib/hal/web/WebAudioProvider.ts`

**Contexto:** En `startCapture()`, el `analyserNode` se conecta dos veces:
- L67: `source.connect(this.analyserNode)` — conecta el source stereo completo (L+R mix)
- L85: `this.splitterNode.connect(this.analyserNode!, measCh)` — conecta solo el canal de medición

Resultado: el analyserNode recibe señal duplicada/superpuesta, contaminando la data RTA.

**Instrucción:** Reemplazar el bloque L62-85 completo. Buscar:

```typescript
		// Analyser para RTA (Fast-Path)
		this.analyserNode = this.audioContext.createAnalyser();
		this.analyserNode.fftSize = 8192; // Mayor resolución para RTA
		this.analyserNode.smoothingTimeConstant = 0.2;
		this.freqDataArray = new Float32Array(this.analyserNode.frequencyBinCount);
		source.connect(this.analyserNode);

		// Dual-channel: separar L/R para captura independiente
		this.splitterNode = this.audioContext.createChannelSplitter(2);
		source.connect(this.splitterNode);

		// AnalyserNode dedicado para canal de referencia
		this.analyserRef = this.audioContext.createAnalyser();
		this.analyserRef.fftSize = uiStore.fftSize;
		this.analyserRef.smoothingTimeConstant = 0;

		// Conectar canales según routing del usuario
		const refCh = uiStore.refChannel;
		const measCh = uiStore.measChannel;
		this.splitterNode.connect(this.analyserRef, refCh);

		// Reasignar analyserNode existente al canal de medición
		this.analyserNode!.smoothingTimeConstant = 0;
		this.splitterNode.connect(this.analyserNode!, measCh);
```

Reemplazar por:

```typescript
		// Dual-channel: separar L/R para captura independiente
		this.splitterNode = this.audioContext.createChannelSplitter(2);
		source.connect(this.splitterNode);

		// Analyser para RTA — conectar SOLO el canal de medición (no el source directo)
		this.analyserNode = this.audioContext.createAnalyser();
		this.analyserNode.fftSize = 8192;
		this.analyserNode.smoothingTimeConstant = 0.2;
		this.freqDataArray = new Float32Array(this.analyserNode.frequencyBinCount);

		// AnalyserNode dedicado para canal de referencia
		this.analyserRef = this.audioContext.createAnalyser();
		this.analyserRef.fftSize = uiStore.fftSize;
		this.analyserRef.smoothingTimeConstant = 0;

		// Conectar cada canal del splitter a su analyser dedicado
		const refCh = uiStore.refChannel;
		const measCh = uiStore.measChannel;
		this.splitterNode.connect(this.analyserRef, refCh);
		this.splitterNode.connect(this.analyserNode, measCh);
```

---

## Tarea A3: Eliminar propiedades legacy sin uso

**Archivo a modificar:** `src/lib/hal/web/WebAudioProvider.ts`

**Instrucción:**

### Paso 1: Eliminar las propiedades de clase (~L21-22)

Buscar:

```typescript
	private sab: SharedArrayBuffer | null = null;
	private sharedArray: Float32Array | null = null;
```

Eliminar ambas líneas.

### Paso 2: Actualizar `getSharedBuffer()` (~L354-356)

Buscar:

```typescript
	getSharedBuffer(): SharedArrayBuffer | null {
		return this.sab;
	}
```

Reemplazar por:

```typescript
	getSharedBuffer(): SharedArrayBuffer | null {
		return this.refSab;
	}
```

---

## Tarea A4: Fix glitch del generador al iniciar medición

**Archivos a modificar:** `src/lib/hal/web/WebAudioProvider.ts` y `src/components/medicion/TabMedicion.svelte`

**Contexto:** `playGenerator()` es destructivo — cada llamada desconecta y destruye el nodo de audio existente antes de crear uno nuevo. El `$effect` reactivo en TabMedicion se re-dispara durante `startCapture()`, causando un glitch audible (corte breve del generador).

### Paso 1: Agregar state tracking al WebAudioProvider

**Archivo:** `src/lib/hal/web/WebAudioProvider.ts`

Después de la línea `private pannerNode: StereoPannerNode | null = null;` (~L38), agregar:

```typescript
	// Generator state tracking (prevent unnecessary recreation)
	private lastGenType: string | null = null;
	private lastGenActive: boolean = false;
	private lastGenFreq: number = 0;
	private lastGenLevel: number = 0;
	private lastGenRouting: string = '';
```

### Paso 2: Agregar early-return idempotente a playGenerator()

**Archivo:** `src/lib/hal/web/WebAudioProvider.ts`

Al inicio de `playGenerator()` (~L207), DESPUÉS de la firma de la función y ANTES de `if (!this.audioContext)`, agregar:

```typescript
		// Skip if nothing changed — prevents glitch on reactive re-evaluation
		if (
			type === this.lastGenType &&
			active === this.lastGenActive &&
			freq === this.lastGenFreq &&
			level === this.lastGenLevel &&
			routing === this.lastGenRouting
		) {
			return;
		}
		this.lastGenType = type;
		this.lastGenActive = active;
		this.lastGenFreq = freq;
		this.lastGenLevel = level;
		this.lastGenRouting = routing;
```

Es decir, la función queda:

```typescript
	playGenerator(type: SignalType, active: boolean, freq: number, level: number, routing: 'L' | 'R' | 'Stereo'): void {
		// Skip if nothing changed — prevents glitch on reactive re-evaluation
		if (
			type === this.lastGenType &&
			active === this.lastGenActive &&
			freq === this.lastGenFreq &&
			level === this.lastGenLevel &&
			routing === this.lastGenRouting
		) {
			return;
		}
		this.lastGenType = type;
		this.lastGenActive = active;
		this.lastGenFreq = freq;
		this.lastGenLevel = level;
		this.lastGenRouting = routing;

		if (!this.audioContext) {
			// ... resto sin cambios
```

### Paso 3: Mover encendido del generador después de startCapture()

**Archivo:** `src/components/medicion/TabMedicion.svelte`

Buscar en `startMeasurement()` (~L160-183):

```typescript
    async function startMeasurement() {
        // Encender generador si está vinculado (F27)
        if (uiStore.linkGeneratorToMeasurement && !uiStore.genActive) {
            uiStore.genActive = true;
        }

        progress = 0;
        statusText = "Iniciando captura...";
        try {
            if (uiStore.measurementMode === "manual") {
                await provider.startCapture({
                    onAudioData: () => {},
                    onFrequencyData: (data) => {
                        if (traceManager.liveFrequencyData.length !== data.length) {
                            traceManager.liveFrequencyData = new Float32Array(data.length);
                        }
                        traceManager.liveFrequencyData.set(data);
                        traceManager.version++;
                    },
                    onTimeDomainData: (measSamples, refSamples) => {
                        mathOrchestrator.feedTimeDomain(measSamples, refSamples);
                    },
                });
                statusText = "Medición en vivo activa";
```

Reemplazar por:

```typescript
    async function startMeasurement() {
        progress = 0;
        statusText = "Iniciando captura...";
        try {
            if (uiStore.measurementMode === "manual") {
                await provider.startCapture({
                    onAudioData: () => {},
                    onFrequencyData: (data) => {
                        if (traceManager.liveFrequencyData.length !== data.length) {
                            traceManager.liveFrequencyData = new Float32Array(data.length);
                        }
                        traceManager.liveFrequencyData.set(data);
                        traceManager.version++;
                    },
                    onTimeDomainData: (measSamples, refSamples) => {
                        mathOrchestrator.feedTimeDomain(measSamples, refSamples);
                    },
                });
                // Encender generador DESPUÉS de que la captura esté lista
                // para evitar glitch por recreación del AudioContext
                if (uiStore.linkGeneratorToMeasurement && !uiStore.genActive) {
                    uiStore.genActive = true;
                }
                statusText = "Medición en vivo activa";
```

**IMPORTANTE:** El bloque de encendido del generador se MUEVE de antes de `progress = 0` a después del `await provider.startCapture()`, pero ANTES de `statusText = "Medición en vivo activa"`.

---

## Verificación Grupo A

```bash
npm run build
```

Verificación manual:
1. Generar ruido rosa → verificar que suena sin cortes
2. Activar "Vincular Generador al medir" → pulsar "Medir" → el generador debe encenderse SIN glitch
3. Detener medición → generador debe apagarse si estaba vinculado
4. Magnitude debe mostrarse siempre que se mide (no intermitente)

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo B.

---

# GRUPO B — Controles UI en TabConfig

---

## Tarea B1: Agregar sección Routing Dual-Channel

**Archivo a modificar:** `src/components/medicion/TabConfig.svelte`

**Instrucción:** Insertar el siguiente bloque **después** de la sección "Canal de Referencia & Loopback" (~L554), justo antes del cierre `</div>` de la card "Hardware de Audio" (~L555):

```html
        <!-- Routing Dual-Channel -->
        <div class="flex flex-col gap-3 pt-2 border-t border-[#1a1a24]/20">
            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Routing Dual-Channel
            </span>

            <div class="grid grid-cols-2 gap-3">
                <!-- Canal de Referencia -->
                <div class="flex flex-col gap-1.5">
                    <label
                        class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                        >Canal Ref (X)</label
                    >
                    <select
                        bind:value={uiStore.refChannel}
                        class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-[#3b82f6]"
                    >
                        <option value={0}>Canal 1 (L)</option>
                        <option value={1}>Canal 2 (R)</option>
                    </select>
                </div>

                <!-- Canal de Medición -->
                <div class="flex flex-col gap-1.5">
                    <label
                        class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                        >Canal Meas (Y)</label
                    >
                    <select
                        bind:value={uiStore.measChannel}
                        class="w-full bg-[#121216] border border-[#1a1a24] rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-[#3b82f6]"
                    >
                        <option value={0}>Canal 1 (L)</option>
                        <option value={1}>Canal 2 (R)</option>
                    </select>
                </div>
            </div>
        </div>
```

Debe insertarse DENTRO de la card "Hardware de Audio" (la que empieza con `<!-- AUDIO HARDWARE CARD -->` en ~L424).

---

## Tarea B2: Agregar controles FFT Overlap y Delay Compensation

**Archivo a modificar:** `src/components/medicion/TabConfig.svelte`

**Instrucción:** Insertar el siguiente bloque **después** del bloque "FFT Size" (~L420), dentro de la sección "Procesamiento DSP". Buscar la línea que contiene `</div>` que cierra el `<div>` del FFT Size select (~L420), e insertar DESPUÉS:

```html
            <div class="flex items-center gap-2">
                <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Overlap</span>
                <select
                    bind:value={uiStore.fftOverlap}
                    class="flex-1 bg-[#121216] border border-[#1a1a24] rounded px-2 py-1 text-xs text-gray-200"
                >
                    <option value={0}>0% (Sin overlap)</option>
                    <option value={0.5}>50%</option>
                    <option value={0.75}>75%</option>
                </select>
            </div>

            <!-- Delay Compensation -->
            <div class="flex flex-col gap-2 pt-2 border-t border-[#1a1a24]/20">
                <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                        type="checkbox"
                        bind:checked={uiStore.autoDelayCompensation}
                        class="w-4 h-4 rounded accent-[#ec4899] cursor-pointer"
                    />
                    <span class="font-semibold select-none">Auto Delay Compensation</span>
                </label>
                {#if !uiStore.autoDelayCompensation}
                    <div class="flex items-center gap-2 pl-6">
                        <span class="text-[9px] text-gray-500 font-bold uppercase w-14">Delay</span>
                        <input
                            type="range" min="0" max="100" step="0.1"
                            bind:value={uiStore.compensationDelayMs}
                            ondblclick={() => uiStore.compensationDelayMs = 0}
                            class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                        />
                        <span class="text-[10px] font-mono text-[#ec4899] w-14 text-right">
                            {uiStore.compensationDelayMs.toFixed(1)} ms
                        </span>
                    </div>
                {/if}
            </div>
```

---

## Tarea B3: Agregar slider de Averaging Threshold

**Archivo a modificar:** `src/components/medicion/TabConfig.svelte`

**Instrucción:** Insertar el siguiente bloque **después** del último `{/if}` del bloque de averaging (~L303), justo antes del cierre `</div>` de la sección "Promediado (Averaging)". Buscar la línea `{/if}` que cierra el bloque `{:else if uiStore.averagingType === 'LPF'}` (~L303), e insertar DESPUÉS:

```html
            {#if uiStore.averagingType !== 'None'}
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[9px] text-gray-500 font-bold uppercase w-16">Thresh</span>
                    <input
                        type="range" min="-120" max="-20" step="1"
                        bind:value={uiStore.averagingThresholdDb}
                        ondblclick={() => uiStore.averagingThresholdDb = -60}
                        class="flex-1 h-1 bg-[#121216] rounded-lg appearance-none cursor-pointer accent-[#ec4899]"
                        title="Doble clic para reiniciar a -60 dBFS"
                    />
                    <span class="text-[10px] font-mono text-[#ec4899] w-12 text-right">
                        {uiStore.averagingThresholdDb} dB
                    </span>
                </div>
            {/if}
```

---

## Verificación Grupo B

```bash
npm run build
```

Verificación visual:
1. Tab Configuración → sección "Hardware de Audio" → verificar que aparecen los dropdowns "Canal Ref (X)" y "Canal Meas (Y)"
2. Tab Configuración → sección "Procesamiento DSP" → verificar que aparece el selector de Overlap debajo de FFT Size
3. Tab Configuración → sección "Procesamiento DSP" → verificar que aparece el checkbox "Auto Delay Compensation" y que al desactivarlo aparece el slider de delay
4. Tab Configuración → sección "Procesamiento DSP" → seleccionar averaging FIFO o LPF → verificar que aparece el slider "Thresh" con valor en dB

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo C.

---

# GRUPO C — Propagación de Averaging Threshold

---

## Tarea C1: Agregar averagingThresholdDb al postMessage del orchestrator

**Archivo a modificar:** `src/lib/stores/mathOrchestrator.svelte.ts`

**Instrucción:** En `run()` (~L336), buscar la línea:

```typescript
                averagingAlpha: uiStore.averagingAlpha,
```

Agregar DESPUÉS:

```typescript
                averagingThresholdDb: uiStore.averagingThresholdDb,
```

---

## Tarea C2: Usar threshold en dspWorker

**Archivo a modificar:** `src/lib/dsp/dspWorker.ts`

### Paso 1: Agregar al destructuring

Buscar en el handler `self.onmessage` (~L108-125), la línea:

```typescript
            averagingAlpha,
```

Agregar DESPUÉS:

```typescript
            averagingThresholdDb,
```

### Paso 2: Pasar threshold a processFIFO

Buscar (~L226):

```typescript
                averagingProcessor.processFIFO(hReal, hImag, avgHReal, avgHImag);
```

Reemplazar por:

```typescript
                averagingProcessor.processFIFO(hReal, hImag, avgHReal, avgHImag, averagingThresholdDb);
```

---

## Verificación Grupo C

```bash
npm run build
```

### ⛔ STOP — Reportá los cambios hechos y esperá aprobación del usuario para continuar al Grupo D.

---

# GRUPO D — Verificación Visual Completa

No hay cambios de código. Verificación manual:

- [ ] Magnitude se muestra **siempre** al medir (no intermitente)
- [ ] RTA (Spectrum) muestra solo el canal de medición (sin mezcla estéreo)
- [ ] Cambiar canal Ref/Meas en TabConfig invierte las señales
- [ ] Selector de overlap aparece en DSP config
- [ ] Auto delay checkbox funciona
- [ ] Slider de threshold aparece cuando averaging ≠ None
- [ ] Generador + medición vinculados: NO hay corte/glitch al iniciar
- [ ] Generador solo (sin medición): sin cambios de comportamiento

### ⛔ STOP — Correcciones completadas. Reportá resultados al usuario.

---

# Resumen de archivos por tarea

| Tarea | Archivo | Tipo |
|-------|---------|:----:|
| A1 | `src/lib/hal/web/WebAudioProvider.ts` | Fix |
| A2 | `src/lib/hal/web/WebAudioProvider.ts` | Fix |
| A3 | `src/lib/hal/web/WebAudioProvider.ts` | Cleanup |
| A4 | `src/lib/hal/web/WebAudioProvider.ts` | Fix |
| A4 | `src/components/medicion/TabMedicion.svelte` | Fix |
| B1 | `src/components/medicion/TabConfig.svelte` | UI |
| B2 | `src/components/medicion/TabConfig.svelte` | UI |
| B3 | `src/components/medicion/TabConfig.svelte` | UI |
| C1 | `src/lib/stores/mathOrchestrator.svelte.ts` | Fix |
| C2 | `src/lib/dsp/dspWorker.ts` | Fix |
