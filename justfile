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

# build the static site from scratch into _site/: every `target: web` doc, with only the files its page links (Netlify runs this)
export:
    rm -rf {{dir}}/_site
    uv run --project {{editor_dir}} --no-dev python {{editor_dir}}/watch.py --once --force --only web

# serve _site/ as it deploys, on http://127.0.0.1:8000 (e.g. /thea/psnr/)
site port="8000": export
    uv run --project {{editor_dir}} python -m http.server {{port}} --bind 127.0.0.1 -d {{dir}}/_site

# build and deploy _site/ to Netlify from here, without the git integration (`npx netlify-cli login` and `link` once)
deploy *args: export
    npx --yes netlify-cli deploy --no-build --dir {{dir}}/_site {{args}}

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
