/* WebCASIO S2 editor-core tests. Run: node tools/editor-core.test.js */
'use strict';
var EC = require('./editor-core.js');

var pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL: ' + msg); } }
function eq(got, want, msg) { ok(got === want, msg + ' got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
function count(s, sub) { var n = 0, i = 0; for (;;) { i = s.indexOf(sub, i); if (i < 0) return n; n++; i += sub.length; } }

/* ---- structural invariants ---- */
function reachable(root, target) {
  if (root === target) return true;
  for (var i = 0; i < root.length; i++) {
    var it = root[i];
    if (EC.isNode(it)) for (var s = 0; s < it.s.length; s++) if (reachable(it.s[s], target)) return true;
  }
  return false;
}
function parenBalanced(block) {
  var depth = 0;
  for (var i = 0; i < block.length; i++) {
    var it = block[i];
    if (it.t === 'open') depth++;
    else if (it.t === 'close') { depth--; if (depth < 0) return false; }
    if (EC.isNode(it)) for (var s = 0; s < it.s.length; s++) if (!parenBalanced(it.s[s])) return false;
  }
  return true;
}
// expected \square count: every empty slot + every empty fn body without the cursor in it
function expectedSquares(block, cur) {
  var n = 0;
  for (var i = 0; i < block.length; i++) {
    var it = block[i];
    if (EC.isNode(it)) {
      for (var s = 0; s < it.s.length; s++) {
        if (it.s[s].length === 0) n++;
        else n += expectedSquares(it.s[s], cur);
      }
    } else if (it.t === 'open') {
      var nx = block[i + 1];
      var emptyBody = !nx || nx.t === 'close';
      var curIn = cur && cur.block === block && cur.idx === i + 1;
      if (emptyBody && !curIn) n++;
    }
  }
  return n;
}
function checkInvariants(key, label) {
  var e = EC.ed(key);
  var tex = EC.renderTex(key);
  ok(reachable(e.root, e.cur.block), label + ': cursor block reachable');
  ok(e.cur.idx >= 0 && e.cur.idx <= e.cur.block.length, label + ': cursor idx in range');
  ok(parenBalanced(e.root), label + ': every close has an open');
  eq(count(tex, 'cursor-blink'), 1, label + ': one cursor in tex');
  ok(tex.indexOf('{}') < 0, label + ': no empty group in tex ' + tex);
  var sq = count(tex, '\\square') - count(tex, 'base-missing');
  eq(sq, expectedSquares(e.root, e.cur), label + ': square count in ' + tex);
  var plain = EC.renderTex(key, { cursor: false });
  eq(count(plain, 'cursor-blink'), 0, label + ': cursor:false hides cursor');
}

/* ---- sequence runner ---- */
function step(t) {
  if (t === 'DEL') return EC.deleteLast();
  if (t === 'L') return EC.moveCursor(-1);
  if (t === 'R') return EC.moveCursor('right');
  if (t === 'LL') return EC.moveCursor('left');
  return EC.append(t);
}
function seq(name, tokens, wantSer, opt) {
  opt = opt || {};
  EC.setKey('t');
  EC.clearAll();
  var acc = [];
  tokens.forEach(function (t, i) {
    acc.push(step(t));
    checkInvariants('t', name + ' step ' + i + ' [' + t + ']');
  });
  eq(EC.serialize(), wantSer, name + ': ser');
  if (opt.accepted) eq(acc.map(function (a) { return a ? 1 : 0; }).join(''), opt.accepted, name + ': accepted');
  if (opt.cur) eq(EC.__dbg().cur, opt.cur, name + ': cursor path');
  if (opt.tex) ok(EC.renderTex({ cursor: false }) === opt.tex, name + ': tex ' + EC.renderTex({ cursor: false }));
  if (opt.texHas) opt.texHas.forEach(function (h) { ok(EC.renderTex().indexOf(h) >= 0, name + ': tex has ' + h); });
  EC.setKey(null);
}

/* ---- nodes ---- */
seq('frac', ['frac(', '1', ',', '2'], '((1)/(2))', { cur: 'root>frac@0.s1:1', tex: '\\frac{1}{2}' });
seq('frac comma out', ['frac(', '1', ',', '2', ',', '3'], '(((1)/(2))*3)', { cur: 'root:2' });
seq('frac empty', ['frac('], '((\u0000)/(\u0000))', { tex: '\\frac{\\square}{\\square}' });
seq('pow', ['2', '^{}', '3'], '((2)^(3))', { cur: 'root>pow@1.s0:1', tex: '{2}^{3}' });
seq('pow missing base', ['^{}', '2'], '((\u0000)^(2))', { texHas: ['base-missing'] });
seq('square', ['3', '^{2}', '+', '1'], '((3)^(2))+1', { cur: 'root:4' });
seq('square of square', ['3', '^{2}', '^{2}'], '((((3)^(2)))^(2))', { texHas: ['\\left({3}^{2}\\right)'] });
seq('sqrt', ['sqrt(', '2', 'R', '+', '1'], 'sqrt((2))+1', { cur: 'root:3', tex: '\\sqrt{2}+1' });
seq('int', ['int(', 'x', ',', '0', ',', '1'], 'int((x),(0),(1))', { tex: '\\int_{0}^{1} x\\,\\mathrm{d}x' });
seq('int empty', ['int('], 'int((\u0000),(\u0000),(\u0000))');
seq('deriv', ['deriv(', 'x', '^{2}', ',', '3'], 'deriv((((x)^(2))),(3))',
  { texHas: ['\\frac{\\mathrm{d}}{\\mathrm{d}x}', '_{x=3'] });
seq('sci', ['1', '.', '5', '*10^{}', '3'], '((1.5)*10^(3))', { tex: '{1.5}\\times10^{3}' });
seq('sci missing base', ['*10^{}', '3'], '((1)*10^(3))', { tex: '\\times10^{3}' });

/* ---- nesting ---- */
seq('frac of sqrt', ['frac(', 'sqrt(', '2', 'R', ',', '3', 'R', '+', '1'], '((sqrt((2)))/(3))+1',
  { cur: 'root:3', tex: '\\frac{\\sqrt{2}}{3}+1' });
seq('sqrt of sin', ['sqrt(', 'sin(', 'x'], 'sqrt((sin(x)))', { cur: 'root>sqrt@0.s0:2', texHas: ['ghost-paren'] });
seq('frac in int', ['int(', 'frac(', '1', ',', 'x', ',', ',', '1', ',', '2'], 'int((((1)/(x))),(1),(2))');
seq('pow in frac den', ['frac(', '1', ',', 'x', '^{}', '2'], '((1)/(((x)^(2))))', { cur: 'root>frac@0.s1>pow@1.s0:1' });

/* ---- parentheses ---- */
seq('stray close at root', [')'], '\u0000)', { accepted: '1', cur: 'root:1', tex: ')' });
seq('extra close after sqrt', ['sqrt(', '2', 'R', ')'], 'sqrt((2))\u0000)', { accepted: '1111', tex: '\\sqrt{2})' });
seq('group times var', ['(', '1', '+', '2', ')', 'x'], '((1+2)*x)');
seq('open unclosed', ['2', '('], '(2*(\u0000))', { texHas: ['ghost-paren'] });
seq('open then del', ['(', 'DEL'], '');
seq('del open removes close', ['(', '1', ')', 'L', 'L', 'L', 'DEL'], '(1)', { accepted: '1111110', cur: 'root:0' });
seq('skip over close', ['(', '1', ')', 'L', ')', '+'], '(1)+', { cur: 'root:4' });

/* ---- deletion ---- */
seq('pow del back to base', ['2', '^{}', '3', 'DEL', 'DEL'], '2', { cur: 'root:1' });
seq('int del to empty', ['int(', 'x', ',', '0', ',', '1', 'DEL', 'DEL', 'DEL', 'DEL', 'DEL', 'DEL'], '');
seq('deriv del to empty', ['deriv(', 'x', ',', '3', 'DEL', 'DEL', 'DEL', 'DEL'], '');
seq('frac comma del', ['frac(', ',', 'DEL'], '');
seq('frac keep numerator', ['frac(', '1', ',', 'DEL'], '((1)/(\u0000))', { cur: 'root>frac@0.s0:1' });
seq('del into node', ['frac(', '1', ',', '2', ')', 'DEL'], '((1)/(2))', { cur: 'root>frac@0.s1:1' });
seq('unwrap sqrt', ['sqrt(', '2', 'L', 'DEL'], '2', { cur: 'root:0' });
seq('unwrap sin keeps close', ['sqrt(', 'sin(', 'x', 'L', 'L', 'DEL'], 'sin(x)', { cur: 'root:0' });
seq('del at root start', ['1', 'L', 'DEL'], '1', { accepted: '110' });
seq('del everything', ['1', '+', 'sin(', '2', ')', 'DEL', 'DEL', 'DEL', 'DEL', 'DEL', 'DEL'], '', { accepted: '11111111110' });

/* ---- cursor ---- */
seq('pow right out', ['2', '^{}', '3', 'R', '+', '1'], '((2)^(3))+1', { cur: 'root:4' });
seq('pow left to start', ['2', '^{}', '3', 'L', 'L', 'L'], '((2)^(3))', { cur: 'root:0' });
seq('pow left right', ['2', '^{}', '3', 'L', 'L', 'L', 'R', 'R', 'R', 'R'], '((2)^(3))', { cur: 'root:2', accepted: '1111111111' });
seq('pow left then right', ['2', '^{}', '3', 'LL', 'LL', 'R'], '((2)^(3))', { cur: 'root>pow@1.s0:0' });
seq('frac right into den', ['frac(', '1', 'R', '2'], '((1)/(2))', { cur: 'root>frac@0.s1:1' });
seq('frac right out', ['frac(', '1', ',', '2', 'R', '2'], '(((1)/(2))*2)', { cur: 'root:2' });
seq('left into last slot', ['frac(', '1', ',', '2', 'R', 'L'], '((1)/(2))', { cur: 'root>frac@0.s1:1' });
seq('insert in middle', ['1', '3', 'L', '2'], '123', { cur: 'root:2' });

/* ---- implicit multiplication ---- */
seq('2x', ['2', 'x'], '(2*x)', { tex: '2x' });
seq('x2', ['x', '2'], '(x*2)', { tex: 'x\\cdot 2' });
seq('2.5e', ['2', '.', '5', 'e'], '(2.5*e)');
seq('digits merge', ['1', '2', '+', '3', '4'], '12+34');

/* ---- constants / functions / Ans ---- */
seq('const e', ['const:e'], 'e', { texHas: ['const-sym'] });
seq('const qe', ['const:qe', '*', '2'], '1.602176634e-19*2', { tex: '\\htmlClass{const-sym}{e}\\times 2' });
seq('const pi', ['const:pi'], 'pi', { texHas: ['\\pi'] });
seq('const bogus', ['const:bogus'], '', { accepted: '0' });
seq('log10', ['log10(', '1', '0', '0', ')'], 'log10(100)', { tex: '\\lg\\left(100\\right)' });
seq('log', ['log(', '2', ')'], 'log(2)', { tex: '\\ln\\left(2\\right)' });
seq('f', ['f(', '2', ')'], 'f(2)');
seq('g', ['g(', 'x', ')'], 'g(x)');
seq('sin cos tan', ['sin(', '1', ')', '+', 'cos(', '2', ')', '+', 'tan(', '3', ')'], 'sin(1)+cos(2)+tan(3)');
seq('sin unclosed', ['sin(', '2'], 'sin(2)', { texHas: ['ghost-paren'] });
seq('empty sin', ['sin('], 'sin(\u0000)');
seq('Ans', ['Ans', '+', '1'], 'Ans+1', { tex: '\\mathrm{Ans}+1' });
seq('ans lowercase rejected', ['ans'], '', { accepted: '0' });
seq('unknown token', ['alpha'], '', { accepted: '0' });

/* ---- clearAll / renderTex / __dbg ---- */
(function () {
  EC.setKey('t'); EC.clearAll();
  EC.append('1'); EC.append('+'); EC.append('2');
  ok(EC.clearAll() === true, 'clearAll returns true');
  eq(EC.serialize(), '', 'clearAll empties');
  ok(EC.isEmpty('t'), 'isEmpty after clear');
  eq(EC.renderTex(), EC.CUR_TEX, 'empty tex is cursor');
  eq(EC.renderTex({ cursor: false }), '', 'empty tex without cursor');
  EC.append('7');
  var d = EC.__dbg();
  eq(d.key, 't', 'dbg key'); eq(d.ser, '7', 'dbg ser'); eq(d.cur, 'root:1', 'dbg cur'); eq(d.empty, false, 'dbg empty');
  EC.append('L'); // not a valid token
  eq(EC.serialize(), '7', 'invalid token ignored');
  EC.moveCursor(-1); EC.cursorToEnd('t');
  eq(EC.__dbg().cur, 'root:1', 'cursorToEnd');
  EC.setKey(null);
})();

/* ---- keyToInput ---- */
(function () {
  eq(EC.keyToInput('^'), '^{}', 'keyToInput ^');
  ['1', '.', '+', '-', '*', '/', '(', ')', ',', 'x', 'e', 'a'].forEach(function (k) { eq(EC.keyToInput(k), k, 'keyToInput ' + k); });
  ['q', 'k', 'Q', 'Enter', 'sin', '', undefined, 5].forEach(function (k) { eq(EC.keyToInput(k), null, 'keyToInput rejects ' + String(k)); });
})();

/* ---- host integration: default key selection and write-back ---- */
(function () {
  var g = globalThis;
  g.state = { mode: 'calc', funcTarget: 'f', expr: { main: '', fx: '', gx: '' } };
  g.varExprs = { a: '', b: '', c: '', x: '', y: '', z: '' };
  g.activeVar = 'a';
  EC.setKey(null);
  EC.configure({ getKey: null, onChange: null });

  eq(EC.activeEditorKey(), 'main', 'default key main');
  EC.clearAll(); EC.append('1'); EC.append('+'); EC.append('2');
  eq(g.state.expr.main, '1+2', 'write-back main');

  // bug 7: fx editor, x^2
  g.state.mode = 'funcs'; g.state.funcTarget = 'f';
  eq(EC.activeEditorKey(), 'fx', 'default key fx');
  EC.clearAll(); EC.append('x'); EC.append('^{}'); EC.append('2');
  eq(g.state.expr.fx, '((x)^(2))', 'bug7 fx write-back');
  g.state.funcTarget = 'g';
  eq(EC.activeEditorKey(), 'gx', 'default key gx');
  EC.clearAll(); EC.append('2'); EC.append('x');
  eq(g.state.expr.gx, '(2*x)', 'write-back gx');
  eq(g.state.expr.fx, '((x)^(2))', 'fx untouched by gx edits');

  g.state.mode = 'vars'; g.activeVar = 'b';
  eq(EC.activeEditorKey(), 'var_b', 'default key var_b');
  EC.clearAll(); EC.append('3'); EC.append('.'); EC.append('5');
  eq(g.varExprs.b, '3.5', 'write-back var b');
  g.activeVar = 'z';
  EC.clearAll(); EC.append('const:c0');
  eq(EC.activeEditorKey(), 'var_z', 'default key var_z');
  ok(g.varExprs.z.length > 0, 'write-back var z ' + g.varExprs.z);
  eq(g.varExprs.b, '3.5', 'var b untouched');

  g.state.mode = 'calc';
  eq(EC.serialize('main'), '1+2', 'main editor kept its content');

  // configure overrides
  var log = [];
  EC.configure({ getKey: function () { return 'custom'; }, onChange: function (k, s) { log.push(k + '=' + s); } });
  EC.clearAll(); EC.append('9');
  eq(EC.activeEditorKey(), 'custom', 'configure getKey');
  eq(log[log.length - 1], 'custom=9', 'configure onChange');
  eq(g.state.expr.main, '1+2', 'default write-back bypassed');
  EC.moveCursor(-1); EC.deleteLast();
  eq(log.length, 4, 'onChange fires on every edit call');
  EC.setKey('pinned');
  eq(EC.activeEditorKey(), 'pinned', 'setKey beats configure getKey');
  EC.setKey(null);
  EC.configure({ getKey: null, onChange: null });
  eq(EC.activeEditorKey(), 'main', 'configure reset');

  delete g.state; delete g.varExprs; delete g.activeVar;
  eq(EC.activeEditorKey(), 'main', 'no host globals -> main');
})();

/* ---- the nine old bugs, at kernel level ---- */
seq('bug1 sqrt closes', ['sqrt(', '2', 'R', '+', '1'], 'sqrt((2))+1', { cur: 'root:3' });
(function () { EC.setKey('t'); EC.clearAll(); eq(EC.serialize(), '', 'bug2 empty tree serializes to empty'); EC.setKey(null); })();
seq('bug3/4 pow del', ['2', '^{}', '3', 'DEL', 'DEL'], '2');
seq('bug5 int del + comma', ['int(', 'x', ',', '0', ',', '1', 'DEL', 'DEL', 'DEL', 'DEL', 'DEL', 'DEL'], '', { accepted: '111111111111' });
seq('bug6 2x', ['2', 'x'], '(2*x)');
seq('bug6 x2', ['x', '2'], '(x*2)');
// bug7 is covered in host integration above
eq(EC.keyToInput('q'), null, 'bug8 stray letter');
seq('bug9 unknown append', ['alpha'], '', { accepted: '0' });

/* ---- K1: stray right bracket (xclose) ---- */
var MJ = require('../www/math.min.js');
function parses(code) { try { MJ.parse(code); return true; } catch (err) { return false; } }
seq('xclose sqrt', ['sqrt(', '8', ')'], 'sqrt((8\u0000)))', { cur: 'root>sqrt@0.s0:2', tex: '\\sqrt{8)}', accepted: '111' });
(function () {
  seq('xclose sqrt render', ['sqrt(', '8', ')'], 'sqrt((8\u0000)))');
  EC.setKey('t');
  ok(EC.renderTex({ cursor: false }).indexOf('\\sqrt{8)}') >= 0, 'xclose: tex contains \\sqrt{8)}');
  ok(!parses(EC.serialize()), 'xclose: serialization is not math.parse-able');
  eq(EC.ed('t').root[0].s[0][1].t, 'xclose', 'xclose: item type');
  EC.setKey(null);
})();
seq('xclose twice', ['sqrt(', '8', ')', ')'], 'sqrt((8\u0000)\u0000)))', { cur: 'root>sqrt@0.s0:3', tex: '\\sqrt{8))}', accepted: '1111' });
(function () { seq('xclose twice parse', ['sqrt(', '8', ')', ')'], 'sqrt((8\u0000)\u0000)))'); EC.setKey('t'); ok(!parses(EC.serialize()), 'xclose twice: not parse-able'); EC.setKey(null); })();
seq('xclose frac num', ['frac(', '1', ')', ',', '2'], '((1\u0000))/(2))', { tex: '\\frac{1)}{2}' });
seq('xclose del whole item', ['sqrt(', '8', ')', 'DEL'], 'sqrt((8))', { cur: 'root>sqrt@0.s0:1', tex: '\\sqrt{8}' });
seq('xclose del twice', ['sqrt(', '8', ')', ')', 'DEL', 'DEL', ')'], 'sqrt((8\u0000)))', { cur: 'root>sqrt@0.s0:2' });
seq('xclose move over', ['sqrt(', '8', ')', 'L', 'L', 'R', 'R'], 'sqrt((8\u0000)))', { cur: 'root>sqrt@0.s0:2' });
// kept behaviour
seq('paren close normal', ['(', '1', '+', '2', ')'], '(1+2)', { cur: 'root:5', tex: '\\left(1+2\\right)' });
(function () { seq('paren close parse', ['(', '1', '+', '2', ')'], '(1+2)'); EC.setKey('t'); ok(parses(EC.serialize()), 'paren close: parse-able'); EC.setKey(null); })();
seq('paren close in sqrt', ['sqrt(', '(', '1', ')', '+', '2'], 'sqrt(((1)+2))', { cur: 'root>sqrt@0.s0:5' });
seq('close skip right', ['(', '1', ')', 'L', ')'], '(1)', { cur: 'root:3', accepted: '11111' });
seq('close skip right in sqrt', ['sqrt(', '(', '1', ')', 'L', ')'], 'sqrt(((1)))', { cur: 'root>sqrt@0.s0:3' });
seq('root stray close', ['1', ')'], '1\u0000)', { cur: 'root:2', accepted: '11' });
seq('comma unchanged frac', ['frac(', '1', ',', '2', ','], '((1)/(2))', { cur: 'root:1' });
seq('comma unchanged in sqrt', ['sqrt(', '2', ','], 'sqrt((2))', { cur: 'root>sqrt@0.s0:1', accepted: '110' });

/* ---- K1: anchors / setCursorPath / cursorPositions ---- */
(function () {
  var base = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '__anchors-baseline.json'), 'utf8'));
  ok(base.length >= 20, 'baseline has >= 20 cases');
  function play(tokens) { EC.setKey('t'); EC.clearAll(); tokens.forEach(function (t) { step(t === 'L' ? 'LL' : t); }); }
  var allEq = true, roundTrips = 0;
  base.forEach(function (c, ci) {
    play(c.seq);
    var same = EC.renderTex() === c.tex && EC.renderTex({ cursor: true }) === c.texCursor &&
      EC.renderTex({ cursor: false }) === c.texNoCursor && EC.renderTex({ cursor: true, anchors: false }) === c.texCursor &&
      EC.renderTex({ cursor: false, anchors: false }) === c.texNoCursor;
    if (!same) allEq = false;
    ok(same, 'baseline tex equal #' + ci);
    var e = EC.ed('t'), here = EC.cursorPath(e), cur0 = e.cur.block, idx0 = e.cur.idx;
    var pos = EC.cursorPositions('t');
    ok(pos.indexOf(here) >= 0, 'positions contain cursor #' + ci);
    var a = EC.renderTex('t', { cursor: true, anchors: true });
    eq(count(a, 'ec-anchor'), pos.length, 'anchor count #' + ci);
    // each position has exactly one anchor (TeX order may differ from slot order for int bounds)
    pos.forEach(function (p) { eq(count(a, '\\htmlId{ec-' + p + '}'), 1, 'anchor once ' + p + ' #' + ci); });
    pos.forEach(function (p) {
      ok(EC.setCursorPath('t', p) === true, 'setCursorPath ok ' + p);
      eq(EC.cursorPath(EC.ed('t')), p, 'round trip #' + ci);
      roundTrips++;
    });
    ok(EC.setCursorPath('t', here) && EC.ed('t').cur.block === cur0 && EC.ed('t').cur.idx === idx0, 'restore #' + ci);
    var snap = JSON.stringify(EC.ed('t').root), ser = EC.serialize('t');
    ['', 'root', 'root:-1', 'root:01', 'root:' + (EC.ed('t').root.length + 1), 'x:0', 'root>sqrt@99.s0:0',
      'root>frac@0.s9:0', 'root>zzz@0.s0:0', 'root:1:2', null, 5].forEach(function (bad) {
      ok(EC.setCursorPath('t', bad) === false, 'reject bad path ' + JSON.stringify(bad) + ' #' + ci);
    });
    ok(EC.ed('t').cur.block === cur0 && EC.ed('t').cur.idx === idx0 && JSON.stringify(EC.ed('t').root) === snap && EC.serialize('t') === ser,
      'bad paths leave state unchanged #' + ci);
  });
  ok(allEq, 'anchors:false output equals baseline (all cases)');
  ok(roundTrips >= 20, 'round trips >= 20 (' + roundTrips + ')');
  // positions order equals stepping right from the start
  play(['frac(', 'sqrt(', '2', 'R', ',', 'x', '^{}', '3', 'R', 'R', '+', '1']);
  var pos = EC.cursorPositions('t');
  EC.setCursorPath('t', 'root:0');
  var walked = [EC.cursorPath(EC.ed('t'))];
  while (EC.moveCursor('right')) walked.push(EC.cursorPath(EC.ed('t')));
  eq(walked.join(' '), pos.join(' '), 'cursorPositions order equals moveCursor right walk');
  eq(EC.cursorPositions('no-such-key').length, 0, 'unknown key: no positions');
  ok(EC.setCursorPath('no-such-key', 'root:0') === false && !Object.prototype.hasOwnProperty.call(EC.editors, 'no-such-key'), 'unknown key rejected');
  EC.clearAll();
  eq(EC.renderTex('t', { cursor: true, anchors: true }), EC.anchorTex('root:0') + EC.CUR_TEX, 'empty editor anchors');
  eq(EC.anchorTex('root>sqrt@0.s0:1'), '\\htmlId{ec-root>sqrt@0.s0:1}{\\htmlClass{ec-anchor}{\\vphantom{|}}}', 'anchor tex format');
  EC.setKey(null);
})();

