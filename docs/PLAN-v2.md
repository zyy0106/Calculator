# WebCASIO v2 改造：上下文预算与子任务分配（rev2）

> 只做任务划分，不含代码改动。rev2 依据用户 2026-11-17 第二轮澄清重写：长按反函数、6 列含半宽括号、长按 log 出 ln/t、积分方程明确为"上下限与被积函数均含 x，关于参数 x 求解"。
> 进度看板：`C:\Users\28233\Documents\ChatGPT\WebCASIO\docs\PROGRESS.md`。前序事实：git HEAD=1bd072a，S0-S5 DONE。

## 1. 仓库事实（已核实）

- 唯一源码：`C:\Users\28233\Documents\ChatGPT\WebCASIO\www\index.html`，135394 B / 2478 行，CSS+JS 全内联，必须保持单文件。
- 派生副本（I5 统一同步，不手改）：`android\app\src\main\assets\public\index.html`；`android\app\build\...\public\index.html` 是构建产物，不纳入。
- 内核离线副本：`tools\editor-core.js`（22847 B，纯 ASCII UMD，`node tools\editor-core.js --selftest`），单测 `tools\editor-core.test.js`（2223 断言）。index.html 719-1423 是其内联版（去 Node 自检段），两处必须成对改。
- 回归套件 `tools\suite.js`（153 例），依赖 `%TEMP%\webcasio-test\harness.js`（已存在）；node v24.11.1。
- 已验证的 mathjs 能力：`asin/acos/atan` 存在；`log(8,2)=3`（双参对数可直接用）。
- 禁止触碰 `.github\workflows\1.tex`。含中文文件用 PowerShell here-string + `Set-Content -Encoding UTF8` 写。

## 2. 源码锚点（按锚点读，不整文件读）

| 功能 | index.html | tools 副本 |
|---|---|---|
| `.keyboard`(5列)、`.main-cursor-row` | 151-152 | — |
| 长按样式 `.const-cell`/`.c-val` | 135-149 | — |
| 键盘 HTML | 642-705 | — |
| 符号表 `OP_TEX/FN_INPUT/FN_TEX/NODE_INPUT/NODE_SLOTS/PW_TYPES/VARS` | 901-915 | 同名段 |
| 树基础 `makeNode/findParent/takeBase` | 950-1078 | 同 |
| 序列化 `serBlock/serNode/joinParts` | 1080-1144 | 同 |
| TeX `joinTex/texSlot/texNode/texBlock/renderTex` | 1146-1228 | 同 |
| 编辑 `doAppend/commaMove/closeParen/doDelete/doMove/cursorPath` | 1239-1364、1391-1401 | 同 |
| 导出段 | 1408-1422 | 同 |
| `VAR_KEYS/VAR_LABELS/varVals` | 1458-1461 | — |
| `customInt/customDeriv/math.import` | 1487-1527 | — |
| `getCombinedScope/renderLatex/append/calculate` | 1580-1671 | — |
| 求根面板 HTML / `brent`/`calculateRoots` | 485-496 / 2236-2299 | — |
| 长按手势参考实现 `CONST_LONG_MS=450,CONST_MOVE_PX=8` + `bindConstCell` | 2403、2428-2455 | — |
| `switchMode` 显隐 | 2182-2230 | — |

## 3. 容量与预算基准

- `W=200000`（情景假设，本会话未实测）、`p=75`、`L` 未知 → `H=150000`、`B=0.75H=112500`、`F=24000`（skill 默认假设）、`u=1.25`。
- 公式：`N=F+ceil(u(R+G+V+Q))`，`rho=N/B`，`Rmax=(B-F)/u-G-V-Q`。
- 已验证：若实际为 `H=32000` 档，下列全部任务 `rho>1.7` 且 `Rmax=0`，必须缩小单步或换更大容量会话，不得靠继续拆分硬上。

## 4. 需求 → 设计定稿（rev2）

### R1 游离右括号
`closeParen`（1287-1294）现在在槽内无待闭合 open 时用 `findParent` 把光标移出槽。改为：无法配对时插入 `{t:'xclose'}`，TeX 渲染裸 `)`（得到 `\sqrt{8)}`），序列化输出使 `math.parse` 必然抛语法错误的串。保留：有待闭合 open 时正常闭合；光标正好在 `close` 左侧时右跨一位；`,`/`commaMove` 不变。

### R2 公式区自动右滚
`#single-line-display`（478）与 `.latex-line`（65-68）已 `overflow-x:auto`，缺渲染后滚动。`renderLatex()`（1597）成功渲染后按 `.cursor-blink`/`.base-missing` 的 `offsetLeft` 设 `scrollLeft`，光标右侧留 24px；无光标时 `scrollLeft=scrollWidth`。渲染失败分支（"表达式过于复杂"）不滚动。暴露 `window.__ec_autoscroll_enabled` 供 R3 手势期间置 false。

