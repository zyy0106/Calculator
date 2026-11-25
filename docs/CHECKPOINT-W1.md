# CHECKPOINT W1: inline kernel sync, Chinese syntax-error wiring, full regression

Date: 2026-11-25. Files written: `www/index.html`, `tools/suite-v3.js`, this file, and `android/app/src/main/assets/public/index.html` (generated only by `npx cap sync android`). Nothing under `tools/editor-core*.js` or the other protected files was changed. No commit, push, or APK build was done. All helper scripts are in `%TEMP%` (`w1_*.js`).

## 1. Inline kernel sync (4 edits, located by anchor string)

The list comes from `docs/CHECKPOINT-G1.md` section 7. Each anchor was counted before the replacement, and the new text was counted after it.

| Edit | Anchor | Hits before | New text hits after | Current line |
|---|---|---|---|---|
| E1 doAppend `'^'` alias | `if (v === '^{}') { insertNode(...` | 1 | 1 | 1304 |
| E2 validator block | `/* ---------------- public API ---------------- */` | 1 | 1 | 1412-1508 |
| E3 export `validate` | `renderTex: renderTex, serialize: serialize, isEmpty: ...` | 1 | 1 | 1590 |
| E4 export `validateBlock`, `VALIDATE_MSG` | `joinTex: joinTex, anchorTex: anchorTex, resolvePath: resolvePath` + CRLF | 1 | 1 | 1601-1602 |

The validator block was copied from `tools/editor-core.js`, not retyped. The first diff run found 110 differing lines because the blank line between `validate()` and the public API comment was missing, which shifted every following line. Inserting that line (anchor hits = 1) fixed it.

Diff script `%TEMP%\w1_diff.js` compares lines with CRLF normalized. It covers the core from line 1 to just before `/* ---- self test` and the inline copy from `/* WebCASIO structured formula editor core` to `</script>`:

```
core lines(excl selftest)=691 inline lines=691 html range 914-1604 diffLines=0
```

## 2. Host wiring for Chinese error messages

The new helper sits before `xUndefinedErr`. It holds `SYNTAX_MSG_ZH` (line 2166, the 12 strings from the task table, written as UTF-8 like the existing Chinese text) and `syntaxGate(key, jump)` (line 2182):

```js
function syntaxGate(key, jump) {
    let r;
    try { r = EditorCore.validate(key); } catch (e) { return null; }
    if (!r || r.ok !== false || r.code === 'EMPTY') return null;
    if (jump) {
        const active = key === EditorCore.activeEditorKey(), keepExpr = currentExpression, keepPos = cursorPos;
        try {
            const moved = EditorCore.setCursorPath(key, r.path);
            if (!active) { currentExpression = keepExpr; cursorPos = keepPos; }   // editor in the background: move only its cursor
            else if (moved) renderLatex();
        } catch (e) { /* ignore */ }
    }
    return SYNTAX_MSG_ZH[r.code] || '语法错误';
}
```

An invalid path makes `setCursorPath` return false, and nothing else happens. Any exception is caught.

The evaluation entry points were found with grep for `math.evaluate|compile|parse|calculate*`. Each is listed below.

| Entry | Location | Wiring |
|---|---|---|
| Main calculation `calculate()` (main tab, including `f(2)`-style calls) | 2211 | After the existing empty check: `{ const synErr = syntaxGate(key, true); if (synErr) { resVal.innerText = synErr; return; } }`. The message goes to the result line `#calc-res-val`. |
| Variable definition (vars tab, same `calculate()`) | 2211 | Same line. On an error, `varVals`/`varExprs` are not written (tested). |
| Function panel f(x)/g(x) save (`calculate()` funcs branch) | 2205 | `syntaxGate(key, true)` runs before `math.parse`. On an error, `state.expr` is not marked saved and the result line shows the Chinese message. |
| f/g definitions in the scope `getCombinedScope()` (used by main, roots, graph) | 2040-2041 | `state.expr.fx && !syntaxGate('fx')`: an invalid f/g is not defined. Before this, mathjs could quietly define `7++8` as 15. |
| Root finder `calculateRoots()` | 2837 | The Chinese message goes to the existing `#root-list` text area, and the cursor in fx/gx moves to the error. `currentExpression` is kept unchanged. |
| Graph `drawGraph()` and tracker `drawTracker()` | 2879, 2888 | `if(!state.expr[key]||syntaxGate(key))return;`: an invalid curve is skipped, which matches the existing try/catch behavior for broken curves. |
| Matrix `calculateMatrix()` | not wired | It evaluates its own string `matrixCalcExpr` with `parseMatrixExpr`, not an EditorCore editor, so `validate(key)` does not apply. The existing Chinese errors (`矩阵维数不匹配` etc.) stay. |
| Statistics / regression fit | not wired | They use numeric input fields, not EditorCore editors. |

The mathjs fallback path (`语法错误` / `数学错误` / `错误: x 未定义`) is kept for semantic errors.

**EMPTY decision.** Before W1, pressing `=` on an empty expression in the main tab showed `0` with no error. `syntaxGate` ignores `EMPTY`, so each entry keeps its old empty handling: main shows `0`, roots shows `函数未定义`, and the graph skips the curve. A test covers this.

## 3. suite-v3 additions (section W 38 cases, section Y 8 cases)

All input goes through real mouse clicks on the keyboard buttons. xʸ uses the long-press bubble of x² (pick 1). √ and sin use a short tap on the long-press key. Assertions read `#calc-res-val.innerText` (exact Chinese text, no digits) and the editor cursor path.

