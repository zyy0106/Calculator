# CHECKPOINT K5: cbrt / nroot / lg nodes + zero-width anchors

## tools/editor-core.js (net +4 lines, 624 -> 628)
| Lines (new) | Change |
|---|---|
| 29 | anchorTex: `\\phantom{|}` -> `\\vphantom{|}` (zero width, keeps height). API and path naming unchanged. |
| 31 | NODE_SLOTS += `cbrt: 1, nroot: 2` (comment: nroot s0 radicand, s1 index) |
| 34 | FN_INPUT += `'lg(': 'log10'` (display uses existing `FN_TEX.log10 = '\\lg'`, so FN_TEX is unchanged) |
| 36 | NODE_INPUT += `'cbrt(': 'cbrt', 'nroot(': 'nroot'` |
| 240-241 | serNode: `cbrt((s0))`, `nthRoot((s0),(s1))` (inserted after the sqrt line) |
| 300-301 | texNode: `\\sqrt[3]{s0}`, `\\sqrt[s1]{s0}` (inserted after the sqrt line) |

Before / after:
```
-  function anchorTex(path) { return '\\htmlId{ec-' + path + '}{\\htmlClass{ec-anchor}{\\phantom{|}}}'; }
+  function anchorTex(path) { return '\\htmlId{ec-' + path + '}{\\htmlClass{ec-anchor}{\\vphantom{|}}}'; }
-  var NODE_SLOTS = { frac: 2, sqrt: 1, int: 3, deriv: 2, pow: 1, sci: 1, logb: 2 };   // logb: s0 argument, s1 base
+  var NODE_SLOTS = { frac: 2, sqrt: 1, int: 3, deriv: 2, pow: 1, sci: 1, logb: 2, cbrt: 1, nroot: 2 };   // logb: s0 argument, s1 base; nroot: s0 radicand, s1 index
-  ... 'log10(': 'log10', 'log(': 'log', ...
+  ... 'log10(': 'log10', 'lg(': 'log10', 'log(': 'log', ...
-  ... 'log_(': 'logb' };
+  ... 'log_(': 'logb', 'cbrt(': 'cbrt', 'nroot(': 'nroot' };
   if (n.t === 'sqrt') return 'sqrt((' + serSlot(n.s[0]) + '))';
+  if (n.t === 'cbrt') return 'cbrt((' + serSlot(n.s[0]) + '))';
+  if (n.t === 'nroot') return 'nthRoot((' + serSlot(n.s[0]) + '),(' + serSlot(n.s[1]) + '))';
   if (n.t === 'sqrt') return '\\sqrt{' + sl(0) + '}';
+  if (n.t === 'cbrt') return '\\sqrt[3]{' + sl(0) + '}';
+  if (n.t === 'nroot') return '\\sqrt[' + sl(1) + ']{' + sl(0) + '}';
```
Cursor movement, comma slot hopping, deletion, unwrap and path encoding are generic (driven by NODE_SLOTS / findParent), so no other code paths changed. The file stays LF and pure ASCII.

## tools/editor-core.test.js
- Line 331: the existing 'anchor tex format' expectation updated from `\\phantom{|}` to `\\vphantom{|}` (required by the spec change).
- Lines 424-513: new K5 block inserted before "module hygiene". It covers TeX, serialization, empty slots, cursor enter/leave/cross-slot moves, delete/unwrap, nroot-vs-logb and cbrt-vs-sqrt step-by-step trace equivalence (cursor path, accepted flag, serialization, cursorPositions count), cursorPositions lists, setCursorPath round trips, anchor counts, zero-width anchors and mathjs evaluation.
- New assertions: 489 (5277 - 4788). Invariants run on every step, which accounts for most of them.

## Test output
```
> node tools\editor-core.js --selftest
SELFTEST OK
> node tools\editor-core.test.js
K5 new assertions: 489
TESTS OK 5277 passed, 0 failed
```

## index.html inline sync (lines 881-1482, offset +921 from editor-core.js)
Lines 950, 952, 955, 957 get a one-line replacement each. Lines 1160 and 1218 each get two lines inserted after them. Same text as above.
