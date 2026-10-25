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
- 图片导出只包含屏幕内容，保留状态栏与手势条，不包含机身外壳和硬件开孔。
- 保存冲突会另存副本，备份恢复创建新记录；内部存储键保留兼容，不随产品名称重命名。

## 文档

- [项目概念与功能说明](docs/PROJECT_OVERVIEW.zh-CN.md)
- [具体机型与参考样式](docs/PHONE_MODELS.zh-CN.md)
- [验收记录和未完成的线上联调](docs/ACCEPTANCE.md)

状态栏是品牌系统的可编辑参考样式，系统版本和主题可能影响实际外观。真实云端服务尚需配置后联调；本地测试通过不代表已经上线部署。
