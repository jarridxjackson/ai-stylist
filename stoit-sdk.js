/*!
 * STOIT SDK v1 — connect any app to STOIT, or run it on its own.
 * https://github.com/jarridxjackson/stoit-sdk · MIT License
 *
 * One file, no dependencies. Works as a <script> (window.Stoit) or a CommonJS module.
 *
 * In a tool (the app STOIT opens):
 *   const ctx = Stoit.context();     // the task STOIT sent, or null when used on its own
 *   Stoit.complete({ summary: 'Navy blazer outfit', data: {...} });
 *
 * In STOIT (the platform that opens tools):
 *   const url = Stoit.launchUrl(manifest, task, { returnTo: location.href });
 *   Stoit.listen((result, meta) => { ... }, { origins: [new URL(manifest.url).origin] });
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Stoit = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = 1;
  const TASK_TYPES = ['idea', 'goal', 'habit', 'action', 'timeblock', 'content'];
  const INPUTS = ['task', 'event', 'steps', 'notes', 'location', 'weather'];
  const OUTPUT_TYPES = ['text', 'choice', 'list', 'file', 'link', 'number', 'checklist'];
  const MAX_PAYLOAD = 16 * 1024; // launch and result payloads stay small; big data belongs in the tool

  // ------------------------------------------------------------------ helpers
  const str = (v, max) => (v == null ? '' : String(v)).slice(0, max);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isHttpUrl = (v) => { try { const u = new URL(v); return u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname)); } catch (_) { return false; } };
  const originOf = (u) => { try { return new URL(u).origin; } catch (_) { return null; } };
  const words = (s) => String(s || '').toLowerCase().match(/[a-z0-9]+/g) || [];

  // Unicode-safe base64url, so titles with emoji and accents survive the URL.
  function encode(obj) {
    const json = JSON.stringify(obj);
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json) : Buffer.from(json, 'utf8');
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(s) {
    const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    const bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : Buffer.from(bytes).toString('utf8');
    return JSON.parse(json);
  }
  function newSession() {
    const c = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(12)) : Array.from({ length: 12 }, () => Math.floor(Math.random() * 256));
    return Array.from(c, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ------------------------------------------------------------------ manifest (stoit.json)
  /*
   * Checks a tool's stoit.json and returns { ok, errors, warnings, manifest } where `manifest`
   * is a cleaned copy with defaults filled in. Errors block listing; warnings are advice.
   */
  function validateManifest(m) {
    const errors = [];
    const warnings = [];
    if (!isObj(m)) return { ok: false, errors: ['stoit.json must be a JSON object'], warnings, manifest: null };
    if (String(m.stoit) !== String(VERSION)) errors.push(`"stoit" must be "${VERSION}" (the spec version)`);
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(m.id || '')) errors.push('"id" must be 2–41 lowercase letters, digits or dashes, e.g. "ai-stylist"');
    if (!str(m.name, 60).trim()) errors.push('"name" is required');
    if (!str(m.tagline, 140).trim()) errors.push('"tagline" is required: one line on the painful problem it solves');
    if (m.url !== undefined && !isHttpUrl(m.url)) errors.push('"url" must be an https:// address (http is only allowed for localhost)');
    if (m.url === undefined) warnings.push('"url" is missing: STOIT can’t open the tool until it’s published (e.g. on GitHub Pages)');

    const p = isObj(m.pitch) ? m.pitch : {};
    const v = isObj(p.villain) ? p.villain : {};
    if (!str(v.name, 60).trim() || !str(v.scene, 320).trim()) errors.push('"pitch.villain" needs a "name" and a "scene": the painful problem, told in a sentence or two');
    const whys = Array.isArray(p.whys) ? p.whys.map((w) => (typeof w === 'string' ? { a: w } : isObj(w) ? w : {})) : [];
    if (whys.length !== 5 || whys.some((w) => !str(w.a, 280).trim())) errors.push('"pitch.whys" must have exactly five reasons');
    const save = isObj(p.save) ? p.save : {};
    const hours = Number(save.hours) || 0, money = Number(save.money) || 0;
    if (hours <= 0 && money <= 0) errors.push('"pitch.save" needs "hours" and/or "money" saved per month');
    if (!str(save.basis, 200).trim()) warnings.push('"pitch.save.basis" is empty: say how you worked the savings out, so people trust the numbers');
    const howTo = Array.isArray(p.howTo) ? p.howTo.map((s) => str(s, 160)).filter(Boolean) : [];
    if (howTo.length < 2) warnings.push('"pitch.howTo" should list at least two steps');

    const hw = isObj(m.helpsWith) ? m.helpsWith : {};
    const types = (Array.isArray(hw.types) ? hw.types : []).filter((t) => TASK_TYPES.includes(t));
    const keywords = (Array.isArray(hw.keywords) ? hw.keywords : []).map((k) => str(k, 40).toLowerCase().trim()).filter(Boolean);
    if (!keywords.length) warnings.push('"helpsWith.keywords" is empty: STOIT uses them to suggest this tool for matching tasks');
    const inputs = (Array.isArray(m.inputs) ? m.inputs : ['task']).filter((i) => INPUTS.includes(i));
    const outputs = (Array.isArray(m.outputs) ? m.outputs : []).filter(isObj).map((o) => ({ type: OUTPUT_TYPES.includes(o.type) ? o.type : 'text', label: str(o.label, 60) || 'Result' }));
    if (!str(m.privacy, 280).trim()) warnings.push('"privacy" is empty: say where people’s data is kept');

    const manifest = {
      stoit: String(VERSION), id: m.id, name: str(m.name, 60), icon: str(m.icon, 8) || '🧩', tagline: str(m.tagline, 140),
      url: m.url || null, version: str(m.version, 20) || '0.1.0', author: str(m.author, 80), repo: m.repo && isHttpUrl(m.repo) ? m.repo : null,
      pitch: {
        villain: { name: str(v.name, 60), emoji: str(v.emoji, 8) || '👾', scene: str(v.scene, 320) },
        whys: whys.slice(0, 5).map((w) => ({ q: str(w.q, 90), a: str(w.a, 280) })),
        save: { hours, money, basis: str(save.basis, 200) },
        howTo, bestFor: str(p.bestFor, 140),
      },
      helpsWith: { types, keywords },
      inputs, outputs, privacy: str(m.privacy, 280),
    };
    return { ok: errors.length === 0, errors, warnings, manifest };
  }

  /*
   * How well a tool fits a task (0–1). Keywords found in the task's title, tags, steps or description
   * count most; a matching task type adds a little. STOIT suggests tools scoring 0.5 or more.
   */
  function matches(manifest, task) {
    if (!manifest || !task) return 0;
    const hw = manifest.helpsWith || {};
    const text = new Set(words([task.title, (task.tags || []).join(' '), (task.steps || []).map((s) => (typeof s === 'string' ? s : s.text)).join(' '), task.description].join(' ')));
    // A keyword matches a whole word, or the start of one ("dress" matches "dressed").
    const hit = (hw.keywords || []).filter((k) => words(k).every((w) => text.has(w) || [...text].some((t) => t.startsWith(w) && t.length - w.length <= 3)));
    // One clear keyword is a strong signal; each extra one adds a little more.
    const kw = hit.length ? Math.min(1, 0.75 + 0.25 * (hit.length - 1)) : 0;
    const type = hw.types && hw.types.length ? (hw.types.includes(task.type) ? 1 : 0) : 0.5;
    return Math.round((kw * 0.8 + type * 0.2) * 100) / 100;
  }

  // ------------------------------------------------------------------ launch (STOIT → tool)
  function cleanTask(t) {
    t = isObj(t) ? t : {};
    return {
      id: str(t.id, 80), title: str(t.title, 140), type: TASK_TYPES.includes(t.type) ? t.type : 'action',
      start: t.start ? str(t.start, 40) : null, end: t.end ? str(t.end, 40) : null,
      minutes: Number.isFinite(Number(t.minutes)) && t.minutes ? Math.round(Number(t.minutes)) : null,
      steps: (Array.isArray(t.steps) ? t.steps : []).slice(0, 20).map((s) => str(typeof s === 'string' ? s : s && s.text, 160)),
      tags: (Array.isArray(t.tags) ? t.tags : []).slice(0, 12).map((s) => str(s, 40)),
    };
  }
  function cleanEvent(e) {
    if (!isObj(e)) return null;
    return { title: str(e.title, 140), start: e.start ? str(e.start, 40) : null, end: e.end ? str(e.end, 40) : null, location: str(e.location, 140) || null, notes: str(e.notes, 400) || null };
  }
  /*
   * The URL STOIT opens. The task travels in the #fragment, which browsers never send to servers,
   * so a tool hosted anywhere never logs what you're working on.
   */
  function launchUrl(manifest, task, opts = {}) {
    if (!manifest || !isHttpUrl(manifest.url)) throw new Error('This tool has no published https:// url yet');
    const payload = {
      v: VERSION, tool: manifest.id, session: opts.session || newSession(),
      task: cleanTask(task), event: cleanEvent(opts.event), notes: str(opts.notes, 400) || null,
      returnTo: opts.returnTo && isHttpUrl(opts.returnTo) ? opts.returnTo : null,
      from: opts.from ? str(opts.from, 60) : 'STOIT',
    };
    const enc = encode(payload);
    if (enc.length > MAX_PAYLOAD) throw new Error('Launch payload too large');
    const u = new URL(manifest.url);
    u.hash = 'stoit=' + enc;
    return u.href;
  }

  // ------------------------------------------------------------------ in the tool
  let cached;
  // The launch payload, or null when the tool was opened on its own.
  function context(loc) {
    if (loc === undefined && cached !== undefined) return cached;
    const hash = String((loc || (typeof location !== 'undefined' ? location : {})).hash || '');
    const m = /(?:^#|&)stoit=([A-Za-z0-9_-]+)/.exec(hash);
    let ctx = null;
    if (m && m[1].length <= MAX_PAYLOAD) {
      try {
        const p = decode(m[1]);
        if (p && p.v === VERSION && typeof p.session === 'string') {
          ctx = { v: p.v, tool: str(p.tool, 41), session: str(p.session, 64), task: cleanTask(p.task), event: cleanEvent(p.event), notes: str(p.notes, 400) || null, returnTo: p.returnTo && isHttpUrl(p.returnTo) ? p.returnTo : null, from: str(p.from, 60) || 'STOIT' };
        }
      } catch (_) { ctx = null; }
    }
    if (loc === undefined) cached = ctx;
    return ctx;
  }
  const connected = () => !!context();

  /*
   * Sends the result back to STOIT. Opened in a popup or iframe → postMessage to STOIT's origin only.
   * Opened in the same tab → go back to returnTo with the result in the #fragment.
   * Returns how it was delivered ('message', 'redirect') or 'none' when there's no STOIT to tell.
   */
  function complete(result, env) {
    return send('result', result, env);
  }
  function progress(update, env) {
    return send('progress', update, env, true);
  }
  function send(kind, body, env, noRedirect) {
    const w = env || (typeof window !== 'undefined' ? window : null);
    const ctx = env && env.ctx !== undefined ? env.ctx : context();
    if (!ctx || !w) return 'none';
    const res = cleanResult(body);
    const msg = { type: 'stoit:' + kind, v: VERSION, session: ctx.session, tool: ctx.tool, result: res };
    const target = ctx.returnTo ? originOf(ctx.returnTo) : null;
    const peer = w.opener && !w.opener.closed ? w.opener : w.parent && w.parent !== w ? w.parent : null;
    if (peer && target) { peer.postMessage(msg, target); return 'message'; }
    if (!noRedirect && ctx.returnTo) {
      const u = new URL(ctx.returnTo);
      u.hash = 'stoit-result=' + encode(msg);
      w.location.assign(u.href);
      return 'redirect';
    }
    return 'none';
  }
  function cleanResult(r) {
    r = isObj(r) ? r : { summary: r };
    const out = { summary: str(r.summary, 280), done: r.done !== false };
    if (r.data !== undefined) {
      const enc = JSON.stringify(r.data);
      if (enc && enc.length <= MAX_PAYLOAD / 2) out.data = JSON.parse(enc);
    }
    if (r.link && isHttpUrl(r.link)) out.link = r.link;
    if (Number.isFinite(Number(r.minutes)) && r.minutes) out.minutes = Math.round(Number(r.minutes));
    return out;
  }

  // ------------------------------------------------------------------ in STOIT
  /*
   * Listens for results from tools opened in a popup or iframe. Only messages from `origins`
   * (the tools' own origins) and, when given, known `sessions` are accepted.
   * Returns a function that stops listening.
   */
  function listen(handler, { origins = [], sessions = null, target } = {}) {
    const w = target || (typeof window !== 'undefined' ? window : null);
    if (!w) return () => {};
    const allowed = new Set(origins.filter(Boolean));
    const on = (e) => {
      const d = e.data;
      if (!allowed.has(e.origin) || !isObj(d) || d.v !== VERSION || !/^stoit:(result|progress)$/.test(d.type)) return;
      if (sessions && !sessions.has(d.session)) return;
      handler(cleanResult(d.result), { kind: d.type.slice(6), session: str(d.session, 64), tool: str(d.tool, 41), origin: e.origin });
    };
    w.addEventListener('message', on);
    return () => w.removeEventListener('message', on);
  }
  // Reads a result a tool sent back by redirect (#stoit-result=…), or null.
  function readResult(loc) {
    const hash = String((loc || (typeof location !== 'undefined' ? location : {})).hash || '');
    const m = /(?:^#|&)stoit-result=([A-Za-z0-9_-]+)/.exec(hash);
    if (!m || m[1].length > MAX_PAYLOAD) return null;
    try {
      const d = decode(m[1]);
      if (!isObj(d) || d.v !== VERSION || d.type !== 'stoit:result') return null;
      return { result: cleanResult(d.result), session: str(d.session, 64), tool: str(d.tool, 41) };
    } catch (_) { return null; }
  }

  return { VERSION, TASK_TYPES, INPUTS, OUTPUT_TYPES, validateManifest, matches, launchUrl, context, connected, complete, progress, listen, readResult, encode, decode };
});
