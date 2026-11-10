dir := justfile_directory()
editor_dir := dir / "_editor"

# the editor for thea/ on http://127.0.0.1:8767, rendering PDFs in the background (builds the frontend first if needed)
editor *args:
    [ -f {{editor_dir}}/frontend/dist/index.html ] || just editor-build
    uv run --project {{editor_dir}} python {{editor_dir}}/app.py {{args}}

# the editor frontend with hot reload on :5173, against the API on :8767
editor-dev:
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    uv run --project {{editor_dir}} python {{editor_dir}}/app.py --debug &
    npm --prefix {{editor_dir}}/frontend run dev

# render Markdown with `target: pdf` to PDF without the editor: catch up, then watch (--once, --force, a folder)
pdf *args:
    uv run --project {{editor_dir}} python {{editor_dir}}/pdf.py {{args}}

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
