// Tests for your tool. Add tests for your core logic here as the tool grows.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Stoit = require('../stoit-sdk.js');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'stoit.json'), 'utf8'));

test('stoit.json is a valid STOIT manifest', () => {
  const r = Stoit.validateManifest(manifest);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('STOIT would open this tool, and the tool reads the task back', () => {
  const m = Stoit.validateManifest(manifest).manifest;
  const url = Stoit.launchUrl(m, { id: 't1', title: 'Example task', type: m.helpsWith.types[0] || 'action' }, { returnTo: 'https://stoit.app/' });
  assert.equal(Stoit.context({ hash: new URL(url).hash }).task.title, 'Example task');
});

test('every `npm run …` the docs and scripts mention exists in package.json', () => {
  const root = path.join(__dirname, '..');
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const files = ['README.md', 'DAILY.md', 'scripts/new.js', 'scripts/check.js', 'scripts/readme.js'].filter((f) => fs.existsSync(path.join(root, f)));
  for (const f of files) {
    for (const [, name] of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/npm run ([a-z][\w-]*)/g)) {
      assert.ok(scripts[name], `${f} mentions "npm run ${name}", but package.json has no "${name}" script`);
    }
  }
});

test('GitHub Pages publishes every file the app uses, and none of the tests or scripts', () => {
  const { siteFiles, missingRefs } = require('../scripts/site.js');
  const root = path.join(__dirname, '..');
  const files = siteFiles(root);
  assert.deepEqual(missingRefs(root, files), [], 'a page links to a file that would not be published');
  assert.ok(files.includes('index.html') && files.includes('stoit.json'));
  assert.ok(!files.some((f) => /^(test|scripts|\.github)\//.test(f) || f === 'package.json' || f === 'README.md'));
});
