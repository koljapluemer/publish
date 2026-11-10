import { describe, expect, it } from 'vitest';
import { theaBlocks, withNewName } from './thea';

describe('theaBlocks', () => {
  it('mirrors _editor/thea.py', () => {
    const text = '# T\n\n```thea brisk-river\nA bar chart.\n```\n\n~~~thea\nOther\n~~~\n````md\n```thea a-b\nx\n```\n````\n```thea Bad\ny\n```\n```thea c-d\nunclosed';
    expect(theaBlocks(text).map((b) => [b.index, b.line, b.name, b.spec])).toEqual([
      [0, 2, 'brisk-river', 'A bar chart.'], [1, 6, null, 'Other'], [2, 14, null, 'y'],
    ]);
  });
});

describe('withNewName', () => {
  it('names the block on first generation, not reusing a name in the doc', () => {
    const text = '```thea\nspec\n```';
    const [namedText, name] = withNewName(text, theaBlocks(text)[0]);
    const named = theaBlocks(namedText)[0];
    expect(name).toMatch(/^[a-z]+-[a-z]+$/);
    expect(named.name).toBe(name);
    expect(named.spec).toBe('spec');
  });
});
