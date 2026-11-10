// S3 patch: replace the string-based editor in www/index.html with EditorCore (tree model).
// Usage: node tools/s3-patch.js   (refuses to run if anchors do not match)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'www', 'index.html');
let raw = fs.readFileSync(FILE, 'utf8');
const bom = raw.charCodeAt(0) === 0xFEFF; if (bom) raw = raw.slice(1);
const EOL = raw.includes('\r\n') ? '\r\n' : '\n';
const L = raw.split(/\r?\n/);
if (L.length < 2318) throw new Error('unexpected line count ' + L.length);
fs.writeFileSync(path.join(os.tmpdir(), 'index.html.bak-s3'), (bom ? '\uFEFF' : '') + raw, 'utf8');

function expect(n, s) { const got = L[n - 1]; if (!got.includes(s)) throw new Error(`anchor ${n}: expected "${s}", got "${got}"`); }
expect(75, '}'); expect(103, 'repeat(6, 2fr)'); expect(668, '<script>');
expect(783, 'function getEvalString(expr) {'); expect(1091, 'renderLatex();'); expect(1092, '}');
expect(1107, 'function selectVar(k) {'); expect(1113, '}');
expect(1117, 'a: varVals.a'); expect(1118, 'alpha: varVals.alpha'); expect(1119, '}));');
expect(1126, '// 核心渲染逻辑'); expect(1347, 'return parseBlock(s);'); expect(1348, '}');
expect(1349, '// 精简后的包装层'); expect(1358, 'function renderLatex() {'); expect(1369, 'function updatePlotScreen() {'); expect(1386, '}');
expect(1388, 'function append(v) {'); expect(1506, '}'); expect(1508, 'function clearAll() {'); expect(1516, '}');
expect(1518, 'function xUndefinedErr'); expect(1520, '// 遵循'); expect(1569, '}');
expect(2073, "if (state.mode === 'funcs') { currentExpression = state.expr[t");
expect(2085, 'function switchMode(m) {'); expect(2086, "if (state.mode === 'vars')"); expect(2087, "else if (state.mode === 'main')");
expect(2093, "if (m === 'vars') currentExpression"); expect(2096, 'cursorPos = currentExpression.length;');
expect(2312, '/[a-zA-Z0-9'); expect(2313, "if (key === '^')"); expect(2316, '</script>');

function cutAt(file, marker) {
  const t = fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/^\uFEFF/, '');
  const i = t.indexOf(marker); if (i < 0) throw new Error('marker missing in ' + file);
  const body = t.slice(0, i).trimEnd();
  if (/<\/script/i.test(body)) throw new Error('</script in ' + file);
  return body;
}
const constantsJs = cutAt('constants-data.js', '/* ---- 自检');
const editorJs = cutAt('editor-core.js', '/* ---- self test');

const GLUE = String.raw`// ===== 结构化公式编辑器接入 (EditorCore, 树模型) =====
// 每个可见元素是一个不可分割的项: 插入一次, 删除一次. 表达式字符串只是树的序列化结果.
EditorCore.configure({
    getKey: function () {
        if (state.mode === 'funcs') return state.funcTarget === 'f' ? 'fx' : 'gx';
        if (state.mode === 'vars') return 'var_' + activeVar;
        return 'main';
    },
    onChange: function (k, ser) {
        currentExpression = ser; cursorPos = ser.length;
        if (k === 'main' || k === 'fx' || k === 'gx') state.expr[k] = ser;
        // 变量编辑器只在 = 计算成功后写回 varExprs (见 calculate)
    }
});
function getEvalString(s) { return s || ''; }
function moveCursor(d) { EditorCore.moveCursor(d); renderLatex(); }
window.__dbg = function () { return EditorCore.__dbg(); };`;

const SELECTVAR = String.raw`function selectVar(k) {
    activeVar = k;
    EditorCore.cursorToEnd('var_' + k);
    currentExpression = EditorCore.serialize('var_' + k); cursorPos = currentExpression.length;
    updateVarsPanel(); renderLatex();
    if (k === 'x' && varExprs.x === '') resVal.innerText = 'x 未定义';
    else resVal.innerText = '= ' + parseFloat(varVals[k].toFixed(8)).toString();
}`;

