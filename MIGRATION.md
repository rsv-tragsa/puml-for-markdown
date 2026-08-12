# Migración desde puml-for-markdown 1.x

La versión 2 es mayor porque cambia el nombre del paquete a `@rsv-tragsa/puml-for-markdown`, exige Node.js 22 y corrige el mapeo histórico de imágenes. El binario sigue llamándose `puml-for-markdown` y `require(...)` sigue devolviendo una función invocable; también expone `{ run }`.

## Cambios necesarios

1. Configura el scope `@rsv-tragsa` para `https://npm.pkg.github.com` e instala el paquete scoped.
2. Cambia cualquier expectativa de `dist/<ruta-desde-root>`: ahora una fuente `pumlDirectory/sub/api.puml` genera exactamente `distDirectory/sub/api.png` o `.svg`.
3. Para conservar enlaces directos sin TinyURL, sustituye `--turn-off-link-shortening` por `--link-mode server`. El alias antiguo continúa disponible.
4. Para enlaces locales, añade `--output-images`, el formato necesario, `--link-mode local` y `--local-image-format`.
5. En hooks, pasa las rutas explícitas con `--changed-files-stdin0`; una entrada que solo contiene Markdown ya no regenera todos los diagramas.
6. Sustituye cualquier borrado previo de `dist` por `--delete-orphan-images`. La herramienta preserva archivos no gestionados.
7. Centraliza los valores repetidos del hook o de `package.json` en `puml-for-markdown.config.cjs`; el CLI lo autodetecta en `rootDirectory` y permite seleccionar otro mediante `--config`.

## Compatibilidad conservada

Se mantienen `--root-directory`, `--puml-directory`, `--markdown-directory`, `--dist-directory`, `--output-images`, `--image-formats`, `--puml-server-url`, `--ignore-gitignore`, `--gitignore-path`, hot reload y el comportamiento de escaneo completo cuando no existe una selección explícita.

## Cambios deliberados

- La URL PlantUML ya no incluye la llave `}` errónea al final.
- Un fallo de descarga es fatal y deja intacta la imagen anterior; solo HTTP 400 de un fragmento incluido se omite.
- Se rechazan rutas fuera de los directorios configurados y directorios `dist` peligrosos.
- `--changed-files-stdin0` ignora rutas `.md`/`.puml` fuera de los directorios configurados para aceptar un diff completo del repositorio; las selecciones indicadas explícitamente siguen rechazándose.
- El paquete ya no ejecuta `husky install` al instalarse o empaquetarse.
- La licencia declarada pasa de ISC a MIT para coincidir con `LICENSE.md` del repositorio original.

## Limpieza inicial

El manifiesto de imágenes gestionadas se crea en la primera generación 2.x. Una imagen huérfana anterior sin una ruta `.puml` eliminada explícitamente se preserva porque no puede distinguirse con seguridad de un recurso ajeno. Revísala manualmente una vez; las generaciones posteriores quedan registradas.