/* ---- K2: root-level stray ')' ---- */
(function () {
  function synErr(code) { try { MJ.parse(code); return false; } catch (err) { return err instanceof SyntaxError || /syntax|unexpected|char/i.test(String(err.message)); } }
  seq('empty then close', [')'], '\u0000)');
  EC.setKey('t');
  ok(synErr(EC.serialize()), 'empty expr + ) : "=" (math.parse) raises syntax error');
  eq(EC.ed('t').root[0].t, 'xclose', 'root ) inserts xclose');
  EC.setKey(null);
  seq('root stray close parse', ['1', '+', '2', ')'], '1+2\u0000)');
  EC.setKey('t'); ok(synErr(EC.serialize()), '1+2) : syntax error'); EC.setKey(null);
  seq('root stray close del', ['1', ')', 'DEL'], '1', { cur: 'root:1' });
  seq('root paired close kept', ['(', '1', ')', ')'], '(1)\u0000)', { cur: 'root:4', accepted: '1111' });
})();

/* ---- K2: logb node ---- */
eq(EC.NODE_SLOTS.logb, 2, 'logb has 2 slots');
seq('logb', ['log_(', '8', ',', '2'], 'log((8),(2))', { cur: 'root>logb@0.s1:1', tex: '\\log_{2}\\left(8\\right)' });
(function () {
  seq('logb eval', ['log_(', '8', ',', '2'], 'log((8),(2))');
  EC.setKey('t');
  var v = MJ.evaluate(EC.serialize());
  ok(Math.abs(v - 3) < 1e-12, 'logb log_2(8) evaluates to 3, got ' + v);
  EC.setKey(null);
  seq('logb empty', ['log_('], 'log((\u0000),(\u0000))', { cur: 'root>logb@0.s0:0', tex: '\\log_{\\square}\\left(\\square\\right)' });
  EC.setKey('t');
  var sr = EC.serialize();
  ok(sr.indexOf('\u0000') >= 0 && !parses(sr), 'logb empty slots: has EMPTY_MARK and not parse-able');
  EC.setKey(null);
  seq('logb base empty', ['log_(', '8'], 'log((8),(\u0000))');
  EC.setKey('t'); ok(!parses(EC.serialize()), 'logb empty base not parse-able'); EC.setKey(null);
})();
seq('logb comma out', ['log_(', '8', ',', '2', ',', '+', '1'], 'log((8),(2))+1', { cur: 'root:3' });
seq('logb pow base', ['log_(', '8', ',', '2', ',', '^{}', '2'], '((log((8),(2)))^(2))',
  { tex: '{\\left(\\log_{2}\\left(8\\right)\\right)}^{2}' });
