# 第三方依赖声明 / Third-Party Notices

本项目在运行时直接包含以下第三方库（位于 `www/`），其各自许可证如下：

This project directly bundles the following third-party libraries (located in `www/`), under their respective licenses:

| 组件 / Component | 版本 / Version | 许可证 / License | 说明 / Notes |
| --- | --- | --- | --- |
| [mathjs](https://github.com/josdejong/mathjs) | 11.8.0 | Apache-2.0 | 计算引擎 / calculation engine，`www/math.min.js` |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 0.16.8 | MIT | LaTeX 公式渲染 / formula rendering，`www/katex.min.js`、`katex.min.css`、`fonts/` |
| [Capacitor](https://github.com/ionic-team/capacitor) | 6.2.0 | MIT | Android 打包框架 / Android packaging framework |

构建过程还会使用 Android Gradle Plugin、AndroidX 等依赖，均遵循其各自的开源许可证。

The build process also uses Android Gradle Plugin, AndroidX, and other dependencies, each under its own open-source license.

Apache-2.0 与 MIT 许可证的完整文本可在上述项目仓库中获取。若你分发、修改或再发布本项目，请保留本声明及对应许可证要求。

The full text of the Apache-2.0 and MIT licenses can be found in the repositories listed above. If you distribute, modify, or re-publish this project, please retain this notice and the corresponding license requirements.
