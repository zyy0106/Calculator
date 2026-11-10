# WebCASIO 计算器改造总计划 (PLAN)

> 本文件是**跨会话的唯一权威计划**。任何新对话冷启动时，先读本文件 + `docs/PROGRESS.md`，不要重新通读 `www/index.html`。

## 0. 任务来源（用户原始要求）

1. **输入健壮性**：排查并修复所有非人性化行为。输入分式 / 幂 / 积分 / 导数 / 根号，以及逐步 backspace 删除时，不得出现突然「语法错误」、多余括号、多余方框 □。需要设计大量算式，按人类习惯一步一步用按钮输入，中途 backspace，最后按 `=`。**最终要把这一大串测试算式以 Markdown 形式返回给用户。**
2. **物理常数面板**：在「变量」「计算」选项卡的 `a b c x y z` 变量按钮行右边加一个「物理常数」按钮。点击后，**公式显示框不变**，下方键盘区域变成两列选项卡，每个 cell 是「符号：中文名称」。长按 cell 在 cell 内显示该常数前几位科学记数法，松手回到符号模式；短按在公式光标处插入该符号。内部存储 ≥15 位有效数字。要求收录 CASIO fx-991CN CW 内全部物理常数 + 其他重要数学常数。**只用 SI 制数值，不带单位。** 插入的符号必须是**原子字符**（一次插入、一次删除，如 `ε₀`）。
3. 做完 (2) 后重复执行 (1) 复查。

**最终回复要求**：中文，带绝对路径，包含 Markdown 测试算式清单，并诚实区分「已验证」与「未验证」。

## 1. 仓库事实

- 根目录：`C:\Users\28233\Documents\ChatGPT\WebCASIO`
- 计算器是**单文件**：`C:\Users\28233\Documents\ChatGPT\WebCASIO\www\index.html`
  - 2318 行 / 124830 字节，原生 JS + mathjs 11 + KaTeX，**必须保持单文件**
- `C:\Users\28233\Documents\ChatGPT\WebCASIO\android\app\src\main\assets\public\index.html` 与之**逐字节相同**，改完后最后同步复制过去（用 `Compare-Object` 校验）
- git 工作区干净，仅有未跟踪的 `.github/workflows/1.tex`（属于用户，**绝对不要碰**）和本次新建的 `tools/`

## 2. 子对话拆分（必须按此执行）

| 步骤 | 产出物 | 改 index.html | 依赖 |
|---|---|---|---|
| **S1 常数数据** | `tools/constants-data.js`、`docs/常数表.md` | 否 | 无（可与 S2 并行） |
| **S2 编辑器内核** | `tools/editor-core.js` + `tools/editor-core.test.js` | 否 | 无（可与 S1 并行） |
| **S3 内核接入** | 改 `www/index.html` | **是** | S1 + S2 |
| **S4 常数面板 UI** | 改 `www/index.html` | **是** | S3 |
| **S5 测试套件 + 交付** | `tools/suite.js`、`docs/输入测试报告.md`、同步 android 副本 | 是（仅修 bug） | S4 |

S3/S4/S5 必须**串行**（同一文件）。每一步结束必须在 `docs/PROGRESS.md` 把自己标 DONE，写明绝对路径和验证方式。

## 3. `www/index.html` 已核实的源码地图

### CSS 12-413（`</style>` 在 414）
- `.cursor-blink` 70-75；`.vars-panel` 77；`.var-expr-cell` 97；`.var-val-cell` 98-102
- **103**：`#var-btns-row { display:grid; grid-template-columns:repeat(6,2fr); gap:6px; flex-shrink:0; }` → 改成 `repeat(7,2fr)`
- `.btn-var-sm` 104-110（`:active` 在 110）
- **112**：`.keyboard { flex:1; display:grid; grid-template-columns:repeat(5,1fr); gap:6px; min-height:0; }`
- `.main-cursor-row` 113；`button` 基样式 114-118；`button:active` 119；`.btn-func` 120
- 矩阵相关 CSS 不动

