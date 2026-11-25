# CHECKPOINT G1: kernel syntax validator + 7^^8 fix + syntax fuzz

Scope: only `tools/editor-core.js`, `tools/editor-core.test.js`, `tools/syntax-fuzz.js` (new), and this file were written.
`www/index.html` was not touched. While this task ran, git showed a concurrent D1 change in index.html (CSS for `#single-line-display`, 18 lines added and 1 removed). That change came from another task, so it is left alone and inline line numbers may drift. Use the anchors below, not line numbers.

## 1. API

```js
EC.validate(key) -> { ok: true }
                 | { ok: false, code: 'ASCII_CODE', message: 'ASCII english', pos: <int>, path: '<cursor path>' }
```
- Pure kernel walk over the editor tree (`validateBlock`). It does not call mathjs, and it is read-only: no cursor or tree changes and no notify.
- `pos`: index in the **root block** of the offending item. If the error is inside a structured node, `pos` is the index of the top-level node that contains it.
- `path`: a cursor path accepted by `setCursorPath`. It points just after the offending item, or into the empty slot or brackets. The host can use it to jump the cursor to the error.
- Exported: `validate`, `validateBlock(block, path, rootIdx)`, and `VALIDATE_MSG` (code -> message table).
- Implementation: `tools/editor-core.js` lines 499-581. The model mirrors `serBlock`: each block, whether the root or a slot, is an expression start, and each `open` pushes a frame. A frame tracks operand/operator count, the last kind, and the open index.

## 2. Rule table (code -> message -> recommended Chinese)

| # | code | message (kernel) | 推荐中文 | where (validateBlock) |
|---|---|---|---|---|
| 1,2 | OP_CONSECUTIVE | Two operators in a row | 运算符不能连续出现 | `op` branch: `f.last === 'O'` |
| 2,3 | OP_LEADING | Expression cannot start with this operator | 表达式不能以该运算符开头 | `op` branch: `f.n === 0` and not `+`/`-` |
| 3 | OP_TRAILING | Operator is missing its right operand | 运算符后缺少运算数 | `endFrame` and the root end: `last === 'O'` |
| 4 | DOT_DOUBLE | Consecutive decimal points | 小数点不能连续出现 | digit-run scan: `..` |
| 4 | DOT_MULTIPLE | More than one decimal point in a number | 一个数中只能有一个小数点 | digit-run scan: two `.` |
| 4 | DOT_ALONE | Decimal point without digits | 小数点前后缺少数字 | digit-run scan: run without `[0-9]` |
| 5 | STRAY_CLOSE | Right bracket has no matching left bracket | 多余的右括号 | `xclose`, or a `close` with no frame |
| 8 | EMPTY_PARENS | Empty brackets | 括号内为空 | `endFrame`: `fn === ''` and `n === 0` |
| 9 | FN_NO_ARG | Function is missing its argument | 函数缺少参数 | `endFrame`: `fn !== ''` and `n === 0` |
| 7 | EMPTY_SLOT | A required box is empty | 有未填写的方框 | slot block with `n === 0` (via `validateSlots`) |
| 7 | POW_NO_BASE | Power has no base | 乘方缺少底数 | `pow` node when the previous item is not an operand |
| - | EMPTY | Expression is empty | 表达式为空 | root block with `n === 0` |

Unary-sign rule (fixed by the task): a **single** `+`/`-` is allowed at a block start or right after `(`/`fn(`. A block start means the root or any node slot, so `2^{-3}`, `frac(-1,2)` and `sqrt(-4)` are all valid. Any other operator directly after an operator is `OP_CONSECUTIVE`. `*`, `/` and `^` at a start are `OP_LEADING`.

Rule 6 (unclosed `(`): the kernel closes these implicitly (`serBlock` autoclose), so they are never reported on their own. When the frame is implicitly closed, it is still checked for empty contents (`(` -> EMPTY_PARENS, `sin(` -> FN_NO_ARG) and for a trailing operator (`(7+` -> OP_TRAILING). No bracket situation is unpairable, because a `close` without an open is always stored as `xclose`. The `close`-with-no-frame branch exists only for defence.

Rule 10 (implicit multiplication): any adjacency of operands is valid (`2x`, `x2`, `2(3+4)`, `xy`, `2pi`, `2Ans`, `2sqrt(3)`, `x^2y`, `(2)(3)`, `2frac`). Check: I hooked `serialize` while running the whole existing test file. That gave 141 distinct serialized expressions, 0 that validate rejects while mathjs parses them (except the empty string), and 0 that validate accepts while mathjs rejects them.

Validity of digits: `.5`, `5.`, `7.x` are valid, matching mathjs.

