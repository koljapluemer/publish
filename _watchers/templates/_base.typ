// Shared helpers, placed before every template when a document is assembled.

// Pandoc emits this for `---` in the Markdown body.
#let horizontalrule = align(center, block(above: 1.4em, below: 1.4em, line(length: 25%, stroke: 0.5pt + luma(170))))

// Frontmatter lengths may be numbers (11, meaning pt) or strings ("2.5cm").
#let to-length(value) = if type(value) == str { eval(value) } else { value * 1pt }

// `margin: 2cm` overrides a template's default margin.
#let page-margin(meta, default) = if "margin" in meta { to-length(meta.margin) } else { default }

#let author-names(meta) = meta.authors.map(a => a.name)

// Section numbering: template default, a pattern ("1.a"), or `false`.
#let heading-numbering(meta, default) = {
  let value = meta.at("numbering", default: default)
  if value == false { none } else { value }
}

#let contents(meta) = if meta.at("toc", default: false) == true {
  outline()
  v(1.5em)
}

// Added after the body when the frontmatter names a `bibliography`.
#let references(meta) = if "bibliography" in meta {
  bibliography(
    meta.bibliography,
    style: meta.at("csl", default: "ieee"),
  )
}
