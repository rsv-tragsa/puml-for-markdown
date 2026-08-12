# @rsv-tragsa/puml-for-markdown

Genera imágenes PlantUML y mantiene los enlaces visibles de Markdown sin depender de Git. Admite ejecución completa e incremental, enlaces TinyURL, enlaces directos al servidor y enlaces a imágenes locales.

Requiere Node.js 22 o posterior. El paquete conserva el binario histórico `puml-for-markdown` y exporta una API CommonJS.

## Instalación

El paquete está preparado para GitHub Packages:

```ini
# .npmrc del consumidor
@rsv-tragsa:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
pnpm add -D @rsv-tragsa/puml-for-markdown
```

Para paquetes privados, el repositorio consumidor necesita acceso de lectura al paquete y un token con `read:packages` (o el `GITHUB_TOKEN` apropiado en Actions).

## Uso por agentes de IA

El paquete publica tres recursos orientados al consumo por agentes:

- [`skills/puml-for-markdown/SKILL.md`](skills/puml-for-markdown/SKILL.md): skill portable con flujos de configuración, generación completa e incremental, marcadores y reglas de seguridad.
- [`index.d.ts`](index.d.ts): contrato tipado de la función CommonJS, sus opciones, resultados y helpers públicos.
- [`llms.txt`](llms.txt): índice compacto de la documentación y los recursos legibles por agentes.

La skill sigue el formato abierto Agent Skills. Como ese estándar no define autodetección dentro de `node_modules`, debe añadirse su directorio al cliente compatible o copiarse a su directorio de skills. Por ejemplo, después de instalar el paquete, la fuente se encuentra en:

```text
node_modules/@rsv-tragsa/puml-for-markdown/skills/puml-for-markdown
```

En Codex puede copiarse a `~/.codex/skills/puml-for-markdown`. Otros clientes compatibles pueden usar otra ruta de instalación. `llms.txt` también puede publicarse en la raíz del sitio de documentación para facilitar el descubrimiento web.

## Configuración por defecto en un único fichero

El CLI busca automáticamente `puml-for-markdown.config.cjs` dentro de `rootDirectory`. También puede indicarse otro fichero explícitamente:

```bash
pnpm exec puml-for-markdown --config ./config/puml.cjs
```

La precedencia es:

```text
opciones CLI > fichero de configuración > defaults incorporados
```

El repositorio contiene un fichero completo y editable en [`puml-for-markdown.config.cjs`](puml-for-markdown.config.cjs):

```js
module.exports = {
  rootDirectory: '.',
  pumlDirectory: 'docs/puml',
  markdownDirectory: 'docs',
  distDirectory: 'docs/puml/dist',

  outputImages: true,
  imageFormats: ['png', 'svg'],
  pumlServerUrl: 'https://www.plantuml.com/plantuml',
  linkMode: 'local',
  localImageFormat: 'svg',

  regenerateAll: false,
  deleteOrphanImages: true,

  markerPattern: /<!--\s*(?<kind>!?)\[(?<label>[^\]]*)\]\((?<target>[^)\r\n]+\.puml)\)\s*-->/g,
  markerFlags: '',

  respectGitignore: true,
  gitignorePath: '.gitignore',
  changedFilesStdin0: false,
  hotReload: false,
  intervalSeconds: 2,

  // Opcionales: omitir significa escaneo completo; [] significa ninguno.
  // pumlFiles: [],
  // markdownFiles: [],
}
```

Un `rootDirectory` relativo se resuelve desde el directorio que contiene el fichero de configuración. `pumlDirectory`, `markdownDirectory`, `distDirectory`, `gitignorePath` y las selecciones se resuelven después desde `rootDirectory`.

El formato `.cjs` permite usar un `RegExp` real para `markerPattern` sin el doble escapado de JSON. El fichero se ejecuta como código JavaScript, por lo que debe tratarse como código de confianza del repositorio. Una clave desconocida provoca un error para detectar erratas de configuración.

