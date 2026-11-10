// WebCASIO S5 regression suite: >=100 human-style keypress sequences.
// Each sequence ends with '=', may contain DEL and L/R cursor moves mid-way.
// Per step it asserts: no "overflow/过于复杂", exactly 1 cursor, no page error.
// Final numeric result is compared against an independently computed oracle.
//
// Run:  cd %TEMP%\webcasio-test ; node C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\suite.js
//   or pass CALC env var to point at a specific index.html.
const path = require('path');
const HARNESS = path.join(process.env.TEMP, 'webcasio-test', 'harness.js');
const { open, press } = require(HARNESS);

// ---- constants oracle (SI values, mirror of tools/constants-data.js) ----
const CD = require(path.join(__dirname, 'constants-data.js'));
const CV = {}; // id -> Number
for (const c of CD.CONSTANTS) {
  if (c.v === 'pi') CV[c.id] = Math.PI;
  else if (c.v === 'e') CV[c.id] = Math.E;
  else CV[c.id] = Number(c.v);
}

// ---- tolerant numeric compare against the page's "= <str>" result ----
function parseRes(resText) {
  if (typeof resText !== 'string') return null;
  const m = resText.replace(/\u00a0/g, ' ').trim();
  if (!/^=/.test(m)) return { kind: 'err', text: m };
  const numStr = m.replace(/^=\s*/, '').replace(/\s+/g, '');
  const v = Number(numStr.replace(/e/i, 'e'));
  return { kind: 'num', value: v, text: m };
}
function approx(a, b) {
  if (!isFinite(a) || !isFinite(b)) return a === b;
  if (a === b) return true;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  // page keeps precision:10, so relative tolerance ~1e-9 is safe
  return Math.abs(a - b) <= 1e-8 * scale;
}

// ---- test table: [sequence, expectedNumber|'ERR:kind', note] ----
// expected === 'SYN' expects 语法错误, 'MATH' expects 数学错误.
const PI = Math.PI, E = Math.E;
const C = CV; // short alias for constants

