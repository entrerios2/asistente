# Análisis: Simulación Predictiva con Perfiles Aproximados de Altavoces

## Problema

La simulación acústica predictiva (tipo EASE, MAPP 3D) requiere archivos GLL (Generic Loudspeaker Library) que contienen datos detallados de directividad 3D por frecuencia, medidos en cámara anecoica. La realidad del campo es que la mayoría de altavoces que se usan en eventos en vivo — especialmente en el mercado latinoamericano — **no tienen archivo GLL disponible**. Esto deja al operador sin herramientas de planificación previa.

**Ejemplo concreto:** El Titan 8 Active MK II es un altavoz activo de 8" de dos vías ampliamente usado. Tiene un datasheet completo con especificaciones, pero no existe archivo GLL publicado por el fabricante.

---

## Propuesta

Construir un sistema de simulación predictiva de **tres niveles** que combine tres fuentes de datos complementarias para generar perfiles útiles de altavoces sin GLL:

### Fuente 1 — Especificaciones del Fabricante (Datasheet)

Datos estáticos extraídos del manual del producto. Para el caso del Titan 8 Active MK II:

| Parámetro | Valor | Utilidad |
|---|---|---|
| Tipo de sistema | Activo 8" 2 vías Bi-Amplificado | Clasificación del equipo |
| Respuesta en frecuencia (±3dB) | 70 Hz – 20 kHz | Límites operativos del sistema |
| Driver LF | 205mm / 8" | Predicción de comportamiento en graves |
| Driver HF | Compresión, salida 30mm / 1.2" | Predicción de directividad en agudos |
| Dispersión (H × V) | 90° × 60° | Cobertura nominal para mapa SPL |
| Crossover | 2.4 kHz, Linkwitz-Riley 24 dB/oct | Punto de transición entre drivers |
| Filtro subsónico | 30 Hz, 2do orden | Protección de graves ya integrada |
| Potencia LF / HF | 150W / 30W (continua) | Cálculo de SPL máximo |
| Limitador (Clip) | ~150W output | Techo operativo del sistema |
| EQ integrado | ±10 dB shelving @ 100 Hz y 10 kHz | Herramientas de corrección disponibles en la caja |
| Sensibilidad de entrada | 0 dBu (línea) / -47 dBu (mic) | Estructura de ganancia |
| Máx. nivel de entrada | +22 dBu | Headroom de entrada |

**Lo que NO provee el datasheet:**
- Sensibilidad (dB SPL @ 1W/1m) — ausente en este modelo
- Curva de frecuencia detallada (solo el rango ±3dB, no la forma)
- Directividad por frecuencia (el 90°×60° es nominal, no por banda)
- Respuesta off-axis
- Respuesta de fase
- Curva de impedancia

### Fuente 2 — Extracción de Datos Asistida por IA

En lugar de mantener una base de datos indexada (RAG), el sistema delega la extracción de datos al operador usando **agentes de IA de acceso público** (Gemini, ChatGPT, etc.) con prompts pre-diseñados. Esto elimina toda necesidad de infraestructura de backend para perfiles de equipos.

#### Flujo Operativo

1. El operador accede a la función **"Agregar Equipo"** en el inventario de la PWA.
2. El sistema le presenta un **prompt pre-armado** con instrucciones precisas y el schema JSON de salida esperado.
3. El operador abre Gemini/ChatGPT en otra pestaña, pega el prompt y alimenta la IA con los datos del manual. **Formatos soportados:**
   - **PDF completo:** Se sube el archivo PDF del manual directamente al agente de IA. Los modelos actuales (Gemini, ChatGPT) aceptan PDFs y pueden procesar documentos extensos.
   - **Capturas/fotos:** Imágenes individuales de las páginas relevantes del manual (útil si solo se tiene el manual en papel).
4. La IA pública extrae los datos y los devuelve en el formato JSON especificado.
5. El operador pega el JSON en la PWA, que lo valida e importa al inventario.