seq('logb square', ['log_(', '8', ',', '2', ',', '^{2}'], '((log((8),(2)))^(2))', { texHas: ['\\left(\\log_{2}\\left(8\\right)\\right)}^{2}'] });
seq('logb times digit', ['2', 'log_(', 'x', ',', '3'], '(2*log((x),(3)))');
seq('logb nested sqrt', ['log_(', 'sqrt(', 'x', 'R', ',', 'b'], 'log((sqrt((x))),(b))', { tex: '\\log_{b}\\left(\\sqrt{x}\\right)' });
seq('logb xclose in arg', ['log_(', '8', ')'], 'log((8\u0000)),(\u0000))', { cur: 'root>logb@0.s0:2' });
// DEL
seq('logb del empty from arg', ['log_(', 'DEL'], '', { cur: 'root:0' });
seq('logb del empty from outside', ['log_(', ',', ',', 'DEL'], '', { cur: 'root:0' });
seq('logb del empty from base', ['log_(', ',', 'DEL'], '', { cur: 'root:0' });
seq('logb del enters base', ['log_(', '8', ',', '2', ',', 'DEL'], 'log((8),(2))', { cur: 'root>logb@0.s1:1' });
seq('logb del enters arg', ['log_(', '8', ',', ',', 'DEL'], 'log((8),(\u0000))', { cur: 'root>logb@0.s0:1' });
seq('logb del base start to arg', ['log_(', '8', ',', 'DEL'], 'log((8),(\u0000))', { cur: 'root>logb@0.s0:1' });
seq('logb del unwrap arg', ['1', '+', 'log_(', 'x', 'L', 'DEL'], '1+x', { cur: 'root:2' });
seq('logb move', ['log_(', '8', ',', '2', 'L', 'L', 'L', 'L', 'R'], 'log((8),(2))', { cur: 'root>logb@0.s0:0' });
(function () {
  seq('logb anchors', ['log_(', '8', ',', '2'], 'log((8),(2))');
  var pos = EC.cursorPositions('t');
  eq(pos.join(' '), 'root:0 root>logb@0.s0:0 root>logb@0.s0:1 root>logb@0.s1:0 root>logb@0.s1:1 root:1', 'logb cursorPositions');
  ok(EC.setCursorPath('t', 'root>logb@0.s1:0') && EC.cursorPath(EC.ed('t')) === 'root>logb@0.s1:0', 'logb setCursorPath');
  ok(EC.setCursorPath('t', 'root>logb@0.s2:0') === false, 'logb slot 2 rejected');
  eq(count(EC.renderTex('t', { anchors: true }), 'ec-anchor'), 6, 'logb anchor count');
  EC.setKey(null);
})();
// log10 untouched
seq('log10 kept', ['log10(', '1', '0', '0', ')'], 'log10(100)', { tex: '\\lg\\left(100\\right)' });
seq('log fn kept', ['log(', 'x', ')'], 'log(x)', { tex: '\\ln\\left(x\\right)' });