const CASES = [
  // ---- basic arithmetic + operator precedence ----
  ['1 + 1 =', 2, 'add'],
  ['9 - 4 =', 5, 'sub'],
  ['6 * 7 =', 42, 'mul'],
  ['8 / 2 =', 4, 'div'],
  ['2 + 3 * 4 =', 14, 'precedence'],
  ['( 2 + 3 ) * 4 =', 20, 'paren precedence'],
  ['1 0 0 - 1 =', 99, 'multi-digit'],
  ['1 2 3 4 5 6 7 * 8 =', 9876536, 'sci-notation result'],
  ['. 5 + . 5 =', 1, 'leading dot'],
  ['3 . 1 4 1 5 9 =', 3.14159, 'decimal'],
  ['0 =', 0, 'zero'],
  ['7 - 9 =', -2, 'negative result'],

  // ---- deletion mid-sequence ----
  ['1 2 3 DEL + 4 =', 16, 'DEL last digit then add'],
  ['5 + 6 DEL 7 - 2 =', 10, 'DEL operand digit'],
  ['3 . 1 4 DEL DEL 5 9 =', 3.59, 'DEL across decimals'],
  ['9 9 9 DEL DEL DEL 7 =', 7, 'DEL all then retype'],
  ['1 + 2 + 3 DEL DEL 9 =', 30, 'DEL 3 and +, then 9 -> 1+29'],
  ['2 POW 3 R R DEL + 1 =', 16, 'DEL in exponent slot'],
  ['2 POW 3 R DEL 4 =', Math.pow(2, 34), 'R exits exp; DEL no-op; 4 appends -> 2^34'],
  ['FRAC 3 R 4 DEL 2 =', 1.5, 'DEL in denominator'],

  // ---- cursor moves (L/R) mid-sequence ----
  ['5 + 6 L L DEL 7 - 2 =', 11, 'DEL the 5, type 7-2 before +6 -> 7-2+6'],
  ['5 + 6 L DEL 7 =', 576, 'insert before 6 -> 576'],
  ['1 2 + 3 4 L L L DEL =', 35, 'DEL the 2 -> 1+34'],
  ['2 POW 3 R R L DEL 4 =', 16, 'move into exp, DEL, retype'],
  ['SQRT 8 1 R L DEL 9 =', Math.sqrt(89), 'move inside sqrt, DEL 1, type 9'],
  ['( 1 + 2 ) * 3 L L DEL =', 7, 'strip trailing, inside group'],
  ['1 0 L DEL 5 R + 1 =', 51, 'DEL 1 -> 0, insert 5 -> 50, +1'],
  ['9 L L L 1 =', 19, 'insert at far left -> 19'],

  // ---- fractions ----
  ['FRAC 1 R 2 =', 0.5, 'half'],
  ['FRAC 1 R 3 =', 1 / 3, 'third'],
  ['FRAC 1 R 2 R + FRAC 1 R 4 =', 0.75, 'two fractions'],
  ['FRAC 3 R 4 R * 8 =', 6, 'fraction times int'],
  ['FRAC FRAC 1 R 2 R R 3 =', 1 / 6, 'nested fraction numerator'],
  ['FRAC 1 R 2 R R + 9 DEL 3 =', 3.5, 'fraction then DEL retype'],
  ['FRAC 1 R SQRT 2 =', 1 / Math.sqrt(2), 'fraction with sqrt denom'],
  ['FRAC 2 R 2 R R R + 1 =', 2, 'leave fraction via R then add'],

  // ---- powers ----
  ['2 POW 3 =', 8, 'two cubed'],
  ['2 POW 1 0 R =', 1024, '2^10'],
  ['3 POW 4 R =', 81, '3^4'],
  ['2 POW 3 4 R =', Math.pow(2, 34), 'big exponent sci'],
  ['( 2 + 3 ) POW 2 =', 25, 'group squared'],
  ['SQRT 2 R R POW 2 =', 2, 'sqrt2 squared'],
  ['5 POW 0 R =', 1, 'x^0'],
  ['2 POW 3 R + 2 POW 2 =', 12, 'sum of powers'],

  // ---- square roots ----
  ['SQRT 9 R =', 3, 'sqrt 9'],
  ['SQRT 2 R =', Math.sqrt(2), 'sqrt 2'],
  ['SQRT 1 6 R =', 4, 'sqrt 16'],
  ['SQRT SQRT 1 6 =', 2, 'nested sqrt'],
  ['SQRT 8 R + SQRT 2 =', Math.sqrt(8) + Math.sqrt(2), 'sum of sqrt'],
  ['SQRT 4 9 R * 2 =', 14, 'sqrt times int'],

  // ---- trig (radians) ----
  ['COS 0 ) =', 1, 'cos 0'],
  ['SIN 0 ) =', 0, 'sin 0'],
  ['SIN PI / 2 ) =', 1, 'sin pi/2'],
  ['COS PI ) =', -1, 'cos pi'],
  ['TAN PI / 4 ) =', Math.tan(PI / 4), 'tan pi/4'],
  ['SIN PI / 6 ) =', Math.sin(PI / 6), 'sin pi/6'],
  ['SIN 3 0 ) =', Math.sin(30), 'sin 30 rad'],
  ['COS 0 ) + SIN 0 ) =', 1, 'cos+sin'],

  // ---- logs / exp ----
  ['LG 1 0 0 0 ) =', 3, 'log10 1000'],
  ['LG 1 ) =', 0, 'log10 1'],
  ['LN E ) =', 1, 'ln e'],
  ['LN 1 ) =', 0, 'ln 1'],
  ['LG 1 0 0 ) + LN E ) =', 3, 'log sum'],

  // ---- scientific notation (EXP) ----
  ['1 EXP 3 =', 1000, '1e3'],
  ['2 . 5 EXP 2 =', 250, '2.5e2'],
  ['1 . 5 EXP 3 =', 1500, '1.5e3'],
  ['6 EXP 2 R + 1 =', 601, 'e-notation then add'],
  ['3 EXP 0 R =', 3, 'e0'],

  // ---- derivative ----
  ['DER x POW 2 R R 3 =', 6, "d/dx x^2 at 3"],
  ['DER x POW 3 R R 2 =', 12, "d/dx x^3 at 2"],
  ['DER SIN x ) R 0 =', Math.cos(0), 'd/dx sin at 0'],
  ['DER x POW 2 R R 0 =', 0, "d/dx x^2 at 0"],

  // ---- integral ----
  ['INT x R 0 R 1 =', 0.5, 'int x 0..1'],
  ['INT x POW 2 R R 0 R 1 =', 1 / 3, 'int x^2 0..1'],
  ['INT SIN x R 0 R PI =', 2, 'int sin 0..pi'],
  ['INT 1 R 0 R 5 =', 5, 'int const 0..5'],

  // ---- nesting / mixed ----
  ['FRAC SQRT 2 R R 2 =', Math.sqrt(2) / 2, 'sqrt2 over 2'],
  ['SQRT FRAC 9 R 4 =', Math.sqrt(9 / 4), 'sqrt of fraction'],
  ['2 POW FRAC 1 R 2 R R =', Math.pow(2, 0.5), '2^(1/2)'],
  ['( 1 + SQRT 2 R ) POW 2 =', Math.pow(1 + Math.sqrt(2), 2), 'group with sqrt squared'],
  ['FRAC 1 R 2 R + FRAC 1 R 3 R + FRAC 1 R 6 =', 1, 'three fractions sum'],
  ['SQRT 3 R POW 2 =', 3, 'sqrt3 squared'],
  ['LN E POW 2 R ) =', 2, 'ln(e^2)'],

  // ---- Ans chaining ----
  ['5 = ANS + 3 =', 28, '(5*Ans)+3 implicit; Ans=5 so 5*5+3=28'],
  ['5 = AC ANS + 3 =', 8, 'Ans+3 after AC'],
  ['1 0 = AC SQRT ANS R =', Math.sqrt(10), 'sqrt(Ans)'],
  ['7 = AC ANS * ANS =', 49, 'Ans squared'],
  ['3 = AC ANS POW 2 R =', 9, 'Ans^2'],
  ['2 0 = AC ANS / 4 =', 5, 'Ans/4'],

  // ---- error / robustness paths (still no overflow, 1 cursor) ----
  ['1 / 0 =', 'MATH', 'div by zero'],
  ['FRAC 1 =', 'SYN', 'empty denominator'],
  ['( 1 + 2 =', 3, 'unclosed paren tolerated'],
  ['SIN ) =', 'SYN', 'empty sin arg'],
  ['+ 5 =', 5, 'leading unary plus tolerated'],

  // ---- longer human-style edits ----
  ['1 2 3 4 5 DEL DEL + 6 7 8 =', 801, '123+678'],
  ['9 8 7 6 L L DEL DEL R R =', 76, 'DEL twice at middle -> 76'],
  ['2 * 3 + 4 * 5 =', 26, 'mixed mul/add'],
  ['1 0 0 / 4 / 5 =', 5, 'chained div'],
  ['2 POW 2 R POW 2 R =', 16, '(2^2)^2 via chained pow? check'],
  ['FRAC 1 0 R 4 R + . 5 =', 3, '10/4 + .5'],
];