#### Manejo de Manuales Multi-Producto

Los manuales de fabricantes frecuentemente cubren **una línea completa de productos** (ej. "Titan Series: Titan 8, Titan 10, Titan 12, Titan 15, Titan Sub"). El prompt debe contemplar esto:

- El prompt instruye a la IA a **identificar todos los modelos** documentados en el manual y generar un perfil JSON independiente para cada uno.
- Si el operador solo necesita un modelo específico, puede indicarlo en el prompt: *"Extraé únicamente los datos del Titan 8 Active MK II"*.
- Si carga el manual completo sin especificar modelo, recibe un array de perfiles que puede importar todos de una vez al inventario, registrando la línea completa en un solo paso.

#### Niveles de Extracción según Disponibilidad del Manual

**Nivel A — Solo tabla de especificaciones:**
El prompt solicita los campos estructurados (sensibilidad, cobertura, crossover, potencia, etc.) y los devuelve como JSON. Precisión: exacta para datos tabulares.

**Nivel B — Tabla + gráfico de respuesta en frecuencia:**
El prompt instruye a la IA a leer la curva del gráfico y extraer el nivel en dB a cada frecuencia de tercio de octava, devolviendo un array de objetos `{hz, db}`. Precisión estimada: ±1-2 dB (suficiente para planificación).

**Nivel C — Tabla + curva + diagramas polares:**
El prompt instruye a la IA a leer los diagramas polares (típicamente mostrados a 3-4 frecuencias clave) y extraer el nivel relativo en dB a cada 10° de ángulo, devolviendo objetos `{hz, angle_deg, db}`. Esto genera un **mini-globo de directividad** que habilita directamente el Nivel 2 de simulación. *Advertencia: Los manuales suelen tener diagramas suavizados (baja resolución angular). El sistema debe alertar al usuario que la interpolación matemática puede ocultar "lóbulos y dedos" problemáticos en el campo real.*

#### Importación Directa de Archivos CLF

Para equipos que dispongan de un archivo **CLF (Common Loudspeaker Format)** — el estándar abierto y documentado alternativo al GLL propietario de AFMG — la PWA podrá importarlo directamente sin intervención de IA externa. El CLF contiene directividad completa, sensibilidad y respuesta en frecuencia en formato parseable.

#### Uso de GLL via GLL Viewer

Para equipos con archivo GLL disponible (formato binario propietario de AFMG, no parseable directamente), el operador puede usar el **GLL Viewer gratuito de AFMG**, tomar capturas de las vistas de datos, y alimentar el mismo flujo de extracción por prompt. Los gráficos del GLL Viewer son limpios y estandarizados, por lo que la extracción por IA será más precisa que desde un manual impreso.

#### Ventajas frente a un RAG centralizado

- **Cero infraestructura:** No hay servidor, base vectorial ni embeddings que mantener.
- **Cobertura universal:** Funciona con cualquier equipo que tenga documentación, sin depender de que exista en una base de datos pre-indexada.
- **Siempre actualizado:** Si los modelos de visión mejoran, el sistema se beneficia automáticamente.
- **Cero costo operativo:** El operador usa su propia cuenta gratuita de IA.
- **Extensible:** El mismo enfoque aplica para micrófonos, procesadores y consolas.

#### Alcance: Más Allá de Altavoces y Micrófonos

El sistema de extracción por IA no se limita a transductores. Durante la fase de planificación, el operador necesita conocer las capacidades de toda la cadena de señal. Los prompts pre-armados deben cubrir también:

- **Consolas de mezcla:** Cantidad de canales, buses auxiliares, tipo de EQ por canal (paramétrico/gráfico, bandas), procesamiento integrado (compresores, gates, delays), salidas de matriz, conectividad digital (Dante, AES50, USB), latencia de procesamiento.
- **Procesadores de sonido (DSP/DriveRack/etc.):** Cantidad de entradas/salidas, tipos de filtro disponibles (PEQ, crossover, limitador, delay), rango de delay máximo, resolución de EQ, sample rate, latencia.
- **Amplificadores de potencia:** Potencia por canal en distintas impedancias (2Ω, 4Ω, 8Ω), modo bridge, limitadores integrados, DSP interno.
- **Interfaces de audio:** Cantidad de entradas/salidas, sample rates soportados, latencia reportada, conectividad (USB, Thunderbolt, Dante).

