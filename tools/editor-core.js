/* WebCASIO structured formula editor core (tree model).
   Every visible element is one indivisible item: inserted once, deleted once.
   The serialized mathjs string of each editor is pushed out through onChange
   (by default into state.expr.main/fx/gx and varExprs.a..z of index.html).

   Browser: load tools/constants-data.js first, then this file -> globalThis.EditorCore
            (no other globals are created or overwritten).
   Node:    var EC = require('./editor-core.js');
   Self test: node tools/editor-core.js --selftest

   Source is ASCII only; non-ASCII text must be written as \uXXXX escapes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./constants-data.js'));
  } else {
    root.EditorCore = factory(null);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  /* ---------------- constants ---------------- */
  var EMPTY_MARK = '\u0000';   // empty slot marker: guarantees a syntax error on evaluation
  var CUR_TEX = '\\htmlClass{cursor-blink}{|}';
  var SQ_TEX = '\\square';
  var SQ_CUR_TEX = '\\htmlClass{cursor-blink}{\\square}';
  var GHOST_CLOSE_TEX = '\\right.\\htmlClass{ghost-paren}{)}';
  var BASE_MISSING_TEX = '\\htmlClass{base-missing}{\\square}';
  var XCLOSE_TEX = ')';   // stray right bracket (no matching open): rendered bare
  function anchorTex(path) { return '\\htmlId{ec-' + path + '}{\\htmlClass{ec-anchor}{\\vphantom{|}}}'; }

  var NODE_SLOTS = { frac: 2, sqrt: 1, int: 3, deriv: 2, pow: 1, sci: 1, logb: 2, cbrt: 1, nroot: 2 };   // logb: s0 argument, s1 base; nroot: s0 radicand, s1 index
  // node types whose rendering needs \left( \right) when used as a power base
  var PW_TYPES = { frac: true, pow: true, sci: true, int: true, deriv: true, logb: true };
  var FN_INPUT = { 'sin(': 'sin', 'cos(': 'cos', 'tan(': 'tan', 'asin(': 'asin', 'acos(': 'acos', 'atan(': 'atan', 'log10(': 'log10', 'lg(': 'log10', 'log(': 'log', 'f(': 'f', 'g(': 'g' };
  var FN_TEX = { '': '', sin: '\\sin', cos: '\\cos', tan: '\\tan', asin: '\\sin^{-1}', acos: '\\cos^{-1}', atan: '\\tan^{-1}', log10: '\\lg', log: '\\ln', f: 'f', g: 'g' };
  var NODE_INPUT = { 'sqrt(': 'sqrt', 'frac(': 'frac', 'int(': 'int', 'deriv(': 'deriv', 'log_(': 'logb', 'cbrt(': 'cbrt', 'nroot(': 'nroot' };
  var OP_TEX = { '+': '+', '-': '-', '*': '\\times ', '/': '\\div ' };
  var VARS = { a: 1, b: 1, c: 1, x: 1, y: 1, z: 1, t: 1 };

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* ---------------- constants data (lazy in the browser) ---------------- */
  function cdata() {
    if (deps) return deps;
    var g = typeof globalThis !== 'undefined' ? globalThis : null;
    if (g && g.ConstantsData) { deps = g.ConstantsData; return deps; }
    try {
      if (typeof constCode === 'function' && typeof CONST_BY_ID !== 'undefined') {
        return { constCode: constCode, CONST_BY_ID: CONST_BY_ID };
      }
    } catch (err) { /* ignore */ }
    return null;
  }
  function constInfo(id) {
    var d = cdata();
    if (d && d.CONST_BY_ID && has(d.CONST_BY_ID, id)) return d.CONST_BY_ID[id];
    return null;
  }
  function constSer(id) {
    var d = cdata();
    if (d && typeof d.constCode === 'function') return d.constCode(id);
    if (id === 'e' || id === 'pi') return id;
    return 'NaN';
  }
  function constTex(id) {
    var info = constInfo(id);
    if (info && info.tex) return info.tex;
    if (id === 'e') return '\\mathrm{e}';
    if (id === 'pi') return '\\pi';
    return '\\mathrm{?}';
  }

  /* ---------------- tree basics ---------------- */
  function makeNode(t) {
    var n = { t: t, s: [] };
    for (var i = 0; i < NODE_SLOTS[t]; i++) n.s.push([]);
    return n;
  }
  function isNode(it) { return !!(it && it.s); }
  function newEditor() { var r = []; return { root: r, cur: { block: r, idx: 0 } }; }

  var editors = {};
  ['main', 'fx', 'gx'].forEach(function (k) { editors[k] = newEditor(); });
  ['a', 'b', 'c', 'x', 'y', 'z', 't'].forEach(function (k) { editors['var_' + k] = newEditor(); });

  /* ---------------- host integration ---------------- */
  function defaultGetKey() {
    try {
      if (typeof state !== 'undefined' && state) {
        if (state.mode === 'funcs') return state.funcTarget === 'f' ? 'fx' : 'gx';
        if (state.mode === 'vars') {
          var v = (typeof activeVar !== 'undefined' && activeVar) ? activeVar : 'a';
          return 'var_' + v;
        }
      }
    } catch (err) { /* ignore */ }
    return 'main';
  }
  function defaultOnChange(key, ser) {
    try {
      if (key === 'main' || key === 'fx' || key === 'gx') {
        if (typeof state !== 'undefined' && state && state.expr) state.expr[key] = ser;
      } else if (key.indexOf('var_') === 0) {
        if (typeof varExprs !== 'undefined' && varExprs) varExprs[key.slice(4)] = ser;
      }
    } catch (err) { /* ignore */ }
  }
  var cfg = { getKey: null, onChange: null };
  var pinnedKey = null;

  function configure(opts) {
    opts = opts || {};
    if (has(opts, 'getKey')) cfg.getKey = typeof opts.getKey === 'function' ? opts.getKey : null;
    if (has(opts, 'onChange')) cfg.onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
  }
  function ensure(k) { if (!has(editors, k)) editors[k] = newEditor(); return editors[k]; }
  function setKey(k) { pinnedKey = (k === null || k === undefined) ? null : String(k); if (pinnedKey) ensure(pinnedKey); }
  function activeEditorKey() {
    var k = pinnedKey || (cfg.getKey ? cfg.getKey() : defaultGetKey()) || 'main';
    ensure(k);
    return k;
  }
  function ed(k) { return ensure(k === undefined || k === null ? activeEditorKey() : k); }
  function notify(k) {
    var ser = serialize(k);
    if (cfg.onChange) { try { cfg.onChange(k, ser); } catch (err) { /* ignore */ } }
    else defaultOnChange(k, ser);
  }

  /* ---------------- bracket matching ---------------- */
  function matchCloseIdx(block, i) {
    var depth = 0;
    for (var j = i; j < block.length; j++) {
      if (block[j].t === 'open') depth++;
      else if (block[j].t === 'close') { depth--; if (depth === 0) return j; }
    }
    return -1;
  }
  // index of an open bracket left of idx that has no close bracket at all, else -1
  function pendingOpenIdx(block, idx) {
    var stack = [];
    for (var j = 0; j < idx; j++) {
      if (block[j].t === 'open') stack.push(j);
      else if (block[j].t === 'close') stack.pop();
    }
    while (stack.length) {
      var k = stack.pop();
      if (matchCloseIdx(block, k) === -1) return k;
    }
    return -1;
  }
  function unclosedCount(block) {
    var depth = 0;
    for (var j = 0; j < block.length; j++) {
      if (block[j].t === 'open') depth++;
      else if (block[j].t === 'close' && depth > 0) depth--;
    }
    return depth;
  }

  /* ---------------- parent lookup ---------------- */
  function findParent(rootBlock, block) {
    function walk(blk) {
      for (var i = 0; i < blk.length; i++) {
        var it = blk[i];
        if (!isNode(it)) continue;
        for (var si = 0; si < it.s.length; si++) {
          if (it.s[si] === block) return { node: it, slot: si, parentBlock: blk, nodeIdx: i };
          var r = walk(it.s[si]);
          if (r) return r;
        }
      }
      return null;
    }
    return walk(rootBlock);
  }
  function blockEmpty(b) { return b.length === 0; }
  function allSlotsEmpty(n) { return n.s.every(blockEmpty); }

  /* ---------------- linear scan helpers (shared by TeX and serializer) ----------------
     part = { k:'digit'|'operand'|'op'|'cursor', s:string, pw:needs parens as power base,
              frac:is a fraction } */
  function takeBase(parts) {
    var j = parts.length - 1;
    var trail = [];
    while (j >= 0 && parts[j].k === 'cursor') { trail.unshift(parts[j].s); j--; }
    if (j < 0) return null;
    if (parts[j].k === 'operand') {
      var p = parts[j];
      parts.length = j;
      return { s: p.s, pw: !!p.pw, trail: trail.join('') };
    }
    if (parts[j].k === 'digit') {
      var st = j;
      var buf = [];
      while (st >= 0 && (parts[st].k === 'digit' || parts[st].k === 'cursor')) { buf.unshift(parts[st].s); st--; }
      parts.length = st + 1;
      return { s: buf.join(''), pw: false, trail: trail.join('') };
    }
    return null;
  }

  /* ---------------- serializer (mathjs code) ---------------- */
  function serBlock(block) {
    var stack = [{ fn: '', parts: [] }];
    function top() { return stack[stack.length - 1]; }
    function add(k, s) { top().parts.push({ k: k, s: s, pw: false }); }
    function closeFrame() {
      var fr = stack.pop();
      var inner = joinParts(fr.parts);
      var body = inner === '' ? EMPTY_MARK : inner;
      add('operand', fr.fn + '(' + body + ')');
    }
    for (var i = 0; i < block.length; i++) {
      var it = block[i];
      if (it.t === 'd') add('digit', it.v);
      else if (it.t === 'op') add('op', it.v);
      else if (it.t === 'var') add('operand', it.v);
      else if (it.t === 'ans') add('operand', 'Ans');
      else if (it.t === 'const') add('operand', constSer(it.id));
      else if (it.t === 'open') stack.push({ fn: it.fn, parts: [] });
      else if (it.t === 'close') { if (stack.length > 1) closeFrame(); }
      else if (it.t === 'xclose') add('op', EMPTY_MARK + ')');   // stray ')': always a syntax error
      else if (it.t === 'pow' || it.t === 'sci') {
        var base = takeBase(top().parts);
        var expCode = serSlot(it.s[0]);
        if (it.t === 'pow') add('operand', '((' + (base ? base.s : EMPTY_MARK) + ')^(' + expCode + '))');
        else add('operand', '((' + (base ? base.s : '1') + ')*10^(' + expCode + '))');
      } else if (isNode(it)) {
        add('operand', serNode(it));
      }
    }
    while (stack.length > 1) closeFrame();   // auto-close missing right brackets
    return joinParts(stack[0].parts);
  }
  function serSlot(b) { var s = serBlock(b); return s === '' ? EMPTY_MARK : s; }
  function serNode(n) {
    if (n.t === 'frac') return '((' + serSlot(n.s[0]) + ')/(' + serSlot(n.s[1]) + '))';
    if (n.t === 'sqrt') return 'sqrt((' + serSlot(n.s[0]) + '))';
    if (n.t === 'cbrt') return 'cbrt((' + serSlot(n.s[0]) + '))';
    if (n.t === 'nroot') return 'nthRoot((' + serSlot(n.s[0]) + '),(' + serSlot(n.s[1]) + '))';
    if (n.t === 'int') return 'int((' + serSlot(n.s[0]) + '),(' + serSlot(n.s[1]) + '),(' + serSlot(n.s[2]) + '))';
    if (n.t === 'logb') return 'log((' + serSlot(n.s[0]) + '),(' + serSlot(n.s[1]) + '))';
    if (n.t === 'deriv') return 'deriv((' + serSlot(n.s[0]) + '),(' + serSlot(n.s[1]) + '))';
    return EMPTY_MARK;
  }
  // Join parts into code. Adjacent operands get an explicit '*', and the whole
  // implicit product is parenthesized so it binds tighter than * and / (1/2pi = 1/(2pi)).
  // Digits only merge with a directly preceding digit, so x 2 -> (x*2), 2 x -> (2*x).
  function joinParts(parts) {
    var merged = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.k === 'cursor') continue;
      var last = merged.length ? merged[merged.length - 1] : null;
      if (p.k === 'digit' && last && last.k === 'num' && last.isDigit) last.s += p.s;
      else if (p.k === 'digit') merged.push({ k: 'num', s: p.s, isDigit: true });
      else if (p.k === 'op') merged.push({ k: 'op', s: p.s });
      else merged.push({ k: 'num', s: p.s, isDigit: false });
    }
    var out = '';
    var j = 0;
    while (j < merged.length) {
      if (merged[j].k === 'op') { out += merged[j].s; j++; continue; }
      var run = [];
      while (j < merged.length && merged[j].k === 'num') { run.push(merged[j].s); j++; }
      out += run.length === 1 ? run[0] : '(' + run.join('*') + ')';
    }
    return out;
  }
  function serializeRoot(rootBlock) { return serBlock(rootBlock); }

  /* ---------------- TeX renderer ---------------- */
  // \cdot is inserted between digit->fraction and operand->digit (cursor parts are transparent).
  function joinTex(parts) {
    var out = '';
    var prev = null;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.k === 'cursor') { out += p.s; continue; }
      if (prev) {
        if (p.k === 'digit' && prev.k === 'operand') out += '\\cdot ';
        else if (p.k === 'operand' && p.frac && prev.k === 'digit') out += '\\cdot ';
      }
      out += p.s;
      prev = p;
    }
    return out;
  }
  // ctx (anchors only): { path: '<block path>' }, same format as cursorPath without ':idx'
  function childCtx(ctx, n, i, si) { return ctx ? { path: ctx.path + '>' + n.t + '@' + i + '.s' + si } : null; }
  function texSlot(b, cur, ctx) {
    if (b.length === 0) return (ctx ? anchorTex(ctx.path + ':0') : '') + ((cur && cur.block === b) ? SQ_CUR_TEX : SQ_TEX);
    return texBlock(b, cur, ctx);
  }
  function texNode(n, cur, ctx, ni) {
    function sl(k) { return texSlot(n.s[k], cur, childCtx(ctx, n, ni, k)); }
    if (n.t === 'frac') return '\\frac{' + sl(0) + '}{' + sl(1) + '}';
    if (n.t === 'sqrt') return '\\sqrt{' + sl(0) + '}';
    if (n.t === 'cbrt') return '\\sqrt[3]{' + sl(0) + '}';
    if (n.t === 'nroot') return '\\sqrt[' + sl(1) + ']{' + sl(0) + '}';
    if (n.t === 'int') {
      return '\\int_{' + sl(1) + '}^{' + sl(2) + '} ' +
        sl(0) + '\\,\\mathrm{d}x';
    }
    if (n.t === 'logb') return '\\log_{' + sl(1) + '}\\left(' + sl(0) + '\\right)';
    if (n.t === 'deriv') {
      return '\\left.\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(' + sl(0) +
        '\\right)\\right|_{x=' + sl(1) + '}';
    }
    return SQ_TEX;
  }
  function texBlock(block, cur, ctx) {
    var hasCur = !!(cur && cur.block === block);
    var stack = [{ fn: '', parts: [] }];
    function top() { return stack[stack.length - 1]; }
    function add(k, s, pw, frac) { top().parts.push({ k: k, s: s, pw: !!pw, frac: !!frac }); }
    function closeFrame(closed) {
      var fr = stack.pop();
      var inner = joinTex(fr.parts);
      var body = inner === '' ? SQ_TEX : inner;
      var fnt = has(FN_TEX, fr.fn) ? FN_TEX[fr.fn] : '';
      add('operand', fnt + '\\left(' + body + (closed ? '\\right)' : GHOST_CLOSE_TEX), false);
    }
    for (var i = 0; i <= block.length; i++) {
      if (ctx) add('cursor', anchorTex(ctx.path + ':' + i));
      if (hasCur && cur.idx === i) add('cursor', CUR_TEX);
      if (i === block.length) break;
      var it = block[i];
      if (it.t === 'd') add('digit', it.v);
      else if (it.t === 'op') add('op', OP_TEX[it.v] || it.v);
      else if (it.t === 'var') add('operand', it.v);
      else if (it.t === 'ans') add('operand', '\\mathrm{Ans}');
      else if (it.t === 'const') add('operand', '\\htmlClass{const-sym}{' + constTex(it.id) + '}');
      else if (it.t === 'open') stack.push({ fn: it.fn, parts: [] });
      else if (it.t === 'close') { if (stack.length > 1) closeFrame(true); }
      else if (it.t === 'xclose') add('op', XCLOSE_TEX);
      else if (it.t === 'pow' || it.t === 'sci') {
        var base = takeBase(top().parts);
        var ex = texSlot(it.s[0], cur, childCtx(ctx, it, i, 0));
        var s;
        if (base) {
          var bs = '{' + (base.pw ? '\\left(' + base.s + '\\right)' : base.s) + base.trail + '}';
          s = it.t === 'pow' ? bs + '^{' + ex + '}' : bs + '\\times10^{' + ex + '}';
        } else {
          s = it.t === 'pow' ? BASE_MISSING_TEX + '^{' + ex + '}' : '\\times10^{' + ex + '}';
        }
        add('operand', s, true);
      } else if (isNode(it)) {
        add('operand', texNode(it, cur, ctx, i), !!PW_TYPES[it.t], it.t === 'frac');
      }
    }
    while (stack.length > 1) closeFrame(false);
    return joinTex(stack[0].parts);
  }
  function renderTex(key, opts) {
    if (key && typeof key === 'object') { opts = key; key = undefined; }
    opts = opts || {};
    var e = ed(key);
    var cur = opts.cursor === false ? null : e.cur;
    var ctx = opts.anchors ? { path: 'root' } : null;
    if (e.root.length === 0) return (ctx ? anchorTex('root:0') : '') + (cur ? CUR_TEX : '');
    return texBlock(e.root, cur, ctx);
  }

  /* ---------------- editing ---------------- */
  function insertItem(e, item) { e.cur.block.splice(e.cur.idx, 0, item); e.cur.idx++; }
  function insertNode(e, node, enterSlot) {
    e.cur.block.splice(e.cur.idx, 0, node);
    if (enterSlot === null) { e.cur.idx++; return; }
    e.cur.block = node.s[enterSlot];
    e.cur.idx = 0;
  }

  function doAppend(e, v) {
    if (typeof v !== 'string') return false;
    if (/^[0-9.]$/.test(v)) { insertItem(e, { t: 'd', v: v }); return true; }
    if (has(OP_TEX, v)) { insertItem(e, { t: 'op', v: v }); return true; }
    if (has(VARS, v)) { insertItem(e, { t: 'var', v: v }); return true; }
    if (v === 'e' || v === 'pi') { insertItem(e, { t: 'const', id: v }); return true; }
    if (v.indexOf('const:') === 0) {
      var id = v.slice(6);
      if (!constInfo(id)) return false;
      insertItem(e, { t: 'const', id: id });
      return true;
    }
    if (v === 'Ans') { insertItem(e, { t: 'ans' }); return true; }
    if (v === '(') { insertItem(e, { t: 'open', fn: '' }); return true; }
    if (has(FN_INPUT, v)) { insertItem(e, { t: 'open', fn: FN_INPUT[v] }); return true; }
    if (has(NODE_INPUT, v)) { insertNode(e, makeNode(NODE_INPUT[v]), 0); return true; }
    if (v === '^{}' || v === '^') { insertNode(e, makeNode('pow'), 0); return true; }   // raw '^' = '^{}' (was silently rejected: 7^^8 -> 78)
    if (v === '*10^{}') { insertNode(e, makeNode('sci'), 0); return true; }
    if (v === '^{2}') {
      var sq = makeNode('pow');
      sq.s[0].push({ t: 'd', v: '2' });
      insertNode(e, sq, null);
      return true;
    }
    if (v === ',') return commaMove(e);
    if (v === ')') return closeParen(e);
    return false;
  }
  // ',' : move to the next slot of the nearest multi-slot ancestor (or after it from its last slot)
  function commaMove(e) {
    var b = e.cur.block;
    for (;;) {
      var p = findParent(e.root, b);
      if (!p) return false;
      if (p.node.s.length > 1) {
        if (p.slot < p.node.s.length - 1) {
          var nb = p.node.s[p.slot + 1];
          e.cur.block = nb;
          e.cur.idx = nb.length;
        } else {
          e.cur.block = p.parentBlock;
          e.cur.idx = p.nodeIdx + 1;
        }
        return true;
      }
      b = p.parentBlock;
    }
  }
  function closeParen(e) {
    var b = e.cur.block, i = e.cur.idx;
    if (pendingOpenIdx(b, i) !== -1) { insertItem(e, { t: 'close' }); return true; }
    if (i < b.length && b[i].t === 'close') { e.cur.idx = i + 1; return true; }
    insertItem(e, { t: 'xclose' });   // nothing to pair with (any level): stray ')'
    return true;
  }

  function doDelete(e) {
    var b = e.cur.block, i = e.cur.idx;
    if (i > 0) {
      var it = b[i - 1];
      if (isNode(it)) {
        if (allSlotsEmpty(it)) { b.splice(i - 1, 1); e.cur.idx = i - 1; return true; }
        for (var k = it.s.length - 1; k >= 0; k--) {
          if (it.s[k].length) { e.cur.block = it.s[k]; e.cur.idx = it.s[k].length; return true; }
        }
        return false;
      }
      if (it.t === 'open') {
        var m = matchCloseIdx(b, i - 1);
        if (m !== -1) b.splice(m, 1);
      }
      b.splice(i - 1, 1);
      e.cur.idx = i - 1;
      return true;
    }
    var p = findParent(e.root, b);
    if (!p) return false;
    var node = p.node, pb = p.parentBlock;
    if (p.slot > 0) {
      if (allSlotsEmpty(node)) { pb.splice(p.nodeIdx, 1); e.cur.block = pb; e.cur.idx = p.nodeIdx; return true; }
      var prev = node.s[p.slot - 1];
      e.cur.block = prev;
      e.cur.idx = prev.length;
      return true;
    }
    var othersEmpty = node.s.slice(1).every(blockEmpty);
    if (othersEmpty) {
      var content = node.s[0].slice();
      for (var n = unclosedCount(content); n > 0; n--) content.push({ t: 'close' });
      pb.splice.apply(pb, [p.nodeIdx, 1].concat(content));
    }
    e.cur.block = pb;
    e.cur.idx = p.nodeIdx;
    return true;
  }

  function doMove(e, dir) {
    var b = e.cur.block, i = e.cur.idx, p, it;
    if (dir > 0) {
      if (i < b.length) {
        it = b[i];
        if (isNode(it)) { e.cur.block = it.s[0]; e.cur.idx = 0; }
        else e.cur.idx = i + 1;
        return true;
      }
      p = findParent(e.root, b);
      if (!p) return false;
      if (p.slot < p.node.s.length - 1) { e.cur.block = p.node.s[p.slot + 1]; e.cur.idx = 0; }
      else { e.cur.block = p.parentBlock; e.cur.idx = p.nodeIdx + 1; }
      return true;
    }
    if (i > 0) {
      it = b[i - 1];
      if (isNode(it)) { var ls = it.s[it.s.length - 1]; e.cur.block = ls; e.cur.idx = ls.length; }
      else e.cur.idx = i - 1;
      return true;
    }
    p = findParent(e.root, b);
    if (!p) return false;
    if (p.slot > 0) { var ps = p.node.s[p.slot - 1]; e.cur.block = ps; e.cur.idx = ps.length; }
    else { e.cur.block = p.parentBlock; e.cur.idx = p.nodeIdx; }
    return true;
  }

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
  function append(v) { var k = activeEditorKey(); var r = doAppend(editors[k], v); notify(k); return r; }
  function deleteLast() { var k = activeEditorKey(); var r = doDelete(editors[k]); notify(k); return r; }
  function moveCursor(dir) {
    var d = dir === 'right' ? 1 : dir === 'left' ? -1 : Number(dir);
    var k = activeEditorKey();
    var r = (d === 1 || d === -1) ? doMove(editors[k], d) : false;
    notify(k);
    return r;
  }
  function clearAll() {
    var k = activeEditorKey(), e = editors[k];
    e.root.length = 0;
    e.cur.block = e.root;
    e.cur.idx = 0;
    notify(k);
    return true;
  }
  function cursorToEnd(key) { var e = ed(key); e.cur.block = e.root; e.cur.idx = e.root.length; return true; }
  function isEmpty(key) { return ed(key).root.length === 0; }
  function serialize(key) { return serBlock(ed(key).root); }
  function keyToInput(key) {
    if (typeof key !== 'string') return null;
    if (key === '^') return '^{}';
    if (/^[abcxyzte0-9.+\-*\/(),]$/.test(key)) return key;
    return null;
  }
  function cursorPath(e) {
    var chain = [];
    var b = e.cur.block;
    for (;;) {
      var p = findParent(e.root, b);
      if (!p) break;
      chain.unshift(p.node.t + '@' + p.nodeIdx + '.s' + p.slot);
      b = p.parentBlock;
    }
    return ['root'].concat(chain).join('>') + ':' + e.cur.idx;
  }
  // resolve 'root>sqrt@0.s0:1' to { block, idx } in editor e, or null when invalid
  function resolvePath(e, path) {
    if (typeof path !== 'string') return null;
    var m = /^(.*):(0|[1-9][0-9]*)$/.exec(path);
    if (!m) return null;
    var segs = m[1].split('>');
    if (segs[0] !== 'root') return null;
    var b = e.root;
    for (var i = 1; i < segs.length; i++) {
      var sm = /^([a-z]+)@(0|[1-9][0-9]*)\.s(0|[1-9][0-9]*)$/.exec(segs[i]);
      if (!sm) return null;
      var n = b[Number(sm[2])], si = Number(sm[3]);
      if (!isNode(n) || n.t !== sm[1] || si >= n.s.length) return null;
      b = n.s[si];
    }
    var idx = Number(m[2]);
    return idx <= b.length ? { block: b, idx: idx } : null;
  }
  function existingKey(key) {
    var k = (key === undefined || key === null) ? activeEditorKey() : String(key);
    return has(editors, k) ? k : null;
  }
  // move the cursor to a path from cursorPath/cursorPositions; invalid path: false, no state change
  function setCursorPath(key, path) {
    var k = existingKey(key);
    if (k === null) return false;
    var e = editors[k], r = resolvePath(e, path);
    if (!r) return false;
    e.cur.block = r.block;
    e.cur.idx = r.idx;
    notify(k);
    return true;
  }
  // all legal cursor paths, left to right (slot order, same as stepping moveCursor right)
  function cursorPositions(key) {
    var k = existingKey(key), out = [];
    if (k === null) return out;
    (function walk(b, path) {
      for (var i = 0; i <= b.length; i++) {
        out.push(path + ':' + i);
        if (i < b.length && isNode(b[i])) {
          for (var si = 0; si < b[i].s.length; si++) walk(b[i].s[si], path + '>' + b[i].t + '@' + i + '.s' + si);
        }
      }
    })(editors[k].root, 'root');
    return out;
  }
  function __dbg(key) {
    var k = key || activeEditorKey();
    var e = ed(k);
    return { key: k, ser: serialize(k), tex: renderTex(k), cur: cursorPath(e), empty: e.root.length === 0 };
  }

  return {
    // public editor API
    append: append, deleteLast: deleteLast, moveCursor: moveCursor, clearAll: clearAll,
    renderTex: renderTex, serialize: serialize, validate: validate, isEmpty: isEmpty, cursorToEnd: cursorToEnd,
    keyToInput: keyToInput, configure: configure, setKey: setKey,
    setCursorPath: setCursorPath, cursorPositions: cursorPositions, cursorPath: cursorPath,
    editors: editors, activeEditorKey: activeEditorKey, ed: ed, __dbg: __dbg,
    // internals (exported for tests and later steps)
    EMPTY_MARK: EMPTY_MARK, CUR_TEX: CUR_TEX, SQ_TEX: SQ_TEX, SQ_CUR_TEX: SQ_CUR_TEX,
    NODE_SLOTS: NODE_SLOTS, makeNode: makeNode, isNode: isNode, newEditor: newEditor,
    matchCloseIdx: matchCloseIdx, pendingOpenIdx: pendingOpenIdx, findParent: findParent,
    blockEmpty: blockEmpty, allSlotsEmpty: allSlotsEmpty, takeBase: takeBase,
    serBlock: serBlock, serSlot: serSlot, serNode: serNode, joinParts: joinParts,
    serializeRoot: serializeRoot, texBlock: texBlock, texSlot: texSlot, texNode: texNode,
    joinTex: joinTex, anchorTex: anchorTex, resolvePath: resolvePath,
    validateBlock: validateBlock, VALIDATE_MSG: VALIDATE_MSG
  };
});

/* ---- self test: node tools/editor-core.js --selftest ---- */
if (typeof module === 'object' && require.main === module && process.argv.indexOf('--selftest') >= 0) {
  (function () {
    var EC = module.exports, fail = 0;
    function run(seq, want) {
      EC.setKey('selftest');
      EC.clearAll();
      seq.forEach(function (t) { if (t === 'DEL') EC.deleteLast(); else EC.append(t); });
      var got = EC.serialize();
      if (got !== want) { fail++; console.log('FAIL', JSON.stringify(seq), JSON.stringify(got), '!=', JSON.stringify(want)); }
    }
    run(['frac(', '1', ',', '2'], '((1)/(2))');
    run(['2', '^{}', '3', 'DEL', 'DEL'], '2');
    run(['2', 'x'], '(2*x)');
    run(['sin(', '2'], 'sin(2)');
    run(['1', '.', '5', '*10^{}', '3'], '((1.5)*10^(3))');
    EC.setKey(null);
    console.log(fail === 0 ? 'SELFTEST OK' : ('SELFTEST FAILED ' + fail));
    if (fail) process.exitCode = 1;
  })();
}