/* ---- K2: variable t ---- */
seq('var t', ['t'], 't', { cur: 'root:1', tex: 't' });
seq('var t product', ['2', 't', '+', 't', '^{2}'], '(2*t)+((t)^(2))');
(function () {
  seq('var t eval', ['2', 't', '+', '1'], '(2*t)+1');
  EC.setKey('t'); eq(MJ.evaluate(EC.serialize(), { t: 4 }), 9, 't evaluates with scope'); EC.setKey(null);
})();
seq('tan not t', ['tan(', 'x', ')'], 'tan(x)', { tex: '\\tan\\left(x\\right)' });
seq('t a n letters', ['t', 'a', 'n'], '(t*a)', { accepted: '110' });   // 'n' is not a token, t+a never forms tan(
seq('t then tan', ['t', 'tan(', 't', ')'], '(t*tan(t))');
(function () {
  eq(EC.keyToInput('t'), 't', 'keyToInput t');
  ok(EC.keyToInput('tan(') === null && EC.keyToInput('T') === null, 'keyToInput: no tan( / T');
  ok(EC.append === EC.append && Object.prototype.hasOwnProperty.call(EC.editors, 'var_t'), 'var_t editor exists');
  ['a', 'b', 'c', 'x', 'y', 'z'].forEach(function (k) {
    eq(EC.keyToInput(k), k, 'keyToInput ' + k + ' unchanged');
    ok(Object.prototype.hasOwnProperty.call(EC.editors, 'var_' + k), 'var_' + k + ' exists');
    seq('var ' + k + ' unchanged', [k, '+', '1'], k + '+1', { tex: k + '+1' });
  });
  ['var_a', 'var_b', 'var_c', 'var_x', 'var_y', 'var_z', 'var_t'].forEach(function (k) { EC.setKey(k); EC.clearAll(); });
  EC.setKey('var_t'); EC.append('5'); EC.append('t');
  EC.setKey('var_x'); EC.append('7');
  eq(EC.serialize('var_t'), '(5*t)', 'var_t content');
  eq(EC.serialize('var_x'), '7', 'var_x independent of var_t');
  ['var_a', 'var_b', 'var_c', 'var_y', 'var_z'].forEach(function (k) { ok(EC.isEmpty(k), k + ' untouched by var_t'); });
  ['var_x', 'var_t'].forEach(function (k) { EC.setKey(k); EC.clearAll(); });
  EC.setKey(null);
})();

