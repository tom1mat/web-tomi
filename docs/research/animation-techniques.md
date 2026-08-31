# Animation techniques research — dark typographic portfolio landing page

Research date: 2026-08-31. All support/version claims verified against primary sources on this date unless marked UNVERIFIED.

Candidates under evaluation:

- **A** — pure CSS + tiny vanilla JS, no libraries
- **B** — zero-dependency showpiece with hand-rolled WebGL
- **C** — GSAP + ScrollTrigger + Lenis via CDN

---

## 1. CSS scroll-driven animations

### Browser support (as of Aug 2026)

| Browser | Support | Source |
|---|---|---|
| Chrome / Edge | 115+ (shipped July 2023) | caniuse (data: July 2026) |
| Opera | 101+ | caniuse |
| Safari macOS | **26.0+ — shipped** (announced at WWDC25, released fall 2025) | caniuse; WebKit blog "WebKit Features in Safari 26.0" |
| Safari iOS | 26.0+ | caniuse |
| Firefox stable | **Not shipped.** Current stable is Firefox 154 (155 beta, 156 Nightly). Behind `layout.css.scroll-driven-animations.enabled` flag; enabled by default only in Nightly since 136. caniuse/BCD list **Firefox 157** as the first supporting release — i.e. a *future* release (~late 2026), not yet shipped. | MDN Firefox releases index; MDN Experimental features; caniuse |

- caniuse `animation-timeline: view()`: https://caniuse.com/mdn-css_properties_animation-timeline_view (Chrome 115+, Edge 115+, Firefox 157+, Safari 26+, ~85.4% global, data July 2026)
- caniuse `animation-timeline: scroll()`: https://caniuse.com/mdn-css_properties_animation-timeline_scroll (same versions)
- MDN `animation-timeline` (marked "Limited availability", not Baseline): https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
- Safari 26 shipping: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ and WebKit's own how-to guide https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/
- Firefox flag status: https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Experimental_features (flag `layout.css.scroll-driven-animations.enabled`; Nightly-only default since 136)
- Firefox current stable = 154: https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases

**Bottom line: progressive enhancement is mandatory.** Chrome/Edge/Safari get the CSS-native path (~85% of users); Firefox needs the fallback until ~157 ships.

### @supports guard

`@supports` accepts the function-value form. Guard on the exact feature you use:

```css
/* Fallback baseline first (also serves Firefox stable) */
.line { opacity: 1; }

@supports (animation-timeline: view()) {
  .line {
    animation: reveal linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 40%;
  }
}
```

MDN's own guide uses the inverse form for messaging: `@supports not (scroll-timeline: --main-timeline) { … }` (https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations). JS-side detection: `CSS.supports('animation-timeline: view()')`.

Gotcha (MDN): `animation-timeline` is **reset by the `animation` shorthand** — always declare it *after* `animation`.

### Core patterns (MDN + Chrome docs)

Source: https://developer.chrome.com/docs/css-ui/scroll-driven-animations and https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations

**View-timeline reveal (scrubbed by element visibility):**

```css
@keyframes reveal {
  from { opacity: 0; transform: translateY(2rem); }
  to   { opacity: 1; transform: none; }
}
.reveal {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 25% cover 50%; /* full opacity halfway up the scrollport */
}
```

`animation-range` keywords: `entry` (element entering scrollport), `exit`, `cover` (any part visible), `contain` (fully visible), each combinable with percentages. `scroll()` ties to a container's scroll progress instead (e.g. a top progress bar: `animation-timeline: scroll(root)` + `transform: scaleX()`).

**Ranges embedded in keyframes** (Chrome docs) — one keyframes block handles both entry and exit, no `animation-range` needed:

```css
@keyframes in-and-out {
  entry 0%   { opacity: 0; transform: translateY(100%); }
  entry 100% { opacity: 1; transform: translateY(0); }
  exit 0%    { opacity: 1; transform: translateY(0); }
  exit 100%  { opacity: 0; transform: translateY(-100%); }
}
li { animation: linear in-and-out; animation-timeline: view(); }
```

(Firefox 152 added `<timeline-range-name>` in `@keyframes` selectors per its release notes — but the whole feature is still flagged there.)

**Per-line stagger without JS.** `animation-delay` does not offset a scrubbed timeline (progress is positional, not temporal). Two documented-primitive approaches:

1. Each line is its own `view()` subject — later lines enter the scrollport later, so stagger falls out naturally.
2. Offset `animation-range` per line via a custom property (indexes set in markup or `nth-child`):

