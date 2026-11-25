# 积分方程求根功能恢复指南（INTEQ-RESTORE）

U1 阶段已把「积分方程」求根子模式从 `www/index.html` 的界面中移除。求解器源码和测试仍保留在仓库里。按本文操作可以一次恢复。

## 1. 功能说明

求解参数方程

$$\int_{a(x)}^{b(x)} F(t,x)\,dt = c$$

中的未知实数 x。积分上下限 a(x)、b(x) 和被积函数 F(t,x) 都可以含 x，t 是积分哑元。界面中的 F 取自「函数」选项卡里的 f(x) 或 g(x) 编辑器，由「针对 f(x) / 针对 g(x)」选择；a(x)、b(x)、c 由输入框给出。解的搜索区间沿用代数求根的 Start/End。

算法：内层积分用复合 Simpson（与 index.html 的 customInt 同一格式）；外层在 [xMin, xMax] 上扫描 G(x)=I(x)−c 的变号区间，再用 Brent 法细化。

## 2. 保留的求解器

| 项 | 值 |
|---|---|
| 文件 | `tools/inteq-solver.js`（201 行，纯 ASCII，非 ASCII 用 \uXXXX） |
| 测试 | `tools/inteq-solver.test.js` |
| 导出 | UMD：浏览器 `globalThis.InteqSolver`；Node `require('./inteq-solver.js')` |
| API | `InteqSolver.solveParamLimitIntegral({ F, lower, upper, c, xMin, xMax, steps, n, tol })` |
| 其它导出 | `integrate`、`DEFAULT_N`(128)、`DEFAULT_STEPS`(2000) |

参数：`F(t,x)`、`lower(x)`、`upper(x)` 都是返回 number 的函数（字符串需调用方先用 math.compile 编译）；`c` 有限实数；`xMin < xMax`；`steps` 扫描步数（1–100000）；`n` Simpson 分段数（偶数）；`tol` 默认 1e-12。

返回值约定：

- 成功：`{ ok: true, roots: number[], residuals: number[], evals: number, error: null }`
- 失败：`{ ok: false, roots: [], residuals: [], evals, error: '中文错误信息' }`，**从不抛异常**（内部异常也被包装成 ok:false）。

测试命令与期望输出：

```
node tools\inteq-solver.test.js
...
pass 28 / 28
```

U1 移除前已核对：index.html 内联的求解器段与 `tools/inteq-solver.js` 逐字一致（8674 字符，LF 归一后比较）。恢复时直接把该文件内容整体内联即可。

## 3. 本次从 index.html 移除的内容

行号指 U1 移除前的版本（U1 其它改动已完成、N1 尚未执行时的快照）。现在的文件中这些行已不存在，请用下面的锚点定位插入位置。

### 3.1 求根面板的子模式切换按钮（原 513–516 行）

位置：`<div ... id="roots-panel">` 的第一个子元素，位于「针对 f(x) / 针对 g(x)」那一行之前。

```html
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="nav-btn active" id="root-mode-alg"   onclick="setRootMode('alg')">代数求根</button>
            <button class="nav-btn"        id="root-mode-inteq" onclick="setRootMode('inteq')">积分方程</button>
        </div>
```

### 3.2 积分方程输入区（原 521–534 行）

位置：紧接「针对 f(x)/g(x)」行之后、`<div class="boundary-grid one-row">`（Start/End）之前。输入框 id：`inteqLower`、`inteqUpper`、`inteqC`、`inteqN`、`inteqSteps`。

```html
        <div id="inteq-inputs" style="display:none;flex-direction:column;gap:6px;flex-shrink:0;">
            <div style="font-size:11px;color:#666;line-height:1.4;">方程 ∫<sub>a(x)</sub><sup>b(x)</sup> F(t, x) dt = c：F 取自上方所选 f(x)/g(x) 编辑器内容，其中 t 为积分哑元、x 为待求参数</div>
            <div class="boundary-grid">
                <div class="boundary-item"><span>a(x)</span><input type="text" id="inteqLower" value="0"></div>
                <div class="boundary-item"><span>b(x)</span><input type="text" id="inteqUpper" value="x"></div>
                <div class="boundary-item" style="grid-column:span 2;"><span>c</span><input type="text" id="inteqC" value="2"></div>
            </div>
            <details style="font-size:11px;color:#666;"><summary>高级</summary>
                <div class="boundary-grid one-row" style="margin-top:4px;">
                    <div class="boundary-item"><span>n</span><input type="number" id="inteqN" value="64" step="2"></div>
                    <div class="boundary-item"><span>steps</span><input type="number" id="inteqSteps" value="400" step="100"></div>
                </div>
            </details>
        </div>
```

