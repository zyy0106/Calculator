# CHECKPOINT-I1：新内核内联与变量 t 接线

状态：已完成，可交接。未 git commit。

## 已改区段（仅 `www/index.html`）
- 内核内联段：`www/index.html` 第 881-1482 行（原 880-1423）。内容与 `tools/editor-core.js` 第 1-602 行逐字一致，只去掉了 Node 自检段。UMD 头尾原本就在内联段里，保持原样（同一个 `(function (root, factory){…})` 包裹）。constants-data 内联段（第 719-879 行）未改动。
- 文件总行数从 2478 变为 2538，换行符保持 CRLF，编码 UTF-8 无 BOM。
- 变量 t 的接线点：
  - 第 475 行新增 `var-row-t`（包含 `vname-t` 和 `vval-t`），结构照抄 `var-row-z`
  - 第 1517-1520 行：`VAR_KEYS`、`VAR_LABELS`、`varExprs`、`varVals` 各加入 `t`
  - 第 1641 行：`getCombinedScope` 加入 `t: varVals.t`
- 以下内容未改动：`calculate()`（第 1699 行）、默认 onChange、`#vars-panel` 的 CSS、键盘部分、`tools/` 目录。

## 验证
- `node tools/suite.js`：结果 `SUITE OK 153/153 passed; pageErrors=0`
- 一致性比对（脚本临时执行，未保存）：对比的 64 个函数全部一致，fnEqual=true，没有差异函数，整段文本也完全相等。
- `%TEMP%\webcasio-test\i1.js` 在真实页面（Edge headless，视口 420x860）上跑了 8 条断言，全部通过，pageErrors=0：
  - `sqrt( 8 )` 渲染为 `\sqrt{8)}`，按 = 显示“语法错误”
  - 空表达式输入 `)` 后按 =，显示“语法错误”
  - `( 1 + 2 )` 计算结果为 3
  - `log_( 8 , 2` 计算结果为 3
  - vars 面板中给 t 赋值 5 后，main 模式计算 `t*2` 得 10
  - a,b,c,x,y,z 依次赋值 2..7 后求和得 27
  - anchors 默认关闭时，26 条基线的 TeX（含光标和不含光标）与序列化结果全部一致
  - 设置 `anchors:true` 时输出中包含 `ec-anchor`
- 变量面板（3 列，每列 120px）：7 张卡片分 3 行排布，行顶坐标为 64、119、174。面板范围为 top 64 到 bottom 224，宽 370。scrollHeight 和 clientHeight 都是 160，scrollWidth 和 clientWidth 都是 370，没有溢出，7 张卡片全部可见，且都在面板范围内。
- `calculate()` 本身已经满足游离 `)` 报语法错误的要求，因此没有修改。

## 已知限制
- t 单独占第三行，左对齐，右侧两格留空。
- 只测量了 420x860 一种视口。
- 键盘上还没有 t 按键（属于 I2），测试时直接调用 `append('t')`。
- android 副本尚未同步（属于 I5）。

## 下一步
I2（键盘 HTML/CSS 与变量按钮）、I3（自动右滚）、I4（基于 anchors 的触摸定位）。
