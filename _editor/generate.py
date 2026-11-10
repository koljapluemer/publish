"""Generating viz blocks with the local claude CLI: a background job per viz
writes its spec into a workspace in the cache, seeded from the template or the
viz's current build, lets the CLI build, lint and check it there, checks it
again itself, and replaces `thea/<doc>/viz/<name>/` with the result.

Trimmed from dsl's features/thea/service.py: no versions (git is the history),
jobs kept in memory only, and the spec comes with the request."""

import json
import os
import queue
import shlex
import shutil
import subprocess
import sys
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from functools import cache
from pathlib import Path

import thea

HERE = Path(__file__).parent
ROOT = HERE.parent / "thea"
TEMPLATE = HERE / "template"
SYSTEM_PROMPT = HERE / "system-prompt.md"
CHECK = HERE / "check.py"
CACHE_DIR = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "publish-thea"
# bump when the template, prompt or pipeline changes in a way worth recording
GENERATOR = "publish-thea-1"

BUILT, THUMB, META = thea.BUILT, thea.THUMB, thea.META
# workspace entries that aren't sources
_SCRATCH = {"node_modules", "dist", "SPEC.md", "PREVIOUS_ERRORS.md", ".claude"}
MAX_SOURCE_BYTES = 20 * 1024 * 1024
SHOT_WIDTH, THUMB_WIDTH = 800, 420
# the thumbnail is cut to at most this height per width
THUMB_RATIO = 0.6
JOBS_KEPT_S = 30 * 60
OUTPUT_CHARS = 6000
NPM_INSTALL = ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"]
TOOLS = "Read,Write,Edit,Glob,Grep,Bash"
ALLOWED = "Read,Write,Edit,Glob,Grep,Bash(npm:*),Bash(npx:*)"

# set from the command line (app.py)
settings = {"cli": os.environ.get("THEA_CLI", "claude"), "model": "", "budget_usd": 2.0, "timeout_min": 20}


class Invalid(ValueError):
    """A request names no valid doc, viz or spec (400)."""


class Busy(RuntimeError):
    """The viz is already being generated (409)."""


class Unavailable(RuntimeError):
    """The CLI, npm or Chromium is missing (503)."""


class Failed(Exception):
    pass


@dataclass
class Job:
    doc: str
    name: str
    state: str = "queued"  # queued, running, done, failed
    step: str = "Waiting to start"
    error: str | None = None
    started: float = field(default_factory=time.time)
    finished: float | None = None
    cost_usd: float | None = None


_lock = threading.Lock()
# by "<doc>/<name>"; a failed job stays until the viz's next run
_jobs: dict[str, Job] = {}
_queue: queue.Queue = queue.Queue()
_worker: threading.Thread | None = None


def doc_dir(doc: str) -> Path:
    if not isinstance(doc, str) or not thea.DOC.match(doc):
        raise Invalid(f"invalid doc name '{doc}'")
    return ROOT / doc


def viz_dir(doc: str, name: str) -> Path:
    if not isinstance(name, str) or not thea.NAME.match(name):
        raise Invalid(f"invalid viz name '{name}'")
    return doc_dir(doc) / "viz" / name


@cache
def _chromium_missing() -> str | None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        return f"{e.name} isn't installed"
    try:
        with sync_playwright() as p:
            p.chromium.launch().close()
    except Exception as e:  # noqa: BLE001 - any failure to start means unavailable
        return f"Chromium doesn't start ({str(e).strip().splitlines()[0]}); run `just chromium`"
    return None


def status() -> dict:
    """Whether viz blocks can be generated here."""
    try:
        cli = shlex.split(settings["cli"])
    except ValueError:
        cli = []
    reasons = []
    if not cli or not shutil.which(cli[0]):
        reasons.append(f"the claude CLI `{settings['cli']}` isn't found")
    if not shutil.which("npm"):
        reasons.append("npm isn't found")
    if reason := _chromium_missing():
        reasons.append(reason)
    return {"available": not reasons, "reason": "; ".join(reasons) or None}


