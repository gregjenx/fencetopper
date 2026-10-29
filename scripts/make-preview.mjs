// Builds preview/ from dist/: rewrites root-relative links to relative .html
// links so the site can be opened as static files (used for the shareable preview).
// Not needed for real hosting, which serves clean URLs from dist/ directly.
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist', out = 'preview';
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(dist, out, { recursive: true });

const asset = /^\/(css|js|img)\/|^\/[^/]+\.[a-z0-9]+$/i; // any file with an extension
function rel(p) {
  const [base, frag] = p.split('#');
  let r;
  if (base === '/' || base === '') r = 'index.html';
  else if (asset.test(base)) r = base.slice(1);
  else r = base.slice(1) + '.html';
  return frag !== undefined ? `${r}#${frag}` : r;
}
const linkFn = `<script>window.FT_LINK=function(p){var b=p.split('#');var r=b[0]==='/'?'index.html':/^\\/(css|js|img)\\//.test(b[0])?b[0].slice(1):b[0].slice(1)+'.html';return b.length>1?r+'#'+b[1]:r;};</script>`;

for (const f of fs.readdirSync(out).filter((f) => f.endsWith('.html'))) {
  let html = fs.readFileSync(path.join(out, f), 'utf8');
  html = html.replace(/(href|src)="(\/[^"]*)"/g, (m, a, p) => (p.startsWith('//') ? m : `${a}="${rel(p)}"`));
  html = html.replace(/srcset="([^"]*)"/g, (m, s) => `srcset="${s.replace(/(^|,\s*)\/(img\/)/g, '$1$2')}"`);
  html = html.replace('<script src="js/site.js', linkFn + '<script src="js/site.js');
  fs.writeFileSync(path.join(out, f), html);
}

// Artifact host wraps the main page in its own document skeleton, so make a
// body-only copy of the home page.
const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const head = home.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '')
  .replace(/<title>[^<]*<\/title>/, '<title>FenceTopper Website</title>');
const body = home.match(/<body>([\s\S]*?)<\/body>/)[1];
fs.writeFileSync(path.join(out, 'artifact-index.html'), head.replace('<title>FenceTopper Website</title>', '') .replace(/^/, '<title>FenceTopper Website</title>\n') + '\n' + body);
console.log('preview ready');
