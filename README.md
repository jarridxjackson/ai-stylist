# 👗 Stylist

**[▶ Try it live](https://jarridxjackson.github.io/ai-stylist/)** · works on its own · plugs into STOIT

![CI](https://github.com/jarridxjackson/ai-stylist/actions/workflows/ci.yml/badge.svg)

<!-- Add a screenshot or a short GIF here: it's the first thing people look at. -->

<!-- PITCH:START (generated from stoit.json by `npm run readme`; edit stoit.json instead) -->
## The problem: 🫥 The Closet Stare

You're standing in front of a full closet, late again, holding the same three things. It's cold, you have a client pitch, and nothing feels right.

## Five whys

1. **Why should I use this?** Tell it where you're going and the weather, and it gives you three outfits from your own clothes, with the reasons behind each.
2. **Why does that matter?** Every morning decision costs focus you'd rather spend on the pitch, the date or the work.
3. **Why is it still a problem?** Style apps show you clothes to buy. You need help with the clothes you already have.
4. **Why can't I just wing it?** Winging it means the same outfit on repeat, the wrong layer for the weather, or showing up underdressed.
5. **Why now?** Add the ten things you wear most. Tomorrow morning is already decided.

## What it saves

About **20 hours** and **$150** a month. About 10 minutes a day spent deciding, cut to under 1 (roughly 20 hours a year), plus one or two impulse buys a year you skip because it tells you exactly which piece is missing.

## How to use it best

1. Tap the clothes you own (or add your own)
2. Say where you're going and how warm it is
3. Pick one of three outfits and hit Wear this

**Best for:** Anyone who dresses for different rooms: work, clients, dates, the gym

<!-- PITCH:END -->

## Use it with STOIT

This is a [STOIT tool](https://github.com/jarridxjackson/stoit-sdk). Use it on its own, or let STOIT open it for the right task. When a task on your STOIT Track matches (see `helpsWith` in [`stoit.json`](stoit.json)), STOIT suggests it and opens it with the task, its steps and the calendar event it leads up to. When you're done, the result goes back to STOIT and the task is completed.

## Privacy

Everything stays in your browser (local storage). Nothing is uploaded. When STOIT opens this tool, the task arrives in the URL's `#fragment`, which browsers never send to servers.

## Develop

No build step and no dependencies: plain HTML, CSS and JavaScript.

```sh
npm run serve   # http://localhost:8080
npm test        # unit tests + the publish check (Node 18+)
```

## License

MIT
