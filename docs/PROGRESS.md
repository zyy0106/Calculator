# WebCASIO 改造进度看板

> 跨子对话唯一进度来源。每个子对话开始时先读本文件 + `docs/PLAN.md`，结束时必须回来把对应行改成 DONE。
> 权威设计文件：`C:\Users\28233\Documents\ChatGPT\WebCASIO\docs\PLAN.md`

## 步骤表

| 步骤 | 内容 | 产出物（绝对路径） | 改 index.html | 依赖 | 状态 |
|---|---|---|---|---|---|
| S0 | 源码勘察 + 计划落盘 | `C:\Users\28233\Documents\ChatGPT\WebCASIO\docs\PLAN.md` | 否 | — | DONE |
| S1 | 物理/数学常数数据层 | `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\constants-data.js`、`C:\Users\28233\Documents\ChatGPT\WebCASIO\docs\常数表.md` | 否 | — | DONE |
| S2 | 编辑器内核（纯模块 + 单测） | `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\editor-core.js`、`C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\editor-core.test.js` | 否 | — | DONE |
| S3 | 内核接入计算器 | 改 `C:\Users\28233\Documents\ChatGPT\WebCASIO\www\index.html` | 是 | S1+S2 | DONE |
| S4 | 物理常数面板 UI | 改 `C:\Users\28233\Documents\ChatGPT\WebCASIO\www\index.html` | 是 | S3 | DONE |
| S5 | 回归测试套件 + 交付 | `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\suite.js`、`C:\Users\28233\Documents\ChatGPT\WebCASIO\docs\输入测试报告.md`、同步 android 副本 | 是（仅修 bug） | S4 | DONE |

S3 / S4 / S5 改同一个文件，必须串行。S1 与 S2 互不相干，可并行。

## 已完成明细

### S0（已完成）
- `docs\PLAN.md` 20490 B：含 `www\index.html` 全量行号地图、9 个已确认 bug、数据结构与序列化约定、常数面板 UI 设计、测试脚手架用法、S3 编辑顺序、工具链坑。

### S1（已完成）
- `tools\constants-data.js`：47 个 CASIO fx-991CN CW 内置物理常数 + 6 个数学常数，纯 SI 数值、不带单位；导出 `CONSTANTS`、`CONST_BY_ID`、`CONST_GROUPS`、`constCode(id)`、`constSciParts(id, sig)`。
- `docs\常数表.md`：人类可读对照表，标注每个值是精确值 / 导出值 / 实测值。
- 验证方式：`node C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\constants-data.js --selftest`（检查 id 唯一、数值可解析、精度分级、constCode 负数加括号）。

### S2（已完成）
- 产出物：
  - `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\editor-core.js`（22847 B，纯 ASCII，UMD：Node 下 `require`，浏览器下先加载 `constants-data.js` 再加载本文件，得到 `globalThis.EditorCore`）
  - `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\editor-core.test.js`（13365 B，2223 项断言）
- 验证命令（均已通过）：
  - `node C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\editor-core.test.js` → `TESTS OK 2223 passed, 0 failed`
  - `node C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\editor-core.js --selftest` → `SELFTEST OK`
  - `node C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\constants-data.js --selftest` → `SELFTEST OK`
