"""The repo's Markdown extensions, rewritten to plain pandoc Markdown before
rendering (web.py, pdf.py); frontend/src/dumb/markdown.ts does the same for the
editor's preview.

- A line `???` (optionally `??? label`) opens a collapsed section, a line `!!!`
  closes it: `<details>` on the web, plain content in a PDF (the label, if any,
  as a bold line). Sections nest; one left open closes at the end.
- `![alt|500](src)` shows the image at most 500 px wide.

Lines inside fenced code are left alone.
"""

import html
import re

from thea import fence_end

OPEN = re.compile(r"^[ \t]{0,3}\?\?\?(?:[ \t]+(.*?))?[ \t]*$")
CLOSE = re.compile(r"^[ \t]{0,3}!!![ \t]*$")
IMAGE_WIDTH = re.compile(r"!\[([^\]\n]*?)[ \t]*\|[ \t]*(\d+)[ \t]*\]\(([^)\n]*)\)")


def _image(line: str, pdf: bool) -> str:
    def sub(m: re.Match) -> str:
        attr = f"width={m[2]}px" if pdf else f'style="max-width: min({m[2]}px, 100%)"'
        return f"![{m[1]}]({m[3]}){{{attr}}}"
    return IMAGE_WIDTH.sub(sub, line)


def _open(label: str | None, pdf: bool) -> list[str]:
    if pdf:
        return ["", f"**{label}**", ""] if label else [""]
    summary = html.escape(label) if label else "Details"
    return ["", f"<details><summary>{summary}</summary>", ""]


def _close(pdf: bool) -> list[str]:
    return [""] if pdf else ["", "</details>", ""]


def extend(text: str, target: str) -> str:
    """`text` with the extensions in plain pandoc Markdown for `target`, "web" or "pdf"."""
    pdf = target == "pdf"
    lines = text.split("\n")
    out: list[str] = []
    depth = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        end = fence_end(lines, i)
        if end is not None:
            out.extend(lines[i : end + 1])
            i = end + 1
            continue
        if m := OPEN.match(line):
            out.extend(_open(m[1], pdf))
            depth += 1
        elif depth and CLOSE.match(line):
            out.extend(_close(pdf))
            depth -= 1
        else:
            out.append(_image(line, pdf))
        i += 1
    for _ in range(depth):
        out.extend(_close(pdf))
    return "\n".join(out)