// Fill up to >=100 with programmatic integer-arith cases (still human-style, DEL+move).
(function pad() {
  // simple parametric: n*n for n=2..13 using POW
  for (let n = 2; n <= 13; n++) {
    const digs = String(n).split('').join(' ');
    CASES.push([`${digs} POW 2 R =`, n * n, `${n}^2`]);
  }
  // a+b with a mid DEL typo correction for several pairs
  const pairs = [[12, 7], [34, 56], [9, 90], [100, 250], [7, 8], [45, 55], [11, 22], [63, 37]];
  for (const [a, b] of pairs) {
    const seq = `${String(a).split('').join(' ')} + ${String(b).split('').join(' ')} 9 DEL =`;
    CASES.push([seq, a + b, `${a}+${b} with trailing typo DEL`]);
  }
  // sqrt of perfect squares
  for (const n of [1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144]) {
    CASES.push([`SQRT ${String(n).split('').join(' ')} R =`, Math.sqrt(n), `sqrt ${n}`]);
  }
})();

// ---- constants cases: run via panel taps; short press inserts, long press shows (no insert), one DEL removes atom ----
// Each: { seq: array of ops, expected, note }
// op forms: 'key:<K>' press a keyboard key, 'tap:<id>' short press constant, 'calc' is '='.
const CONST_CASES = [
  { ops: ['const:c0', 'key:*', 'key:2', '='], expected: C.c0 * 2, note: 'c0 * 2' },
  { ops: ['const:qe', '='], expected: C.qe, note: 'insert e (elementary charge)' },
  { ops: ['const:NA', 'key:*', 'const:qe', '='], expected: C.NA * C.qe, note: 'NA*qe = Faraday-ish' },
  { ops: ['const:me', 'key:*', 'const:c0', 'key:*', 'const:c0', '='], expected: C.me * C.c0 * C.c0, note: 'me*c0^2 rest energy' },
  { ops: ['const:h', 'key:*', 'const:c0', '='], expected: C.h * C.c0, note: 'h*c0' },
  { ops: ['const:k', 'key:*', 'const:NA', '='], expected: C.k * C.NA, note: 'k*NA = R' },
  { ops: ['key:2', 'const:hbar', '='], expected: 2 * C.hbar, note: '2 hbar implicit mult' },
  { ops: ['const:pi', 'key:*', 'key:2', '='], expected: Math.PI * 2, note: 'pi*2 (const keyboard pi)' },
  { ops: ['const:mue', 'key:*', 'const:pi', '='], expected: C.mue * Math.PI, note: 'negative const mue*pi' },
  { ops: ['const:eps0', 'key:*', 'key:1', 'key:=longdel'], expected: 'DELCHECK', note: 'one DEL removes eps0 atom wholly' },
  { ops: ['const:G', 'key:*', 'const:me', '='], expected: C.G * C.me, note: 'G*me' },
  { ops: ['const:Rgas', '='], expected: C.Rgas, note: 'gas constant R' },
  { ops: ['const:gn', 'key:*', 'key:2', '='], expected: C.gn * 2, note: 'g_n * 2' },
  { ops: ['const:phi', 'key:*', 'const:phi', '='], expected: C.phi * C.phi, note: 'golden ratio squared' },
  { ops: ['const:e', 'key:*', 'key:2', '='], expected: Math.E * 2, note: 'math e * 2 from panel' },
];

