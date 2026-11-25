/* WebCASIO G1 syntax fuzzer: reproducible random key sequences against tools/editor-core.js.
   Run: node tools/syntax-fuzz.js [--count N] [--seed S] */
'use strict';
var EC = require('./editor-core.js');
var math = require('mathjs');

var DEFAULT_SEED = 0x6A1C2026;
var DEFAULT_COUNT = 3000;
function argVal(name, def) {
  var i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return def;
  var v = Number(process.argv[i + 1]);
  return isFinite(v) ? v : def;
}
var SEED = argVal('--seed', DEFAULT_SEED) >>> 0 || 1;
var COUNT = Math.max(1, Math.floor(argVal('--count', DEFAULT_COUNT)));

// xorshift32
var st = SEED;
function rnd() { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }

// alphabet: plain keys, structural inputs taken from the kernel tables (FN_INPUT / NODE_INPUT names), moves, delete
var DIGITS = '0123456789'.split('');
var VARS = ['a', 'b', 'c', 'x', 'y', 'z'];
var OPS = ['+', '-', '*', '/', '^'];
var STRUCT = ['frac(', 'sqrt(', 'cbrt(', 'nroot(', 'int(', 'deriv(', 'log_(', '^{}', '^{2}', '*10^{}',
  'lg(', 'log10(', 'log(', 'sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(', 'f(', 'g(', 'pi', 'e', 'Ans'];
var CTRL = ['L', 'R', 'DEL'];   // moveCursor(-1), moveCursor(1), deleteLast()
var GROUPS = [
  [DIGITS, 30], [['.'], 6], [VARS, 10], [OPS, 20], [['(', ')'], 10], [[','], 3], [STRUCT, 12], [CTRL, 9]
];
var GW = GROUPS.reduce(function (s, g) { return s + g[1]; }, 0);
function randKey() {
  var r = rnd() * GW;
  for (var i = 0; i < GROUPS.length; i++) { r -= GROUPS[i][1]; if (r < 0) return pick(GROUPS[i][0]); }
  return pick(DIGITS);
}
function randLen(tier) {
  if (tier === 0) return 1 + Math.floor(rnd() * 3);
  if (tier === 1) return 4 + Math.floor(rnd() * 7);
  return 11 + Math.floor(rnd() * 20);
}

var KEY = 'fuzz';
var CONSERVED = /^[0-9abcxyz]$/;
function treeChars(block, out) {
  for (var i = 0; i < block.length; i++) {
    var it = block[i];
    if (it.t === 'd' && CONSERVED.test(it.v)) out[it.v] = (out[it.v] || 0) + 1;
    else if (it.t === 'var' && CONSERVED.test(it.v)) out[it.v] = (out[it.v] || 0) + 1;
    if (EC.isNode(it)) for (var s = 0; s < it.s.length; s++) treeChars(it.s[s], out);
  }
  return out;
}
function strChars(s) { var o = {}; for (var i = 0; i < s.length; i++) if (CONSERVED.test(s[i])) o[s[i]] = (o[s[i]] || 0) + 1; return o; }
function subset(a, b) { for (var k in a) if ((b[k] || 0) < a[k]) return k; return null; }
function diff(after, before) {   // after - before (may be negative)
  var o = {}, k;
  for (k in after) o[k] = (o[k] || 0) + after[k];
  for (k in before) o[k] = (o[k] || 0) - before[k];
  for (k in o) if (!o[k]) delete o[k];
  return o;
}
function texBraces(t) {
  var d = 0, s = t.replace(/\\[{}]/g, '');
  for (var i = 0; i < s.length; i++) { if (s[i] === '{') d++; else if (s[i] === '}') { d--; if (d < 0) return false; } }
  return d === 0;
}