def jobs() -> list[dict]:
    """Queued and running jobs, those done in the last JOBS_KEPT_S, and each viz's last failure."""
    with _lock:
        now = time.time()
        for key in [k for k, j in _jobs.items() if j.state == "done" and now - (j.finished or now) > JOBS_KEPT_S]:
            del _jobs[key]
        return [asdict(j) for j in _jobs.values()]


def start(doc: str, name: str, spec, errors=None) -> dict:
    """Queues generating the viz `name` of `doc` from `spec`. `errors` are
    runtime errors the live viz reported, passed on to the CLI."""
    viz_dir(doc, name)
    if not (doc_dir(doc) / "index.md").is_file():
        raise Invalid(f"no doc '{doc}'")
    if not isinstance(spec, str) or not spec.strip():
        raise Invalid("the viz block has no spec")
    errors = [str(e)[:2000] for e in errors[:10]] if isinstance(errors, list) else []
    if reason := status()["reason"]:
        raise Unavailable(f"viz blocks can't be generated here: {reason}")
    key = f"{doc}/{name}"
    with _lock:
        previous = _jobs.get(key)
        if previous and previous.state in ("queued", "running"):
            raise Busy(f"{name} is already being generated")
        failure = previous.error if previous and previous.state == "failed" else None
        job = _jobs[key] = Job(doc, name)
    _queue.put((job, spec.strip(), errors, failure))
    _ensure_worker()
    return asdict(job)


def meta(doc: str, name: str) -> dict | None:
    try:
        return json.loads((viz_dir(doc, name) / META).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _ensure_worker() -> None:
    global _worker
    if _worker is None or not _worker.is_alive():
        _worker = threading.Thread(target=_work, name="thea", daemon=True)
        _worker.start()


def _work() -> None:
    while True:
        job, spec, errors, failure = _queue.get()
        with _lock:
            job.state = "running"
        try:
            _run(job, spec, errors + ([failure] if failure else []))
            job.state, job.step = "done", "Done"
        except Exception as e:  # noqa: BLE001 - any failure ends this job, not the worker
            job.state, job.step, job.error = "failed", "Failed", str(e) or type(e).__name__
        finally:
            with _lock:
                job.finished = time.time()


# --- one run ---------------------------------------------------------------------


def _run(job: Job, spec: str, problems: list[str]) -> None:
    deadline = time.monotonic() + settings["timeout_min"] * 60
    dest = viz_dir(job.doc, job.name)
    previous = dest.is_dir() and (dest / "package.json").is_file()

    job.step = "Preparing the workspace"
    ws = _workspace(f"{job.doc}/{job.name}", dest if previous else TEMPLATE)
    (ws / "SPEC.md").write_text(spec + "\n", encoding="utf-8")
    if problems:
        (ws / "PREVIOUS_ERRORS.md").write_text(
            "Problems with the previous version or attempt:\n\n" + "\n\n".join(f"- {p}" for p in problems) + "\n",
            encoding="utf-8")
    # the names the template's `check` script expects
    env = os.environ | {"DSL_PYTHON": sys.executable, "DSL_CHECK": str(CHECK.resolve())}

    job.step = "Installing packages"
    _command(NPM_INSTALL, ws, env, deadline)

    session = str(uuid.uuid4())
    prompt = ("Build the visualization SPEC.md describes" + (", starting from the previous version in the workspace" if previous else "")
              + (". PREVIOUS_ERRORS.md lists problems to fix" if problems else "") + ".")
    result = _claude(job, ["--session-id", session], prompt, ws, env, deadline)
    if failure := _gate(job, ws, env, deadline):
        result = _claude(job, ["--resume", session],
                         f"The app's own check of the workspace failed:\n\n{failure}\n\nFix it.", ws, env, deadline)
        if failure := _gate(job, ws, env, deadline):
            raise Failed(f"build, lint or check still fails:\n{failure}")

    job.step = "Saving"
    _save(ws, dest, {
        "spec": spec, "model": settings["model"] or None, "created": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "cost_usd": job.cost_usd, "turns": result.get("num_turns"), "session": session, "generator": GENERATOR,
    })


def _workspace(key: str, seed: Path) -> Path:
    """The viz's workspace, holding `seed`'s sources (and node_modules from earlier runs)."""
    ws = CACHE_DIR / key
    ws.mkdir(parents=True, exist_ok=True)
    for p in ws.iterdir():
        if p.name == "node_modules":
            continue
        shutil.rmtree(p) if p.is_dir() and not p.is_symlink() else p.unlink()
    for p in seed.iterdir():
        if p.name in _SCRATCH or p.name in (BUILT, THUMB, META):
            continue
        (shutil.copytree if p.is_dir() else shutil.copy2)(p, ws / p.name)
    return ws


def _remaining(deadline: float) -> float:
    left = deadline - time.monotonic()
    if left <= 0:
        raise Failed("the time limit was reached (--timeout-min)")
    return left


def _tail(text: str) -> str:
    return text if len(text) <= OUTPUT_CHARS else "…" + text[-OUTPUT_CHARS:]


def _command(args: list[str], cwd: Path, env: dict, deadline: float) -> tuple[bool, str]:
    """Runs `args`, failing the job when it can't start; whether it succeeded, and its output."""
    try:
        r = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=_remaining(deadline))
    except subprocess.TimeoutExpired as e:
        raise Failed(f"`{' '.join(args)}` reached the time limit") from e
    except OSError as e:
        raise Failed(f"`{args[0]}` can't run: {e}") from e
    output = (r.stdout + r.stderr).strip()
    if args == NPM_INSTALL and r.returncode:
        raise Failed(f"npm install failed:\n{_tail(output)}")
    return r.returncode == 0, output