### 3.3 求解按钮（原 540 行）

位置：`id="root-btn-alg"` 按钮之后、`id="root-list"` 之前。

```html
        <button class="btn-calc" style="font-size:16px;padding:8px;border-radius:12px;display:none;" id="root-btn-inteq" onclick="calculateIntegralEq()">求解积分方程</button>
```

### 3.4 CSS（原 218 行）

位置：`.root-katex-item` 规则之后。只有积分方程结果用到它，代数求根不使用。

```css
        .root-resid { font-size: 11px; color: #888; font-family: var(--cm); }
```

### 3.5 内联求解器脚本（原 1810–2012 行，共 203 行）

位置：长按气泡组件 `LongPressBubble` 的 `<script>` 结束之后、主程序 `<script>` 之前。整段是 `<script>` + `tools/inteq-solver.js` 全文 + `</script>`。

- 首行：`<script>`
- 第 2 行：`/* WebCASIO parametric-limit integral equation solver (pure computation, no DOM).`
- 倒数第 2 行：`});`
- 末行：`</script>`

### 3.6 宿主侧函数（原 2944–3028 行，共 85 行）

位置：`calculateRoots()` 函数结束之后、`function toggleTrace()` 之前。现在该位置留有一行注释：
`// U1: integral-equation root mode removed from the UI; restore guide: docs/INTEQ-RESTORE.md`，把这行替换回下面的原文即可。

包含 `setRootMode`、`inteqUndefinedSymbol`、`calculateIntegralEq`、`inteqRun`：