// play a sequence; returns { ser, val, tex, err } where err is the first failed assertion (or null)
function play(seq) {
  EC.setKey(KEY);
  EC.clearAll();
  var e = EC.ed(KEY), ledger = {}, deleted = false;
  try {
    for (var i = 0; i < seq.length; i++) {
      var k = seq[i], before = treeChars(e.root, {}), acc;
      if (k === 'L') acc = EC.moveCursor(-1);
      else if (k === 'R') acc = EC.moveCursor(1);
      else if (k === 'DEL') { acc = EC.deleteLast(); deleted = true; }
      else acc = EC.append(k);
      var d = diff(treeChars(e.root, {}), before), keys = Object.keys(d);
      if (k === 'DEL') {
        if (keys.length > 1 || (keys.length === 1 && d[keys[0]] !== -1)) return { err: 'conservation: delete removed ' + JSON.stringify(d) };
      } else if (CONSERVED.test(k) && acc) {
        if (keys.length !== 1 || d[k] !== 1) return { err: 'conservation: append ' + k + ' changed ' + JSON.stringify(d) };
      } else if (k === '^{2}' && acc) {   // the square key inserts its own '2'
        if (keys.length !== 1 || d['2'] !== 1) return { err: 'conservation: ^{2} changed ' + JSON.stringify(d) };
      } else if (keys.length) return { err: 'conservation: key ' + k + ' changed ' + JSON.stringify(d) };
      if (CONSERVED.test(k) && !acc) return { err: 'conservation: key ' + k + ' rejected' };
      for (var c in d) ledger[c] = (ledger[c] || 0) + d[c];
    }
    var ser = EC.serialize(KEY);
    var tex = EC.renderTex(KEY, { cursor: true, anchors: true });
    var tex2 = EC.renderTex(KEY, { cursor: false });
    var val = EC.validate(KEY);
  } catch (ex) { return { err: 'exception: ' + (ex && ex.message) }; }
  // character conservation: ledger (accepted inputs minus deletions) == tree, and tree subset of serialization
  var tc = treeChars(e.root, {});
  if (Object.keys(diff(tc, ledger)).length) return { err: 'conservation: ledger ' + JSON.stringify(ledger) + ' tree ' + JSON.stringify(tc) };
  var miss = subset(tc, strChars(ser));
  if (miss) return { err: 'conservation: "' + miss + '" lost in ' + JSON.stringify(ser) };
  if (!deleted) {
    var inp = strChars(seq.filter(function (k) { return CONSERVED.test(k); }).join(''));
    miss = subset(inp, strChars(ser));
    if (miss) return { err: 'conservation: input "' + miss + '" lost in ' + JSON.stringify(ser) };
  }
  // validate shape
  if (!val || (val.ok !== true && val.ok !== false)) return { err: 'validate shape ' + JSON.stringify(val) };
  if (!val.ok && (!/^[A-Z_]+$/.test(val.code) || !/^[\x20-\x7e]+$/.test(val.message) || typeof val.pos !== 'number')) return { err: 'validate fields ' + JSON.stringify(val) };
  if (!val.ok && EC.setCursorPath(KEY, val.path) !== true) return { err: 'validate path unresolvable ' + val.path };
  // TeX
  var texes = [tex, tex2];
  for (var t = 0; t < 2; t++) {
    if (typeof texes[t] !== 'string' || !texBraces(texes[t])) return { err: 'tex braces ' + JSON.stringify(texes[t]) };
    if (/undefined|NaN|null/.test(texes[t])) return { err: 'tex junk ' + JSON.stringify(texes[t]) };
  }
  // mathjs consistency
  var parsed = true;
  try { math.parse(ser); } catch (ex2) { parsed = false; }
  if (val.ok && !parsed) return { err: 'MISSED: validate ok but mathjs fails on ' + JSON.stringify(ser) };
  // cursor paths
  try {
    var paths = EC.cursorPositions(KEY);
    for (var p = 0; p < paths.length; p++) {
      if (EC.setCursorPath(KEY, paths[p]) !== true) return { err: 'setCursorPath false ' + paths[p] };
      if (EC.cursorPath(EC.ed(KEY)) !== paths[p]) return { err: 'cursorPath readback ' + paths[p] + ' -> ' + EC.cursorPath(EC.ed(KEY)) };
    }
    if (EC.serialize(KEY) !== ser) return { err: 'cursor walk changed serialization' };
  } catch (ex3) { return { err: 'exception in cursor walk: ' + (ex3 && ex3.message) }; }
  return { ser: ser, val: val, tex: tex2, parsed: parsed, err: null };
}
function check(seq) {
  var a = play(seq);
  if (a.err) return a;
  var b = play(seq);
  if (b.err) return b;
  if (a.ser !== b.ser || a.tex !== b.tex || JSON.stringify(a.val) !== JSON.stringify(b.val)) return { err: 'not idempotent ' + JSON.stringify(a.ser) + ' vs ' + JSON.stringify(b.ser) };
  return a;
}
// greedy delta minimization: drop single keys while the sequence still fails with the same kind of error
function kind(err) { return err.split(/[: ]/)[0]; }
function minimize(seq, err) {
  var cur = seq.slice(), changed = true;
  while (changed) {
    changed = false;
    for (var i = 0; i < cur.length; i++) {
      var cand = cur.slice(0, i).concat(cur.slice(i + 1));
      if (!cand.length) continue;
      var r = check(cand);
      if (r.err && kind(r.err) === kind(err)) { cur = cand; err = r.err; changed = true; break; }
    }
  }
  return { seq: cur, err: err };
}

var pass = 0, fail = 0, fails = [], strictOnly = 0, strictSamples = [], codes = {}, tiers = [0, 0, 0], okCount = 0;
for (var n = 0; n < COUNT; n++) {
  var tier = n % 3, len = randLen(tier), seq = [];
  tiers[tier]++;
  for (var i = 0; i < len; i++) seq.push(randKey());
  var r = check(seq);
  if (r.err) {
    fail++;
    if (fails.length < 20) fails.push(minimize(seq, r.err));
    continue;
  }
  pass++;
  if (r.val.ok) okCount++;
  else {
    codes[r.val.code] = (codes[r.val.code] || 0) + 1;
    if (r.parsed) { strictOnly++; if (strictSamples.length < 8 && r.val.code !== 'EMPTY') strictSamples.push(seq.join(' ') + '  =>  ' + JSON.stringify(r.ser) + ' ' + r.val.code); }
  }
}
EC.setKey(null);
console.log('tiers short/mid/long=' + tiers.join('/') + ' validate_ok=' + okCount + ' codes=' + JSON.stringify(codes));
console.log('strict-only (validate rejects, mathjs parses): ' + strictOnly);
strictSamples.forEach(function (s) { console.log('  ' + s); });
fails.forEach(function (f) { console.log('FAIL [' + f.seq.map(function (k) { return JSON.stringify(k); }).join(', ') + '] ' + f.err); });
console.log('FUZZ seed=' + SEED + ' sequences=' + COUNT + ' pass=' + pass + ' fail=' + fail);
if (fail) process.exitCode = 1;
