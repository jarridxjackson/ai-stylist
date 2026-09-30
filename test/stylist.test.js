const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../stylist.js');

const W = [
  { id: 'tee', name: 'white tee', cat: 'top', color: 'white', f: 2 },
  { id: 'hood', name: 'grey hoodie', cat: 'top', color: 'grey', f: 1, warmth: 2 },
  { id: 'oxford', name: 'blue oxford', cat: 'top', color: 'sky', f: 4 },
  { id: 'red', name: 'red silk shirt', cat: 'top', color: 'red', f: 3 },
  { id: 'jeans', name: 'dark jeans', cat: 'bottom', color: 'denim', f: 2, warmth: 2 },
  { id: 'trousers', name: 'navy trousers', cat: 'bottom', color: 'navy', f: 4 },
  { id: 'sneak', name: 'white sneakers', cat: 'shoes', color: 'white', f: 2 },
  { id: 'derby', name: 'black derbies', cat: 'shoes', color: 'black', f: 4 },
  { id: 'blazer', name: 'navy blazer', cat: 'outer', color: 'navy', f: 4 },
  { id: 'coat', name: 'camel coat', cat: 'outer', color: 'camel', f: 4, warmth: 3 },
  { id: 'rain', name: 'rain jacket', cat: 'outer', color: 'olive', f: 2, warmth: 2, tags: ['waterproof'] },
];
const ids = (o) => Object.values(o.pieces).filter(Boolean).map((p) => p.id).sort();

test('works out the dress code from what the plan says', () => {
  assert.equal(S.occasionFor('Client pitch at 10').id, 'interview');
  assert.equal(S.occasionFor('Dinner with Maya').id, 'date');
  assert.equal(S.occasionFor('Sam’s wedding').id, 'formal');
  assert.equal(S.occasionFor('Morning run').id, 'active');
  assert.equal(S.occasionFor('Flight to Austin').id, 'travel');
  assert.equal(S.occasionFor('Weekly review meeting').id, 'work');
  assert.equal(S.occasionFor('Something').id, 'casual');
  assert.equal(S.occasionFor('Something').matched, false);
});

test('a client pitch gets business pieces, not a hoodie and sneakers', () => {
  const r = S.style(W, { occasion: 'Client pitch', tempC: 21 });
  const best = r.outfits[0];
  assert.ok(best.pieces.top.f >= 3 && best.pieces.shoes.id === 'derby', best.summary);
  assert.equal(r.outfits.length, 3);
  assert.ok(r.outfits.every((o) => !ids(o).includes('hood')));
  assert.ok(best.why.some((w) => /Right for interview/.test(w)));
});

test('the weather decides the layer', () => {
  const cold = S.style(W, { occasion: 'Coffee with Jo', tempC: 3 }).outfits[0];
  assert.equal(cold.pieces.outer.id, 'coat', cold.summary);
  const wet = S.style(W, { occasion: 'Coffee with Jo', tempC: 12, rain: true }).outfits[0];
  assert.equal(wet.pieces.outer.id, 'rain', wet.summary);
  assert.ok(wet.why.includes('Ready for rain.'));
  const hot = S.style(W, { occasion: 'Coffee with Jo', tempC: 30 }).outfits[0];
  assert.equal(hot.pieces.outer, null);
  assert.notEqual(hot.pieces.top.id, 'hood');
});

test('colour rules: one pop is best, clashes are called out, dark for a funeral', () => {
  assert.equal(S.colorScore(['red', 'navy', 'white']).score, 1);
  assert.match(S.colorScore(['red', 'green']).why, /compete/);
  assert.ok(S.colorScore(['red', 'green'], { vibe: 'bold' }).score > S.colorScore(['red', 'green']).score);
  assert.ok(S.colorScore(['blue', 'purple']).score > S.colorScore(['yellow', 'purple']).score, 'neighbours on the wheel beat opposites');
  const f = S.style(W, { occasion: 'Funeral', tempC: 18 }).outfits[0];
  assert.ok(Object.values(f.pieces).filter(Boolean).every((p) => S.COLORS[p.color].dark || p.color === 'white' || p.color === 'sky'), f.summary);
});

test('active plans need clothes you can move in', () => {
  const r = S.style(W, { occasion: 'Morning run', tempC: 18 });
  assert.ok(r.outfits[0].warn.some((w) => /made for moving in/.test(w)));
  const m = S.missing(W, { occasion: 'Morning run', tempC: 18 });
  assert.ok(m.some((x) => x.item.f === 0), JSON.stringify(m.map((x) => x.item.name)));
  const kitted = [...W, { id: 'wt', name: 'workout top', cat: 'top', color: 'black', f: 0 }, { id: 'ws', name: 'shorts', cat: 'bottom', color: 'black', f: 0 }, { id: 'rs', name: 'running shoes', cat: 'shoes', color: 'grey', f: 0 }];
  const k = S.style(kitted, { occasion: 'Morning run', tempC: 18 }).outfits[0];
  assert.deepEqual([k.pieces.top.id, k.pieces.bottom.id, k.pieces.shoes.id], ['wt', 'ws', 'rs']);
  assert.equal(k.accessory, undefined);
});

test('no jacket nobody needs on a hot day', () => {
  assert.ok(S.style(W, { occasion: 'brunch', tempC: 29 }).outfits.every((o) => !o.pieces.outer));
  // a blazer is still fair game for business, so it's never flagged as unneeded there
  assert.ok(S.style(W, { occasion: 'Client pitch', tempC: 29 }).outfits.every((o) => !o.warn.some((w) => /won’t need/.test(w))));
});

test('three real choices, and it avoids what you just wore', () => {
  const r = S.style(W, { occasion: 'brunch', tempC: 22 });
  const [a, b] = r.outfits;
  assert.ok(ids(b).filter((x) => !ids(a).includes(x)).length >= 2);
  const worn = W.map((w) => (w.id === a.pieces.top.id ? { ...w, wornAt: Date.now() - 3600000 } : w));
  const again = S.style(worn, { occasion: 'brunch', tempC: 22 });
  assert.notEqual(again.outfits[0].pieces.top.id, a.pieces.top.id);
  assert.ok(again.outfits.some((o) => o.warn.some((w) => /You wore .* today/.test(w))) || !again.outfits.some((o) => o.pieces.top.id === a.pieces.top.id));
});

test('suggests the piece that helps most, and only when it matters', () => {
  const casualOnly = W.filter((w) => ['tee', 'hood', 'jeans', 'sneak'].includes(w.id));
  const m = S.missing(casualOnly, { occasion: 'Job interview', tempC: 20 });
  assert.ok(m.length >= 1);
  assert.ok(m[0].item.f >= 4, m[0].item.name);
  assert.ok(m[0].gain >= 8);
  // a full wardrobe for a casual day doesn't need anything
  assert.deepEqual(S.missing(W, { occasion: 'brunch', tempC: 21 }), []);
});

test('bad input is cleaned up, not trusted', () => {
  const it = S.normalizeItem({ name: '<b>x</b>'.repeat(20), cat: 'hat', color: 'mauve', f: 99, warmth: -3, tags: 'nope' });
  assert.equal(it.cat, 'top');
  assert.equal(it.color, 'black');
  assert.equal(it.f, 5);
  assert.equal(it.warmth, 1);
  assert.deepEqual(it.tags, []);
  assert.equal(it.name.length, 60);
  assert.deepEqual(S.style([], { occasion: 'date' }).outfits, []);
  assert.equal(S.cToF(20), 68);
  assert.equal(S.fToC(68), 20);
});