### R3 触摸定位光标
内核：`texBlock` 增加 `opts.anchors`，每个合法光标位输出 `\htmlId{ec-<path>}{\htmlClass{ec-anchor}{\phantom{|}}}`，`<path>` 与 `cursorPath()` 同格式；新增 `setCursorPath(key,path)->boolean`、`cursorPositions(key)`。
宿主：`pointerdown/move/up/cancel`（与 `bindConstCell` 同风格）；`dt<=250ms && 位移<=10px` 判点击 → 取最近 `.ec-anchor` 的 rect 水平中心 → `setCursorPath` → 重渲染（本次不自动右滚）；否则判滑动，保留原生滚动位置。

### R4 新键盘（6 列，定稿）
第一行 `#var-btns-row`（642-650）不动。键盘区：
- 行2：`f(x) g(x) ∫ d/dx ← →`（吸收原 `.main-cursor-row`，删除该容器）
- 行3：`x  分数线  √  x^y  x^2  log_x(y)`
- 行4：`sin cos tan π e [ ( | ) ]` —— 前 5 个各占 1 cell，第 6 cell 内部再切两半放 `(` 和 `)`，各约半宽
- 行5-8 数字区保持 5 列不变
容器因此不能再是单一 `repeat(5,1fr)`：改为 flex 纵向 + 每行独立 grid（6 列行用 `repeat(6,1fr)`，数字行用 `repeat(5,1fr)`，半宽 cell 用嵌套 `grid-template-columns:1fr 1fr; gap:3px`）。
**长按行为（新增，复用 `CONST_LONG_MS`/`CONST_MOVE_PX` 风格但阈值独立命名）**：
| 按钮 | 短按写入 | 长按（显示预览）松手写入 |
|---|---|---|
| sin | `sin(` | `asin(` |
| cos | `cos(` | `acos(` |
| tan | `tan(` | `atan(` |
| log_x(y) | `log_(`（logb 节点） | `log(`（自然对数 ln）与 `t`（变量）二选一，见下 |
`log_x(y)` 长按需要出两个候选（`ln`、`t`），所以它不是"长按即换 token"，而是**长按弹出 2 项小菜单，松手时落在哪个候选上就写入哪个**（手指不在任何候选上则取消）。sin/cos/tan 是单候选，长按松手直接写反函数。
`lg` 删除（`log10` 按钮移除，内核 `FN_INPUT['log10(']` 保留以兼容旧序列化）。
**新增变量 `t`**：现 `VARS={a,b,c,x,y,z}`（915 行）、`VAR_KEYS`（1458）、`varVals`（1461）、变量面板 HTML（469-474）、editors `var_*`（961）均需加 `t`。这是跨 5 处的状态扩张，单列为 K2 的一部分。
**新增 `logb` 节点**：`NODE_SLOTS.logb=2`，输入 `'log_('`，slot0=真数、slot1=底数，TeX `\log_{s1}\left(s0\right)`，序列化 `log((s0),(s1))`（已验证 mathjs `log(8,2)=3`）。
作用范围：仅 main/funcs/vars 三个选项卡（`switchMode` 2199-2200 已按模式显隐），plot/roots/fit/matrix 面板不动。

### R5 积分方程（定稿形态）
形态：`∫_{a(x)}^{b(x)} F(t, x) dt = c`，即**上下限含 x、被积函数含 x，关于参数 x 求解**的单变量方程。
实现：令 `G(x) = ∫_{a(x)}^{b(x)} F(t,x) dt - c`，对 `G` 在用户给定区间内扫描变号 + Brent 求根（复用 2236 `brent`、2256 `safeFnWrap`），内层积分用与 `customInt`（1487-1496）同口径的复合 Simpson（n 可配，默认 128，奇偶自动修正）。
不做：Fredholm/Volterra（求未知函数）——本轮明确不在范围内。
积分变量命名：被积函数里的哑元用 `t`（与 R4 新增变量 `t` 一致，用户可直接从键盘输入），`x` 是待求参数。因此 R4 的 `t` 变量与 R5 互为前置。

## 5. 子任务 DAG（rev2：9 个任务）

```
K1(右括号 + 触点锚点) ──┐
K2(logb 节点 + 变量 t) ──┼─> I1(内核内联同步) -> I2(6列键盘+长按) -> I3(自动右滚) -> I4(触摸定位) -> I4b(积分方程UI) -> I5(回归+同步+交付)
S1(积分方程求解内核) ────┘                                                               ↑
                                                                                      S1 在此汇入
```

- 可并行：K1、K2、S1（三者写不同文件；K1 与 K2 都写 `tools\editor-core.js` → **必须串行，K1 先**）。修正：**K1 → K2 串行**，S1 与 K1/K2 并行。
- I 系列全部写 `www\index.html`，严格串行，前一步未写 `docs\CHECKPOINT-*.md` 不得启动下一步。