Esto permite que el sistema valide en la fase de planificación si la cadena completa es coherente (ej. *"Tu consola tiene 4 aux pero necesitás 6 monitores independientes"* o *"El procesador tiene 15ms de latencia que deben sumarse al cálculo de delay"*).

### Fuente 3 — Mediciones FSK In-Situ (Datos Reales)

La secuencia FSK provee datos medidos de la caja real, en la sala real, en el momento real:

| Segmento FSK | Dato que aporta al perfil |
|---|---|
| **A** (Nivel) | Sensibilidad real medida — llena el hueco más grave del datasheet |
| **F** (Respuesta en frecuencia) | Curva completa real (no solo el rango ±3dB) |
| **P** (Fase y coherencia) | Comportamiento real del crossover y mapa de confianza de los datos |
| **T** (Time Alignment) | Respuesta al impulso → patrón de reflexiones y comportamiento temporal |
| **F off-axis** (múltiples posiciones) | Si se mide desde varias posiciones, se construye un mini-globo de directividad empírico |

---

## Niveles de Simulación Propuestos

### Nivel 1 — Mapa de Cobertura SPL

**Pregunta que responde:** *"¿Llega suficiente volumen a todos los asientos?"*

**Datos requeridos:**
- Sensibilidad del altavoz (del datasheet, extraída por IA, importada de CLF, o medida con Segmento A)
- Ángulos de cobertura nominal (del datasheet)
- Posiciones de altavoces y geometría de la sala (del Stage Plot)

**Método:** Ley del inverso del cuadrado (6 dB de pérdida por doble distancia para fuentes puntuales, ajustado automáticamente a 3 dB en campo cercano si el sistema detecta un arreglo lineal) + atenuación fuera del ángulo de cobertura. En exteriores o recintos grandes, se aplica también la atenuación atmosférica (norma ISO 9613-1) para modelar la pérdida de agudos por temperatura y humedad.

**Complejidad computacional:** Mínima. Álgebra básica, renderizable en Canvas 2D en milisegundos.

**Resultado:** Mapa 2D de la sala coloreado por SPL estimado en cada punto de la audiencia. El sistema predecirá además la **Distancia Crítica ($D_c$)**, indicando en qué fila el sonido reverberante iguala al directo y la inteligibilidad empieza a degradarse peligrosamente.

---

### Nivel 2 — Cobertura por Bandas de Frecuencia

**Pregunta que responde:** *"¿A los costados llegan los agudos o solo los graves?"*

**Datos requeridos:**
- Todo lo del Nivel 1
- Directividad por banda de octava (extraída de polares del manual via IA, importada de CLF, o medida con Segmento F desde múltiples posiciones)

**Método:** Mismo cálculo del Nivel 1, iterado por banda de octava. Para lograr una suma realista en zonas de solapamiento, el simulador genera un proxy de **fase "quasi-plana"** basado en el tipo de crossover. Ignorar la fase vectorial generaría un mapa optimista falso y ocultaría los filtros de peine producidos por interacciones destructivas.

**Complejidad computacional:** Baja-Media. Son 6-8 iteraciones del Nivel 1, sumando la evaluación de interacciones de fase en zonas superpuestas.

**Resultado:** Mapa 2D por banda de frecuencia. El usuario podrá superponer "Target Curves" (ej. *pink shift* o caída progresiva de 12 dB en HF) sobre el mapa, en lugar de intentar forzar un objetivo visualmente "plano" que no coincide con las preferencias de mezcla reales.

---

### Nivel 3 — Reflexiones Tempranas Simplificadas

