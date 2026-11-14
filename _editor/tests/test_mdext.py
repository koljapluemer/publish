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


def test_video_and_audio_use_image_syntax_on_web_only():
    web = mdext.extend('![Demo|500](demo.mp4 "Title") ![Voice](voice.mp3) ![Photo](photo.jpg)', "web")
    assert '<video src="demo.mp4" controls aria-label="Demo" title="Title"' in web
    assert 'style="max-width: min(500px, 100%)"' in web
    assert '<audio src="voice.mp3" controls aria-label="Voice"></audio>' in web
    assert '![Photo](photo.jpg)' in web
    assert mdext.extend('![Demo](demo.mp4)', "pdf") == '![Demo](demo.mp4)'


def test_gif_video_attribute():
    out = mdext.extend('![Demo|320](demo.mp4){.gif}', "web")
    assert out == ('<span class="gif" role="button" tabindex="0" aria-label="Demo" style="max-width: min(320px, 100%)">'
                   '<video src="demo.mp4" loop muted playsinline></video></span>')


def test_pdf_keeps_content():
    out = pypandoc.convert_text(mdext.extend("??? Label\ninner\n!!!", "pdf"), "typst", format="markdown")
    assert "#strong[Label]" in out and "inner" in out and "details" not in out
