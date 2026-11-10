import os
from pathlib import Path

import pytest

import watch
import web
from pdf import wants


@pytest.mark.parametrize("target, kind, expected", [
    ("web", "web", True), ("web, pdf", "web", True), (["pdf", "WEB"], "web", True),
    ("pdf", "web", False), (None, "web", False), ("website", "web", False), ("web, pdf", "pdf", True),
])
def test_wants(target, kind, expected):
    assert wants(target, kind) is expected


def _doc(root: Path, frontmatter: str, body: str) -> Path:
    path = root / "doc" / "index.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"---\n{frontmatter}\n---\n\n{body}", encoding="utf-8")
    return path


def _viz(doc: Path, name: str) -> None:
    built = doc.parent / "viz" / name / "index.html"
    built.parent.mkdir(parents=True)
    built.write_text("<!doctype html>", encoding="utf-8")


BODY = """# Hello *world*

![a photo](photo.jpg) ![](./other.png)

```thea brisk-river
A bar chart.
```

```thea serene-yak
Not built yet.
```

```thea
A new block.
```

$x^2$
"""


def test_renders_page_with_vizzes_and_relative_images(tmp_path):
    source = _doc(tmp_path, "target: web", BODY)
    _viz(source, "brisk-river")
    output = web.render_if_targeted(source, tmp_path)
    assert output == source.with_suffix(".html")
    page = output.read_text(encoding="utf-8")
    assert "<title>Hello *world*</title>" in page
    assert 'src="photo.jpg"' in page and 'src="./other.png"' in page
    assert page.count('<iframe class="thea"') == 1
    assert 'src="viz/brisk-river/index.html" sandbox="allow-scripts"' in page
    assert "Not built yet" not in page and "A new block" not in page
    assert "<math" in page


def test_frontmatter_title_is_shown(tmp_path):
    source = _doc(tmp_path, "target: web\ntitle: My *Page*\ndate: 2026-11-10", "Text.\n")
    page = web.render_if_targeted(source, tmp_path).read_text(encoding="utf-8")
    assert "<h1>My <em>Page</em></h1>" in page and "2026-11-10" in page


def test_not_targeted(tmp_path):
    source = _doc(tmp_path, "target: pdf", "Hi\n")
    assert web.render_if_targeted(source, tmp_path) is None
    assert not source.with_suffix(".html").exists()


def test_renders_once_until_changed_or_forced(tmp_path):
    source = _doc(tmp_path, "target: web", "Hi\n")
    output = web.render_if_targeted(source, tmp_path)
    assert web.render_if_targeted(source, tmp_path) is None
    assert web.render_if_targeted(source, tmp_path, force=True) == output
    later = output.stat().st_mtime + 5
    os.utime(source, (later, later))
    assert web.render_if_targeted(source, tmp_path) == output


def test_watch_records_each_kind(tmp_path):
    source = _doc(tmp_path, "target: web, pdf", "# Hi\n\nText.\n")
    watch.render(source, tmp_path)
    result = watch.results()["doc/index.md"]
    assert result["web"]["ok"] and result["pdf"]["ok"]
    assert source.with_suffix(".html").exists() and source.with_suffix(".pdf").exists()