/* ---- K5: cbrt / nroot / lg nodes, zero-width anchors ---- */
var k5Start = pass + fail;
seq('cbrt', ['cbrt(', '8', 'R', '+', '1'], 'cbrt((8))+1', { cur: 'root:3', tex: '\\sqrt[3]{8}+1' });
seq('cbrt empty', ['cbrt('], 'cbrt((\u0000))', { cur: 'root>cbrt@0.s0:0', tex: '\\sqrt[3]{\\square}' });
seq('cbrt del empty', ['cbrt(', 'DEL'], '', { cur: 'root:0' });
seq('unwrap cbrt', ['cbrt(', '2', 'L', 'DEL'], '2', { cur: 'root:0' });
seq('cbrt of sin', ['cbrt(', 'sin(', 'x'], 'cbrt((sin(x)))', { cur: 'root>cbrt@0.s0:2', texHas: ['ghost-paren'] });
seq('frac of cbrt', ['frac(', 'cbrt(', '2', 'R', ',', '3'], '((cbrt((2)))/(3))', { cur: 'root>frac@0.s1:1', tex: '\\frac{\\sqrt[3]{2}}{3}' });
seq('nroot', ['nroot(', '8', ',', '3'], 'nthRoot((8),(3))', { cur: 'root>nroot@0.s1:1', tex: '\\sqrt[3]{8}' });
seq('nroot empty', ['nroot('], 'nthRoot((\u0000),(\u0000))', { cur: 'root>nroot@0.s0:0', tex: '\\sqrt[\\square]{\\square}' });
seq('nroot empty index', ['nroot(', '8'], 'nthRoot((8),(\u0000))', { cur: 'root>nroot@0.s0:1', tex: '\\sqrt[\\square]{8}' });
seq('nroot empty radicand', ['nroot(', ',', '4'], 'nthRoot((\u0000),(4))', { cur: 'root>nroot@0.s1:1', tex: '\\sqrt[4]{\\square}' });
seq('nroot del empty', ['nroot(', 'DEL'], '', { cur: 'root:0' });
seq('nroot then plus', ['nroot(', '8', ',', '3', 'R', '+', '1'], 'nthRoot((8),(3))+1', { cur: 'root:3', tex: '\\sqrt[3]{8}+1' });
seq('lg', ['lg(', '1', '0', '0', ')'], 'log10(100)', { tex: '\\lg\\left(100\\right)' });
seq('lg empty', ['lg('], 'log10(\u0000)', { texHas: ['\\lg'] });
seq('lg in nroot', ['nroot(', 'lg(', 'x', ')', ',', '2'], 'nthRoot((log10(x)),(2))', { cur: 'root>nroot@0.s1:1' });
seq('log10 still kept', ['log10(', '1', '0', ')'], 'log10(10)', { tex: '\\lg\\left(10\\right)' });
(function () {
  // same token sequence, node A vs node B: cursor paths, accepted flags, serialization shape must match
  function trace(tokens) {
    EC.setKey('t'); EC.clearAll();
    var r = tokens.map(function (t) { var a = step(t); return (a ? '1' : '0') + EC.__dbg().cur + '|' + EC.serialize(); });
    r.push(String(EC.cursorPositions('t').length));
    EC.setKey(null);
    return r.join(' ');
  }
  var twoSlot = [
    ['N', '8'], ['N', '8', ','], ['N', '8', ',', '3'], ['N', '8', ',', '3', ','], ['N', '8', ',', '3', ',', '1'],
    ['N', '8', ',', '3', 'L', 'L', 'L'], ['N', '8', ',', '3', 'LL', 'LL', 'LL', 'LL'], ['N', '8', ',', '3', 'R', 'R'],
    ['N', '8', ',', '3', 'DEL', 'DEL', 'DEL', 'DEL'], ['N', ',', 'DEL', 'DEL'], ['N', '8', ',', 'DEL', 'DEL', 'DEL'],
    ['1', 'N', '2', ',', '3', 'R', 'LL', 'LL', 'LL', 'DEL'], ['N', 'N', '2', ',', '3', ',', '4']
  ];
  twoSlot.forEach(function (tk, i) {
    var lb = trace(tk.map(function (t) { return t === 'N' ? 'log_(' : t; }));
    var nr = trace(tk.map(function (t) { return t === 'N' ? 'nroot(' : t; }));
    eq(nr, lb.replace(/logb/g, 'nroot').replace(/log\(/g, 'nthRoot('), 'nroot mirrors logb #' + i);
  });
  var oneSlot = [
    ['N', '2'], ['N', '2', 'R'], ['N', '2', 'L'], ['N', '2', 'LL', 'LL'], ['N', '2', 'R', 'LL', 'DEL'],
    ['N', '2', 'DEL', 'DEL'], ['N', '2', ')'], ['N', '8', ')', 'DEL'], ['3', 'N', '2', 'R', 'x']
  ];
  oneSlot.forEach(function (tk, i) {
    var sq = trace(tk.map(function (t) { return t === 'N' ? 'sqrt(' : t; }));
    var cb = trace(tk.map(function (t) { return t === 'N' ? 'cbrt(' : t; }));
    eq(cb, sq.replace(/sqrt/g, 'cbrt'), 'cbrt mirrors sqrt #' + i);
  });
  // cursorPositions / setCursorPath round trip / anchors
  function play(tokens) { EC.setKey('t'); EC.clearAll(); tokens.forEach(step); }
  play(['nroot(', '8', ',', '3']);
  var pos = EC.cursorPositions('t');
  eq(pos.join(' '), 'root:0 root>nroot@0.s0:0 root>nroot@0.s0:1 root>nroot@0.s1:0 root>nroot@0.s1:1 root:1', 'nroot positions');
  pos.forEach(function (p) { ok(EC.setCursorPath('t', p) === true && EC.cursorPath(EC.ed('t')) === p, 'nroot setCursorPath ' + p); });
  var at = EC.renderTex('t', { cursor: true, anchors: true });
  eq(count(at, 'ec-anchor'), pos.length, 'nroot anchor count');
  ok(at.indexOf('\\phantom{') < 0 && count(at, '\\vphantom{|}') === pos.length, 'nroot anchors zero-width');
  play(['cbrt(', '2', '7']);
  pos = EC.cursorPositions('t');
  eq(pos.join(' '), 'root:0 root>cbrt@0.s0:0 root>cbrt@0.s0:1 root>cbrt@0.s0:2 root:1', 'cbrt positions');
  pos.forEach(function (p) { ok(EC.setCursorPath('t', p) === true && EC.cursorPath(EC.ed('t')) === p, 'cbrt setCursorPath ' + p); });
  eq(count(EC.renderTex('t', { cursor: true, anchors: true }), 'ec-anchor'), pos.length, 'cbrt anchor count');
  play(['nroot(']);
  pos = EC.cursorPositions('t');
  eq(pos.length, 4, 'empty nroot positions');
  at = EC.renderTex('t', { cursor: false, anchors: true });
  ok(at.indexOf(EC.anchorTex('root>nroot@0.s1:0') + EC.SQ_TEX) >= 0 && at.indexOf(EC.anchorTex('root>nroot@0.s0:0') + EC.SQ_TEX) >= 0, 'empty nroot slots anchored squares');
  ok(EC.setCursorPath('t', 'root>nroot@0.s2:0') === false, 'nroot has no s2');
  ok(EC.setCursorPath('t', 'root>cbrt@0.s0:0') === false, 'wrong node type rejected');
  ok(EC.setCursorPath('t', 'root>nroot@0.s1:0') === true, 'jump into empty index');
  ok(EC.renderTex('t').indexOf('\\sqrt[' + EC.SQ_CUR_TEX + ']{\\square}') >= 0, 'cursor square in empty index');
  EC.setKey(null);
  eq(EC.anchorTex('root:0'), '\\htmlId{ec-root:0}{\\htmlClass{ec-anchor}{\\vphantom{|}}}', 'anchorTex is vphantom');
  ok(EC.anchorTex('root:0').indexOf('\\phantom') < 0, 'anchorTex no \\phantom');
  // static tables / direct node rendering
  eq(EC.NODE_SLOTS.cbrt, 1, 'NODE_SLOTS.cbrt'); eq(EC.NODE_SLOTS.nroot, 2, 'NODE_SLOTS.nroot');
  play(['nroot(', '8']); var n = EC.ed('t').root[0]; EC.setKey(null);
  eq(EC.texNode(n, null, null, 0), '\\sqrt[\\square]{8}', 'texNode nroot empty index');
  eq(EC.serNode(n), 'nthRoot((8),(\u0000))', 'serNode nroot empty index');
  eq(EC.texNode(EC.makeNode('cbrt'), null, null, 0), '\\sqrt[3]{\\square}', 'texNode cbrt empty');
  eq(EC.serNode(EC.makeNode('cbrt')), 'cbrt((\u0000))', 'serNode cbrt empty');
  // mathjs evaluates the serialized code
  var M = require('../www/math.min.js');
  function evalSeq(tokens) { play(tokens); var v = M.evaluate(EC.serialize()); EC.setKey(null); return Number(v); }
  ok(Math.abs(evalSeq(['cbrt(', '2', '7']) - 3) < 1e-12, 'eval cbrt(27)');
  ok(Math.abs(evalSeq(['nroot(', '3', '2', ',', '5']) - 2) < 1e-12, 'eval nthRoot(32,5)');
  ok(Math.abs(evalSeq(['lg(', '1', '0', '0', '0', ')']) - 3) < 1e-12, 'eval lg(1000)');
  ok(Math.abs(evalSeq(['2', 'nroot(', '1', '6', ',', '4', 'R', '+', 'cbrt(', '8']) - 6) < 1e-12, 'eval 2*nroot+cbrt');
})();
console.log('K5 new assertions: ' + (pass + fail - k5Start));

/* ---- G1: kernel syntax validation ---- */
var g1Start = pass + fail;
(function () {
  var M = require('../www/math.min.js');
  function play(tokens) { EC.setKey('t'); EC.clearAll(); tokens.forEach(step); }
  function parses(code) { try { M.parse(code); return true; } catch (e) { return false; } }
  function chars(str) { return str.replace(/[^0-9abcxyz]/g, '').split('').sort().join(''); }
  function subsetOf(a, b) { var j = 0; for (var i = 0; i < b.length && j < a.length; i++) if (b[i] === a[j]) j++; return j === a.length; }
  // [tokens, wantCode or null (= ok)]
  function v(name, tokens, want, extra) {
    play(tokens);
    var r = EC.validate('t'), ser = EC.serialize('t');
    eq(r.ok, want === null, 'G1 ' + name + ': ok');
    if (want !== null) {
      eq(r.code, want, 'G1 ' + name + ': code');
      ok(typeof r.message === 'string' && /^[\x20-\x7e]+$/.test(r.message) && r.message === EC.VALIDATE_MSG[r.code], 'G1 ' + name + ': ascii message');
    } else ok(parses(ser), 'G1 ' + name + ': valid implies mathjs parses ' + JSON.stringify(ser));
    var ins = chars(tokens.filter(function (t) { return t.length === 1; }).join(''));
    ok(subsetOf(ins, chars(ser)), 'G1 ' + name + ': chars conserved in ' + JSON.stringify(ser));
    if (extra) extra(r, ser);
    EC.setKey(null);
    return r;
  }
  function k(str) { return str.split(''); }
  // the 18 known sequences (17 from the defect table + 7.5.2 from rule 4)
  v('7++8', k('7++8'), 'OP_CONSECUTIVE', function (r) { eq(r.pos, 2, 'G1 7++8 pos'); eq(r.path, 'root:3', 'G1 7++8 path'); });
  v('7--8', k('7--8'), 'OP_CONSECUTIVE');
  v('7+-8', k('7+-8'), 'OP_CONSECUTIVE');
  v('7*-8', k('7*-8'), 'OP_CONSECUTIVE');
  v('--7', k('--7'), 'OP_CONSECUTIVE');
  v('(+8)', k('(+8)'), null);
  v('7^^8', k('7^^8'), 'POW_NO_BASE', function (r, ser) {
    eq(ser, '((7)^(((\u0000)^(8))))', 'G1 7^^8 nested, nothing lost');
    ok(ser.indexOf('7') >= 0 && ser.indexOf('8') >= 0 && !parses(ser), 'G1 7^^8 keeps 7 and 8, mathjs rejects');
    eq(r.pos, 1, 'G1 7^^8 pos'); eq(r.path, 'root>pow@1.s0:0', 'G1 7^^8 path');
  });
  v('7+()8', k('7+()8'), 'EMPTY_PARENS', function (r) { eq(r.path, 'root:3', 'G1 7+()8 path'); });
  v('7*/8', k('7*/8'), 'OP_CONSECUTIVE');
  v('7+*8', k('7+*8'), 'OP_CONSECUTIVE');
  v('*8', k('*8'), 'OP_LEADING');
  v('/8', k('/8'), 'OP_LEADING');
  v('7+', k('7+'), 'OP_TRAILING', function (r) { eq(r.pos, 1, 'G1 7+ pos'); eq(r.path, 'root:2', 'G1 7+ path'); });
  v('7+8*', k('7+8*'), 'OP_TRAILING');
  v('7..8', k('7..8'), 'DOT_DOUBLE', function (r) { eq(r.pos, 2, 'G1 7..8 pos'); });
  v('7+.', k('7+.'), 'DOT_ALONE');
  v('.', k('.'), 'DOT_ALONE');
  v('7.5.2', k('7.5.2'), 'DOT_MULTIPLE', function (r) { eq(r.pos, 3, 'G1 7.5.2 pos'); });
  // raw '^' behaves exactly like '^{}'
  play(['7', '^', '8']); eq(EC.serialize('t'), '((7)^(8))', 'G1 raw ^ = ^{}'); EC.setKey(null);
  play(['7', '^{}', '8']); var tA = EC.renderTex('t'); play(['7', '^', '8']); eq(EC.renderTex('t'), tA, 'G1 raw ^ tex = ^{} tex'); EC.setKey(null);
  play(['7', '^', '^']); ok(EC.ed('t').root.length === 2 && EC.ed('t').root[1].t === 'pow', 'G1 7^^ nests pow'); EC.setKey(null);
  // rule 1/2: unary sign boundary
  v('-7', k('-7'), null);
  v('+7', k('+7'), null);
  v('(-7)', k('(-7)'), null);
  v('7+(-8)', k('7+(-8)'), null);
  v('7*(-8)', k('7*(-8)'), null);
  v('-(-7)', k('-(-7)'), null);
  v('-', ['-'], 'OP_TRAILING');
  v('+', ['+'], 'OP_TRAILING');
  v('(-)', k('(-)'), 'OP_TRAILING');
  v('(--7)', k('(--7)'), 'OP_CONSECUTIVE');
  v('7-+8', k('7-+8'), 'OP_CONSECUTIVE');
  v('7/-8', k('7/-8'), 'OP_CONSECUTIVE');
  v('sin(-x', ['sin(', '-', 'x'], null);
  v('sin(*x', ['sin(', '*', 'x'], 'OP_LEADING');
  v('frac -1/2', ['frac(', '-', '1', ',', '2'], null);
  v('frac /1', ['frac(', '/', '1', ',', '2'], 'OP_LEADING');
  v('2^{-3}', ['2', '^{}', '-', '3'], null);
  v('2^{--3}', ['2', '^{}', '-', '-', '3'], 'OP_CONSECUTIVE', function (r) { eq(r.pos, 1, 'G1 pos = top-level node'); eq(r.path, 'root>pow@1.s0:2', 'G1 nested path'); });
  v('sqrt(-4', ['sqrt(', '-', '4'], null);
  v('7+frac 1/2', ['7', '+', 'frac(', '1', ',', '2'], null);
  // rule 3
  v('7-', k('7-'), 'OP_TRAILING');
  v('(7+', k('(7+'), 'OP_TRAILING');
  v('(7+)', k('(7+)'), 'OP_TRAILING');
  v('^8', k('^8'), 'POW_NO_BASE');
  v('sqrt 7*', ['sqrt(', '7', '*'], 'OP_TRAILING');
  // rule 4
  v('.5', k('.5'), null);
  v('5.', k('5.'), null);
  v('7+.5', k('7+.5'), null);
  v('7.x', k('7.x'), null);
  v('..', k('..'), 'DOT_DOUBLE');
  v('x.', k('x.'), 'DOT_ALONE');
  v('1.2.', k('1.2.'), 'DOT_MULTIPLE');
  v('(.)', k('(.)'), 'DOT_ALONE');
  v('7*.', k('7*.'), 'DOT_ALONE');
  // rule 5: stray right bracket
  v(')', [')'], 'STRAY_CLOSE', function (r) { eq(r.pos, 0, 'G1 ) pos'); });
  v('7)', k('7)'), 'STRAY_CLOSE');
  v('(7))', k('(7))'), 'STRAY_CLOSE', function (r) { eq(r.pos, 3, 'G1 (7)) pos'); });
  v('sqrt 2 R )', ['sqrt(', '2', 'R', ')'], 'STRAY_CLOSE');
  v('sqrt ) inside', ['sqrt(', '2', ')'], 'STRAY_CLOSE');
  // rule 6: unclosed brackets close implicitly
  v('(7', k('(7'), null);
  v('((7', k('((7'), null);
  v('sin(2', ['sin(', '2'], null);
  v('(7+(8', k('(7+(8'), null);
  v('2*(3', k('2*(3'), null);
  // rule 7: empty slots
  v('frac empty', ['frac('], 'EMPTY_SLOT', function (r) { eq(r.path, 'root>frac@0.s0:0', 'G1 frac empty path'); });
  v('frac no den', ['frac(', '1', ','], 'EMPTY_SLOT', function (r) { eq(r.path, 'root>frac@0.s1:0', 'G1 frac den path'); });
  v('sqrt empty', ['sqrt('], 'EMPTY_SLOT');
  v('cbrt empty', ['cbrt('], 'EMPTY_SLOT');
  v('nroot no index', ['nroot(', '8'], 'EMPTY_SLOT', function (r) { eq(r.path, 'root>nroot@0.s1:0', 'G1 nroot index path'); });
  v('nroot ok', ['nroot(', '8', ',', '3'], null);
  v('logb no base', ['log_(', '8'], 'EMPTY_SLOT');
  v('logb ok', ['log_(', '8', ',', '2'], null);
  v('int no bounds', ['int(', 'x'], 'EMPTY_SLOT');
  v('int ok', ['int(', 'x', ',', '0', ',', '1'], null);
  v('deriv no point', ['deriv(', 'x'], 'EMPTY_SLOT');
  v('deriv ok', ['deriv(', 'x', '^{2}', ',', '3'], null);
  v('x^ empty', ['x', '^{}'], 'EMPTY_SLOT');
  v('sci empty', ['2', '*10^{}'], 'EMPTY_SLOT');
  v('sci ok', ['2', '*10^{}', '3'], null);
  v('sci no base', ['*10^{}', '3'], null);
  v('x^{2}', ['x', '^{2}'], null);
  v('pow no base', ['^{}', '2'], 'POW_NO_BASE');
  v('pow after op', ['2', '+', '^{2}'], 'POW_NO_BASE');
  v('pow after open', ['(', '^{2}'], 'POW_NO_BASE');
  v('nested empty', ['frac(', 'sqrt(', ',', '2'], 'EMPTY_SLOT', function (r) { eq(r.path, 'root>frac@0.s0>sqrt@0.s0:0', 'G1 nested empty path'); });
  // rule 8/9
  v('()', k('()'), 'EMPTY_PARENS');
  v('(', ['('], 'EMPTY_PARENS');
  v('2(', k('2('), 'EMPTY_PARENS');
  v('(())', k('(())'), 'EMPTY_PARENS');
  v('sin(', ['sin('], 'FN_NO_ARG');
  v('sin()', ['sin(', ')'], 'FN_NO_ARG');
  v('lg(', ['lg('], 'FN_NO_ARG');
  v('log(', ['log('], 'FN_NO_ARG');
  v('f(', ['f('], 'FN_NO_ARG');
  v('cos(+)', ['cos(', '+', ')'], 'OP_TRAILING');
  v('empty', [], 'EMPTY');
  // rule 10: implicit multiplication stays valid
  v('2x', k('2x'), null);
  v('x2', k('x2'), null);
  v('2(3+4)', k('2(3+4)'), null);
  v('(3+4)2', k('(3+4)2'), null);
  v('xy', k('xy'), null);
  v('2pi', ['2', 'pi'], null);
  v('2e', ['2', 'e'], null);
  v('2Ans', ['2', 'Ans'], null);
  v('Ans2', ['Ans', '2'], null);
  v('2sqrt', ['2', 'sqrt(', '3'], null);
  v('x^2y', ['x', '^{2}', 'y'], null);
  v('2sin', ['2', 'sin(', 'x'], null);
  v('sin x cos x', ['sin(', 'x', ')', 'cos(', 'x'], null);
  v('frac frac', ['frac(', '1', ',', '2', 'R', 'frac(', '3', ',', '4'], null);
  v('2frac', ['2', 'frac(', '1', ',', '3'], null);
  v('(2)(3)', k('(2)(3)'), null);
  v('1.5*10^3', ['1', '.', '5', '*10^{}', '3'], null);
  v('const', ['2', 'const:c'], null);
  // validate does not mutate state
  play(['7', '+', '+', '8']); var before = EC.serialize('t') + '|' + EC.__dbg().cur;
  EC.validate('t'); EC.validate();
  eq(EC.serialize('t') + '|' + EC.__dbg().cur, before, 'G1 validate is read-only');
  ok(EC.setCursorPath('t', EC.validate('t').path) === true, 'G1 error path resolves');
  EC.setKey(null);
  ok(typeof EC.validate === 'function' && typeof EC.validateBlock === 'function', 'G1 exports');
  eq(Object.keys(EC.VALIDATE_MSG).length, 12, 'G1 code table size');
  // fuzz smoke (fixed seed, small count) runs clean
  var cp = require('child_process').spawnSync(process.execPath, [require('path').join(__dirname, 'syntax-fuzz.js'), '--count', '300'], { encoding: 'utf8' });
  ok(cp.status === 0 && / fail=0$/m.test(cp.stdout), 'G1 syntax-fuzz 300 clean');
})();
console.log('G1 new assertions: ' + (pass + fail - g1Start));

/* ---- module hygiene ---- */
(function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, 'editor-core.js'), 'utf8');
  ok(/^[\x00-\x7f]*$/.test(src), 'editor-core.js is pure ASCII');
})();

console.log((fail ? 'TESTS FAILED ' : 'TESTS OK ') + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;