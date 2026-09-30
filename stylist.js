/*
 * Stylist: picks outfits from the clothes you own, for where you're going and the weather.
 * No AI: clear rules you can read, so you can see why it chose what it did.
 *   occasionFor(text)       → the dress code for "Dinner with Maya", "Client pitch", "Gym"…
 *   style(wardrobe, opts)   → the 3 best outfits, each with the reasons behind it
 *   missing(wardrobe, opts) → the one or two pieces that would help most
 */
(function (root) {
  'use strict';

  // 0 active · 1 lounge · 2 casual · 3 smart casual · 4 business · 5 formal
  const FORMALITY = ['Active', 'Lounge', 'Casual', 'Smart casual', 'Business', 'Formal'];
  const CATS = {
    top: { label: 'Top', icon: '👕' }, bottom: { label: 'Bottom', icon: '👖' }, dress: { label: 'Dress / one-piece', icon: '👗' },
    outer: { label: 'Jacket / coat', icon: '🧥' }, shoes: { label: 'Shoes', icon: '👟' }, accessory: { label: 'Accessory', icon: '👜' },
  };
  // Neutrals go with everything; a "pop" is a colour that stands out.
  const COLORS = {
    black: { hex: '#1b1b1f', neutral: true, dark: true }, white: { hex: '#f7f7f4', neutral: true }, grey: { hex: '#8e9199', neutral: true },
    charcoal: { hex: '#3b3d43', neutral: true, dark: true }, navy: { hex: '#1f2f56', neutral: true, dark: true }, denim: { hex: '#4a6b9a', neutral: true },
    beige: { hex: '#d9c7a7', neutral: true }, cream: { hex: '#f1e8d2', neutral: true }, camel: { hex: '#b98a55', neutral: true }, brown: { hex: '#6b4a32', neutral: true, dark: true },
    olive: { hex: '#6b6b3a', neutral: true, family: 'green' },
    red: { hex: '#c8323c', family: 'red' }, burgundy: { hex: '#6e1e2c', family: 'red', dark: true }, pink: { hex: '#ef8fb1', family: 'red' },
    orange: { hex: '#e8793a', family: 'orange' }, yellow: { hex: '#f2c94c', family: 'yellow' }, green: { hex: '#3a8f5c', family: 'green' },
    sky: { hex: '#8cc4ec', family: 'blue' }, blue: { hex: '#2f6fd6', family: 'blue' }, purple: { hex: '#6e4bb0', family: 'purple' }, lavender: { hex: '#b9a7e3', family: 'purple' },
  };
  // Colour families next to each other on the wheel sit well together.
  const NEAR = { red: ['orange', 'purple'], orange: ['red', 'yellow'], yellow: ['orange', 'green'], green: ['yellow', 'blue'], blue: ['green', 'purple'], purple: ['blue', 'red'] };

  const OCCASIONS = {
    interview: { label: 'Interview / client', emoji: '💼', f: 4, words: ['interview', 'pitch', 'client', 'investor', 'presentation', 'board', 'demo day', 'conference', 'speaking', 'panel'], tip: 'Dress one step above what they usually wear.' },
    work: { label: 'Work', emoji: '🗂️', f: 3, words: ['work', 'office', 'meeting', 'standup', 'review', 'sync', 'planning', 'retro', '1:1', 'one-on-one', 'workshop'], tip: 'Neat and comfortable enough to forget about.' },
    date: { label: 'Date night', emoji: '💘', f: 3, words: ['date', 'dinner', 'drinks', 'anniversary', 'romantic', 'girlfriend', 'boyfriend', 'wife', 'husband', 'restaurant'], tip: 'Wear the one thing you feel best in, and build around it.' },
    formal: { label: 'Wedding / formal', emoji: '🥂', f: 5, words: ['wedding', 'gala', 'black tie', 'ceremony', 'formal', 'awards', 'opera', 'prom'], tip: 'Don’t outshine the hosts. Skip white at a wedding.' },
    funeral: { label: 'Funeral / memorial', emoji: '🕊️', f: 4, words: ['funeral', 'memorial', 'wake', 'service for'], dark: true, tip: 'Dark, simple and quiet.' },
    party: { label: 'Party', emoji: '🎉', f: 3, words: ['party', 'birthday', 'club', 'concert', 'celebration', 'launch party', 'festival'], bold: true, tip: 'A good night for your boldest piece.' },
    casual: { label: 'Casual', emoji: '☕', f: 2, words: ['brunch', 'coffee', 'hang', 'errand', 'groceries', 'movie', 'game night', 'bbq', 'park', 'friends', 'lunch'], tip: 'Easy, clean, a little put together.' },
    active: { label: 'Gym / active', emoji: '🏃', f: 0, words: ['gym', 'run', 'workout', 'yoga', 'hike', 'training', 'swim', 'tennis', 'pilates', 'climb', 'walk'], tip: 'Move freely. Layers you can take off.' },
    travel: { label: 'Travel', emoji: '✈️', f: 2, words: ['flight', 'travel', 'airport', 'trip', 'road trip', 'train'], comfy: true, tip: 'Comfy, layered, easy shoes for security.' },
    home: { label: 'At home', emoji: '🏡', f: 1, words: ['wfh', 'home', 'lazy', 'chill', 'sunday reset', 'cleaning'], tip: 'Comfy, but dressed enough to feel awake.' },
  };
  const VIBES = { classic: 'Classic', minimal: 'Minimal', bold: 'Bold', sporty: 'Sporty', comfy: 'Comfy' };

  // The dress code for some words about where you're going. Unknown → casual.
  function occasionFor(text) {
    const t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9:' -]+/g, ' ') + ' ';
    let best = null, at = Infinity;
    for (const [id, o] of Object.entries(OCCASIONS)) {
      for (const w of o.words) {
        const i = t.indexOf(' ' + w + ' ') >= 0 ? t.indexOf(' ' + w + ' ') : t.indexOf(' ' + w + 's ');
        // the earliest match wins ("Dinner after the client pitch" is a date… unless the pitch comes first)
        if (i >= 0 && i < at) { best = id; at = i; }
      }
    }
    return { id: best || 'casual', matched: !!best, ...OCCASIONS[best || 'casual'] };
  }

  function normalizeItem(it, i = 0) {
    const s = (x, n) => String(x == null ? '' : x).slice(0, n);
    const n = (x, lo, hi, d) => { const v = Math.round(Number(x)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    return {
      id: s(it.id, 40) || `item-${i}-${Math.random().toString(36).slice(2, 7)}`,
      name: s(it.name, 60) || 'Item', cat: CATS[it.cat] ? it.cat : 'top', color: COLORS[it.color] ? it.color : 'black',
      f: n(it.f, 0, 5, 2), warmth: n(it.warmth, 1, 3, 1),
      tags: (Array.isArray(it.tags) ? it.tags : []).map((x) => s(x, 20).toLowerCase()).filter(Boolean).slice(0, 8),
      wornAt: Number(it.wornAt) || 0,
    };
  }

  // How well a set of colours works together, 0–1, and a line about why.
  function colorScore(colors, { vibe, dark } = {}) {
    const pops = [...new Set(colors.filter((c) => !COLORS[c].neutral))];
    let score, why;
    if (dark && colors.some((c) => !COLORS[c].dark && c !== 'white')) return { score: 0.2, why: 'Keep it dark for this one.' };
    if (!pops.length) { score = vibe === 'bold' ? 0.6 : vibe === 'minimal' ? 1 : 0.85; why = vibe === 'bold' ? 'All neutrals, safe but quiet.' : `${cap(uniq(colors).slice(0, 3).join(' + '))}: neutrals that always work.`; }
    else if (pops.length === 1) { score = vibe === 'minimal' ? 0.75 : 1; why = `One pop of ${pops[0]} against neutrals.`; }
    else if (pops.length === 2) {
      const [a, b] = pops.map((c) => COLORS[c].family);
      if (a === b) { score = 0.85; why = `${cap(pops.join(' and '))}: two shades of one colour.`; }
      else if ((NEAR[a] || []).includes(b)) { score = 0.75; why = `${cap(pops.join(' and '))} sit side by side on the colour wheel.`; }
      else { score = vibe === 'bold' ? 0.7 : 0.35; why = vibe === 'bold' ? `${cap(pops.join(' + '))}: loud on purpose.` : `${cap(pops.join(' and '))} compete for attention.`; }
    } else { score = vibe === 'bold' ? 0.55 : 0.15; why = 'A lot of colour at once.'; }
    return { score, why };
  }
  const and = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0] || '');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const uniq = (a) => [...new Set(a)];

  // Celsius → what the weather asks of you.
  function weatherNeeds(tempC, rain) {
    if (tempC == null) return { outer: false, outerWarmth: 0, hot: false, rain: !!rain, label: '' };
    if (tempC < 8) return { outer: true, outerWarmth: 3, hot: false, rain: !!rain, label: `${tempC}°C: a warm coat` };
    if (tempC < 16) return { outer: true, outerWarmth: 2, hot: false, rain: !!rain, label: `${tempC}°C: a jacket` };
    if (tempC < 20) return { outer: false, outerWarmth: 1, hot: false, rain: !!rain, label: `${tempC}°C: a light layer helps` };
    return { outer: false, outerWarmth: 0, hot: tempC >= 25, rain: !!rain, label: tempC >= 25 ? `${tempC}°C: keep it light` : '' };
  }

  const DAY = 86400000;
  /*
   * Scores one outfit (0–100) and explains it. `pieces` is { top, bottom, dress, outer, shoes }.
   */
  function scoreOutfit(pieces, occ, need, { vibe = 'classic', now = Date.now() } = {}) {
    const list = Object.values(pieces).filter(Boolean);
    const why = [], warn = [];
    // 1. dress code: every piece near the target; shoes and the outer layer count as much as the rest
    let fit = 0;
    const stiff = occ.f === 0 ? list.filter((p) => p.cat !== 'outer' && p.cat !== 'accessory' && p.f >= 2) : [];
    for (const p of list) {
      if (stiff.includes(p)) continue; // not made for moving in: counts as zero
      const d = p.f - occ.f;
      // dressing up the coat or accessories is fine (a smart coat over jeans works); dressing down isn't
      const over = p.cat === 'outer' || p.cat === 'accessory' ? 0.05 : 0.3;
      fit += d >= 0 ? Math.max(0, 1 - d * over) : Math.max(0, 1 + d * 0.55);
    }
    fit /= list.length;
    const under = list.filter((p) => p.f <= occ.f - 2);
    if (stiff.length) warn.push(`Not made for moving in: ${and(stiff.map((p) => p.name))}.`);
    else if (under.length) warn.push(`Too casual for ${occ.label.toLowerCase()}: ${and(under.map((p) => p.name))}.`);
    else if (fit > 0.85) why.push(`Right for ${occ.label.toLowerCase()} (${FORMALITY[occ.f].toLowerCase()}).`);
    // 2. weather
    let wx = 1;
    if (need.outer && !pieces.outer) { wx -= 0.6; warn.push(`${need.label}, and there’s no layer here.`); }
    else if (pieces.outer && need.outerWarmth && pieces.outer.warmth < need.outerWarmth) { wx -= 0.35 * (need.outerWarmth - pieces.outer.warmth); warn.push(`${cap(pieces.outer.name)} may not be warm enough.`); }
    else if (pieces.outer && need.outerWarmth) why.push(`${cap(pieces.outer.name)}, because ${need.label.split(': ')[0]}.`);
    // a jacket nobody needs (a blazer still makes sense for business)
    if (pieces.outer && !need.outer && !need.outerWarmth && occ.f < 4 && !(need.rain && pieces.outer.tags.includes('waterproof'))) {
      wx -= need.hot ? 0.5 : 0.15;
      if (need.hot) warn.push(`You won’t need ${pieces.outer.name} at ${need.label.split(':')[0]}.`);
    }
    if (need.hot) { const heavy = list.filter((p) => p.warmth >= 2 && p.cat !== 'shoes'); if (heavy.length) { wx -= 0.25 * heavy.length; warn.push(`${cap(heavy[0].name)} will be warm at ${need.label.split(':')[0]}.`); } }
    if (need.rain) {
      if (list.some((p) => p.tags.includes('waterproof'))) why.push('Ready for rain.');
      else if (list.some((p) => p.tags.includes('suede'))) { wx -= 0.3; warn.push('Suede and rain don’t mix.'); }
      else wx -= 0.1;
    }
    // 3. colour
    const col = colorScore(list.filter((p) => p.cat !== 'accessory').map((p) => p.color), { vibe: vibe === 'bold' || occ.bold ? 'bold' : vibe, dark: occ.dark });
    (col.score >= 0.7 ? why : warn).push(col.why);
    let rules = 0;
    if (occ.f >= 4 && pieces.shoes && ['brown', 'camel'].includes(pieces.shoes.color) && list.some((p) => p.color === 'black' && p.cat !== 'shoes')) { rules -= 0.15; warn.push('Brown shoes with black is a classic miss at this level. Black shoes would be sharper.'); }
    if (occ.id === 'formal' && list.some((p) => p.color === 'white' && (p.cat === 'dress'))) { rules -= 0.5; warn.push('White is for the couple.'); }
    // 4. vibe
    let v = 0;
    if (vibe === 'comfy' || occ.comfy) v += list.filter((p) => p.tags.includes('comfy') || p.tags.includes('stretch')).length * 0.05;
    if (vibe === 'sporty') v += list.filter((p) => p.tags.includes('sporty') || p.f <= 1).length * 0.04;
    // 5. freshness: not the same top two days running
    let fresh = 1;
    for (const p of list) if (['top', 'dress', 'bottom'].includes(p.cat) && p.wornAt && now - p.wornAt < 2 * DAY) { fresh -= 0.25; warn.push(`You wore ${p.name} ${now - p.wornAt < DAY ? 'today' : 'yesterday'}.`); }
    const long = list.filter((p) => ['top', 'dress'].includes(p.cat) && p.wornAt && now - p.wornAt > 14 * DAY);
    if (long.length && !warn.length) why.push(`${cap(long[0].name)} hasn’t been out in a while.`);
    const score = Math.round(100 * Math.max(0, fit * 0.45 + Math.max(0, wx) * 0.2 + col.score * 0.25 + Math.max(0, fresh) * 0.1 + v + rules));
    return { score, why, warn };
  }

  /*
   * The 3 best outfits you can make right now, each different enough to be a real choice.
   * opts: { occasion: text or occasion id, tempC, rain, vibe, now }
   */
  function style(wardrobe, opts = {}) {
    const items = (wardrobe || []).map(normalizeItem);
    const occ = typeof opts.occasion === 'string' && OCCASIONS[opts.occasion] ? { id: opts.occasion, ...OCCASIONS[opts.occasion] } : occasionFor(opts.occasion);
    const need = weatherNeeds(opts.tempC == null || opts.tempC === '' ? null : Math.round(Number(opts.tempC)), opts.rain);
    const by = (c) => items.filter((i) => i.cat === c);
    const bases = [];
    for (const t of by('top')) for (const b of by('bottom')) bases.push({ top: t, bottom: b });
    for (const d of by('dress')) bases.push({ dress: d });
    const shoes = by('shoes');
    const outers = [null, ...by('outer')];
    const all = [];
    for (const base of bases) for (const s of shoes.length ? shoes : [null]) for (const o of outers) {
      const pieces = { ...base, outer: o, shoes: s };
      const r = scoreOutfit(pieces, occ, need, opts);
      if (!s) { r.score -= 25; r.warn.push('Add some shoes to your wardrobe.'); }
      all.push({ pieces, ...r });
    }
    all.sort((a, b) => b.score - a.score);
    const picks = [];
    // What you actually wear; a jacket on top doesn't make it a different outfit.
    const ids = (o) => [o.pieces.dress, o.pieces.top, o.pieces.bottom, o.pieces.shoes].filter(Boolean).map((p) => p.id);
    for (const o of all) {
      if (picks.length === 3) break;
      const mine = ids(o);
      // each pick has its own top (or dress) and differs from the others in at least one more piece
      const core = (x) => (x.pieces.dress || x.pieces.top || {}).id;
      if (picks.every((p) => mine.filter((id) => !ids(p).includes(id)).length >= 2 && core(p) !== core(o))) picks.push(o);
    }
    // an accessory that suits the best outfits, if you have one
    const acc = by('accessory');
    for (const p of picks) {
      const colors = Object.values(p.pieces).filter(Boolean).map((x) => x.color);
      const a = acc.map((x) => ({ x, s: colorScore([...colors, x.color], { vibe: opts.vibe, dark: occ.dark }).score - Math.abs(x.f - occ.f) * 0.1 })).sort((m, n) => n.s - m.s)[0];
      if (a && a.s > 0.6 && occ.f >= 2) p.accessory = a.x;
      p.summary = [p.pieces.dress, p.pieces.top, p.pieces.bottom, p.pieces.outer, p.pieces.shoes, p.accessory].filter(Boolean).map((x) => x.name).join(', ');
    }
    return { occasion: occ, need, outfits: picks, considered: all.length };
  }

  // Pieces most wardrobes are built on; `missing` tries each one.
  const STAPLES = [
    { name: 'white sneakers', cat: 'shoes', color: 'white', f: 2, warmth: 1 },
    { name: 'black dress shoes', cat: 'shoes', color: 'black', f: 5, warmth: 1 },
    { name: 'brown loafers', cat: 'shoes', color: 'brown', f: 3, warmth: 1 },
    { name: 'running shoes', cat: 'shoes', color: 'grey', f: 0, warmth: 1, tags: ['sporty'] },
    { name: 'white oxford shirt', cat: 'top', color: 'white', f: 4, warmth: 1 },
    { name: 'plain white tee', cat: 'top', color: 'white', f: 2, warmth: 1 },
    { name: 'black knit', cat: 'top', color: 'black', f: 3, warmth: 2 },
    { name: 'workout top', cat: 'top', color: 'black', f: 0, warmth: 1, tags: ['sporty'] },
    { name: 'dark jeans', cat: 'bottom', color: 'denim', f: 2, warmth: 2 },
    { name: 'navy chinos', cat: 'bottom', color: 'navy', f: 3, warmth: 1 },
    { name: 'tailored grey trousers', cat: 'bottom', color: 'grey', f: 4, warmth: 2 },
    { name: 'workout shorts or leggings', cat: 'bottom', color: 'black', f: 0, warmth: 1, tags: ['sporty', 'stretch'] },
    { name: 'little black dress', cat: 'dress', color: 'black', f: 4, warmth: 1 },
    { name: 'navy blazer', cat: 'outer', color: 'navy', f: 4, warmth: 1 },
    { name: 'wool coat', cat: 'outer', color: 'camel', f: 4, warmth: 3 },
    { name: 'rain jacket', cat: 'outer', color: 'olive', f: 2, warmth: 2, tags: ['waterproof'] },
  ];
  /*
   * Which one or two pieces would most improve today's best outfit. Only suggests a piece when it
   * makes a real difference (at least 8 points), so it doesn't turn into a shopping list.
   */
  function missing(wardrobe, opts = {}) {
    const base = style(wardrobe, opts).outfits[0];
    const now = base ? base.score : 0;
    const have = new Set((wardrobe || []).map((w) => `${w.cat}:${String(w.name).toLowerCase()}`));
    return STAPLES.filter((s) => !have.has(`${s.cat}:${s.name}`)).map((s) => {
      const best = style([...(wardrobe || []), { ...s, id: 'staple' }], opts).outfits[0];
      const uses = best && Object.values(best.pieces).some((p) => p && p.id === 'staple');
      return { item: s, gain: uses ? best.score - now : 0, outfit: uses ? best.summary : '' };
    }).filter((x) => x.gain >= 8).sort((a, b) => b.gain - a.gain).slice(0, 2);
  }

  // A quick-start wardrobe to tap through on the first visit.
  const STARTER = [
    ...STAPLES.filter((s) => !['workout shorts or leggings', 'workout top', 'running shoes', 'wool coat', 'little black dress', 'tailored grey trousers', 'black dress shoes'].includes(s.name)),
    { name: 'grey hoodie', cat: 'top', color: 'grey', f: 1, warmth: 2, tags: ['comfy'] },
    { name: 'black tee', cat: 'top', color: 'black', f: 2, warmth: 1 },
    { name: 'striped shirt', cat: 'top', color: 'navy', f: 3, warmth: 1 },
    { name: 'black jeans', cat: 'bottom', color: 'black', f: 2, warmth: 2 },
    { name: 'black boots', cat: 'shoes', color: 'black', f: 3, warmth: 2 },
    { name: 'denim jacket', cat: 'outer', color: 'denim', f: 2, warmth: 2 },
    { name: 'puffer jacket', cat: 'outer', color: 'black', f: 1, warmth: 3 },
    { name: 'leather belt', cat: 'accessory', color: 'brown', f: 3, warmth: 1 },
    { name: 'silver watch', cat: 'accessory', color: 'grey', f: 3, warmth: 1 },
  ];

  const cToF = (c) => Math.round(c * 9 / 5 + 32);
  const fToC = (f) => Math.round((f - 32) * 5 / 9);

  const api = { FORMALITY, CATS, COLORS, OCCASIONS, VIBES, STAPLES, STARTER, occasionFor, normalizeItem, colorScore, weatherNeeds, scoreOutfit, style, missing, cToF, fToC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Stylist = api;
})(typeof window !== 'undefined' ? window : globalThis);
