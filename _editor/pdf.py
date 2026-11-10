"""Render a Markdown file with `target: pdf` frontmatter to a PDF next to it.

Pipeline: frontmatter -> pandoc (Markdown to Typst markup) -> Typst (PDF).
The editor runs this in the background (watch.py); `python watch.py` runs it alone.
"""

import json
import os
import re
from functools import cache
from pathlib import Path

import frontmatter
import pypandoc
import typst

import mdext

HERE = Path(__file__).parent
TEMPLATES = HERE / "pdf-templates"
NORMALIZE_FILTER = TEMPLATES / "normalize.lua"
DEFAULT_TEMPLATE = "default"

LEADING_H1 = re.compile(r"\A\s*#[ \t]+(.+?)[ \t]*#*[ \t]*(?:\n|\Z)")


@cache
def _fonts() -> typst.Fonts:
    """Scanning system fonts is slow, so it's done once, on the first render."""
    return typst.Fonts()


class RenderError(Exception):
    """A document could not be rendered; the message is meant for the log."""


def wants(target, kind: str) -> bool:
    """Whether frontmatter `target` names `kind`: `target: pdf`, `target: web, pdf` and YAML lists."""
    values = target if isinstance(target, list) else [target]
    tokens = (t for v in values for t in re.split(r"[,\s]+", str(v)))
    return any(t.lower() == kind for t in tokens)


def wants_pdf(target) -> bool:
    return wants(target, "pdf")


def available_templates() -> list[str]:
    return sorted(p.stem for p in TEMPLATES.glob("*.typ") if not p.stem.startswith("_"))


def pdf_path(source: Path) -> Path:
    return source.with_suffix(".pdf")


def is_stale(source: Path) -> bool:
    pdf = pdf_path(source)
    return not pdf.exists() or source.stat().st_mtime > pdf.stat().st_mtime


def render_if_targeted(source: Path, root: Path, force: bool = False) -> Path | None:
    """Render `source` if it targets PDF and is out of date. Returns the PDF path if rendered."""
    try:
        post = frontmatter.load(source)
    except Exception as e:  # malformed YAML is routine while someone is typing
        raise RenderError(f"invalid frontmatter: {e}") from e

    if not wants_pdf(post.metadata.get("target")):
        return None
    if not force and not is_stale(source):
        return None

    pdf = _compile(source, root, dict(post.metadata), post.content)

    # Replace atomically so PDF viewers never reload a half-written file.
    output = pdf_path(source)
    tmp = output.with_name(f".{output.name}.tmp")
    tmp.write_bytes(pdf)
    os.replace(tmp, output)
    return output


def _compile(source: Path, root: Path, meta: dict, body: str) -> bytes:
    # Typst paths starting with "/" resolve against the project root, so images
    # and bibliographies are rewritten to that form relative to the source file.
    doc_dir = source.parent

    def rooted(path) -> str:
        try:
            return "/" + (doc_dir / str(path)).resolve().relative_to(root).as_posix()
        except ValueError:
            raise RenderError(f"{path} is outside the watched folder {root}") from None

    title = meta.get("title")
    if title is None and (match := LEADING_H1.match(body)):
        title = match[1]
        body = body[match.end() :]

    meta["authors"] = _normalize_authors(meta)
    if isinstance(meta.get("keywords"), str):
        meta["keywords"] = [k.strip() for k in meta["keywords"].split(",") if k.strip()]

    bibliography = meta.get("bibliography")
    if bibliography:
        files = bibliography if isinstance(bibliography, list) else [bibliography]
        meta["bibliography"] = [rooted(f) for f in files]
    else:
        meta.pop("bibliography", None)
    if str(meta.get("csl", "")).endswith(".csl"):
        meta["csl"] = rooted(meta["csl"])

    typst_source = _assemble(
        template=str(meta.get("template") or DEFAULT_TEMPLATE),
        title=_to_typst(title),
        subtitle=_to_typst(meta.get("subtitle")),
        abstract=_to_typst(meta.get("abstract")),
        body=_body_to_typst(body, rooted(".") if doc_dir != root else "", bool(bibliography)),
    )

    try:
        return typst.compile(
            typst_source.encode(),
            root=root,
            font_paths=_fonts(),
            # default=str: YAML turns bare dates into date objects
            sys_inputs={"meta": json.dumps(meta, default=str)},
        )
    except typst.TypstError as e:
        raise RenderError(e.diagnostic or e.message) from e


def _assemble(template: str, title, subtitle, abstract, body: str) -> str:
    """Build one Typst source: shared helpers + template + this document."""
    path = TEMPLATES / f"{template}.typ"
    if template.startswith("_") or not path.is_file():
        raise RenderError(
            f"unknown template {template!r}; available: {', '.join(available_templates())}"
        )

    def content(markup: str | None) -> str:
        return "none" if markup is None else f"[{markup}]"

    base = (TEMPLATES / "_base.typ").read_text()
    return f"""{base}
{path.read_text()}
#let meta = json(bytes(sys.inputs.meta))
#show: template.with(
  meta: meta,
  title: {content(title)},
  subtitle: {content(subtitle)},
  abstract: {content(abstract)},
)

{body}

#references(meta)
"""


def _normalize_authors(meta: dict) -> list[dict]:
    """`author` or `authors`: a string, or a list of strings or {name, affiliation, email}."""
    authors = meta.get("authors") or meta.get("author") or []
    if not isinstance(authors, list):
        authors = [authors]
    return [a if isinstance(a, dict) else {"name": str(a)} for a in authors]


def _to_typst(markdown) -> str | None:
    """Convert a frontmatter value that may contain inline Markdown."""
    if markdown is None:
        return None
    return _pandoc(str(markdown), "markdown-yaml_metadata_block-citations").strip()


def _body_to_typst(body: str, doc_dir: str, citations: bool) -> str:
    # Without a bibliography, "@name" is plain text rather than a citation key
    # that would make Typst fail.
    markdown = "markdown-yaml_metadata_block" + ("" if citations else "-citations")
    return _pandoc(
        mdext.extend(body, "pdf"),
        markdown,
        filters=[str(NORMALIZE_FILTER)],
        extra_args=["--metadata", f"doc-dir={doc_dir}"],
    )


def _pandoc(text: str, input_format: str, filters=None, extra_args=()) -> str:
    return pypandoc.convert_text(
        text,
        "typst",
        format=input_format,
        filters=filters,
        extra_args=["--wrap=none", *extra_args],
    )
