// Default: a clean, readable document for notes, proposals and essays.
// Frontmatter: papersize, margin, font, heading-font, fontsize, accent, lang,
// numbering (off unless set), toc.

#let template(body, meta: (:), title: none, subtitle: none, abstract: none) = {
  let accent = rgb(meta.at("accent", default: "#1f5f6b"))
  let serif = meta.at("font", default: "Libertinus Serif")
  let sans = meta.at("heading-font", default: ("Lato", "Noto Sans", "Libertinus Serif"))
  let muted = luma(105)

  set document(title: title, author: author-names(meta), keywords: meta.at("keywords", default: ()))
  set page(
    paper: meta.at("papersize", default: "a4"),
    margin: page-margin(meta, (x: 2.9cm, top: 2.6cm, bottom: 2.8cm)),
    footer: context {
      set text(font: sans, size: 8pt, fill: muted)
      if title != none and counter(page).get().first() > 1 { title }
      h(1fr)
      counter(page).display()
    },
  )
  set text(
    font: serif,
    size: to-length(meta.at("fontsize", default: 11.5)),
    lang: meta.at("lang", default: "en"),
  )
  set par(justify: true, leading: 0.72em, spacing: 1.15em)
  set heading(numbering: heading-numbering(meta, none))
  set list(indent: 0.6em)
  set enum(indent: 0.6em)

  show heading: set text(font: sans, weight: "bold")
  show heading: set block(above: 1.8em, below: 0.8em)
  show heading.where(level: 1): set text(size: 1.35em, fill: accent)
  show heading.where(level: 2): set text(size: 1.1em)
  show heading.where(level: 3): set text(size: 1em, fill: muted)

  show link: set text(fill: accent)
  show ref: set text(fill: accent)

  show raw: set text(font: "DejaVu Sans Mono", size: 0.85em)
  show raw.where(block: true): set par(justify: false)
  show raw.where(block: true): block.with(fill: luma(245), inset: 10pt, radius: 3pt, width: 100%)

  show quote.where(block: true): it => block(
    stroke: (left: 2pt + accent.lighten(55%)),
    inset: (left: 12pt, y: 4pt),
    it.body,
  )

  set table(stroke: (_, y) => if y == 0 { (bottom: 0.7pt + black) } else { (bottom: 0.3pt + luma(205)) })
  show table.cell.where(y: 0): set text(font: sans, weight: "bold", size: 0.85em)
  show figure.caption: set text(size: 0.88em, fill: muted)

  if title != none {
    block(below: 0.5em, par(justify: false, leading: 0.5em, text(font: sans, size: 21pt, weight: "bold", title)))
  }
  if subtitle != none {
    block(below: 0.5em, par(justify: false, text(font: sans, size: 13pt, fill: muted, subtitle)))
  }
  let byline = (meta.authors.map(a => a.name).join(", "), meta.at("date", default: none)).filter(x => x != none)
  if byline.len() > 0 {
    block(above: 0.9em, text(font: sans, size: 9.5pt, fill: muted, byline.join("  ·  ")))
  }
  if title != none {
    block(above: 1em, below: 2em, line(length: 3em, stroke: 2pt + accent))
  }
  if abstract != none {
    block(below: 2em, text(size: 0.95em, style: "italic", abstract))
  }

  contents(meta)
  body
}
