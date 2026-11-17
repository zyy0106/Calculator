# CHECKPOINT K2

## 状态
K2 已完成：根层游离 `)` 也插入 xclose（修正 K1 的偏离）、`logb` 节点、变量 `t`。未改 index.html，未碰 inteq-solver.js，未 commit。

## 已改（tools/editor-core.js）
- 常量：`NODE_SLOTS.logb=2`、`PW_TYPES.logb=true`、`NODE_INPUT['log_(']='logb'`、`VARS.t=1`
- editors 初始化：增加 `var_t`
- `keyToInput` 正则：`/^[abcxyzte0-9.+\-*\/(),]$/`
- `serNode`：`log((s0),(s1))`
- `texNode`：`\log_{s1}\left(s0\right)`
- `closeParen`：删除根层 no-op 分支，任何层级无法配对时都插入 xclose

## 单测口径变化
- `stray close at root`：期望改为 `\u0000)`，accepted 为 1
- `extra close after sqrt`：期望改为 `sqrt((2))\u0000)`
- `root stray close no-op` 改名为 `root stray close`，期望 `1\u0000)`

## 验证
- selftest：SELFTEST OK
- 单测：TESTS OK 4788 passed, 0 failed
- 基线（26 例，均不含 logb/t）：anchors:false 时逐字符相等，结论 true

## I1 接线点（index.html，行号为当前版本）
1. 908 / 910 / 913 / 915：NODE_SLOTS、PW_TYPES、NODE_INPUT、VARS 的内联副本
2. 961：内联 editors 初始化
3. 1388：内联 keyToInput 正则
4. 内联 serNode、texNode、closeParen（1287 起）：整段替换为 tools/editor-core.js 中对应函数（K1 的改动也在其中）
5. 1458 VAR_KEYS、1459 VAR_LABELS、1460 varExprs、1461 varVals：加 t
6. 469-474 变量面板：照 474 的 `var-row-z` 加 `var-row-t` 行（vname-t 等 id）
7. 1580-1583 getCombinedScope：对象字面量是逐个硬编码的，需加 `t: varVals.t`
8. 981 默认 onChange 用 `key.slice(4)` 写回，var_t 自动生效，无需改
9. 648 变量键盘按钮属于 I2，不在 I1 范围

## 未验证
浏览器 KaTeX 渲染 `\log_{}`、`\htmlId`、`\phantom`（I4）；宿主 UI 中的 t 面板。
