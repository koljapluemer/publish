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
