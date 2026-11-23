import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// A deterministic projection of a toroidal surface, generated once at build time.
// The browser receives a small SVG, with no canvas loop or graphics dependency.
export function surface() {
  const project = (u, v) => {
    const r = 154 + 65 * Math.cos(v);
    const x = r * Math.cos(u), y = r * Math.sin(u), z = 65 * Math.sin(v);
    return [310 + x * .96 + y * .27, 300 + y * .66 - z * 1.12 - x * .12];
  };
  const lines = [];
  for (let i = 0; i < 42; i++) {
    const u = i / 42 * Math.PI * 2;
    const points = Array.from({length: 81}, (_, j) => project(u, j / 80 * Math.PI * 2).map(n => n.toFixed(1)).join(',')).join(' ');
    lines.push(`<polyline points="${points}" stroke="#8bd9e1" stroke-opacity="${i > 20 ? '.48' : '.22'}" stroke-width=".75"/>`);
  }
  for (let i = 0; i < 24; i++) {
    const v = i / 24 * Math.PI * 2;
    const points = Array.from({length: 101}, (_, j) => project(j / 100 * Math.PI * 2, v).map(n => n.toFixed(1)).join(',')).join(' ');
    lines.push(`<polyline points="${points}" stroke="#8bd9e1" stroke-opacity=".3" stroke-width=".7"/>`);
  }
  return lines.join('');
}

export async function render(mode = 'preview', overrides = {}) {
  if (!['preview', 'production'].includes(mode)) throw new Error('Mode must be preview or production.');
  const config = { ...JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8')), ...overrides };
  const email = config.contactEmail.trim();
  if (email && !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(email)) throw new Error('Set a valid contactEmail in site.config.json.');
  if (mode === 'production' && !email) throw new Error('Launch blocked: confirm contactEmail in site.config.json before a production build. Use npm run build for a review preview.');
  const canonical = new URL(config.canonicalUrl);
  if (canonical.protocol !== 'https:' || canonical.pathname !== '/' || canonical.search || canonical.hash) throw new Error('canonicalUrl must be an HTTPS origin.');
  const contact = email
    ? `<a class="contact-email" href="mailto:${escapeHtml(encodeURIComponent(email).replace('%40', '@'))}">${escapeHtml(email)}</a>`
    : '<div class="contact-fallback">Contact details will be available soon.</div>';
  const structured = {
    '@context':'https://schema.org', '@type':'Organization', name:config.legalName, alternateName:config.name,
    url:canonical.origin, description:config.description, identifier:config.uid,
    address:{'@type':'PostalAddress',addressLocality:'Riva San Vitale',addressRegion:'Ticino',addressCountry:'CH'},
    ...(email ? { email } : {})
  };
  const values = {
    NAME:escapeHtml(config.name), DESCRIPTION:escapeHtml(config.description), CANONICAL:canonical.origin,
    LEGAL_NAME:escapeHtml(config.legalName), LOCATION:escapeHtml(config.location),
    UID:escapeHtml(config.uid), YEAR:new Date().getUTCFullYear(), ROBOTS:mode === 'production' ? 'index, follow' : 'noindex, nofollow',
    CONTACT_BLOCK:contact, SURFACE:surface(), STRUCTURED_DATA:JSON.stringify(structured).replace(/</g,'\\u003c')
  };
  let html = await readFile(path.join(root, 'src/index.html'), 'utf8');
  html = html.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Unknown template variable: ${key}`);
    return String(values[key]);
  });
  return { html, mode, config };
}

export async function build(mode = 'preview') {
  const result = await render(mode);
  const dist = path.join(root, 'dist');
  await rm(dist, {recursive:true, force:true});
  await mkdir(dist, {recursive:true});
  await cp(path.join(root, 'src/assets'), path.join(dist, 'assets'), {recursive:true});
  await writeFile(path.join(dist, 'index.html'), result.html);
  await writeFile(path.join(dist, '.nojekyll'), '');
  await writeFile(path.join(dist, 'robots.txt'), mode === 'production'
    ? `User-agent: *\nAllow: /\nSitemap: ${result.config.canonicalUrl}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n');
  if (mode === 'production') {
    await writeFile(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${result.config.canonicalUrl}/</loc></url></urlset>\n`);
    await writeFile(path.join(dist, 'CNAME'), `${new URL(result.config.canonicalUrl).hostname}\n`);
  }
  console.log(`Built ${mode} site in dist/ (${Buffer.byteLength(result.html).toLocaleString()} bytes HTML).`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] ?? 'preview';
  await build(mode);
}