La API `run(options)` no lee ficheros implícitamente. Para obtener los mismos defaults y la misma resolución de `rootDirectory`, puede usarse `loadProjectConfig`:

```js
const {
  run,
  loadProjectConfig,
} = require('@rsv-tragsa/puml-for-markdown')

const config = loadProjectConfig({ searchDirectory: process.cwd() })
await run(config)
```

## Marcadores Markdown

El marcador oculto es la fuente de verdad:

```markdown
<!--![Arquitectura](../puml/arquitectura.puml)-->
<!-- ![Arquitectura](../puml/arquitectura.puml) -->
<!--[Arquitectura](../puml/arquitectura.puml)-->
<!-- [Arquitectura](../puml/arquitectura.puml) -->
```

En modo local, una imagen queda así:

```markdown
![Arquitectura](../puml/dist/arquitectura.svg)<!--![Arquitectura](../puml/arquitectura.puml)-->
```

La herramienta conserva el comentario original, sustituye el enlace gestionado inmediatamente anterior y no procesa marcadores dentro de código inline ni bloques cercados. La operación es idempotente.

## Modos de enlace

### Local

```bash
pnpm exec puml-for-markdown \
  --root-directory . \
  --puml-directory docs/puml \
  --markdown-directory docs \
  --dist-directory docs/puml/dist \
  --output-images --image-formats both \
  --link-mode local --local-image-format svg
```

La imagen debe existir antes de reescribir Markdown. Si el formato local no forma parte de `--image-formats`, puede reutilizarse una imagen que ya exista. Las rutas visibles son relativas al Markdown, usan siempre `/` y codifican cada segmento, no los separadores.

### Servidor sin acortar

```bash
pnpm exec puml-for-markdown --link-mode server
```

### TinyURL (compatibilidad histórica)

```bash
pnpm exec puml-for-markdown --link-mode tinyurl
```

`tinyurl` es el valor predeterminado. `--turn-off-link-shortening` se conserva como alias obsoleto de `--link-mode server`; combinarlo con otro modo produce un error. TinyURL se carga únicamente en modo `tinyurl`.

## Selección de archivos

La API distingue tres estados:

| Valor | PUML | Markdown |
| --- | --- | --- |
| Propiedad no proporcionada | Todos bajo el directorio (compatibilidad histórica) | Todos bajo el directorio |
| Lista vacía `[]` | Ninguno | Ninguno |
| Lista con rutas | Los indicados y sus consumidores `!include` transitivos | Exclusivamente los indicados existentes |

`--puml-file` y `--markdown-file` pueden repetirse. `--changed-files-stdin0` convierte siempre la selección de ambos tipos en explícita, incluso si una de las dos listas queda vacía. Lee bytes separados por NUL, clasifica `.puml`/`.md`, conserva rutas eliminadas e ignora el resto sin evaluar glob ni comandos. Los `.puml` situados fuera de `pumlDirectory` y los `.md` situados fuera de `markdownDirectory` también se ignoran, lo que permite enviar directamente todos los cambios de un repositorio desde un hook. Las rutas indicadas explícitamente mediante `--puml-file`, `--markdown-file` o la API siguen produciendo un error si escapan de su directorio permitido.

`--regenerate-all` selecciona todos los PUML, pero no cambia una selección Markdown explícita. Sin selección ni entrada estándar se mantiene el escaneo completo histórico.

Regeneración completa:

```bash
pnpm exec puml-for-markdown \
  --root-directory . --puml-directory docs/puml --markdown-directory docs \
  --dist-directory docs/puml/dist --output-images --image-formats both \
  --link-mode local --local-image-format svg \
  --regenerate-all --delete-orphan-images
```

Ejecución incremental:

```bash
pnpm exec puml-for-markdown \
  --root-directory . --puml-directory docs/puml --markdown-directory docs \
  --dist-directory docs/puml/dist --output-images --image-formats both \
  --link-mode local --local-image-format svg \
  --puml-file docs/puml/arquitectura.puml \
  --markdown-file docs/arquitectura.md \
  --delete-orphan-images
```

