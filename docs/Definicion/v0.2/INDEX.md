# Índice — Documentación del Sistema v0.2

**Proyecto:** Asistente de audio y video para asambleas  
**Versión:** 0.2 (en desarrollo)  
**Última actualización:** 2026-06-26

---

## Documentos

| # | Documento | Descripción |
|---|-----------|-------------|
| 1 | [01-introduccion-y-vision.md](./01-introduccion-y-vision.md) | Visión general, propósito, objetivos del sistema, público objetivo, casos de uso |
| 2 | [02-arquitectura-general.md](./02-arquitectura-general.md) | Arquitectura del sistema, modelo de capacidades por niveles (Tiers), targets de despliegue, flujo de datos de alto nivel |
| 3 | [03-estructura-del-proyecto.md](./03-estructura-del-proyecto.md) | Árbol de directorios completo con explicación de cada archivo y directorio |
| 4 | [04-modelo-de-datos.md](./04-modelo-de-datos.md) | Tipos, interfaces, stores (estado reactivo), esquemas de persistencia (IndexedDB, localStorage) |
| 5 | [05-pipeline-dsp.md](./05-pipeline-dsp.md) | Cadena completa de procesamiento de audio: captura → FFT → métricas → renderizado. Algoritmos, workers, optimizadores |
| 6 | [06-despliegue-y-configuracion.md](./06-despliegue-y-configuracion.md) | Build system, PWA, Tauri, variables de entorno, GitHub Pages, compatibilidad |

---

## Convenciones usadas en esta documentación

- **Rutas de archivos**: relativas a `src/` salvo que se indique lo contrario. Ej: `lib/dsp/fft.ts` → `src/lib/dsp/fft.ts`
- **Anotaciones técnicas**: Los bloques `> **Nota**:` contienen información crítica para entender decisiones arquitectónicas.
- **Referencias cruzadas**: `→ ver [02-arquitectura-general.md](./02-arquitectura-general.md#sección)` apuntan a secciones específicas.
- **Diagramas ASCII**: Se usan diagramas de texto para representar flujos y relaciones cuando es necesario.

---

## Documentación relacionada (fuera de v0.2)

| Documento | Ubicación |
|-----------|-----------|
| DDS principal | `docs/Definicion/Definicion.md` |
| Documentación de señales y métricas | `docs/Definicion/documentacion_senales_y_metricas.md` |
| Organización de la interfaz | `docs/Definicion/Organizacion_interfaz.md` |
| Protocolo APST | `docs/Definicion/Protocolo_APST.md` |
| UX de medición | `docs/Definicion/UX_Medicion.md` |
| Roadmap del proyecto | `docs/Definicion/roadmap.md` |
| Decision tree: mic placement | `docs/mic-placement-decision-tree.md` |
| Decision tree: summation engine | `docs/summation-engine-decision-tree.md` |
| Auditoría McCarthy | `docs/Audits/audit_mccarthy.md` |
| Planes de implementación | `docs/Planes/` (27 archivos) |
| Prompts de desarrollo | `docs/Prompts/` (20 archivos) |
| Planes activos | `plans/` (4 archivos) |
