# CHECKPOINT-U1：index.html 键盘重排 / 气泡 / 字体 / 禁选中 / 移除积分方程与 t

只改了 `www/index.html`、`docs/CHECKPOINT-U1.md`、`docs/INTEQ-RESTORE.md`。tools/android/.github 均未写入，未 commit。index.html 保持单文件，CRLF，无 BOM（2948 行，0 个孤立 LF）。行号均指当前文件。

## 上游 A：内核内联同步

- 6 处同步完成：`\vphantom{|}`（937 行 anchorTex）、`NODE_SLOTS` 加 cbrt/nroot、`FN_INPUT` 加 `lg(`、`NODE_INPUT` 加 `cbrt(`/`nroot(`、序列化与 TeX 各加两行。
- 一致性校验（`%TEMP%\u1_cmp.js`，不在仓库）：内联段 909–1514 行对比 `tools/editor-core.js` 去掉自检段后的 606 行，结果 `diff count 0`。

## 上游 B：长按气泡内联（1516 行起的独立 `<script>`，纯 ASCII）

- 颜色改为 `var(--btn-primary)`。
- 增强：上方空间不足时翻到按钮下方。`computeLayout` 里 `if (top < EDGE_PX) { top = btn.top + btn.height + GAP_PX; below = true; }`（1565 行）；`showBubble` 加类 `lpb lpb-below`；CSS 让尾巴朝上（1552 行）。实测：`computeLayout(top:20)` 返回 `{top:84, below:true}`；DOM 中类名为 `lpb lpb-below`，尾巴 `top:-7px`；截图 u1_bubble_below.png 显示正确。
- 旧长按已删干净：`bindLongKey`、`KEY_LONG_MS`、`key-pop`、`kp-item`、`show-alt`、`k-alt`、`k-def`、`data-long`、`kb-pair`、`key-logb` 的 grep 计数全部为 0。

## R1 键盘重排与尺寸

