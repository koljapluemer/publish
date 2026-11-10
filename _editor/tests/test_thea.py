import pytest

import app as editor
import generate
from thea import blocks


def test_named_and_unnamed():
    text = "# T\n\n```thea brisk-river\nA bar chart.\nTwo lines.\n```\n\n~~~thea\nOther\n~~~\n"
    a, b = blocks(text)
    assert (a.index, a.line, a.end, a.name, a.spec) == (0, 2, 5, "brisk-river", "A bar chart.\nTwo lines.")
    assert (b.index, b.name, b.spec) == (1, None, "Other")


def test_invalid_name_is_none():
    assert blocks("```thea Bad_Name\nx\n```")[0].name is None


def test_unclosed_and_other_fences():
    assert blocks("```thea a-b\nnever closed") == []
    assert blocks("```python\nx\n```") == []


def test_fence_inside_longer_fence_is_not_a_block():
    text = "````md\n```thea a-b\nx\n```\n````\n```thea c-d\ny\n```"
    assert [b.name for b in blocks(text)] == ["c-d"]


def test_crlf():
    assert blocks("```thea a-b\r\nspec\r\n```\r\n")[0].spec == "spec"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(generate, "ROOT", tmp_path)
    monkeypatch.setattr(editor, "ROOT", tmp_path)
    (tmp_path / "doc").mkdir()
    (tmp_path / "doc" / "index.md").write_text("hi")
    return editor.app.test_client()


def test_docs_roundtrip(client, tmp_path):
    assert client.get("/api/docs").json == ["doc"]
    assert client.put("/api/docs/doc", json={"text": "new"}).status_code == 200
    assert (tmp_path / "doc" / "index.md").read_text() == "new"
    assert client.post("/api/docs", json={"name": "other"}).status_code == 201
    assert client.get("/api/docs").json == ["doc", "other"]


def test_typst_docs_roundtrip_and_pdf(client, tmp_path, monkeypatch):
    root = tmp_path / "typst"
    monkeypatch.setattr(editor, "TYPST_ROOT", root)
    source = root / "paper" / "index.typ"
    source.parent.mkdir(parents=True)
    source.write_text("= Original")
    assert client.get("/api/typst").json == ["paper"]
    opened = client.get("/api/typst/paper").json
    assert opened["text"] == "= Original" and opened["pdf_mtime"] is None
    changed = client.put("/api/typst/paper", json={"text": "= Changed"})
    assert changed.status_code == 200 and changed.json["render"]["ok"]
    assert changed.json["pdf_mtime"] is not None
    assert source.read_text() == "= Changed"
    status = client.get("/api/typst/paper/status").json
    assert status["render"]["ok"] and status["pdf_mtime"] == changed.json["pdf_mtime"]
    previous_pdf = source.with_suffix(".pdf").read_bytes()
    broken = client.put("/api/typst/paper", json={"text": "#not-a-real-function()"}).json
    assert not broken["render"]["ok"] and broken["render"]["error"]
    assert broken["pdf_mtime"] == changed.json["pdf_mtime"]
    assert source.with_suffix(".pdf").read_bytes() == previous_pdf
    source.with_suffix(".pdf").write_bytes(b"%PDF-test")
    response = client.get("/api/typst/paper/pdf")
    assert response.status_code == 200 and response.mimetype == "application/pdf"
    assert response.data == b"%PDF-test"


@pytest.mark.parametrize("url", ["/api/typst/..", "/api/typst/A", "/api/typst/nope/pdf"])
def test_bad_typst_paths(client, tmp_path, monkeypatch, url):
    monkeypatch.setattr(editor, "TYPST_ROOT", tmp_path / "typst")
    assert client.get(url).status_code in (400, 404)


@pytest.mark.parametrize("url", ["/api/docs/..", "/api/docs/A", "/api/viz/doc/..%2F..%2Fx/view",
                                 "/api/viz/doc/Bad/meta", "/api/viz/..%2Fdoc/a-b/meta"])
def test_bad_paths(client, url):
    assert client.get(url).status_code in (400, 404)


def test_bad_create(client):
    assert client.post("/api/docs", json={"name": "../x"}).status_code == 400
    assert client.post("/api/docs", json={"name": "doc"}).status_code == 400


def test_generate_validates(client):
    assert client.post("/api/generate", json={"doc": "doc", "name": "Bad", "spec": "x"}).status_code == 400
    assert client.post("/api/generate", json={"doc": "doc", "name": "a-b", "spec": " "}).status_code == 400
    assert client.post("/api/generate", json={"doc": "nope", "name": "a-b", "spec": "x"}).status_code == 400


