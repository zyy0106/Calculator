# Calculator

![License](https://img.shields.io/badge/license-MIT-blue.svg)

**Calculator** 是一个**离线可用、开箱即用**的科学计算器 Web 应用：支持变量存储、函数编辑、定积分与导数、双函数绘图、实根求解以及线性/对数回归拟合。网页端纯静态、无任何 CDN 依赖，并可通过 Capacitor 打包成 Android APK。

**Calculator** is an offline-first, out-of-the-box scientific calculator web app with variables, f(x)/g(x) editing, definite integrals and derivatives, dual-function graphing, root finding, and linear/log regression fitting. The web app is fully static with no CDN dependencies and can be packaged as an Android APK via Capacitor.

> 在线体验 / Live demo: [https://zyy0106.github.io/Calculator/](https://zyy0106.github.io/Calculator/)

## 功能特性 / Features

| 中文 | English |
| --- | --- |
| 四则运算、幂与科学计数法、根式、分数、三角函数、lg/ln、π、e、Ans 记忆 | Arithmetic, powers and scientific notation, roots, fractions, trigonometry, lg/ln, π, e, Ans memory |
| 变量 a / b / c / x / y / z 保存与调用 | Store and recall variables a / b / c / x / y / z |
| 编辑 f(x)、g(x)，供绘图与求根使用 | Edit f(x) and g(x) for graphing and root finding |
| 定积分（Simpson 数值积分）、导数（符号求导，自动数值兜底） | Definite integrals (Simpson's rule) and derivatives (symbolic with numeric fallback) |
| 双函数绘图：缩放、平移、逐点追踪 | Plot two functions with zoom, pan, and point tracing |
| 自动扫描区间并用 Brent 法求实根 | Automatic interval scanning with Brent's method for real roots |
| 线性回归与 Log₁₀ 对数回归，显示斜率、截距与 r | Linear and Log₁₀ regression with slope, intercept, and r |
| 数学模板槽位输入、KaTeX 实时渲染、物理键盘支持 | Math template slot input, live KaTeX rendering, physical keyboard support |
| 全离线，断网可用 | Fully offline, works without a network |

## 快速开始 / Quick Start

### 浏览器中使用 / Use in browser

直接打开 `www/index.html`，或用任意静态服务器 / Open `www/index.html` directly, or serve it with any static server:

```bash
# Node
npx serve www

# 或 Python / or Python
python -m http.server 8000 --directory www
```

### Android 安装 / Install on Android

前往 [Releases](https://github.com/zyy0106/Calculator/releases) 下载 `Calculator-debug.apk` 并安装（Android 需要允许安装未知来源应用）。

Download `Calculator-debug.apk` from [Releases](https://github.com/zyy0106/Calculator/releases) and install it (allow installing from unknown sources on Android).

## 从源码构建 APK / Build APK from source

环境要求 / Requirements: Node.js 18+, JDK 17, Android SDK (compileSdk 34)。

```bash
npm ci
npx cap sync android
cd android
./gradlew assembleDebug
```

APK 输出位置 / Output: `android/app/build/outputs/apk/debug/app-debug.apk`。

Windows 下一键脚本 / One-click script on Windows:

```powershell
.\build_apk.ps1
```

输出 / Output: `Calculator-debug.apk`

## 项目结构 / Project Structure

```text
calculator/
├── www/                 # 网页应用源码（唯一业务代码）/ web app source (only business code)
│   ├── index.html       # 全部界面与计算逻辑 / UI and calculation logic
│   ├── math.min.js      # mathjs 运行时（vendored）/ mathjs runtime (vendored)
│   ├── katex.min.js     # KaTeX 运行时（vendored）/ KaTeX runtime (vendored)
│   └── fonts/           # KaTeX 字体 / KaTeX fonts
├── android/             # Capacitor 生成的 Android 工程 / Capacitor Android project
├── docs/                # 文档 / documentation
├── .github/workflows/   # Pages 部署与 APK 构建 / Pages deployment and APK build
├── capacitor.config.json
├── package.json
└── build_apk.ps1        # Windows 一键构建脚本 / Windows build script
```

## 技术栈 / Tech Stack

- [mathjs](https://mathjs.org/) 11.x：计算引擎 / calculation engine
- [KaTeX](https://katex.org/) 0.16.x：公式渲染 / formula rendering
- [Capacitor](https://capacitorjs.com/) 6.x：Android 打包 / Android packaging
- 原生 HTML / CSS / JavaScript，无框架依赖 / vanilla HTML / CSS / JavaScript, no framework

## 贡献者 / Contributors

- [zyy0106](https://github.com/zyy0106)

## 参与贡献 / Contributing

欢迎提交 Issue 和 Pull Request。请保持 `www/index.html` 为单文件结构，并在提交前说明改动影响的功能。

Issues and pull requests are welcome. Keep `www/index.html` as a single-file structure and describe the affected features before submitting.

## 许可证 / License

MIT License，详见 / see [LICENSE](LICENSE)。第三方库许可证见 / third-party licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 免责声明 / Disclaimer

本项目仅用于学习与个人使用，与卡西欧（CASIO）公司无任何关联，也不对其计算结果作任何保证。

This project is for learning and personal use only. It is not affiliated with CASIO and provides no warranty for calculation results.