- 公共 API：`append(v)`、`deleteLast()`、`moveCursor(dir)`（`'left'`/`'right'`/`-1`/`1`）、`clearAll()`、`renderTex(key, {cursor})`、`serialize(key)`、`isEmpty(key)`、`cursorToEnd(key)`、`keyToInput(key)`、`configure({getKey, onChange})`、`setKey(k)`、`editors`、`activeEditorKey()`、`ed(key)`、`__dbg(key)`（返回 `{key, ser, tex, cur, empty}`）。
- 编辑器 key 的决定顺序：`setKey` 钉住的值 → `configure` 的 `getKey` → 默认读 `state.mode` / `state.funcTarget` / `activeVar`。默认 onChange 把序列化结果写回 `state.expr.main|fx|gx` 或 `varExprs[v]`；`configure` 传了 onChange 则不再默认写回。每次 append / deleteLast / moveCursor / clearAll 都触发一次 onChange。
- `append` 接受的输入：`0-9 .`、`+ - * /`、变量 `a b c x y z`、`e`（自然常数）、`pi`、`const:<id>`（id 见 `constants-data.js`，如 `const:c0` 光速、`const:qe` 元电荷）、`Ans`（大写 A）、`(`、`)`、`,`、`sin( cos( tan( log10( log( f( g(`、`sqrt( frac( int( deriv(`、`^{}`、`^{2}`、`*10^{}`。不认识的输入返回 false，不改树。
- 与 PLAN 第 5 节不同或 PLAN 没写到的决策：
  1. `joinParts` 只把相邻数字合并成一个数，其余隐式乘法相邻项包进 `(...)` 并用 `*` 连接（例如 `2(` → `(2*(\u0000))`）。
  2. `,` 跳到当前节点下一槽的末尾；已是最后一槽时跳到节点之后；在根层不接受。
  3. TeX 中插 `\cdot` 的情形：operand 后接数字、数字后接 frac。光标不打断这一判断。
  4. 在非首槽起点按 DEL：如果整个节点全空就删掉节点，否则回到上一槽末尾。
  5. 新增两个 CSS 类交给 S3 定义样式：`ghost-paren`（未闭合括号末尾的灰色 `)`）、`base-missing`（pow 缺底数时的占位方块）。另有 `cursor-blink`、`const-sym`。
  6. `log(` 是自然对数（TeX `\ln`），`log10(` 是常用对数（TeX `\lg`）。log 只接受一个参数，`log(2,8)` 的逗号被拒绝，得到 `log(28)`。
  7. sci 缺底数时序列化为 `((1)*10^(3))`，TeX 为 `\times10^{3}`。
  8. 空根：有光标时 `renderTex` 返回光标，`{cursor:false}` 时返回 `''`；`serialize` 返回 `''`。
  9. `tools\editor-core.partA.js` 已被 `editor-core.js` 取代，不再使用（未删除，等用户确认）。
