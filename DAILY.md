# One app a day

A checklist for shipping a STOIT tool in a day. Keep each tool to **one painful problem, solved well**.

## Morning: pick the villain (30 min)
- [ ] One painful, specific problem you (or people you know) hit this week.
- [ ] Name the villain and write the scene in `stoit.json`. If you can't make the pain vivid, pick another problem.
- [ ] Write the five whys, each a level deeper, and the monthly savings with how you worked them out.
- [ ] Pick the STOIT tasks it helps with (`helpsWith.types` and `keywords`).

## Build (4–5 h, timeboxed)
- [ ] `npm run new -- <id> "<Name>" <emoji>`
- [ ] Build the smallest version that beats the villain. Keep the STOIT banner and `Stoit.complete(...)`.
- [ ] Works on a phone (320px wide) and with a keyboard. Light and dark mode.
- [ ] Data stays on the device, or `privacy` says exactly where it goes.
- [ ] **No API keys in the code.** If it needs AI or a paid API, use a small server that holds the key, or let people paste their own key.
- [ ] Add a test for the core logic.

## Ship (1 h)
- [ ] `npm run readme && npm test`: green.
- [ ] Add a screenshot or GIF to the README.
- [ ] Push to `main`; check the live link on your phone.
- [ ] Add it to your profile README and to STOIT's tool list.

## Tell people (30 min)
- [ ] A 20–30 second clip: the villain, the tool beating it, the link.
- [ ] Post it, and pin the best tools of the week.

## Weekly
- [ ] Write up what you learned. Keep the best tools improving; archive the ones nobody used.
