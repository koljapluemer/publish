"""```thea fences in the Markdown docs under `thea/`: a visualization's spec,
generated into `thea/<doc>/viz/<name>/` (see README.md). Mirrors
frontend/src/thea.ts."""

import re
from dataclasses import dataclass

INFO = "thea"
# what a viz folder holds besides the sources
BUILT, THUMB, META = "index.html", "thumb.png", "meta.json"
# the built page has no network, wherever it's opened
CSP = ("default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
       "img-src data: blob:; font-src data:; media-src data: blob:; worker-src blob:")

FENCE = re.compile(r"^[ \t]{0,3}(`{3,}|~{3,})")
_HEADER = re.compile(r"^[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*thea(?:[ \t]+(\S+))?[ \t]*$")
NAME = re.compile(r"^[a-z]+-[a-z]+$")
DOC = re.compile(r"^[a-z0-9][a-z0-9_-]*$")


@dataclass(frozen=True)
class Block:
    # its place among the doc's thea blocks
    index: int
    # the 0-based lines of its opening and closing fence
    line: int
    end: int
    # `<adjective>-<noun>`; None while the header names none (or not a valid one)
    name: str | None
    spec: str


def fence_end(lines: list[str], i: int) -> int | None:
    """The index of the line closing the fence lines[i] opens; None when it
    opens none or the fence isn't closed."""
    m = FENCE.match(lines[i])
    if not m:
        return None
    char, length = m[1][0], len(m[1])
    closing = re.compile(rf"^[ \t]{{0,3}}{re.escape(char)}{{{length},}}[ \t]*$")
    return next((j for j in range(i + 1, len(lines)) if closing.match(lines[j])), None)


def blocks(text: str) -> list[Block]:
    """Every closed thea fence in `text`, in order. Fences inside other fences don't count."""
    lines = [l.replace("\r", "") for l in text.split("\n")]
    out: list[Block] = []
    i = 0
    while i < len(lines):
        end = fence_end(lines, i)
        if end is None:
            i += 1
            continue
        if m := _HEADER.match(lines[i]):
            name = m[1] if m[1] and NAME.match(m[1]) else None
            out.append(Block(len(out), i, end, name, "\n".join(lines[i + 1 : end]).strip()))
        i = end + 1
    return out
