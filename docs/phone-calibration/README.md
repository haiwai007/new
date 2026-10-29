# 真机状态栏资料与标定记录

本轮覆盖 100 个型号，现有程序提供 30 种系统参考样式、265 个型号／版本组合。资料发现不等于布局已经核准。

## 本轮结果

| 资料层级 | 型号数 | 含义 |
|---|---:|---|
| 原始尺寸截图候选 | 46 | 文件尺寸与该型号参考分辨率一致，仍需核对系统、缩放和完整状态 |
| 仅缩略图 | 4 | 不用于原生像素标定 |
| 仅评测页面 | 15 | 尚缺可测量截图 |
| 本轮未取得可靠资料 | 35 | 不代表网上没有资料 |
| 完整真机核准 | 0 | 字体、图标、缩放和状态覆盖仍有缺口 |

严格区分 Pro、Mini、Fold、FE、R 等衍生型号，并排除新闻摘要，避免把其他机型资料误计为本机型证据。检索入口出现验证限制后停止检索，没有绕过验证或把失败请求算作完成。`source-inventory.json` 保存发现记录，其 reference 字段表示资料尚未批准用于完整标定。

首批仅对 Pixel 9／Android 14、iPhone 16／iOS 18.0.1、Galaxy S24／One UI 6.1 做样本位置核对。三个准确版本显示“部分核对”，其他版本保持“参考适配”；不会把一个样本推广到整个品牌。iPhone 和 Galaxy 增加了精确版本选项，自动样式跟随已核对版本。

通过实际浏览器渲染测量，三个样本的时钟左边缘、底边和系统图标组右边缘误差均为 0 个原生像素，系统图标组中心误差不超过 0.5 像素。对照使用原生尺寸、指定外框和受控底色，关闭原图字形自动适配以隔离布局参数；并非原截图整图重建。这只证明这些锚点：字体轮廓、整组宽度、原生状态栏高度、完整系统构建／显示缩放以及其他网络、电量状态尚未核准。截图测量裁剪高度不应当作原生状态栏高度。程序继续按用户框选的外框操作。

## 文件

- [逐型号来源表](SOURCES.zh-CN.md)：便于直接查看页面与缺失项。
- `source-inventory.json`：逐型号页面、截图候选、尺寸、哈希及缺失证据。
- `official-sources.json`：官方说明和 AOSP 资源的来源与可用性；品牌门户不构成具体型号的几何证据。
- `native-measurements.json`、`reviewed-samples.json`：三个样本的原生像素测量与来源。
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

测量脚本需要 Pillow；浏览器比较需要项目 Playwright Chromium。完整资料发现脚本为 `collect-sources.mjs`，官方来源检查为 `check-official-sources.mjs`。这些脚本访问公开资料，可能因来源变更或限流得到不同结果；下载已核对样本时必须通过保存的哈希校验，不会静默替换样本。

## 后续验收

每个型号／精确版本分别补齐系统构建、显示缩放、原生截图、字体、图标轮廓及多状态证据，重复实际导出比较，才能改为 calibrated。位置对齐不能代替完整验收。未取得资料的型号继续明确显示待核准；已存在的独立配置可用，但不承诺真机一致。