def test_view_csp(client, tmp_path):
    viz = tmp_path / "doc" / "viz" / "a-b"
    viz.mkdir(parents=True)
    (viz / "index.html").write_text("<p>x</p>")
    r = client.get("/api/viz/doc/a-b/view")
    assert r.status_code == 200
    assert r.headers["Content-Security-Policy"].startswith("sandbox allow-scripts; default-src 'none'")


# --- the doc's files -------------------------------------------------------------


def _upload(client, *files):
    from io import BytesIO
    return client.post("/api/docs/doc/files", data={"file": [(BytesIO(d), n) for n, d in files]},
                       content_type="multipart/form-data")


def test_files_roundtrip(client, tmp_path):
    assert client.get("/api/docs/doc/files").json == []
    r = _upload(client, ("rain.csv", b"month,mm\n1,40\n"), ("photo.png", b"\x89PNG"))
    assert r.status_code == 201
    assert [(f["name"], f["size"]) for f in r.json] == [("photo.png", 4), ("rain.csv", 14)]
    assert all(isinstance(f["mtime"], int) for f in r.json)
    assert (tmp_path / "doc" / "rain.csv").read_bytes() == b"month,mm\n1,40\n"
    got = client.get("/api/docs/doc/files/rain.csv")
    assert got.data == b"month,mm\n1,40\n"
    assert got.headers["Content-Security-Policy"].startswith("sandbox;")
    assert got.headers["X-Content-Type-Options"] == "nosniff"
    _upload(client, ("rain.csv", b"x"))
    assert (tmp_path / "doc" / "rain.csv").read_bytes() == b"x"
    assert [f["name"] for f in client.delete("/api/docs/doc/files/rain.csv").json] == ["photo.png"]
    assert client.get("/api/docs/doc/files/rain.csv").status_code == 404


def test_files_list_skips_doc_viz_and_others(client, tmp_path):
    (tmp_path / "doc" / "viz" / "a-b").mkdir(parents=True)
    for name in (".hidden.csv", "notes.exe", ".index.md.tmp"):
        (tmp_path / "doc" / name).write_text("x")
    assert client.get("/api/docs/doc/files").json == []


@pytest.mark.parametrize("name", ["../x.csv", ".hidden.csv", "a.exe", "index.md", "noext", "a b.csv"])
def test_bad_file_names(client, name):
    assert _upload(client, (name, b"x")).status_code == 400


def test_bad_file_paths(client):
    assert client.get("/api/docs/doc/files/index.md").status_code == 400
    assert client.get("/api/docs/doc/files/..%2Findex.md").status_code in (400, 404)
    assert client.delete("/api/docs/nope/files/a.csv").status_code == 404


def test_file_too_large(client, tmp_path):
    from thea import MAX_FILE_BYTES
    assert _upload(client, ("big.csv", b"x" * (MAX_FILE_BYTES + 1))).status_code == 400
    assert not (tmp_path / "doc" / "big.csv").exists()


def test_files_in_workspace_not_in_viz(tmp_path, monkeypatch):
    monkeypatch.setattr(generate, "ROOT", tmp_path / "thea")
    monkeypatch.setattr(generate, "CACHE_DIR", tmp_path / "cache")
    doc = tmp_path / "thea" / "doc"
    doc.mkdir(parents=True)
    (doc / "index.md").write_text("hi")
    (doc / "rain.csv").write_text("month,mm\n" + "".join(f"{m},{m * 10}\n" for m in range(1, 13)))
    (doc / "shape.json").write_text('{"a": 1, "b": [1, 2]}')

    ws = generate._workspace("doc/a-b", generate.TEMPLATE)
    copies = generate._copy_files(generate.doc_files("doc"), ws)
    assert sorted(p.name for p in copies) == ["rain.csv", "shape.json"]
    md = (ws / "FILES.md").read_text()
    assert "## rain.csv" in md and "13 lines" in md and "1,10" in md and "12,120" not in md
    assert "An object with 2 keys: a, b" in md
    # cleared on the next run, and never saved as a source
    (ws / "dist").mkdir()
    assert not any(p.relative_to(ws).parts[0] in ("files", "FILES.md") for p in generate._sources(ws))
    generate._workspace("doc/a-b", generate.TEMPLATE)
    assert not (ws / "files").exists() and not (ws / "FILES.md").exists()