- **W syntax errors (22):** `7++8` `7--8` `7+-8` `7*-8` `--7` → OP_CONSECUTIVE; `7^^8` (xʸ xʸ) → POW_NO_BASE; `7*/8` `7+*8` → OP_CONSECUTIVE; `*8` `/8` → OP_LEADING; `7+` `7+8*` → OP_TRAILING; `7..8` → DOT_DOUBLE; `7.5.2` → DOT_MULTIPLE; `7+.` `.` → DOT_ALONE; `7+()8` → EMPTY_PARENS; `7)` → STRAY_CLOSE; `sin()` → FN_NO_ARG; empty √, empty frac, `x^` with an empty exponent → EMPTY_SLOT. Each case also checks the cursor jump path, for example `root:3` or `root>pow@1.s0:0`.
- **W behavior (3):** an empty `=` shows `0`; vars `x=3` is accepted; vars `a=7++8` is rejected and `a` is unchanged.
- **W valid input (8):** `-7`=-7, `(-7)`=-7, `(+8)`=8, `2^{-3}` (xʸ)=0.125, `frac(-1,2)`=-0.5, `2x` (x=3)=6, `2(3+4)`=14, `7+8`=15.
- **W other entries (5):** funcs f(x)=`7++8` is rejected and the cursor goes to `root:3`; roots shows the Chinese message; drawGraph runs without an exception; f(x)=`x+1` is saved and f(2)=3; roots finds −1.
- **Y centering (8):** 420×860 and 360×640, each with single line, fraction, nested fraction, and integral. The test checks the gap between the `.katex` top and the screen content top against the gap between the result-line bottom and the content bottom.

| Content | 420×860 top/bottom | 360×640 top/bottom |
|---|---|---|
| single line | 80.58 / 80.58 | 23.08 / 23.08 |
| fraction | 67.00 / 67.02 | 9.50 / 9.52 |
| nested fraction | 55.19 / 55.19 | 0.19 / 1.19 |
| integral | 62.63 / 62.63 | 5.13 / 5.13 |

The largest difference is 1.00 px (nested fraction at 360×640), which agrees with D1.

The first run gave 113/115. Both failures were test-side: sin is a long-press key and needs `tap`, and the root list renders U+2212 `−1`. After those two fixes the suite is all green.

## 4. Full regression (real output)

```
node tools\editor-core.js --selftest   -> SELFTEST OK
node tools\editor-core.test.js         -> TESTS OK 5706 passed, 0 failed
node tools\syntax-fuzz.js              -> FUZZ seed=1780228134 sequences=3000 pass=3000 fail=0
node tools\longpress-bubble.test.js    -> TESTS OK 53 passed, 0 failed
node tools\inteq-solver.test.js        -> pass 28 / 28
node tools\suite-v3.js                 -> K 13/13, L 18/18, C 5/5, A 2/2, U 1/1, F 5/5, I 2/2, V 2/2, P 8/8, S 12/12, W 38/38, Y 8/8, E 1/1
                                          TOTAL 115/115 pass, 30.7s
inline <script> node --check           -> 1: OK (854 lines), 2: OK (274 lines), 3: OK (1213 lines)
```

Browser errors: suite case `E no page errors` passes, and it now also collects `console.error` from the W page. The screenshot script reported `errs []` (pageerror + console error).

## 5. Android

`npx cap sync android` → `Copying web assets from www to android\app\src\main\assets\public`, `Sync finished`.

```
www/index.html                                   3BA55FCB15E84EDB3D0B63152666F5A23D302946C2D6517D2F4021B41FA6654D
android/app/src/main/assets/public/index.html    3BA55FCB15E84EDB3D0B63152666F5A23D302946C2D6517D2F4021B41FA6654D
```

## 6. Screenshot checks (420×860, `%TEMP%\w1_*.png`, each one viewed)

- `w1_opop.png` (`7++8` =): the formula shows `7 + + |8` with the cursor after the second `+`. Below it, right-aligned, is `运算符不能连续出现`. No garbled text, and no number was calculated.
- `w1_powpow.png` (`7^^8` =): the formula shows 7 with an empty red base box carrying exponent 8, and the cursor sits in the empty base box. The message is `乘方缺少底数`. The characters are no longer lost: before G1 this was `78`.
- `w1_emptyfrac.png`: two empty boxes and the message `有未填写的方框`. The cursor is in the numerator, which is highlighted blue.
- `w1_normal.png`: `7+8×2` gives `= 23`.
- `w1_nested.png`: (1/2)/(3/4) gives `= 0.6666666667`. The formula and result together are vertically centered.
- `w1_integral.png`: ∫₀¹ x dx gives `= 0.5`. The group is centered.

Playwright reads the page text as UTF-8 correctly (`运算符不能连续出现`, `乘方缺少底数`, `有未填写的方框`, tab `变量`).

## 7. Remaining risks

- Visible behavior changes: `7+-8`, `--7`, `7*-8` used to give a value through mathjs and now show `运算符不能连续出现`. This is intended per the G1 rule.
- An f/g definition saved before W1 that does not pass validation (possible only from a stored session) is no longer defined in the scope. A call to `f(2)` then falls back to the mathjs undefined-symbol error, `数学错误`.
- Matrix and statistics do not go through `validate` because they do not use EditorCore editors.
- The error message is shown in the result line and stays there until the next key that refreshes the result line. This matches the existing `语法错误` behavior.