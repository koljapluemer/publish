/** `s` without a leading YAML frontmatter block (`---` … `---`), which marked would show as a heading. */
export const withoutFrontmatter = (s: string) => s.replace(/^---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, '');
