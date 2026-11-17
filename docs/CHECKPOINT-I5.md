# CHECKPOINT-I5：回归扩充、Android 同步、验收报告

状态：DONE（2026-11-17）

## 产出
- `tools\harness.js`：TEMP harness 的仓库内拷贝。
- `tools\suite-v2.js`：133 例，全部通过。合法数值 35/35，预期错误 11/11，UI/编辑行为 86/86，通路验证 1/1。
- `android\app\src\main\assets\public\index.html`：已覆盖，字节逐一比较 0 差异，逐行比较 0 差异；162596 字节，2960 行，CRLF 2960，无 BOM。
- `docs\v2验收报告.md`。

## 回归
- `tools\suite.js`：串行 5 次均 153/153；6 实例并行均 153/153。
- `editor-core.js --selftest` OK；`editor-core.test.js` 4788/0；`inteq-solver.test.js` 28/28。

## 结论
- suite.js 常量用例（`NA*qe`、`g_n*2`）历史不稳定未复现。已证实存在的可能机理：测试用真实计时器按压常量格，按下到松开 ≥450 ms（`CONST_LONG_MS`）即判长按、不插入。未证实为当时原因；index.html 无缺陷，未修改。
- `suite.js` 仍依赖 TEMP 下的 harness；playwright-core 仍来自 TEMP 的 node_modules。
- 未验证：Android 真机触摸/WebView 滚动/pointercancel、KaTeX 锚点在 WebView 中的渲染；APK 未构建；未 git commit。