### HTML
- 416-417 body / `.calculator`；419-427 顶部导航（`vars funcs main plot roots fit matrix`）
- 429-436 vars-panel；438-444 `#main-screen`（`#single-line-display`、`#double-line-display` 内含 `#line-fx`/`#line-gx`、`#calc-res-val`）
- 446-457 roots；459-470 graph；472-596 fit；546-564 矩阵键盘；598-601 `#matrix-subnav`
- **603-610 `#var-btns-row`**：604-609 为六个 `<button class="btn-var-sm" onclick="append('a')">a</button>` … `'z'`。`#btn-const` 作为**第 7 个子元素**加在 609 之后
- **612-665 `#keyboard-area`**（`class="keyboard"`）；**666 行 `</div>` 关闭 `.calculator`** → `#const-panel` 插在 665 与 666 之间
- 按键：613 `f(`、614 `g(`、615 `int(`、616 `deriv(`、617 `x`；619 `sqrt(`、620-624 `frac(`（3 个 div 画 □/□）、625 `^{}`、626 `log10(`、627 `log(`；629-633 `sin( cos( tan( pi e`；635-640 `.main-cursor-row`（`(`、`)`、`moveCursor(-1)`、`moveCursor(1)`）；642-646 `7 8 9 DEL AC`；648-652 `4 5 6 * /`；654-658 `1 2 3 + -`；660-664 `0 . *10^{} Ans =`
- 668 `<script>`，2316 `</script>`，2317 `</body>`

