# CHECKPOINT-I2 (2026-11-17)

## 已完成
- `www/index.html` 键盘区改为 flex 列 + 每行独立 grid：`.kb-row-6`(repeat(6)) ×3、`.kb-row-5`(repeat(5)) ×4；`.kb-pair` 嵌套 1fr 1fr / gap 3px 放 `(` `)`。
- 删除 `.main-cursor-row` 容器与 CSS；删除 `lg`（log10）与 `ln` 按钮。ln 改走 log_x(y) 长按浮层。
- `switchMode` 与 `setConstPanel` 中 keyboard-area 的显示值 `grid` → `flex`。
- 新增 `KEY_LONG_MS=450, KEY_MOVE_PX=8`、`bindLongKey`（位于原 bindConstCell 之后）；sin/cos/tan 长按 `.show-alt` 预览 `sin⁻¹` 等；`#key-logb` 长按弹 `.key-pop`（absolute），候选 `ln`→`log(`、`t`→`t`。
- 内核段、`#var-btns-row`、其他面板、tools\ 均未改。

## 测试
- `node tools\suite.js`：153/153，pageErrors=0。harness（%TEMP%\webcasio-test\harness.js）调整：SIN/COS/TAN 改按 `#key-*` id；LG/LN 遗留用例按钮已删，改为直接 eval 其 onclick 语句。
- `%TEMP%\webcasio-test\i2.js`（Playwright 真实鼠标 pointer 事件 + page.clock）：35/40。

## 阻塞（范围外）
- 长按 sin/cos/tan 调用 `append('asin(')` 等时什么也不写入：内核 `FN_INPUT`（934 行）/`FN_TEX`（935 行）没有 asin/acos/atan，且它们是闭包私有变量，EditorCore 也没有注册接口。
- 需要授权修改内核：FN_INPUT 加 `'asin(':'asin','acos(':'acos','atan(':'atan'`，FN_TEX 加 `asin:'\\sin^{-1}'` 等。改完后重跑 i2.js，剩余 5 个失败用例应全部转为通过。