def _gate(job: Job, ws: Path, env: dict, deadline: float) -> str | None:
    """What fails in build, lint and check, None when all pass."""
    job.step = "Checking"
    out = []
    for script in ("build", "lint", "check"):
        ok, output = _command(["npm", "run", "--silent", script], ws, env, deadline)
        if not ok:
            out.append(f"$ npm run {script}\n{output}")
            if script == "build":
                break
    built = ws / "dist" / BUILT
    if not out and "data-thea-bridge" not in built.read_text(encoding="utf-8"):
        out.append("dist/index.html lacks the bridge script: build.mjs must stay as it is")
    return _tail("\n\n".join(out)) if out else None


def _claude(job: Job, session: list[str], prompt: str, ws: Path, env: dict, deadline: float) -> dict:
    """Runs the CLI in the workspace; its result event."""
    args = [*shlex.split(settings["cli"]), "-p", "--output-format", "stream-json", "--verbose",
            "--restricted", "--strict-mcp-config", "--tools", TOOLS, "--allowedTools", ALLOWED,
            "--append-system-prompt-file", str(SYSTEM_PROMPT), *session]
    if settings["model"]:
        args += ["--model", settings["model"]]
    if settings["budget_usd"]:
        args += ["--max-budget-usd", str(settings["budget_usd"])]
    job.step = "Starting Claude"
    try:
        proc = subprocess.Popen(args, cwd=ws, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True, start_new_session=True)
    except OSError as e:
        raise Failed(f"the claude CLI can't run: {e}") from e
    timer = threading.Timer(_remaining(deadline), _kill, (proc,))
    timer.start()
    stderr: list[str] = []
    reader = threading.Thread(target=lambda: stderr.extend(proc.stderr), daemon=True)
    reader.start()
    result: dict = {}
    try:
        proc.stdin.write(prompt)
        proc.stdin.close()
        for line in proc.stdout:
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if event.get("type") == "result":
                result = event
            elif step := _step(event):
                job.step = step
        proc.wait()
    finally:
        timer.cancel()
        reader.join(timeout=5)
    if time.monotonic() >= deadline:
        raise Failed("the time limit was reached (--timeout-min)")
    if result.get("total_cost_usd") is not None:
        job.cost_usd = round((job.cost_usd or 0) + result["total_cost_usd"], 4)
    if not result or result.get("is_error") or proc.returncode:
        raise Failed(f"the claude CLI failed: {_tail(_cli_failure(result, stderr, proc.returncode))}")
    return result