### Script 668-2316
- 669-673 `math.import({lg})`
- 674 `let state = { mode:'main', expr:{main:'',fx:'',gx:'',vars:''}, rootTarget:'f', funcTarget:'f', fitTarget:'data', matrixTarget:'calc' }`
- 675 `currentExpression`；676 `cursorPos`；677 `lastAnswerVal=0`；678 `lastAnswerStr='0'`；679 `config`；680 `isTraceMode`
- 683-686 fit 状态；688-699 矩阵状态；701 `VAR_KEYS=['a','b','c','x','y','z']`；702 `VAR_LABELS`；703 `varExprs`；704 `varVals`；705 `activeVar='a'`
- 707-713 DOM 句柄：`singleDisplay`、`doubleDisplay`、`resVal`、`canvas`/`ctx`、`fitCanvas`/`fitCtx`
- 715 `evalWithLocalX`；730 `customInt`（Simpson n=1000，`rawArgs`，参数 f, lo, hi）；741 `customDeriv`（`mathObj.derivative`，退化为中心差分 h=1e-7）；766-770 `math.import({int,deriv,frac},{override:true})`
- 772-781 `initVarsPanel` IIFE（变量标签、4 个统计标签、`renderFitRows()`、`initMatrixControls()`、矩阵 `x^n`）
- **783-1092 旧字符串编辑器 → 整段删除**：`getEvalString` 783（正则泥潭）、`matchFunctionBefore` 844、`findMatchingClose` 850、`openFramesAt` 865、`getSlotFrameArgInfo` 895、`templateArgCount` 918、`closeCompletedTemplates` 928、`hasSlotFrameAncestor` 957、`persistEditedExpression` 966、`tryNavigateRight` 973、`moveCursor` 1053-1092
- 1094-1105 `updateVarsPanel`（`varExprs.x === ''` → `未定义`；`toFixed(8)`）
- 1107-1113 `selectVar(k)`：存 `varExprs[activeVar]=currentExpression`，载入 `varExprs[k]`，`cursorPos=length`，`updateVarsPanel()`，`renderLatex()`，设 `resVal`
- 1115-1124 `getCombinedScope()`：Map 含 `a,b,c,y,z` + **1118 行死代码 `alpha,beta,theta`（删）** + `Ans:lastAnswerVal`；仅当 `varExprs.x !== ''` 才设 `x`；1121-1122 try/catch `math.evaluate('f(x) = ' + getEvalString(state.expr.fx), scope)`，`g` 同理
- **1126-1348 `expressionToTexForDisplay` → 整段删除**：1126-1133 过期注释；1134 `if (!str) return ''`；1136 `XcurX`→`▲`、`□`→`■`；`extractFuncArgs` 1140；**1180-1194 一个重复的死 `renderLatex`（1182 `let tex = getDisplayTex(currentExpression, state.mode);`）**；`extractBlock` 1195；`needsDot` 1221；`parseBlock` 1248；1347 `return parseBlock(s);`，1348 `}`
- 1349-1357 `getDisplayTex(expr, mode)`：当 `mode === state.mode` 时在 `cursorPos` 插入 `'XcurX'`，调 `expressionToTexForDisplay`，funcs 前缀 `f(x) = `/`g(x) = `，vars 前缀 `VAR_LABELS[activeVar] + ' = '`
- 1358-1367 真正的 `renderLatex()`：`katex.render(tex, singleDisplay, {displayMode:true, throwOnError:true, trust:true})`；catch → 红字 `表达式过于复杂，请简化`
- 1369-1386 `updatePlotScreen()`，内含 `renderNoPrefix(id,label,exp)`；**1374 `tex = expressionToTexForDisplay(exp);` 必须换成树 TeX**；catch → `<span …>${label} 过于复杂</span>`；空 → `\cdots`；调用 `('line-fx','f(x)',state.expr.fx)` 与 `('line-gx','g(x)',state.expr.gx)`
- **1388-1432 `append(v)`**：1389 `let insertStr = v, offset = v.length`；`)` 分支用 `openFramesAt`；sqrt hack 在 1397/1420 写入 `'\u0001'`；`^{}`→`^{□}`；`*10^{}`；`sqrt(`；1424-1426 替换 `□`；1431 funcs 持久化
- 1434-1443 `findFracDelimiterAtCursor`
- **1445-1506 `deleteLast()`**：1450 `}` 只移动光标；1453-1462 逗号；1466-1479 sqrt/frac；1481 `atomicTokens`（含死的 `alpha,beta,theta`）；1492-1500 `^{` 分支；1504-1505 渲染 + 持久化
- 1508-1516 `clearAll()`：清 `currentExpression`/`cursorPos`，`renderLatex()`，main→`'0'`，vars→`x 未定义` 或 `'= '+toFixed(8)`，funcs→`编辑中...` 并写空进 `state.expr.fx/gx`
- 1518 `xUndefinedErr(e)`：`/undefined symbol\s+x\b/i` 或 `/\bx\b.*undefined/i`
- **1520-1569 `calculate()`**：1522 `currentExpression.includes('□')` → 直接 `语法错误`（**去掉**）；1523 `getEvalString`；1527 `math.parse`；1529 `getCombinedScope()`；1530 `math.evaluate`；1532 `num = typeof res === 'number' ? res : parseFloat(math.format(res))`；1535 `!isFinite(num)` → `数学错误`；1541-1545 vars 分支写 `varVals[activeVar]=num`、`varExprs[activeVar]`、`lastAnswerVal`、`lastAnswerStr = math.format(res,{precision:10})`、`resVal='= '+lastAnswerStr`、`updateVarsPanel()`；1546-1548 funcs → 存表达式 + `已保存`；1549-1553 main → `lastAnswerVal`/`lastAnswerStr`/`resVal`；1555-1568 catch：**空表达式检查太晚**（1559 `currentExpression.trim()===''` → `'0'`），`SyntaxError|Unexpected|parse error` → `语法错误`，`xUndefinedErr` → `错误: x 未定义`，否则 `数学错误`
- 1571-1771 fit：`renderFitRows` 1575、`updateFitData` 1594、`addFitRow` 1600、`removeFitRow` 1608、`toggleLogFit` 1610、`formatStatValue` 1625、`weightedStats` 1629、`updateVariableStats` 1649、`updateFitCalculation` 1668、`setFitTarget` 1761
- **1773-2067 矩阵：完全不要动**（`initMatrixControls` 1773 … `appendMatrixToken` 1993、`appendMatrixFunction` 2006、`appendMatrixTranspose` 2013、`moveMatrixCursor` 2014、`deleteMatrixLast` 2048、`clearMatrixCalc` 2066、`calculateMatrix` 2067；它自带 `matrixCalcExpr`/`matrixCalcCursor`）
- 2069-2074 `setFuncTarget`（2073 载入 `state.expr[t==='f'?'fx':'gx']`，光标到末尾，`resVal='编辑中...'`）
- 2076-2083 `setMatrixTarget`
- **2085-2135 `switchMode(m)`**：2086 vars 保存（`varExprs[activeVar]` 和 `state.expr.vars`），2087 main 保存；2089-2091 导航 class；2093-2096 载入表达式 + `cursorPos=length`；2098 mode 布尔；2100-2114 面板显隐（**2104 `keyboard-area` `'grid'/'none'`**、**2105 `var-btns-row` `'grid'/'none'`**，plot/roots/fit/matrix 下隐藏）；2116-2118 plot；2119-2121 fit；2122-2123 matrix；2124-2134 else（main → `'= '+lastAnswerStr`，vars → 值或 `x 未定义`，funcs → `编辑中...`，然后 `renderLatex()`）
- 2140 `setRootTarget`；2141 `brent`；2161 `safeFnWrap`；2171-2204 `calculateRoots`（2178 `math.compile(getEvalString(exp))`）；2206 `toggleTrace`；2207 `initCanvas`；2208 `makeMappers`；2209-2218 `drawGraph`（2216 compile）；2219-2234 `drawTracker`（2225 compile）；2236+ fit canvas；2287-2296 touch；2298-2301 range 同步
- **2303-2314 keydown 监听**：若 `activeElement.tagName === 'INPUT'` 直接返回；ArrowLeft/Right → `moveCursor`，Backspace → `deleteLast`，Escape → `clearAll`，Enter/`=` → `calculate`，`/[a-zA-Z0-9\.\+\-\*\/\(\),]/` → `append(key)`（**杂散字母会漏进来**），`^` → `append('^{}')`

