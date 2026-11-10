"""Render a Markdown file with `target: web` frontmatter to a static page next
to it (`index.md` -> `index.html`), so its folder is a site you can deploy as is.

Pipeline: thea blocks -> iframes of their built viz (`viz/<name>/index.html`),
then pandoc (Markdown to standalone HTML with `web-template/page.html`).
Images and other files stay relative: they sit next to the doc. The editor runs
this in the background (watch.py), like pdf.py.
"""

import html
import logging
import os
from pathlib import Path

import frontmatter
import pypandoc

import thea
from pdf import LEADING_H1, RenderError, wants

HERE = Path(__file__).parent
TEMPLATE = HERE / "web-template" / "page.html"

log = logging.getLogger("render")


def html_path(source: Path) -> Path:
    return source.with_suffix(".html")


def is_stale(source: Path) -> bool:
    out = html_path(source)
    if not out.exists():
        return True
    built = out.stat().st_mtime
    return source.stat().st_mtime > built or TEMPLATE.stat().st_mtime > built


def render_if_targeted(source: Path, root: Path, force: bool = False) -> Path | None:
    """Render `source` if it targets the web and is out of date. Returns the page's path if rendered."""
    try:
        post = frontmatter.load(source)
    except Exception as e:  # malformed YAML is routine while someone is typing
        raise RenderError(f"invalid frontmatter: {e}") from e
    if not wants(post.metadata.get("target"), "web"):
        return None
    if not force and not is_stale(source):
        return None

    page = render(source.read_text(encoding="utf-8"), source.parent, post.metadata)
    output = html_path(source)
    tmp = output.with_name(f".{output.name}.tmp")
    tmp.write_text(page, encoding="utf-8")
    os.replace(tmp, output)
    return output


def with_vizzes(text: str, folder: Path) -> str:
    """`text` with each thea block replaced by an iframe of its built viz; a block without one is dropped."""
    lines = text.split("\n")
    # from the last block, so that earlier line numbers stay valid
    for block in reversed(thea.blocks(text)):
        built = folder / "viz" / (block.name or "") / thea.BUILT
        if block.name and built.is_file():
            src = html.escape(f"viz/{block.name}/{thea.BUILT}")
            replacement = ["```{=html}",
                           f'<iframe class="thea" src="{src}" sandbox="allow-scripts" title="{block.name}"></iframe>',
                           "```"]
        else:
            # a new block has no name until its first generation
            if block.name:
                log.warning("%s: viz %s isn't built, left out of the page", folder.name, block.name)
            replacement = []
        lines[block.line : block.end + 1] = replacement
    return "\n".join(lines)


def render(text: str, folder: Path, meta: dict) -> str:
    """The standalone page for the Markdown `text` (frontmatter included) of the doc in `folder`."""
    title = meta.get("title")
    body = frontmatter.loads(text).content
    match = LEADING_H1.match(body)
    pagetitle = str(title) if title is not None else match[1] if match else folder.name
    try:
        return pypandoc.convert_text(
            with_vizzes(text, folder),
            "html5",
            format="markdown-citations",
            extra_args=["--standalone", f"--template={TEMPLATE}", "--mathml", "--wrap=none",
                        "--metadata", f"pagetitle={pagetitle}"],
        )
    except RuntimeError as e:
        raise RenderError(str(e)) from e