## 3. Empty-slot policy per node (NODE_SLOTS)

| node | slots | policy |
|---|---|---|
| frac | 2 (num, den) | both required |
| sqrt / cbrt | 1 | required |
| nroot | 2 (s0 radicand, s1 index) | both required (empty index -> EMPTY_SLOT) |
| logb | 2 (s0 argument, s1 base) | both required |
| int | 3 (s0 integrand, s1 lower, s2 upper) | all required |
| deriv | 2 (s0 expr, s1 point) | both required |
| pow | 1 (exponent) | exponent required; base required too (POW_NO_BASE), since serBlock emits EMPTY_MARK for it |
| sci | 1 (exponent) | exponent required; a missing base is **valid** (serBlock uses `1`, so `*10^{3}` = 1000) |

Every empty slot serializes to `\u0000`, so this policy matches what the serializer already guaranteed.

## 4. The 7^^8 bug

Root cause: the bug was **not** in pow slot handling. `doAppend` accepted only `'^{}'`, so a raw `'^'` returned `false` and nothing was inserted. The two `^` keys were dropped silently, and the digits 7 and 8 then merged into one number, `78`. The host keyboard path already maps `^` to `^{}` via `keyToInput`, but any direct `append('^')` caller lost the operator.
Fix (one line, editor-core.js line 391): `'^'` is now an alias of `'^{}'`. `7^^8` now produces a nested pow, `((7)^(((\u0000)^(8))))`, with TeX `{7}^{\square^{8}}` (the base-missing box). Every character is kept, validate returns `POW_NO_BASE`, and mathjs also rejects it. For every other input, the TeX and serialization output is unchanged: the existing 5277 tests still pass.

## 5. Fuzz design (tools/syntax-fuzz.js)

- PRNG: xorshift32, default seed `0x6A1C2026` (=1780228134). Options: `--seed N`, `--count N` (default 3000).
- Alphabet, with weights: digits 30, `.` 6, vars `a b c x y z` 10, ops `+ - * / ^` 20, `( )` 10, `,` 3. The structured keys (weight 12) are taken from FN_INPUT/NODE_INPUT plus pow/sci/constant inputs: `frac( sqrt( cbrt( nroot( int( deriv( log_( ^{} ^{2} *10^{} lg( log10( log( sin( cos( tan( asin( acos( atan( f( g( pi e Ans`. Control keys (weight 9): `L`=moveCursor(-1), `R`=moveCursor(1), `DEL`=deleteLast().
- Lengths: the tier is chosen by `n % 3`. Short is 1-3, medium 4-10, long 11-30, about one third each.
- Assertions per sequence:
  1. No exception from append, deleteLast, moveCursor, serialize, renderTex (with cursor+anchors and without) or validate.
  2. Character conservation, checked at each step. An accepted `[0-9abcxyz]` key adds exactly that character to the tree. Any other key changes no tracked characters, except `^{2}`, which adds exactly one `2`. DEL removes at most one. Conservation keys must not be rejected. At the end, the tree multiset must equal the ledger and be a subset of `serialize()`. For sequences without DEL, the input multiset must be a subset of `serialize()`.
  3. `validate().ok` with a failing `math.parse(ser)` is a hard fail. Cases where validate rejects but mathjs parses are counted and sampled. The validate fields are checked: a code matching `[A-Z_]+`, an ASCII message, a numeric pos, and a path that `setCursorPath` resolves.
  4. TeX: braces balanced (ignoring `\{`/`\}`), and no `undefined`/`NaN`/`null`.
  5. Every `cursorPositions` path passes `setCursorPath` and reads back the same via `cursorPath`, and the walk leaves `serialize` unchanged.
  6. Idempotence: the whole sequence is replayed, and ser, tex and validate must be identical.
- Greedy delta minimization: drop one key at a time while the same failure kind persists. At most 20 failures are printed.
- Failures found during development: only fuzzer-side issues (`^{2}` inserting its own `2` was first flagged as a conservation break). No kernel failures. The 7^^8 class is covered by the `^` key in the alphabet.

