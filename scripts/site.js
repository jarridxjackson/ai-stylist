#!/usr/bin/env node
/*
 * Builds the folder that GitHub Pages publishes: every file of the app itself, and nothing
 * that's only for building it (tests, scripts, README, package.json…).
 *   node scripts/site.js _site
 * Fails if a page links to a local file that wouldn't be published, so a missing script or
 * stylesheet is caught before it goes live instead of after.
 */
'use strict';
const fs = require('fs');
const path = require('path');

// Not part of the app people use.
const SKIP = new Set(['test', 'scripts', 'node_modules', '_site', 'package.json', 'package-lock.json', 'README.md', 'DAILY.md', 'LICENSE', 'CHANGELOG.md']);

function siteFiles(dir, rel = '') {
  const out = [];
  for (const name of fs.readdirSync(path.join(dir, rel)).sort()) {
    if (name.startsWith('.') || (!rel && SKIP.has(name))) continue;
    const r = rel ? `${rel}/${name}` : name;
    if (fs.statSync(path.join(dir, r)).isDirectory()) out.push(...siteFiles(dir, r));
    else out.push(r);
  }
  return out;
}

// Local files the pages load (src="…", href="…"), which must all be published.
function missingRefs(dir, files) {
  const have = new Set(files);
  const missing = [];
  for (const page of files.filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dir, page), 'utf8');
    for (const [, ref] of html.matchAll(/\s(?:src|href)="([^"#?]+)[^"]*"/g)) {
      if (/^([a-z]+:|\/\/|data:)/i.test(ref)) continue; // other sites, mailto:, data: URIs
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(page), ref));
      if (!have.has(target)) missing.push(`${page} → ${ref}`);
    }
  }
  return missing;
}

function build(dir, dest) {
  const files = siteFiles(dir);
  const missing = missingRefs(dir, files);
  if (missing.length) throw new Error(`these pages link to files that won't be published:\n  ${missing.join('\n  ')}`);
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dest, f)), { recursive: true });
    fs.copyFileSync(path.join(dir, f), path.join(dest, f));
  }
  return files;
}

module.exports = { siteFiles, missingRefs, build };

if (require.main === module) {
  const dest = process.argv[2] || '_site';
  try {
    const files = build(path.join(__dirname, '..'), path.resolve(dest));
    console.log(`✅ ${files.length} files ready to publish in ${dest}: ${files.join(', ')}`);
  } catch (e) { console.error('❌ ' + e.message); process.exit(1); }
}
