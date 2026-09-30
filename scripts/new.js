#!/usr/bin/env node
/*
 * Turns this template into a new tool in one step:
 *   npm run new -- ai-stylist "AI Stylist" 👗
 *   npm run new -- ai-stylist "AI Stylist" 👗 --user your-github-name
 * Sets the id, name, icon, GitHub Pages url and repo everywhere, and removes the template notice.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function create(dir, { id, name, icon = '🧩', user = 'jarridxjackson' }) {
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id || '')) throw new Error('id must be lowercase letters, digits and dashes, e.g. ai-stylist');
  if (!name) throw new Error('give the tool a name, e.g. "AI Stylist"');
  if (!/^[A-Za-z0-9-]{1,39}$/.test(user)) throw new Error('--user must be a GitHub username');
  const file = (f) => path.join(dir, f);
  const edit = (f, fn) => fs.writeFileSync(file(f), fn(fs.readFileSync(file(f), 'utf8')));

  const m = JSON.parse(fs.readFileSync(file('stoit.json'), 'utf8'));
  Object.assign(m, { id, name, icon, url: `https://${user}.github.io/${id}/`, repo: `https://github.com/${user}/${id}`, author: user, version: '0.1.0' });
  fs.writeFileSync(file('stoit.json'), JSON.stringify(m, null, 2) + '\n');
  edit('package.json', (s) => s.replace('"name": "my-tool"', `"name": "${id}"`));
  edit('index.html', (s) => s.replace(/<title>[^<]*<\/title>/, `<title>${esc(name)}</title>`).replace(/font-size='90'>[^<]*</, `font-size='90'>${icon}<`)
    .replace('<span class="logo" id="logo" aria-hidden="true">🧩</span>', `<span class="logo" id="logo" aria-hidden="true">${icon}</span>`).replace('<h1 id="name">My Tool</h1>', `<h1 id="name">${esc(name)}</h1>`));
  edit('app.js', (s) => s.replace("const KEY = 'my-tool-v1';", `const KEY = '${id}-v1';`).replace(' * My Tool: the example logic.', ` * ${name}: the example logic.`));
  edit('README.md', (s) => s
    .replace(/<!-- TEMPLATE:START -->[\s\S]*?<!-- TEMPLATE:END -->\n*/, '')
    .replace(/# 🧩 My Tool/, `# ${icon} ${name}`)
    .replace(/jarridxjackson\/my-tool/g, `${user}/${id}`)
    .replace(/jarridxjackson\.github\.io\/my-tool/g, `${user}.github.io/${id}`));
  // The template's own tests don't apply to your tool (test/tool.test.js stays).
  const tt = file('test/template.test.js');
  if (fs.existsSync(tt)) fs.unlinkSync(tt);
  return m;
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

module.exports = { create };

if (require.main === module) {
  const args = process.argv.slice(2);
  const ui = args.indexOf('--user');
  const user = ui >= 0 ? args.splice(ui, 2)[1] : undefined;
  const [id, name, icon] = args;
  try {
    const m = create(path.join(__dirname, '..'), { id, name, icon, user });
    console.log(`✅ ${m.icon} ${m.name} is set up.\n\nNext:\n  1. Write the pitch in stoit.json (villain, five whys, savings, how-to)\n  2. npm run readme   (copies the pitch into README.md)\n  3. Build the tool in index.html and app.js\n  4. npm test         (must pass before it can publish)\n  5. Push to main; it goes live at ${m.url}`);
  } catch (e) { console.error('❌ ' + e.message); process.exit(1); }
}
