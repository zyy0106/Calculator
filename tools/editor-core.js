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

  var NODE_SLOTS = { frac: 2, sqrt: 1, int: 3, deriv: 2, pow: 1, sci: 1 };
  // node types whose rendering needs \left( \right) when used as a power base
  var PW_TYPES = { frac: true, pow: true, sci: true, int: true, deriv: true };
  var FN_INPUT = { 'sin(': 'sin', 'cos(': 'cos', 'tan(': 'tan', 'log10(': 'log10', 'log(': 'log', 'f(': 'f', 'g(': 'g' };
  var FN_TEX = { '': '', sin: '\\sin', cos: '\\cos', tan: '\\tan', log10: '\\lg', log: '\\ln', f: 'f', g: 'g' };
  var NODE_INPUT = { 'sqrt(': 'sqrt', 'frac(': 'frac', 'int(': 'int', 'deriv(': 'deriv' };
  var OP_TEX = { '+': '+', '-': '-', '*': '\\times ', '/': '\\div ' };
  var VARS = { a: 1, b: 1, c: 1, x: 1, y: 1, z: 1 };

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
  ['a', 'b', 'c', 'x', 'y', 'z'].forEach(function (k) { editors['var_' + k] = newEditor(); });

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
    if (n.t === 'int') return 'int((' + serSlot(n.s[0]) + '),(' + serSlot(n.s[1]) + '),(' + serSlot(n.s[2]) + '))';
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
  function texSlot(b, cur) {
    if (b.length === 0) return (cur && cur.block === b) ? SQ_CUR_TEX : SQ_TEX;
    return texBlock(b, cur);
  }
  function texNode(n, cur) {
    if (n.t === 'frac') return '\\frac{' + texSlot(n.s[0], cur) + '}{' + texSlot(n.s[1], cur) + '}';
    if (n.t === 'sqrt') return '\\sqrt{' + texSlot(n.s[0], cur) + '}';
    if (n.t === 'int') {
      return '\\int_{' + texSlot(n.s[1], cur) + '}^{' + texSlot(n.s[2], cur) + '} ' +
        texSlot(n.s[0], cur) + '\\,\\mathrm{d}x';
    }
    if (n.t === 'deriv') {
      return '\\left.\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(' + texSlot(n.s[0], cur) +
        '\\right)\\right|_{x=' + texSlot(n.s[1], cur) + '}';
    }
    return SQ_TEX;
  }
  function texBlock(block, cur) {
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
      else if (it.t === 'pow' || it.t === 'sci') {
        var base = takeBase(top().parts);
        var ex = texSlot(it.s[0], cur);
        var s;
        if (base) {
          var bs = '{' + (base.pw ? '\\left(' + base.s + '\\right)' : base.s) + base.trail + '}';
          s = it.t === 'pow' ? bs + '^{' + ex + '}' : bs + '\\times10^{' + ex + '}';
        } else {
          s = it.t === 'pow' ? BASE_MISSING_TEX + '^{' + ex + '}' : '\\times10^{' + ex + '}';
        }
        add('operand', s, true);
      } else if (isNode(it)) {
        add('operand', texNode(it, cur), !!PW_TYPES[it.t], it.t === 'frac');
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
    if (e.root.length === 0) return cur ? CUR_TEX : '';
    return texBlock(e.root, cur);
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
    if (v === '^{}') { insertNode(e, makeNode('pow'), 0); return true; }
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
    var p = findParent(e.root, b);
    if (p) { e.cur.block = p.parentBlock; e.cur.idx = p.nodeIdx + 1; return true; }
    return false;
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
    if (/^[abcxyze0-9.+\-*\/(),]$/.test(key)) return key;
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
  function __dbg(key) {
    var k = key || activeEditorKey();
    var e = ed(k);
    return { key: k, ser: serialize(k), tex: renderTex(k), cur: cursorPath(e), empty: e.root.length === 0 };
  }

  return {
    // public editor API
    append: append, deleteLast: deleteLast, moveCursor: moveCursor, clearAll: clearAll,
    renderTex: renderTex, serialize: serialize, isEmpty: isEmpty, cursorToEnd: cursorToEnd,
    keyToInput: keyToInput, configure: configure, setKey: setKey,
    editors: editors, activeEditorKey: activeEditorKey, ed: ed, __dbg: __dbg,
    // internals (exported for tests and later steps)
    EMPTY_MARK: EMPTY_MARK, CUR_TEX: CUR_TEX, SQ_TEX: SQ_TEX, SQ_CUR_TEX: SQ_CUR_TEX,
    NODE_SLOTS: NODE_SLOTS, makeNode: makeNode, isNode: isNode, newEditor: newEditor,
    matchCloseIdx: matchCloseIdx, pendingOpenIdx: pendingOpenIdx, findParent: findParent,
    blockEmpty: blockEmpty, allSlotsEmpty: allSlotsEmpty, takeBase: takeBase,
    serBlock: serBlock, serSlot: serSlot, serNode: serNode, joinParts: joinParts,
    serializeRoot: serializeRoot, texBlock: texBlock, texSlot: texSlot, texNode: texNode,
    joinTex: joinTex
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