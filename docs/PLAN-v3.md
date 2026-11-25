# PLAN-v3：UI 改造任务划分与预算

日期：2026-11-25。基于用户手绘草图（已转正读清）与手机截图。

## 需求解读

### R1 键盘排布与尺寸
草图最终排布（4 行，前 3 行 6 列，第 4 行 5 键 + 半宽括号对）：

- 第 1 行（保持不变，`#var-btns-row`）：a b c x y z 物理常数
- 第 2 行：f(x) g(x) ∫ d/dx ← →
- 第 3 行：分数线 √ x^2 ln ( )  ← 注意：`x^y` 与 `log_x(y)` 从第 3 行移除，改由长按 `x^2` / `ln` 获得；左右括号在第 3 行末尾
- 第 4 行：sin cos tan π e （5 键，等分占满整屏宽）

尺寸规则：
- 第 2、3 行所有 cell 为严格圆角正方形，高度由宽度决定（`aspect-ratio: 1 / 1`）
- 第 1 行高宽不变（26px 高）
- 第 4 行高度与第 2、3 行相同，宽度等分占满整屏
- 数字键与 DEL/AC 等保持圆角正方形
- 省出的纵向余量全部加给公式显示行 `.screen` / `#single-line-display`

### R2 长按拖拽气泡（仿微软数学）
映射字典（原 cell : 弹出项）：
- `√` : [∛ `\sqrt[3]{}`, ⁿ√ `\sqrt[n]{}`]
- `x^2` : [`x^3`, `x^y`]
- `ln` : [`lg`, `log_x(y)`]
- `sin` : [`sin⁻¹`]，`cos` : [`cos⁻¹`]，`tan` : [`tan⁻¹`]

交互：长按 450ms 弹出方形气泡（带指向原 cell 的尾巴），手指按住拖到选项上松手写入；弹出项高度 = 原 cell 高度 × 2/3，宽度按内容自适应，气泡整体尺寸自适应。替换 v2 的「长按直接写反函数」与「log_x(y) 浮层」两套旧实现。

### R3 公式渲染间距
根因：v2 的 `anchorTex` 用 `\phantom{|}`（占真实宽度）。改为 `\vphantom{|}`（零宽、保高），恢复紧凑渲染同时保留触屏定位。

### R4 禁止文本选中
显示区与键盘加 `user-select:none`、`-webkit-user-select:none`、`-webkit-touch-callout:none`，但不影响 `<input>` 的正常编辑。

## 容量情景与预算

假设 `W=200000, p=75` → `H=150000, B=112500, F=24000, u=1.25`。

| 代号 | 任务 | R | G | V | Q | N | rho | 状态 |
|---|---|---|---|---|---|---|---|---|
| K5 | 内核 cbrt/nroot/lg 节点 + 零宽锚点 | 9000 | 7000 | 4000 | 6000 | 56500 | 0.50 | 绿 |
| P1 | 长按拖拽气泡独立组件 + 单测 | 9000 | 7000 | 4000 | 6000 | 56500 | 0.50 | 绿 |
| U1 | index.html：内联同步 + 键盘重排 + 尺寸 + 气泡接线 + 禁选中 | 14000 | 9000 | 5000 | 7000 | 67750 | 0.60 | 绿 |
| V1 | 回归 + android 同步 + 验收报告 | 9000 | 4000 | 8000 | 5000 | 56500 | 0.50 | 绿 |

## 写入边界（同文件串行）

- K5 → `tools\editor-core.js`、`tools\editor-core.test.js`、`docs\CHECKPOINT-K5.md`
- P1 → `tools\longpress-bubble.js`、`tools\longpress-bubble.test.js`、`docs\CHECKPOINT-P1.md`
- U1 → `www\index.html`、`docs\CHECKPOINT-U1.md`（唯一 index.html 写者，必须在 K5 与 P1 之后启动）
- V1 → `docs\v3验收报告.md`、`tools\suite-v3.js`、`android\app\src\main\assets\public\index.html`（由 cap sync 生成）

## 依赖关系

K5 ∥ P1（并行，文件不相交）→ U1（串行，吸收二者产物）→ V1。

## 全局禁止

- 不得 git commit / push / 构建 APK（需用户单独授权）
- 不得触碰 `.github\workflows\1.tex`
- `www\index.html` 必须保持单文件内联，不得拆外链
- 含中文的文件用 PowerShell here-string + `Set-Content -Encoding UTF8` 写