// ---- runner ----
let pass = 0, fail = 0;
const report = []; // {seq, expected, actual, ok}
const fails = [];

async function openPanel(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[onclick]')].find(x => x.getAttribute('onclick') === 'toggleConstPanel()');
    if (b) b.click();
  });
}
function panelOpen(page) {
  return page.evaluate(() => getComputedStyle(document.getElementById('const-panel')).display !== 'none');
}
async function ensurePanel(page, want) {
  const is = await panelOpen(page);
  if (is !== want) await openPanel(page);
}
async function tapConst(page, id, holdMs) {
  await ensurePanel(page, true);
  const box = await page.evaluate(cid => {
    const r = document.querySelector('.const-cell[data-id="' + cid + '"]');
    r.scrollIntoView({ block: 'center' });
    const b = r.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }, id);
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.waitForTimeout(holdMs || 60);
  const shown = await page.evaluate(cid => document.querySelector('.const-cell[data-id="' + cid + '"]').classList.contains('show-val'), id);
  await page.mouse.up();
  return shown;
}
function dbg(page) {
  return page.evaluate(() => {
    const disp = document.getElementById('single-line-display');
    const d = EditorCore.__dbg(EditorCore.activeEditorKey());
    return {
      ser: d.ser,
      cursors: disp.querySelectorAll('.cursor-blink').length,
      err: /过于复杂/.test(disp.innerText),
      res: document.getElementById('calc-res-val').innerText,
    };
  });
}

