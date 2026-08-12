#!/bin/sh
set -eu

# Configuración (rutas relativas a la raíz del repositorio)
markdown_directory="docs"
puml_directory="docs/puml"
dist_directory="docs/puml/dist"  # carpeta dedicada para las imágenes gestionadas
image_formats="both"              # png, svg o both
local_image_format="svg"          # formato enlazado desde Markdown: png o svg
puml_server_url="https://www.plantuml.com/plantuml"
debug_mode="off"                  # off, normal o strict
                                  # off: no bloquea el commit si todo termina correctamente.
                                  # normal: bloquea cuando se ejecuta puml-for-markdown.
                                  # strict: bloquea ante cualquier archivo staged, aunque no sea .md ni .puml.

repo_root="$(git rev-parse --show-toplevel)"

# Normaliza las rutas configuradas para compararlas con las rutas de Git.
markdown_directory="${markdown_directory#./}"
puml_directory="${puml_directory#./}"
dist_directory="${dist_directory#./}"
markdown_directory="${markdown_directory%/}"
puml_directory="${puml_directory%/}"
dist_directory="${dist_directory%/}"
[ -n "$markdown_directory" ] || markdown_directory="."
[ -n "$puml_directory" ] || puml_directory="."

case "$dist_directory" in
  ""|.|..|../*|*/../*|*/..|/*|[A-Za-z]:*)
    echo "dist_directory debe ser una subcarpeta relativa y dedicada: $dist_directory"
    exit 1
    ;;
esac

case "$image_formats:$local_image_format" in
  png:png|svg:svg|both:png|both:svg) ;;
  *)
    echo "Configuración PUML no válida: image_formats=$image_formats, local_image_format=$local_image_format"
    exit 1
    ;;
esac

case "$debug_mode" in
  off|normal|strict) ;;
  *)
    echo "debug_mode no válido: $debug_mode (valores: off, normal, strict)"
    exit 1
    ;;
esac

has_staged_changes="false"
if ! git -C "$repo_root" diff --cached --quiet --diff-filter=ACMRD; then
  has_staged_changes="true"
fi

should_run="false"
if ! git -C "$repo_root" diff --cached --quiet --diff-filter=ACMRD -- '*.md' '*.puml'; then
  should_run="true"
fi

if [ "$should_run" != "true" ]; then
  echo "PUML: no hay cambios preparados en Markdown o PUML"

  if [ "$debug_mode" = "strict" ] && [ "$has_staged_changes" = "true" ]; then
    echo "PUML: commit bloqueado porque debug_mode=strict"
    exit 1
  fi

  exit 0
fi

markdown_path="$repo_root"
puml_path="$repo_root"
[ "$markdown_directory" = "." ] || markdown_path="$repo_root/$markdown_directory"
[ "$puml_directory" = "." ] || puml_path="$repo_root/$puml_directory"

git -C "$repo_root" diff --cached --name-only -z --diff-filter=ACMRD | \
  mise exec -- pnpm puml \
    --root-directory "$repo_root" \
    --markdown-directory "$markdown_path" \
    --puml-directory "$puml_path" \
    --output-images \
    --image-formats "$image_formats" \
    --dist-directory "$repo_root/$dist_directory" \
    --gitignore-path "$repo_root/.gitignore" \
    --puml-server-url "$puml_server_url" \
    --link-mode local \
    --local-image-format "$local_image_format" \
    --changed-files-stdin0 \
    --delete-orphan-images

git -C "$repo_root" diff --cached --name-only -z --diff-filter=ACMR -- '*.md' | \
  git -C "$repo_root" add --pathspec-from-file=- --pathspec-file-nul

git -C "$repo_root" add -A -- "$dist_directory"

if [ "$debug_mode" != "off" ]; then
  echo "PUML: commit bloqueado porque debug_mode=$debug_mode"
  exit 1
fi