**Pregunta que responde:** *"¿Dónde habrá problemas por reflexiones de paredes y techo?"*

**Datos requeridos:**
- Todo lo del Nivel 2
- Dimensiones de la sala (largo, ancho, alto)
- Materiales principales de las superficies (concreto, madera, alfombra, cortinas, vidrio)
- Coeficientes de absorción por material (tabla estándar incorporada en la PWA)

**Método:** Método de fuentes imagen (Image Source Method) para las primeras 3-4 reflexiones:
- Reflexión de piso
- Reflexión de techo
- Reflexiones de paredes laterales
- Reflexión de pared trasera

Para cada reflexión se calcula:
1. La distancia recorrida (y por lo tanto la atenuación y el retardo)
2. La absorción del material en la superficie de rebote (por banda de frecuencia)
3. La diferencia de camino respecto al sonido directo → predicción de filtrado peine
4. La zona de la audiencia afectada

**Complejidad computacional:** Media. El método de fuentes imagen con pocas reflexiones es eficiente. No requiere ray tracing completo.

**Resultado:** 
- Mapa de zonas con riesgo de filtrado peine (cancelaciones por interferencia)
- Predicción de reflexiones tempranas problemáticas (llegadas dentro de 30ms del sonido directo)
- Sugerencias de posicionamiento ("mover el altavoz 1m hacia adelante reduce la reflexión de techo en 4 dB")

---

## Modelado Geométrico y Visualización

### Geometría Aditiva (Árbol de Zonas)

Para evitar las limitaciones de plantillas rígidas (y la complejidad de un editor 3D libre), el sistema utilizará un modelo de **geometría aditiva basada en un árbol de zonas**. 

1. **Piso Principal:** La sala comienza como un rectángulo base.
2. **Zonas Adjuntas:** El operador puede adjuntar nuevas zonas a cualquiera de las caras de una zona existente. Cada zona adjunta define:
   - **Tipo:** `tribuna` (plano inclinado) | `bandeja` (plano elevado) | `fill` (zona plana al mismo nivel).
   - **Pendiente:** Ángulo en grados (ej. 0° = horizontal, 15° = tribuna o bandeja inclinada/voladiza).
   - **Dimensiones:** Ancho, profundidad y altura de anclaje.

Este enfoque permite modelar configuraciones complejas superponiendo zonas (ej. una bandeja sobre una tribuna, o una arena con tribunas en los 4 lados). 

**Impacto Acústico:**
- Las alturas varían a lo largo de las zonas con pendiente, afectando el cálculo de SPL.
- **Sombras Acústicas:** El modelo detecta automáticamente cuándo una zona superior (como el intradós de una bandeja voladiza) bloquea el sonido directo hacia la zona inferior, permitiendo advertir al usuario sobre la necesidad de *under-balcony fills*.
- El intradós también se modela como reflector para el Nivel 3 (reflexiones tempranas).

### Planificación Multi-Sala (Evento)

El sistema conceptualiza el trabajo bajo la jerarquía de **Evento**, que puede contener múltiples salas simultáneas (ej. Escenario Principal, Carpa VIP, Foyer).
- Cada sala tiene su propia geometría y simulación independiente.
- El **Inventario es global** para el evento. El sistema realiza validaciones cruzadas para evitar asignar el mismo equipo a dos salas distintas.
- Las recomendaciones de hardware contemplan las necesidades combinadas del evento.

### Visualización de la Simulación

Para mantener el rendimiento en PWA y priorizar la funcionalidad, la visualización de los mapas de SPL y reflexiones se hará inicialmente mediante **Vistas 2D Ortogonales**:
- **Planta (Top View):** Mapa de calor tradicional visto desde arriba.
- **Cortes (Lateral y Frontal):** Críticos para ver la dispersión vertical, la cobertura sobre tribunas y las sombras acústicas de las bandejas.

