# CHECKPOINT-S1

- 状态：基准 1-3 已通过（同时 4-8 与错误输入例也已通过，`node tools\inteq-solver.test.js` 输出 `pass 28 / 28`）。
- 新增文件：`tools\inteq-solver.js`（UMD，纯 ASCII）、`tools\inteq-solver.test.js`。未改动 `www\index.html`、android 目录，无新依赖，无 git 提交。
- 接口：`solveParamLimitIntegral({F, lower, upper, c, xMin, xMax, steps=2000, n=128, tol=1e-12}) -> {ok, roots, residuals, evals, error}`；`integrate(F, lo, hi, x, n=128)`，失败返回 NaN。
- 口径：内层复合 Simpson（同 customInt），外层扫描变号 + Brent（同 index.html 的 brent），根去重阈值 1e-4，安全求值同 safeFnWrap。
- 额外行为：Brent 结果的残差 |G| 超过 1e-6·(1+|c|) 时丢弃（过滤间断点/极点处的假变号）。
- 下一步交接：I4b 用 `math.compile` 把字符串编译成 `F(t,x)`、`lower(x)`、`upper(x)` 后调用。