La generación incremental no borra ni recrea `dist`. Cada descarga se escribe en un temporal del mismo directorio y solo sustituye la imagen anterior cuando termina correctamente.

## Borrados, renombrados y limpieza

`--delete-orphan-images` elimina salidas PNG/SVG registradas en `dist/.puml-for-markdown.json` cuyo `.puml` ya no existe, más las imágenes derivables sin ambigüedad de rutas eliminadas recibidas en la selección. Un renombrado enviado por Git como ruta antigua y nueva elimina las imágenes antiguas y genera las nuevas.

No se siguen enlaces simbólicos, no se elimina fuera de `dist`, y se rechazan como `dist` la raíz del repositorio, `pumlDirectory`, la raíz del sistema o una ruta fuera del repositorio. Los PNG/SVG no registrados se preservan. En la primera ejecución tras migrar no es posible distinguir con seguridad una salida antigua de una imagen ajena sin una ruta eliminada explícita; esas imágenes se conservan.

## Includes y dependencias

Se reconocen `!include`, `!include_once` y `!include_many`, con rutas sin comillas, entre comillas simples o dobles. Las rutas relativas se resuelven desde el archivo declarante. Los includes HTTP(S), FTP, `stdlib:` y `<...>` permanecen remotos. Un include local inexistente se conserva para que el servidor PlantUML pueda diagnosticarlo.

Los includes locales que escapen de `pumlDirectory`, incluso a través de un enlace simbólico, se rechazan. `!include_once` se expande una sola vez por diagrama y `!include_many` permite expansiones repetidas.

El grafo inverso regenera consumidores transitivos: si `sistema.puml` incluye `arquitectura.puml` y esta incluye `common.puml`, cambiar `common.puml` selecciona los tres. Los ciclos locales producen un error legible.

Un archivo se considera auxiliar no renderizable cuando está incluido por otro PUML y el servidor responde HTTP 400 al intentar renderizarlo de forma independiente. Se omite solo esa salida; cualquier otro error HTTP sigue siendo fatal.

## Patrón configurable

El patrón predeterminado es:

```regex
<!--\s*(?<kind>!?)\[(?<label>[^\]]*)\]\((?<target>[^)\r\n]+\.puml)\)\s*-->
```

Puede configurarse por CLI:

```bash
pnpm exec puml-for-markdown \
  --marker-pattern '\{\{diagram:(?<kind>!?)\[(?<label>[^]]*)\]\((?<target>[^)]+\.puml)\)\}\}' \
  --marker-flags i
```

El patrón debe reconocer el marcador completo y declarar los grupos con nombre `kind`, `label` y `target`. La flag `g` se fuerza internamente; `y` se descarta. Para evitar diferencias de escapado entre shells, es preferible pasar un `RegExp` mediante la API.

## API programática

```js
const { run } = require('@rsv-tragsa/puml-for-markdown')

await run({
  rootDirectory: process.cwd(),
  pumlDirectory: 'docs/puml',
  markdownDirectory: 'docs',
  distDirectory: 'docs/puml/dist',
  pumlFiles: ['docs/puml/arquitectura.puml'], // undefined, [], o lista
  markdownFiles: ['docs/arquitectura.md'],
  regenerateAll: false,
  deleteOrphanImages: true,
  outputImages: true,
  imageFormats: ['png', 'svg'],
  linkMode: 'local',
  localImageFormat: 'svg',
  markerPattern: /<!--\s*(?<kind>!?)\[(?<label>[^\]]*)\]\((?<target>[^)]+\.puml)\)\s*-->/g,
  pumlServerUrl: 'https://www.plantuml.com/plantuml',
})
```

Para tests sin red pueden inyectarse `fetchBuffer(url)` y `shortener(url)`.

## Opciones CLI

