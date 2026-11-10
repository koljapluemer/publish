import threading
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

import pdf
import typst_pdf
import watch
from pdf import RenderError, render_if_targeted, wants_pdf


@pytest.mark.parametrize("target, expected", [
    ("pdf", True), ("web, pdf", True), ("PDF", True), (["web", "pdf"], True),
    ("web", False), (None, False), ("pdfs", False),
])
def test_wants_pdf(target, expected):
    assert wants_pdf(target) is expected


def test_templates_are_found():
    assert {"default", "scientific"} <= set(pdf.available_templates())


@pytest.mark.parametrize("rel, expected", [
    ("a/index.md", True), ("index.md", True), ("deep/nested/index.md", True),
    ("typst/paper/index.typ", True), ("other/paper/index.typ", True),
    ("typst/paper/nested/index.typ", True), ("typst/paper/helper.typ", False),
    ("a/readme.md", False), ("a/index.txt", False), (".hidden/index.md", False),
    ("a/.index.md.tmp", False), ("node_modules/x/index.md", False),
    ("thea/doc/viz/brisk-river/src/index.md", False),
])
def test_is_watched(tmp_path, rel, expected):
    assert watch.is_watched(tmp_path / rel, tmp_path) is expected


def test_outside_root_is_not_watched(tmp_path):
    assert not watch.is_watched(tmp_path.parent / "x.md", tmp_path)


def test_collector_debounces_and_follows_renames(tmp_path, monkeypatch):
    monkeypatch.setattr(watch, "DEBOUNCE_SECONDS", 0.05)
    collector = watch.ChangeCollector(tmp_path)
    doc = tmp_path / "a" / "index.md"
    for _ in range(3):
        collector.on_any_event(SimpleNamespace(is_directory=False, event_type="modified", src_path=str(doc)))
    # the editor saves by renaming `.index.md.tmp` over `index.md`
    collector.on_any_event(SimpleNamespace(is_directory=False, event_type="moved",
                                           src_path=str(doc.with_name(".index.md.tmp")), dest_path=str(doc)))
    collector.on_any_event(SimpleNamespace(is_directory=False, event_type="deleted", src_path=str(doc)))
    assert collector.pop_settled() == []
    time.sleep(0.1)
    assert collector.pop_settled() == [doc]
    assert collector.pop_settled() == []


def _doc(root: Path, frontmatter: str, body: str = "# Hello *world*\n\nSome text.\n") -> Path:
    path = root / "notes" / "index.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"---\n{frontmatter}\n---\n\n{body}", encoding="utf-8")
    return path


def test_not_targeted(tmp_path):
    assert render_if_targeted(_doc(tmp_path, "target: web"), tmp_path) is None


def test_renders_once_until_changed_or_forced(tmp_path):
    source = _doc(tmp_path, "target: pdf")
    output = render_if_targeted(source, tmp_path)
    assert output == source.with_suffix(".pdf")
    assert output.read_bytes().startswith(b"%PDF")
    assert render_if_targeted(source, tmp_path) is None
    assert render_if_targeted(source, tmp_path, force=True) == output


def test_unknown_template(tmp_path):
    with pytest.raises(RenderError, match="unknown template"):
        render_if_targeted(_doc(tmp_path, "target: pdf\ntemplate: nope"), tmp_path)


def test_failure_is_recorded_and_keeps_going(tmp_path):
    _doc(tmp_path, "target: pdf\ntemplate: nope")
    watch.render_all(tmp_path)
    assert watch.results()["notes/index.md"]["pdf"]["ok"] is False


def test_watch_catches_up_then_renders_changes(tmp_path):
    stale = _doc(tmp_path, "target: pdf")
    stop = threading.Event()
    thread = threading.Thread(target=watch.watch, args=(tmp_path,), kwargs={"stop": stop})
    thread.start()
    try:
        deadline = time.monotonic() + 20
        while not stale.with_suffix(".pdf").exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert stale.with_suffix(".pdf").exists()
        other = tmp_path / "b" / "index.md"
        other.parent.mkdir()
        other.write_text("---\ntarget: pdf\n---\n\nHi\n", encoding="utf-8")
        while not other.with_suffix(".pdf").exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert other.with_suffix(".pdf").exists()
    finally:
        stop.set()
        thread.join()


def test_typst_renders_directly_and_keeps_previous_pdf_on_failure(tmp_path):
    source = tmp_path / "typst" / "paper" / "index.typ"
    source.parent.mkdir(parents=True)
    source.write_text("= Hello\n\nTypst.")
    output = typst_pdf.render(source, tmp_path)
    assert output == source.with_suffix(".pdf")
    before = output.read_bytes()
    assert before.startswith(b"%PDF")
    assert typst_pdf.render(source, tmp_path) is None

    source.write_text("#this-function-does-not-exist()")
    with pytest.raises(RenderError):
        typst_pdf.render(source, tmp_path, force=True)
    assert output.read_bytes() == before


def test_render_all_includes_typst_entry_points(tmp_path):
    source = tmp_path / "typst" / "paper" / "index.typ"
    source.parent.mkdir(parents=True)
    source.write_text("Direct Typst")
    watch.render_all(tmp_path)
    assert source.with_suffix(".pdf").read_bytes().startswith(b"%PDF")
    assert watch.results()["typst/paper/index.typ"]["pdf"]["ok"]
