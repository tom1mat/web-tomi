# Research: View Transitions, scroll-hijacking a11y, reduced motion, grid `fr` interpolation

Primary sources only (W3C/CSSWG drafts, MDN + `mdn/browser-compat-data`, caniuse, wpt.fyi, WAI/WCAG, vendor docs).
Verified 2026-09-01. Empirical Chrome check run locally (Chrome 152, macOS).

---

## 1. View Transitions API (same-document)

### Status

- **Baseline: Newly available since October 2025** — MDN states "Since October 2025, this feature works across the latest devices and browser versions."
  <https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition>
- Spec: CSS View Transitions Module Level 1 (CR) <https://drafts.csswg.org/css-view-transitions-1/>; Level 2 (ED, adds `types`, `@view-transition`, `view-transition-class`) <https://drafts.csswg.org/css-view-transitions-2/>

### Browser support (exact versions)

From `mdn/browser-compat-data` (`api/Document.json`, `api/ViewTransition.json`, `css/properties/view-transition-name.json`) — <https://github.com/mdn/browser-compat-data>

| Feature | Chrome | Firefox | Safari |
|---|---|---|---|
| `Document.startViewTransition()` + `updateCallback` | 111 | 144 | 18 |
| `ViewTransition.ready` / `.finished` / `.updateCallbackDone` / `.skipTransition()` | 111 | 144 | 18 |
| `options` object param (`{update, types}`) | 125 | 147 | 18.2 |
| `ViewTransition.types` | 125 | 147 | 18.2 |
| `view-transition-name` (+ `none`) | 111 | 144 | 18 |
| `view-transition-name: match-element` | 137 | 144 | 18.4 |
| `ViewTransition.waitUntil()` | 144 | **no** | **no** |
| `ViewTransition.transitionRoot` | 147 | **no** | **no** |