| Opción | Semántica |
| --- | --- |
| `--config <path>` | Fichero `.cjs`; si se omite se busca `puml-for-markdown.config.cjs` |
| `--root-directory <path>` | Raíz de confianza; los directorios configurados deben quedar dentro |
| `--puml-directory <path>` | Fuentes `.puml`; predeterminado: raíz |
| `--markdown-directory <path>` | Markdown; predeterminado: raíz |
| `--dist-directory <path>` | Imágenes; predeterminado: `dist_puml` |
| `--output-images` | Descarga imágenes |
| `--no-output-images` | Desactiva el valor habilitado por el fichero |
| `--image-formats <png\|svg\|both>` | Formatos descargados; predeterminado: `png` |
| `--puml-server-url <url>` | Base del servidor PlantUML |
| `--link-mode <tinyurl\|server\|local>` | Destino del enlace visible |
| `--local-image-format <png\|svg>` | Formato del enlace local; predeterminado: `svg` |
| `--puml-file <path>` | PUML cambiado, repetible |
| `--markdown-file <path>` | Markdown cambiado, repetible |
| `--changed-files-stdin0` | Selección explícita NUL desde stdin; ignora rutas fuera de los directorios configurados |
| `--regenerate-all` | Selecciona todos los PUML |
| `--no-regenerate-all` | Desactiva la regeneración completa configurada |
| `--delete-orphan-images` | Limpia únicamente imágenes gestionadas huérfanas |
| `--no-delete-orphan-images` | Desactiva la limpieza configurada |
| `--marker-pattern <regex>` | Patrón completo del marcador |
| `--marker-flags <flags>` | Flags del patrón |
| `--turn-off-link-shortening` | Alias obsoleto de `--link-mode server` |
| `--ignore-gitignore` | No aplica `.gitignore` durante el escaneo completo |
| `--respect-gitignore` | Fuerza el uso de `.gitignore` aunque el fichero lo desactive |
| `--gitignore-path <path>` | `.gitignore` alternativo |
| `--hot-reload` | Repite la misma selección |
| `--no-hot-reload` | Desactiva hot reload configurado |
| `--interval-seconds <n>` | Intervalo de hot reload |

Todas las rutas de archivos se resuelven con `node:path`; no se manipulan como URLs ni mediante sustitución de prefijos. Las rutas Markdown se calculan después con `path.relative` y se normalizan explícitamente a `/`.

## Pre-commit incremental

Hay un ejemplo seguro en [`examples/pre-commit`](examples/pre-commit). Obtiene también `distDirectory` del mismo fichero de configuración, por lo que el hook no duplica rutas. Antes de leer el directorio de trabajo detecta archivos `.md`/`.puml` parcialmente preparados y cambios no preparados preexistentes en `dist`; en cualquiera de esos casos falla con un mensaje claro. Después usa:

```bash
git diff --cached --name-only -z --diff-filter=ACMRD | \
  pnpm exec puml-for-markdown \
    --config ./puml-for-markdown.config.cjs \
    --changed-files-stdin0 --delete-orphan-images
```

`git diff --cached` selecciona rutas del índice, pero la herramienta lee contenido del directorio de trabajo. Sin la comprobación previa, un archivo parcialmente preparado podría mezclar contenido no incluido por el usuario. La herramienta no ejecuta Git y no puede leer blobs del índice.

## Desarrollo y publicación

```bash
pnpm install --frozen-lockfile
pnpm test
npm pack --dry-run
```

CI prueba Node.js 22 con pnpm 11 en Ubuntu, Windows y macOS. La publicación solo se activa al publicar un release cuyo tag `vX.Y.Z` coincida con `package.json`; prueba, empaqueta, instala el tarball y comprueba que la versión no exista antes de publicar con `GITHUB_TOKEN`. El paquete no contiene lifecycle scripts de instalación ni configuración local.

Consulta [`MIGRATION.md`](MIGRATION.md) para migrar desde 1.x.

## Licencia

MIT. `LICENSE.md` conserva el aviso de Daniel Yakobian del proyecto original. La declaración ISC de `package.json` 1.2.1 era inconsistente con ese archivo y se corrigió a MIT.
