# verify-in-browser profile

Static, single-page site. No build step, no backend, no auth — most of this
skill's machinery (sessions, oracles, gates) does not apply here, and saying so
explicitly is what keeps the next run from going looking for it.

## app

- start: `python3 -m http.server 8000` in the repo root — serves the site at
  http://localhost:8000
- there is no build: the pages are hand-written single-file HTML, so a reload
  always reflects what is on disk
- ready: `curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/index.html` → 200
- check the port before starting another one; a server from an earlier session
  is often still up: `lsof -nP -iTCP:8000 -sTCP:LISTEN`

## session

- none. Every surface is public — no login, no cookie, no token.

## oracle

- n/a, there is no logged-in user.

## gates

- none in the app. The only conditional rendering is
  `prefers-reduced-motion`, which gates every animation: the hero character
  splitter, the scroll reveals and the WebGL shader all sit behind
  `@media (prefers-reduced-motion: no-preference)` and an early `return` in the
  script. Playwright's `reducedMotion: 'reduce'` therefore changes the DOM, not
  just the motion — see artefacts.

## surfaces

- `/index.html` — the only page. The former `v2.html` draft was promoted to it;
  `v2.html` and `simple.html` were deleted (both recoverable from git history).
  Eight sections, `s1`-`s8`: hero, systems, proof, velocity, ai, people,
  growth, contact.

There is no longer a control surface. This is a single-page site, so a
regression has nothing to be compared against within the repo — diff against
`git show HEAD:index.html` instead.

## analytics

`index.html` loads umami and reports twelve events. They are easy to drop
silently when editing the script, so check them after any change to it:

- `scroll-s1` … `scroll-s8` — one per section, fired once, from the rail spy
- `hero-play` — a real hover or tap on the headline, **not** the unprompted
  mobile play, which would otherwise report on every page load
- `rail-nav` — a click on the section rail
- `contact-open`, `contact-sent`, `contact-bot` — the honeypot path fires
  `contact-bot` and must never report as a send

To observe them without a live umami, stub it before the page script runs:

```js
await p.addInitScript(() => {
   window.__sent = [];
   window.umami = { track: (n) => window.__sent.push(n) };
});
```

## layout invariants worth re-checking

- `--max-width: 900px` on `:root` with `padding: 12vh 2rem` gives an 836px
  content column. It is sized to the hero headline, which measures ~787px at
  its capped font size (`clamp(3rem, 8vw, 7rem)` → 112px). Nothing should
  extend further right than the h1 does.
- The logo row is tuned to land on that same right edge at ≥1440px. Below the
  font cap the headline scales with `8vw` while the logos stay fixed, so the
  logos sit slightly wider than the headline there — still inside the column.
- Run `node .claude/responsive-audit.js` (needs `NODE_PATH` pointing at a
  playwright install) to check all of it: it flags horizontal scroll, anything
  past the viewport, and anything escaping the content column, across eight
  viewports from 375 to 1920.

## hero motion, and how to observe it

The headline pop is reachable three ways, and a check that only covers hover
misses two of them:

- **hover** (`pointerenter`) — desktop only
- **click / tap** — every device, and the only replay a phone gets
- **unprompted, touch only** — gated on `(hover: none)`, fired on the very beat
  the last letter lands (`lastLetterAt = INTRO_DELAY + (chars.length - 1) *
  INTRO_STEP`) so the "w" appearing and the word stretching are the same
  moment, not a sequence. Measured delta: 0ms on both pages. It is derived from
  the intro's own constants, so changing the letter stagger moves the pop with
  it — do not replace it with a hand-tuned delay.

To observe it, watch the `grown` class on `#hero-title` with a MutationObserver
and record `performance.now()`. Attach it on `DOMContentLoaded` — Playwright's
`addInitScript` runs before the document exists, so `getElementById` there
returns null, the observer silently attaches to nothing, and every case reports
"no animation fired", including the ones that should.

## artefacts

Environment failures seen here that imitate real bugs:

- **Headless Chrome (`--headless`) will not render narrower than ~500px.**
  `--window-size=390` and `--window-size=500` both produce a 485px viewport, so
  a "mobile" screenshot is silently a 485px one and content appears to overflow
  when it does not. Use Playwright viewports for anything below 500px.
- **CSS transitions, CSS animations and IntersectionObserver callbacks do not
  tick** under `--headless ... --virtual-time-budget --dump-dom`. Zero of 17
  reveal elements ever received their `.in` class, and animated properties read
  as their start value. A screenshot taken that way shows animated content as
  invisible or unmoved — not a bug in the page. Either use Playwright, or drive
  the timeline directly: `el.getAnimations()[0].currentTime = ms` forces a style
  update and is the reliable way to sample a curve.
- **`reducedMotion: 'reduce'` changes the DOM here**, because the hero's
  per-character spans are built in JS after the reduced-motion early return.
  Selectors like `#hero-title .w` return nothing under it; fall back to
  `#hero-title .line > span`.
- Counting distinct `getBoundingClientRect().top` values is **not** a row count
  for the logo strip: the row is `align-items: center` with logos of differing
  heights, so four logos on one line report four different tops. Band them by
  vertical centre instead.