def _cli_failure(result: dict, stderr: list[str], code: int | None) -> str:
    """Everything the CLI said about failing: the result's subtype (a turn or
    budget limit, say), its message and errors, stderr and the exit status."""
    subtype = result.get("subtype")
    parts = [{"error_max_budget_usd": "the cap per run was reached (--budget-usd)",
              "error_max_turns": "the turn limit was reached"}.get(subtype, subtype or "")]
    if result.get("result"):
        parts.append(str(result["result"]))
    parts += [str(e) for e in result.get("errors") or []]
    if err := "".join(stderr).strip():
        parts.append(err)
    if not result:
        parts.append("no result event")
    parts.append(f"exit status {code}")
    return "\n".join(p for p in parts if p)


def _kill(proc: subprocess.Popen) -> None:
    try:
        os.killpg(proc.pid, 9)
    except ProcessLookupError:
        pass


def _step(event: dict) -> str | None:
    """What a stream-json event says the CLI is doing, for the job's status."""
    if event.get("type") != "assistant":
        return None
    for part in reversed(event.get("message", {}).get("content") or []):
        if part.get("type") != "tool_use":
            continue
        tool, args = part.get("name", ""), part.get("input") or {}
        if tool == "Bash":
            return "$ " + str(args.get("command", ""))[:80]
        if path := args.get("file_path") or args.get("pattern"):
            return f"{tool} {Path(str(path)).name}"
        return tool
    return None


def _sources(ws: Path) -> list[Path]:
    out = []
    for p in ws.rglob("*"):
        rel = p.relative_to(ws)
        if rel.parts[0] in _SCRATCH or (len(rel.parts) == 1 and p.name.startswith("check-") and p.suffix == ".png"):
            continue
        if p.is_file() and not p.is_symlink():
            out.append(p)
    if sum(p.stat().st_size for p in out) > MAX_SOURCE_BYTES:
        raise Failed(f"the sources are larger than {MAX_SOURCE_BYTES // 1024 // 1024} MB")
    return out


def _save(ws: Path, dest: Path, meta: dict) -> None:
    """Replaces the viz folder: the sources, the built page, its thumbnail and `meta`."""
    tmp = dest.with_name(f".{dest.name}.tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    for p in _sources(ws):
        target = tmp / p.relative_to(ws)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, target)
    html = (ws / "dist" / BUILT).read_text(encoding="utf-8")
    (tmp / BUILT).write_text(html, encoding="utf-8")
    (tmp / THUMB).write_bytes(thumbnail(html))
    (tmp / META).write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    old = dest.with_name(f".{dest.name}.old")
    shutil.rmtree(old, ignore_errors=True)
    if dest.exists():
        dest.rename(old)
    tmp.rename(dest)
    shutil.rmtree(old, ignore_errors=True)


def thumbnail(html: str) -> bytes:
    """The page SHOT_WIDTH wide in the light theme, cut to THUMB_RATIO at most, as a PNG THUMB_WIDTH wide."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(viewport={"width": SHOT_WIDTH, "height": 600}, color_scheme="light",
                                    device_scale_factor=THUMB_WIDTH / SHOT_WIDTH)
            page.route("**/*", lambda route: route.abort())
            page.set_content(html, wait_until="load")
            page.wait_for_timeout(800)
            height = page.evaluate("() => Math.ceil(document.documentElement.getBoundingClientRect().height)")
            clip = {"x": 0, "y": 0, "width": SHOT_WIDTH, "height": max(1, min(height, round(SHOT_WIDTH * THUMB_RATIO)))}
            return page.screenshot(type="png", clip=clip, full_page=True)
        finally:
            browser.close()