| 步骤 | 内容 | 需求 | 写入路径 | 依赖 | R | G | V | Q | N | rho |
|---|---|---|---|---|---|---|---|---|---|---|
| K1 | 游离 `)` + anchors/setCursorPath | R1,R3 | `tools\editor-core.js`、`.test.js` | — | 5000 | 4000 | 2000 | 8000 | 47750 | 0.424 绿 |
| K2 | `logb` 节点 + 变量 `t` | R4,R5 | `tools\editor-core.js`、`.test.js` | K1 | 5500 | 5000 | 2000 | 8000 | 49625 | 0.441 绿 |
| S1 | 含参变限积分方程求解内核 | R5 | `tools\inteq-solver.js`、`.test.js` | — | 3000 | 5000 | 2500 | 10000 | 49625 | 0.441 绿 |
| I1 | K1+K2 内核内联同步 + 变量 t 接线 | R1,R3,R4 | `www\index.html` | K1,K2 | 6000 | 4000 | 2000 | 8000 | 49000 | 0.436 绿 |
| I2 | 6 列键盘 + 半宽括号 + 长按菜单 | R4 | `www\index.html` | I1 | 4500 | 5000 | 2000 | 4000 | 43375 | 0.386 绿 |
| I3 | 公式区自动右滚 | R2 | `www\index.html` | I2 | 4000 | 3000 | 2000 | 8000 | 45250 | 0.402 绿 |
| I4 | 触摸点击定位光标 | R3 | `www\index.html` | I3,K1 | 5000 | 4000 | 2000 | 8000 | 47750 | 0.424 绿 |
| I4b | 积分方程 UI 接线 | R5 | `www\index.html` | I4,S1 | 5000 | 4500 | 2000 | 8000 | 48375 | 0.430 绿 |
| I5 | 回归扩充 + android 同步 + 验收报告 | 全部 | `tools\suite.js`、`docs\v2验收报告.md`、android 副本 | I4b | 4000 | 6500 | 2500 | 8000 | 50250 | 0.447 绿 |

全部 `H=150000, B=112500, F=24000, u=1.25`。合计 `N` 不是单会话累加值——每个任务独立起算，只有串行同会话执行时才需用 `Ncont=U+1.25(Rnew+G+V+Q)` 重算。

## 6. 公共硬约束（每张卡都适用）

1. 单次工具输出 `<= min(1500, 0.10R)` 估算 token 且 `<=80` 行；遇长行按字符截断。
2. 单任务累计读取 `<=R`；超出先重算预算，不硬读。
3. 同一未变片段最多返回 2 次；第 3 次前先查检查点/局部 diff/哈希。
4. 探索最多 2 个候选各 `<=300` token；2 次定位无进展即收窄或报告缺失条件。
5. 成功只报用例数+结果+报告路径；失败每轮最多 3 个代表例。最多 2 轮无进展即停止并落盘诊断。
6. 检查点 `<=1000` token，写在核心实现完成或可变预算用到 50% 时。
7. 结论 `<=800` token；大表存文件给绝对路径。
8. 禁止：触碰 `.github\workflows\1.tex`；手改 android 副本（I5 统一同步）；把 `www\index.html` 拆外链；自动 git commit 或构建 APK（需用户另行授权）。

## 7. 任务卡

### K1 内核：游离右括号 + 触点锚点
- 目标：`tools\editor-core.js` 交付 `xclose` 语义 + anchors 渲染 + `setCursorPath`/`cursorPositions`。
- 依赖：无。预算：R=5000, G=4000, V=2000, Q=8000 → N=47750, rho=0.424 绿, Rmax=56800。
- 读取清单（按符号名定位，均在 `tools\editor-core.js`）：常量段 `EMPTY_MARK..OP_TEX` ~600×1；`makeNode/findParent/takeBase` ~700×1；`serBlock/serNode/joinParts` ~1000×1；`joinTex/texSlot/texNode/texBlock/renderTex` ~1200×1；`doAppend/closeParen/doDelete/doMove/cursorPath` ~1500×1（允许复核 1 次，计 +500）；导出段 ~300×1。合计 <=5000。
- 允许写：`tools\editor-core.js`、`tools\editor-core.test.js`。禁止：`www\index.html`、`logb`/变量 `t`（归 K2）。
- 接口契约（I1/I4 依赖）：
  - `)` 无可配对 open → 插入 `{t:'xclose'}`；TeX 裸 `)`；序列化输出使 `math.parse` 抛语法错误。
  - `renderTex(key,{cursor:true,anchors:true})` 在每个合法光标位输出 `\htmlId{ec-<path>}{\htmlClass{ec-anchor}{\phantom{|}}}`；`anchors` 缺省/false 时输出与改动前逐字符相等。
  - `setCursorPath(key,path)->boolean`，非法 path 返回 false 且不改状态；`cursorPositions(key)->string[]`。
