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
seq('sqrt', ['sqrt(', '2', ')', '+', '1'], 'sqrt((2))+1', { cur: 'root:3', tex: '\\sqrt{2}+1' });
seq('int', ['int(', 'x', ',', '0', ',', '1'], 'int((x),(0),(1))', { tex: '\\int_{0}^{1} x\\,\\mathrm{d}x' });
seq('int empty', ['int('], 'int((\u0000),(\u0000),(\u0000))');
seq('deriv', ['deriv(', 'x', '^{2}', ',', '3'], 'deriv((((x)^(2))),(3))',
  { texHas: ['\\frac{\\mathrm{d}}{\\mathrm{d}x}', '_{x=3'] });
seq('sci', ['1', '.', '5', '*10^{}', '3'], '((1.5)*10^(3))', { tex: '{1.5}\\times10^{3}' });
seq('sci missing base', ['*10^{}', '3'], '((1)*10^(3))', { tex: '\\times10^{3}' });

/* ---- nesting ---- */
seq('frac of sqrt', ['frac(', 'sqrt(', '2', ')', ',', '3', ')', '+', '1'], '((sqrt((2)))/(3))+1',
  { cur: 'root:3', tex: '\\frac{\\sqrt{2}}{3}+1' });
seq('sqrt of sin', ['sqrt(', 'sin(', 'x'], 'sqrt((sin(x)))', { cur: 'root>sqrt@0.s0:2', texHas: ['ghost-paren'] });
seq('frac in int', ['int(', 'frac(', '1', ',', 'x', ',', ',', '1', ',', '2'], 'int((((1)/(x))),(1),(2))');
seq('pow in frac den', ['frac(', '1', ',', 'x', '^{}', '2'], '((1)/(((x)^(2))))', { cur: 'root>frac@0.s1>pow@1.s0:1' });

/* ---- parentheses ---- */
seq('stray close at root', [')'], '', { accepted: '0' });
seq('extra close after sqrt', ['sqrt(', '2', ')', ')'], 'sqrt((2))', { accepted: '1110' });
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
seq('bug1 sqrt closes', ['sqrt(', '2', ')', '+', '1'], 'sqrt((2))+1', { cur: 'root:3' });
(function () { EC.setKey('t'); EC.clearAll(); eq(EC.serialize(), '', 'bug2 empty tree serializes to empty'); EC.setKey(null); })();
seq('bug3/4 pow del', ['2', '^{}', '3', 'DEL', 'DEL'], '2');
seq('bug5 int del + comma', ['int(', 'x', ',', '0', ',', '1', 'DEL', 'DEL', 'DEL', 'DEL', 'DEL', 'DEL'], '', { accepted: '111111111111' });
seq('bug6 2x', ['2', 'x'], '(2*x)');
seq('bug6 x2', ['x', '2'], '(x*2)');
// bug7 is covered in host integration above
eq(EC.keyToInput('q'), null, 'bug8 stray letter');
seq('bug9 unknown append', ['alpha'], '', { accepted: '0' });

/* ---- module hygiene ---- */
(function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, 'editor-core.js'), 'utf8');
  ok(/^[\x00-\x7f]*$/.test(src), 'editor-core.js is pure ASCII');
})();

console.log((fail ? 'TESTS FAILED ' : 'TESTS OK ') + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;