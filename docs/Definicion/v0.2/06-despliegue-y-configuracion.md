# 6. Despliegue y Configuración

Este documento describe cómo construir, desplegar y configurar el sistema en sus dos modalidades: PWA (GitHub Pages) y aplicación de escritorio (Tauri).

---

## 6.1. Build Chain

```
npm run dev      → Vite dev server + HMR  (http://localhost:5173/asistente)
npm run build    → SvelteKit adapter-static → /build/
npm run preview  → Vite preview en /build/
npm run tauri    → Tauri CLI
npm run check    → svelte-check + typecheck
```

### Configuración de Vite (`vite.config.ts`)

| Parámetro | Valor | Propósito |
|-----------|-------|-----------|
| `build.target` | `esnext` | Máxima compatibilidad WASM/moderno |
| `build.minify` | `esbuild` | Minificación rápida |
| `build.cssMinify` | `true` | CSS minificado |
| `build.sourcemap` | `false` | Sin sourcemaps en producción |
| `chunkSizeWarningLimit` | 1000 kB | Umbral de advertencia |
| `optimizeDeps.exclude` | `['webfft']` | No pre-bundlear webfft WASM |

### SvelteKit (`svelte.config.js`)

```js
adapter: adapter({ fallback: '404.html' })  // SPA mode
paths: { base: '/asistente' }               // GitHub Pages subpath
// Se sobreescribe con env BASE_PATH para deploys a /dev/
```

### Tauri (`src-tauri/tauri.conf.json`)

| Parámetro | Valor |
|-----------|-------|
| `build.frontendDist` | `../build` |
| `build.devUrl` | `http://localhost:5173/asistente` |
| `app.windows[0].title` | `Asistente de audio y video para asambleas` |
| `app.security.csp` | `null` (deshabilitado para SharedArrayBuffer) |
| `bundle.targets` | `all` (Windows .msi/.exe, macOS .dmg) |

### Tauri Rust (`src-tauri/Cargo.toml`)

```toml
tauri = "2.11.1"
cpal = { version = "0.15", features = ["asio"] }
tauri-plugin-log = "2"
```

Comandos Tauri expuestos:
- `list_audio_devices()` → `Vec<AudioDevice>` — enumera dispositivos vía cpal
- `select_audio_device(id, direction)` — selecciona dispositivo activo

---

## 6.2. Headers de Seguridad (SharedArrayBuffer)

El `AudioWorklet` requiere `SharedArrayBuffer`, que necesita dos headers HTTP:

```yaml
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless  # o require-corp
```

Configurados en Vite para dev y preview. Para producción (GitHub Pages), se configuran mediante el archivo `static/_headers`:

```txt
/*.js
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
```

---

## 6.3. GitHub Pages (PWA)

### Estructura de despliegue

```
https://abeljrd.github.io/asistente/
  ├── / (raíz)     → release estable (tag v*)
  ├── /dev/        → último commit de main
  └── /v0.1.0/     → versiones específicas (futuro)
```

### Workflow `deploy.yml` — Dev (push a main)

```yaml
- npm run build
  env: BASE_PATH: '/asistente/dev'
- peaceiris/actions-gh-pages → destination_dir: dev
```

### Workflow `deploy-stable.yml` — Stable (tag v*)

```yaml
- npm run build
  # Sin BASE_PATH → usa '/asistente' por defecto
- peaceiris/actions-gh-pages → destination_dir: .
```

### Workflow `release.yml` — Tauri Desktop (tag v*)

```yaml
matrix: [windows-latest, macos-latest]
- tauri-apps/tauri-action@v0 → GitHub Release (draft)
```

---

## 6.4. PWA

Configurado con `@vite-pwa/sveltekit` en `vite.config.ts`:

- `registerType: 'autoUpdate'` — el SW se actualiza automáticamente
- `includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg']`
- Manifest con nombre, descripción, iconos 192×192 y 512×512

El Service Worker se genera automáticamente en el build.

---

## 6.5. Variables de Entorno