Esta aproximación ofrece la mayor densidad de información sin la carga computacional de renderizar la sala completa en 3D (ej. Three.js o WebGL), manteniendo el camino abierto para incorporar vistas 3D isométricas opcionales en el futuro.


## Diseño de Sistema Asistido (Motor de Recomendación)

Además de la simulación predictiva, la base de datos CLF habilita una funcionalidad de alto valor: un **motor de recomendación de equipamiento** que asiste al operador durante la fase de diseño de la distribución de altavoces.

### Fuente de Datos: RAG sobre Base CLF

A diferencia de la extracción de datos por IA (Fuente 2), que resuelve el problema de perfilar un equipo específico, el RAG sobre CLF resuelve un problema que **solo una base de datos indexada puede responder**: *"De todos los altavoces que existen, ¿cuáles cumplen con los requisitos acústicos de este venue?"*

La base CLF pública se indexa una sola vez y se consulta durante la planificación.

### Flujo de Diseño Asistido

**1. El usuario define el venue:**
Dimensiones, forma, materiales, cantidad de audiencia, uso (voz, música, ambos), SPL objetivo.

**2. El sistema calcula los requisitos acústicos:**
- Distancia de throw necesaria (fila más lejana)
- Ángulos de cobertura requeridos para cubrir el área de audiencia
- SPL mínimo a la distancia máxima
- Cantidad de zonas que necesitan refuerzo (delays, fills)
- **Altura y ángulo de inclinación** necesarios para apuntar correctamente a la audiencia

**2b. El sistema evalúa el hardware de montaje:**
El tipo de soporte disponible afecta directamente la cobertura alcanzable. El sistema debe considerar:
- **Trípodes estándar:** La mayoría no permiten regular inclinación — el altavoz queda apuntando recto al frente. Esto limita la cobertura vertical efectiva, especialmente en salas con audiencia cercana al escenario (las primeras filas quedan "por debajo" del haz).
- **Trípodes con adaptador de inclinación:** Permiten inclinar la caja hacia abajo (tilt-down), mejorando la cobertura de filas cercanas.
- **Soportes de pared / anclajes (bracket):** Posición fija con ángulo configurable. El sistema necesita conocer la altura de montaje y el ángulo para calcular la cobertura real.
- **Flown / Rigging (colgados):** Altavoces suspendidos de estructura (truss, techo, puntos de anclaje). Ofrece flexibilidad, pero el sistema debe exigir el **Centro de Masa** de las cajas y el bastidor. Sin esto, el tilt predictivo nunca coincidirá con el tilt real colgando bajo gravedad (por peso de cables o centro corrido).
- **Stacking (apilados en el piso o sobre sub):** Sin elevación significativa; la cobertura depende enteramente de la dispersión vertical de la caja.

Si el operador tiene cargados sus soportes en el inventario, el sistema los considera al calcular la simulación. Si no los tiene o son insuficientes, el sistema indica qué tipo de soporte necesita:

> *"Con trípode estándar (sin inclinación) a 1.8m, el Titan 8 Active no cubre las primeras 3 filas (quedan fuera del ángulo vertical de 60°). Opciones: usar un adaptador de inclinación de 15°, o elevar el montaje a 2.5m."*

**3. Se cruza contra lo disponible:**

#### Caso A — El operador ya cargó su inventario

El sistema evalúa si el equipamiento propio cubre el venue y le indica cómo distribuirlo:

> *"Con tus 2x Titan 8 Active cubrís las primeras 8 filas (SPL ≥85 dBA). Para las filas 9-15 necesitás un par de cajas adicionales con al menos 95 dB de sensibilidad y 60°×40° de cobertura, o un altavoz de delay."*

#### Caso B — No tiene inventario cargado

El sistema le dice exactamente qué características de equipamiento necesita para el venue, y consulta el RAG/CLF para dar ejemplos concretos:

> *"Para este venue necesitás:*
> - *PA principal: sensibilidad ≥97 dB, cobertura 70°×50°, respuesta desde 60 Hz, SPL máximo ≥130 dB.*
> - *Ejemplos de la base CLF: QSC KLA12, EV EKX-15P, JBL SRX815P.*
> - *Fill lateral (×2): sensibilidad ≥92 dB, cobertura ≥90°×60°.*
> - *Ejemplos: QSC K8.2, Yamaha DBR10."*

#### Caso C — Tiene inventario pero es insuficiente

El sistema identifica exactamente qué zonas quedan descubiertas y qué falta:

> *"Tu inventario actual cubre el 60% del venue. Te faltan 2 cajas de fill lateral con cobertura ≥90°×60° y sensibilidad ≥92 dB para las zonas marcadas en rojo. Opciones compatibles de la base CLF: [lista]."*

### Por qué el RAG funciona acá y no en la Fuente 2

| Uso | Pregunta | ¿RAG necesario? |
|---|---|---|
| Fuente 2 (perfilar equipo propio) | *"¿Cómo suena MI caja?"* | No. Lo resuelven mejor el prompt de IA + FSK. |
| Diseño Asistido (recomendación) | *"¿Qué caja NECESITO comprar/alquilar?"* | **Sí.** Solo una base indexada puede buscar entre cientos de modelos. |

---

## Asistentes de IA para Planificación y Operación

Para que esta herramienta sea accesible a operadores novatos o voluntarios, la interfaz no debe ser solo un lienzo en blanco o una tabla de datos. Se integrarán dos capas de asistencia mediante IA (LLM + RAG):

### 1. Asistente de Planificación Inicial (Wizard Conversacional)
Actúa antes de la simulación, guiando al usuario paso a paso para construir el escenario virtual de forma intuitiva, bajando drásticamente la curva de aprendizaje.
* **Definición del Venue:** En lugar de herramientas CAD complejas, el asistente pregunta: *"¿De qué tamaño es el salón principal?"*, *"¿El escenario está elevado?"*, *"¿Hay gradas en el fondo o a los lados?"*. Con estas respuestas, el asistente **ensambla automáticamente el Árbol de Zonas** (geometría aditiva).
* **Sugerencia de Inventario:** Pregunta por el objetivo: *"¿Es una asamblea de voz hablada o un recital en vivo?"*, *"¿Cuántas personas esperas?"*. Basado en esto, evalúa el inventario local y pre-asigna el equipamiento óptimo (ej. *"Para voz a 300 personas, he seleccionado tus 2 cajas activas y descarté los subwoofers"*).
* **Posicionamiento Estratégico:** Propone las posiciones ideales iniciales basándose en acústica básica: *"Para cubrir los 30 metros de profundidad, te sugiero colocar las cajas a los extremos del escenario, elevadas a 2.2 metros con trípode"*.

### 2. Copilotos de Evaluación Semántica (Post-Simulación)
Actúan después de calcular el mapa, traduciendo los datos crudos (matrices SPL, fase, llegada) en diagnósticos accionables y físicos.
* **Asistente de Inteligibilidad:** Analiza la Distancia Crítica ($D_c$) y la relación D/R. *Ejemplo: "En las últimas gradas la inteligibilidad será pobre porque estás inyectando mucha energía al techo. Consejo: Inclina el arreglo 2° hacia abajo."*
* **Asistente de Seguridad (Rigging):** Evalúa centros de masa y fuerzas. *Ejemplo: "El tilt acústico requerido desplaza el centro de gravedad fuera de tu punto de anclaje. Cambia al pin 11 o usa dos motores."*
* **Asistente Auditor FSK:** Compara la predicción con la medición de campo real. *Ejemplo: "Mediste una pérdida de agudos severa a los 40m que la simulación no preveía. La absorción atmosférica es alta hoy; compensa con un High-Shelf de +4dB en el procesador general."*

---

## El Diferenciador: Ciclo de Autocorrección

Lo que haría único a este sistema frente a herramientas como EASE es el **ciclo de retroalimentación con datos FSK reales**:

```
┌─────────────────────────────────────────────────┐
│  1. PRE-EVENTO (Oficina/Planificación)          │
│     Fuentes: Datasheet + Extracción IA (o CLF)   │
│     Resultado: Simulación predictiva v1         │
│     → "Predigo -6 dB en fila 12"                │
├─────────────────────────────────────────────────┤
│  2. LLEGADA AL VENUE (Montaje)                  │
│     El usuario define el Punto de Rotación (POR)│
│     para referenciar geométricamente el sistema.│
│     Fuentes: FSK Segmentos A, F, T, P           │
│     Resultado: Datos reales en puntos medidos   │
│     → "Medí -8.5 dB en fila 12"                 │
├─────────────────────────────────────────────────┤
│  3. AUTOCORRECCIÓN                              │
│     El sistema juzga la medición por la         │
│     Coherencia (Segmento P). Si es ruido basura,│
│     lo descarta. Si es confiable, ajusta sus    │
│     parámetros internos (sensibilidad, fase).   │
│     → Simulación predictiva v2 (calibrada)      │
├─────────────────────────────────────────────────┤
│  4. PREDICCIÓN MEJORADA                         │
│     Las zonas NO medidas (filas 15-20) ahora    │
│     tienen predicciones mucho más precisas      │
│     porque el modelo fue corregido por datos    │
│     reales de zonas cercanas.                   │
└─────────────────────────────────────────────────┘
```

EASE no puede hacer esto porque no tiene FSK integrado. Nosotros sí.

---

## Limitaciones Honestas

| Limitación | Impacto | Mitigación |
|---|---|---|
| Precisión de extracción de gráficos por IA (±1-2 dB) | Curvas de frecuencia y polares no son exactas | Suficiente para planificación; el FSK in-situ las reemplaza con datos reales |
| Dependencia de IA externa para extracción | El operador necesita acceso a Gemini/ChatGPT | Servicio gratuito, ampliamente disponible. Sin conexión, se ingresan datos manualmente |
| El método de fuentes imagen ignora la difracción | Reflexiones en esquinas y bordes de superficies no se modelan | Aceptable para planificación; el FSK in-situ revela la realidad |
| Sala modelada como paralelepípedo | Salas irregulares no se representan bien | Permitir geometrías simples adicionales (L, T) en futuras versiones |
| Sin modelado de audiencia (absorción por personas) | SPL real será menor que el simulado cuando la sala esté llena | Aplicar factor de corrección estimado por densidad de asientos |
| Coeficientes de absorción genéricos | "Concreto" varía mucho según acabado | Ofrecer subtipos (concreto liso, rugoso, pintado) |

---

## Dependencias del Proyecto

| Componente | Fase del Roadmap | Requisito Previo |
|---|---|---|
| Mapa SPL Nivel 1 | Fase 4 (Stage Plot) | Motor de renderizado 2D + datos de altavoz |
| Prompts de extracción IA | Fase 4 (Stage Plot) | Diseño y validación de prompts + schema JSON de equipos |
| Parser CLF | Fase 4 (Stage Plot) | Implementación de lector de formato CLF en la PWA |
| RAG sobre base CLF | Fase 4 (Stage Plot) | Indexación de base CLF pública + motor de búsqueda/recomendación |
| Cobertura por bandas (Nivel 2) | Fase 4 (Stage Plot) | Datos de directividad (vía IA, CLF, o mediciones off-axis) |
| Reflexiones tempranas (Nivel 3) | Fase 4 (Stage Plot) | Ingreso de geometría de sala + tabla de materiales |
| Diseño Asistido (Recomendación) | Fase 4 (Stage Plot) | RAG CLF + motor de cálculo de requisitos acústicos |
| Autocorrección con FSK | Post Fase 1 + Fase 4 | Orquestador FSK funcional + modelo de simulación |

---

## Próximos Pasos

> [!NOTE]
> Este documento es un análisis exploratorio. Las decisiones de implementación y priorización quedan pendientes de aprobación.