### 783-1092 之外引用 `getEvalString`/`currentExpression`/`cursorPos` 的位置（已 grep 核实）
1108-1109、1121-1122、1182（死代码，将删）、1352、1360、1392-1431、1436-1440、1446-1505、1509/1515、1522-1559、2073、2086-2096、2178、2216、2225

## 4. 旧编辑器已确认的 bug（写进报告）

1. `SQRT 2 ) =` 会插入 `\u0001`，留下多余 `)`，`=` 报语法错误
2. 空表达式按 `=` → 数学错误（空检查只在 1559 的 catch 里）
3. `2 POW 3 DEL` 留下没有 □ 的 `2^{}`
4. 删 `^{` 需要按好几次（1450 行 `}` 只移动光标）
5. `int`/`deriv` 里的逗号永远删不掉
6. `getEvalString` 的隐式乘法正则很脆
7. funcs 模式下对 `x^2` 按 `=` 会报 x 未定义
8. 物理键盘会接受杂散字母（2312）
9. `getCombinedScope`(1118) 和 `atomicTokens`(1481) 里有死的 `alpha/beta/theta`

## 5. 目标设计

> **S2 已实现本节中编辑器内核的部分**（编辑器实例、数据项、插入、删除、← / →、TeX 渲染），代码在 `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\editor-core.js`。实际行为与本节的差异见 `docs\PROGRESS.md` 的「S2（已完成）」小节。本节中的 `calculate`、物理键盘接线、`selectVar` / `setFuncTarget` / `switchMode` 改造和 `updatePlotScreen` 重写仍由 S3 在 `index.html` 中完成。
对外 API 不变：`append(v)`、`deleteLast()`、`moveCursor(dir)`、`clearAll()`、`calculate()`、`renderLatex()`、`getDisplayTex(expr, mode)`。`getEvalString(s)` 变成**直通**（存的字符串已经是可求值的 mathjs 代码）。新增 `window.__dbg = () => ({ser, tex, cur})` 供测试脚手架使用。保留 `currentExpression`/`cursorPos` 作为**实时镜像**，这样 plot/roots/fit/matrix 代码无需改动。

### 编辑器实例
`editors = {main, fx, gx, var_a…var_z}`，每个为 `{root:[], cur:{block, idx}}`；`activeEditorKey()` 由 `state.mode`/`state.funcTarget`/`activeVar` 决定；每次编辑后序列化写回 `state.expr.main/fx/gx` 或 `varExprs[activeVar]`（空树 → `''`）。把 `selectVar`(1107)、`setFuncTarget`(2073)、`switchMode`(2086-2096) 改为**切换编辑器**而不是载入字符串；切换时光标置末尾。

### 数据项
原子：`{t:'d',v:'0'-'9'|'.'}`、`{t:'op',v:'+-*/'}`、`{t:'var',v}`、`{t:'const',id}`、`{t:'ans'}`、`{t:'open',fn:''|'sin'|'cos'|'tan'|'log10'|'log'|'f'|'g'}`、`{t:'close'}`。
节点（`makeNode`）：`frac`(2 槽)、`sqrt`(1)、`int`(3：f, lo, hi)、`deriv`(2：f, x0)、`pow`(1，后缀)、`sci`(1，后缀 ×10^)。

### 插入
原子插在光标处；frac/sqrt/int/deriv 带空槽插入，光标进槽 0；pow / `*10^{}` 光标进指数；`(` 和函数键**只插开括号**（块尾显示灰色幽灵 `)`）；`^{2}` → 含 2 的 pow。

### 删除（DEL）
左侧是原子 → 删掉（删 `open` 同时删掉配对的 `close`）；左侧是节点 → 全槽为空则删掉节点，否则进入最后一个非空槽的末尾；位于非首槽起点 → 回到上一槽末尾；位于首槽起点（或 pow/sci 的指数起点）→ **拆封**，其他槽为空时保留槽 0 内容，否则把光标移到节点之前；位于根起点 → 什么都不做。

