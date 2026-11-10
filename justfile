dir := justfile_directory()
editor_dir := dir / "_editor"

# the editor for thea/ on http://127.0.0.1:8767, rendering PDFs and web pages in the background (builds the frontend first if needed)
editor *args:
    [ -f {{editor_dir}}/frontend/dist/index.html ] || just editor-build
    uv run --project {{editor_dir}} python {{editor_dir}}/app.py {{args}}

# the editor frontend with hot reload on :5173, against the API on :8767
editor-dev:
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    uv run --project {{editor_dir}} python {{editor_dir}}/app.py --debug &
    npm --prefix {{editor_dir}}/frontend run dev

# render Markdown with `target: pdf` / `web` to PDF / HTML without the editor: catch up, then watch (--once, --force, a folder)
render *args:
    uv run --project {{editor_dir}} python {{editor_dir}}/watch.py {{args}}

alias pdf := render

# serve a doc's folder (its web page, files and vizzes) as the static site it deploys as, on http://127.0.0.1:8000
site doc port="8000":
    uv run --project {{editor_dir}} python {{editor_dir}}/watch.py --once
    uv run --project {{editor_dir}} python -m http.server {{port}} --bind 127.0.0.1 -d {{dir}}/thea/{{doc}}

editor-build:
    npm --prefix {{editor_dir}}/frontend ci
    npm --prefix {{editor_dir}}/frontend run build

# lint, typecheck, build and test the editor
editor-check:
    npm --prefix {{editor_dir}}/frontend run lint
    npm --prefix {{editor_dir}}/frontend run build
    npm --prefix {{editor_dir}}/frontend test
    cd {{editor_dir}} && uv run pytest -q

# the headless Chromium used to check viz builds and make thumbnails (once)
chromium:
    uv run --project {{editor_dir}} playwright install chromium