caniuse (<https://caniuse.com/view-transitions>): **90.2% global**. Chrome/Edge 111+, Safari + iOS Safari 18.0+, Firefox 144+ (143 = behind a flag), Chrome Android 151+, Firefox Android 153+, Samsung Internet 23+. No IE, no Opera Mini.

> **Don't rely on** `waitUntil()` or `transitionRoot` — Chrome-only, no Firefox/Safari support.

### Syntax and return value

Level 1 IDL (<https://drafts.csswg.org/css-view-transitions-1/#the-domtransition-interface>):
```webidl
partial interface Document {
  ViewTransition startViewTransition(optional ViewTransitionUpdateCallback updateCallback);
};
callback ViewTransitionUpdateCallback = Promise<any> ();
```

Level 2 IDL (<https://drafts.csswg.org/css-view-transitions-2/#additions-to-document>):
```webidl
partial interface Document {
  ViewTransition startViewTransition(
    optional (ViewTransitionUpdateCallback or StartViewTransitionOptions) callbackOptions = {}
  );
  readonly attribute ViewTransition? activeViewTransition;
};
dictionary StartViewTransitionOptions {
  ViewTransitionUpdateCallback? update = null;
  sequence<DOMString>? types = null;
};
```

Call forms (MDN): `startViewTransition()`, `startViewTransition(updateCallback)`, `startViewTransition(options)`.

Returns a **`ViewTransition`** object with:
- `ready` — Promise; resolves when pseudo-elements are created and animations are about to start. Rejects if the transition is skipped before that point.
- `updateCallbackDone` — Promise; resolves when the promise from `updateCallback` fulfils.
- `finished` — Promise; resolves when the new state is visible and interactive.
- `skipTransition()` — spec: "If this's phase is not 'done', then skip the view transition for this with an 'AbortError' DOMException." (<https://drafts.csswg.org/css-view-transitions-1/#dom-viewtransition-skiptransition>)

`updateCallback` is invoked **after** the old state is snapshotted; the transition begins the next frame after its returned promise fulfils. If it rejects, the transition is abandoned (MDN, link above).

### Pseudo-element tree

Spec §"Pseudo-elements" (<https://drafts.csswg.org/css-view-transitions-1/#pseudo>):
```
::view-transition                       (root of the overlay; one per document)
└── ::view-transition-group(name)       (one per view-transition-name; animates size + position)
    └── ::view-transition-image-pair(name)   (isolation container for the cross-fade)
        ├── ::view-transition-old(name)  (static screenshot of old state)
        └── ::view-transition-new(name)  (live representation of new state)
```

UA stylesheet, quoted verbatim from <https://drafts.csswg.org/css-view-transitions-1/#ua-styles>:
```css
:root { view-transition-name: root; }
:root::view-transition { position: absolute; inset: 0; }
:root::view-transition-group(*) {
  position: absolute; top: 0; left: 0;
  animation-duration: 0.25s; animation-fill-mode: both;
}
:root::view-transition-image-pair(*) { position: absolute; inset: 0; }
:root::view-transition-old(*), :root::view-transition-new(*) {
  position: absolute; inset-block-start: 0; inline-size: 100%; block-size: auto;
}
/* image-pair, old and new inherit all animation-* from the group */
@keyframes -ua-view-transition-fade-out { to { opacity: 0; } }
@keyframes -ua-view-transition-fade-in  { from { opacity: 0; } }
@keyframes -ua-mix-blend-mode-plus-lighter { from { mix-blend-mode: plus-lighter } to { mix-blend-mode: plus-lighter } }
```
Notes from the same section: the default is a **0.25s cross-fade**; animation timing set on `::view-transition-group()` **inherits down** to old/new, so you usually only need to set `animation-duration`/`animation-timing-function` on the group. The overlay is **not** in the top layer — spec: "the view transition layer is a **sibling of all other content**."

Level 2 adds `::view-transition-group-children()`, `view-transition-class`, `:active-view-transition`, `:active-view-transition-type()` (<https://drafts.csswg.org/css-view-transitions-2/>).

### Morphing a specific element with `view-transition-name`

Give the same `view-transition-name` to the element in the old state and the (possibly different) element in the new state. Spec note (<https://drafts.csswg.org/css-view-transitions-1/#view-transition-name-prop>):

> "if one element has view transition name `foo` in the old state, and another element has view transition name `foo` in the new state, they are treated as representing different visual state of the same element, and will be paired in the view transition tree."

```css
.card--active .thumb { view-transition-name: hero-image; }
::view-transition-group(hero-image) { animation-duration: 400ms; }
```
```js
if (!document.startViewTransition) { render(next); }        // graceful fallback
else document.startViewTransition(() => render(next));
```
The group animates position/size between the two boxes; the image pair cross-fades old→new inside it.

### Gotchas (all sourced to the spec or vendor docs)

1. **Duplicate `view-transition-name` kills the transition.** Spec note: "If this name is not unique (i.e. if two elements simultaneously specify the same view transition name) then the view transition will abort." Algorithmically, *Capture the old state* returns failure on `usedTransitionNames` collision, and the caller then "skip[s] the view transition … with an `InvalidStateError` DOMException." (<https://drafts.csswg.org/css-view-transitions-1/#capture-old-state-algorithm>). Chrome docs restate it: "If two rendered elements have the same `view-transition-name` at the same time, the transition will be skipped." (<https://developer.chrome.com/docs/web-platform/view-transitions/same-document>)
   *This is the #1 practical failure with lists/sections — never leave a stale name on a hidden-but-rendered element.*
2. **Elements that aren't rendered are silently not captured.** Spec: "If `transitionName` is `none`, or element **is not rendered**, then continue"; also skipped if "any flat tree ancestor of this element skips its contents" (`content-visibility`, `display:none`) or "element has more than one box fragment" (fragmented across columns/pages).
3. **Only one transition at a time.** `startViewTransition()`: "If document's active view transition is not null, then skip that view transition with an `AbortError` DOMException." The spec explicitly warns two update callbacks can then run concurrently and out of order.
4. **Hidden document → immediate skip.** "If document's visibility state is 'hidden', then skip transition with an `InvalidStateError` DOMException." A tab going hidden mid-transition also skips it (§7.6 page-visibility change steps).
5. **Viewport resize mid-transition skips it** — a change in the snapshot containing block size causes the transition to skip (spec, ViewTransition interface section).
6. **The page is effectively non-interactive during capture.** Spec: "While a Document's *rendering suppression for view transitions* is true, all pointer hit testing must target its document element, ignoring all other elements." Chrome docs: "During this time, the page is frozen, so delays here should be kept to a minimum" — do your network work *before* calling `startViewTransition()`.
7. **Captured elements stop painting and stop hit-testing during `animating`** ("as if they had `opacity: 0`" / "as if they had `pointer-events: none`"). Important counterpoint from the same paragraph: "there is **no change** in how these elements are accessed by assistive technologies or the accessibility tree" — so the a11y tree is already the new state while the animation plays.
8. **`prefers-reduced-motion` is NOT handled by the API.** The Level 1 spec contains **no** normative text on `prefers-reduced-motion`. You must opt out yourself. Chrome's documented pattern (<https://developer.chrome.com/docs/web-platform/view-transitions/same-document>):
   ```css
   @media (prefers-reduced-motion) {
     ::view-transition-group(*),
     ::view-transition-old(*),
     ::view-transition-new(*) { animation: none !important; }
   }
   ```
   Chrome's own caveat: this may be too blunt; prefer "a more subtle animation, but one that still expresses the relationship between elements." Note `animation: none` still performs the DOM swap instantly — it does not skip the transition, so `finished` still resolves.

---

## 2. Scroll hijacking — what accessibility primary sources actually require

A page that calls `preventDefault()` on `wheel` and maps gestures to discrete state changes is **content implementing its own scrolling mechanism**, which WAI explicitly puts in scope.

### The load-bearing quote

WAI, Understanding SC 2.5.7 (<https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html>):

> "This criterion does not apply to scrolling and dragging gestures enabled by the user agent … This criterion also does not apply to the use of techniques such as CSS `overflow` … **The criterion does apply if content actively suppresses the user agent's own scrolling functionality and/or implements its own scrolling mechanism** – in these cases, the scrolling/dragging gesture is interpreted and processed by the content itself, and thus falls under the responsibility of the content author."

### Applicable success criteria (normative text from <https://www.w3.org/TR/WCAG22/>)

| SC | Level | Requirement | What it means here |
|---|---|---|---|
| **2.1.1 Keyboard** | A | "All functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes, except where the underlying function requires input that depends on the path of the user's movement…" | Every section reachable by wheel must also be reachable by keyboard. Arrow/PageUp/PageDown/Home/End/Tab. A wheel-only pager **fails**. Related failure: **F54** (pointing-device-specific event handlers only) — <https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html> |
| **2.1.2 No Keyboard Trap** | A | "If keyboard focus can be moved to a component of the page using a keyboard interface, then focus can be moved away from that component using only a keyboard interface…" | Off-screen sections must not swallow Tab. Use `inert`/`display:none` on inactive sections. |
| **2.4.3 Focus Order** | A | "…focusable components receive focus in an order that preserves meaning and operability." | After swapping a section, DOM/tab order must match the visible section. |
| **2.4.7 Focus Visible** | AA | "Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible." | Don't `outline: none` the section container you programmatically focus. |
| **2.4.11 Focus Not Obscured (Minimum)** | AA | "When a user interface component receives keyboard focus, the component is not entirely hidden due to author-created content." | A focused control must not sit behind a fixed overlay or an off-screen (translated) panel. |
| **2.5.1 Pointer Gestures** | A | "All functionality that uses multipoint or path-based gestures for operation can be operated with a single pointer without a path-based gesture, unless … essential." | Touch **swipe** is path-based → needs a single-tap alternative (next/prev buttons). A mouse **wheel** is not a path-based gesture, so 2.5.1 doesn't bite on wheel alone. |
| **2.5.7 Dragging Movements** | AA | "All functionality that uses a dragging movement for operation can be achieved by a single pointer without dragging, unless dragging is essential or the functionality is determined by the user agent and not modified by the author." | Applies **because** you suppressed native scrolling (quote above). Provide tap targets. |
| **4.1.3 Status Messages** | AA | "In content implemented using markup languages, status messages can be programmatically determined through role or properties such that they can be presented to the user by assistive technologies **without receiving focus**." | "Section 3 of 6" should be announced via a live region if you don't move focus. |
| **1.4.10 Reflow** | AA | "…without requiring scrolling in two dimensions for vertical scrolling content at a width equivalent to 320 CSS pixels…" | A 100vh section whose content overflows at 320px width with scrolling disabled **fails**. |
| **2.2.2 Pause, Stop, Hide** | A | "For moving, blinking, scrolling, or auto-updating information, mechanisms are available for the user to pause, stop, or hide it unless … essential." | Only bites if sections auto-advance. |
| **2.3.3 Animation from Interactions** | **AAA** | "Motion animation triggered by interaction can be disabled, unless the animation is essential to the functionality or the information being conveyed." | The section-slide animation itself. AAA, but the honest bar. |
| **3.2.5 Change on Request** | **AAA** | "Changes of context are initiated only by user request or a mechanism is available to turn off such changes." | AAA. |

**Note the ceiling:** disabling the section animation is only **AAA** (2.3.3). Keyboard operability (2.1.1, A) and the dragging alternative (2.5.7, AA) are the ones that block AA conformance.

### SC 2.3.3 detail
<https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html> — the Intent explicitly blesses `prefers-reduced-motion`: it lists "Transitions that support the reduce motion preference" as a sufficient approach, describing a "non-essential transition when loading new content" gated on the `prefers-reduced-motion` media query. It also says: "Moving new content into the viewport is essential for scrolling. The user controls the essential scrolling movement so it is allowed. Only add non-essential animation to the scrolling interaction in a responsible way." Essential exception = removal would "fundamentally change the information or functionality of the content."

### Focus management when content is swapped

WCAG has no SC that says "move focus on content change" — the requirements are 2.4.3 (order), 4.1.3 (announce without focus), 2.4.11 (not obscured). Concrete patterns come from the APG:

- **APG Carousel** (<https://www.w3.org/WAI/ARIA/apg/patterns/carousel/>) — the closest analogue for a section pager:
  - Container: `role="region"` (or `group`) + `aria-roledescription="carousel"` + accessible name.
  - Each slide: `role="group"` + `aria-roledescription="slide"` + `aria-label`/`aria-labelledby` ("3 of 6").
  - The element wrapping the slides: `aria-live="off"` while auto-rotating, **`aria-live="polite"` when rotation is off**, with `aria-atomic="false"`.
  - Next/previous buttons **do not move focus**, so they can be pressed repeatedly.
  - If it auto-rotates: rotation must stop when keyboard focus enters the carousel, and a rotation control must be first in the carousel's tab sequence.
- **APG Tabs** (<https://www.w3.org/WAI/ARIA/apg/patterns/tabs/>) — if you expose the sections as tabs: Left/Right arrows move between tabs (wrapping), Home/End jump to first/last, Tab from the tablist moves to the panel (give the panel `tabindex="0"` unless its first meaningful element is focusable). Automatic activation on focus is recommended "as long as their associated tab panels are displayed without noticeable latency"; otherwise manual activation with Space/Enter.

### Supporting API
- `inert` (global attribute) hides a subtree from focus, hit-testing and the a11y tree. Support: Chrome 102, Firefox 112, Safari 15.5 — `mdn/browser-compat-data` `html/global_attributes.json`.

---

## 3. `prefers-reduced-motion`

Spec: Media Queries Level 5 §12.1 (<https://drafts.csswg.org/mediaqueries-5/#prefers-reduced-motion>), quoted:

> Name: `prefers-reduced-motion` · For: `@media` · Value: `no-preference | reduce` · **Type: discrete**
> `no-preference` — "Indicates that the user has made no preference known to the system. This keyword value evaluates as **false** in the boolean context."
> `reduce` — "Indicates that user has notified the system that they prefer an interface that removes or replaces the types of motion-based animation that either trigger discomfort for those with vestibular motion sensitivity, or distraction for those with attention deficits."

Because `no-preference` evaluates false in boolean context, `@media (prefers-reduced-motion)` is exactly equivalent to `@media (prefers-reduced-motion: reduce)`.

Support: Chrome 74, Firefox 63, Safari 10.1 (`mdn/browser-compat-data` `css/at-rules/media.json`). MDN: Baseline widely available since January 2020 (<https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>).

### Recommended pattern

MDN's guidance is to **replace, not delete** — the documented example keeps an animation but swaps a `transform: scale()` pulse for an `opacity` dissolve. WAI SC 2.3.3 Intent agrees (reduce non-essential *motion*; opacity-only cross-fades are generally not vestibular triggers).

Opt-in form (animation only where motion is welcome):
```css
.panel { opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .panel { transition: transform 400ms cubic-bezier(.2,.8,.2,1), opacity 300ms linear; }
}
```
Blanket kill-switch (safe for transform/opacity transitions; note `0.01ms` rather than `0s` so `transitionend`/`animationend` still fire):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```
JS mirror (<https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia>):
```js
const mq = matchMedia('(prefers-reduced-motion: reduce)');
mq.addEventListener('change', apply);   // it can change at runtime
const reduced = () => mq.matches;
```

---

## 4. Does `grid-template-columns` / `-rows` interpolate between `fr` values?

**Yes. It works in current Chrome, Firefox and Safari. This is a real, cross-browser feature.**

### Spec

CSS Grid Layout Module Level 2, property definition table for `grid-template-columns` / `grid-template-rows` (<https://drafts.csswg.org/css-grid-2/#track-sizing>), quoted:

> **Animation type:** "if the list lengths match, by computed value type per item in the computed track list (see §7.2.5 Computed Value of a Track Listing and §7.2.3.3 Interpolation/Combination of `repeat()`); **discrete otherwise**"

So: same number of tracks → per-item interpolation by computed value type (and `<flex>` interpolates as a number). Different track counts, or `none` on either side → **discrete**.
`repeat()` combines smoothly only when both sides have the same repetition count and the same track count inside the repetition; otherwise discrete.

> ⚠️ **MDN's formal-definition table is out of date here.** <https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns> still says the animation type is a "simple list of length, percentage, or calc", which would exclude `fr`. The spec and all three shipping engines say otherwise — trust the spec + WPT.

### Cross-browser test evidence (wpt.fyi, stable channel, 2026-09-01)

`/css/css-grid/animation/grid-template-columns-interpolation.html` and `…-rows-interpolation.html`:

| Browser | Result |
|---|---|
| Chrome 152.0.7977.64 | **684 / 684 pass** |
| Firefox 154.0.1 | **684 / 684 pass** |
| Safari 26.6 (21624.4.5.11.5) | **684 / 684 pass** |

Also all-pass in all three: `grid-template-columns-composition.html` (190/190), `grid-no-interpolation.html` (336/336), and the four `neutral-keyframe` tests.
Source of truth: <https://wpt.fyi/results/css/css-grid/animation?label=stable>

The test explicitly asserts `fr` interpolation (<https://github.com/web-platform-tests/wpt/blob/master/css/css-grid/animation/grid-template-columns-interpolation.html>):
```js
from: "1fr 1fr 1fr", to: "2fr auto 2fr"
{at: 0.4, expect: "1.4fr 1fr 1.4fr"}
{at: 0.6, expect: "1.6fr auto 1.6fr"}
```
Note the mixed case: `fr` tracks interpolate numerically while an `fr`→`auto` track flips **discretely at 0.5**. Line names also flip discretely at 0.5.
The same file asserts the discrete cases: `1fr 1fr 1fr` → `2fr 2fr` (track-count mismatch) and anything involving `none`.

### Browser support for animating the property at all

`mdn/browser-compat-data` `css/properties/grid-template-columns.json`, `.animation` subfeature: **Chrome 107, Firefox 66, Safari 16, Edge 107**.

### Empirical check (Chrome 152, macOS, run 2026-09-01)

`grid-template-columns: 1fr 3fr` → `3fr 1fr` on a 400px grid with `transition: grid-template-columns 1s linear`. `getComputedStyle().gridTemplateColumns` sampled at t≈0.5s returned **`200.195px 199.805px`** (start `100px 300px`, end `300px 100px`) — genuinely interpolating, and identical to the `100px 300px` → `300px 100px` control. `getAnimations()` reported a running `grid-template-columns` transition.

### Caveats worth flagging

- **`getComputedStyle()` returns *used* pixel track sizes**, not `fr` — so you cannot read back the animated `fr` value from the computed style of a laid-out grid.
- **This animates layout on every frame.** `grid-template-columns` is not a compositor-only property (unlike `transform`/`opacity`), so each frame runs layout + paint for the grid and every descendant. For a full-viewport section swap at 60fps, an `fr` animation is materially more expensive than a `transform: translate3d()`. Prefer transform/opacity for the big motion and reserve `fr` animation for small track resizes. (MDN, CSS performance: <https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance>)
- Mismatched track counts fall back to **discrete** — the layout will jump at 50%. If you need to go from 2 tracks to 3, keep 3 tracks throughout and animate one to `0fr`.