Actual output:
```
> node tools/syntax-fuzz.js
tiers short/mid/long=1000/1000/1000 validate_ok=591 codes={"FN_NO_ARG":110,"OP_LEADING":424,"DOT_ALONE":339,"DOT_DOUBLE":56,"STRAY_CLOSE":459,"EMPTY_PARENS":123,"EMPTY_SLOT":130,"POW_NO_BASE":342,"OP_CONSECUTIVE":190,"OP_TRAILING":161,"EMPTY":50,"DOT_MULTIPLE":25}
strict-only (validate rejects, mathjs parses): 60
  e 1 + - ( 7 R ) z 1  =>  "(e*1)+-((7)*z*1)" OP_CONSECUTIVE
  9 - . 3 . e  =>  "9-(.3.*e)" DOT_MULTIPLE
  5 0 + + z z  =>  "50++(z*z)" OP_CONSECUTIVE
  4 . . a c ( R 5 . a  =>  "(4..*a*c*((5.*a)))" DOT_DOUBLE
  ...
FUZZ seed=1780228134 sequences=3000 pass=3000 fail=0
> node tools/syntax-fuzz.js --count 10000
strict-only (validate rejects, mathjs parses): 235
FUZZ seed=1780228134 sequences=10000 pass=10000 fail=0
> node tools/syntax-fuzz.js --seed 12345 --count 5000
FUZZ seed=12345 sequences=5000 pass=5000 fail=0
```
The fuzz uses `require('mathjs')` (node_modules 11.8.0). The unit tests use `www/math.min.js`.

## 6. Tests

`tools/editor-core.test.js` gains the block `/* ---- G1: kernel syntax validation ---- */` with 429 assertions. It covers the 18 known sequences (ok, code, ASCII message, character conservation, and pos/path where it matters), `^` = `^{}`, and every rule including positive cases. It also checks implicit-multiplication non-regression, that validate is read-only, the exports, and a fuzz smoke run (`--count 300` in a child process).
```
node tools/editor-core.js --selftest   -> SELFTEST OK
node tools/editor-core.test.js         -> TESTS OK 5706 passed, 0 failed   (was 5277)
```

## 7. Inline sync list for www/index.html (kernel copy, starting near line 881)

There are 4 edits. Each anchor occurs exactly once in index.html (checked).

**Edit 1** (doAppend). Anchor and original:
```js
    if (v === '^{}') { insertNode(e, makeNode('pow'), 0); return true; }
```
New:
```js
    if (v === '^{}' || v === '^') { insertNode(e, makeNode('pow'), 0); return true; }   // raw '^' = '^{}' (was silently rejected: 7^^8 -> 78)
```