- 要做：以上 3 项 + 单测。不做：改 index.html、键盘、UI、重构既有序列化结构。
- 验证：`node tools\editor-core.js --selftest` → `SELFTEST OK`；`node tools\editor-core.test.js` 原 2223 断言全过 + 新增：`sqrt( 8 )` → TeX 含 `\sqrt{8)}` 且序列化不可 parse；连打两个 `)`；`( 1 + 2 )` 正常闭合；`xclose` 的 DEL 可整项删除；`anchors:false` 与改动前基线字符串相等（先把基线存 `tools\__anchors-baseline.json`）；`setCursorPath(cursorPath(e))` 往返幂等 ≥20 组。
- 检查点：`docs\CHECKPOINT-K1.md`。
- 交付：改动函数名清单、新增导出、单测数字、基线比对布尔结论；未验证项（浏览器 KaTeX 对 `\htmlId` 的真实渲染由 I4 验证）。

### K2 内核：logb 节点 + 变量 t
- 目标：新增 `logb` 双槽节点；把变量集合从 6 个扩到 7 个（加 `t`）。
- 依赖：K1 已验收（同文件，串行）。预算：R=5500, G=5000, V=2000, Q=8000 → N=49625, rho=0.441 绿, Rmax=55800。
- 读取清单：K1 的 diff ~1500×1；`VARS` 常量段 ~300×1；`NODE_SLOTS/PW_TYPES/FN_INPUT/FN_TEX/NODE_INPUT` ~400×1；`serNode/texNode` ~600×1；`doAppend` ~700×1；editors 初始化段（`['a','b','c','x','y','z']`）~200×1；单测文件结构头 ~800×1。合计 <=4500。
- 允许写：`tools\editor-core.js`、`tools\editor-core.test.js`。禁止：index.html（归 I1）、键盘 HTML、求解器。
- 接口契约：`NODE_SLOTS.logb=2`；输入 token `'log_('`；slot0=真数、slot1=底数；TeX `\log_{<s1>}\left(<s0>\right)`；序列化 `log((<s0>),(<s1>))`。`VARS` 增 `t:1`，内核 editors 增 `var_t`。`FN_INPUT['log10(']` 保留（兼容旧序列化），但不再有按钮。
- 要做：节点 + 变量扩展 + 单测。不做：UI、面板 HTML（归 I1/I2）、不改 `log10` 既有行为。
- 验证：`--selftest` + 单测全过；新增断言：`log_( 8 , 2` → 序列化 `log((8),(2))`，页面侧由 I1 验证 `=3`；`log_(` 空槽 → 含 `\u0000` 不可 parse；`logb` 作为幂底数时括号正确（`PW_TYPES`）；`t` 可插入、可序列化、`var_t` 编辑器独立；原 6 变量行为不变。
- 检查点：`docs\CHECKPOINT-K2.md`。
- 交付：节点定义、变量清单变更点（内核侧 3 处）、单测数字、给 I1 的"index.html 侧需同步的 5 处"清单（915/1458/1461/469-474/961 对应位置）。

### S1 含参变限积分方程求解内核
- 目标：`tools\inteq-solver.js` 纯模块 + 自测，解 `∫_{a(x)}^{b(x)} F(t,x) dt = c` 的 x。
- 依赖：无（与 K1/K2 并行）。预算：R=3000, G=5000, V=2500, Q=10000 → N=49625, rho=0.441 绿, Rmax=53300。
- 读取清单：`www\index.html` 1487-1496（`customInt`）~400×1；2236-2265（`brent`/`safeFnWrap`）~700×1；`tools\editor-core.js` 头部 UMD 包装 12 行 ~150×1。合计 <=1500（只读，不写 index.html）。
- 允许写：`tools\inteq-solver.js`、`tools\inteq-solver.test.js`。禁止：`www\index.html`、新增 npm 依赖。
- 接口契约（I4b 依赖）：UMD，浏览器挂 `globalThis.InteqSolver`。
  `solveParamLimitIntegral({F, lower, upper, c, xMin, xMax, steps, n, tol}) -> {ok, roots:number[], residuals:number[], evals, error}`
  其中 `F(t,x)`、`lower(x)`、`upper(x)` 均为 JS 函数；`n` 为 Simpson 区间数（默认 128，自动取偶）；`steps` 为 x 方向扫描步数（默认 2000）；失败返回 `ok:false`+中文 `error`，**不抛异常**。
  另导出 `integrate(F, lo, hi, x, n)` 便于 I4b 复用同一数值口径。