- 未验证：浏览器中 KaTeX 的实际渲染（`\htmlClass` 需要 KaTeX `trust: true`），以及接入 `index.html`，这两项属于 S3。
### S3（已完成）
- 产出物：`C:\Users\28233\Documents\ChatGPT\WebCASIO\www\index.html`（2364 行，CRLF，无 BOM）。改前备份：`%TEMP%\index.html.bak-s3`（2318 行）。补丁脚本 `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\s3-patch.js` 已执行过，锚点已不匹配，**不要再运行**。
- 内容：内联 `constants-data.js` + `editor-core.js`，`append`/`deleteLast`/`moveCursor`/`clearAll`/`calculate`/`selectVar`/`setFuncTarget`/`switchMode`/`updatePlotScreen`/`renderLatex` 委托给 EditorCore；删除旧的 `expressionToTexForDisplay`、`findFracDelimiterAtCursor`、`persistEditedExpression`（grep 已确认无残留）。KaTeX 开 `trust:true`；定义 `cursor-blink`、`ghost-paren`、`base-missing`、`const-sym` 样式。矩阵代码未动。
- 验证方式（无头 Edge + playwright-core，脚手架 `C:\Users\28233\AppData\Local\Temp\webcasio-test\`）：
  - `node probe.js`（主模式）：`2 POW 3 DEL 4 R + 1 =`→17、`INT x R 0 R 1 =`→0.5、`FRAC 1 R 2 R + 3 =`→3.5、`SQRT 2 R * 2 =`→2.828427125、`1 . 5 EXP 3 =`→1500、`DER x POW 2 R R 3 =`→6、`SIN PI / 2 ) =`→1、`( 1 + 2 L L DEL 3 =`→5；每步光标恰 1 个、无「过于复杂」、无 page error；未闭合 `(` 渲染灰色幽灵 `)`。
  - `node s3check.js`（funcs/vars/plot/roots/模式往返）：f=`x^2-2` 已保存、g=`sin(x)` 已保存、`FRAC 1 =` → 语法错误、主模式 `f(3)+g(0)`=7、var a=6、var x=1.5、主模式 `a+x+f(x)`=7.75、plot 两行正常渲染无「过于复杂」、f 在 [-3,3] 根 ±1.41421356、切回主模式表达式保留；page errors 为空。
- 行为说明：
  - funcs 模式每次编辑都把序列化结果写入 `state.expr.fx/gx`（即使表达式暂不合法）；plot/roots/tracker 读取处有 try/catch，不合法时只是画不出；`calculate` 只给出「已保存」或「语法错误」。
  - vars 模式的 `varExprs` 只在 `calculate` 成功时写入（内核默认 onChange 会写，但 `configure` 传入的 glue onChange 覆盖了它）。
### S4（已完成）
- 产出物：`C:\Users\28233\Documents\ChatGPT\WebCASIO\www\index.html`（2478 行）。改前备份：`%TEMP%\index.html.bak-s4`。补丁脚本 `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\s4-patch.js` 已执行过，**不要再运行**。
- 内容：`#btn-const`（「物理常数」）是 `#var-btns-row` 第 7 个子元素，grid 改为 `repeat(6,1fr) 1.9fr`（原 `repeat(7,2fr)` 放不下四个汉字）。`#const-panel` 紧跟 `#keyboard-area`，占同一 flex 位置；工具栏 ← → DEL 返回键盘；`#const-list` 两列 grid、7 个分组标题、53 个 cell，cell 文本「符号：中文名」（符号用 KaTeX）。长按 450ms 加 `.show-val` 显示 10 位有效数字科学记数法，松手恢复且不插入；移动 >8px 视为滚动不插入；短按 `append('const:'+id)`；屏蔽 contextmenu；键盘激活（click detail=0）也能插入。`switchMode` 开头调用 `setConstPanel(false)`。面板首次打开时才构建（`buildConstPanel`）。
- 顺带修的 bug：
  1. 变量卡片 `vval-*` 原用 `toFixed(8)`，mₑ 等小常数显示为 0；改为 `math.format(val,{precision:8})`。
  2. 打开面板后整页可滚动到 1825px：KaTeX 的绝对定位 MathML 没有定位祖先；给 `.const-list` 和 `.const-cell` 加 `position:relative` 后页面高度恢复 860。
- 验证（脚手架 `%TEMP%\webcasio-test\`）：`node C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\s4check.js` → `S4CHECK OK`（布局/两列/无溢出/公式框高度不变 88→88、短按插入 c0、长按 qe 显示 1.602176634×10⁻¹⁹ 且不插入、拖动不插入、一次 DEL 删掉 ε₀、c0×2、qe×NA=96485.33212、mue×π、隐式乘 2ħ、plot/vars/main 切换关面板、变量 b=mₑ 后 b/mₑ=1、无 page error）。回归：`editor-core.test.js` 2223 通过、`probe.js` 8 条全对、`s3check.js` 无错误。截图 `%TEMP%\webcasio-test\s4-panel.png`、`s4-longpress.png`、`s4-end.png`。
- 未验证：真机触摸（Android WebView）上的长按/滚动手感，只用无头 Edge 鼠标事件模拟过；`s4check.js` 在键盘隐藏时用 `press` 点隐藏按钮输入运算符，这只验证逻辑不验证 UI 可达性（面板内无运算符键，用户需「返回键盘」）。
### S5（已完成）
- 产出物：
  - `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\suite.js`：无头 Edge 回归套件，153 项断言全绿。其中 132 条拟人键盘序列（中途含 `DEL` 与 `←`/`→`，均以 `=` 结束）、16 条物理常数面板用例、5 条 f/g/变量/plot/roots 模式用例。每步断言无「过于复杂」、光标恰 1 个、无 pageerror；最终结果用原生 `Math` 独立另算后以相对误差 1e-8 比对（常数期望取自 `constants-data.js`）。顺带写出 `tools\suite-report.json`（机器可读）。
  - `C:\Users\28233\Documents\ChatGPT\WebCASIO\docs\输入测试报告.md`：中文测试报告（方法、总览、测试表、bug、Android 一致性、常数清单+来源 CW 说明书 p.57 / CODATA 2018 + 精度说明、已验证 vs 未验证）。
- `www\index.html` 在 S5 **零改动**：153 条一次全绿，未发现需最小化修复的新 bug（输入健壮性已在 S2/S3 内核改造中根治）。
- 回归（全部通过）：`node tools\editor-core.test.js`→`2223 passed`；`node tools\suite.js`→`SUITE OK 153/153`；`node s3check.js`→`errors: []`；`node tools\s4check.js`→`S4CHECK OK`。
- Android 副本：`Copy-Item` 覆盖 `android\app\src\main\assets\public\index.html` 后，`Compare-Object`（字节数组 + 逐行）均为空 → 逐字节相同（135394 B / 2478 行，CRLF 2478、无落单 LF、无 BOM）；套件对该副本重跑亦 `153/153`。
- 运行方式：`cd %TEMP%\webcasio-test; node C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\suite.js`（可用 `CALC` 环境变量指向待测 index.html）。
- 未验证：Android WebView 真机触摸（长按 450ms 阈值、滑动>8px 取消插入仅用鼠标事件模拟）、常数面板内运算符不可达的真机 UX 手感。

## 待办明细

- 无（S0–S5 全部 DONE）。

## 纪律
- 绝不动 `.github/workflows/1.tex`（用户自有文件）。
- 必须保持 `www\index.html` 单文件（内联 JS/CSS，不拆外链）。
- 含中文的文件一律用 `exec_command` + PowerShell here-string + `Set-Content -Encoding UTF8` 写（`js` 工具会拒绝源码里的全角标点）。


