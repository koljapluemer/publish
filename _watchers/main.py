"""Watch a folder and render Markdown files with `target: pdf` frontmatter to PDF."""

import argparse
import logging
import threading
import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from render import RenderError, render_if_targeted

log = logging.getLogger("pdf-watcher")

DEBOUNCE_SECONDS = 0.3
IGNORED_DIRS = {"node_modules"}


def is_watched(path: Path, root: Path) -> bool:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return False
    return path.suffix == ".md" and not any(
        p.startswith(".") or p in IGNORED_DIRS for p in parts
    )


class ChangeCollector(FileSystemEventHandler):
    """Collects changed files; a burst of saves on one file yields one render."""

    def __init__(self, root: Path):
        self.root = root
        self._last_change: dict[Path, float] = {}
        self._lock = threading.Lock()

    def on_any_event(self, event):
        if event.is_directory or event.event_type not in ("created", "modified", "moved"):
            return
        # Many editors save by writing a temp file and renaming it over the original.
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


def render(path: Path, root: Path, force: bool = False) -> None:
    """Render one file. Failures are logged so that the watcher keeps running."""
    name = path.relative_to(root)
    try:
        output = render_if_targeted(path, root, force=force)
    except FileNotFoundError:
        return  # deleted between the event and the render
    except RenderError as e:
        log.error("%s: %s", name, e)
    except Exception:
        log.exception("%s: unexpected error", name)
    else:
        if output:
            log.info("rendered %s", output.relative_to(root))


def render_all(root: Path, force: bool) -> None:
    for path in sorted(root.rglob("*.md")):
        if is_watched(path, root):
            render(path, root, force=force)


def watch(root: Path) -> None:
    collector = ChangeCollector(root)
    observer = Observer()
    observer.schedule(collector, str(root), recursive=True)
    observer.start()
    log.info("watching %s", root)
    try:
        while True:
            time.sleep(0.1)
            for path in collector.pop_settled():
                render(path, root)
    except KeyboardInterrupt:
        pass
    finally:
        observer.stop()
        observer.join()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "root",
        nargs="?",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="folder to watch (default: the parent of _watchers)",
    )
    parser.add_argument("--once", action="store_true", help="render what is out of date, then exit")
    parser.add_argument(
        "--force", action="store_true", help="on startup, re-render even up-to-date PDFs"
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")

    root = args.root.resolve()
    # Start watching only after catching up on edits made while not running.
    render_all(root, force=args.force)
    if not args.once:
        watch(root)


if __name__ == "__main__":
    main()
