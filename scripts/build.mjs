import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { restaurant } from '../dist/restaurant.config.js';
import './check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, 'build');
if (path.dirname(output) !== root || path.basename(output) !== 'build') throw new Error('Build output must be inside this project.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'dist'), output, { recursive: true });
const configuredOrigin = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
let html = await readFile(path.join(output, 'index.html'), 'utf8');
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(restaurant.brand.title)}</title>`);
html = html.replace(/(<meta name="description" content=")[^"]+/, `$1${escapeHtml(restaurant.brand.description)}`);
html = html.replace(/(<meta property="og:title" content=")[^"]+/, `$1${escapeHtml(restaurant.brand.title)}`);
html = html.replace(/(<meta property="og:description" content=")[^"]+/, `$1${escapeHtml(restaurant.brand.description)}`);
if (configuredOrigin) {
  const origin = new URL(configuredOrigin.startsWith('http') ? configuredOrigin : `https://${configuredOrigin}`).origin;
  html = html.replace(/(<meta property="og:image" content=")[^"]+/, `$1${origin}/assets/hero-meal.jpg`);
}
html = html.replace(/(<meta name="robots" content=")[^"]+/, `$1${restaurant.demo ? 'noindex, nofollow' : 'index, follow'}`);
await writeFile(path.join(output, 'index.html'), html);
await writeFile(path.join(output, 'robots.txt'), `User-agent: *\n${restaurant.demo ? 'Disallow: /' : 'Allow: /'}\n`);
console.log('Build ready: build/ — static HTML, CSS, JavaScript and local assets.');
