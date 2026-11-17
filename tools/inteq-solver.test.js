/* Self test for tools/inteq-solver.js.   Run: node tools/inteq-solver.test.js [--json out.json]
   Each benchmark carries its own tolerance derived from the Simpson error term
   and the Brent stopping rule; see docs/inteq-基准.md for the reasoning. */
'use strict';
var IS = require('./inteq-solver.js');
var solve = IS.solveParamLimitIntegral;
var EPS = 2.22e-16, BRENT_TOL = 1e-12;
var pass = 0, failN = 0, rows = [], failures = [];

function check(name, cond, detail) {
  if (cond) pass++; else { failN++; if (failures.length < 3) failures.push(name + ': ' + detail); }
}
// Brent stops when the bracket half-width <= 2*eps*|x| + tol/2, so the root
// error from the stopping rule alone is bounded by ~ 2*(2*eps*|x| + tol/2).
function brentBound(x) { return 2 * (2 * EPS * Math.abs(x) + BRENT_TOL / 2); }

function bench(id, desc, opts, expected, tolAbs, basis) {
  var r = solve(opts);
  var ok = r.ok && r.roots.length === 1;
  var got = ok ? r.roots[0] : NaN, abs = Math.abs(got - expected);
  rows.push({ id: id, desc: desc, expected: expected, got: got, abs: abs,
              rel: abs / Math.abs(expected), tol: tolAbs, basis: basis,
              res: ok ? r.residuals[0] : NaN, evals: r.evals });
  check('case ' + id, ok && abs <= tolAbs,
        JSON.stringify({ ok: r.ok, roots: r.roots, err: r.error, abs: abs, tol: tolAbs }));
  return r;
}
var one = function () { return 1; }, zero = function () { return 0; }, id = function (x) { return x; };

// Simpson is exact for integrands of degree <= 3 in t; the only errors left are
// floating-point summation (~ n*eps*|I|) propagated through 1/|G'(x*)|, plus Brent.
function polyTol(x, I, dG, n) { return 10 * (brentBound(x) + n * EPS * Math.abs(I) / Math.abs(dG)); }

bench(1, 'int_0^x 1 dt = 2', { F: one, lower: zero, upper: id, c: 2, xMin: 0, xMax: 5 },
      2, polyTol(2, 2, 1, 128), 'Simpson exact (deg 0); G\'=1; 10x(Brent+n*eps*|I|/|G\'|)');
bench(2, 'int_0^x t dt = 2', { F: function (t) { return t; }, lower: zero, upper: id, c: 2, xMin: 0, xMax: 5 },
      2, polyTol(2, 2, 2, 128), 'Simpson exact (deg 1); G\'=x=2');
bench(3, 'int_x^2x t dt = 6', { F: function (t) { return t; }, lower: id, upper: function (x) { return 2 * x; },
      c: 6, xMin: 0.1, xMax: 5 }, 2, polyTol(2, 6, 6, 128), 'Simpson exact (deg 1); G\'=3x=6');
bench(4, 'int_0^1 (t+x) dt = 1', { F: function (t, x) { return t + x; }, lower: zero, upper: one,
      c: 1, xMin: -3, xMax: 3 }, 0.5, polyTol(0.5, 1, 1, 128), 'Simpson exact (deg 1); G\'=1');
var x5 = Math.sqrt(8 / 3);
var F5 = function (t, x) { return t + x; };
bench(5, 'int_0^x (t+x) dt = 4', { F: F5, lower: zero, upper: id, c: 4, xMin: 0, xMax: 5 },
      x5, polyTol(x5, 4, 3 * x5, 128), 'Simpson exact (deg 1); G\'=3x');

// 6. no solution: x^3/3 = -1 has no root with x >= 0
var r6 = solve({ F: function (t) { return t * t; }, lower: zero, upper: id, c: -1, xMin: 0, xMax: 5 });
check('case 6', r6.ok === true && r6.roots.length === 0 && r6.error === null, JSON.stringify(r6));
rows.push({ id: 6, desc: 'int_0^x t^2 dt = -1, x in [0,5]', expected: 'no root', got: r6.ok ? r6.roots.length + ' roots' : r6.error });

// 7. multiple roots: int_0^x cos t dt = 1/2 -> sin x = 1/2, x in [0,7]
//    roots pi/6, 5pi/6, 13pi/6. Simpson error <= x*h^4/180*max|cos|, h = x/n.
var ex7 = [Math.PI / 6, 5 * Math.PI / 6, 13 * Math.PI / 6];
var r7 = solve({ F: function (t) { return Math.cos(t); }, lower: zero, upper: id, c: 0.5, xMin: 0, xMax: 7 });
var ok7 = r7.ok && r7.roots.length === 3;
for (var k = 0; k < 3; k++) {
  var xk = ex7[k], h = xk / 128, eI = xk * Math.pow(h, 4) / 180;
  var tol7 = 10 * (brentBound(xk) + eI / Math.abs(Math.cos(xk)));
  var g7 = ok7 ? r7.roots[k] : NaN, a7 = Math.abs(g7 - xk);
  rows.push({ id: '7.' + (k + 1), desc: 'sin x = 1/2 root ' + (k + 1), expected: xk, got: g7, abs: a7,
              rel: a7 / xk, tol: tol7, basis: '10x(Brent + x*h^4/180/|cos x|)', res: ok7 ? r7.residuals[k] : NaN });
  check('case 7.' + (k + 1), ok7 && a7 <= tol7, JSON.stringify({ roots: r7.roots, err: r7.error }));
}
for (k = 1; ok7 && k < 3; k++) check('case 7 dedup', r7.roots[k] - r7.roots[k - 1] >= 1e-4, 'roots too close');
// root exactly on a scan grid point (+-2 on a grid of step 1) must appear once each
var r7b = solve({ F: function (t) { return t; }, lower: zero, upper: id, c: 2, xMin: -5, xMax: 5, steps: 10 });
check('case 7 grid', r7b.ok && r7b.roots.length === 2 && Math.abs(r7b.roots[0] + 2) < 1e-12 &&
      Math.abs(r7b.roots[1] - 2) < 1e-12, JSON.stringify(r7b.roots));

