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

$$
\\sum_{i=1}^n i
$$

```py
def square(x):
    return x * x
```
"""


def test_renders_page_with_vizzes_and_relative_images(tmp_path):
    source = _doc(tmp_path, "target: web", BODY)
    _viz(source, "brisk-river")
    output = web.render_if_targeted(source, tmp_path)
    assert output == tmp_path / "_site" / "doc" / "index.html"
    assert not source.with_suffix(".html").exists()
    page = output.read_text(encoding="utf-8")
    assert "<title>Hello *world*</title>" in page
    assert 'src="photo.jpg"' in page and 'src="./other.png"' in page
    assert page.count('<iframe class="thea"') == 1
    assert 'src="viz/brisk-river/index.html" sandbox="allow-scripts"' in page
    assert "Not built yet" not in page and "A new block" not in page
    assert "<math" in page and '<math display="block"' in page
    assert '<code class="sourceCode python">' in page
    assert '<span class="kw">def</span>' in page


def test_frontmatter_title_is_shown(tmp_path):
    source = _doc(tmp_path, "target: web\ntitle: My *Page*\ndate: 2026-11-10", "Text.\n")
    page = web.render_if_targeted(source, tmp_path).read_text(encoding="utf-8")
    assert "<h1>My <em>Page</em></h1>" in page and "2026-11-10" in page


def test_not_targeted(tmp_path):
    source = _doc(tmp_path, "target: pdf", "Hi\n")
    assert web.render_if_targeted(source, tmp_path) is None
    assert not (tmp_path / "_site").exists()


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
    assert (tmp_path / "_site" / "doc" / "index.html").exists() and source.with_suffix(".pdf").exists()


def test_copies_only_the_files_the_page_links(tmp_path):
    body = ("![](photo.jpg) [data](rain.csv) [shared](../shared/logo.svg) [out](../../outside.txt)\n\n"
            "[web](https://example.com/x.png) [anchor](#top) ![](missing.png)\n\n```thea brisk-river\nA chart.\n```\n")
    source = _doc(tmp_path / "repo", "target: web", body)
    root = tmp_path / "repo"
    _viz(source, "brisk-river")
    (source.parent / "viz" / "brisk-river" / "meta.json").write_text("{}")
    for name in ("photo.jpg", "rain.csv", "unused.png"):
        (source.parent / name).write_bytes(b"x")
    (root / "shared").mkdir()
    (root / "shared" / "logo.svg").write_text("<svg/>")
    (tmp_path / "outside.txt").write_text("secret")

    web.render_if_targeted(source, root)
    site = root / "_site"
    published = sorted(p.relative_to(site).as_posix() for p in site.rglob("*") if p.is_file())
    assert published == ["doc/index.html", "doc/photo.jpg", "doc/rain.csv",
                         "doc/viz/brisk-river/index.html", "shared/logo.svg"]


def test_renders_and_copies_video_and_audio_from_image_syntax(tmp_path):
    source = _doc(tmp_path, "target: web", '![Demo](demo.mp4)\n\n![Voice](voice.mp3)\n')
    (source.parent / "demo.mp4").write_bytes(b"video")
    (source.parent / "voice.mp3").write_bytes(b"audio")
    output = web.render_if_targeted(source, tmp_path)
    page = output.read_text(encoding="utf-8")
    assert '<video src="demo.mp4" controls aria-label="Demo">\n</video>' in page
    assert '<audio src="voice.mp3" controls aria-label="Voice">\n</audio>' in page
    assert (tmp_path / "_site/doc/demo.mp4").read_bytes() == b"video"
    assert (tmp_path / "_site/doc/voice.mp3").read_bytes() == b"audio"


def test_gif_style_video_is_interactive_in_export(tmp_path):
    source = _doc(tmp_path, "target: web", '![Demo](demo.mp4){.gif}\n')
    (source.parent / "demo.mp4").write_bytes(b"video")
    page = web.render_if_targeted(source, tmp_path).read_text(encoding="utf-8")
    assert '<span class="gif" role="button" tabindex="0" aria-label="Demo"><video src="demo.mp4" loop muted playsinline></video></span>' in page
    assert "autoplay" not in page and "span.gif.playing" in page and "video.play()" in page


def test_changed_file_makes_page_stale(tmp_path):
    source = _doc(tmp_path, "target: web", "![](photo.jpg)\n")
    photo = source.parent / "photo.jpg"
    photo.write_bytes(b"old")
    web.render_if_targeted(source, tmp_path)
    assert web.render_if_targeted(source, tmp_path) is None
    photo.write_bytes(b"newer")
    assert web.render_if_targeted(source, tmp_path) is not None
    assert (tmp_path / "_site" / "doc" / "photo.jpg").read_bytes() == b"newer"
