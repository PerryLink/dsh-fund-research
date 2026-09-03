<div align="center">

# 📊 dsh-fund-research
- **Canal 1024 store**: `npm i -g dsh1024` una vez, luego `dsh1024 plugin --profile web add dsh-fund-research` (cuenta para el ranking de instalaciones de [deepseek1024.com](https://deepseek1024.com)).

**Informes de investigación deterministas para fondos mutuos públicos chinos, sobre DeepSeek Harness.**

*Cada cifra clave de cada informe se remonta a una instantánea fuente con hash — los huecos se declaran, nunca se inventan. Solo para investigación; no es asesoramiento de inversión.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-🧩-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-fund-research/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-fund-research/actions)
[![npm version](https://img.shields.io/npm/v/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)
[![npm downloads](https://img.shields.io/npm/dm/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## Compatibility

| Componente | Versión |
|---|---|
| DeepSeek Harness | `0.1.2-alpha.5` (dependencias peer fijadas) |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| Gestor de paquetes | `pnpm@11.7.0` |
| Plataforma | Windows / macOS / Linux (plugin solo de host) |
| Fuentes de datos | Endpoints públicos de Tiantian Fund / Eastmoney (sin clave, sin login) |

## What you get

- **Herramienta `fund_research`** — un código de fondo entra, un informe Markdown versionado sale: resumen, descomposición de rendimiento, penetración de posiciones, atribución de estilo simplificada, perfil del gestor, declaraciones de riesgo y huecos, descargo de responsabilidad y un **apéndice de trazabilidad numérica** que mapea cada cifra clave a su ruta JSON en la instantánea y su veredicto de verificación. Sellado en `fund-reports/{code}/{YYYYMMDD-HHmmss}/` como `report.md` + `manifest.json` + `snapshot.json`. `background: true` lo ejecuta como trabajo en segundo plano `fund-report`.
- **Herramienta `fund_snapshot`** — una tarjeta ligera (último NAV, rendimientos por etapa publicados, escala, gestor, 3 principales posiciones) sellada en el directorio del día del fondo.
- **Métricas deterministas, cero aritmética del modelo** — rendimiento por periodo/anualizado, volatilidad, drawdown máximo, Sharpe; concentración top-N, HHI, distribución sectorial, comparación trimestral de posiciones; bandas de estilo tamaño-valor; tenure del gestor y comparación con pares. Todo funciones puras sobre la instantánea sellada.
- **Trazabilidad como función estrella** — antes del sellado, cada cifra clave se verifica contra el `snapshot.json` sellado a través del servicio opcional [`dsh-data-quality`](https://github.com/topics/dsh-plugin) cuando está instalado, o del verificador integrado isomorfo (`builtin-fallback`) en caso contrario. La tabla del apéndice registra valor ↔ ruta ↔ veredicto.
- **Huecos honestos** — una fuente fallida o degradada produce una declaración explícita de 数据缺口 (hueco de datos) en la sección afectada. El plugin nunca rellena un hueco con una cifra inventada.
- **Modo offline** — `offline: true` (configuración o argumento de la herramienta) sirve todo desde la capa de instantáneas del dominio de almacenamiento o la instantánea de versión más reciente en disco, con cero solicitudes salientes. Ideal para pruebas y reproducción.
- **Corte asOf** — `asOfDate` (ISO `YYYY-MM-DD`) trunca la serie de NAV a datos en/o antes de esa fecha y sella el corte en la instantánea y el informe; fechas inválidas o futuras fallan en voz alta.
- **Reanudación por puntos de control** — `<reportRoot>/.run-state.json` registra cada etapa del pipeline con marcas de tiempo y una huella de entrada; `resume: true` continúa desde la primera etapa incompleta reutilizando artefactos sellados, y rechaza una huella que no coincida.
- **Registro de descubrimiento de fuentes** — cada adquisición sella un `sources-discovery.json` generado por código (lista de endpoints, resolución primario/respaldo, cobertura y huecos por fuente, motivos de degradación) y lo incorpora al apéndice como 数据源与缺口声明.
- **Fan-out de múltiples fondos** — `codes` acepta un array de códigos; cada fondo ejecuta el pipeline de forma independiente con aislamiento de fallos (los fallos se convierten en huecos del resumen) y el resultado es una tarjeta de resumen (code / asOf / hash de sellado / veredictos / motivo del fallo).
- **Libro de seguimiento** — cada sellado correcto añade una línea determinista a `<reportRoot>/.tracking.jsonl`; `includeComparison: true` renderiza una sección determinista 与上次对比 (rango de NAV / escala / principales posiciones) con una declaración de hueco cuando no hay registro previo.
- **Revisión de solo lectura** — tras el sellado, un job `fund-review` revisa los artefactos sellados (completitud de la declaración de huecos, consistencia de la tabla de trazabilidad, descargo) y escribe `review-note.md`; se omite con elegancia (registrado en run-state) cuando no hay servicio de jobs.
- **Señales de calidad por fuente** — cada fuente lleva metadatos de calidad deterministas (`requested`/`succeeded`/`fieldsPresent`/`parseWarnings`/`degraded`), presentados en el apéndice y en los valores de herramienta para que el downstream pueda rebajar (nunca filtrar de forma dura) una fuente de baja calidad.
- **Resumen de estabilidad walk-forward** — `includeWalkForward: true` añade una sección 样本外稳定性摘要: persistencia de signo de retorno/Sharpe en ventanas deslizantes y media/desviación, etiquetada explícitamente como descripción estadística, no una predicción.
- **Eventos de auditoría de sesión** — los eventos solo-registro `fund-research/snapshot` y `fund-research/report` llevan el código, el directorio de versión, el hash del manifiesto y la lista de huecos (visible para el modelo ⟺ registrado).
- **Skill de metodología** — un skill `fund-research` integrado enseña al modelo las definiciones de métricas (口径), el manejo de huecos y el lenguaje de cumplimiento. El cálculo permanece en el código.

## Quick start

```text
> 用 fund_research 出一份 161725 的研究报告
```

El agente llama a `fund_research({ code: "161725" })`; un momento después el workspace contiene:

```text
fund-reports/161725/20260819-153012/
├── snapshot.json    # datos extraídos + métricas calculadas + sha256 por fuente
├── report.md        # el informe con el apéndice de trazabilidad
└── manifest.json    # hashes de instantánea/informe, parámetros, motor de verificación, huecos
```

Cada cifra del apéndice de `report.md` lleva un veredicto `verified` / `mismatch` / `not-found` / `unverifiable` contra `snapshot.json` — recalcula cualquiera desde `raw.*` con las definiciones documentadas para auditar el propio plugin.

## Install & uninstall

```sh
dsh plugin --profile web add dsh-fund-research     # instalar (npm o tarball)
dsh plugin --profile web remove dsh-fund-research  # desinstalar
```

Reinicia el perfil tras instalar (la activación del bundle es por reinicio). El parche del bundle compone la pila de almacenamiento (`dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`) que necesita la capa de instantáneas.

## Configuration

Todas las claves son opcionales (valores por defecto mostrados); los valores inválidos fallan ruidosamente al cargar.

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Interruptor maestro; `false` no monta nada. |
| `eastmoneyBaseUrl` | `https://fund.eastmoney.com` | Host pingzhongdata de Tiantian Fund. |
| `f10BaseUrl` | `https://fundf10.eastmoney.com` | Host F10 de Tiantian Fund (páginas de posiciones y gestor). |
| `quoteBaseUrl` | `https://push2.eastmoney.com` | Host de cotizaciones Eastmoney para valoraciones por acción. |
| `quoteFallbackBaseUrl` | `https://push2delay.eastmoney.com` | Host de cotizaciones alternativo probado por acción cuando el principal falla (host de cotizaciones diferidas propio de Eastmoney); `''` lo desactiva. |
| `requestIntervalMs` | `1000` | Intervalo mínimo entre solicitudes salientes (colección cortés). |
| `timeoutMs` | `15000` | Tiempo máximo por solicitud. |
| `retries` | `2` | Reintentos por solicitud con backoff exponencial. |
| `cacheTtlHours` | `12` | Ventana de reutilización de instantáneas del dominio. |
| `riskFreeRate` | `0.02` | Tasa libre de riesgo anual para el ratio Sharpe. |
| `offline` | `false` | Nunca enviar solicitudes; leer solo la capa de instantáneas. |
| `reportRoot` | `fund-reports` | Raíz del árbol de informes (relativa al workspace o absoluta). |
| `styleQuotes` | `true` | Obtener cotizaciones de valoración por acción para la atribución de estilo. |

## Tools & surfaces

### `fund_research`

| Argumento | Tipo | Descripción |
|---|---|---|
| `code` | string | Código de fondo de seis dígitos, p. ej. `"161725"` (fondo único). Mutuamente excluyente con `codes`. |
| `codes` | string[] | Varios códigos de seis dígitos: fan-out con aislamiento de fallos por fondo (devuelve un resumen). Mutuamente excluyente con `code`. |
| `sections` | string[] | Secciones a renderizar (`overview`/`performance`/`holdings`/`style`/`manager`/`risk`/`disclaimer`). Por defecto: todas. |
| `offline` | boolean | Leer solo la capa de instantáneas (sin red). Por defecto: configuración del plugin. |
| `asOfDate` | string | Corte ISO 8601 (`YYYY-MM-DD`): solo se usan datos en/o antes de esa fecha (serie NAV truncada). Vacío = sin corte; fechas futuras fallan en voz alta. |
| `resume` | boolean | Reanuda la ejecución registrada en `.run-state.json` desde la primera etapa incompleta (reutiliza artefactos sellados); rechaza una huella que no coincida. Por defecto: `false`. |
| `includeComparison` | boolean | Renderiza una sección determinista 与上次对比 frente al registro previo de `.tracking.jsonl`; la evidencia ausente se declara como hueco. Por defecto: `false`. |
| `includeWalkForward` | boolean | Renderiza una sección determinista 样本外稳定性摘要: persistencia de signo de retorno/Sharpe en ventanas deslizantes y media/desviación. Solo descripción estadística, no una predicción. Por defecto: `false`. |
| `background` | boolean | Ejecutar como trabajo en segundo plano `fund-report`; devuelve `{ kind: "background", jobId }`. Por defecto: `false`. |

### `fund_snapshot`

| Argumento | Tipo | Descripción |
|---|---|---|
| `code` (requerido) | string | Código de fondo de seis dígitos. |
| `offline` | boolean | Leer solo la capa de instantáneas. Por defecto: configuración del plugin. |
| `asOfDate` | string | Corte ISO 8601 (`YYYY-MM-DD`): solo se usan datos en/o antes de esa fecha. Vacío = sin corte; fechas futuras fallan en voz alta. |

### Secciones del informe

概览 resumen · 业绩拆解 descomposición de rendimiento · 持仓穿透 penetración de posiciones · 风格归因 atribución de estilo (simplificada) · 经理画像 perfil del gestor · 风险与缺口声明 riesgos y huecos · 免责声明 descargo · 附录：数字回溯表 apéndice de trazabilidad.

## Permissions & data

- **Lee** los endpoints públicos de Tiantian Fund / Eastmoney (`fund.eastmoney.com/pingzhongdata/*.js`, páginas F10 de `fundf10.eastmoney.com`, cotizaciones de `push2.eastmoney.com`) con User-Agent de navegador y ritmo cortés configurable. Sin clave, sin login, sin API de pago, sin eludir anti-bots.
- **Escribe** solo bajo la raíz de informes configurada dentro del workspace de la sesión, más el dominio de almacenamiento `dsh_fund_research` (última instantánea por fondo).
- **Nunca** evalúa JavaScript remoto (el bloque pingzhongdata se escanea, nunca se ejecuta), nunca almacena credenciales, nunca opera.
- Los eventos de sesión son registros de auditoría solo-registro que cruzan una puerta adaptativa: los hosts que conocen el vocabulario agregan directamente, los hosts con el sobre `ignorable` agregan con el marcador, y los hosts sin sobre (rc.6–rc.8, `0.1.1-rc.2` y `0.1.2-alpha.5`, que eliminó el sobre y falla cerrado ante tipos desconocidos en lectura) no reciben append — los resultados de las herramientas y los artefactos sellados siguen siendo la pista reconstruible.
0.1.2-alpha.5 (adaptado el 2026-09-02): el sobre de sesión conserva su campo ignorable solo para compatibilidad de lectura de logs almacenados - Session.append aún no puede estamparlo, por lo que el comportamiento de la puerta no cambia.

## Security boundaries

- Los códigos de fondo se validan como exactamente seis dígitos antes de tocar una ruta o URL; la raíz de informes se resuelve dentro del workspace de la sesión.
- Las cargas fuente se hashean (SHA-256) al adquirirse; el manifiesto sellado permite detectar ediciones silenciosas entre ejecuciones.
- La verificación nunca bloquea un sellado: un servicio `dsh-data-quality` opcional roto degrada al verificador integrado, y el motor usado queda registrado en el manifiesto y el apéndice.
- Consulta [SECURITY.md](SECURITY.md) para la política de divulgación.

## Known limitations

- **Deriva estructural upstream.** Los parsers son estrictos por diseño: si Tiantian Fund cambia una forma `var Data_*` o el diseño de una tabla F10, la fuente afectada lanza un `SourceParseError` que nombra el campo, y la sección degrada a un hueco declarado (si el bloque pingzhongdata central falla, la ejecución aborta ruidosamente). Es deliberado: un parseo silencioso erróneo es peor que un hueco declarado.
- **La atribución de estilo es 估算口径 (estimada).** Bandas fijas de tamaño (≥1000亿 / 300–1000亿 / <300亿) y de PE, más quintiles dentro de las posiciones — no se consulta ninguna distribución de mercado completa. El informe lo etiqueta.
- **Las posiciones son datos de divulgación trimestral** (con retraso de publicación); la página F10 trae los dos últimos trimestres.
- **Un fondo por llamada; sin análisis de cartera, sin informes anuales en PDF, sin cotización en tiempo real** (el endpoint en tiempo real `fundgz.1234567.com.cn` está muerto y deliberadamente no se usa).
- La fila de "deliverables" de la Web UI se alimenta de las tarjetas de llamada de herramientas de mutación; los archivos producidos por este plugin aparecen a través de la ubicación de seguimiento de la tarjeta de llamada (el directorio de informes del fondo), no como filas por archivo.

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci   # tipos, incl. modo estricto CI
pnpm test                                     # 124 pruebas sobre seams reales
pnpm run test:e2e                              # E2E opcional en red REAL (LIVE_E2E=1)
pnpm run build && pnpm run verify:artifacts   # tsdown + declaraciones tsc
pnpm run verify:self-contained                # sin specs de dependencias externas
node scripts/check-readme-sync.mjs            # puerta README en cinco idiomas
node scripts/check-endpoints.mjs              # sondeo de actividad M3 (4 hosts eastmoney)
pnpm pack                                     # tarball
```

Las pruebas usan los seams REALES `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/almacenamiento de los peers 0.1.2-alpha.5; la red se reemplaza solo en la frontera de fetch por fixtures de respuestas reales guardadas (`fixtures/`, fondo 161725). Refresca los fixtures con los scripts de `.tmp/`.

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

- **PerryLink** — mantenedor: el pipeline de recopilación/métricas/sellado de informes, la sonda de vida de endpoints, CI y releases, y la documentación en cinco idiomas.
- **dsh-fund-research contributors** — autoría colectiva de la construcción fundacional (contrato del plugin, esquema de configuración, herramientas, tests, empaquetado).

Sin contribuidores externos aún — 0 PRs/issues de la comunidad fusionados. Abre un issue con los formularios de `.github/ISSUE_TEMPLATE/` o un pull request contra `main` para aparecer aquí.

## PerryLink DSH Plugin Family

Parte de una familia de plugins independientes de DeepSeek Harness que comparten una base de ingeniería: peers 0.1.2-alpha.5 fijados, configuración Schemastery de fallo ruidoso, READMEs en cinco idiomas y cobertura vitest sobre seams reales.

## PerryLink DSH Plugin Family

Este proyecto es uno de los [33 complementos de DeepSeek Harness](https://github.com/PerryLink) mantenidos por [PerryLink](https://github.com/PerryLink). Si este te ayuda, probablemente los demás también:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Auto-revisión de segundo modelo en la cadena de aprobación, con cierre en fallo por defecto | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Agentes hijos en segundo plano durables con barra lateral de UI web, mensajería e interrupción | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Gobernanza de costes para DeepSeek Harness: presupuestos, carbono y latencia en un panel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Equivalente a /rewind de Claude Code: instantáneas, bifurcaciones de sesión, restauración de un solo uso | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migra sesiones, memoria, habilidades y CLAUDE.md de Claude Code a DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Control de escritorio nativo multiplataforma para DeepSeek Harness — Windows primero. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Historial de entrada estilo terminal para el compositor web: flechas, búsqueda Ctrl+R | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | Comprobaciones de calidad de datasets y verificación de citas (el puente numérico opcional consumido aquí) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Defensa contra inyección de prompts, jailbreak y fuga de secretos para DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Guardián de disciplina de ingeniería: interrogatorio de requisitos, puertas de pruebas, revisión adversaria | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Enrutamiento unificado de generación de imágenes estáticas para DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Diagnóstico de rendimiento de solo lectura para DeepSeek Harness. | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | Integración de PR/issues de GitHub para DSH, cada escritura controlada por aprobación | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Orquestación de investigación sectorial que sella sus entregables mediante el `ctx.researchReport.assemble` de este plugin | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Base de conocimiento documental local para DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Integración de modelos locales (Ollama) para DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | Diagnósticos, formato, autocompletado, acciones de código y renombrado LSP sobre servidores de lenguaje | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | Middleware de enmascaramiento de PII: anonimiza en el límite del modelo, restaura en la capa de visualización | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | Panel de tiempo de ejecución MCP de solo lectura: comando /mcp + pestaña Settings con estado, herramientas y errores | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Memoria entre sesiones controlada por aprobación: costura ctx.memory + SQLite + herramienta de memoria | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | Exportador de observabilidad OpenTelemetry y Langfuse para DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Cambio de estilo en tiempo de ejecución equivalente a outputStyles de Claude Code | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Reglas de permisos declarativas allow/deny/ask estilo Claude Code con auditoría | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Base de conocimiento de desarrollo de plugins como habilidad de agente bajo demanda | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Motor de informes de investigación verificables con evidencia direccionada por contenido | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Puntuación de calidad multidimensional para plugins de DeepSeek Harness. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Fija sesiones en la barra lateral web con orden durable | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | Sincronización de sesiones entre dispositivos para DeepSeek Harness — un espejo git dedicado de tu almacén de sesiones. | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Paquete de habilidades de auditoría de seguridad: escaneo de secretos, revisión de dependencias y cadena de suministro | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Bucle de sesión con voz para DeepSeek Harness: háblale y escucha su respuesta. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Pruebas de instalación y humo aisladas para plugins de DeepSeek Harness. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Traducción de parámetros entre proveedores y reparación determinista de JSON para DeepSeek Harness. | |

## License

[Apache-2.0](LICENSE). Avisos de terceros: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**Descargo: este plugin produce artefactos de investigación únicamente. Nada de lo que emite constituye asesoramiento de inversión.**

### Instalar desde el mercado de DSH Desktop

Todos los plugins de PerryLink pueden explorarse en el mercado integrado de DSH Desktop: **Market → Sources → add source → pegar** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ seleccionarlo**. La instalación sigue pasando por la verificación de identidad npm del mercado y tu confirmación.