- 要做：Simpson 内层 + x 扫描变号 + Brent + 根聚类去重（阈值 1e-4，与 `calculateRoots` 一致）。不做：UI、符号推导、Fredholm/Volterra、字符串表达式解析（留给 I4b 用 `math.compile`）。
- 验证（每例给数值误差与容差依据，不统一写 1e-8）：
  1. `∫_0^x 1 dt = 2` → x=2（解析）；
  2. `∫_0^x t dt = 2` → x=2（解析）；
  3. `∫_{x}^{2x} t dt = 6` → 1.5x²=6 → x=2（上下限同时含 x）；
  4. `∫_0^1 (t+x) dt = 1` → x=0.5（被积函数含 x、限不含）；
  5. `∫_0^x (t+x) dt = 4` → 1.5x²=4 → x=√(8/3)（限与被积函数同时含 x）；
  6. 无解例 `∫_0^x t² dt = -1` → `ok:true, roots:[]`，不报错；
  7. 多根例（构造偶函数形式）→ 至少 2 根且去重正确；
  8. 收敛检验：n=32/64/128 对例 5 的误差单调下降。
- 检查点：`docs\CHECKPOINT-S1.md`，在例 1-3 通过时写。
- 交付：接口签名、基准误差表路径（`docs\inteq-基准.md`）、未支持形态清单；<=800 token。

### I1 内核内联同步 + 变量 t 接线
- 目标：把 K1+K2 的内核改动等价内联进 `www\index.html` 719-1423，并补齐宿主侧变量 `t`。
- 依赖：K1、K2 均验收。预算：R=6000, G=4000, V=2000, Q=8000 → N=49000, rho=0.436 绿, Rmax=56800。
- 读取清单：K1+K2 的 diff（只读改动行）~3000×1；index.html 719-730 与 1400-1430 边界 ~500×1；1458-1465（`VAR_KEYS/VAR_LABELS/varExprs/varVals`）~300×1；469-474（变量面板行）~300×1；1558-1596（`updateVarsPanel/selectVar/getCombinedScope`）~900×1；1640-1671（`calculate`）~700×1。合计 <=5700。
- 允许写：`www\index.html`。只读：`tools\editor-core.js`。禁止：改 `tools\` 任何文件、改键盘 HTML/CSS（归 I2）。
- 要做：(a) 内联同步；(b) 宿主侧加 `t`：`VAR_KEYS`、`VAR_LABELS`、`varExprs`、`varVals`、变量面板第 7 行 HTML、`getCombinedScope` 注入 `t`；(c) 确认 `calculate()` 对游离 `)` 按既有"语法错误 > 数学错误 > 变量未定义"优先级报语法错误。不做：键盘、滚动、触摸、积分方程 UI。
- 变量面板布局注意：`#vars-panel` 现为 `repeat(3,1fr)`（81 行），7 行变量需确认排布不溢出，必要时只调该面板 CSS（属本卡范围），不动键盘。
- 验证：`node tools\suite.js` 153 例全过；手工断言 ≥6 条：`sqrt( 8 ) =` 报语法错误且显示 `\sqrt{8)}`；`( 1 + 2 ) =` 得 3；`log_( 8 , 2 =` 得 3；`t` 可在 vars 面板赋值且在 main 中参与计算；原 6 变量回归；`anchors` 默认关闭时显示与改动前一致（截取同一表达式的 TeX 字符串比对）。再做内联段与 `tools\editor-core.js` 的函数级一致性比对（唯一允许差异：UMD 包装、Node 自检段），结论只给布尔值与差异函数名。
- 检查点：`docs\CHECKPOINT-I1.md`。
- 交付：行号区间变化、suite 数字、一致性结论、变量 t 的 6 个接线点。

### I2 6 列键盘 + 半宽括号 + 长按菜单
- 目标：按 R4 定稿改键盘，只影响 main/funcs/vars。
- 依赖：I1。预算：R=4500, G=5000, V=2000, Q=4000 → N=43375, rho=0.386 绿, Rmax=59800。
- 读取清单：151-152（`.keyboard`/`.main-cursor-row`）~150×1；135-149（`.const-cell` 长按样式，作为长按预览样式参考）~400×1；642-705（键盘 HTML）~1800×1；2403+2428-2455（`CONST_LONG_MS`/`bindConstCell` 手势实现，照其风格复用）~1000×1；2193-2200（`switchMode` 显隐）~500×1。合计 <=3900。
- 允许写：`www\index.html`（CSS 151-152 邻域新增键盘行样式 + HTML 642-705 + `switchMode` 必要显隐语句 + 新增长按绑定函数）。禁止：动内核段 719-1423、动 `#var-btns-row`、动 plot/roots/fit/matrix 面板。
- 布局契约：行2-4 各 6 cell；行4 第 6 cell 内嵌 `grid-template-columns:1fr 1fr; gap:3px` 放 `(`/`)`；数字区 4 行保持 5 cell；删除 `.main-cursor-row` 容器，`←/→` 移入行 2；`x^2` 用已有 `append('^{2}')`；`log_x(y)` 用 `append('log_(')`；删除 `lg` 按钮。
- 长按契约（新常量 `KEY_LONG_MS=450, KEY_MOVE_PX=8`，与 `CONST_*` 独立命名）：
  - sin/cos/tan：长按显示反函数预览（按钮内换字 `sin⁻¹` 等），松手写 `asin(`/`acos(`/`atan(`；长按中位移 >8px 或 `pointercancel` → 取消，不写入。
  - log_x(y)：长按弹出 2 项浮层（`ln`、`t`），松手落在某项上写 `log(` 或 `t`；落在浮层外 → 取消。浮层需 `position:absolute` 且不撑开键盘布局。
  - 短按（未达 450ms 且位移 <=8px）：写默认 token。
  - 键盘激活（`click` 且 `e.detail===0`）：写默认 token（照 2454 行既有做法）。
