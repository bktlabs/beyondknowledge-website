import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { render, root } from './build.mjs';

test('review site is complete, unindexed, and has no invented email', async () => {
  const { html } = await render('preview', {contactEmail:''});
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /mailto:|\{\{[A-Z_]+\}\}/);
  assert.equal((html.match(/<h1\b/g)||[]).length, 1);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), `Missing anchor ${match[1]}`);
  for (const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) await access(path.join(root,'src',match[1]));
  assert.match(html, /Computational verifiability/);
  assert.doesNotMatch(html, /Garoffolo|Zendoo|SNARKtor|GIGA Protocol|founder|arxiv\.org|eprint\.iacr\.org|doi\.org|github|bktlabs/i);
  assert.match(html, /CHE-479\.029\.425/);
});
test('production requires a confirmed, valid contact address', async () => {
  await assert.rejects(render('production',{contactEmail:''}), /Launch blocked/);
  await assert.rejects(render('production',{contactEmail:'invalid'}), /valid contactEmail/);
  const {html} = await render('production',{contactEmail:'confirmed@example.org'});
  assert.match(html, /mailto:confirmed@example.org/);
  assert.match(html, /name="robots" content="index, follow"/);
  const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
  assert.equal(JSON.parse(json).email,'confirmed@example.org');
});
test('canonical origin and structured data remain consistent', async () => {
  const {html,config} = await render();
  const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
  assert.equal(JSON.parse(json).url,config.canonicalUrl);
  assert.match(html,/rel="canonical" href="https:\/\/beyondknowledge\.ch\/"/);
  await assert.rejects(render('preview',{canonicalUrl:'http://example.org'}), /HTTPS/);
  const css = await readFile(path.join(root,'src/assets/style.css'),'utf8');
  assert.match(css,/prefers-reduced-motion/);
});
