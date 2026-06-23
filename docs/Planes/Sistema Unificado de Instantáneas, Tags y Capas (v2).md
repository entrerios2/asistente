# Plan: Sistema Unificado de Instantáneas, Tags y Capas (v2)

## Objetivo

Rediseñar el sistema de instantáneas con tags, selector unificado reutilizable (auto-EQ + capas), migrar el render de instantáneas al sistema de capas, y eliminar el loop paralelo. Todo alineado al workflow de calibración de campo.

---

## Fase 1 — Modelo de datos + DB migration

Expandir los modelos sin romper la funcionalidad existente.

### [MODIFY] [traceManager.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/traceManager.svelte.ts)

**1a. Expandir `Instantanea`**:
```typescript
interface Instantanea {
    id: string;
    name: string;
    timestamp: number;
    data: Record<string, Float32Array>;
    visible: boolean;
    color: string;
    source: 'manual' | 'secuencial';
    metric: string;          // mantener por retrocompat
    offsetY: number;

    // NUEVOS
    tags: {
        ubicacion?: string;
        posicion?: string;
        custom: string[];
    };
    sessionId?: string;
    metadata?: {
        sampleRate: number;
        fftSize: number;
        averagingDepth: number;
    };
}
```

**1b. Expandir `MeasurementLayer`** para soportar datos multi-métrica y vínculo a instantánea:
```typescript
interface MeasurementLayer {
    id: string;
    name: string;
    visible: boolean;
    isMeasuring: boolean;
    quadrantId: string;
    sourceType: 'live' | 'snapshot' | 'calculated';
    data: Float32Array;                          // (existente, para live y calculated)
    
    // NUEVOS
    instantaneaId?: string;                      // vínculo a instantánea de origen
    multiMetricData?: Record<string, Float32Array>; // datos multi-métrica (para snapshots)
    color?: string;                              // color heredado de la instantánea
    dashPattern?: number[];                      // dash heredado
    
    isCalculated?: boolean;
    calcOperation?: 'average' | 'sum' | 'subtract' | 'min' | 'max';
    calcTargetMetrics?: string[];
}
```

**1c. Agregar `Session`**:
```typescript
interface Session {
    id: string;
    name: string;
    venue?: string;
    event?: string;
    createdAt: number;
}

// En TraceManager:
sessions = $state<Session[]>([]);
activeSessionId = $state<string | null>(null);
```

**1d. Tag presets + sticky tags**:
```typescript
tagPresets = $state({
    ubicacion: ['Principal', 'Delay 1', 'Delay 2', 'Delay 3', 'Relleno', 'Subwoofer'],
    posicion: ['Izquierda', 'Centro', 'Derecha', 'Arriba', 'Abajo'],
});
lastUsedTags = $state<{ ubicacion?: string; posicion?: string }>({});
```

**1e. Palette de colores por ubicación**:
```typescript
const UBICACION_COLORS: Record<string, string> = {
    'Principal': '#00ff88',
    'Delay 1': '#06b6d4',
    'Delay 2': '#6366f1',
    'Delay 3': '#a855f7',
    'Relleno': '#f97316',
    'Subwoofer': '#ef4444',
};
```

**1f. Actualizar `captureInstantanea()`**: aceptar `tags` y `metadata`, auto-rellenar `sessionId` y `color` por ubicación.

**1g. Auto-naming helper**:
```typescript
generateSnapName(tags: { ubicacion?: string; posicion?: string }): string {
    const parts = [tags.ubicacion, tags.posicion].filter(Boolean);
    const time = new Date().toLocaleTimeString('es-AR', 
        { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return parts.length > 0 ? `${parts.join(' · ')} · ${time}` : time;
}
```

**1h. Nuevo `addSnapshotLayer()`**: método para crear capa snapshot vinculada con datos multi-métrica:
```typescript
addSnapshotLayer(instantanea: Instantanea, quadrantId: string): MeasurementLayer {
    const layer: MeasurementLayer = {
        id: crypto.randomUUID(),
        name: instantanea.name,
        visible: true,
        isMeasuring: false,
        quadrantId,
        sourceType: 'snapshot',
        data: instantanea.data['Magnitude'] || new Float32Array(0),
        instantaneaId: instantanea.id,
        multiMetricData: { ...instantanea.data }, // copia de referencia
        color: instantanea.color,
    };
    this.layers.push(layer);
    return layer;
}
```

**1i. Retrocompatibilidad en `loadFromDB()`**: si un registro no tiene `tags`, asignar `{ custom: [] }`.

### [MODIFY] [db.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/utils/db.ts)

**1j. DB version 1→2**: incrementar `DB_VERSION`. En `onupgradeneeded`, agregar store `sessions`. Expandir `SerializedInstantanea` con `tags`, `sessionId`, `metadata`.

