# CHECKPOINT-I4 点击定位光标

状态：完成，suite 153/153，pageErrors=0。

## 改动（仅 www/index.html，内核段未动）
- `getDisplayTex`：`renderTex(..., {cursor:true, anchors:true})`；funcs/vars 纯文本前缀保留。
- CSS：`.ec-anchor { display:inline-block; min-width:2px; pointer-events:auto; }`（追加在 `.matrix-cell:focus` 后）。
- 新增 `TAP_MAX_MS=250, TAP_MAX_PX=10`、`tapCursorAt(clientX)`、`bindDisplayTap(el)`；`bindDisplayTap(singleDisplay)` 在 `renderLatex` 后、`updatePlotScreen` 前调用。
- `append`/`deleteLast`/`clearAll`/`switchMode` 首行加 `window.__ec_autoscroll_enabled = true`。
- KaTeX 结构：`id="ec-<path>"` 在外层 span，`.ec-anchor` 在内层 span；所以用 `.ec-anchor` 加 `closest('[id^="ec-"]')` 取 path。
- 空表达式仍有一个 root:0 锚点，所以 `tapCursorAt` 在 `EditorCore.isEmpty` 时直接返回，不调 setCursorPath。
- 只在 main/funcs/vars 模式响应；plot/matrix 下不响应。

## 验证
- `%TEMP%\webcasio-test\i4.js`：16/16（真实鼠标指针事件，Playwright clock 控制 dt；滑动用 CDP touch 事件）。
- 交互：dt100 点 5 个锚点 5/5 命中；dt249 是点击，dt251 不是；位移 9px 是点击，11px 不是；滑动 scrollLeft 1615→1473，光标不变，auto 恢复 true；右侧空白跳到末位；空表达式 setCursorPath 调用 0 次；plot/matrix 调用 0 次。
- i2 pageErrors 0。i3 12/13：用例 `disabled keeps 37` 期望 flag=false 时 append 不滚动，与 I4 要求 append 恢复 true 冲突，属于预期内的行为变更，i3.js 未改。

## 未验证
真机 Android 触摸（WebView 原生滚动与 pointercancel 时序）。
