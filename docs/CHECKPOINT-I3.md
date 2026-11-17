# CHECKPOINT I3 — 公式显示区自动跟随光标

状态：完成，suite 通过。

## 改动（仅 www/index.html）
- 新增 `window.__ec_autoscroll_enabled = true`（约 1676 行）与 `scrollCursorIntoView(container)`（约 1677-1688 行）：
  - 开关为 false 直接 return。
  - 查 `.cursor-blink`，否则 `.base-missing`；用 getBoundingClientRect 差值 + 当前 scrollLeft 求光标在内容中的左右位置。
  - 光标右侧超出时 `scrollLeft = right - clientWidth + 24`；光标左侧离视口左缘 <24px 时 `scrollLeft = left - 24`（← 退回开头用）。结果夹在 [0, scrollWidth-clientWidth]。
  - 无光标：`scrollLeft = scrollWidth`。
  - 不用 scrollIntoView。
- `renderLatex()`：katex.render 成功后调用 `scrollCursorIntoView(singleDisplay)`（约 1693 行）；catch 分支不滚动。
- 未改：内核段、键盘、updatePlotScreen、KaTeX 配置、CSS。

## 验证
- `%TEMP%\webcasio-test\i3.js`：13/13 PASS（空/短式 sl=0；40 项每 10 项可见；←×80 回开头 sl=0；关开关后 sl 保持 37；重开后跟随；plot 下 line-fx/line-gx 含 .katex；pageErrors=0）。
- 40 项代表值：scrollLeft=1335, scrollWidth=1675, clientWidth=340, 光标右缘=1675.23。
- `node tools\suite.js`：153/153，pageErrors=0。

## 已知限制
- 光标在末尾时，scrollWidth 只到光标右缘，24px 余量会被 max 截断（光标约 0.23px 亚像素裁切）。要真正留 24px 余量需给容器加 padding-right，本任务未改 CSS。
- 未在真机/触摸设备上验证；I4 手势需在拖动期间置 `__ec_autoscroll_enabled=false`。