**1k. CRUD de sessions**: `saveSession()`, `loadAllSessions()`, `deleteSession()`.

---

## Fase 2 — Migrar render de instantáneas al sistema de capas

Eliminar el loop paralelo en quadrantDraw.ts. Las instantáneas visibles se renderizan como capas.

### [MODIFY] [traceManager.svelte.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/stores/traceManager.svelte.ts)

**2a. Nuevo `syncSnapshotVisibility()`**: cuando `instantanea.visible` cambia, auto-crear/eliminar capas snapshot en los cuadrantes activos:
```typescript
syncSnapshotVisibility(snapId: string, visible: boolean) {
    const snap = this.instantaneas.find(s => s.id === snapId);
    if (!snap) return;
    
    if (visible) {
        // Crear capa snapshot en el primer cuadrante (o en todos los activos)
        const existingLayer = this.layers.find(l => l.instantaneaId === snapId);
        if (!existingLayer) {
            this.addSnapshotLayer(snap, 'q-1');
        }
    } else {
        // Eliminar capas vinculadas a esta instantánea
        this.layers = this.layers.filter(l => l.instantaneaId !== snapId);
    }
}
```

**2b. Actualizar `toggleVisibility()`**: llamar `syncSnapshotVisibility()`.

### [MODIFY] [quadrantDraw.ts](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/dsp/quadrantDraw.ts)

**2c. Eliminar el loop paralelo de instantáneas** (L444-518, ~75 líneas). Ya no se necesita porque las instantáneas visibles ahora son capas.

**2d. Actualizar el loop de capas** (L221-252 y L280-420) para soportar `multiMetricData`:
- Si `layer.sourceType === 'snapshot' && layer.multiMetricData`, para cada métrica activa del cuadrante, dibujar `layer.multiMetricData[metric]` en vez de `layer.data`.
- Aplicar `layer.color` (heredado de la instantánea).
- Aplicar `offsetY` de la instantánea origen (lookup por `instantaneaId`).
- Usar dash pattern diferenciado para snapshot layers.

**2e. Eliminar `instantaneas` de `DrawParams`**: ya no se pasan al renderer.

### [MODIFY] [Quadrant.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Quadrant.svelte)

**2f. Dejar de pasar `instantaneas`** al `drawQuadrant()` call. Las snapshot layers ya están en `quadrantLayers`.

> [!IMPORTANT]
> Después de esta fase, `instantanea.visible` controla si existe una capa snapshot. El toggle de visibilidad en TabInstantaneas sigue funcionando igual, pero internamente crea/destruye capas.

---

## Fase 3 — Modal post-captura

### [NEW] CaptureModal.svelte
`src/components/medicion/CaptureModal.svelte` (~150 líneas)

Modal que aparece inmediatamente después de capturar una instantánea.

**Props**: `instantanea: Instantanea`, `onSave: (tags) => void`, `onSkip: () => void`

**Layout**:
```
┌─────────────────────────────────────────────────┐
│  ✅ Instantánea capturada                       │
│                                                 │
│  Nombre: [Principal · Centro · 11:07      ]     │
│                                                 │
│  Ubicación                                      │
│  [Principal] [Delay 1] [Delay 2] [Relleno]      │
│  [Subwoofer] [+ ...]                            │
│                                                 │
│  Posición                                       │
│  [Izq] [Centro] [Der] [Arriba] [Abajo] [+ ...]  │
│                                                 │
│  Notas (opcional)                               │
│  [+ Agregar nota...]                            │
│                                                 │
│        [Guardar]          [Guardar sin tags]     │
└─────────────────────────────────────────────────┘
```

**Comportamiento**:
- Tags **sticky**: recuerda selección anterior (`lastUsedTags`)
- **Enter** = Guardar con tags. **Esc** = Guardar sin tags
- Nombre se auto-genera basado en tags seleccionados + hora
- El modal NO bloquea la medición (datos ya congelados)
- Botón `[+ ...]` permite agregar tag custom al preset

### [MODIFY] [TabInstantaneas.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabInstantaneas.svelte)

**3a. Integrar CaptureModal**: botón "Capturar" → `captureInstantanea()` → abrir modal.

### [MODIFY] [TabMedicion.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabMedicion.svelte)

**3b. Integrar CaptureModal**: captura desde medición → abrir modal.

---

## Fase 4 — Selector unificado de instantáneas (SnapshotPicker)

### [NEW] SnapshotPicker.svelte
`src/components/medicion/SnapshotPicker.svelte` (~200 líneas)

Componente **reutilizable** para seleccionar instantáneas. Se usa en auto-EQ y en LayerPanel.

