# 真机状态栏资料与标定记录

本轮覆盖 100 个型号，现有程序提供 30 种系统参考样式、268 个型号／版本组合。资料发现不等于布局已经核准。

## 本轮结果

| 资料层级 | 型号数 | 含义 |
|---|---:|---|
| 原始尺寸截图候选 | 47 | 文件尺寸与该型号参考分辨率一致，仍需核对系统、缩放和完整状态 |
| 仅缩略图 | 4 | 不用于原生像素标定 |
| 仅评测页面 | 16 | 尚缺可测量截图 |
| 本轮未取得可靠资料 | 33 | 不代表网上没有资料 |
| 完整真机核准 | 0 | 字体、图标、缩放和状态覆盖仍有缺口 |

严格区分 Pro、Mini、Fold、FE、R 等衍生型号，并排除新闻摘要，避免把其他机型资料误计为本机型证据。检索入口出现验证限制后停止检索，没有绕过验证或把失败请求算作完成。`source-inventory.json` 保存发现记录，其 reference 字段表示资料尚未批准用于完整标定。

已对 27 个具体型号／版本完成样本位置核对（上轮为 3 个），覆盖 Apple、Google、Samsung、小米、Redmi、荣耀、vivo、一加和 realme。准确记录见[逐版本覆盖表](COVERAGE.zh-CN.md)。每个版本独立保存，其他型号和版本不继承“部分核对”。新增 S24+、S24 Ultra、A55 的 One UI 6.1 独立版本。

本轮展开每篇评测最多六张截图，资料库共取得 258 张原始尺寸候选文件，去重后哈希无跨型号重复。逐张筛选普通界面、锁屏、横屏、运营商文字和固件差异；测量只使用合适场景。仍有 20 个型号虽有原始尺寸候选，但固件／地区不匹配、版本不明确或场景不足，原因记录在 `reference-warnings.json`。另外 33 个型号本轮尚未取得可靠资料；不能据此宣称全网没有资料。

27 个样本实际浏览器渲染的时钟左边缘、底边与系统组右边缘误差均不超过 1 个原生像素，系统组中心误差不超过 1 像素。对照使用原生尺寸、指定外框、受控底色，关闭原图字形自动适配以隔离布局参数，并非原截图整图重建。字体轮廓、整组宽度、原生状态栏高度、精确系统构建／缩放及多状态仍未核准；完整真机核准仍为 0，不能宣布全部完成。裁剪测量高度不应当作原生状态栏高度，程序继续按用户框选的外框操作。

其他实装修正：特定版本的时钟粗细在预览与导出统一；小米 15／15 Pro 的已核对 HyperOS 2 配置在用户选择 12 小时制时省略 AM/PM，24 小时制不受影响；内嵌电池百分比按已填充和未填充区域分别着色，避免自定义配色导致数字隐形。

## 文件

- [逐型号来源表](SOURCES.zh-CN.md)：便于直接查看页面与缺失项。
- [全部版本证据覆盖表](COVERAGE.zh-CN.md)、`coverage-matrix.json`：100 个型号、268 个版本的完整验收缺口。
- `reference-warnings.json`：不能跨版本、跨 ROM 套用的原生截图候选。
- `public-discovery.json`：公开检索入口限流记录；遇到 429 即停止。
- `source-inventory.json`：逐型号页面、截图候选、尺寸、哈希及缺失证据。
- `official-sources.json`：官方说明和 AOSP 资源的来源与可用性；品牌门户不构成具体型号的几何证据。
- `native-measurements.json`、`reviewed-samples.json`：已核对样本的原生像素测量与来源。
- `rendered-before.json`、`rendered-after.json`：实际应用渲染前后误差。knownGaps 明确保留未核准项目。
- `upstream/`：固定版本 AOSP XML，保留原作者与许可证声明。源码中的默认值不能直接视为 OEM 实机值，也没有自动覆盖所有型号。

截图来自公开 Notebookcheck 评测，保留链接与 SHA-256。仓库不转存评测截图，也不提取截图里的设备序列号等标识。截图只下载到本地临时目录供核对。

## 复现

在仓库根目录安装依赖后运行（Node 24；部分网络环境需 `NODE_USE_ENV_PROXY=1`）：

```bash
node scripts/phone-calibration/download-reviewed.mjs
python3 scripts/phone-calibration/measure-screenshots.py /tmp/phone-calibration-reviewed/measurement-input.json /tmp/phone-measurements.json
PORT=5194 BASE_PATH=/ pnpm --filter @workspace/caishen-studio dev
# 在另一个终端运行，输入为上一步的测量 JSON；截图保留在临时目录
node scripts/phone-calibration/compare-rendered.mjs /tmp/phone-measurements.json /tmp/phone-rendered.json
```

测量脚本需要 Pillow，核对 SHA-256、原始尺寸及选区边界，支持去除壁纸孤立小点；浏览器比较需要项目 Playwright Chromium。完整资料发现脚本为 `PHONE_RESEARCH_SKIP_SEARCH=1 PHONE_RESEARCH_IMAGES=6 node scripts/phone-calibration/collect-sources.mjs`，官方来源检查为 `check-official-sources.mjs`。这些脚本访问公开资料，可能因来源变更或限流得到不同结果；下载已核对样本时必须通过保存的哈希校验，不会静默替换样本。

## 完整验收的实际阻塞

每个型号／精确版本分别补齐系统构建、显示缩放、原生截图、字体、图标轮廓及多状态证据，重复实际导出比较，才能改为 calibrated。位置对齐不能代替完整验收。未取得资料的型号继续明确显示待核准；已存在的独立配置可用，但不承诺真机一致。


同型号不同系统、国行与海外 ROM 不能混用。例如 OnePlus 12 的 OxygenOS 14 不能核准国行 ColorOS 14，iPhone 14 的 iOS 16 不能核准 iOS 18。完成剩余验收需要对应版本的原始截图、系统构建与显示缩放、不同网络／电量／主题状态，以及可合法使用并核对的字体／图标资源。缺少这些材料时继续调数字不能证明真实一致。

离线完整性检查与覆盖表重建：

```bash
node --test scripts/phone-calibration/model-match.test.mjs
python3 scripts/phone-calibration/measure-screenshots.test.py
node scripts/phone-calibration/audit-coverage.mjs
```
