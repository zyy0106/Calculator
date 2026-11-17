# CHECKPOINT I4b — 求根面板「积分方程」子模式

状态：完成，已验证。www/index.html 2651→2960 行，CRLF、无 BOM，单文件。

## 改动
- HTML（#roots-panel，501 行起）：新增 tab `#root-mode-alg`（代数求根，默认）/`#root-mode-inteq`（积分方程）；子面板 `#inteq-inputs`（提示文字、`#inteqLower`=0、`#inteqUpper`=x、`#inteqC`=2；`<details>高级` 内 `#inteqN`=64、`#inteqSteps`=400）；按钮 `#root-btn-alg`（原「执行求根」加 id）、`#root-btn-inteq`（求解积分方程）。`#rootX1/#rootX2`、`#root-list` 两模式共用。
- CSS：`.root-resid`（残差小字）。
- S1 内联：独立 `<script>` 段，1526-1726 行，UMD 原样（LF→CRLF）。字节级一致 false（仅行尾不同），行尾归一化一致 true。
- JS（calculateRoots 之后，2658 行起）：`setRootMode(m)`、`inteqUndefinedSymbol(node, locals)`、`calculateIntegralEq()`（先显示「计算中…」，setTimeout 0 后执行，耗时写入 `#root-list` 的 `data-ms`，求值次数写入 `data-evals`）、`inteqRun(listEl)`。F 用 getCombinedScope() 的 Map 副本注入 t、x；不改 varVals。calculateRoots、switchMode 未改。

## 错误文案
Start 必须小于 End；被积函数未定义：请在函数选项卡输入 f(x)/g(x)；被积函数无法解析: …；被积函数中变量未定义: y；下限 a(x)/上限 b(x)/右端常数 c 表达式无法解析；… 不能含积分哑元 t；右端常数 c 无效（不能含 x）；右端常数 c 无效；… 中变量未定义: z；其余透传 S1 的 error。

## 验证（%TEMP%\webcasio-test\i4b.js）
21/21 通过，pageErrors=0。5 个基准误差 ≤1.9e-9；默认参数下页面内耗时 3-19 ms（约 2.6 万次 F 求值），点击到出结果 55-71 ms。
回归：suite 153/153（改动前基线 151-152/153，失败项是 CONST NA*qe 和 g_n*2，结果不稳定，与本任务无关）；i2 40/40；i3 13/13；i4 PASS 17 FAIL 0。