### ← / →
按顺序遍历各槽；越过最后一个槽则离开该节点。

### 物理键盘
`a b c x y z` → 变量；`e` → 自然常数 e；其他字母忽略；`,` → 向右；`^` → pow；`(`/`)` 照常。

### TeX
空槽 `\square`，带光标时 `\htmlClass{cursor-blink}{\square}`，否则光标为 `\htmlClass{cursor-blink}{|}`；**每次渲染有且仅有一个光标**。`*`→`\times`，`/`→`\div`；隐式乘法不可见，仅数字→数字、数字→frac 用 `\cdot`。`\frac{}{}`、`\sqrt{}`、`\int_{lo}^{hi} f\,\mathrm{d}x`、`\left.\frac{\mathrm{d}}{\mathrm{d}x}\left(f\right)\right|_{x=x0}`、pow `{base}^{exp}`（base 为 frac/pow/int/deriv 时加括号）、sci `\times10^{exp}`、函数 `\sin\left(…\right)` 或未闭合时 `\right.` + 幽灵 `)`。常数用 `\htmlClass{const-sym}{…}` 包裹；自然常数 e 用 `\mathrm{e}`，元电荷用斜体 `e`；Ans 用 `\mathrm{Ans}`。保留显示前缀；重写 `updatePlotScreen`(1374) 用树 TeX。

### calculate
空表达式 → main 显示 `= 0`，**在求值之前就检查**；序列化代码里的 `EMPTY_MARK`(`\u0000`) 保证 mathjs 抛 SyntaxError → `语法错误`；funcs 模式用 x=1 试算，忽略数学错误，只区分 `语法错误` / `已保存`；保留既有错误分类；去掉 `□` 字符串检查。

## 6. 已写好的代码：`tools/editor-core.js`（S2 已完成）

`C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\editor-core.js`，22847 B，纯 ASCII，UMD 模块（Node：`require('./editor-core.js')`；浏览器：先加载 `constants-data.js` 再加载本文件，得到 `globalThis.EditorCore`）。它取代了旧草稿 `tools/editor-core.partA.js`（7457 B，已不再使用）。

已完成：
- 数据模型：`EMPTY_MARK='\u0000'`、`NODE_SLOTS={frac:2,sqrt:1,int:3,deriv:2,pow:1,sci:1}`、`makeNode`、`editors`、`activeEditorKey`、`ed()`。
- 序列化（规则同下，未改）：frac→`((n)/(d))`，sqrt→`sqrt((a))`，int→`int((f),(lo),(hi))`，deriv→`deriv((f),(x0))`，pow→`((b)^(e))`，sci→`((b)*10^(e))`（无底数时底数为 `1`），空槽→`EMPTY_MARK`，未闭合括号自动补齐，隐式乘法串包进 `(...)`。常数通过 S1 的 `constCode(id)` 输出数值字面量。
- TeX 渲染器 `renderTex(key, {cursor})`：镜像 `serBlock` 的 part / `takeBase` 分组，每次渲染恰好一个光标。
- 光标移动 `moveCursor`、插入 `append`、删除 `deleteLast`、`clearAll`、`cursorToEnd`、`isEmpty`、`serialize`、`keyToInput`（物理键盘映射）、`configure({getKey,onChange})`、`setKey`、`__dbg`。
- 单测：`tools/editor-core.test.js`，`node tools\editor-core.test.js` → `TESTS OK 2223 passed, 0 failed`。

S3 需要在 `index.html` 中定义的 CSS 类：`cursor-blink`、`ghost-paren`、`base-missing`、`const-sym`。KaTeX 渲染必须开启 `trust: true`（或只信任 `\htmlClass`），否则 `\htmlClass` 不生效。

**仍待实现（S3 起）**：把内核内联进 `index.html` 并接线（`append`/`deleteLast`/`moveCursor`/`clearAll` 委托给内核，`calculate` 重写，`getEvalString` 直通，模式与变量切换改为切换编辑器），以及常数面板 UI（S4）。
## 7. 常数面板 UI

`#btn-const`（标签「物理常数」）作为 `#var-btns-row` 的第 7 个子元素；103 行 grid 改 `repeat(7,2fr)`。它切换 `#const-panel`，该面板插在 `#keyboard-area` 之后（666 行 `</div>` 之前），占同一个 flex 位置：`flex:1; min-height:0; overflow-y:auto`，两列 grid，分组标题跨两列。面板内带小工具栏：← → DEL 返回键盘。

