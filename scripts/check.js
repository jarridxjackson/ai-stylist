#!/usr/bin/env node
/*
 * The quality gate, run by `npm test` and CI before anything is published:
 *  - stoit.json is valid (Stoit.validateManifest), with its pitch filled in
 *  - README.md has the sections people need, and its pitch matches stoit.json
 *  - the app loads the SDK
 * In the template itself (id "my-tool") TODO placeholders are allowed; once you run
 * `npm run new`, every TODO must be replaced before the app can be published.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Stoit = require('../stoit-sdk.js');
const { render } = require('./readme.js');

const SECTIONS = ['## The problem', '## Five whys', '## What it saves', '## How to use it best', '## Use it with STOIT', '## Privacy'];

function check(dir) {
  const errors = [];
  const warnings = [];
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch (_) { errors.push(`${f} is missing`); return ''; } };
  let raw = {};
  try { raw = JSON.parse(read('stoit.json') || '{}'); } catch (e) { errors.push(`stoit.json is not valid JSON: ${e.message}`); }
  const v = Stoit.validateManifest(raw);
  errors.push(...v.errors.map((e) => `stoit.json: ${e}`));
  warnings.push(...v.warnings.map((w) => `stoit.json: ${w}`));
  const isTemplate = raw.id === 'my-tool';
  const todos = (read('stoit.json').match(/TODO/g) || []).length + (read('README.md').match(/TODO/g) || []).length;
  if (todos) (isTemplate ? warnings : errors).push(`${todos} TODO placeholder(s) left in stoit.json / README.md${isTemplate ? '' : ': write your pitch before publishing'}`);

  const readme = read('README.md');
  for (const s of SECTIONS) if (!readme.includes(s)) errors.push(`README.md needs a "${s}" section`);
  if (readme && v.manifest && readme.includes('<!-- PITCH:END -->')) {
    try { if (render(dir) !== readme) errors.push('README.md pitch is out of date: run `npm run readme`'); } catch (e) { errors.push(e.message); }
  }
  const html = read('index.html');
  if (html && !/<script src="stoit-sdk\.js"><\/script>/.test(html)) errors.push('index.html must load stoit-sdk.js');
  if (html && !/<title>[^<]+<\/title>/.test(html)) errors.push('index.html needs a <title>');
  if (!fs.existsSync(path.join(dir, 'stoit-sdk.js'))) errors.push('stoit-sdk.js is missing');
  return { errors, warnings, manifest: v.manifest };
}

module.exports = { check, SECTIONS };

if (require.main === module) {
  const { errors, warnings, manifest } = check(path.join(__dirname, '..'));
  for (const w of warnings) console.log('⚠️  ' + w);
  for (const e of errors) console.log('❌ ' + e);
  if (errors.length) { console.log(`\n${errors.length} problem(s). Fix them before publishing.`); process.exit(1); }
  console.log(`✅ ${manifest.icon} ${manifest.name} is ready to publish${warnings.length ? ` (${warnings.length} suggestion(s) above)` : ''}.`);
}