- 要做：CSS 改造 + HTML 重排 + 长按绑定 + 被删按钮说明。不做：改 `append` 实现、改内核、加其他功能键。
- 验证（headless，必须记录可见性与可点击性，不得点隐藏元素冒充通过）：
  - main/funcs/vars 下行 2-4 各 6 个可见按钮，同行 `getBoundingClientRect().top` 相等，1 cell 按钮宽度差 <=1px；
  - 行 4 的 `(`/`)` 各自宽度约为同行单 cell 的一半（断言 `0.40 <= w_paren/w_cell <= 0.60`，容差依据 gap=3px）；
  - 数字行仍 5 列；键盘在 plot/roots/fit/matrix 下 `display:none`；
  - 用真实 `PointerEvent` 派发：sin 短按→`sin(`，长按 500ms 松手→`asin(`，长按中移 12px→无写入；边界 449ms/451ms 各一例；
  - log_x(y) 短按→`logb` 节点，长按落 `ln`→`log(`，长按落 `t`→`t`，长按落浮层外→无写入；
  - `log_2(8) =` 得 3；`asin(0.5) =` 得 ~0.5236。
- 检查点：`docs\CHECKPOINT-I2.md`。
- 交付：新布局表、宽度实测数值、长按阈值常量名、被删按钮清单（`lg`）及替代路径、未验证项（真机触摸）。

### I3 公式区自动右滚
- 目标：输入时公式显示区始终露出光标；无光标时露出末尾。
- 依赖：I2。预算：R=4000, G=3000, V=2000, Q=8000 → N=45250, rho=0.402 绿, Rmax=57800。
- 读取清单：58-70（`.screen`/`.latex-line`）~300×1；476-484（`#main-screen`/`#single-line-display`/`#double-line-display`）~400×1；1591-1625（`getDisplayTex`/`renderLatex`/`updatePlotScreen`/`append`）~900×1；I2 新增的长按绑定函数签名 ~300×1。合计 <=1900。
- 允许写：`www\index.html`（CSS 58-70 邻域 + `renderLatex`/`updatePlotScreen` 内部 + 新增函数）。禁止：改内核段、改键盘布局。
- 实现契约：新增 `scrollCursorIntoView(container)`，在 `katex.render` 成功后同步调用；查 `.cursor-blink` 或 `.base-missing`，按 `offsetLeft` 相对容器滚动，光标右侧留 24px；找不到光标则 `scrollLeft=scrollWidth`；渲染失败分支不滚动。必须暴露 `window.__ec_autoscroll_enabled`（默认 true）供 I4 在手势期间置 false。
- 要做：函数 + 两处调用 + 开关。不做：触摸手势（I4）、不改 KaTeX 配置、不给 plot 双行区加新行为（但须验证 `line-fx`/`line-gx` 未被破坏）。
- 验证：headless 连输 40 项长表达式，每 10 项断言 `scrollLeft+clientWidth >= cursorOffsetLeft` 且 `scrollLeft <= scrollWidth-clientWidth`；短表达式（不溢出）断言 `scrollLeft===0`；连按 `←` 回到开头后断言光标可见（`scrollLeft` 回到 0 附近）；plot 模式双行区仍渲染正常；`__ec_autoscroll_enabled=false` 时不滚动。
- 检查点：`docs\CHECKPOINT-I3.md`。
- 交付：函数名、调用点行号、测量数值、开关变量名。