**Edit 2** (insert the validator before the public API). Anchor and original:
```js
  /* ---------------- public API ---------------- */
```
New: the block below, followed by the unchanged anchor line.
```js
  /* ---------------- syntax validation (kernel level, independent of mathjs) ----------------
     validate(key) -> { ok: true } | { ok: false, code, message, pos, path }
     pos: index in the root block of the offending item (or of the top-level node containing it);
     path: cursor path right after the offending item / inside the empty slot or brackets. */
  var VALIDATE_MSG = {
    EMPTY: 'Expression is empty',
    OP_CONSECUTIVE: 'Two operators in a row',
    OP_LEADING: 'Expression cannot start with this operator',
    OP_TRAILING: 'Operator is missing its right operand',
    DOT_DOUBLE: 'Consecutive decimal points',
    DOT_MULTIPLE: 'More than one decimal point in a number',
    DOT_ALONE: 'Decimal point without digits',
    STRAY_CLOSE: 'Right bracket has no matching left bracket',
    EMPTY_PARENS: 'Empty brackets',
    FN_NO_ARG: 'Function is missing its argument',
    EMPTY_SLOT: 'A required box is empty',
    POW_NO_BASE: 'Power has no base'
  };
  // item: index of the offending item in its block; at: cursor index for path
  function vErr(code, path, item, at, rootIdx) {
    return { ok: false, code: code, message: VALIDATE_MSG[code], pos: rootIdx === null ? item : rootIdx, path: path + ':' + at };
  }
  // every slot of every node is required (an empty slot serializes to EMPTY_MARK)
  function validateSlots(n, path, i, rootIdx) {
    for (var si = 0; si < n.s.length; si++) {
      var r = validateBlock(n.s[si], path + '>' + n.t + '@' + i + '.s' + si, rootIdx === null ? i : rootIdx);
      if (r) return r;
    }
    return null;
  }
  // mirrors serBlock's frame/operand model; a block (root or slot) or bracket is an expression start,
  // where a single unary + or - is allowed. Returns null when valid, else an error object.
  function validateBlock(b, path, rootIdx) {
    var stack = [{ fn: null, n: 0, last: null, lastIdx: -1, openIdx: -1 }];
    function top() { return stack[stack.length - 1]; }
    function operand() { var f = top(); f.n++; f.last = 'N'; }
    function endFrame(f) {
      if (f.n === 0) return vErr(f.fn === '' ? 'EMPTY_PARENS' : 'FN_NO_ARG', path, f.openIdx, f.openIdx + 1, rootIdx);
      if (f.last === 'O') return vErr('OP_TRAILING', path, f.lastIdx, f.lastIdx + 1, rootIdx);
      return null;
    }
    var r, f;
    for (var i = 0; i < b.length; i++) {
      var it = b[i];
      if (it.t === 'd') {
        var j = i, s = '';
        while (j < b.length && b[j].t === 'd') { s += b[j].v; j++; }
        if (s.indexOf('..') >= 0) return vErr('DOT_DOUBLE', path, i + s.indexOf('..') + 1, i + s.indexOf('..') + 2, rootIdx);
        if (s.indexOf('.') !== s.lastIndexOf('.')) return vErr('DOT_MULTIPLE', path, i + s.lastIndexOf('.'), i + s.lastIndexOf('.') + 1, rootIdx);
        if (!/[0-9]/.test(s)) return vErr('DOT_ALONE', path, i, j, rootIdx);
        operand();
        i = j - 1;
      } else if (it.t === 'op') {
        f = top();
        if (f.last === 'O') return vErr('OP_CONSECUTIVE', path, i, i + 1, rootIdx);
        if (f.n === 0 && it.v !== '+' && it.v !== '-') return vErr('OP_LEADING', path, i, i + 1, rootIdx);
        f.n++; f.last = 'O'; f.lastIdx = i;
      } else if (it.t === 'var' || it.t === 'ans' || it.t === 'const') operand();
      else if (it.t === 'open') stack.push({ fn: it.fn, n: 0, last: null, lastIdx: -1, openIdx: i });
      else if (it.t === 'close') {
        if (stack.length < 2) return vErr('STRAY_CLOSE', path, i, i + 1, rootIdx);
        r = endFrame(stack.pop());
        if (r) return r;
        operand();
      } else if (it.t === 'xclose') return vErr('STRAY_CLOSE', path, i, i + 1, rootIdx);
      else if (isNode(it)) {
        if (it.t === 'pow' && top().last !== 'N') return vErr('POW_NO_BASE', path, i, i, rootIdx);
        r = validateSlots(it, path, i, rootIdx);
        if (r) return r;
        operand();
      }
    }
    while (stack.length > 1) {   // unclosed brackets are closed implicitly (never an error by themselves)
      r = endFrame(stack.pop());
      if (r) return r;
      operand();
    }
    f = stack[0];
    if (f.n === 0) return vErr(rootIdx === null ? 'EMPTY' : 'EMPTY_SLOT', path, 0, 0, rootIdx);
    if (f.last === 'O') return vErr('OP_TRAILING', path, f.lastIdx, f.lastIdx + 1, rootIdx);
    return null;
  }
  function validate(key) { return validateBlock(ed(key).root, 'root', null) || { ok: true }; }

  /* ---------------- public API ---------------- */
```

**Edit 3** (export). Original:
```js
    renderTex: renderTex, serialize: serialize, isEmpty: isEmpty, cursorToEnd: cursorToEnd,
```
New:
```js
    renderTex: renderTex, serialize: serialize, validate: validate, isEmpty: isEmpty, cursorToEnd: cursorToEnd,
```

**Edit 4** (internal exports). Original:
```js
    joinTex: joinTex, anchorTex: anchorTex, resolvePath: resolvePath
```
New:
```js
    joinTex: joinTex, anchorTex: anchorTex, resolvePath: resolvePath,
    validateBlock: validateBlock, VALIDATE_MSG: VALIDATE_MSG
```

## 8. Host wiring checklist (for downstream, not done here)

1. On `=`/EXE, call `EditorCore.validate(key)` before mathjs evaluation. If `ok === false`, show the Chinese text for `code` from the table in section 2 as a syntax error and do not evaluate.
2. Optional: `EditorCore.setCursorPath(key, r.path)` to put the cursor at the error, which is like CASIO's "goto".
3. Do not validate on every keystroke for error display: while typing, states such as `7+` and `sin(` are normal.
4. Also apply the same gate to the fx/gx/var_* editors and the matrix entry fields if they evaluate editor content.
5. Keep the existing mathjs error path as a fallback, for semantic errors such as an unknown symbol or a domain error.

## 9. Remaining risks

- Expressions the validator now rejects but mathjs parsed and evaluated (`7+-8`, `--7`, `2^{--3}`) change from a value to a syntax error once the host is wired. This is intended per the task, but it is a visible behavior change.
- `f(x, y)`-style multi-argument calls with a comma inside `open` cannot occur (`,` only moves between slots), so this case was not covered.
- Unknown constants (`const:<id>` without data) serialize to `NaN`. Validate treats them as operands, so the evaluation error comes from the host.
- Concurrent edits to index.html (D1) mean the inline sync must be applied by anchor.