指针事件：长按约 450ms 给 cell 加 `.show-val`，显示 `尾数×10^指数`（约 10 位有效数字，不带单位）；松手/取消/离开恢复符号视图并**抑制**插入；移动超过 8px 取消点击以便滚动；短按 → `append('const:' + id)`。CSS `touch-action:pan-y; user-select:none; -webkit-touch-callout:none`；屏蔽 `contextmenu`。`switchMode` 必须隐藏面板、清掉按钮激活态，并在 plot/roots/fit/matrix 下恢复键盘。

## 8. 测试脚手架

目录 `C:\Users\28233\AppData\Local\Temp\webcasio-test\`（可能被系统清理；若丢失则重建，**新脚本一律写进仓库 `tools/`**）。现有：`node_modules`（playwright-core 1.57）、`package.json`（commonjs）、`package-lock.json`、`harness.js`(2451B)、`probe.js`(545B)、`cw.pdf`、`cw.txt`、`partA.js`。无头 Edge：`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`。Node v24.11.1。

- `harness.js` 导出 `open()` → `{browser, page, errors}`（收集 `pageerror`；视口 420×860；环境变量 `CALC` 可覆盖文件路径）、`press(page, key)`、`KEYMAP`。`press` 点击 `onclick` 等于 `KEYMAP[key]` 的可见按钮（或 `globalThis.EXTRA_KEYMAP[key]` 给的 `#selector`），返回 `{key, expr, cur, tex, err:/过于复杂/, cursors:#.cursor-blink 数量, res:#calc-res-val}`。键名：`f g INT DER SQRT FRAC POW LG LN SIN COS TAN PI E ( ) L R DEL AC * / + - . EXP ANS =`，数字 `0-9`，变量 `abcxyz`。**重写后把 `press` 改为读 `window.__dbg()`。**
- `probe.js "seq1" "seq2"` 打印逐步 trace，例如 `node probe.js "2 POW 3 DEL ="`。

## 9. 收尾清单（S5）

1. `tools/suite.js`：≥100 条拟人按键序列，中途含 DEL 和 ←/→，每条以 `=` 结束；每一步断言无 `过于复杂`、光标恰好 1 个、无 page error；最终结果与期望值比对。覆盖 frac、pow、sqrt、int、deriv、嵌套、sci、Ans、f/g、变量、funcs、plot、roots、物理键盘。
2. 常数插入/删除/长按测试，然后重跑全套（用户第 3 条）。
3. 把最终文件复制到 `C:\Users\28233\Documents\ChatGPT\WebCASIO\android\app\src\main\assets\public\index.html`；用 `Compare-Object` 校验。
4. 写 `C:\Users\28233\Documents\ChatGPT\WebCASIO\docs\输入测试报告.md`：测试表（按键序列 / 期望 / 实际 / 通过）、发现并修复的 bug、常数清单及来源（CW 说明书 p.57、CODATA 2018）与精度说明。
5. 最终回复用中文、带绝对路径，包含 Markdown 测试序列清单，并诚实区分「已验证」与「未验证」。

## 10. S3 编辑 index.html 的顺序

**自下而上，行号从大到小**：keydown 2303-2314 → `switchMode` 2086-2096 → `setFuncTarget` 2073 → `calculate` 1520-1569 → `clearAll`/`deleteLast`/`append` 1388-1516 → `updatePlotScreen` 1374 → 替换 1126-1348（含那个重复的死 `renderLatex`）→ `getCombinedScope` 1118 → `selectVar` 1107-1113 → 用 `tools/constants-data.js` + `tools/editor-core.js`（内联）替换 783-1092，并把 `getEvalString` 改成直通。矩阵代码 1773-2067 保持不动。然后加 HTML（`#btn-const`、`#const-panel`）和 CSS（103 行 + 新面板规则）。

## 11. 工具链坑

- `js` 工具**拒绝源码字面量里的全角 CJK 标点**（如 `：`），报 `Illegal character`。含中文的文件请用 `exec_command` + PowerShell here-string + `Set-Content -Encoding UTF8` 写，或避免在 JS 字面量里内联中文。
- `js` 工具里没有 `require`，用 `await import('node:fs')`；输出用 `nodeRepl.write(...)`。
- 看源码的常用写法：
  `cd C:\Users\28233\Documents\ChatGPT\WebCASIO\www; $l=Get-Content index.html; $l[A..B] | ForEach-Object -Begin {$i=A+1} -Process { "$i`: $_"; $i++ }`