```js
// I4b: 积分方程 ∫_{a(x)}^{b(x)} F(t,x) dt = c，关于参数 x 求解（S1 InteqSolver）
function setRootMode(m) {
    state.rootMode = m;
    const inteq = m === 'inteq';
    document.getElementById('root-mode-alg').classList.toggle('active', !inteq);
    document.getElementById('root-mode-inteq').classList.toggle('active', inteq);
    document.getElementById('inteq-inputs').style.display = inteq ? 'flex' : 'none';
    document.getElementById('root-btn-alg').style.display = inteq ? 'none' : '';
    document.getElementById('root-btn-inteq').style.display = inteq ? '' : 'none';
    document.getElementById('root-list').innerHTML = '';
}
// 检查表达式中的自由符号是否都有定义；locals 为局部变量名（如 t、x）
function inteqUndefinedSymbol(node, locals) {
    let bad = null;
    node.traverse(function (n, path, parent) {
        if (bad || !n.isSymbolNode) return;
        if (parent && parent.isFunctionNode && path === 'fn') return;
        const s = n.name;
        if (locals.indexOf(s) >= 0 || s === 'Ans') return;
        if (Object.prototype.hasOwnProperty.call(varExprs, s)) { if (varExprs[s] === '') bad = s; return; }
        if (!(s in math)) bad = s;
    });
    return bad;
}
function calculateIntegralEq() {
    const listEl = document.getElementById('root-list');
    listEl.innerHTML = ''; listEl.innerText = '计算中…';
    setTimeout(function () {
        const t0 = performance.now();
        const msg = inteqRun(listEl); if (typeof msg === 'string') listEl.innerText = msg;
        listEl.dataset.ms = String(Math.round(performance.now() - t0));
    }, 0);
}
function inteqRun(listEl) {
    const x1 = parseFloat(document.getElementById('rootX1').value), x2 = parseFloat(document.getElementById('rootX2').value);
    const exp = state.expr[state.rootTarget === 'f' ? 'fx' : 'gx'];
    if (!exp) return '被积函数未定义：请在函数选项卡输入 ' + (state.rootTarget === 'f' ? 'f(x)' : 'g(x)');
    if (!(x1 < x2)) return 'Start 必须小于 End';
    const fields = [['inteqLower', '下限 a(x)', ['x']], ['inteqUpper', '上限 b(x)', ['x']], ['inteqC', '右端常数 c', []]];
    const nodes = [];
    let fNode;
    try { fNode = math.parse(getEvalString(exp)); } catch (e) { return '被积函数无法解析: ' + e.message; }
    let bad = inteqUndefinedSymbol(fNode, ['t', 'x']);
    if (bad) return '被积函数中变量未定义: ' + bad;
    for (const [id, label, locals] of fields) {
        const txt = document.getElementById(id).value.trim();
        let node;
        try { if (!txt) throw new Error('空'); node = math.parse(txt); } catch (e) { return label + ' 表达式无法解析'; }
        if (node.filter(n => n.isSymbolNode && n.name === 't').length) return label + ' 不能含积分哑元 t';
        if (!locals.length && node.filter(n => n.isSymbolNode && n.name === 'x').length) return '右端常数 c 无效（不能含 x）';
        bad = inteqUndefinedSymbol(node, locals);
        if (bad) return label + ' 中变量未定义: ' + bad;
        nodes.push(node);
    }
    try {
        const scope = getCombinedScope();
        const fCode = fNode.compile(), loCode = nodes[0].compile(), upCode = nodes[1].compile();
        const fs = new Map(scope), ls = new Map(scope);
        const num = function (v) {
            if (typeof v === 'number') return isFinite(v) ? v : NaN;
            if (v && typeof v === 'object' && 're' in v) return Math.abs(v.im) > 1e-12 ? NaN : v.re;
            return NaN;
        };
        const F = function (t, x) { try { fs.set('t', t); fs.set('x', x); return num(fCode.evaluate(fs)); } catch (e) { return NaN; } };
        const lower = function (x) { try { ls.set('x', x); return num(loCode.evaluate(ls)); } catch (e) { return NaN; } };
        const upper = function (x) { try { ls.set('x', x); return num(upCode.evaluate(ls)); } catch (e) { return NaN; } };
        let c;
        try { c = num(nodes[2].compile().evaluate(new Map(scope))); } catch (e) { c = NaN; }
        if (!isFinite(c)) return '右端常数 c 无效';
        const n = parseInt(document.getElementById('inteqN').value, 10), steps = parseInt(document.getElementById('inteqSteps').value, 10);
        const r = InteqSolver.solveParamLimitIntegral({ F: F, lower: lower, upper: upper, c: c, xMin: x1, xMax: x2, steps: steps, n: n });
        listEl.dataset.evals = String(r.evals);
        if (!r.ok) return r.error;
        if (!r.roots.length) return '未发现解';
        listEl.innerHTML = '';
        r.roots.forEach(function (x, idx) {
            const div = document.createElement('div'); div.className = 'root-katex-item'; listEl.appendChild(div);
            const v = Math.abs(x) < 1e-10 ? 0 : x;
            katex.render((r.roots.length > 1 ? `x_{${idx + 1}}` : 'x') + ` = ${parseFloat(v.toFixed(8))}`, div);
            const res = document.createElement('div'); res.className = 'root-resid';
            res.textContent = '|G(x)| = ' + Number(r.residuals[idx]).toExponential(2); div.appendChild(res);
        });
        return undefined;
    } catch (e) { return '计算出错: ' + e.message; }
}
```

### 3.7 变量 t（N2 同时移除，与积分方程相关）

变量面板卡片（原 501 行，`id="var-row-z"` 之后）：

```html
        <div class="var-card" id="var-row-t" onclick="selectVar('t')"><div class="var-name-cell" id="vname-t"></div><div class="var-val-cell" id="vval-t">0</div></div>
```

主脚本中的变量表（U1 后的写法 → 恢复写法）：

