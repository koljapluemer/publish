"""Render a Markdown file with `target: web` frontmatter to a static page in the
site folder `_site/`, at the doc's path in the repo (`thea/psnr/index.md` ->
`_site/thea/psnr/index.html`), with the local files it references copied next
to it. `_site/` is the whole static site, deployed as is (netlify.toml).

Pipeline: thea blocks -> iframes of their built viz (`viz/<name>/index.html`),
then pandoc (Markdown to standalone HTML with `web-template/page.html`), then
every relative `src`/`href` of the page that is a file in the repo is copied to
the same relative place in `_site/`. Nothing else is published: not the doc,
not the vizzes' sources. The editor runs this in the background (watch.py),
like pdf.py.
"""

import html
import logging
import os
import shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

import frontmatter
import pypandoc

import mdext
import thea
from pdf import LEADING_H1, RenderError, wants

HERE = Path(__file__).parent
TEMPLATE = HERE / "web-template" / "page.html"
SITE = "_site"

log = logging.getLogger("render")


def site_dir(root: Path) -> Path:
    return root / SITE


def html_path(source: Path, root: Path) -> Path:
    """Where the page of `source` goes: its path under `root`, in the site folder."""
    return site_dir(root) / source.relative_to(root).with_suffix(".html")


class _Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls: list[str] = []

    def handle_starttag(self, tag, attrs):
        self.urls += [v for k, v in attrs if k in ("src", "href") and v]


def assets(page: str, source: Path, root: Path) -> dict[Path, Path]:
    """The local files the page links to: their copy in the site -> the file in the repo.
    Links outside `root`, into hidden folders or the site folder, or to no file are skipped."""
    parser = _Links()
    parser.feed(page)
    root = root.resolve()
    site = site_dir(root)
    out: dict[Path, Path] = {}
    for url in parser.urls:
        parts = urlsplit(url)
        if parts.scheme or parts.netloc or not parts.path or parts.path.startswith("/"):
            continue
        rel = unquote(parts.path)
        src = (source.parent / rel).resolve()
        if not src.is_relative_to(root) or not src.is_file():
            continue
        inner = src.relative_to(root)
        if inner.parts[0] == SITE or any(p.startswith(".") for p in inner.parts):
            continue
        out[site / inner] = src
    return out


def _outdated(copy: Path, src: Path) -> bool:
    if not copy.exists():
        return True
    a, b = copy.stat(), src.stat()
    return a.st_size != b.st_size or a.st_mtime != b.st_mtime


def sync_assets(page: str, source: Path, root: Path) -> None:
    for copy, src in assets(page, source, root).items():
        if _outdated(copy, src):
            copy.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, copy)  # keeps the mtime, which _outdated compares


def is_stale(source: Path, root: Path) -> bool:
    out = html_path(source, root)
    if not out.exists():
        return True
    built = out.stat().st_mtime
    if source.stat().st_mtime > built or TEMPLATE.stat().st_mtime > built:
        return True
    page = out.read_text(encoding="utf-8")
    return any(_outdated(copy, src) for copy, src in assets(page, source, root).items())


def render_if_targeted(source: Path, root: Path, force: bool = False) -> Path | None:
    """Render `source` if it targets the web and is out of date. Returns the page's path if rendered."""
    try:
        post = frontmatter.load(source)
    except Exception as e:  # malformed YAML is routine while someone is typing
        raise RenderError(f"invalid frontmatter: {e}") from e
    if not wants(post.metadata.get("target"), "web"):
        return None
    if not force and not is_stale(source, root):
        return None

    page = render(source.read_text(encoding="utf-8"), source.parent, post.metadata)
    output = html_path(source, root)
    output.parent.mkdir(parents=True, exist_ok=True)
    sync_assets(page, source, root)
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
            mdext.extend(with_vizzes(text, folder), "web"),
            "html5",
            format="markdown-citations",
            extra_args=["--standalone", f"--template={TEMPLATE}", "--mathml", "--wrap=none",
                        "--metadata", f"pagetitle={pagetitle}"],
        )
    except RuntimeError as e:
        raise RenderError(str(e)) from e
