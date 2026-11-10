"""Watching the repo in the background: every `.md` whose frontmatter `target`
has `pdf` is rendered to a PDF next to it (pdf.py) when it changes, and on
startup when it's out of date. The editor starts this (app.py); `python pdf.py`
runs it alone."""

import logging
import threading
import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from pdf import RenderError, render_if_targeted

log = logging.getLogger("pdf")

REPO = Path(__file__).resolve().parent.parent
LOG_FORMAT = "%(asctime)s %(levelname)s %(message)s"
DEBOUNCE_SECONDS = 0.3
# besides hidden folders; `viz/` holds the generated sources of thea vizzes
IGNORED_DIRS = {"node_modules", "viz"}

# the last render of each file, by path relative to the root: ok, error, time
_results: dict[str, dict] = {}
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


def _record(name: str, error: str | None) -> None:
    with _results_lock:
        _results[name] = {"ok": error is None, "error": error, "time": time.time()}


def results() -> dict[str, dict]:
    """The last render of each file since startup, by path relative to the root."""
    with _results_lock:
        return {k: dict(v) for k, v in sorted(_results.items())}


def render(path: Path, root: Path, force: bool = False) -> None:
    """Render one file. Failures are logged so that the watcher keeps running;
    the previous PDF stays in place."""
    name = path.relative_to(root).as_posix()
    try:
        output = render_if_targeted(path, root, force=force)
    except FileNotFoundError:
        return  # deleted between the event and the render
    except RenderError as e:
        log.error("%s: %s", name, e)
        _record(name, str(e))
    except Exception as e:
        log.exception("%s: unexpected error", name)
        _record(name, f"unexpected error: {e}")
    else:
        if output:
            log.info("rendered %s", output.relative_to(root))
            _record(name, None)


def render_all(root: Path, force: bool = False) -> None:
    for path in sorted(root.rglob("*.md")):
        if is_watched(path, root):
            render(path, root, force=force)


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
    thread = threading.Thread(target=watch, args=(root, force), name="pdf", daemon=True)
    thread.start()
    return thread
