# CHECKPOINT P1: long-press bubble component

Files (standalone, not wired into `www/index.html`):
- `tools/longpress-bubble.js` (265 lines, UMD, pure ASCII)
- `tools/longpress-bubble.test.js` (248 lines, node, no deps)

## API

```js
var h = LongPressBubble.bind(button, {
  items: [{ label: 'sin\u207b\u00b9', input: 'asin(' }, ...], // label = HTML fragment
  onShort: function (input) {},   // short tap -> shortInput
  onPick:  function (input) {},   // released on an option -> item.input
  shortInput: 'sin(',
  longMs: 450,                    // default 450
  movePx: 8,                      // default 8, only before the bubble shows
  doc: document                   // optional, injectable for tests
});
h.destroy();                      // removes listeners and any open bubble
```

Also exported: `LongPressBubble.computeLayout(btnRect, bubbleW, bubbleH, viewportW)`
(pure geometry), `DEFAULT_LONG_MS`, `DEFAULT_MOVE_PX`.
Node: `require('./longpress-bubble.js')`; browser: `window.LongPressBubble`.

## State machine

| State | Event | Action / next state |
|---|---|---|
| IDLE | pointerdown (touchstart if no PointerEvent) | setPointerCapture, start longMs timer, add document move/up/cancel listeners -> PRESSED |
| PRESSED | move > movePx | cancel, nothing written -> IDLE |
| PRESSED | pointerup | onShort(shortInput) -> IDLE |
| PRESSED | timer fires | append `.lpb` to body (no-op if items empty) -> BUBBLE |
| BUBBLE | pointermove | hit-test each `.lpb-item` with getBoundingClientRect; hit gets `lpb-hover` |
| BUBBLE | pointerup on item i | onPick(items[i].input) -> IDLE |
| BUBBLE | pointerup elsewhere | nothing written -> IDLE |
| any | pointercancel / lostpointercapture / destroy() | nothing written -> IDLE |

Leaving any state: clear timer, releasePointerCapture in try/catch, remove bubble,
remove document listeners. Events from other pointer ids are ignored. Right-click
mouse presses are ignored; `contextmenu` is prevented; a `click` with
`detail === 0` (keyboard activation) calls onShort.

## Geometry (viewport coordinates, then + page scroll for `position:absolute`)

- itemHeight = button.height * 2/3 (inline `height` and `line-height` in px)
- cx = button.left + button.width / 2
- left = max(6, min(cx - W/2, viewportW - 6 - W)); viewportW = documentElement.clientWidth || innerWidth
- top = button.top - 8 - H
- tail.left = clamp(cx - left, 10, W - 10) (tail uses margin-left:-7px so this is its tip)
- W, H are measured after inserting the bubble hidden (`visibility:hidden`).

Styles are injected once as `<style id="lpb-style">`: `.lpb` flex, gap 4px, padding 4px,
white, `1px solid #3b82f6`, radius 10px, shadow `0 4px 14px rgba(0,0,0,.18)`;
`.lpb-item` nowrap, padding `0 10px`, width auto, `#f3f6fa`, radius 8px;
`.lpb-hover` `#3b82f6` with white text; bubble and items have user-select none,
-webkit-touch-callout none, touch-action none.

## Tests

`node tools\longpress-bubble.test.js` covers short tap, jitter under threshold,
long press without shortInput, pick option 1 / option 3, blank release, release on the
button, scroll cancel, pointercancel (before and after the bubble), lostpointercapture,
centring and 8px gap, item height 2/3 (48->32, 30->20), right/left clamps, tail
clamps, no capture API, foreign pointer ids, single style injection, destroy, ASCII
source and UMD global export.

```
TESTS OK 53 passed, 0 failed
```

## Not verified

The real-device behaviour of `pointercancel` and `lostpointercapture` in Android
WebView is untested. The button needs `touch-action:none` (existing `.key-long` rule
already has it), otherwise the browser may start a pan and cancel the press.
