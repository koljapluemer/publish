"""Watching the repo in the background: every `.md` whose frontmatter `target`
has `pdf` is rendered to a PDF next to it (pdf.py), and one with `web` to an
HTML page in the site folder `_site/` (web.py), when it changes, and on startup
when it's out of date. The editor starts this (app.py); `python watch.py` runs it alone."""

import argparse
import logging
import threading
import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

import pdf
import web
from pdf import RenderError

log = logging.getLogger("render")
# what a doc can be rendered to, by its frontmatter `target`
RENDERERS = {"pdf": pdf.render_if_targeted, "web": web.render_if_targeted}

REPO = Path(__file__).resolve().parent.parent
LOG_FORMAT = "%(asctime)s %(levelname)s %(message)s"
DEBOUNCE_SECONDS = 0.3
# besides hidden folders; `viz/` holds the generated sources of thea vizzes, `_site/` the web pages
IGNORED_DIRS = {"node_modules", "viz", web.SITE}

# the last render of each file, by path relative to the root, then by kind: ok, error, time
_results: dict[str, dict[str, dict]] = {}
_results_lock = threading.Lock()


def is_watched(path: Path, root: Path) -> bool:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return False
    return path.suffix == ".md" and not any(p.startswith(".") or p in IGNORED_DIRS for p in parts)


class ChangeCollector(FileSystemEventHandler):
    """Collects changed files; a burst of saves on one file yields one render."""

    def __init__(self, root: Path):
        self.root = root
        self._last_change: dict[Path, float] = {}
        self._lock = threading.Lock()

    def on_any_event(self, event):
        if event.is_directory or event.event_type not in ("created", "modified", "moved"):
            return
        # Many editors (this one too) save by writing a temp file and renaming it over the original.
        raw = event.dest_path if event.event_type == "moved" else event.src_path
        path = Path(raw)
        if is_watched(path, self.root):
            with self._lock:
                self._last_change[path] = time.monotonic()

    def pop_settled(self) -> list[Path]:
        cutoff = time.monotonic() - DEBOUNCE_SECONDS
        with self._lock:
            settled = [p for p, t in self._last_change.items() if t <= cutoff]
            for path in settled:
                del self._last_change[path]
        return settled


def _record(name: str, kind: str, error: str | None) -> None:
    with _results_lock:
        _results.setdefault(name, {})[kind] = {"ok": error is None, "error": error, "time": time.time()}


def results() -> dict[str, dict[str, dict]]:
    """The last render of each file since startup, by path relative to the root, then by kind (pdf, web)."""
    with _results_lock:
        return {k: {kind: dict(r) for kind, r in v.items()} for k, v in sorted(_results.items())}


def render(path: Path, root: Path = REPO, force: bool = False, kinds=tuple(RENDERERS)) -> None:
    """Render one file to each of `kinds` it targets. Failures are logged so
    that the watcher keeps running; the previous output stays in place."""
    name = path.relative_to(root).as_posix() if path.is_relative_to(root) else path.as_posix()
    for kind in kinds:
        try:
            output = RENDERERS[kind](path, root, force=force)
        except FileNotFoundError:
            return  # deleted between the event and the render
        except RenderError as e:
            log.error("%s (%s): %s", name, kind, e)
            _record(name, kind, str(e))
        except Exception as e:
            log.exception("%s (%s): unexpected error", name, kind)
            _record(name, kind, f"unexpected error: {e}")
        else:
            if output:
                log.info("rendered %s", output.relative_to(root) if output.is_relative_to(root) else output)
                _record(name, kind, None)


def render_all(root: Path, force: bool = False, kinds=tuple(RENDERERS)) -> None:
    for path in sorted(root.rglob("*.md")):
        if is_watched(path, root):
            render(path, root, force=force, kinds=kinds)


def watch(root: Path, force: bool = False, stop: threading.Event | None = None) -> None:
    """Render what is out of date (everything with `force`), then files as they
    change, until `stop` is set (or forever)."""
    stop = stop or threading.Event()
    collector = ChangeCollector(root)
    observer = Observer()
    observer.schedule(collector, str(root), recursive=True)
    observer.start()
    try:
        # after starting the observer, so that edits made while catching up aren't missed
        render_all(root, force=force)
        log.info("watching %s", root)
        while not stop.wait(0.1):
            for path in collector.pop_settled():
                render(path, root)
    finally:
        observer.stop()
        observer.join()


def start(root: Path = REPO, force: bool = False) -> threading.Thread:
    """`watch` in a daemon thread."""
    thread = threading.Thread(target=watch, args=(root, force), name="render", daemon=True)
    thread.start()
    return thread


def main() -> None:
    parser = argparse.ArgumentParser(description="Render every Markdown file with `target: pdf` or `web`, then watch.")
    parser.add_argument("root", nargs="?", type=Path, default=REPO, help="folder to watch (default: the repo)")
    parser.add_argument("--once", action="store_true", help="render what is out of date, then exit")
    parser.add_argument("--force", action="store_true", help="on startup, re-render even up-to-date outputs")
    parser.add_argument("--only", choices=sorted(RENDERERS), help="render only PDFs or only web pages (with --once)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, datefmt="%H:%M:%S")

    root = args.root.resolve()
    if args.once:
        render_all(root, force=args.force, kinds=(args.only,) if args.only else tuple(RENDERERS))
        return
    try:
        watch(root, force=args.force)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
