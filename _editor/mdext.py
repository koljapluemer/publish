"""The repo's Markdown extensions, rewritten to plain pandoc Markdown before
rendering (web.py, pdf.py); frontend/src/dumb/markdown.ts does the same for the
editor's preview.

- A line `???` (optionally `??? label`) opens a collapsed section, a line `!!!`
  closes it: `<details>` on the web, plain content in a PDF (the label, if any,
  as a bold line). Sections nest; one left open closes at the end.
- `![alt|500](src)` shows the image at most 500 px wide.
- On the web, image syntax targeting video or audio is rendered as the
  corresponding HTML5 media element. The standard MIME registry classifies it.
- A video followed by `{.gif}` autoplays muted and loops; click toggles playback.

Lines inside fenced code are left alone.
"""

import html
import mimetypes
import re
from urllib.parse import urlsplit

from thea import fence_end

OPEN = re.compile(r"^[ \t]{0,3}\?\?\?(?:[ \t]+(.*?))?[ \t]*$")
CLOSE = re.compile(r"^[ \t]{0,3}!!![ \t]*$")
IMAGE_WIDTH = re.compile(r"!\[([^\]\n]*?)[ \t]*\|[ \t]*(\d+)[ \t]*\]\(([^)\n]*)\)")
MEDIA = re.compile(
    r"!\[([^\]\n]*)\]\((?:<([^>\n]+)>|([^\s)\n]+))"
    r"(?:[ \t]+(?:\"([^\"\n]*)\"|'([^'\n]*)'|\(([^)\n]*)\)))?\)"
    r"(?:(\{[ \t]*\.gif[ \t]*\}))?"
)


def _media(line: str) -> str:
    def sub(m: re.Match) -> str:
        alt, src = m[1], m[2] or m[3]
        mime = mimetypes.guess_type(urlsplit(src).path)[0] or ""
        kind = mime.partition("/")[0]
        if kind not in ("video", "audio"):
            return m[0]
        sized = re.match(r"^(.*?)[ \t]*\|[ \t]*(\d+)[ \t]*$", alt)
        if sized:
            alt, width = sized[1], sized[2]
        else:
            width = None
        gif = kind == "video" and bool(m[7])
        attrs = [f'src="{html.escape(src, quote=True)}"']
        if gif:
            attrs.extend(("autoplay", "loop", "muted", "playsinline", 'class="gif"',
                          'role="button"', 'tabindex="0"'))
        else:
            attrs.append("controls")
        if alt:
            attrs.append(f'aria-label="{html.escape(alt, quote=True)}"')
        title = m[4] or m[5] or m[6]
        if title:
            attrs.append(f'title="{html.escape(title, quote=True)}"')
        if width:
            attrs.append(f'style="max-width: min({width}px, 100%)"')
        return f"<{kind} {' '.join(attrs)}></{kind}>"
    return MEDIA.sub(sub, line)


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
            out.append(_image(_media(line) if not pdf else line, pdf))
        i += 1
    for _ in range(depth):
        out.extend(_close(pdf))
    return "\n".join(out)