// 8a. case 5 at n = 32/64/128: Simpson is exact for the linear integrand, so all
//     errors must already be at rounding level (monotone decrease is not observable).
var e8 = [], ns = [32, 64, 128];
for (k = 0; k < 3; k++) {
  var r8 = solve({ F: F5, lower: zero, upper: id, c: 4, xMin: 0, xMax: 5, n: ns[k] });
  e8.push(r8.ok && r8.roots.length === 1 ? Math.abs(r8.roots[0] - x5) : NaN);
  check('case 8a n=' + ns[k], e8[k] <= polyTol(x5, 4, 3 * x5, ns[k]), 'err=' + e8[k]);
}
rows.push({ id: '8a', desc: 'case 5, n=32/64/128', errs: e8.slice() });
// 8b. same shape (limit and integrand both contain x) with a non-polynomial integrand:
//     int_0^x (e^t + x) dt = 4 -> e^x - 1 + x^2 = 4. Reference root from the closed form.
function bisect(f, a, b) { for (var i = 0; i < 200; i++) { var m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; } return (a + b) / 2; }
var x8 = bisect(function (x) { return Math.exp(x) - 1 + x * x - 4; }, 0, 3);
var F8 = function (t, x) { return Math.exp(t) + x; };
var e8b = [], ns8 = [4, 8, 16, 32, 64, 128];
for (k = 0; k < ns8.length; k++) {
  var q = solve({ F: F8, lower: zero, upper: id, c: 4, xMin: 0, xMax: 3, n: ns8[k] });
  e8b.push(q.ok && q.roots.length === 1 ? Math.abs(q.roots[0] - x8) : NaN);
}
// monotone while above rounding floor (1e-13); Simpson order 4 -> ratio ~16 per halving
var floor = 1e-13, mono = true, ratios = [];
for (k = 1; k < e8b.length; k++) {
  if (e8b[k - 1] > floor) { if (!(e8b[k] < e8b[k - 1])) mono = false; ratios.push(e8b[k - 1] / e8b[k]); }
}
check('case 8b monotone', mono && e8b.every(function (v) { return v === v; }), JSON.stringify(e8b));
check('case 8b order', ratios.length >= 2 && ratios[0] > 12 && ratios[0] < 20, JSON.stringify(ratios));
rows.push({ id: '8b', desc: 'int_0^x (e^t+x) dt = 4', expected: x8, ns: ns8, errs: e8b, ratios: ratios });

// error inputs: must return ok:false with a Chinese message and never throw
function errCase(name, opts) {
  var r, threw = false;
  try { r = solve(opts); } catch (e) { threw = true; }
  check('err ' + name, !threw && r && r.ok === false && /[\u4e00-\u9fff]/.test(r.error || ''),
        threw ? 'threw' : JSON.stringify(r));
  rows.push({ id: 'E', desc: name, got: r ? r.error : 'threw' });
}
var base = { F: function (t) { return t; }, lower: zero, upper: id, c: 2, xMin: 0, xMax: 5 };
function w(patch) { var o = {}, key; for (key in base) o[key] = base[key]; for (key in patch) o[key] = patch[key]; return o; }
errCase('xMin>=xMax', w({ xMin: 5, xMax: 5 }));
errCase('c not number', w({ c: 'abc' }));
errCase('F not function', w({ F: 'x^2' }));
errCase('F returns NaN', w({ F: function () { return NaN; } }));
errCase('F throws', w({ F: function () { throw new Error('boom'); } }));
errCase('lower not function', w({ lower: 0 }));
errCase('xMin is NaN', w({ xMin: NaN }));
errCase('steps invalid', w({ steps: -3 }));
errCase('no options', undefined);
check('integrate bad F', isNaN(IS.integrate(null, 0, 1, 0)), 'expected NaN');
check('integrate t^3', Math.abs(IS.integrate(function (t) { return t * t * t; }, 0, 2, 0, 7) - 4) < 1e-14, 'odd n -> even');

console.log('pass ' + pass + ' / ' + (pass + failN));
failures.forEach(function (f) { console.log('FAIL ' + f); });
var ji = process.argv.indexOf('--json');
if (ji > 0) require('fs').writeFileSync(process.argv[ji + 1], JSON.stringify(rows, null, 1));
process.exitCode = failN ? 1 : 0;
