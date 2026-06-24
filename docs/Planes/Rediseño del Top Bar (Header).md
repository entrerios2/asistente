# Rediseño del Top Bar (Header)

## Cambios propuestos

### 1. Icono de aplicación y favicon

Usar [eq.svg](file:///c:/Users/Abel/Documents/Asistente/asistente/images/eq.svg) como:
- Icono de la app en el header (inline SVG o `<img>`)
- Favicon (copiar a `src/lib/assets/`, crear versión con fill `#00ff88`)
- Icono del botón EQ en el topbar

#### [MODIFY] [favicon.svg](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/assets/favicon.svg)
Reemplazar el logo Svelte por el contenido de `eq.svg` con fill `#00ff88`.

#### [MODIFY] [Header.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte) L69-79
```html
<!-- Antes -->
<span class="material-symbols-outlined text-[#00ff88]">analytics</span>
<h1>Herramienta para mediciones de audio</h1>

<!-- Después -->
<img src={eqIcon} alt="" class="header-app-icon" />
<h1>Herramienta para calibración de audio</h1>
```

---

### 2. Limpiar separadores

**Antes:** `<div class="header-sep">` entre cada botón (4 separadores).

**Después:** un solo `<div class="header-sep">` entre el último botón (grilla) y los vúmetros.

Estructura resultante:
```
[🎛️ icon] Título    [Gen] [Medir] [EQ] [Capturar] [Grilla] │ [VU] [LED]
                      rosa   man   4peq   auto
                      auto
```

---

### 3. Botón EQ → usar eq.svg + lanzar autoEQ

**Antes:** icono `equalizer` (material), navega a tab EQ.

**Después:** inline SVG de `eq.svg`, al clickear:
1. Navega a tab EQ
2. Activa `eqStore.showEQ = true`
3. Dispara cálculo autoEQ

Importar `eqStore` en Header.

---

### 4. Sub-etiquetas de estado (solo texto, sin label en el botón)

Los botones mantienen solo el icono. Debajo, texto de estado en 7px:

#### Botón Generar
```
   🔊
rosa/auto
```
- `{tipoCorto}` + `/auto` si `linkGeneratorToMeasurement`
- Tipos cortos: rosa, blanco, brown, music, seno, sweep, burst, sinb, mls
- Color: `#00ff88` si activo, `var(--text-muted)` si no

#### Botón Medir
```
  📡
  man
```
- `man` o `seq` según `measurementMode`
- Color: `#ef4444` con pulse si midiendo

#### Botón EQ
```
  [eq.svg]
  peq 4
```
- `geq {n}` o `peq {n}` según `eqType`
- `n` = cantidad de bandas/filtros

#### Botón Capturar
```
  📷
  auto
```
- `auto` solo si `autoSaveSnapshotOnStop` es true
- Vacío si no

---

### 5. Layout: mantener 38px

Mantener `height: 38px` del header. Las sub-etiquetas se meten dentro del botón existente (28x28), apretando el contenido con `flex-col` y `gap-0`, usando `line-height: 1` y `font-size: 7px` para que entre en el espacio.

---

## Resumen de archivos

| Archivo | Cambio |
|---|---|
| [Header.svelte](file:///c:/Users/Abel/Documents/Asistente/asistente/src/components/medicion/Header.svelte) | Icono eq.svg, título, separadores, sub-labels, import eqStore |
| [favicon.svg](file:///c:/Users/Abel/Documents/Asistente/asistente/src/lib/assets/favicon.svg) | Reemplazar SVG Svelte por eq.svg con fill `#00ff88` |

## Verificación

```bash
npx svelte-check --output human
```
- Visual: verificar alineación de sub-labels, separador único, favicon en pestaña del browser