```css
.line { --i: 0; animation: reveal linear both; animation-timeline: view(); }
.line:nth-child(2) { --i: 1; }
.line:nth-child(3) { --i: 2; }
.line {
  animation-range: entry calc(var(--i) * 8%) cover calc(40% + var(--i) * 8%);
}
```

(Composition of `animation-range` + `calc()` + custom properties is spec-valid per MDN's `animation-range` syntax; the specific stagger recipe is my construction, not a quoted example.)

**Performance:** Chrome docs: scroll-driven animations of `transform`/`opacity` "run off the main thread" — same compositor path as time-based animations. Stick to those properties.

### IntersectionObserver fallback (the standard reveal pattern)

Source: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API — callbacks only fire on threshold crossings (no per-scroll main-thread work, no `getBoundingClientRect` loops).

```js
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);      // reveal once, then stop observing
    }
  }
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
```

Pair with a CSS transition on `.is-visible` (transform/opacity only) and stagger with `transition-delay: calc(var(--i) * 60ms)` — transitions, unlike scrubbed animations, honor delays.

---

## 2. Zero-dependency vanilla JS / WebGL techniques

### 2.1 Minimal fragment-shader background

**Fullscreen triangle** — the canonical minimal setup is a single triangle that overshoots clip space, so no index buffer and no vertex attributes are needed (derive the UV in the vertex shader from `gl_VertexID`-style trickery or a 3-vertex buffer). Shape of the boilerplate:

```js
const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
// One triangle covering clip space: (-1,-1) (3,-1) (-1,3)
const vs = `attribute vec2 p; varying vec2 uv;
  void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0., 1.); }`;
const fs = `precision mediump float; varying vec2 uv; uniform float t; uniform vec2 res;
  /* noise fn here */
  void main(){ float n = snoise(vec3(uv * 3.0, t * 0.05)); 
    gl_FragColor = vec4(vec3(0.06 + 0.04 * n), 1.0); }`; // monochrome, alpha 1.0
// compile/link, then:
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
// per frame: gl.drawArrays(gl.TRIANGLES, 0, 3);
```

(The fullscreen-triangle idiom is standard practice; no single owning primary source — UNVERIFIED as a citation, verified as working technique.)

**Noise GLSL + license — verified.** The canonical simplex noise is the Ashima Arts / Stefan Gustavson `webgl-noise` implementation (`snoise` 2D/3D/4D, classic Perlin `cnoise`), maintained at https://github.com/stegu/webgl-noise. License is **MIT** — "Copyright (C) 2011 by Ashima Arts (Simplex noise) / Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)" (https://github.com/stegu/webgl-noise/blob/master/LICENSE). Safe to inline in a single-file page; keep the copyright comment block in the shader source. For pure grain, a one-line hash (`fract(sin(dot(uv, vec2(12.9898,78.233))) * 43758.5453)`) is cheaper than simplex — widely used, origin murky (UNVERIFIED provenance, public-domain-treated).

**Sizing / DPR / GPU cost** — from MDN WebGL best practices (https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices):

