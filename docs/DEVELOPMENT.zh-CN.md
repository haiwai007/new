# 开发与维护

[返回首页](../README.md) · [唯一部署指南](DEPLOYMENT.zh-CN.md)

## 环境与常用命令

需要 Node.js 24.x、pnpm 11.25.0。在仓库根目录执行：

```bash
pnpm install --frozen-lockfile --prod=false
pnpm dev
pnpm typecheck
pnpm test:studio
pnpm build:studio
```

默认开发端口 5173，可用 `PORT` 调整。生产产物位于 `artifacts/caishen-studio/dist/public`。

```bash
PORT=4173 pnpm --filter @workspace/caishen-studio serve
node scripts/check-deployment.mjs http://127.0.0.1:4173 --full
```

开发和构建会运行 `scripts/prepare-ocr.mjs`，从固定依赖准备 OCR Worker、WASM、模型和字体许可。不要手动提交生成的 OCR 目录或删除其来源包。

## 目录

```text
artifacts/caishen-studio/
├── src/                 页面、组件、参数、渲染、本地存储与状态管理
├── server/              Cloudflare 内容后台实现
├── public/              图片、来源说明、教学资料及静态路由配置
├── e2e/                 浏览器回归
├── convex/              保留的可选账户与云端备份功能
└── dist/public/         构建产物，不提交
functions/               Pages Functions 的 API 入口
migrations/catalog/     D1 迁移
scripts/                 资源准备、后台本地验证、部署检查及资料维护
docs/guides/             功能细节
docs/phone-calibration/  真机来源、测量、配置覆盖与授权上游资源
docs/app-icons/          APP 图标来源和再生成信息
模版/                    用户原始文件，不自动导入公开目录
```

保留内部历史名称 `caishen-studio` 与旧格式标识，避免破坏文件和数据兼容。新增页面遵循当前目录，不再创建独立的示例应用或重复 API 工程。

## 浏览器验证

安装浏览器后，先构建，再运行生产产物测试：

```bash
pnpm --filter @workspace/caishen-studio exec playwright install chromium
pnpm build:studio
E2E_PRODUCTION=1 pnpm test:e2e
```

默认使用端口 5174，`E2E_PORT` 可覆盖。若系统 Chromium 已安装则自动使用，也可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定路径。测试期间不要覆盖正在被测试的生产产物。

针对变更运行相关用例；涉及入口、依赖和共享组件时，应覆盖模板制作、参数对齐、作图、导出、模板导入、状态栏与备份。

## Cloudflare 后台本地验证

```bash
pnpm build:studio
pnpm test:cms
```

使用实际 Worker 本地运行时、D1 和 R2；测试数据与账号仅存在于本地测试进程，不依赖生产绑定，不向线上投稿。后台页面未启用不代表核心作图不可用。

编译 Pages Functions：

```bash
pnpm exec wrangler pages functions build functions --outdir /tmp/haishen-functions-check
```

## 可选云端代码

账户、云端文档备份和相关测试继续保留。前端公开配置见 [`.env.example`](../artifacts/caishen-studio/.env.example)，未配置时明确显示未启用，不影响本地模式。这里不提供另一套生产部署教程。

`VITE_*` 会进入浏览器产物，不能放入密码或服务密钥。不要把可选账户备份与 Cloudflare 内容后台混为同一数据服务。

## 资料与资源维护

| 脚本／目录 | 作用 |
| --- | --- |
| `scripts/prepare-ocr.mjs` | 准备构建需要的 OCR 与字体资源 |
| `scripts/check-deployment.mjs` | 只读检查路由、资源及 MIME |
| `scripts/create-admin-password.mjs` | 本地生成管理员密码摘要 |
| `scripts/cms-local-server.mjs` | 后台浏览器测试的实际本地运行时 |
| `scripts/*app*`、`*icon*` | 有来源与完整性记录的图标采集、生成及边界测量 |
| `scripts/phone-calibration/` | 资料收集、原始截图测量、覆盖核对和字体构建 |

校准脚本可能依赖本地 Vite、Python 库或临时原始资料，按其文件说明及[校准文档](phone-calibration/README.md)运行。未获许可的原始评测截图、私人字体不能作为产品资源重新发布。

维护原则：

- 检查动态导入、配置入口、测试启动文件和资源准备脚本后，再判断文件是否无用。
- 不删除旧模板迁移、数据库迁移、已公开资源路径或用户原始文件。
- 图标、字体、OCR 与图片的许可、来源及完整性信息必须随资源保留。
- 不将测试记录、构建产物、缓存和真实环境变量提交到 Git。
- 本地验证成功不等于真实设备外观核准，也不能代替生产服务绑定检查。

## 仓库整理记录

本次整理删除独立的示例服务、界面样板、未引用 UI、旧平台配置及重复历史说明；保留运行代码、兼容层、数据迁移、教学资源和资料来源。具体删除范围可查看对应 Git 提交，历史内容可从 Git 恢复。
