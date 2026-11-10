/* ═══════════════════════════════════════════════════════════════════
   结构化公式编辑器（树模型）
   每一个可视元素都是一个不可分割的节点，插入一次 / 删除一次。
   state.expr.* 与 varExprs.* 中保存的是序列化后的 mathjs 字符串。
   ═══════════════════════════════════════════════════════════════════ */
const EMPTY_MARK = '\u0000';              // 空槽位标记：保证求值时必定报语法错误
const CUR_TEX    = '\\htmlClass{cursor-blink}{|}';
const SQ_TEX     = '\\square';
const SQ_CUR_TEX = '\\htmlClass{cursor-blink}{\\square}';

const NODE_SLOTS = { frac: 2, sqrt: 1, int: 3, deriv: 2, pow: 1, sci: 1 };

function makeNode(t) {
    const n = { t: t, s: [] };
    for (let i = 0; i < NODE_SLOTS[t]; i++) n.s.push([]);
    return n;
}
function isNode(it) { return !!(it && it.s); }

function newEditor() { const root = []; return { root: root, cur: { block: root, idx: 0 } }; }
const editors = {};
['main', 'fx', 'gx'].forEach(function (k) { editors[k] = newEditor(); });
['a', 'b', 'c', 'x', 'y', 'z'].forEach(function (k) { editors['var_' + k] = newEditor(); });

function activeEditorKey() {
    if (state.mode === 'funcs') return state.funcTarget === 'f' ? 'fx' : 'gx';
    if (state.mode === 'vars')  return 'var_' + activeVar;
    return 'main';
}
function ed() { return editors[activeEditorKey()]; }

/* ---------- 括号配对 ---------- */
function matchCloseIdx(block, i) {
    let depth = 0;
    for (let j = i; j < block.length; j++) {
        if (block[j].t === 'open') depth++;
        else if (block[j].t === 'close') { depth--; if (depth === 0) return j; }
    }
    return -1;
}
// 光标处是否存在"仍然没有右括号"的左括号；返回其下标，没有则 -1
function pendingOpenIdx(block, idx) {
    const stack = [];
    for (let j = 0; j < idx; j++) {
        if (block[j].t === 'open') stack.push(j);
        else if (block[j].t === 'close') stack.pop();
    }
    while (stack.length) {
        const k = stack.pop();
        if (matchCloseIdx(block, k) === -1) return k;
    }
    return -1;
}

/* ---------- 定位父节点 ---------- */
function findParent(root, block) {
    function walk(blk) {
        for (let i = 0; i < blk.length; i++) {
            const it = blk[i];
            if (!isNode(it)) continue;
            for (let si = 0; si < it.s.length; si++) {
                if (it.s[si] === block) return { node: it, slot: si, parentBlock: blk, nodeIdx: i };
                const r = walk(it.s[si]);
                if (r) return r;
            }
        }
        return null;
    }
    return walk(root);
}
function blockEmpty(b) { return b.length === 0; }
function allSlotsEmpty(n) { return n.s.every(blockEmpty); }

/* ═══════════ 通用线性扫描：把一个 block 折叠为若干 part ═══════════
   part = { k:'digit'|'operand'|'op'|'cursor', s:字符串, pw:作为幂底数时是否要加括号 }
   该过程同时被 TeX 渲染与序列化复用，二者行为完全一致。           */
function takeBase(parts) {
    let j = parts.length - 1;
    const trail = [];
    while (j >= 0 && parts[j].k === 'cursor') { trail.unshift(parts[j].s); j--; }
    if (j < 0) return null;
    if (parts[j].k === 'operand') {
        const p = parts[j];
        parts.length = j;
        return { s: p.s, pw: p.pw, trail: trail.join('') };
    }
    if (parts[j].k === 'digit') {
        let st = j;
        const buf = [];
        while (st >= 0 && (parts[st].k === 'digit' || parts[st].k === 'cursor')) { buf.unshift(parts[st].s); st--; }
        parts.length = st + 1;
        return { s: buf.join(''), pw: false, trail: trail.join('') };
    }
    return null;
}

