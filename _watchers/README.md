# publish-watchers

Watches the parent folder and renders every `.md` file whose frontmatter `target`
contains `pdf` to a PDF with the same basename, next to the source. Uses pandoc
(Markdown to Typst markup) and Typst (PDF); both install through uv.

```sh
uv run main.py            # catch up on stale PDFs, then watch
uv run main.py --once     # catch up, then exit
uv run main.py --force    # re-render everything first (e.g. after editing a template)
uv run main.py ~/notes    # watch a different folder
```

Hidden folders and `node_modules` are skipped. If a render fails, the error is logged
and the previous PDF stays in place.

## Frontmatter

```yaml
---
target: web, pdf          # or just `pdf`, or a YAML list
template: scientific      # file name in templates/; default: `default`
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

## Adding a template

Create `templates/<name>.typ` defining the function below, then set `template: <name>`.
All frontmatter is available in `meta`, so new options need no Python changes.
Helpers from `templates/_base.typ` are in scope.

```typst
#let template(body, meta: (:), title: none, subtitle: none, abstract: none) = {
  set text(size: to-length(meta.at("fontsize", default: 11)))
  title
  body
}
```
