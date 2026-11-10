"""The editor: the docs under `thea/`, their viz blocks, and the frontend."""

import argparse
import os
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_file, send_from_directory

import generate
from generate import ROOT, Busy, Invalid, Unavailable, doc_dir, doc_file, doc_files, viz_dir
from thea import BUILT, CSP, MAX_FILE_BYTES, THUMB

HERE = Path(__file__).parent
DIST = Path(os.environ.get("EDITOR_FRONTEND_DIST", HERE / "frontend" / "dist"))
PORT = 8767
# the built page runs in an opaque origin with no network, wherever it's opened
VIEW_CSP = "sandbox allow-scripts; " + CSP
NEW_DOC = "# {title}\n\nSome prose.\n\n```thea\nDescribe the visualization.\n```\n"

# a doc's file opened directly (an SVG, say) runs no script
FILE_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4 * MAX_FILE_BYTES


@app.errorhandler(Invalid)
def _invalid(e): return jsonify(error=str(e)), 400


@app.errorhandler(Busy)
def _busy(e): return jsonify(error=str(e)), 409


@app.errorhandler(Unavailable)
def _unavailable(e): return jsonify(error=str(e)), 503


def _index(doc: str) -> Path:
    path = doc_dir(doc) / "index.md"
    if not path.is_file():
        abort(404, f"no doc '{doc}'")
    return path


@app.get("/api/docs")
def docs():
    names = sorted(p.parent.name for p in ROOT.glob("*/index.md")) if ROOT.is_dir() else []
    return jsonify(names)


@app.post("/api/docs")
def create_doc():
    name = str((request.get_json(silent=True) or {}).get("name", "")).strip()
    folder = doc_dir(name)
    if folder.exists():
        raise Invalid(f"'{name}' exists already")
    folder.mkdir(parents=True)
    (folder / "index.md").write_text(NEW_DOC.format(title=name), encoding="utf-8")
    return jsonify(name), 201


@app.get("/api/docs/<doc>")
def read_doc(doc):
    return jsonify(text=_index(doc).read_text(encoding="utf-8"))


@app.put("/api/docs/<doc>")
def write_doc(doc):
    path = _index(doc)
    text = (request.get_json(silent=True) or {}).get("text")
    if not isinstance(text, str):
        raise Invalid("text must be a string")
    tmp = path.with_name(".index.md.tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)
    return jsonify(text=text)


def _file_list(doc: str) -> list[dict]:
    return [{"name": p.name, "size": p.stat().st_size} for p in doc_files(doc)]


@app.get("/api/docs/<doc>/files")
def list_files(doc):
    _index(doc)
    return jsonify(_file_list(doc))


@app.post("/api/docs/<doc>/files")
def upload_files(doc):
    _index(doc)
    uploads = request.files.getlist("file")
    if not uploads:
        raise Invalid("no file sent")
    checked = []
    for upload in uploads:
        path = doc_file(doc, upload.filename or "")
        data = upload.read()
        if len(data) > MAX_FILE_BYTES:
            raise Invalid(f"{path.name} is larger than {MAX_FILE_BYTES // 1024 // 1024} MB")
        checked.append((path, data))
    for path, data in checked:
        tmp = path.with_name(f".{path.name}.tmp")
        tmp.write_bytes(data)
        tmp.replace(path)
    return jsonify(_file_list(doc)), 201


def _existing_file(doc: str, name: str) -> Path:
    _index(doc)
    path = doc_file(doc, name)
    if not path.is_file() or path.is_symlink():
        abort(404)
    return path


@app.get("/api/docs/<doc>/files/<name>")
def read_file(doc, name):
    response = send_file(_existing_file(doc, name), conditional=True, max_age=0)
    response.headers["Content-Security-Policy"] = FILE_CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.delete("/api/docs/<doc>/files/<name>")
def delete_file(doc, name):
    _existing_file(doc, name).unlink()
    return jsonify(_file_list(doc))


@app.get("/api/status")
def status(): return jsonify(generate.status())


@app.get("/api/jobs")
def jobs(): return jsonify(generate.jobs())


@app.post("/api/generate")
def start():
    body = request.get_json(silent=True) or {}
    return jsonify(generate.start(body.get("doc"), body.get("name"), body.get("spec"), body.get("errors"))), 202


@app.get("/api/viz/<doc>/<name>/meta")
def meta(doc, name):
    viz_dir(doc, name)
    return jsonify(generate.meta(doc, name))


@app.get("/api/viz/<doc>/<name>/view")
def view(doc, name):
    path = viz_dir(doc, name) / BUILT
    if not path.is_file():
        abort(404)
    response = send_file(path, mimetype="text/html", conditional=True, max_age=0)
    response.headers["Content-Security-Policy"] = VIEW_CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/viz/<doc>/<name>/thumb")
def thumb(doc, name):
    path = viz_dir(doc, name) / THUMB
    if not path.is_file():
        abort(404)
    return send_file(path, mimetype="image/png", conditional=True, max_age=0)


@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def frontend(path):
    if path.startswith("api/"):
        abort(404)
    if path and (DIST / path).is_file():
        return send_from_directory(DIST, path)
    if not (DIST / "index.html").is_file():
        return "The frontend isn't built: run `just editor-build`.", 503
    return send_from_directory(DIST, "index.html")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--model", default="", help="claude model for generating (default: the CLI's)")
    parser.add_argument("--budget-usd", type=float, default=2.0,
                        help="cap per run in the CLI's estimated USD at API prices; 0 for none")
    parser.add_argument("--timeout-min", type=int, default=20, help="time limit per run")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()
    generate.settings.update(model=args.model, budget_usd=args.budget_usd or None, timeout_min=args.timeout_min)
    # localhost only: generating runs code as you
    app.run(host="127.0.0.1", port=args.port, debug=args.debug, threaded=True)


if __name__ == "__main__":
    main()