- "A common (and easy) way to trade off quality for speed is rendering into a smaller back buffer, and upscaling the result. Consider reducing canvas.width and height and keeping canvas.style.width and height at a constant size." For a soft noise field, render at **0.5× device pixels** (or even cap DPR at 1) and let CSS upscale — the blur is free aesthetic.
- Naive `canvas.width = cssWidth * devicePixelRatio` causes moiré with non-integer DPR; exact device-pixel size is available via `ResizeObserver` with `box: 'device-pixel-content-box'` (irrelevant at half-res, worth knowing).
- **Do not use `alpha: false`?** — inverted: MDN says `alpha: false` "comes at a significant performance cost" in some compositing paths; prefer `alpha: true` (default) and always write `gl_FragColor.a = 1.0`. (Counterintuitive — MDN's own wording.)
- Prefer builtins (`dot`, `mix`, `normalize`); keep fragment work minimal — the fragment shader runs per-pixel and dominates cost on a fullscreen pass.

**Pausing when invisible:**

```js
let raf = null, visible = true;
function loop(t) { draw(t); raf = requestAnimationFrame(loop); }
function setRunning(run) {
  if (run && raf === null) raf = requestAnimationFrame(loop);
  if (!run && raf !== null) { cancelAnimationFrame(raf); raf = null; }
}
new IntersectionObserver(([e]) => { visible = e.isIntersecting; setRunning(visible); })
  .observe(canvas);
document.addEventListener('visibilitychange', () =>
  setRunning(visible && document.visibilityState === 'visible'));
```

Background tabs stop receiving rAF callbacks anyway (MDN WebGL best practices: "Background tabs won't receive RAF callbacks" — confirmed also on MDN's `requestAnimationFrame` page), so `visibilitychange` is belt-and-braces; the IntersectionObserver is what actually saves GPU when the hero scrolls out of view.

### 2.2 Text distortion without WebGL text rendering

- **SVG `feTurbulence` + `feDisplacementMap` applied to HTML text** via `filter: url(#warp)` works cross-browser (both primitives fully supported: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap, https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feTurbulence). Performance caveats: MDN documents that higher `numOctaves` "results in a negative impact on performance" (https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/numOctaves); turbulence is procedurally evaluated per pixel. Animating filter *parameters* (e.g. `baseFrequency` per frame via JS) forces re-running the filter chain every frame — CPU-rasterized in at least some engines. Per-engine compositing behavior of SVG filters on HTML content: UNVERIFIED — treat as expensive, use for a brief hover/load moment on one headline, never continuously on scroll.
- **CSS-only alternative (recommended for the "crazy fast" brief): variable-font animation.** Inter has a `wght` axis (100–900); animating `font-variation-settings`/`font-weight` on scroll (via scroll-driven animation or a JS-set custom property) gives kinetic type with zero filters. Caveat: weight changes alter glyph outlines and text metrics → this is **layout + paint per frame**, not compositor work — cheap for one headline, wrong for body text. `transform: skewX()`/`scale()` on wrapped lines stays compositor-only and is the cheapest distortion of all (see §2.5).

### 2.3 Magnetic button (pointermove + lerp + rAF, transform-only)

```js
function magnetic(el, strength = 0.3, ease = 0.12) {
  let tx = 0, ty = 0, x = 0, y = 0, raf = null;
  function tick() {
    x += (tx - x) * ease; y += (ty - y) * ease;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.1 || tx || ty)
      ? requestAnimationFrame(tick) : null;
  }
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect(); // read…
    tx = (e.clientX - r.left - r.width / 2) * strength;
    ty = (e.clientY - r.top - r.height / 2) * strength;
    if (raf === null) raf = requestAnimationFrame(tick); // …write in rAF
  });
  el.addEventListener('pointerleave', () => { tx = ty = 0; if (raf === null) raf = requestAnimationFrame(tick); });
}
```

Transform-only → compositor-only (MDN animation performance, web.dev animations-guide). Gate behind `matchMedia('(prefers-reduced-motion: no-preference)')` and `(hover: hover)`.

### 2.4 Scroll-velocity reactive type

```js
let lastY = window.scrollY, vel = 0, raf = null;
function tick() {
  const y = window.scrollY;               // read
  vel += ((y - lastY) - vel) * 0.1;       // smoothed velocity
  lastY = y;
  const skew = Math.max(-6, Math.min(6, vel * 0.15));
  heading.style.transform = `skewY(${skew}deg)`;   // write
  raf = Math.abs(vel) > 0.05 || y !== lastY ? requestAnimationFrame(tick) : null;
}
addEventListener('scroll', () => { if (raf === null) raf = requestAnimationFrame(tick); }, { passive: true });
```

**Skew via `transform`: compositor-friendly, use freely.** **Blur via `filter`: be careful.** Chrome's position: "the current CSS properties that are hardware-accelerated by default only include `opacity`, `filter`, and `transform`" (https://developer.chrome.com/blog/hardware-accelerated-animations) — so in Chromium a `filter` animation *can* run on the compositor — but blur itself is intrinsically expensive to produce each frame: "anything that involves a blur (like a shadow, for example) takes longer to paint than drawing a red box" (https://web.dev/articles/animations-guide). Whether Safari/Firefox composite `filter` animations off the main thread: UNVERIFIED. Recommendation: velocity → `skewY` yes; velocity → `blur()` only at small radii (≤4px) on a single element, or skip it.

### 2.5 Performance ground rules

Sources: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate, https://web.dev/articles/animations-guide, https://web.dev/articles/content-visibility, https://developer.mozilla.org/en-US/docs/Web/CSS/will-change

- **Compositor-only:** `transform` and `opacity` trigger style recalc only — no layout, no paint (MDN). Geometry props (`width`, `margin`, `font-size`, `left`…) trigger layout → paint → composite; visual props (`color`, `box-shadow`) trigger paint. web.dev: "Avoid any property that triggers layout or paint unless it's absolutely necessary."
- **Frame budget:** ~16.7 ms at 60 fps for script + style + layout + paint (MDN).
- **rAF read-then-write:** batch all DOM reads (scrollY, getBoundingClientRect) before any style writes within a frame to avoid forced synchronous layout ("layout thrash"). The snippets above follow this. Never write styles inside a raw `scroll` handler — set state, flush in rAF.
- **`content-visibility: auto`** on below-the-fold sections skips their render work until near-viewport (7× rendering-time win in web.dev's example). Pair with `contain-intrinsic-size: auto 600px` to avoid scrollbar jumps. Now Baseline: Chrome/Edge 85+, Firefox 125+, Safari 18+ (web.dev, Sept 2025). Caveat for this page: an off-screen element inside a `content-visibility: auto` subtree isn't rendered — fine with the IO/`view()` reveal patterns (both key off proximity to viewport), but test the combination.
- **`will-change`: last resort.** MDN: "If your page is performing well, don't add the `will-change` property to elements just to wring out a little more speed… Excessive use of `will-change` will result in excessive memory use." Apply via JS just before an interaction (e.g. on `pointerenter` of the magnetic button), remove after. Do not sprinkle it in the stylesheet.

---

## 3. Library stack currency (candidate C)

### GSAP

- **Current version: 3.15.0** (verified on cdnjs and jsdelivr resolve APIs, Aug 2026; gsap.com install docs show v3.15). GitHub repo no longer publishes Releases entries — npm/CDN is the source of truth.
- **Licensing — confirmed free.** gsap.com/pricing: "GSAP is now 100% free for all users, thanks to Webflow's support." All plugins including ScrollTrigger, SplitText, MorphSVG, DrawSVG, Draggable are free, **including commercial use** (gsap.com/licensing FAQ: "Can I really use GSAP in commercial projects without paying anything? Yes, really!"). Announced ~April 2025 after the Webflow acquisition. Note it is a **proprietary "Standard No Charge" license, not OSS** — the only real restriction is building tools that compete with Webflow's animation-builder capabilities; irrelevant for a portfolio site. Sources: https://gsap.com/pricing/, https://gsap.com/licensing/

### ScrollTrigger + Lenis integration

ScrollTrigger scrubbed-timeline pattern (https://gsap.com/docs/v3/Plugins/ScrollTrigger/):

```js
gsap.registerPlugin(ScrollTrigger);
gsap.timeline({
  scrollTrigger: { trigger: '.section', start: 'top top', end: '+=500', scrub: 1, pin: true }
});
```

Lenis glue — exact snippet from the Lenis README (https://github.com/darkroomengineering/lenis, "GSAP ScrollTrigger" section):

```js
const lenis = new Lenis();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => { lenis.raf(time * 1000); });
gsap.ticker.lagSmoothing(0);
```

(GSAP docs also offer `ScrollTrigger.scrollerProxy()` for scroll-hijacking libraries, but Lenis's default mode uses native scroll position, so the README's direct pattern above is the right one.)

### Lenis

- **Package name: `lenis`** on npm (the old `@studio-freight/lenis` name is retired; repo lives at darkroomengineering/lenis).
- **Current version: 1.3.26** (verified via jsdelivr resolve API and the GitHub releases page, Aug 2026; latest release adds `prefers-reduced-motion: reduce` support — good news for §4).
- README's own CDN snippet uses **unpkg** (`https://unpkg.com/lenis@1.3.26/dist/lenis.min.js` + `dist/lenis.css`).

### CDN availability — the deployment-restriction question

Allowed origins assumed: `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `code.jquery.com`.

| Library | cdnjs | jsdelivr (/npm/) | code.jquery.com |
|---|---|---|---|
| GSAP 3.15.0 core | ✅ `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/gsap.min.js` | ✅ `https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js` | ❌ |
| ScrollTrigger 3.15.0 | ✅ `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/ScrollTrigger.min.js` (fetched, header verified) | ✅ `https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js` | ❌ |
| Lenis 1.3.26 | ❌ **not on cdnjs** (cdnjs API search for "lenis": zero results, Aug 2026) | ✅ `https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js` (+ `dist/lenis.css`) — jsdelivr resolves 1.3.26 as latest | ❌ |

**Implication:** the full C stack is only deliverable if `cdn.jsdelivr.net/npm/` is genuinely allowed; a cdnjs-only environment gets GSAP + ScrollTrigger but **no Lenis** (README's unpkg URL is out too). GSAP + ScrollTrigger with native scroll is a perfectly good degraded C. Lenis's stylesheet would also need inlining if external stylesheets are restricted to fonts origins.

---

## 4. Table stakes

### prefers-reduced-motion

CSS (https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — Baseline widely available since Jan 2020):

```css
/* Opt-in style: only animate when the user hasn't opted out */
@media (prefers-reduced-motion: no-preference) {
  .reveal { animation: reveal linear both; animation-timeline: view(); }
}
/* or kill-switch style */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

MDN guidance: replace *motion* (scaling/panning that can trigger vestibular disorders) with opacity/color changes rather than removing all feedback.

JS:

```js
const motionOK = matchMedia('(prefers-reduced-motion: no-preference)');
if (motionOK.matches) initAnimations();
motionOK.addEventListener('change', (e) => e.matches ? initAnimations() : teardown());
```

GSAP (https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/ — reverts all animations/ScrollTriggers created in the context automatically when conditions flip):

```js
const mm = gsap.matchMedia();
mm.add({
  motionOK: '(prefers-reduced-motion: no-preference)',
  reduce:   '(prefers-reduced-motion: reduce)',
}, ({ conditions: { reduce } }) => {
  gsap.to('.hero-line', { yPercent: 0, duration: reduce ? 0 : 1.2, stagger: reduce ? 0 : 0.08 });
});
```

Bonus for candidate C: Lenis ≥1.3.26 respects `prefers-reduced-motion: reduce` natively (release notes, github.com/darkroomengineering/lenis/releases).

### Inter font loading (speed-obsessed)

Source: https://developers.google.com/fonts/docs/css2

- **Variable Inter via CSS2 API — yes.** Range syntax: `https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap` ("To request a range of a variable font axis, join the 2 values with `..`"). Verified the URL returns valid CSS (Aug 2026). Note: the API **UA-sniffs** — my non-browser fetch received static-weight TTF fallbacks; real modern browsers receive the woff2 variable font with `font-weight: 100 900`. The single variable file is what makes `wght` animation possible.
- **Standard embed:** `<link rel="preconnect" href="https://fonts.googleapis.com">` + `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` before the stylesheet link; `display=swap` shows fallback text immediately, swapping when the font arrives.
- **`text=` subsetting:** cuts file size "by up to 90%" for fixed strings — but it can only be specified once per request, applies to all families in it, and pins the font to exactly those characters. Right for a logotype; **wrong here** — kinetic headlines + body need full alphabet, and `text=` fights caching/reuse.
- **Self-hosting woff2:** fastest network shape for a single-file page — no third-party DNS/TLS handshake at all, one same-origin request, `<link rel="preload" as="font" type="font/woff2" crossorigin>`-able, immune to Google Fonts availability. Inter's license (SIL OFL) permits it. Tradeoff: you manage the file. (General web-perf consensus; specific latency numbers UNVERIFIED.) Note the deployment allowlist mentioned in §3 permits fonts.googleapis.com/fonts.gstatic.com, so both routes work there only if the font is either from Google Fonts or inlined as a data: URI.
- **System font stack:** zero requests, zero FOUT — the absolute "crazy fast" ceiling — but you lose Inter's identity **and the animatable `wght` axis** (system fonts vary per OS; `font-variation-settings` behavior is inconsistent across them). For kinetic typography, a real variable font is worth one request.

---

## Recommendations for this project

1. **Candidate A is the strongest fit for the brief.** CSS scroll-driven animations now cover Chrome/Edge/Safari (~85% of users) with compositor-driven, zero-JS scrubbing; the IO + transition fallback (needed for Firefox stable until ~157) is ~15 lines of JS. Total payload ≈ 0 KB of libraries.
2. Structure A as: baseline styles → `@supports (animation-timeline: view())` block for the native path → tiny IO script that only runs when `!CSS.supports('animation-timeline: view()')`. Declare `animation-timeline` after the `animation` shorthand.
3. **Candidate B:** use the fullscreen-triangle + Ashima/stegu simplex (MIT — keep the license header) at half resolution, `powerPreference: 'low-power'`, paused via IntersectionObserver + `visibilitychange`. Skip SVG feTurbulence text distortion on scroll; if you want type distortion, animate Inter's `wght` on one headline and use `skewY` velocity elsewhere.
4. **Candidate C works on the allowed CDNs only via jsdelivr for Lenis** (cdnjs has GSAP 3.15.0 + all plugins, but no Lenis). GSAP is genuinely 100% free including ScrollTrigger/SplitText — licensing is a non-issue. If jsdelivr is unavailable, drop Lenis and run ScrollTrigger on native scroll.
5. Everywhere: transform/opacity only; velocity effects via `skewY` not `blur`; `content-visibility: auto` on below-fold sections; `will-change` only via JS around interactions; every animation entry point behind `prefers-reduced-motion` (CSS media query in A/B, `gsap.matchMedia()` in C — and Lenis 1.3.26 handles its own).
6. Font: load variable Inter (`wght@100..900`) from Google Fonts with both preconnects + `display=swap`, or self-host the woff2 if the page must be single-origin. Skip `text=` subsetting — incompatible with full-page kinetic type.