| Variable | Default | Uso |
|----------|---------|-----|
| `BASE_PATH` | `/asistente` | Path base de la SPA (para GitHub Pages) |

No hay otras variables de entorno. **No hay backend, no hay API keys, no hay secrets.** 100% cliente.

---

## 6.6. Persistencia (Offline)

| Store | Medio | Capacidad típica |
|-------|-------|-----------------|
| Config UI | `localStorage` (clave `asistente-config-v2`) | ~10 kB |
| Instantáneas | `IndexedDB` (db `asistente-db`, store `instantaneas`) | ~1–100 MB |
| Sesiones | `IndexedDB` (db `asistente-db`, store `sessions`) | ~1–10 kB |
| Curvas de calibración | `IndexedDB` | ~100 kB |

La aplicación es completamente funcional sin conexión a Internet después de la primera carga (PWA + almacenamiento local).

---

## 6.7. Detección de Entorno (Boot)

En `+page.svelte` al cargar:

```typescript
// 1. Detectar contexto
const isTauri = '__TAURI_INTERNALS__' in window;

// 2. Crear AudioProvider según el contexto
const audioProvider = createAudioProvider(isTauri);

// 3. Detectar capacidad del hardware → definir Tier
//    Tier 0: fallback (sin AudioWorklet → setInterval)
//    Tier 1: AudioWorklet + SharedArrayBuffer
//    Tier 2: (futuro) WebGPU + AudioWorklet

// 4. Inicializar stores globales
// 5. Iniciar render loop (rAF)
```

---

## 6.8. Requisitos del Navegador

### Mínimos para Tier 0 (PWA básica)
- Navegador moderno con soporte AudioContext
- Service Worker para PWA

### Recomendados para Tier 1 (funcionalidad completa)
- AudioWorklet
- SharedArrayBuffer (requiere COOP/COEP)
- WebAssembly (para webfft)
- IndexedDB

### Compatibilidad conocida
| Navegador | Tier 0 | Tier 1 | Notas |
|-----------|--------|--------|-------|
| Chrome 90+ | ✅ | ✅ | Completo |
| Edge 90+ | ✅ | ✅ | Completo |
| Firefox 110+ | ✅ | ✅ | AudioWorklet reciente |
| Safari 15+ | ✅ | ⚠️ | SharedArrayBuffer requiere COOP/COEP |
| Chrome Android | ✅ | ✅ | AudioWorklet soportado |

---

## 6.9. Dependencias

### Producción

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `webfft` | ^1.0.3 | FFT WASM acelerada |

### Desarrollo

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| Svelte | ^5.55.2 | UI Framework |
| SvelteKit | ^2.57.0 | SSG + routing |
| `@sveltejs/adapter-static` | ^3.0.10 | Static Site Generation |
| Tailwind CSS | ^4.2.2 | Estilos |
| `@tailwindcss/vite` | ^4.2.2 | Plugin Vite para Tailwind |
| Vite | ^8.0.7 | Build tool |
| `@vite-pwa/sveltekit` | ^1.1.0 | PWA + Service Worker |
| `vite-plugin-pwa` | ^1.3.0 | Base PWA plugin |
| Tauri API | ^2.1.0 | Bridge Rust/Frontend |
| Tauri CLI | ^2.11.1 | Build Tauri |
| TypeScript | ^6.0.2 | Tipado estático |
| `svelte-check` | ^4.4.6 | Typecheck Svelte |
| `esbuild` | ^0.28.0 | Minificador |
| Rust (Tauri) | nightly/stable | Backend nativo |
| `cpal` (Rust) | 0.15 | Captura audio nativa |
| `serde`/`serde_json` (Rust) | 1.0 | Serialización IPC |

### Rust (solo Tauri Desktop)

| Dependencia | Propósito |
|-------------|-----------|
| `tauri` 2.11.1 | Framework desktop |
| `cpal` 0.15 + ASIO | Captura de audio con drivers ASIO |
| `tauri-plugin-log` | Logging en desarrollo |
| `serde` / `serde_json` | Serialización commands IPC |
