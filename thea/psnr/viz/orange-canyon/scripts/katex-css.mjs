// Writes src/katex.css: KaTeX's stylesheet with only woff2 font sources.
import { readFile, writeFile } from 'node:fs/promises';

const css = await readFile('node_modules/katex/dist/katex.css', 'utf-8');
const out = css
  .replace(/,\s*url\(fonts\/[^)]+\.woff\) format\("woff"\)/g, '')
  .replace(/,\s*url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, '')
  .replace(/url\(fonts\//g, 'url(../node_modules/katex/dist/fonts/');
await writeFile('src/katex.css', out);
