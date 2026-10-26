# 海神作图

本地优先的在线作图平台：上传参考图生成可编辑模板，配置图层与参数，自动适配品牌手机状态栏，批量生成图片并下载 ZIP。核心功能无需注册，作品保存在浏览器 IndexedDB。

## 运行与验证

在仓库根目录使用 Node.js 24 和 pnpm 11.25.0：

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test:studio
pnpm build:studio
E2E_PRODUCTION=1 pnpm test:e2e
```

开发默认端口为 5173，生产浏览器回归使用独立的 5174 端口。开发与构建自动准备同源 OCR 资源并校验内置照片。浏览器测试需要 Chromium，安装及环境说明见 [README](README.md)。

本地编辑器不依赖 Express、PostgreSQL、账户或 API 密钥。仓库中的 Express / Drizzle / Orval 目录是保留的示例工程，不是作图平台启动入口。云端账户和备份需要单独配置 Convex 与 OIDC，未配置时显示未启用。

## 代码位置

| 路径 | 内容 |
| --- | --- |
| `artifacts/caishen-studio/src/pages/custom` | 图片上传、模板重建、机型选择与适配预览 |
| `artifacts/caishen-studio/src/pages/editor` | 图层编辑、参数、历史、预览和导出 |
| `artifacts/caishen-studio/src/pages/batch` | 正文参数规则及状态栏随机界面 |
| `artifacts/caishen-studio/src/lib/phone` | 62 个具体型号、品牌系统样式、图片适配及屏幕内容处理 |
| `artifacts/caishen-studio/src/lib/batch` | 可复现的参数与状态栏随机、PNG 渲染和 ZIP 打包 |
| `artifacts/caishen-studio/src/lib/storage` | IndexedDB、保存修订号与素材引用管理 |
| `artifacts/caishen-studio/convex` | 可选云端备份、身份隔离、管理与审计 |
| `scripts/prepare-ocr.mjs` | OCR 静态资源与许可证准备、完整性校验 |

## 当前产品行为

- 导航分为“模板”和“做图”，核心功能无需登录。
- 图片上传提供 OCR 智能重建、原图背景和手动重建三种方式。
- 手机型号按品牌细分，选中后立即切换品牌系统参考状态栏；默认保留当前画布尺寸，支持自动取色与旧状态栏覆盖调整。
- 批量做图每批最多 200 张，可独立随机时间、日期、电量、信号、网络及附加图标；预览与导出使用同一批生成文档，不修改原模板。
- 状态栏支持快手、抖音、微信、QQ 等内置 APP 图标和自定义 PNG / JPEG / WebP；图标可排序、显隐与调整大小，并随模板和备份携带。
- 图片导出只包含屏幕内容，保留状态栏与手势条，不包含机身外壳和硬件开孔。
- 保存冲突会另存副本，备份恢复创建新记录；内部存储键保留兼容，不随产品名称重命名。

## 文档

- [作图设置、型号及 APP 随机指南](docs/BATCH_DRAWING.zh-CN.md)

- [详细部署、维护与回滚手册](docs/DEPLOYMENT.zh-CN.md)

- [项目概念与功能说明](docs/PROJECT_OVERVIEW.zh-CN.md)
- [具体机型与参考样式](docs/PHONE_MODELS.zh-CN.md)
- [验收记录和未完成的线上联调](docs/ACCEPTANCE.md)

状态栏是品牌系统的可编辑参考样式，系统版本和主题可能影响实际外观。真实云端服务尚需配置后联调；本地测试通过不代表已经上线部署。

模板制作不再提供手机设置；单张作图和批量作图负责状态栏。批量支持指定型号随机/均衡分配、固定＋随机 APP 数量区间、逐张重抽和作图预设。添加模式可逆地下移正文并增加高度；预设和候选图标纳入完整备份，素材清理保护其引用。

自然融合：`lib/phone/fusion*` 负责顶部分析、缓存与手动覆盖优先级，`system-styles.ts` 负责可选参考版本，`lib/batch/fusion.ts` 准备批量结果。旧字段缺失时默认为 legacy / fusion off，新 UI 设置 opt in；单张导出与批量归档校验新融合结果准备状态，保留原图模式不重绘。文档见 [STATUS_BAR_FUSION](docs/STATUS_BAR_FUSION.zh-CN.md)。
