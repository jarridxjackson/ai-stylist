#!/usr/bin/env node
/*
 * Writes the pitch sections of README.md from stoit.json, between the PITCH markers,
 * so the story is written once. `npm run readme` updates it; `npm run check` fails if it's stale.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Stoit = require('../stoit-sdk.js');

const START = '<!-- PITCH:START (generated from stoit.json by `npm run readme`; edit stoit.json instead) -->';
const END = '<!-- PITCH:END -->';

function pitchMarkdown(m) {
  const p = m.pitch;
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const saves = [p.save.hours ? `**${p.save.hours} hours**` : '', p.save.money ? `**${money(p.save.money)}**` : ''].filter(Boolean).join(' and ');
  return [
    START,
    `## The problem: ${p.villain.emoji} ${p.villain.name}`,
    '',
    p.villain.scene,
    '',
    '## Five whys',
    '',
    ...p.whys.map((w, i) => `${i + 1}. **${w.q || 'Why?'}** ${w.a}`),
    '',
    '## What it saves',
    '',
    `About ${saves} a month.${p.save.basis ? ` ${p.save.basis.replace(/\.?$/, '.')}` : ''}`,
    '',
    '## How to use it best',
    '',
    ...p.howTo.map((s, i) => `${i + 1}. ${s}`),
    ...(p.bestFor ? ['', `**Best for:** ${p.bestFor}`] : []),
    '',
    END,
  ].join('\n');
}

function render(dir) {
  const m = Stoit.validateManifest(JSON.parse(fs.readFileSync(path.join(dir, 'stoit.json'), 'utf8'))).manifest;
  const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  const a = readme.indexOf(START.slice(0, 16)), b = readme.indexOf(END);
  if (a < 0 || b < 0) throw new Error('README.md is missing the PITCH markers');
  return readme.slice(0, a) + pitchMarkdown(m) + readme.slice(b + END.length);
}

module.exports = { pitchMarkdown, render, START, END };

if (require.main === module) {
  const dir = path.join(__dirname, '..');
  fs.writeFileSync(path.join(dir, 'README.md'), render(dir));
  console.log('README.md pitch updated from stoit.json');
}