/* ---------- 序列化（求值用） ---------- */
function serBlock(block) {
    const stack = [{ fn: '', parts: [] }];
    const top = function () { return stack[stack.length - 1]; };
    const add = function (k, s, pw) { top().parts.push({ k: k, s: s, pw: pw }); };
    const closeFrame = function () {
        const fr = stack.pop();
        const inner = joinParts(fr.parts);
        const body = inner === '' ? EMPTY_MARK : inner;
        let code;
        if (fr.fn === '') code = '(' + body + ')';
        else code = fr.fn + '(' + body + ')';
        top().parts.push({ k: 'operand', s: code, pw: false });
    };
    for (let i = 0; i < block.length; i++) {
        const it = block[i];
        if (it.t === 'd')        add('digit', it.v, false);
        else if (it.t === 'op')  add('op', it.v, false);
        else if (it.t === 'var') add('operand', it.v, false);
        else if (it.t === 'ans') add('operand', 'Ans', false);
        else if (it.t === 'const') add('operand', constCode(it.id), false);
        else if (it.t === 'open') stack.push({ fn: it.fn, parts: [] });
        else if (it.t === 'close') { if (stack.length > 1) closeFrame(); }
        else if (it.t === 'pow' || it.t === 'sci') {
            const base = takeBase(top().parts);
            const expCode = serSlot(it.s[0]);
            if (it.t === 'pow') {
                const b = base ? base.s : EMPTY_MARK;
                add('operand', '((' + b + ')^(' + expCode + '))', false);
            } else {
                const b = base ? base.s : '1';
                add('operand', '((' + b + ')*10^(' + expCode + '))', false);
            }
        } else if (isNode(it)) {
            add('operand', serNode(it), false);
        }
    }
    while (stack.length > 1) closeFrame();   // 自动补齐缺失的右括号
    return joinParts(stack[0].parts);
}
function serSlot(b) { const s = serBlock(b); return s === '' ? EMPTY_MARK : s; }
function serNode(n) {
    if (n.t === 'frac')  return '((' + serSlot(n.s[0]) + ')/(' + serSlot(n.s[1]) + '))';
    if (n.t === 'sqrt')  return 'sqrt((' + serSlot(n.s[0]) + '))';
    if (n.t === 'int')   return 'int((' + serSlot(n.s[0]) + '),(' + serSlot(n.s[1]) + '),(' + serSlot(n.s[2]) + '))';
    if (n.t === 'deriv') return 'deriv((' + serSlot(n.s[0]) + '),(' + serSlot(n.s[1]) + '))';
    return EMPTY_MARK;
}
// 把 part 列表拼成代码：相邻操作数之间补乘号，并整体加括号，
// 使省略乘号的乘法优先级高于 × ÷（1÷2π = 1/(2π)）。
function joinParts(parts) {
    const merged = [];
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.k === 'cursor') continue;
        if (p.k === 'digit' && merged.length && merged[merged.length - 1].k === 'num') {
            merged[merged.length - 1].s += p.s;
        } else if (p.k === 'digit') {
            merged.push({ k: 'num', s: p.s });
        } else if (p.k === 'op') {
            merged.push({ k: 'op', s: p.s });
        } else {
            merged.push({ k: 'num', s: p.s });
        }
    }
    let out = '';
    let i = 0;
    while (i < merged.length) {
        if (merged[i].k === 'op') { out += merged[i].s; i++; continue; }
        const run = [];
        while (i < merged.length && merged[i].k === 'num') { run.push(merged[i].s); i++; }
        out += run.length === 1 ? run[0] : '(' + run.join('*') + ')';
    }
    return out;
}
function serializeRoot(root) { return serBlock(root); }
