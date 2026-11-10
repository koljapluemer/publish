import { describe, expect, it } from 'vitest';
import { withoutFrontmatter } from './frontmatter';

describe('withoutFrontmatter', () => {
  it('drops a leading YAML block only', () => {
    expect(withoutFrontmatter('---\ntarget: web\ntitle: T\n---\n# Hi\n')).toBe('# Hi\n');
    expect(withoutFrontmatter('---\n---\nx')).toBe('x');
    expect(withoutFrontmatter('# Hi\n\n---\na: b\n---\n')).toBe('# Hi\n\n---\na: b\n---\n');
    expect(withoutFrontmatter('---\nunclosed')).toBe('---\nunclosed');
  });
});
