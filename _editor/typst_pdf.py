"""Compile ``typst/<doc>/index.typ`` directly to a sibling PDF."""

import os
from functools import cache
from pathlib import Path

import typst

from pdf import RenderError


@cache
def _fonts() -> typst.Fonts:
    return typst.Fonts()


def pdf_path(source: Path) -> Path:
    return source.with_suffix(".pdf")


def is_stale(source: Path) -> bool:
    output = pdf_path(source)
    return not output.exists() or source.stat().st_mtime > output.stat().st_mtime


def render(source: Path, root: Path, force: bool = False) -> Path | None:
    """Compile one Typst entry point, preserving the previous PDF on failure."""
    if not force and not is_stale(source):
        return None
    try:
        contents = typst.compile(str(source), root=root, font_paths=_fonts())
    except typst.TypstError as e:
        raise RenderError(e.diagnostic or e.message) from e

    output = pdf_path(source)
    tmp = output.with_name(f".{output.name}.tmp")
    tmp.write_bytes(contents)
    os.replace(tmp, output)
    return output
