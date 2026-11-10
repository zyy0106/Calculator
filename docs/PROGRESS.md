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
| S4 | 物理常数面板 UI | 改 `C:\Users\28233\Documents\ChatGPT\WebCASIO\www\index.html` | 是 | S3 | TODO |
| S5 | 回归测试套件 + 交付 | `C:\Users\28233\Documents\ChatGPT\WebCASIO\tools\suite.js`、`C:\Users\28233\Documents\ChatGPT\WebCASIO\docs\输入测试报告.md`、同步 android 副本 | 是（仅修 bug） | S4 | TODO |

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
## 待办明细

### S4 要做的事
`#btn-const` 加入 `#var-btns-row`（CSS `repeat(6,2fr)` → `repeat(7,2fr)`），`#const-panel` 两列 grid + 长按 450ms 显示科学记数法 + 短按插入原子。

### S5 要做的事
大批量逐键输入 + 中途 DEL + 最终 `=` 的回归套件，产出 Markdown 测试报告给用户；`Compare-Object` 校验后同步到 `android\app\src\main\assets\public\index.html`。

## 纪律
- 绝不动 `.github/workflows/1.tex`（用户自有文件）。
- 必须保持 `www\index.html` 单文件（内联 JS/CSS，不拆外链）。
- 含中文的文件一律用 `exec_command` + PowerShell here-string + `Set-Content -Encoding UTF8` 写（`js` 工具会拒绝源码里的全角标点）。
