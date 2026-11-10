# publish-editor

Two things in one process:

- In the background, every `.md` in the repo whose frontmatter `target` has
  `pdf` is rendered to a PDF next to it, and one with `web` to an HTML page
  in the site folder `_site/`, on startup if it's out of date and whenever it changes (see
  [PDF](#pdf) and [Web](#web)).
- A local editor for the Markdown docs under `thea/`, with viz blocks: a fenced
  block whose info string is `thea` holds the spec of an interactive
  visualization. The local [claude CLI](https://claude.com/claude-code)
  generates it as a small TypeScript project, built into one offline HTML file,
  which the preview shows live. Ported and trimmed from dsl's thea blocks.

```sh
just chromium        # once: the headless Chromium for checks and thumbnails
just editor          # http://127.0.0.1:8767, and PDFs in the background
just editor --model sonnet --budget-usd 1 --timeout-min 15
just editor --no-watch   # no PDFs or pages
just editor --force-pdf  # re-render every PDF and page first (e.g. after editing a template)
just editor-dev      # frontend with hot reload on :5173
just editor-check    # lint, typecheck, build, test
just render          # only the PDFs and pages: catch up, then watch (alias: just pdf)
just render --once   # catch up, then exit (--force: re-render everything)
just render ~/notes  # watch a different folder
just export          # build _site/ from scratch: the static site of every `target: web` doc
just site            # export, then serve _site/ on :8000 (e.g. /thea/psnr/)
just deploy          # export, then deploy _site/ to Netlify from here (--prod for production)
```

The CLI command is `claude`, or `$THEA_CLI`. The server listens on localhost
only: generating runs code as you.

## Layout

```
thea/<doc>/index.md            the doc
thea/<doc>/rain.csv …          its files (data, images, fonts), flat next to it
thea/<doc>/viz/<name>/         one viz, generated, committed
  src/ package.json …          its sources
  index.html                   the built page
  thumb.png                    800 px wide rendered at 420, cut to 5:3 at most
  meta.json                    the spec it was built from, model, time, turns, cost
```

## Viz blocks

````
```thea brisk-river
A bar chart of monthly rainfall in Berlin; hovering a bar shows its value.
```
````

The name in the header (`<adjective>-<noun>`) is only the viz's identity, the
folder its build lives in. A new block is a bare ```` ```thea ````. Its first
generation writes a random name into the editor's draft, and saving the doc
keeps it. The server never writes the doc.

Generating sends the spec as it is in the editor, so the doc doesn't need saving
first. A block whose spec differs from `meta.json`'s says "spec changed". A
rebuild replaces `viz/<name>/`, and git is the version history. A viz whose
block was removed or renamed stays on disk until you delete it.

## Markdown extensions

Every renderer (the preview, the web page and the PDF) understands two
additions to Markdown:

```
??? Optional label
Anything, viz blocks included; collapsed by default.
!!!

![original|500](original.jpg)
```

- A line `???` opens a collapsed section, a line `!!!` closes it. The text
  after `???` is its summary (default "Details"). Sections nest, one left open
  closes at the end of the doc, and lines inside fenced code don't count. A PDF
  shows the content, with the label as a bold line.
- `|500` at the end of an image's alt text shows it at most 500 px wide (and
  never wider than the page). A PDF sets that width.

`mdext.py` rewrites them to plain pandoc Markdown for the web page and the PDF;
`frontend/src/dumb/mdext.ts` mirrors it for the preview.

Fenced code uses the language in its info string for syntax highlighting; for
example, a `py` fence uses Python highlighting. Inline TeX (`$x^2$`) and display
TeX (a `$$` delimiter on its own line before and after the formula) render as
math in the preview and published output.

## Files

A doc's files sit next to its `index.md`: CSV, TSV, JSON, GeoJSON, text,
Markdown, images and fonts, at most 10 MB each, named with letters, digits,
`.`, `_` and `-`. A file copied into the folder by hand is one of them too.

The Files panel above the editor shows them as tiles, images as thumbnails.
Clicking one inserts a reference at the cursor: the bare name inside a viz
spec, `![](name)` for an image in the prose. Dropping files on the panel or
"Add" copies them into the folder; dropping or pasting them into the editor
also inserts references where they land. The preview, the web page and the PDF
all show `![](name)` images.

A spec names a file by its bare name ("monthly rainfall from rain.csv").
Generating copies the doc's files into the workspace's `files/`, read-only,
with `FILES.md` describing each (size, first lines or JSON shape). The viz
imports what it uses (`../files/rain.csv`) and the build inlines it, so a
built page holds at most 5 MB of them (`FILES.md` flags larger files). The files
are never copied into `viz/<name>/`. After changing a file, regenerate the
vizzes that use it.

## Generating

One background thread runs the jobs, one at a time (`generate.py`):

1. The workspace `~/.cache/publish-thea/<doc>/<name>/` gets the viz's current
   sources, or `template/` for a first run (its `node_modules` stays between
   runs), with the template's current `build.mjs`. `SPEC.md` holds the spec,
   `files/` and `FILES.md` the doc's files, and `PREVIOUS_ERRORS.md` the runtime
   errors the live viz reported plus the viz's last failure.
2. `npm install --ignore-scripts`.
3. `claude -p --restricted` in the workspace with no MCP servers, the tools Read,
   Write, Edit, Glob, Grep and Bash (only `npm`/`npx`), and `system-prompt.md`
   appended. It can edit `package.json` scripts and run them, so it can
   effectively run any code in the workspace, as you.
4. The editor runs `npm run build`, `lint` and `check` itself. If one fails, it
   resumes the CLI's session once with the output. If it still fails, the job
   fails.
5. The sources, the built page, a thumbnail and `meta.json` replace the viz folder.

`check.py` (the template's `npm run check`) renders the page in headless
Chromium at 360 and 1000 px wide, light and dark, with every request blocked.
It fails on errors, blocked requests, horizontal overflow or an empty page.

Jobs live in memory: a done job is listed for 30 minutes, and a failure until
the viz's next run or a restart.

## Showing

The preview renders the draft with `marked` and puts a `TheaBlock` in each
`thea` fence's place. A built viz is `GET /api/viz/<doc>/<name>/view` in an
`<iframe sandbox="allow-scripts">`. The response's CSP makes it an opaque origin
without network. The iframe is as high as the page reports (the bridge in
`template/build.mjs` posts `resize` and `error` messages).

## Views

`frontend/src/views/registry.ts` maps a repo path (the location hash,
`#thea/<doc>`) to a view. A bespoke view for another folder is a component plus
a line there.

## PDF

`watch.py` watches the repo (hidden folders, `node_modules` and thea's `viz/`
skipped). `pdf.py` renders a doc with pandoc (Markdown to Typst markup) and
Typst (PDF); both install through uv. The editor runs this on a thread of its
own, so it never waits on viz generation, and `just pdf` runs it alone. If a
render fails, the error is logged and the previous PDF stays in place.
`GET /api/status` lists each render since startup under `render`, by file and
kind (`pdf`, `web`).

## Web

A doc with `web` in its frontmatter `target` is rendered by `web.py` into the
site folder `_site/` (gitignored), at the doc's path in the repo, with the local
files the page links copied along:

```
_site/thea/psnr/
  index.html                   the page of thea/psnr/index.md
  original.jpg …               the files it links (images, `[data](rain.csv)`)
  viz/serene-yak/index.html    each viz shown, in an iframe
```

Only what the page links is published: not the `.md`, not unlinked files, not
the vizzes' sources, thumbnails or `meta.json`. A link may leave the doc's
folder (`../shared/logo.svg` lands at `_site/thea/shared/logo.svg`) but not the
repo or a hidden folder. A page is re-rendered when its doc, the template or a
linked file changes. Files dropped from a page stay in `_site/` until the next
`just export`, which builds it from scratch.

Each `thea` block becomes `<iframe sandbox="allow-scripts"
src="viz/<name>/index.html">`, sized by the height the viz reports and given
the page's light or dark theme. A block whose viz isn't built is left out (it
is re-rendered after the viz's first build). The rest is pandoc's Markdown to
HTML (`web-template/page.html`, MathML for `$math$`), with no request
outside the site. Links keep their relative paths. Frontmatter `title`,
`subtitle`, `author`, `date`, `lang` and `description` are used.

### Deploying

`_site/` is a plain static site, so any host works. For Netlify, the repo's
`netlify.toml` builds it with `watch.py --once --force --only web` (uv brings
its own Python, pandoc comes with `pypandoc-binary`) and publishes `_site/`:
connect the repo in Netlify and every push to `main` deploys. Without the git
integration, `just deploy` builds locally and uploads (a draft URL;
`just deploy --prod` for the live one), after `npx netlify-cli login` and
`npx netlify-cli link` once.

URLs follow the repo: `thea/psnr/index.md` is `https://<site>/thea/psnr/`.
Vizzes are never built during a deploy: their `viz/<name>/index.html` is
committed. A static host sends no CSP header, so the iframe's sandbox is what
isolates a viz there.

### Frontmatter

```yaml
---
target: web, pdf          # `web`: an HTML page, `pdf`: a PDF; or a YAML list
template: scientific      # file name in pdf-templates/; default: `default`
title: My *Paper*         # default: a leading `# H1` in the body
---
```

Every template accepts:

| Key | Meaning | Example |
| --- | --- | --- |
| `title`, `subtitle`, `abstract` | may contain inline Markdown | |
| `author` / `authors` | string, or list of strings or `{name, affiliation, email}` | |
| `date` | shown as written | `2026-11-09` |
| `keywords` | list or comma-separated | `a, b` |
| `lang` | hyphenation and localized labels | `de` |
| `papersize` | Typst paper name | `us-letter` |
| `margin` | any Typst length | `2.5cm` |
| `font` | body font | `Noto Serif` |
| `fontsize` | number in pt, or a length | `11` |
| `numbering` | section numbering pattern, or `false` | `1.a` |
| `toc` | table of contents | `true` |
| `bibliography` | `.bib` file(s), relative to the note; enables `[@key]` | `refs.bib` |
| `csl` | Typst style name or a `.csl` file | `apa` |

`default` also takes `heading-font` and `accent` (a hex colour). `scientific` also takes
`columns` (`2` for a two-column paper).

Images and bibliographies must be inside the watched folder.

### Adding a template

Create `pdf-templates/<name>.typ` defining the function below, then set `template: <name>`.
All frontmatter is available in `meta`, so new options need no Python changes.
Helpers from `pdf-templates/_base.typ` are in scope. `pdf-templates/normalize.lua` is the
pandoc filter applied to every body (heading levels, image paths).

```typst
#let template(body, meta: (:), title: none, subtitle: none, abstract: none) = {
  set text(size: to-length(meta.at("fontsize", default: 11)))
  title
  body
}
```
