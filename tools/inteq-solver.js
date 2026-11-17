/* WebCASIO parametric-limit integral equation solver (pure computation, no DOM).
   Solves for the parameter x:   integral_{a(x)}^{b(x)} F(t, x) dt = c
   t = dummy integration variable, x = unknown parameter (single real unknown).
   Inner integral: composite Simpson, same scheme as customInt in www/index.html.
   Outer root: sign-change scan of G(x) = I(x) - c over [xMin, xMax], then Brent.
   Not supported: Fredholm/Volterra equations (unknown function), symbolic work,
   string parsing (callers compile strings, e.g. with math.compile).

   Browser: globalThis.InteqSolver      Node: var IS = require('./inteq-solver.js');
   solveParamLimitIntegral never throws; failures return {ok:false, error:'...'}.
   Source is ASCII only; non-ASCII text must be written as \uXXXX escapes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InteqSolver = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var DEFAULT_N = 128, DEFAULT_STEPS = 2000, DEFAULT_TOL = 1e-12;
  var MAX_N = 100000, MAX_STEPS = 100000;
  var DEDUP = 1e-4;          // root clustering threshold (same as calculateRoots)
  var EPS = 2.22e-16;

  // Same idea as safeFnWrap: anything that is not a finite real becomes NaN.
  function toReal(v) {
    if (typeof v === 'number') return (isNaN(v) || !isFinite(v)) ? NaN : v;
    if (v && typeof v === 'object' && 're' in v && 'im' in v) {
      if (typeof v.re !== 'number' || typeof v.im !== 'number') return NaN;
      if (Math.abs(v.im) > 1e-12 || !isFinite(v.re)) return NaN;
      return v.re;
    }
    return NaN;
  }
  function safeCall(fn, a, b) {
    try { return toReal(fn(a, b)); } catch (e) { return NaN; }
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function evenN(n) {
    n = Math.floor(n);
    if (n < 2) n = 2;
    return n % 2 === 0 ? n : n + 1;
  }

  // Composite Simpson of F(t, x) for t in [lo, hi]; returns NaN on any bad sample.
  // counter (optional) accumulates the number of F evaluations.
  function simpson(F, lo, hi, x, n, counter) {
    if (!isNum(lo) || !isNum(hi)) return NaN;
    if (lo === hi) {   // zero-length interval: still require F to be defined there
      if (counter) counter.evals += 1;
      var v0 = safeCall(F, lo, x);
      return v0 === v0 ? 0 : NaN;
    }
    var h = (hi - lo) / n, cnt = 2;
    var s = safeCall(F, lo, x) + safeCall(F, hi, x);
    if (s === s) {
      for (var i = 1; i < n; i++) {
        var v = safeCall(F, lo + i * h, x);
        cnt++;
        if (v !== v) { s = NaN; break; }
        s += v * (i % 2 === 0 ? 2 : 4);
      }
    }
    if (counter) counter.evals += cnt;
    var r = s * h / 3;
    return isFinite(r) ? r : NaN;
  }

  // Public: same numeric scheme for reuse by the UI. Never throws, NaN on failure.
  function integrate(F, lo, hi, x, n) {
    try {
      if (typeof F !== 'function') return NaN;
      var m = (n === undefined || n === null) ? DEFAULT_N : n;
      if (!isNum(m) || m < 2 || m > MAX_N) return NaN;
      return simpson(F, toReal(lo), toReal(hi), x, evenN(m), null);
    } catch (e) { return NaN; }
  }

  // Brent root finder, same algorithm as brent() in www/index.html.
  function brent(f, a, b, tol) {
    var fa = f(a), fb = f(b);
    if (isNaN(fa) || isNaN(fb) || fa * fb > 0) return null;
    if (Math.abs(fa) < tol) return a;
    if (Math.abs(fb) < tol) return b;
    var c = a, fc = fa, d = b - a, e = d;
    for (var iter = 0; iter < 120; iter++) {
      if (fb * fc > 0) { c = a; fc = fa; d = e = b - a; }
      if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
      var tol1 = 2 * EPS * Math.abs(b) + tol * 0.5, xm = (c - b) * 0.5;
      if (Math.abs(xm) <= tol1 || Math.abs(fb) < tol) return b;
      if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
        var s = fb / fa, p, q, r;
        if (a === c) { p = 2 * xm * s; q = 1 - s; }
        else {
          q = fa / fc; r = fb / fc;
          p = s * (2 * xm * q * (q - r) - (b - a) * (r - 1));
          q = (q - 1) * (r - 1) * (s - 1);
        }
        if (p > 0) q = -q; else p = -p;
        if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) { e = d; d = p / q; }
        else { d = xm; e = d; }
      } else { d = xm; e = d; }
      a = b; fa = fb;
      b += Math.abs(d) > tol1 ? d : (xm > 0 ? tol1 : -tol1);
      fb = f(b);
      if (isNaN(fb)) return null;
    }
    return b;
  }

  function fail(msg, evals) {
    return { ok: false, roots: [], residuals: [], evals: evals || 0, error: msg };
  }
  // undefined/null -> def; otherwise must be a finite number in [lo, hi].
  function optNum(v, def, lo, hi) {
    if (v === undefined || v === null) return def;
    if (!isNum(v) || v < lo || v > hi) return null;
    return v;
  }

  function solveImpl(o) {
    if (!o || typeof o !== 'object') return fail('\u53c2\u6570\u5fc5\u987b\u662f\u4e00\u4e2a\u5bf9\u8c61');
    var F = o.F, lower = o.lower, upper = o.upper;
    if (typeof F !== 'function') return fail('\u88ab\u79ef\u51fd\u6570 F(t, x) \u5fc5\u987b\u662f\u51fd\u6570');
    if (typeof lower !== 'function') return fail('\u79ef\u5206\u4e0b\u9650 a(x) \u5fc5\u987b\u662f\u51fd\u6570');
    if (typeof upper !== 'function') return fail('\u79ef\u5206\u4e0a\u9650 b(x) \u5fc5\u987b\u662f\u51fd\u6570');
    var c = o.c;
    if (!isNum(c)) return fail('\u65b9\u7a0b\u53f3\u7aef c \u5fc5\u987b\u662f\u6709\u9650\u5b9e\u6570');
    var xMin = o.xMin, xMax = o.xMax;
    if (!isNum(xMin) || !isNum(xMax)) return fail('\u641c\u7d22\u533a\u95f4\u7aef\u70b9 xMin\u3001xMax \u5fc5\u987b\u662f\u6709\u9650\u5b9e\u6570');
    if (!(xMin < xMax)) return fail('\u641c\u7d22\u533a\u95f4\u5fc5\u987b\u6ee1\u8db3 xMin < xMax');
    var steps = optNum(o.steps, DEFAULT_STEPS, 1, MAX_STEPS);
    if (steps === null) return fail('\u626b\u63cf\u6b65\u6570 steps \u5fc5\u987b\u662f 1 \u5230 100000 \u4e4b\u95f4\u7684\u6570');
    steps = Math.floor(steps);
    var n = optNum(o.n, DEFAULT_N, 2, MAX_N);
    if (n === null) return fail('Simpson \u5b50\u533a\u95f4\u6570 n \u5fc5\u987b\u662f 2 \u5230 100000 \u4e4b\u95f4\u7684\u6570');
    n = evenN(n);
    var tol = optNum(o.tol, DEFAULT_TOL, Number.MIN_VALUE, 1);
    if (tol === null) return fail('\u6536\u655b\u5bb9\u5dee tol \u5fc5\u987b\u662f (0, 1] \u5185\u7684\u5b9e\u6570');

    var counter = { evals: 0 };
    var G = function (x) {
      var a = safeCall(lower, x), b = safeCall(upper, x);
      if (a !== a || b !== b) return NaN;
      var I = simpson(F, a, b, x, n, counter);
      return I === I ? I - c : NaN;
    };
    var xs = [], gs = [], valid = 0, i;
    for (i = 0; i <= steps; i++) {
      var x = (i === steps) ? xMax : xMin + (xMax - xMin) * i / steps;
      var g = G(x);
      xs.push(x); gs.push(g);
      if (g === g) valid++;
    }
    if (valid === 0) {
      return fail('\u5728\u6574\u4e2a\u641c\u7d22\u533a\u95f4\u5185\u79ef\u5206\u90fd\u65e0\u6cd5\u6c42\u503c\uff08\u88ab\u79ef\u51fd\u6570\u6216\u79ef\u5206\u9650\u8fd4\u56de\u4e86\u975e\u5b9e\u6570\u3001NaN \u6216\u629b\u51fa\u5f02\u5e38\uff09', counter.evals);
    }
    var cand = [];
    for (i = 0; i <= steps; i++) {
      if (gs[i] === 0) cand.push(xs[i]);
      if (i < steps && gs[i] * gs[i + 1] < 0) {   // NaN products are false
        var r = brent(G, xs[i], xs[i + 1], tol);
        if (r !== null) cand.push(r);
      }
    }
    // Reject sign changes across discontinuities/poles: residual must be small.
    var resLimit = 1e-6 * (1 + Math.abs(c));
    var list = [];
    for (i = 0; i < cand.length; i++) {
      var res = Math.abs(G(cand[i]));
      if (res === res && res <= resLimit) list.push({ x: cand[i], res: res });
    }
    list.sort(function (p, q) { return p.x - q.x; });
    var kept = [];
    for (i = 0; i < list.length; i++) {
      var last = kept[kept.length - 1];
      if (last && Math.abs(list[i].x - last.x) < DEDUP) {
        if (list[i].res < last.res) kept[kept.length - 1] = list[i];
      } else kept.push(list[i]);
    }
    return {
      ok: true,
      roots: kept.map(function (k) { return k.x; }),
      residuals: kept.map(function (k) { return k.res; }),
      evals: counter.evals,
      error: null
    };
  }

  function solveParamLimitIntegral(opts) {
    try { return solveImpl(opts); }
    catch (e) { return fail('\u6c42\u89e3\u8fc7\u7a0b\u4e2d\u53d1\u751f\u5185\u90e8\u9519\u8bef\uff1a' + (e && e.message ? e.message : String(e))); }
  }

  return {
    solveParamLimitIntegral: solveParamLimitIntegral,
    integrate: integrate,
    DEFAULT_N: DEFAULT_N,
    DEFAULT_STEPS: DEFAULT_STEPS
  };
});