**Props**:
```typescript
{
    mode: 'single' | 'multi';
    selectedIds: string[];
    onSelect: (ids: string[]) => void;
    showOperations?: boolean;
    operation?: 'average' | 'min' | 'max';
    onOperationChange?: (op) => void;
    maxHeight?: string;
}
```

**Layout**:
```
┌──────────────────────────────────────────┐
│ Filtrar: [Ubicación ▾] [Posición ▾]      │
├──────────────────────────────────────────┤
│ ▼ Principal (4)                          │
│   ☑ Izq · 10:42  ●                      │
│   ☐ Centro · 10:43                       │
│   ☑ Der · 10:44                          │
│ ▼ Delay 1 (2)                            │
│   ☑ Centro · 10:50                       │
│ ▷ Sin clasificar (1)                     │
├──────────────────────────────────────────┤
│ Seleccionadas: 3  [Todas] [Ninguna]      │
│ Operación: [Promedio] [Min] [Max]        │
└──────────────────────────────────────────┘
```

**Features**:
- Filtro por ubicación/posición (dropdowns)
- Agrupación colapsable por ubicación
- Checkbox multi-select o radio single-select según `mode`
- "Seleccionar todas filtradas" / "Ninguna"
- Color dot por instantánea
- Conteo de seleccionadas
- Operación (avg/min/max) si `showOperations=true`

### [MODIFY] [TabEcualizar.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabEcualizar.svelte)

**4a. Reemplazar selector inline** (L436-464) por:
```svelte
<SnapshotPicker
    mode="multi"
    selectedIds={eqStore.autoEQSnapshotIds}
    onSelect={(ids) => eqStore.autoEQSnapshotIds = ids}
    showOperations={true}
    operation={eqStore.autoEQCalcOperation}
    onOperationChange={(op) => eqStore.autoEQCalcOperation = op}
    maxHeight="200px"
/>
```

### [MODIFY] [LayerPanel.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/LayerPanel.svelte)

**4b. Reemplazar submenú de 3 niveles** (L127-161):
- Eliminar `showSnapshotSubmenu` y el nested submenu
- Opción "Instantánea" abre un popover con `<SnapshotPicker mode="single">` 
- Al seleccionar, llama `traceManager.addSnapshotLayer(snap, quadrantId)`

**4c. Permitir elegir operación** al crear capa calculada (dropdown inline: avg/min/max/sum/subtract).

---

## Fase 5 — Rediseño UI/UX de TabInstantaneas

### Problemas actuales

La UI actual tiene estos problemas:

1. **Cards demasiado altas** (~120px cada una): el slider de Y-Offset siempre visible consume el 40% del espacio de cada card. Con 5+ instantáneas ya no caben en pantalla.
2. **Metadata innecesaria siempre visible**: "Manual", "Multimétrica" — ocupan una fila pero rara vez son útiles.
3. **Sin agrupación**: lista plana. Con 20+ instantáneas es un scroll infinito.
4. **Import/export/ordenar ocultos** en modo avanzado.
5. **Botones de acción grandes** (28x28px cada uno) — 3 botones por card es excesivo visualmente.
6. **Sin confirmación al borrar**.
7. **Sin "borrar todo"**.

### Layout actual vs propuesto

**ACTUAL** — cada card ~120px:
```
┌──────────────────────────────────────────────────┐
│ ● Instantánea #1         [👁] [⬇] [🗑]          │
│ 🕐 10:42:15  👆 Manual  [MULTIMÉTRICA]           │
│ ─────────────────────────────────────            │
│ Compensación Y (Y-Offset)           +0 dB       │
│ -50 ════════════════════════════════ +50         │
└──────────────────────────────────────────────────┘
```

**PROPUESTO** — sin título redundante, toolbar funcional, items compactos:
```
┌──────────────────────────────────────────────────┐
│ [📷 Capturar instantánea]        [📥] [⬆⬇]      │
│ Sesión: [Teatro Municipal ▾]         [+ Nueva]   │
│ [Ubicación ▾] [Posición ▾]                       │
├──────────────────────────────────────────────────┤
│ ▼ Principal (4)                                  │
│   ● Izq · 10:42        [👁] [⋯]                 │
│   ● Centro · 10:43     [👁] [⋯]                 │
│   ▸ Der · 10:44  ← expandido:                   │
│     Y-Offset: ═══════════════  [+0 dB]           │
│     [Principal] [Derecha]  🕐 10:44:12           │
│     [⬇ Exportar] [🗑 Eliminar]                   │
│   ● XOVR · 10:45       [👁] [⋯]                 │
│ ▶ Delay 1 (2) ← colapsado                       │
│ ▶ Sin clasificar (1)                             │
├──────────────────────────────────────────────────┤
│ 5 visibles                      [🗑 Borrar todo] │
└──────────────────────────────────────────────────┘
```

### [MODIFY] [TabInstantaneas.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/TabInstantaneas.svelte)

