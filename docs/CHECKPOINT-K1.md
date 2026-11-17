# CHECKPOINT K1

## 状态
三项均已完成：xclose 游离右括号、触点锚点 API、范围约束（未改 index.html，未 commit）。

## 接口
- `renderTex(key, {cursor:true, anchors:true})`：每个合法光标位前输出 `\htmlId{ec-<path>}{\htmlClass{ec-anchor}{\phantom{|}}}`；空槽锚点在 `\square` 之前。
- `setCursorPath(key, path) -> boolean`：非法 path 或不存在的 key 返回 false，不改状态、不调用 onChange。
- `cursorPositions(key) -> string[]`：按槽位顺序（与连续 moveCursor('right') 一致）列出全部 path。
- 额外导出：`cursorPath`、`anchorTex`、`resolvePath`。

## 已改函数（tools/editor-core.js）
常量段（XCLOSE_TEX、anchorTex）、serBlock、closeParen、texSlot、texNode、texBlock、renderTex、导出段；新增 childCtx、resolvePath、existingKey、setCursorPath、cursorPositions。

## xclose 口径
- 仅在节点槽内、无待闭合 open 且右侧不是 close 时插入 `{t:'xclose'}`。
- 根层游离 `)` 保持原有 no-op（返回 false），因既有断言 `stray close at root` 要求如此。
- 序列化为 `\u0000)`，单测用 `../www/math.min.js` 的 `parse` 证明不可解析。
- DEL 走普通单项删除分支。

## 验证
- `node tools/editor-core.js --selftest` → SELFTEST OK
- `node tools/editor-core.test.js` → TESTS OK 3660 passed, 0 failed
- 基线 `tools/__anchors-baseline.json`（26 个表达式）：anchors 缺省或 false 时逐字符相等，结论为 true。

## 下一步
I1 把 editor-core.js 同步进 index.html 内联副本；I4 在浏览器中验证 KaTeX 对 `\htmlId` 与 `\phantom` 的渲染（需 trust 选项）。

## 已知限制
- int 节点 TeX 先渲染上下限（s1、s2）后渲染被积式（s0），锚点在 TeX 中的出现顺序与 cursorPositions 顺序不同。
- 4 条旧断言原本断言 `)` 跳出 sqrt（即本次修复的 bug），已改为用 R 键跳出，意图不变。
