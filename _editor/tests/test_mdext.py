import pypandoc

import mdext


def _html(text: str) -> str:
    return pypandoc.convert_text(mdext.extend(text, "web"), "html5", format="markdown").replace("\n", "")


def test_details_nest_and_skip_fences():
    text = "???\n# A\ntext\n??? More <b>\ninner\n!!!\n!!!\n???\n```\n!!!\n```"
    assert _html(text) == (
        '<details><summary>Details</summary><h1 id="a">A</h1><p>text</p>'
        "<details><summary>More &lt;b&gt;</summary><p>inner</p></details></details>"
        "<details><summary>Details</summary><pre><code>!!!</code></pre></details>"
    )


def test_stray_close_is_text():
    assert mdext.extend("a\n!!!", "web") == "a\n!!!"


def test_image_width():
    assert mdext.extend("![orig|500](a.jpg) ![b](b.jpg)", "web") == (
        '![orig](a.jpg){style="max-width: min(500px, 100%)"} ![b](b.jpg)'
    )
    assert mdext.extend("![a photo | 20](a.jpg)", "pdf") == "![a photo](a.jpg){width=20px}"
    assert 'style="max-width: min(500px, 100%)"' in _html("![orig|500](a.jpg)")


def test_pdf_keeps_content():
    out = pypandoc.convert_text(mdext.extend("??? Label\ninner\n!!!", "pdf"), "typst", format="markdown")
    assert "#strong[Label]" in out and "inner" in out and "details" not in out
