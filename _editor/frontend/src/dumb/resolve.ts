/** `href` resolved against `base` when it's relative to the doc: no scheme, not absolute, not a fragment. */
export const resolveImage = (href: string, base: string) =>
  base && href && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('/') && !href.startsWith('#') ? base + href : href;