### I4 触摸点击定位光标
- 目标：点公式某处光标跳到该处；滑动仍是滚动，两者不冲突。
- 依赖：I3（需其 `__ec_autoscroll_enabled`）+ K1（`anchors`/`setCursorPath`）。预算：R=5000, G=4000, V=2000, Q=8000 → N=47750, rho=0.424 绿, Rmax=56800。
- 读取清单：K1 的 `anchors`/`setCursorPath`/`cursorPath` 接口段 ~800×1；index.html `renderLatex` + I3 新增函数 ~900×1；2428-2455（`bindConstCell` 手势范式）~900×1；I2 的 `KEY_LONG_MS` 常量行 ~100×1。合计 <=2700。
- 允许写：`www\index.html`（`renderLatex` 内开启 anchors、新增手势绑定、`.ec-anchor` 的少量 CSS）。禁止：改内核算法——若发现必须改内核，停止并交接给 K1 另开一轮，不在 I4 内改。
- 交互表（逐条实现并验证）：
  | 手势 | 判定 | 行为 |
  |---|---|---|
  | pointerdown | 记 `t0`/`x0`/`y0`，`__ec_autoscroll_enabled=false` | 不改光标 |
  | pointermove 位移 >10px | 标记滑动 | 原生滚动，取消本次定位 |
  | pointerup，`dt<=250ms` 且位移 `<=10px` | 点击 | 最近锚点 → `setCursorPath` → 重渲染（本次不自动右滚） |
  | pointerup，`dt>250ms` 或超位移 | 滑动/长按 | 不改光标，保留滚动位置 |
  | pointercancel / pointerleave | 取消 | 恢复 `__ec_autoscroll_enabled=true` |
  | 下一次 append/DEL/AC/模式切换 | — | 恢复自动右滚 |
- 命中规则：取全部 `.ec-anchor` 的 `getBoundingClientRect()` 水平中心，选与点击 x 最近者；点击落在公式右侧空白取末位锚点；空表达式不动。
- 常量：`TAP_MAX_MS=250`、`TAP_MAX_PX=10`（与 `KEY_LONG_MS`/`CONST_LONG_MS` 独立命名）。
- 要做：手势状态机 + 命中 + 与 I3 互斥。不做：拖动选区、双击选词、plot/matrix 区触摸（matrix 有独立显示逻辑，明确排除）。
- 验证：headless 用真实 `PointerEvent`/`TouchEvent` 派发（不得直接调函数冒充），覆盖交互表 6 行，每行断言光标 path 与 `scrollLeft` 变化；阈值边界各两例（249ms/251ms、9px/11px）。真机 Android WebView 触摸必须列为未验证项。
- 检查点：`docs\CHECKPOINT-I4.md`。
- 交付：交互表实测结果、阈值常量名与取值、未验证项。

### I4b 积分方程求解 UI
- 目标：求根选项卡增加积分方程入口，接 S1 内核。
- 依赖：I4 + S1 均验收。预算：R=5000, G=4500, V=2000, Q=8000 → N=48375, rho=0.430 绿, Rmax=56300。
- 读取清单：485-496（求根面板 HTML）~400×1；2266-2299（`calculateRoots`）~900×1；1580-1596（`getCombinedScope`/`getDisplayTex`）~300×1；1472-1496（`evalWithLocalX`/`customInt`）~600×1；`tools\inteq-solver.js` 导出段与接口注释 ~600×1；2235（`setRootTarget`）~150×1。合计 <=2950。
- 允许写：`www\index.html`（求根面板 HTML + 新增求解函数 + 内联 S1 内核）。禁止：改 S1 算法（需要改则交接给 S1 另开一轮）、改编辑器内核、改键盘。
- 接线契约：求根面板加子导航「代数求根 / 积分方程」。积分方程模式下：被积函数与上下限用公式输入（f(x)/g(x) 承担被积函数与上限表达式，面板内另给下限/常数 c 的数值或表达式输入框）+ x 扫描区间（复用 `rootX1`/`rootX2`）+ n/steps 可选。字符串→函数用 `math.compile` + 形如 `evalWithLocalX` 的双变量注入（`t` 为哑元、`x` 为参数，两者都要注入 scope）。结果用 KaTeX 渲染到 `root-list` 同类容器。
- 要做：UI + 接线 + 中文错误文案 + 内联 S1。不做：新求解算法、不改既有代数求根路径的行为。
- 验证：S1 的 8 个基准里至少 5 个在页面上重跑得到同量级误差；错误输入（下限>=上限、c 非数、被积函数未定义、含 y/z 未定义变量）各给明确中文提示而非崩溃；`calculateRoots` 原路径回归通过；`node tools\suite.js` 153 例不退化。
- 检查点：`docs\CHECKPOINT-I4b.md`。
- 交付：UI 结构、接线函数名、页面侧基准误差、未支持形态说明。

