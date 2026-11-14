# recipe arguments reach commands as "$@", so ones with spaces stay whole
set positional-arguments

dir := justfile_directory()
editor_dir := dir / "_editor"
frontend := editor_dir / "frontend"

# Rebuilt on every start, as a stale dist/ silently serves old code; vite only, so a type error can't keep the editor from starting.

# the editor for thea/ on http://127.0.0.1:8767, rendering PDFs and web pages in the background (rebuilds the frontend first)
editor *args: _frontend-deps
    cd '{{frontend}}' && npx vite build --logLevel warn
    uv run --project '{{editor_dir}}' python '{{editor_dir}}/app.py' "$@"

# the editor frontend with hot reload on :5173, against the API on :8767
editor-dev: _frontend-deps
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    uv run --project '{{editor_dir}}' python '{{editor_dir}}/app.py' --debug &
    npm --prefix '{{frontend}}' run dev

# render Markdown with `target: pdf` / `web` to PDF / HTML without the editor: catch up, then watch (--once, --force, a folder)
render *args:
    uv run --project '{{editor_dir}}' python '{{editor_dir}}/watch.py' "$@"

alias pdf := render

# build the static site from scratch into _site/: every `target: web` doc, with only the files its page links (Netlify runs this)
export:
    rm -rf -- '{{dir}}/_site'
    uv run --project '{{editor_dir}}' --no-dev python '{{editor_dir}}/watch.py' --once --force --only web

# serve _site/ as it deploys, on http://127.0.0.1:8000 (e.g. /thea/psnr/)
site port="8000": export
    uv run --project '{{editor_dir}}' python -m http.server "$1" --bind 127.0.0.1 -d '{{dir}}/_site'

# build and deploy _site/ to Netlify from here, without the git integration (`npx netlify-cli login` and `link` once)
deploy *args: export
    npx --yes netlify-cli deploy --no-build --dir '{{dir}}/_site' "$@"

# a clean install of the frontend's dependencies, then a full build (type check included)
editor-build:
    npm --prefix '{{frontend}}' ci
    npm --prefix '{{frontend}}' run build

# lint, typecheck, build and test the editor
editor-check: _frontend-deps
    npm --prefix '{{frontend}}' run lint
    npm --prefix '{{frontend}}' run build
    npm --prefix '{{frontend}}' test
    cd '{{editor_dir}}' && uv run pytest -q

# the headless Chromium used to check viz builds and make thumbnails (once)
chromium:
    uv run --project '{{editor_dir}}' playwright install chromium

# installs the frontend's dependencies when they're missing or older than package-lock.json (npm writes its own lock into node_modules)
[private]
_frontend-deps:
    [ '{{frontend}}/node_modules/.package-lock.json' -nt '{{frontend}}/package-lock.json' ] || npm --prefix '{{frontend}}' ci