```js
const VAR_KEYS   = ['a','b','c','x','y','z'];          // → ['a','b','c','x','y','z','t']
const VAR_LABELS = { a:'a', b:'b', c:'c', x:'x', y:'y', z:'z'};   // → 追加 t:'t'
const varExprs   = { a:'', b:'', c:'', x:'', y:'', z:''};         // → 追加 t:''
const varVals    = { a:0,  b:0,  c:0,  x:0,  y:0,  z:0};          // → 追加 t:0
// getCombinedScope():  ..., z: varVals.z, Ans: lastAnswerVal     // → ..., z: varVals.z, t: varVals.t, Ans: ...
```

内核 `tools/editor-core.js`（及其内联副本）没有改动：`VARS` 里仍有 `t`，`var_t` 编辑器仍会创建。所以恢复 t 只需改宿主侧，不用改内核。

## 4. 恢复时的接线点

1. **子模式切换**：恢复 3.1 的按钮和 3.6 的 `setRootMode`。`state.rootMode` 只由 `setRootMode` 写入，其它代码不读它，默认就是代数求根。
2. **输入框 id**：3.2 的五个 id 必须与 `inteqRun` 里的 `getElementById` 一致（`inteqLower/Upper/C/N/Steps`）。
3. **按钮显隐**：`setRootMode` 切换 `#root-btn-alg` 与 `#root-btn-inteq` 的显示，以及 `#inteq-inputs` 的显示。
4. **`getCombinedScope` 是否需要 t**：**不需要**。`inteqRun` 每次求值前用 `fs.set('t', t); fs.set('x', x)` 把哑元和参数写进局部 Map，覆盖全局作用域。`inteqUndefinedSymbol` 把 `t`、`x` 作为局部名跳过检查。
5. **变量面板 t 是否一并恢复**：**可选，不是必需**。积分方程的 t 是局部哑元，与变量面板的 t 无关。只有用户要在其它计算中把 t 当普通变量时才需要恢复 3.7，并且要在 `key-ln` 长按气泡里加回输入入口，例如 `{ label: 't', input: 't' }`。
6. **键盘**：U1 的第 1 行变量键只有 a b c x y z。在函数编辑器里输入含 t 的被积函数需要 t 的入口，否则只能写不含 t 的 F。**若恢复积分方程，必须同时提供 t 的输入入口**（建议用 5 中的长按项）。
7. **布局**：求根面板 `#roots-panel` 是 `flex:1` 的列布局，恢复后的输入区 `flex-shrink:0`，结果区 `.root-results` 自动缩小。U1 的 `fitKeyboard()` 只处理计算键盘，与求根面板无关。

## 5. 已知限制（保留原文）

- 不支持 Fredholm / Volterra 方程（未知函数）、多未知参数、复数根、反常积分、自适应积分；
- 偶重根（G(x) 只触 0 不变号）扫描不到；
- n=64 下振荡 / 不光滑被积函数精度未测。

## 6. 恢复后的验证清单

1. `node tools\inteq-solver.test.js` → `pass 28 / 28`。
2. 把 index.html 的所有内联 `<script>` 提取到临时目录，逐个 `node --check` 通过。
3. 用脚本比对内联求解器段与 `tools/inteq-solver.js`，差异为 0。
4. `grep inteq www/index.html` 能找到 3.1–3.6 的所有 id 和函数名；文件仍是 CRLF、无 BOM。
5. 浏览器实测（Playwright 或真机）：
   - f(x) 输入 `1`，a=0、b=x、c=2，Start=-10、End=10 → x = 2；
   - f(x)=`t+x`，a=0、b=x、c=2 → x ≈ 1.63299316（= √(8/3)）；
   - 错误输入：Start ≥ End → 「Start 必须小于 End」；c 含 x → 「右端常数 c 无效（不能含 x）」；被积函数为空 → 「被积函数未定义：请在函数选项卡输入 f(x)」；
   - 切回「代数求根」，f(x)=`x^2-4` → x₁=−2、x₂=2；
   - 页面无 pageerror。
6. `node tools\suite-v2.js` 的 i4b 段（积分方程用例）恢复通过。U1 后 suite 中 `#root-mode-inteq` 找不到导致的 i4b 崩溃应当消失。
7. 计算 / 函数 / 变量三个选项卡在 420×860、360×640 下无纵向溢出（U1 的布局规则不受影响）。