### I5 回归、同步与交付
- 目标：回归套件覆盖全部新需求，同步 android 副本，出中文验收报告。
- 依赖：I4b。预算：R=4000, G=6500, V=2500, Q=8000 → N=50250, rho=0.447 绿, Rmax=53800。
- 读取清单：`tools\suite.js` 头部 1-45 行 + 表结构样例 ~1200×1；各 `docs\CHECKPOINT-*.md` 摘要 ~1800×1（8 个文件，每个只读结论段）；`docs\输入测试报告.md` 只读章节标题 ~200×1。合计 <=3200。
- 允许写：`tools\suite-v2.js`（新增，避免破坏原 153 例）、`docs\v2验收报告.md`、`docs\PROGRESS.md`、android 副本（`Copy-Item` 覆盖）。禁止：为让测试通过而改 `www\index.html` 的功能逻辑（只允许修 bug，且每个修复必须关联一个最小失败例并记入报告）。
- 用例下限：游离 `)` >=8 例（**合法表达式的期望数值**与**故意非法输入的期望错误**分开统计，不得把预期错误计为"全部合法输入通过"）；新键盘每个新按钮/长按分支 >=1 例（sin/cos/tan 短按+长按=6，log_x(y) 短按+ln+t=3，`(`/`)` 半宽各 1，π/e 各 1）；自动右滚 >=4 例；触摸定位 >=6 例；积分方程 >=5 例。
- 数值期望尽量独立计算（不复用被测代码的中间结果）；与被测代码共用数据的用例只能标记为"通路验证"。
- 验证：`node tools\suite.js` 原 153 例全过 + `node tools\suite-v2.js` 新例全过；android 副本同步后用**字节数组 `Compare-Object`** 与**逐行比较**分别报告（两者不可互相替代，分别给结论）；报告必须分列「已验证」与「未验证」（真机 Android 触摸、APK 构建默认属未验证）。
- 检查点：`docs\CHECKPOINT-I5.md`。
- 交付：用例总数与通过数、报告绝对路径、字节一致性两项结论、未验证清单；<=800 token。
- 权限：允许 `Copy-Item` 同步 android 副本；**不**自动 git commit、**不**自动构建 APK（需用户另行授权）。

## 8. 范围变更与未确认项

1. **已定稿（rev2 用户确认）**：长按 sin/cos/tan 出反函数并在松手时写入；键盘行 4 = `sin cos tan π e [(|)]`，`(`/`)` 共占 1 cell 各半宽；长按 `log_x(y)` 出 `ln` 与 `t` 两个候选；删除 `lg`；积分方程为"上下限与被积函数均含 x、关于参数 x 求解"。
2. **因 rev2 新增的连带改动**：变量集合从 `{a,b,c,x,y,z}` 扩到 `{a,b,c,x,y,z,t}`（内核 3 处 + 宿主 6 处，共 9 个接线点），归 K2 与 I1；`#vars-panel` 从 6 行变 7 行，布局需复核（归 I1）。
3. **容量假设未实测**：`W=200000`、`F=24000` 均为情景假设。已验证若实际为 32000 档则全部任务 `rho>1.7`、`Rmax=0`，必须重新分解，不得继续拆分硬上。
4. **默认不做**：Android 真机触摸验收、APK 构建、git commit。需要时另行授权。

## 9. 纪律

- 绝不动 `.github\workflows\1.tex`（用户自有文件）。
- `www\index.html` 保持单文件内联。
- 含中文文件用 PowerShell here-string + `Set-Content -Encoding UTF8` 写。
- `tools\editor-core.js` 与 index.html 内联段必须成对修改（K1/K2 写 tools，I1 写 index.html），任何一方单独改动视为缺陷。
- I 系列同写 `www\index.html`，严格串行；前一步未写检查点不得启动下一步。

## 10. rev2 执行中新增的约束（来自已完成任务的实测）

### S1 实测结论（2026-11-17，28/28 通过）
- 接口定稿：`solveParamLimitIntegral({F,lower,upper,c,xMin,xMax,steps=2000,n=128,tol=1e-12}) -> {ok,roots,residuals,evals,error}`；`integrate(F,lo,hi,x,n=128)`。成功时 `error=null`，失败返回 `ok:false`+中文 error 且不抛异常。
- 超出原任务卡但保留的两处行为：Brent 收敛后残差 `|G| > 1e-6*(1+|c|)` 的根被丢弃（过滤间断点假变号）；F 在整个区间都无法求值才返回 `ok:false`，部分点失败则跳过。
- **I4b 必须处理的性能约束**：默认 `steps=2000, n=128` 一次求解约 26 万次 F 求值。接 `math.compile` 后极可能阻塞 UI。I4b 的默认值改为 `steps=400, n=64`（约 2.6 万次），面板内允许用户上调；求解前后要给"计算中"反馈，必要时用 `setTimeout` 让出一帧。此项列入 I4b 验收：必须实测并报告单次求解墙钟耗时。
- 已知方法局限（写入 I5 报告的未验证/不支持栏）：偶数重根（只触 0 不变号）扫描不到；反常积分、多未知参数、复数根、自适应积分均不支持。