- HTML（678 行起）：第 2 行 f(x) g(x) ∫ d/dx ← →；第 3 行 分数线 √(#key-sqrt) x²(#key-sq) ln(#key-ln) ( )；第 4 行 `kb-row-5 kb-row-fn`：sin cos tan π e；其余 4 行 5 列不变。第 1 行变量键（668 行）未改。
- CSS：`.kb-row-6/.kb-row-5` 为 grid，子元素 `aspect-ratio:1/1; height:auto`；第 4 行 `height: var(--cell6)`（164 行）。
- 纯 CSS 做不到「第 4 行高 = 6 列格边长」并同时处理纵向溢出，所以用 JS：`syncKbCell()` 写入 `--cell6=(宽-30)/6`；`fitKeyboard()`（2905 行）在溢出时给键盘设居中的 `max-width` 等比缩小并加 `kb-compact`（字号 = cell×0.42）。resize、fonts.ready、初始化、switchMode、常数面板开关时都会调用。按钮去掉了尺寸 transition，否则同步测量会读到过渡中的值。
- `.screen`：`flex:1 1 auto; min-height:90px`（61 行）。90px 是实测下限：公式行 36 + 结果行 31 + 内边距/边框 22。绘图模式和常数面板用 `.screen-fixed` 保持 88px。
- 按「尽量使用这一版的风格」与「顶部字横向排列」两次反馈做的调整：
  - 变量面板改为 3×2 卡片（6 个变量），卡片高 42px。
  - `@media (max-height:760px)` 时外边距 20→12px、间距 9→6px，让短屏的键盘保持整屏宽。
  - 顶部选项卡 `white-space:nowrap; font-size:min(13px,3.4vw)`（58 行）。360 宽时字号 12.24px，7 个标签都只占 1 行（Range.getClientRects 计数均为 1）。

### 四档视口 × 三个选项卡实测（Playwright + Edge headless，输入 86835 后测量）

| 视口 | 选项卡 | 溢出 | 键盘宽 | 2/3 行格 | 第 4 行 宽×高 | 4 行宽和+gap−键盘宽 | 数字键 | 第 1 行 | .screen 高 |
|---|---|---|---|---|---|---|---|---|---|
| 420×860 | 计算 | 0 | 370 | 56.66×56.66 | 69.19×56.66 | −0.02 | 69.19² | 26 | 246.2 |
| 420×860 | 函数 | 0 | 370 | 56.66² | 69.19×56.66 | −0.02 | 69.19² | 26 | 203.2 |
| 420×860 | 变量 | 0 | 370 | 56.66² | 69.19×56.66 | −0.02 | 69.19² | 26 | 148.2 |
| 393×851 | 计算 | 0 | 343 | 52.16² | 63.80×52.16 | −0.02 | 63.80² | 26 | 272.3 |
| 393×851 | 函数 | 0 | 343 | 52.16² | 63.80×52.16 | −0.02 | 63.80² | 26 | 229.3 |
| 393×851 | 变量 | 0 | 343 | 52.16² | 63.80×52.16 | −0.02 | 63.80² | 26 | 174.3 |
| 360×740 | 计算 | 0 | 310 | 46.66² | 57.19×46.66 | 0 | 57.19² | 26 | 231.2 |
| 360×740 | 函数 | 0 | 310 | 46.66² | 57.19×46.66 | 0 | 57.19² | 26 | 191.2 |
| 360×740 | 变量 | 0 | 310 | 46.66² | 57.19×46.66 | 0 | 57.19² | 26 | 136.2 |
| 360×640 | 计算 | 0 | 310 | 46.66² | 57.19×46.66 | 0 | 57.19² | 26 | 131.2 |
| 360×640 | 函数 | 0 | 310 | 46.66² | 57.19×46.66 | 0 | 57.19² | 26 | 91.2 |
| 360×640 | 变量 | 0 | 267（max-width） | 39.50² | 48.59×39.50 | −0.02 | 48.59² | 26 | 92.1 |

所有组合：正方形误差 0；第 4 行高 − 格边长 = 0；第 1 行 26px；页面无纵向滚动。改动前 `.screen` 是 `min-height:88px`、不可增长，v2 在 420×860 计算页实测 118px，现为 246.2px。

## R2 长按气泡接线（2879 行 `LP_ITEMS`）

- 按 N2 撤销决策 2：`key-ln` 恢复为两项（lg、log_x(y)），共 10 条路径。
- `^{3}`：内核只接受 `^{}`/`^{2}`，所以 `lpInsert`（2889 行）把它转成 `append('^{}')`、`append('3')`、`moveCursor(1)`。
- 标签包在 `<span class="lpb-lab">` 中，否则 sup/sub 在 flex 项里会失去上下标位置。
- 真实 pointer 事件实测：先输入 2，按下 → 500ms → 移到选项中心 → 松开。

| 路径 | 序列化结果 | 路径 | 序列化结果 |
|---|---|---|---|
| √→∛ | `2*cbrt(□)` | ln→lg | `2*log10(□)` |
| √→ⁿ√ | `2*nthRoot(□,□)` | ln→log_x(y) | `2*log(□,□)` |
| x²→x³ | `(2)^(3)` = 8 | sin→sin⁻¹ | `2*asin(□)` |
| x²→xʸ | `(2)^(□)` | cos→cos⁻¹ | `2*acos(□)` |
| tan→tan⁻¹ | `2*atan(□)` | ln 第 3 项（已删 t） | 不存在，未写入 |

- 选项高 35.5px = 按钮 56.67 × 2/3；360×640 变量页压缩键盘下选项高 17.44px。
- 短按：`sqrt(`、`^{2}`、`log(`、`sin(`、`cos(`、`tan(` 全部正确。
- 松手在空白处不写入；移动超过 8px 时取消，不弹气泡。
- 假时钟：449ms 是短按，451ms 弹出气泡。
- 计算：cbrt(27)=3，nthRoot(32,5)=2，2^3=8，lg(100)=2；pageerror 为 0。
- Enter 不触发按钮：全局 keydown 把 Enter 映射为 `calculate()` 并 preventDefault，HEAD 版本也是这样，属于原设计；Space 正常（cos→`cos(`）。

## R3 公式间距

- `.ec-anchor { min-width:0 }`（478 行）。
- 「86835」对比 v2 的 `\phantom`：锚点宽 24.2→0；字符间隙 24.2→0；数字间距 36.31→12.11；总宽 157.36→60.55（纯 KaTeX 为 48.41，差值来自光标）。`1+2+3` 总宽 181.95→95.48。
- `tapCursorAt`（1987 行）本来就按「最近锚点中心」定位，未改。6 个点击点得到光标位置 0,1,2,3,4,5，全部正确。

## R4 禁止选中（173 行）

计算值：显示区、.screen、.latex-line、键盘、键盘按钮、第 1 行均为 `none`；`#rootX1` 和 `.matrix-cell` 均为 `text`（`#inteqLower` 已随 N1 删除）。

## R5 字体 / 决策 3 符号对齐

- KaTeX 从本地 `www/` 资源加载。`document.fonts.check` 对 Main、Math italic、Size1、Size2 都返回 true。
- `--cm` 以 `'KaTeX_Main','KaTeX_Size1'` 开头；`.mv` 用 KaTeX_Math italic 400（π、x、f、g、n）；`.k-size2` 用 KaTeX_Size2（∫，与 display 模式的 \int 相同）。
- 字形对照：从 KaTeX 输出的 span 读取 computedStyle，再在按钮里用相同字号 24.2px 测宽。

| 符号 | KaTeX 字体 | 按钮字体 | KaTeX 宽 | 按钮宽 | 差 |
|---|---|---|---|---|---|
| π | Math/italic/400 | 同 | 13.797 | 13.797 | 0 |
| ∫ | Size2/normal/400 | 同 | 13.469 | 13.469 | 0 |
| × | Main/normal/400 | 同 | 18.828 | 18.828 | 0 |
| ÷ | Main | 同 | 18.828 | 18.828 | 0 |
| √（\surd） | Main | 同 | 20.172 | 20.172 | 0 |
| ← / → | Main | 同 | 24.203 | 24.203 | 0 |
| 8 / x / ( / e | Main / Math / Main / Main | 同 | 12.109 / 13.844 / 9.422 / 10.75 | 同 | 0 |
| ln / sin | Main | 同 | 20.203 / 29.75 | 20.188 / 29.719 | −0.016 / −0.031 |

- ln、sin 的差值 ≤0.031px，来自 KaTeX `\operatorname` 的字距。
- KaTeX 把 \sqrt 画成 SVG，按钮用 √ 字形，与 \surd 一致。
- ⁻¹、²、ⁿ 在 KaTeX 字体中没有字形，按钮改用 `<sup>`。

## N1 移除积分方程子模式

- 删除位置（移除前行号）：模式切换按钮 513–516；输入区 521–534；求解按钮 540；`.root-resid` 218（代数求根不使用）；内联求解器 1810–2012（203 行，删除前核对与 tools/inteq-solver.js 逐字一致）；宿主函数 setRootMode、inteqUndefinedSymbol、calculateIntegralEq、inteqRun 共 2944–3028 行。
- 原位置留一行注释（2721 行）。
- grep `inteq|Inteq|setRootMode|rootMode|root-resid|InteqSolver|积分方程`：只剩这行注释。
- 内联 script 现为 3 段，`node --check` 全部 OK。
- 代数求根实测：f(x)=x²−4，区间 [−10,10] 得到 x₁=−2、x₂=2。面板只剩「针对 f(x)/g(x)」和「执行求根」。
- 恢复指南：`docs/INTEQ-RESTORE.md`（含全部原文片段、接线点、限制与验证清单）。

## N2 移除变量 t

- 删除 `#var-row-t`；`VAR_KEYS`、`VAR_LABELS`、`varExprs`、`varVals` 去掉 t（1823 行起）；`getCombinedScope` 去掉 `t: varVals.t`（1947 行）；`key-ln` 气泡去掉 t。
- 实测：变量卡片 6 张（abcxyz）。定义 a=2 后计算 `a*3` 得 `= 6`。截图 3×2 布局正常。
- 内核 `VARS.t` 和 `var_t` 编辑器保留（不在白名单），宿主不再提供入口。

## 测试

| 命令 | 输出 |
|---|---|
| `node tools\editor-core.js --selftest` | `SELFTEST OK` |
| `node tools\editor-core.test.js` | `K5 new assertions: 489` / `TESTS OK 5277 passed, 0 failed` |
| `node tools\inteq-solver.test.js` | `pass 28 / 28` |
| `node tools\longpress-bubble.test.js` | `TESTS OK 53 passed, 0 failed` |
| `node tools\suite-v2.js` | `TOTAL 34/40 pass`，exit 1（未修改该文件） |

### suite-v2 判定

原版 suite 在缺选择器时整段崩溃，后面的用例跑不到。为此在 `%TEMP%\u1suite` 复制了一份 harness/suite：找不到按钮时回退为执行 onclick 语句，并打印全部失败项。这份副本结果为 `TOTAL 64/79`，15 项失败全部是需求变更导致的预期失败：

| 失败项 | 原因 | 判定 |
|---|---|---|
| new 段崩溃 `not tappable ... append('sqrt(')` | √ 改为长按键，不再有 onclick | 预期 |
| sin/cos/tan long → a*（3 条） | 新交互要求拖到选项上再松开，旧 helper 原地松开 | 预期 |
| asin/acos/atan 数值链（3 条） | 同上 | 预期 |
| half-width ( ) ratio（2 条） | 半宽括号对按需求删除 | 预期 |
| long-press ln 经 `.kp-item` | 旧弹层已删除 | 预期 |
| i2 rows2-4 [6,6,5]、1-cell width、paren ratio、i2 崩溃 | 键盘按需求重排；i2 依赖 key-logb/.key-pop/show-alt | 预期 |
| i4 anchors present w>=2 | R3 要求锚点宽为 0 | 预期 |
| i4b 崩溃 `waiting for #root-mode-inteq` | N1 删除了积分方程 | 预期 |

i3（13/13）与 i4 其余 15 项通过；N1 之前 i4b 21/21 通过。未发现真实回归。

## 截图查看（%TEMP%，不在仓库）

已逐张查看：u1_main、u1_bubble、u1_bubble_sin、u1_bubble_below、u1_360x640_vars_bubble、u1_mode_{funcs,vars,plot,roots,fit,matrix,const}、u1_roots_inteq（N1 前）、u1_s_*、u1_n_{360x640_main,360x640_vars,roots,vars_panel}。

- 数字紧凑无间隙；按键为正方形；第 4 行 5 等分。
- 气泡有尾巴，x³、xʸ、sin⁻¹ 上标正确。
- 绘图、统计、矩阵、常数面板布局正常。
- 顶部标签横排。
- 有一张图里「变量」高亮偏淡：那是 .nav-btn 0.2s 背景过渡的中间帧，HEAD 行为相同。

## 遗留风险

- 360×640 变量页键盘缩到 267px（格 39.5px），触控偏小。
- `.screen` 下限 90px，更矮的屏幕会继续压缩键盘。
- 二元运算符的锚点包装仍有 5.38px 宽（KaTeX mbin 间距）。
- 内核仍把 t 视为合法变量（物理键盘输入 t 会插入变量 t，其值未定义）。
- suite-v2 需要由所有者按新交互更新。
- android 副本未同步（需执行 cap sync）。
