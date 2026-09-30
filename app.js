/*
 * Stylist: the screen. The choosing happens in stylist.js; this file keeps your wardrobe,
 * shows the three looks, and tells STOIT which one you wore.
 */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const S = window.Stylist;
  const KEY = 'ai-stylist-v1';

  // ---- storage: everything stays in this browser
  const fresh = () => ({ wardrobe: [], history: [], unit: /^en-US$/i.test(navigator.language || '') ? 'F' : 'C', tempC: 20, vibe: 'classic' });
  const load = () => { try { return { ...fresh(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (_) { return fresh(); } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* private mode */ } };
  const state = load();
  state.wardrobe = (Array.isArray(state.wardrobe) ? state.wardrobe : []).map(S.normalizeItem);
  if (!Array.isArray(state.history)) state.history = [];

  // ---- the manifest fills in the name, icon and tagline, so they're written once
  fetch('stoit.json').then((r) => r.json()).then((m) => {
    $('#name').textContent = m.name;
    $('#logo').textContent = m.icon;
    $('#tagline').textContent = m.tagline;
    if (!ctx) document.title = m.name;
  }).catch(() => {});

  // ---- STOIT: what task opened us (null when used on its own)
  const ctx = window.Stoit ? Stoit.context() : null;
  const started = Date.now();
  if (ctx) {
    $('#stoit-bar').hidden = false;
    $('#stoit-from').textContent = ctx.from;
    $('#stoit-task').textContent = ctx.task.title;
    const when = [ctx.event && ctx.event.title ? `before ${ctx.event.title}${ctx.event.start ? ' · ' + time(ctx.event.start) : ''}` : '', ctx.task.start ? time(ctx.task.start) : ''].filter(Boolean).join(' · ');
    $('#stoit-when').textContent = when;
    if (ctx.task.minutes) { $('#stoit-clock').hidden = false; tick(); setInterval(tick, 1000); }
    document.title = `${ctx.task.title} · ${document.title}`;
  }
  function tick() {
    const left = ctx.task.minutes * 60 - Math.floor((Date.now() - started) / 1000);
    const a = Math.abs(left);
    $('#stoit-clock').textContent = `${left < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
    $('#stoit-clock').classList.toggle('over', left < 0);
  }
  function time(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // ---- small DOM helpers (text only: nothing typed in is ever treated as HTML)
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : String(c));
    return n;
  }
  const swatch = (color) => el('span', { class: 'sw', style: `--c:${S.COLORS[color].hex}`, title: color, 'aria-hidden': 'true' });

  // ─── where you're going ───────────────────────────────────────────────────
  let occPick = null; // an occasion chip you tapped overrides what the words say
  const occInput = $('#occasion');
  occInput.value = ctx ? [ctx.task.title, ctx.event && ctx.event.title].filter(Boolean).join(' · ') : '';
  for (const [id, o] of Object.entries(S.OCCASIONS)) {
    $('#occ-chips').append(el('button', { type: 'button', class: 'chip', 'data-occ': id, 'aria-pressed': 'false', onclick: () => { occPick = occPick === id ? null : id; render(); } }, `${o.emoji} ${o.label}`));
  }
  occInput.addEventListener('input', () => { occPick = null; render(); });
  for (const [id, label] of Object.entries(S.VIBES)) {
    $('#vibes').append(el('button', { type: 'button', class: 'chip', role: 'radio', 'data-vibe': id, 'aria-checked': 'false', onclick: () => { state.vibe = id; save(); render(); } }, label));
  }
  // temperature: stored in °C, shown in your unit
  const tempInput = $('#temp');
  const shownTemp = () => (state.unit === 'F' ? S.cToF(state.tempC) : state.tempC);
  tempInput.value = shownTemp();
  $('#unit').textContent = '°' + state.unit;
  tempInput.addEventListener('input', () => {
    const v = Number(tempInput.value);
    if (tempInput.value === '' || !Number.isFinite(v)) return;
    state.tempC = state.unit === 'F' ? S.fToC(v) : Math.round(v);
    save(); render();
  });
  $('#unit').addEventListener('click', () => { state.unit = state.unit === 'F' ? 'C' : 'F'; $('#unit').textContent = '°' + state.unit; tempInput.value = shownTemp(); save(); });
  $('#rain').addEventListener('change', render);

  const opts = () => ({ occasion: occPick || occInput.value, tempC: state.tempC, rain: $('#rain').checked, vibe: state.vibe });

  // ─── the looks ────────────────────────────────────────────────────────────
  function render() {
    const o = opts();
    const res = S.style(state.wardrobe, o);
    const occ = res.occasion;
    document.querySelectorAll('[data-occ]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.occ === (occPick || (occ.matched ? occ.id : '')))));
    document.querySelectorAll('[data-vibe]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.vibe === state.vibe)));
    $('#code').replaceChildren(
      el('b', {}, `${occ.emoji} ${occ.label} · ${S.FORMALITY[occ.f]}`),
      occPick ? '' : occ.matched ? '' : el('span', { class: 'muted' }, ' (a guess: tap one above if it’s something else)'),
      el('br'), el('span', { class: 'muted' }, occ.tip),
    );
    const looks = $('#looks');
    looks.replaceChildren();
    if (!state.wardrobe.length) {
      looks.append(el('div', { class: 'card empty' }, el('b', {}, 'Add a few clothes and your looks show up here.'), el('p', { class: 'muted' }, 'Start with the ten things you wear most.')));
    } else if (!res.outfits.length) {
      const has = (c) => state.wardrobe.some((w) => w.cat === c);
      const need = !has('top') && !has('dress') ? 'a top or a dress' : !has('bottom') && !has('dress') ? 'something for your legs' : 'shoes';
      looks.append(el('div', { class: 'card empty' }, el('b', {}, `Add ${need} to make a full outfit.`)));
    }
    res.outfits.forEach((look, i) => looks.append(lookCard(look, i)));
    // what would help most (only when it makes a real difference)
    const add = state.wardrobe.length >= 3 ? S.missing(state.wardrobe, o) : [];
    $('#add-next').hidden = !add.length;
    $('#add-list').replaceChildren(...add.map((m) => el('li', {}, swatch(m.item.color), el('div', {},
      el('b', {}, m.item.name.charAt(0).toUpperCase() + m.item.name.slice(1)), el('small', { class: 'muted' }, `Would make today ${m.gain} points better: ${m.outfit}.`)),
    el('button', { type: 'button', class: 'btn', onclick: () => { addItems([m.item]); toast(`Added ${m.item.name}. Only if you own it!`); } }, 'I have one'))));
    renderWardrobe();
    renderHistory();
  }
  function lookCard(look, i) {
    const pieces = [look.pieces.dress, look.pieces.top, look.pieces.bottom, look.pieces.outer, look.pieces.shoes, look.accessory].filter(Boolean);
    return el('article', { class: `card look${i === 0 ? ' best' : ''}` },
      el('header', {}, el('b', {}, i === 0 ? '⭐ Best match' : `Option ${i + 1}`), el('span', { class: 'score', title: 'How well it fits, out of 100' }, String(look.score))),
      el('div', { class: 'strip', 'aria-hidden': 'true' }, pieces.map((p) => el('span', { style: `--c:${S.COLORS[p.color].hex}` }))),
      el('ul', { class: 'pieces' }, pieces.map((p) => el('li', {}, swatch(p.color), el('span', {}, `${S.CATS[p.cat].icon} ${p.name}`)))),
      el('ul', { class: 'why' }, look.why.map((w) => el('li', { class: 'good' }, w)), look.warn.map((w) => el('li', { class: 'warn' }, w))),
      el('div', { class: 'actions' }, el('button', { type: 'button', class: `btn${i === 0 ? ' primary' : ''}`, onclick: () => wear(look) }, ctx ? '✓ Wear this: send to STOIT' : '✓ Wear this')),
    );
  }
  function wear(look) {
    const now = Date.now();
    const ids = Object.values(look.pieces).filter(Boolean).map((p) => p.id);
    for (const w of state.wardrobe) if (ids.includes(w.id)) w.wornAt = now;
    const occ = S.style(state.wardrobe, opts()).occasion;
    state.history.unshift({ summary: look.summary, occasion: `${occ.emoji} ${occ.label}`, at: now });
    state.history.length = Math.min(state.history.length, 20);
    save();
    render();
    const how = window.Stoit ? Stoit.complete({ summary: `Outfit: ${look.summary}`, data: { outfit: look.summary, occasion: occ.id, score: look.score }, minutes: Math.round((now - started) / 60000) }) : 'none';
    toast(how === 'message' ? '✓ Sent to STOIT. You can close this tab.' : how === 'redirect' ? '✓ Taking you back to STOIT…' : '✓ Saved. Have a great day.');
    if (how === 'message') setTimeout(() => { try { window.close(); } catch (_) { /* not ours to close */ } }, 900);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── wardrobe ─────────────────────────────────────────────────────────────
  function addItems(items) {
    for (const it of items) state.wardrobe.push(S.normalizeItem({ ...it, id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` }));
    save();
    render();
  }
  function renderWardrobe() {
    const box = $('#wardrobe');
    box.replaceChildren();
    $('#count').textContent = state.wardrobe.length ? `· ${state.wardrobe.length} pieces` : '';
    for (const [cat, c] of Object.entries(S.CATS)) {
      const list = state.wardrobe.filter((w) => w.cat === cat);
      if (!list.length) continue;
      box.append(el('h3', {}, `${c.icon} ${c.label}`), el('ul', { class: 'items' }, list.map((w) => el('li', {}, swatch(w.color), el('span', {}, w.name),
        el('small', { class: 'muted' }, S.FORMALITY[w.f]),
        el('button', { type: 'button', class: 'x', 'aria-label': `Remove ${w.name}`, onclick: () => { state.wardrobe = state.wardrobe.filter((x) => x !== w); save(); render(); } }, '✕')))));
    }
    // the quick start shows until you have a few pieces
    $('#starter').hidden = state.wardrobe.length >= 3;
  }
  // quick start grid
  const picked = new Set();
  S.STARTER.forEach((it, i) => $('#starter-grid').append(el('button', { type: 'button', class: 'pick', 'aria-pressed': 'false', onclick: (e) => {
    const b = e.currentTarget;
    if (picked.has(i)) picked.delete(i); else picked.add(i);
    b.setAttribute('aria-pressed', String(picked.has(i)));
    $('#starter-go').disabled = !picked.size;
    $('#starter-go').textContent = `Add ${picked.size} piece${picked.size === 1 ? '' : 's'}`;
  } }, swatch(it.color), el('span', {}, it.name))));
  $('#starter-go').addEventListener('click', () => { addItems([...picked].map((i) => S.STARTER[i])); toast(`👗 Added ${picked.size} pieces.`); picked.clear(); });
  // add-a-piece form
  const form = $('#add-form');
  $('#f-cat').replaceChildren(...Object.entries(S.CATS).map(([k, c]) => el('option', { value: k }, `${c.icon} ${c.label}`)));
  $('#f-f').replaceChildren(...S.FORMALITY.map((l, i) => el('option', { value: String(i), selected: i === 2 }, l)));
  $('#f-color').append(...Object.entries(S.COLORS).map(([name, c], i) => el('label', { class: 'swatch', title: name },
    el('input', { type: 'radio', name: 'color', value: name, checked: i === 0, 'aria-label': name }), el('span', { style: `--c:${c.hex}` }))));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(form);
    addItems([{ name: f.get('name').trim(), cat: f.get('cat'), f: f.get('f'), warmth: f.get('warmth'), color: f.get('color'), tags: f.getAll('tags') }]);
    toast(`Added ${f.get('name').trim()}.`);
    form.reset();
    form.name.focus();
  });

  function renderHistory() {
    $('#history-card').hidden = !state.history.length;
    $('#history').replaceChildren(...state.history.map((h) => el('li', {}, el('b', {}, h.summary), el('small', {}, `${h.occasion || ''} · ${new Date(h.at).toLocaleDateString()}`))));
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
  }

  render();
})();
