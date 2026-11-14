import { describe, expect, it } from 'vitest';
import { resolveImage } from '@/dumb/resolve';
import { docFileUrl, fileName, fileReference, isImage } from './files';

describe('fileReference', () => {
  const text = 'Prose\n\n```thea a-b\nA chart of \n```\nmore';
  it('is the bare name inside a viz spec', () => {
    expect(fileReference(text, text.indexOf('of ') + 3, 'rain.csv')).toBe('rain.csv');
    expect(fileReference(text, text.indexOf('of ') + 3, 'photo.png')).toBe('photo.png');
  });
  it('is an image in prose for images, else the bare name', () => {
    expect(fileReference(text, 2, 'photo.png')).toBe('![](photo.png)');
    expect(fileReference(text, text.length, 'rain.csv')).toBe('rain.csv');
    // on the fence lines themselves, it's prose
    expect(fileReference(text, text.indexOf('```thea'), 'photo.png')).toBe('![](photo.png)');
  });
});

describe('fileName', () => {
  const now = new Date(2026, 10, 10, 9, 5, 3);
  it('keeps valid names and cleans others', () => {
    expect(fileName({ name: 'rain.csv', type: 'text/csv' })).toBe('rain.csv');
    expect(fileName({ name: 'Mein Foto (1).JPG', type: 'image/jpeg' })).toBe('Mein-Foto-1.jpg');
    expect(fileName({ name: 'Ümlaut.png', type: '' })).toBe('Umlaut.png');
  });
  it('names pasted images by time, from their type', () => {
    expect(fileName({ name: 'image.png', type: 'image/png' }, now)).toBe('pasted-20261110-090503.png');
    expect(fileName({ name: '', type: 'image/webp' }, now)).toBe('pasted-20261110-090503.webp');
  });
  it('rejects unsupported types and the doc itself stays safe', () => {
    expect(fileName({ name: 'a.exe', type: 'application/octet-stream' })).toBeNull();
    expect(fileName({ name: 'index.md', type: 'text/markdown' }, now)).toBe('pasted-20261110-090503.md');
  });
});

describe('resolveImage', () => {
  it('resolves relative images against the base only', () => {
    const base = '/api/docs/d/files/';
    expect(resolveImage('x.png', base)).toBe('/api/docs/d/files/x.png');
    for (const href of ['/abs.png', 'https://e.org/c.png', 'data:image/png;base64,AA==', '#x']) expect(resolveImage(href, base)).toBe(href);
    expect(resolveImage('x.png', '')).toBe('x.png');
  });
});

describe('docFileUrl', () => {
  it('versions the URL by mtime and encodes the name', () => {
    expect(docFileUrl('psnr', { name: 'a b.png', size: 1, mtime: 42, mime: 'image/png' })).toBe('/api/docs/psnr/files/a%20b.png?v=42');
    expect(isImage('x.JPG')).toBe(true);
    expect(isImage('x.csv')).toBe(false);
  });
});