const DISPLAY = String.raw`// 公式框 TeX 由编辑器树直接生成 (参数保留以兼容旧调用, 不再使用)
function getDisplayTex(expr, mode) {
    let tex = EditorCore.renderTex(EditorCore.activeEditorKey(), { cursor: true });
    if (state.mode === 'funcs') tex = (state.funcTarget === 'f' ? 'f(x) = ' : 'g(x) = ') + tex;
    if (state.mode === 'vars') tex = VAR_LABELS[activeVar] + ' = ' + tex;
    return tex;
}`;
const RENDER_AND_PLOT = String.raw`function renderLatex() {
    try {
        let tex = getDisplayTex(currentExpression, state.mode);
        // 注意这里将 throwOnError 改为 true，主动暴露渲染错误
        katex.render(tex, singleDisplay, { displayMode:true, throwOnError:true, trust:true });
    } catch (e) {
        // 捕获错误并输出平滑的中文提示
        singleDisplay.innerHTML = ` + '`' + String.raw`<div style="color:var(--btn-danger); font-size:16px; font-weight:800; display:flex; justify-content:center; align-items:center; padding-top:15px; font-family: sans-serif;">表达式过于复杂，请简化</div>` + '`' + String.raw`;
    }
}

function updatePlotScreen() {
    const renderNoPrefix = (id, label, key) => {
        const el = document.getElementById(id);
        try {
            const tex = EditorCore.isEmpty(key) ? '\\cdots' : EditorCore.renderTex(key, { cursor: false });
            katex.render(label + ' = ' + tex, el, { throwOnError:true, trust:true });
        } catch (e) {
            el.innerHTML = '<span style="color:var(--btn-danger); font-size:14px; font-weight:bold; font-family: sans-serif;">' + label + ' 过于复杂</span>';
        }
    };
    renderNoPrefix('line-fx', 'f(x)', 'fx');
    renderNoPrefix('line-gx', 'g(x)', 'gx');
}`;
// keep original renderLatex lines 1358-1367 verbatim instead of re-typing
const EDIT = String.raw`function append(v) { EditorCore.append(v); renderLatex(); }

function deleteLast() { EditorCore.deleteLast(); renderLatex(); }`;
const CLEAR_CALC = String.raw`function clearAll() {
    EditorCore.clearAll(); renderLatex();
    if (state.mode === 'main') resVal.innerText = '0';
    if (state.mode === 'vars') {
        if (activeVar === 'x' && varExprs.x === '') resVal.innerText = 'x 未定义';
        else resVal.innerText = '= ' + parseFloat(varVals[activeVar].toFixed(8));
    }
    if (state.mode === 'funcs') resVal.innerText = '编辑中...';
}

function xUndefinedErr(e) { const msg = e.message || ''; return /undefined symbol\s+x\b/i.test(msg) || /\bx\b.*undefined/i.test(msg); }

// 遵循 "语法错误 > 数学错误 > 变量未定义" 优先级的计算引擎
// 空槽序列化为 \u0000, math.parse 必然报语法错误
function calculate() {
    const key = EditorCore.activeEditorKey();
    const ser = EditorCore.serialize(key);
    if (state.mode === 'funcs') {
        try { math.parse(ser); state.expr[key] = ser; resVal.innerText = '已保存'; }
        catch (e) { resVal.innerText = '语法错误'; }
        return;
    }
    if (ser.trim() === '') { resVal.innerText = '0'; return; }
    try {
        math.parse(ser);
        const res = math.evaluate(ser, getCombinedScope());
        const num = typeof res === 'number' ? res : parseFloat(math.format(res));
        if (!isFinite(num)) { resVal.innerText = '数学错误'; return; }
        lastAnswerVal = num; lastAnswerStr = math.format(res, { precision:10 });
        if (state.mode === 'vars') {
            varVals[activeVar] = num; varExprs[activeVar] = ser;
            updateVarsPanel();
        }
        resVal.innerText = '= ' + lastAnswerStr;
    } catch (e) {
        const msg = e.message || '';
        if (/SyntaxError|Unexpected|parse error/i.test(e.name + msg)) resVal.innerText = '语法错误';
        else if (xUndefinedErr(e)) resVal.innerText = '错误: x 未定义';
        else resVal.innerText = '数学错误';
    }
}`;

const lines = s => s.split('\n');
const orig = (a, b) => L.slice(a - 1, b);
const rep = []; // [start, end, newLines] ; end = start-1 means pure insertion before start
rep.push([2312, 2313, ['    const inp = EditorCore.keyToInput(key); if (inp) { e.preventDefault(); append(inp); }']]);
rep.push([2093, 2096, ["    if (m === 'main' || m === 'funcs' || m === 'vars') { const k = EditorCore.activeEditorKey(); EditorCore.cursorToEnd(k); currentExpression = EditorCore.serialize(k); }",
  "    else currentExpression = state.expr[m] || '';", '    cursorPos = currentExpression.length;']]);
rep.push([2086, 2087, []]);
rep.push([2073, 2073, ["    if (state.mode === 'funcs') { const k = t === 'f' ? 'fx' : 'gx'; EditorCore.cursorToEnd(k); currentExpression = EditorCore.serialize(k); cursorPos = currentExpression.length; renderLatex(); resVal.innerText = '编辑中...'; }"]]);
rep.push([1508, 1569, lines(CLEAR_CALC)]);
rep.push([1388, 1506, lines(EDIT)]);
rep.push([1349, 1386, lines(DISPLAY).concat(orig(1358, 1367), [''], lines(RENDER_AND_PLOT).slice(lines(RENDER_AND_PLOT).indexOf('function updatePlotScreen() {')))]);
rep.push([1126, 1348, []]);
rep.push([1117, 1118, ['        a: varVals.a, b: varVals.b, c: varVals.c, y: varVals.y, z: varVals.z, Ans: lastAnswerVal']]);
rep.push([1107, 1113, lines(SELECTVAR)]);
rep.push([783, 1092, lines(GLUE)]);
rep.push([668, 667, ['<script>', '// ===== 内联模块: tools/constants-data.js 与 tools/editor-core.js (不含 Node 自检段) =====']
  .concat(lines(constantsJs.replace(/\r\n/g, '\n')), [''], lines(editorJs.replace(/\r\n/g, '\n')), ['</script>'])]);
rep.push([103, 103, [L[102].replace('repeat(6, 2fr)', 'repeat(7, 2fr)')]]);
rep.push([76, 75, ['        .ghost-paren { color: #aaa; }', '        .base-missing { color: #c00; }', '        .const-sym { }']]);
let prev = Infinity;
for (const [a, b, nl] of rep) { if (b >= prev) throw new Error('ranges not bottom-up at ' + a); prev = a; L.splice(a - 1, b - a + 1, ...nl); }
fs.writeFileSync(FILE, (bom ? '\uFEFF' : '') + L.join(EOL), 'utf8');
console.log('patched, lines =', L.length, 'eol =', JSON.stringify(EOL), 'bom =', bom);
