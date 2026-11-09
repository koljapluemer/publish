// Scientific: article layout with numbered sections, abstract and equations.
// Frontmatter: abstract, keywords, authors (name/affiliation/email), date,
// columns, papersize, margin, font, fontsize, lang, numbering, toc,
// bibliography, csl.

#let template(body, meta: (:), title: none, subtitle: none, abstract: none) = {
  let columns = meta.at("columns", default: 1)

  set document(title: title, author: author-names(meta), keywords: meta.at("keywords", default: ()))
  set page(
    paper: meta.at("papersize", default: "a4"),
    margin: page-margin(meta, if columns > 1 { (x: 1.8cm, y: 2.2cm) } else { (x: 3cm, y: 2.8cm) }),
    columns: columns,
    numbering: "1",
    number-align: center,
  )
  set text(
    font: meta.at("font", default: "New Computer Modern"),
    size: to-length(meta.at("fontsize", default: if columns > 1 { 10 } else { 11 })),
    lang: meta.at("lang", default: "en"),
  )
  set par(justify: true, leading: 0.62em, spacing: 0.62em, first-line-indent: 1.3em)
  set heading(numbering: heading-numbering(meta, "1.1"))
  set math.equation(numbering: "(1)")
  set list(indent: 0.8em)
  set enum(indent: 0.8em)

  show heading: set text(size: 1em, weight: "bold")
  show heading.where(level: 1): set text(size: 1.15em)
  show heading: set block(above: 1.5em, below: 0.8em)

  show raw: set text(font: "DejaVu Sans Mono", size: 0.8em)
  show raw.where(block: true): set par(justify: false)
  show raw.where(block: true): block.with(stroke: (y: 0.4pt + luma(150)), inset: (y: 7pt), width: 100%)

  show quote.where(block: true): pad.with(x: 1.5em)
  show bibliography: set text(size: 0.9em)
  show bibliography: set par(first-line-indent: 0em, spacing: 0.7em)

  set table(stroke: (_, y) => if y == 0 { (top: 0.8pt, bottom: 0.5pt) } else { none })
  show table.cell.where(y: 0): set text(weight: "bold")
  show figure: set block(above: 1.4em, below: 1.4em)
  show figure.where(kind: table): set figure.caption(position: top)
  show figure.caption: set text(size: 0.9em)
  show figure.caption: set par(first-line-indent: 0em)

  // The title spans the page even in a multi-column layout.
  let front = {
    set par(first-line-indent: 0em, justify: false)
    set align(center)
    if title != none {
      block(below: 0.8em, par(leading: 0.5em, text(size: 17pt, weight: "bold", title)))
    }
    if subtitle != none {
      block(below: 0.8em, text(size: 12.5pt, subtitle))
    }
    if meta.authors.len() > 0 {
      block(above: 1.2em, below: 0.8em, grid(
        columns: (auto,) * calc.min(meta.authors.len(), 3),
        column-gutter: 2.2em,
        row-gutter: 1em,
        ..meta.authors.map(a => {
          a.name
          if "affiliation" in a { linebreak(); text(size: 0.9em, a.affiliation) }
          if "email" in a { linebreak(); text(size: 0.85em, raw(a.email)) }
        }),
      ))
    }
    if "date" in meta {
      block(above: 0.8em, text(size: 0.95em, meta.date))
    }
    if abstract != none {
      set par(justify: true)
      set align(left)
      pad(x: if columns > 1 { 0em } else { 2.2em }, top: 0.8em, {
        set text(size: 0.92em)
        align(center, strong[Abstract])
        v(0.15em)
        abstract
        if "keywords" in meta {
          parbreak()
          v(0.4em)
          strong[Keywords: ]
          meta.keywords.join(", ")
        }
      })
    }
  }
  if title != none or subtitle != none or abstract != none or meta.authors.len() > 0 or "date" in meta {
    place(top + center, scope: "parent", float: true, clearance: 1.8em, front)
  }

  contents(meta)
  body
}