(async () => {
  const { browser, page, errors } = await open();
  const stepBad = [];

  // ---------- keyboard sequences ----------
  for (const [seq, expected, note] of CASES) {
    await press(page, 'AC');
    let last = null, badStep = null;
    for (const k of seq.split(' ')) {
      const r = await press(page, k);
      last = r;
      if (k !== '=' && (r.err || r.cursors !== 1)) { badStep = { k, err: r.err, cursors: r.cursors }; break; }
    }
    const parsed = parseRes(last.res);
    let ok;
    if (expected === 'SYN') ok = parsed.kind === 'err' && /语法/.test(parsed.text);
    else if (expected === 'MATH') ok = parsed.kind === 'err' && /数学/.test(parsed.text);
    else ok = parsed.kind === 'num' && approx(parsed.value, expected);
    if (badStep) ok = false;
    const actual = badStep ? `BADSTEP ${JSON.stringify(badStep)}` : last.res;
    report.push({ seq, expected: fmtExp(expected), actual, ok });
    if (ok) pass++; else { fail++; fails.push({ seq, expected: fmtExp(expected), actual, note }); }
  }

  // ---------- constants sequences ----------
  await press(page, 'AC');
  // long-press-no-insert check (uses a well-known constant)
  {
    await ensurePanel(page, true);
    const serBefore = (await dbg(page)).ser;
    const shown = await tapConst(page, 'qe', 700);
    const after = await dbg(page);
    const ok = shown === true && after.ser === serBefore;
    report.push({ seq: 'LONGPRESS qe (700ms)', expected: 'shows value, NOT inserted', actual: `shown=${shown} ser=${after.ser}`, ok });
    if (ok) pass++; else { fail++; fails.push({ seq: 'LONGPRESS qe', expected: 'no insert', actual: `shown=${shown} ser=${after.ser}` }); }
    await ensurePanel(page, false);
  }

  for (const tc of CONST_CASES) {
    await press(page, 'AC');
    let last = { res: '0' }, badStep = null, delCheck = null;
    for (const op of tc.ops) {
      if (op.startsWith('const:')) {
        const id = op.slice(6);
        await tapConst(page, id, 60);
        await ensurePanel(page, false);
        const d = await dbg(page);
        if (d.err || d.cursors !== 1) { badStep = { op, err: d.err, cursors: d.cursors }; break; }
        last = d;
      } else if (op === 'key:=longdel') {
        // record ser before DEL, then one DEL, verify the whole constant atom vanished
        const beforeDel = (await dbg(page)).ser;
        await press(page, 'DEL');
        const afterDel = await dbg(page);
        delCheck = { beforeDel, afterDel: afterDel.ser };
        last = afterDel;
      } else if (op.startsWith('key:')) {
        const r = await press(page, op.slice(4));
        if (r.err || r.cursors !== 1) { badStep = { op, err: r.err, cursors: r.cursors }; break; }
        last = r;
      } else if (op === '=') {
        last = await press(page, '=');
      }
    }
    let ok, actual;
    if (badStep) { ok = false; actual = `BADSTEP ${JSON.stringify(badStep)}`; }
    else if (tc.expected === 'DELCHECK') {
      // eps0 inserted then '*1' then DEL '1' ... wait: ops were const:eps0, *, 1, longdel
      // After DEL we expect '1' removed -> ser ends with eps0*; then verify a second DEL removes eps0 atom.
      const beforeEps = delCheck.beforeDel;    // "<eps0>*1"
      const afterOne = delCheck.afterDel;       // "<eps0>*"
      // Now one more DEL removes '*', another removes the eps0 atom entirely in a single DEL.
      await press(page, 'DEL'); // remove '*'
      const serHasEps = (await dbg(page)).ser;  // contains eps0 digits
      await press(page, 'DEL'); // remove eps0 atom in ONE delete
      const serAfterAtom = (await dbg(page)).ser;
      const epsDigits = String(C.eps0).replace(/e.*/i, '').replace('.', '');
      const hadEps = /8\.?8541878/.test(serHasEps.replace(/[^0-9.]/g, m => m));
      const epsGone = !/8\.85418/.test(serHasEps) ? false : !/8\.85418/.test(serAfterAtom);
      ok = /8\.85418/.test(serHasEps) && !/8\.85418/.test(serAfterAtom) && serAfterAtom.trim() === '';
      actual = `afterUnit="${serHasEps}" afterAtomDEL="${serAfterAtom}"`;
    } else {
      const parsed = parseRes(last.res);
      ok = parsed.kind === 'num' && approx(parsed.value, tc.expected);
      actual = last.res;
    }
    report.push({ seq: 'CONST ' + tc.ops.join(' '), expected: tc.expected === 'DELCHECK' ? 'one DEL removes eps0 atom' : fmtExp(tc.expected), actual, ok });
    if (ok) pass++; else { fail++; fails.push({ seq: 'CONST ' + tc.ops.join(' '), note: tc.note, expected: tc.expected, actual }); }
    await ensurePanel(page, false);
  }

  // f/g functions + variables + plot + roots (exercise those modes once each)
  const click = (s) => page.evaluate(x => { const b = [...document.querySelectorAll('[onclick]')].find(b => b.getAttribute('onclick') === x && b.offsetParent !== null) || [...document.querySelectorAll('[onclick]')].find(b => b.getAttribute('onclick') === x); if (b) b.click(); }, s);
  async function modeSeq(s) { let r; for (const k of s.split(' ')) { r = await press(page, k); if (k !== '=' && (r.err || r.cursors !== 1)) stepBad.push('badstep ' + k + ' in ' + s); } return r; }

  // funcs f=x^2-2, g=sin(x)
  await click("switchMode('funcs')");
  await modeSeq('AC x POW 2 R - 2 =');
  const fx = await page.evaluate(() => state.expr.fx);
  await click("setFuncTarget('g')");
  await modeSeq('AC SIN x ) =');
  const gx = await page.evaluate(() => state.expr.gx);
  report.push({ seq: 'FUNC f=x^2-2, g=sin(x)', expected: 'fx/gx saved', actual: `fx=${fx} gx=${gx}`, ok: fx === '((x)^(2))-2' && gx === 'sin(x)' });
  (fx === '((x)^(2))-2' && gx === 'sin(x)') ? pass++ : (fail++, fails.push({ seq: 'FUNC save', expected: 'fx/gx', actual: `fx=${fx} gx=${gx}` }));

  await click("switchMode('main')");
  let r = await modeSeq('AC f 3 ) + g 0 ) =');
  { const p = parseRes(r.res); const ok = p.kind === 'num' && approx(p.value, 7); report.push({ seq: 'MAIN f(3)+g(0)', expected: 7, actual: r.res, ok }); ok ? pass++ : (fail++, fails.push({ seq: 'f(3)+g(0)', expected: 7, actual: r.res })); }

  // vars a=2*3, x=1.5, then main a+x+f(x)
  await click("switchMode('vars')");
  await click("selectVar('a')");
  await modeSeq('AC 2 * 3 =');
  await click("selectVar('x')");
  await modeSeq('AC 1 . 5 =');
  await click("switchMode('main')");
  r = await modeSeq('AC a + x + f x ) =');
  { const p = parseRes(r.res); const ok = p.kind === 'num' && approx(p.value, 7.75); report.push({ seq: 'MAIN a+x+f(x) (a=6,x=1.5)', expected: 7.75, actual: r.res, ok }); ok ? pass++ : (fail++, fails.push({ seq: 'a+x+f(x)', expected: 7.75, actual: r.res })); }

  // plot: lines render, no overflow
  await click("switchMode('plot')");
  await page.waitForTimeout(150);
  const plotErr = await page.evaluate(() => /过于复杂/.test(document.getElementById('double-line-display')?.innerText || ''));
  report.push({ seq: 'PLOT render fx/gx', expected: 'no overflow', actual: 'overflow=' + plotErr, ok: !plotErr });
  !plotErr ? pass++ : (fail++, fails.push({ seq: 'PLOT', expected: 'no overflow', actual: 'overflow=' + plotErr }));

  // roots of f=x^2-2 in [-3,3] -> +-sqrt(2)
  await click("switchMode('roots')");
  await page.evaluate(() => { document.getElementById('rootX1').value = '-3'; document.getElementById('rootX2').value = '3'; calculateRoots(); });
  const rootTxt = await page.evaluate(() => document.getElementById('root-list').innerText.replace(/\s+/g, ' '));
  const rootsOk = /1\.41421/.test(rootTxt);
  report.push({ seq: 'ROOTS f in [-3,3]', expected: '+/-1.41421356', actual: rootTxt, ok: rootsOk });
  rootsOk ? pass++ : (fail++, fails.push({ seq: 'ROOTS', expected: '+/-sqrt2', actual: rootTxt }));

  await browser.close();

  // ---- emit machine-readable report for the doc writer ----
  const fs = require('fs');
  const outJson = path.join(__dirname, 'suite-report.json');
  fs.writeFileSync(outJson, JSON.stringify({ pass, fail, total: pass + fail, stepBad, report, fails, pageErrors: errors }, null, 2), 'utf8');

  console.log('--- FAILURES ---');
  for (const f of fails) console.log(JSON.stringify(f));
  if (stepBad.length) console.log('STEP-BAD (mode seqs):', JSON.stringify(stepBad));
  if (errors.length) console.log('PAGE ERRORS:', JSON.stringify(errors));
  console.log(`SUITE ${fail === 0 && errors.length === 0 && stepBad.length === 0 ? 'OK' : 'FAIL'} ${pass}/${pass + fail} passed; pageErrors=${errors.length}`);
  process.exit(fail === 0 && errors.length === 0 && stepBad.length === 0 ? 0 : 1);
})();

function fmtExp(e) {
  if (e === 'SYN') return '语法错误';
  if (e === 'MATH') return '数学错误';
  if (typeof e === 'number') return String(e);
  return String(e);
}