**5a. Eliminar redundancias del header**:
- Eliminar título "Historial de Instantáneas" y su ícono — ya estamos en la pestaña
- Eliminar badge "N instantáneas" — dato inútil
- El botón "Capturar" pasa a ser la primera fila, con los íconos de import y ordenar alineados a la derecha
- Sesión selector debajo del botón de captura
- Filtros de tags en la tercera fila (solo si hay instantáneas con tags)

**5b. Agrupación colapsable por ubicación**:
- Las instantáneas se agrupan por `tags.ubicacion`
- Header de grupo con nombre + conteo + toggle colapsar
- Grupo "Sin clasificar" para las que no tienen tag
- Si no hay filtros activos, mostrar todos los grupos
- Si hay filtro de ubicación, mostrar solo ese grupo expandido

**5c. Card compacta** (~36px en modo colapsado):
```
● Izq · 10:42                [👁] [⋯]
```
- Color dot (de la instantánea)
- Nombre o `posición · hora` (compacto)
- Toggle visibilidad (ojito)
- Botón "más" `[⋯]` que expande la card

**5d. Card expandida** (clic en `[⋯]` o clic en el nombre):
```
● Izq · 10:42                [👁] [⋯]
  Y-Offset: -50 ═══════ +50  [+0 dB]
  [Principal] [Derecha]  🕐 10:44:12
  [⬇ Exportar] [🗑 Eliminar]
```
- Y-Offset slider (solo visible cuando la card está expandida)
- Tags como pills (editables: clic para cambiar)
- Timestamp completo
- Acciones: exportar, eliminar (con confirmación)

**5e. Footer de resumen**:
```
7 instantáneas · 5 visibles     [🗑 Borrar todo]
```
- Conteo total y visibles
- "Borrar todo" con doble confirmación (primer clic cambia a "¿Seguro?", segundo confirma)

**5f. Confirmación al borrar individual**:
- Al hacer clic en 🗑, el botón cambia a rojo con "¿Seguro?" por 3 segundos
- Si no se hace clic en 3s, vuelve al estado normal

**5g. Eliminar redundancias**:
- Quitar la fila de metadata "Manual / Secuencial / Multimétrica" del modo compacto (solo mostrar expandido)
- Quitar label "Compensación Y (Y-Offset)" — el slider con el valor numérico es suficiente
- Quitar los extremos "-50" y "+50" del slider — el valor numérico ya está visible

### Beneficio de espacio

| Estado | Altura por item | 10 items | Caben en 400px |
|--------|----------------|----------|----------------|
| Actual | ~120px | 1200px | 3.3 items |
| Propuesto (compacto) | ~36px | 360px | 11 items |
| Propuesto (1 expandido) | ~36px×9 + ~90px | 414px | ~10 items |

3x más instantáneas visibles sin scroll.

---

## Resumen de archivos

### Nuevos

| Archivo | Líneas est. | Propósito |
|---------|-------------|-----------|
| `CaptureModal.svelte` | ~150 | Modal post-captura con quick-tags |
| `SnapshotPicker.svelte` | ~200 | Selector unificado reutilizable |

### Modificados

| Archivo | Cambios principales |
|---------|---------------------|
| `traceManager.svelte.ts` | Modelo expandido, `addSnapshotLayer()`, `syncSnapshotVisibility()`, tags, sessions |
| `db.ts` | DB v2, session store, schema expandido |
| `quadrantDraw.ts` | Eliminar loop paralelo, soportar `multiMetricData` en capas |
| `Quadrant.svelte` | Dejar de pasar `instantaneas` a drawQuadrant |
| `TabEcualizar.svelte` | Usar SnapshotPicker |
| `LayerPanel.svelte` | Usar SnapshotPicker, eliminar submenú 3 niveles |
| `TabInstantaneas.svelte` | CaptureModal, session UI, filtrado, tags display |
| `TabMedicion.svelte` | CaptureModal integration |

---

## Orden de ejecución

```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5
modelo    render    modal    picker   UI tabs
```

Cada fase es compilable y funcional de forma independiente.

## Verificación

### Compilación
```bash
npx svelte-check --output human
npm run build
```

### Manual
- Capturar instantánea → modal aparece → tags se asignan → nombre auto-generado
- Toggle visibilidad de instantánea → capa snapshot se crea/elimina automáticamente
- Instantánea como capa → todas las métricas se renderizan (no solo la primera)
- offsetY slider → curva se desplaza visualmente
- Cada instantánea tiene color distinto por ubicación
- Auto-EQ → filtrar por ubicación → seleccionar → calcular
- SnapshotPicker funciona igual en auto-EQ y en LayerPanel
- Sesión activa → todas las capturas la heredan
- DB migration v1→v2 no pierde datos existentes
