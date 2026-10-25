# 海神作图：详细部署与运维指南

更新日期：2026-10-25。业务代码基线：`63acf4a`；实际发布版本请用 `git rev-parse HEAD` 记录。

本文面向第一次部署的使用者，也提供更新、回滚和故障排查步骤。先读第 1–5 章，再选择一种托管方式；只有确实需要账户和云端备份时，才执行云端配置。

**把代码推送到 GitHub，不等于网站已经发布。** 仓库已有的 GitHub Actions 用于验证代码，不会替你创建站点、绑定域名、配置 OIDC 或发布 Convex。本文附带的示例配置也不会自动启用这些服务。

## 目录

1. [部署目标和架构](#1-部署目标和架构)
2. [部署前准备](#2-部署前准备)
3. [安装与本地验证](#3-安装与本地验证)
4. [环境变量与配置位置](#4-环境变量与配置位置)
5. [生成正确的静态产物](#5-生成正确的静态产物)
6. [Netlify 部署](#6-netlify-部署)
7. [Cloudflare Pages 部署](#7-cloudflare-pages-部署)
8. [Vercel 部署](#8-vercel-部署)
9. [Docker 与 Nginx 部署](#9-docker-与-nginx-部署)
10. [自有 Linux 服务器部署](#10-自有-linux-服务器部署)
11. [可选 Convex 与 OIDC](#11-可选-convex-与-oidc)
12. [域名、HTTPS、路由和缓存](#12-域名https路由和缓存)
13. [发布后验收](#13-发布后验收)
14. [更新发布与回滚](#14-更新发布与回滚)
15. [域名迁移与数据备份](#15-域名迁移与数据备份)
16. [故障排查](#16-故障排查)
17. [日常维护](#17-日常维护)
18. [验证范围、发布清单与参考资料](#18-验证范围发布清单与参考资料)

## 1. 部署目标和架构

### 1.1 默认选择：本地模式静态站点

这是最简单的可用方案，包含：

- 上传图片、OCR、模板重建、图层与参数编辑。
- 62 个机型参考、状态栏配色与图片适配。
- 28 种 APP 图标和自定义图标上传。
- 参数批量生成、状态栏随机、PNG / JPEG 与 ZIP 下载。
- 本地作品、历史版本、模板文件和完整备份。

浏览器负责运行编辑器、OCR 和渲染，IndexedDB 保存作品与图片。服务器只提供静态文件。

```text
浏览器 ── HTTPS ── 静态托管 / Nginx
  │                    ├─ index.html、JS、CSS、字体
  ├─ IndexedDB          ├─ OCR Worker、WASM、模型
  ├─ OCR 与图片渲染      └─ 内置图片、许可证与来源说明
  └─ 文件下载
```

**本地模式不需要** PostgreSQL、Express 服务、Redis、账号系统、支付服务或 AI API 密钥。仓库中的 `artifacts/api-server`、`lib/db`、`lib/api-spec` 是保留的示例工程，不是当前作图平台的生产入口。

### 1.2 可选选择：静态前端 + 云端备份

在静态站点基础上增加：

- OIDC 身份服务：负责登录、令牌和退出。
- Convex：负责账户隔离、作品文件备份、版本检查、配额、审计与管理后台。

云端功能是**手动备份和恢复**，不是设备间后台自动合并。没有配置时，页面显示“云端服务未启用”，本地功能继续可用。

### 1.3 部署方式怎么选

| 方案 | 适合情况 | 需要自己管理什么 |
| --- | --- | --- |
| Netlify | 想用 GitHub 自动构建，操作较少 | 构建设置、域名、公开构建变量 |
| Cloudflare Pages | 已使用 Cloudflare 域名或 CDN | 构建设置、域名、缓存规则 |
| Vercel | 已有 Vercel 项目 | 仓库根目录、输出目录、SPA 路由 |
| Docker + 反向代理 | 已有容器服务器或运维平台 | 镜像、容器、HTTPS、日志与更新 |
| Linux + Nginx | 希望完全掌握发布目录和回滚 | 系统、证书、Nginx、磁盘、备份与发布 |

只选择其中一种前端发布路线，**不用全部执行**。

### 1.4 当前不建议直接使用的路线

- 不要把 `pnpm dev` 或 `vite preview` 当作公网生产服务。
- 不要直接把仓库源码目录作为网站根目录。
- 不要只上传 `index.html`。
- 当前经过验证的是域名根路径 `/`。默认 GitHub Pages 项目地址 `/new/` 不是可直接套用的发布方式：`BASE_PATH` 只影响构建资源，当前 `BrowserRouter` 没有配置 `basename`，部分链接和回调也是根路径。需要子目录时应单独改造并回归路由、OCR、静态资源与登录。

## 2. 部署前准备

### 2.1 需要的信息

| 项目 | 本地模式 | 云端模式 |
| --- | --- | --- |
| GitHub 仓库访问权 | 需要 | 需要 |
| 静态托管账号或服务器 | 需要 | 需要 |
| 正式域名 | 建议尽早确定 | 强烈建议先确定 |
| HTTPS | 公网正式发布需要 | 需要 |
| Convex 项目与生产部署 | 不需要 | 需要 |
| Hercules 兼容 OIDC 应用 | 不需要 | 需要 |
| PostgreSQL 连接串 | 不需要 | 本项目的云端方案也不需要 |

本文使用 `design.example.com`、`example-deployment.convex.cloud` 等示例。替换为你自己的地址，不能直接照填。

### 2.2 构建环境

仓库声明：

- Node.js：**24.x**，`engines` 为 `>=24 <25`。
- pnpm：**11.25.0**，根 `package.json` 已声明 `packageManager`。
- 操作系统：推荐 **Linux x86_64**。

`pnpm-workspace.yaml` 针对 Linux x64 排除了其他平台的部分原生可选包。Windows 原生、macOS 原生和 Linux ARM 构建没有作为当前交付验证环境。Windows 建议使用 x64 WSL2；Apple Silicon 可使用 Docker 的 `linux/amd64` 构建。网站访问本身不要求用户使用 Linux。

准备磁盘空间时要同时考虑源码、`node_modules`、构建产物、Docker 镜像及历史版本。小型构建机建议至少预留数 GB，构建内存不足时优先增加构建资源，而不是删掉字体或 OCR 文件。

### 2.3 拉取代码

```bash
git clone https://github.com/haiwai007/new.git
cd new
git checkout main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
```

私有仓库需要通过 GitHub 正常授权。不要把访问令牌写进仓库地址、README 或公开构建日志。

已有工作目录不要直接覆盖自己的修改。先查看 `git status`；只在干净、明确的版本上生成正式发布产物。

### 2.4 安装工具

先通过可信的 Node.js 安装方式取得 Node.js 24，再检查：

```bash
node --version
npm --version
corepack --version
```

如果提供 Corepack：

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm --version
```

如果 Node.js 发行包没有附带 Corepack，也可以安装固定版本的 pnpm：

```bash
npm install --global pnpm@11.25.0
pnpm --version
```

全局安装是否需要系统权限取决于你的 Node 安装方式。不要为此关闭 TLS 或包校验。

### 2.5 构建期间需要访问的资源

- GitHub：拉取代码。
- npm 包注册表：按锁文件安装依赖。
- Docker 官方镜像仓库：只有使用 Docker 时需要。
- Playwright 浏览器下载源：仅在构建机执行浏览器测试且没有 Chromium 时需要。

内置照片已经在仓库中；字体、OCR 引擎和中英文模型来自锁文件固定的 npm 包。正常构建不需要从第三方图片 CDN 临时拉取站点照片。

## 3. 安装与本地验证

### 3.1 所有命令从仓库根目录开始

```bash
pnpm install --frozen-lockfile --prod=false
```

`--prod=false` 是有意保留的：当前应用的 Vite、React、字体、OCR 模型及多项构建依赖位于 `devDependencies`，构建前不能只安装生产依赖。构建完成后，静态服务器不需要 `node_modules`。

不要改用 `npm install` 生成另一份锁文件；根 `preinstall` 也会要求使用 pnpm。

安装失败时保留错误原文，核对 Node / pnpm 版本、网络、锁文件和包发布时间限制。不要用关闭 SSL 校验、删除完整性校验或随意更新锁文件来掩盖安装问题。

### 3.2 开发检查

```bash
pnpm dev
```

默认端口 `5173`。这是开发服务，用于本机检查，不作为公网托管方案。

第一次启动会执行 `scripts/prepare-ocr.mjs`，复制 OCR 引擎、语言模型和字体许可证，并验证内置图片完整性。生成的 `public/ocr` 和 `public/licenses` 不需要手工上传进 GitHub，但必须出现在最终构建产物中。

### 3.3 发布前代码验证

```bash
pnpm typecheck
pnpm exec tsc -p artifacts/caishen-studio/convex/tsconfig.json --noEmit
pnpm test:studio
pnpm build:studio
```

最近业务代码验收为 32 个测试文件、213 项测试。实际数量以当前提交的执行结果为准，不应只检查进程退出码而忽略测试是否真的运行。

### 3.4 浏览器回归

没有 Chromium 时先安装：

```bash
pnpm --filter @workspace/caishen-studio exec playwright install chromium
```

Linux CI 如需一起安装系统库，可使用有系统安装权限的环境执行：

```bash
pnpm --filter @workspace/caishen-studio exec playwright install --with-deps chromium
```

然后执行：

```bash
E2E_PRODUCTION=1 pnpm test:e2e
```

此命令启动独立的 5174 端口，检查已经生成的生产产物。当前有 14 项浏览器工作流，包括真实 OCR、备份恢复、状态栏、APP 图标、自定义上传和 ZIP 导出。

**本地模式回归应使用不含云端配置的构建。** Playwright 服务器启动时清空云端变量，不会撤销已编译进 JS 的 `VITE_*` 值。不要拿已经嵌入生产账号配置的产物去跑“本地模式”验收；可使用干净构建环境，或在构建时明确将三个必填云端变量设为空。

## 4. 环境变量与配置位置

### 4.1 变量分四类

| 变量 | 放在哪里 | 作用 / 默认值 |
| --- | --- | --- |
| `PORT` | 开发 / 预览进程环境 | Vite 端口，默认 5173；不是静态生产站点的服务端口 |
| `BASE_PATH` | 构建环境 | 默认 `/`；本指南要求保持 `/` |
| `VITE_CONVEX_URL` | 前端构建环境 | Convex 的 HTTPS 客户端部署地址 |
| `VITE_HERCULES_OIDC_AUTHORITY` | 前端构建环境 | OIDC issuer / authority 的 HTTPS 地址 |
| `VITE_HERCULES_OIDC_CLIENT_ID` | 前端构建环境 | OIDC 公共客户端标识，不是 secret |
| `VITE_HERCULES_OIDC_REDIRECT_URI` | 前端构建环境，可省略 | 默认当前站点 origin + `/auth/callback` |
| `VITE_HERCULES_OIDC_SCOPE` | 前端构建环境，可省略 | 默认 `openid profile email offline_access` |
| `VITE_HERCULES_OIDC_RESPONSE_TYPE` | 前端构建环境，可省略 | 默认 `code` |
| `VITE_HERCULES_OIDC_PROMPT` | 前端构建环境，可省略 | 默认 `select_account` |
| `HERCULES_OIDC_AUTHORITY` | Convex 服务端环境 | 供后端校验 issuer，需匹配身份提供方 |
| `HERCULES_OIDC_CLIENT_ID` | Convex 服务端环境 | 供后端校验 ID token audience |
| `ADMIN_TOKEN_IDENTIFIERS` | Convex 服务端环境 | 允许进入后台的完整身份标识，逗号分隔；默认空值不授权管理员 |
| `CONVEX_DEPLOY_KEY` | 后端部署机器的秘密环境 | 非交互发布 Convex 时使用；不放进前端构建变量 |
| `CONVEX_DEPLOYMENT` | Convex CLI 本地配置 | 选择开发部署；由 CLI 正常生成和管理 |

### 4.2 本地模式应该怎么设置

不需要复制 `.env.example`，也不需要填任何假地址。保持三个必填 `VITE_*` 云端变量未配置即可。

如果托管平台或旧构建环境已经保存了这些变量，删除相应配置后重新构建。三个必填值必须全部有效才启用云端，URL 当前要求 HTTPS。

本地运行 Vite 时，环境文件位于 `artifacts/caishen-studio`，因为这里是 Vite 的 `root`。例如 `artifacts/caishen-studio/.env.local`，不是默认放在仓库根目录。

`.env.local`、`.env.production` 等真实配置被 Git 忽略。不要把实际秘密复制到 `.env.example`。

### 4.3 构建时变量不等于运行时变量

`VITE_*` 会在 `pnpm build:studio` 时被写进浏览器 JS。改完平台变量后必须重新构建和发布。

对于 Docker，容器内只有 Nginx。执行 `docker run -e VITE_CONVEX_URL=...` **不会**修改已经构建好的页面；应该重新构建镜像并传入公开 build args。

非 `VITE_*` 的 Convex 服务端变量需要在 Convex 的对应部署中设置，不是放进静态托管环境就能生效。

### 4.4 可选变量不要随意设为空字符串

代码对可选 OIDC 配置使用默认值回退。未使用时直接省略变量；空字符串可能覆盖默认回调或 scope，造成登录失败。

任何 `VITE_*` 都应按公开信息处理。OIDC client secret、数据库密码、GitHub token、Convex deploy key 不能通过 `VITE_` 暴露。

## 5. 生成正确的静态产物

### 5.1 构建

本地模式可使用：

```bash
VITE_CONVEX_URL= VITE_HERCULES_OIDC_AUTHORITY= VITE_HERCULES_OIDC_CLIENT_ID= BASE_PATH=/ pnpm build:studio
```

正式云端模式则使用实际的三个公开配置，见第 11 章。

不要把根目录 `pnpm build` 当成唯一部署入口，它会构建仓库中的其他示例工程。发布作图平台使用 `pnpm build:studio`。

### 5.2 输出位置

```text
artifacts/caishen-studio/dist/public/
├── index.html
├── assets/          JS、CSS、字体等构建资源
├── ocr/             Worker、WASM、语言模型、清单和许可证
├── templates/       内置照片及其来源说明
├── licenses/        从依赖准备的字体等许可证
├── attributions/    APP 图标来源与许可证
├── favicon.svg
├── robots.txt
├── _headers         支持此格式的平台使用
└── _redirects       支持此格式的平台使用
```

**网站根目录应直接看到 `index.html`。** 如果上传后网址要变成 `/dist/public/index.html` 才能打开，说明发布目录层级错误。

本次检查的构建产物约 84 MiB、约 1962 个文件，最大单文件约 3.9 MB。主要体积是字体和 OCR；数字会随版本变化。完整产物体积不等于首页一次下载量。平台的单文件、总文件数和带宽限额以当前套餐为准。

### 5.3 本地预览产物

```bash
PORT=4173 pnpm --filter @workspace/caishen-studio serve
```

然后可在另一终端运行 HTTP 检查：

```bash
node scripts/check-deployment.mjs http://127.0.0.1:4173
```

预览进程仍不是公网生产服务器。该脚本检查资源与路由，不会自动进行登录或保存浏览器数据。

### 5.4 打包手工上传

在仓库根目录执行：

```bash
tar -C artifacts/caishen-studio/dist/public -czf haishen-static.tar.gz .
```

解压后应直接得到 `index.html`、`assets` 等，而不是再套一层项目目录。完整保留 `ocr`、字体、照片、许可证和来源说明。

## 6. Netlify 部署

### 6.1 通过 GitHub 导入

1. 登录 Netlify，选择从 Git 仓库创建站点。
2. 授权访问 `haiwai007/new`，选择生产分支 `main`。
3. 构建基础目录使用仓库根目录，不要切到 `artifacts/caishen-studio` 后又运行根目录脚本。
4. 填写构建设置：

| 设置 | 值 |
| --- | --- |
| Base directory | `.` 或保持仓库根目录 |
| Build command | `pnpm build:studio` |
| Publish directory | `artifacts/caishen-studio/dist/public` |
| Node version | `24` |
| pnpm version | `11.25.0` |

环境变量建议：

```text
NODE_VERSION=24
PNPM_VERSION=11.25.0
PNPM_FLAGS=--frozen-lockfile --prod=false
BASE_PATH=/
```

本地模式不填写三个云端变量。让平台正常执行依赖安装，检查构建日志实际使用了固定 pnpm 版本并安装了开发依赖。

### 6.2 使用仓库配置模板

可把 [Netlify 示例](../deploy/netlify.example.toml) 复制到仓库根目录：

```bash
cp deploy/netlify.example.toml netlify.toml
```

检查无误后自行提交该配置。示例文件放在 `deploy/` 中时不会自动激活，不会擅自改变你已有站点的部署策略。

平台会从发布目录读取已有 `_redirects` 和 `_headers`。它们分别提供 SPA 回退与基本响应头；不要以为它们能自动替你配置所有 CDN 缓存或所有托管服务。

### 6.3 首次发布与域名

1. 创建部署，等依赖安装、资源准备和 Vite 构建全部结束。
2. 检查发布目录中的文件数量，而不是仅看构建命令是否运行过。
3. 在平台临时域名上执行第 13 章验收。
4. 添加正式域名，按 Netlify 当前提示设置 DNS。
5. 等 HTTPS 证书生效后，再使用正式域名验收。
6. 后续如启用 OIDC，把正式域名的回调加入身份服务配置。

不要在临时域名积累大量作品后才随意换域名；本地作品按 origin 隔离，迁移方法见第 15 章。

### 6.4 手工拖拽发布

如果不使用 Git 自动构建，先在可信的 Linux x64 环境构建，再上传 `dist/public` 的内容。平台收到的是已经编译的文件，此时修改站点环境变量不能改变包内的云端地址。

发布后保留对应的源码提交、构建配置和产物归档，以便回滚。

## 7. Cloudflare Pages 部署

### 7.1 创建项目

1. 登录 Cloudflare，进入 Workers & Pages，创建 Pages 项目。
2. 连接 GitHub 仓库，生产分支选 `main`。
3. 根目录保持仓库根目录。
4. Framework preset 可选 `None`；构建命令和输出路径手工指定。

| 设置 | 值 |
| --- | --- |
| Build command | `pnpm build:studio` |
| Build output directory | `artifacts/caishen-studio/dist/public` |
| Root directory | 仓库根目录 |
| `NODE_VERSION` | `24` |
| `PNPM_VERSION` | `11.25.0` |
| `BASE_PATH` | `/` |

观察实际构建日志：不要因为填了 `PNPM_VERSION` 就假设平台确实使用该版本。

### 7.2 平台自动安装版本不正确时

如果当前 Pages 构建镜像的自动依赖安装不能按仓库声明执行，可在平台支持的情况下设置：

```text
SKIP_DEPENDENCY_INSTALL=1
NODE_VERSION=24
BASE_PATH=/
```

把构建命令改为：

```bash
npx --yes pnpm@11.25.0 install --frozen-lockfile --prod=false && npx --yes pnpm@11.25.0 build:studio
```

这是一个替代方案，不要同时保留失效的自动安装和重复手动安装。环境变量名称及构建镜像选项应以 Cloudflare 当前控制台和官方文档为准；如果配置未生效，先查构建日志。

### 7.3 路由与资源

发布目录里的 `_redirects` 会提供根路径 SPA 回退。检查：

- 直接打开 `/works` 和 `/editor/有效作品编号` 后刷新。
- `/ocr/worker.min.js` 返回 JavaScript。
- `.wasm` 返回 `application/wasm`。
- 模型 `.traineddata.gz` 返回实际压缩文件字节。

已有文件通常优先于 SPA 回退，但缺失的静态文件可能被宽泛的回退规则转成 HTML。发布完整文件并检查 MIME；不要把“返回 200”当作文件正确。

### 7.4 自定义域名与缓存

在 Pages 的 Custom domains 中绑定域名，再按提示处理 DNS 和证书。不要随意给整个站点配置“所有内容缓存很久”的规则，否则旧 HTML 可能继续指向已删除的 JS 文件。

建议区分：入口 HTML 短缓存 / 重新验证、带哈希的 `assets` 长缓存、没有版本目录的 OCR 和模板资源短缓存。新增缓存规则后，重新执行真实 OCR 和导出检查。

### 7.5 Workers Static Assets 与 Pages 的区别

本指南对应 Pages 构建项目，不是直接运行 Vite 开发进程的 Worker。如果选择 Workers Static Assets，需要单独设置资源目录与 SPA 行为；不要把 Pages 的控制台字段原样当作 `wrangler` 配置。

## 8. Vercel 部署

### 8.1 导入与构建参数

1. 从 GitHub 导入仓库，生产分支选 `main`。
2. Root Directory 保持仓库根目录。
3. Framework Preset 可选 `Other`，明确覆盖安装、构建及输出设置。
4. Node.js Version 选择 24.x，或核对项目的 `engines` 已被平台识别。

| 设置 | 值 |
| --- | --- |
| Install Command | `pnpm install --frozen-lockfile --prod=false` |
| Build Command | `pnpm build:studio` |
| Output Directory | `artifacts/caishen-studio/dist/public` |

本地模式不配置云端变量；云端模式的公开值填到 Production 构建环境。Preview 与 Production 配置通常独立，不要把生产身份服务随意开放给任意预览域名。

### 8.2 启用 SPA 配置示例

复制 [Vercel 示例](../deploy/vercel.example.json)：

```bash
cp deploy/vercel.example.json vercel.json
```

示例采用 `routes`：先对 `/templates` 页面作精确处理，再尝试真实文件，再对静态目录中的缺失文件返回 404，最后将应用页面路由内部交给 `index.html`。安全响应头也在 `routes` 中设置，避免混用互斥的旧路由与高级 `headers` / `rewrites` 配置。

不要在同一个文件里再随意追加另一套路由规则。如果项目已经有 Vercel 配置，人工合并后在预览部署中验证。

### 8.3 发布后检查

- `/` 和 `/works` 能正常打开。
- `/auth/callback` 由同一应用处理，原 query 未被外部跳转丢弃。
- 静态 JS 和 OCR 文件没有被误重写。
- 绑定正式域名并确认证书。
- 环境变量修改后触发新的生产构建。

Vercel 不读取 Netlify 的 `_headers` / `_redirects` 作为等效配置；以本平台规则为准。

## 9. Docker 与 Nginx 部署

### 9.1 仓库提供什么

- [Dockerfile](../deploy/Dockerfile)：Node 24 构建阶段 + Nginx 静态运行阶段。
- [Nginx 配置](../deploy/nginx.conf)：SPA 回退、真实静态文件 404、WASM MIME、模型压缩规则、缓存与基本响应头。
- [`.dockerignore`](../.dockerignore)：排除本地依赖、生成目录、环境文件和 Git 历史。

最终镜像只有 Nginx 与完整静态站点，不运行 Node 应用服务器，也不包含浏览器的 IndexedDB 数据。

### 9.2 构建本地模式镜像

在仓库根目录：

```bash
docker build \
  --platform linux/amd64 \
  -f deploy/Dockerfile \
  --build-arg VCS_REF="$(git rev-parse HEAD)" \
  -t haishen-studio:local \
  .
```

首次需要拉取官方 Node / Nginx 镜像并安装 npm 依赖，耗时取决于网络。没有为了加速关闭包完整性或 TLS 校验。

示例基础镜像使用官方版本标签，便于取得维护更新。需要严格复现供应链的团队，应在确认镜像后固定其 digest，并记录业务提交、构建变量、镜像 ID 与基础镜像 digest。

### 9.3 启动检查容器

```bash
docker run -d \
  --name haishen-studio-test \
  -p 127.0.0.1:8080:80 \
  haishen-studio:local

docker logs haishen-studio-test
docker exec haishen-studio-test nginx -t
node scripts/check-deployment.mjs http://127.0.0.1:8080 --full
```

端口绑定 `127.0.0.1` 是本机验收方式，不会替你向公网开放网站。健康检查会检查 `index.html`，但它不等于已经完成 OCR、编辑与权限验收。

查看健康状态：

```bash
docker inspect haishen-studio-test --format '{{.State.Health.Status}}'
```

不要重复使用一个已经被其他容器占用的名字。测试完成后只移除你自己创建的容器：

```bash
docker stop haishen-studio-test
docker rm haishen-studio-test
```

### 9.4 正式运行

正式容器可增加重启策略，并绑定到内网端口：

```bash
docker run -d \
  --name haishen-studio \
  --restart unless-stopped \
  -p 127.0.0.1:8080:80 \
  haishen-studio:你的发布标签
```

公网 HTTPS 由外层 Nginx、Caddy、负载均衡或容器平台提供，反向代理到 `127.0.0.1:8080`。本镜像只监听 HTTP 80，不包含 TLS 证书签发逻辑。

如果外层同样使用 Nginx，HTTPS server 中的代理核心配置为：

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

证书配置、域名和 443 监听由外层维护。不要把示例片段当作完整的 HTTPS server。

### 9.5 构建云端模式镜像

三个值都只是公开配置，不是 secret：

```bash
docker build \
  --platform linux/amd64 \
  -f deploy/Dockerfile \
  --build-arg VITE_CONVEX_URL=https://example-deployment.convex.cloud \
  --build-arg VITE_HERCULES_OIDC_AUTHORITY=https://auth.example.com \
  --build-arg VITE_HERCULES_OIDC_CLIENT_ID=your-public-client-id \
  --build-arg VCS_REF="$(git rev-parse HEAD)" \
  -t haishen-studio:cloud-release \
  .
```

该 Dockerfile 使用默认根路径回调和默认 OIDC scope。需要覆盖可选 OIDC 配置时，明确扩展构建阶段的公开参数，并避免将未使用的可选值设为空串。不要将 `CONVEX_DEPLOY_KEY` 或 client secret 作为 build arg 传入。

### 9.6 镜像更新

先为新版本构建新的标签，不要直接覆盖唯一的回滚镜像。推荐先在另一个本机端口验证新容器，再切换外层代理，最后停止旧容器。这样回滚只需把代理改回旧端口。

将镜像推送到私有镜像仓库是另一个操作，需要你自己的授权和仓库配置；本文不会自动执行推送。

## 10. 自有 Linux 服务器部署

下面以 Debian / Ubuntu、普通 x86_64 服务器为例。没有服务器运维经验可优先使用静态托管。

### 10.1 安装 Nginx 与准备目录

在自己的服务器执行：

```bash
sudo apt update
sudo apt install nginx rsync ca-certificates
sudo install -d -m 755 /srv/haishen/releases
```

构建可以在另一台可信的构建机完成，生产静态服务器无需安装 Node / pnpm。把完整产物通过你的受保护传输方式送到服务器。

### 10.2 版本目录与原子切换

建议结构：

```text
/srv/haishen/
├── releases/
│   ├── 20261025T120000Z-abcdef0/
│   └── 20261026T120000Z-1234567/
└── current -> /srv/haishen/releases/20261026T120000Z-1234567/
```

如果在服务器上的源码目录构建，发布命令示例：

```bash
HAISHEN_RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
HAISHEN_RELEASE_DIR="/srv/haishen/releases/$HAISHEN_RELEASE_ID"
sudo install -d -m 755 "$HAISHEN_RELEASE_DIR"
sudo cp -a artifacts/caishen-studio/dist/public/. "$HAISHEN_RELEASE_DIR/"
sudo find "$HAISHEN_RELEASE_DIR" -type d -exec chmod 755 {} +
sudo find "$HAISHEN_RELEASE_DIR" -type f -exec chmod 644 {} +
sudo ln -s "$HAISHEN_RELEASE_DIR" "/srv/haishen/current-next-$HAISHEN_RELEASE_ID"
sudo mv -Tf "/srv/haishen/current-next-$HAISHEN_RELEASE_ID" /srv/haishen/current
```

这要求 `current` 不存在或原本是符号链接。若它已经是一个真实目录，先人工检查现有部署，不能直接套用目录替换。

不建议在用户访问期间原地删除整个站点目录再逐个复制文件，否则新旧资源可能短暂混合。

### 10.3 配置 Nginx

将仓库模板复制为一个独立站点配置：

```bash
sudo install -m 644 deploy/nginx.conf /etc/nginx/sites-available/haishen
```

编辑该文件，将：

```nginx
server_name _;
root /usr/share/nginx/html;
```

改为：

```nginx
server_name design.example.com;
root /srv/haishen/current;
```

保留模板中的路由、WASM、模型及缓存规则。然后启用：

```bash
sudo ln -s /etc/nginx/sites-available/haishen /etc/nginx/sites-enabled/haishen
sudo nginx -t
sudo systemctl reload nginx
```

如果链接已经存在，不要重复创建。如果服务器还有其他站点，保留其配置，不要盲目删除所有默认文件。检查是否存在相同 `server_name` 或端口冲突。

### 10.4 DNS 和 HTTPS

1. 将正式域名的 A 记录指向服务器 IPv4。
2. 只有服务器确实提供 IPv6 时才配置 AAAA；错误 AAAA 会让部分用户访问失败。
3. 确认主机防火墙、云安全组允许 80 和 443。
4. 先检查 HTTP 能由正确 Nginx server 提供文件。
5. 安装证书客户端并申请证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d design.example.com
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

证书申请会访问外部 CA 并要求域名验证，必须在你自己的服务器和域名上执行。不要在未指向此服务器的域名上反复申请。

Certbot 修改配置后复查路由、资源 MIME 和 HTTPS。不要将生产用户引导到证书错误页面继续操作。

### 10.5 旧资源保留

新版本常使用新的带哈希 JS / CSS。已打开的旧页面稍后加载旧懒加载模块时，还可能请求旧资源。

小站可在切换前把上个发布目录的 `assets` 合并进新目录，避免覆盖新文件：

```bash
# 仅在已有 current 且新目录已经准备完毕时执行，再做原子切换。
sudo rsync -a --ignore-existing /srv/haishen/current/assets/ "$HAISHEN_RELEASE_DIR/assets/"
```

这一步应放在上面切换 `current` 之前。合并会逐渐增加磁盘占用，后续应根据当前与保留版本的构建文件清单清理不再引用的旧资源；不要只按 mtime 删除所有“30 天前”的文件，因为当前版本可能仍使用它们。

## 11. 可选 Convex 与 OIDC

先让本地模式站点通过验收，再启用本章。以下步骤会操作你自己的外部服务；仓库代码和本文不会自动创建这些服务，也没有预置账号或部署凭据。

### 11.1 配置顺序

1. 确定正式前端域名和 HTTPS。
2. 创建 OIDC 公共客户端，配置回调与浏览器来源。
3. 创建 Convex 项目和开发 / 生产部署。
4. 在对应 Convex 部署中设置 issuer、client ID。
5. 关联本地项目并部署后端。
6. 在前端构建环境填写三个公开变量，重新构建发布。
7. 用真实账户验证登录、备份、隔离、恢复和管理权限。

预发布环境和生产环境应使用各自明确的回调、Convex 部署及构建配置。不要将临时预览链接不加区分地连到生产账户和生产数据。

### 11.2 创建 OIDC 应用

当前前端使用 `@usehercules/auth`，基于 OIDC 授权码流程。建议选择适用于浏览器的 public / SPA 客户端，使用 Authorization Code + PKCE，不在浏览器保存 client secret。

至少确认：

| 项目 | 示例 / 要求 |
| --- | --- |
| Authority / issuer | `https://auth.example.com`，以真实提供方公布值为准 |
| Client ID | 公共客户端标识，例如 `haishen-web` |
| Redirect URI | `https://design.example.com/auth/callback` |
| Allowed origins / CORS | `https://design.example.com` |
| Response type | `code` |
| Scope | 默认 `openid profile email offline_access` |
| 刷新会话 | 提供方允许时使用适用于 SPA 的刷新机制 |
| ID token 验证 | 可由 Convex 校验的签名 JWT、正确 issuer / audience 与公开密钥发现 |

本项目的认证桥接向 Convex 提供的是 **ID token**。不要把服务端 `applicationID` 误填为另一个 API 的 access-token audience。仅能签发不透明访问令牌的方案不能按当前桥接直接接入。

OIDC 元数据的 `issuer`、令牌的 `iss`、前后端 authority 配置要匹配。尾部斜杠、租户路径、realm 路径都可能影响匹配，不能只比较“主域名差不多”。

如提供方不支持 `offline_access` 或 `select_account`，应按其能力调整可选的 scope / prompt 并重新构建验收，不要误判为静态服务器故障。

### 11.3 配置回调来源

正式域名至少注册：

```text
https://design.example.com/auth/callback
```

本机开发如需要登录，应另外注册实际使用的回调，例如：

```text
http://localhost:5173/auth/callback
```

`localhost` 和 `127.0.0.1` 是不同来源；`http` 和 `https` 也不同。不要登录前用一个域名，回调时又跳到另一个域名，否则浏览器可能找不到之前保存的 OIDC state。

身份服务的授权页、token 端点、发现文档和 JWKS 必须能被对应客户端或 Convex 正常访问。前端当前要求 authority 为 HTTPS，即使前端自身处于本机开发环境也一样。

### 11.4 创建 Convex 项目并配置服务端变量

在 Convex Dashboard 创建项目，区分 Development 和 Production 部署。先在对应部署设置：

```text
HERCULES_OIDC_AUTHORITY=https://auth.example.com
HERCULES_OIDC_CLIENT_ID=haishen-web
```

它们供 `convex/auth.config.ts` 使用，不带 `VITE_` 前缀。

首次从本地关联项目时，在应用目录执行官方 CLI：

```bash
cd artifacts/caishen-studio
pnpm exec convex dev --once
```

按提示选择正确团队和已有项目。这个命令不只是写本地配置，也会尝试检查并推送**开发部署**；开发部署同样需要有效的认证变量。若首次关联后提示缺少认证环境，先在该开发部署补齐变量，再重试。

CLI 可能写入 `.env.local` 和更新 `convex/_generated`。环境文件不提交；生成类型如发生预期变化，应检查 diff 后按团队代码流程处理。

已关联项目后，可通过 CLI 设置生产变量：

```bash
pnpm exec convex env set HERCULES_OIDC_AUTHORITY https://auth.example.com --prod
pnpm exec convex env set HERCULES_OIDC_CLIENT_ID haishen-web --prod
```

执行前确认项目和目标部署，不要默认把开发部署配置当成生产配置。需要更改现有值时，核对 CLI 提示，不盲目覆盖其他环境。

### 11.5 发布 Convex 后端

仍在 `artifacts/caishen-studio`：

```bash
pnpm exec convex deploy --typecheck enable
```

保留类型检查与正常确认流程。不要用跳过类型、跳过索引确认或允许丢弃 schema 暂存的参数来掩盖真实迁移问题。

后端包括：

- `users`：当前用户信息。
- `cloudWorks`：备份元数据、版本与归属。
- `cloudPolicy`：维护设置。
- `auditLogs`：审计记录。
- `cloudFiles` actions 与内部函数：受身份检查保护的文件上传、下载、替换和删除。

只上传前端而没有发布这些函数，会出现登录后函数不存在、备份失败等问题。

记录真正的生产客户端部署 URL，通常形如：

```text
https://example-deployment.convex.cloud
```

不要误用 Dashboard 页面地址或通常用于 HTTP actions 的 `.convex.site` 地址。

### 11.6 配置前端并重新构建

在静态托管的 Production 构建环境设置：

```text
VITE_CONVEX_URL=https://example-deployment.convex.cloud
VITE_HERCULES_OIDC_AUTHORITY=https://auth.example.com
VITE_HERCULES_OIDC_CLIENT_ID=haishen-web
```

可选回调默认不填写，应用将使用当前正式域名的 `/auth/callback`。如果确实覆盖，必须与身份服务登记值和网站路由同时匹配。

重新运行前端生产构建并发布。检查浏览器 `/account` 不再提示“云端服务未启用”，但**入口启用不等于登录、令牌校验和后端发布全部成功**。

### 11.7 设置管理员

1. 使用预定管理员账户登录。
2. 打开 `/admin`，取得页面给出的完整 `tokenIdentifier`。
3. 在 Convex **生产服务端**设置 `ADMIN_TOKEN_IDENTIFIERS`。
4. 多个标识使用英文逗号分隔，值必须与后端返回的标识完全一致。
5. 刷新页面并验证普通账户仍然被拒绝。

可用交互方式输入，避免把完整配置值复制进公开命令记录：

```bash
pnpm exec convex env set ADMIN_TOKEN_IDENTIFIERS --prod
```

以当前 CLI 的交互提示为准。不要填写邮箱、显示名称、前端自称的角色或猜测出来的用户 ID。默认空值不开放后台。

### 11.8 非交互后端部署

CI 如需部署 Convex，可以使用它支持的生产部署密钥，在 CI 的秘密存储中设置 `CONVEX_DEPLOY_KEY`，并在受信任的发布任务中执行 `convex deploy`。

此仓库现有 CI **没有**这个发布任务。不要将生产 deploy key 提供给不可信 PR、日志、浏览器构建变量或 Docker build args。需要自动发布时应单独设计分支保护、环境权限与部署审批，不把测试 workflow 直接等同于生产发布。

### 11.9 云端上线验收

至少使用两个不同真实账户 A / B 和两个浏览器环境：

| 操作 | 应看到的结果 |
| --- | --- |
| A 登录并上传带图片的作品 | 出现属于 A 的云端备份 |
| A 在另一浏览器恢复 | 创建本地副本，图片及自定义 APP 图标可显示 |
| B 登录 | 看不到 A 的作品正文或文件 |
| 陈旧版本尝试更新 / 删除 | 明确提示版本冲突，不覆盖较新备份 |
| 普通账户进入 `/admin` | 拒绝管理操作 |
| 管理员暂停上传 | 新上传被服务端拒绝，已有备份下载与本地编辑仍可用 |
| 退出账户 | 云端身份退出，本地作品不被删除 |

当前限制为每账户最多 100 个云端作品，单个含图片的包最多 8MB。完整本地备份上限 100MB，单模板包上限 80MB；不要把三种备份范围混为一谈。

真实身份提供方、Convex 生产网络、配额和费用需要在自己的服务中验收。不要用浏览器本地模拟测试代替这些步骤。

## 12. 域名、HTTPS、路由和缓存

### 12.1 保持一个主要 origin

Origin 由协议、主机名和端口组成。例如以下地址的本地作品彼此隔离：

```text
https://design.example.com
https://www.design.example.com
https://old-site.example.net
http://design.example.com
```

尽早确定正式域名，统一 HTTP 到 HTTPS、备用域名到主域名的跳转。跨域跳转不会迁移 IndexedDB。

### 12.2 SPA 回退是内部提供 HTML

访问 `/works` 时，服务器在内部返回 `index.html`，浏览器地址仍应保持 `/works`。不要把所有路由 301 跳到 `/index.html`；尤其不能丢弃 `/auth/callback?code=...&state=...` 的参数。

同时让静态目录优先返回真实文件。不存在的 JS 最好返回 404，而不是 HTTP 200 的入口 HTML。附带的 Nginx / Vercel 模板区分了这些情况。

Netlify / Pages 使用仓库已有宽泛 `_redirects` 时，缺失静态文件可能同样得到 HTML 回退；这也是必须检查真实构建资源、而非只检查状态码的原因。需要严格 404 时可为静态目录添加平台支持的例外规则，并提供实际的 404 页面，先在预览站点验收再替换原规则。

### 12.3 必须正确提供的 MIME

| 文件 | 期望 Content-Type |
| --- | --- |
| `.html` | `text/html` |
| `.js`、`.wasm.js` | `application/javascript` 或有效 JavaScript MIME |
| `.css` | `text/css` |
| `.wasm` | `application/wasm` |
| `.woff2` | `font/woff2` |
| `.woff` | `font/woff` |
| `.json` | `application/json` |
| `.traineddata.gz` | 可作为二进制 / gzip 文件提供，关键是实际字节保持正确 |

不要给已经是 gzip 文件的语言模型盲目增加 `Content-Encoding: gzip`。浏览器可能先把文件解压，而 OCR 库随后又按 gzip 模型处理，导致字节或清单校验失败。服务器对传输进行正确的额外压缩与“仅错贴一个压缩头”不是一回事；以客户端下载到的字节和清单 SHA-256 为准。

### 12.4 缓存建议

| 路径 | 建议 |
| --- | --- |
| `/`、`/index.html` 及页面 HTML | 重新验证 / 短缓存，避免长期锁住旧入口 |
| `/assets/` 带内容哈希文件 | 可以长缓存，发布时保留旧哈希资源一段时间 |
| `/ocr/` | 当前路径未按发布版本分目录，使用较短缓存，避免 Worker / WASM / 模型混版 |
| `/templates/` | 适度短缓存，内容必须与构建时校验一致 |
| `/licenses/`、`/attributions/` | 可短缓存，随完整版本发布 |

升级 OCR 依赖时特别检查三部分来自同一部署。当前代码没有离线 Service Worker，也没有保证任何热更新场景都无缝兼容旧 Worker。更新后应按需要重新加载识别引擎并验证，不要宣传离线整站能力。

### 12.5 响应头与跨域限制

附带模板提供 `nosniff`、合理的 Referrer Policy 和 `X-Frame-Options: DENY`。这会阻止站点被普通 iframe 嵌入；如确有嵌入需求，应单独评估来源和认证，不是简单删除全部保护头。

模板没有直接塞入一份未验证的 CSP。组织若要求 CSP，需要考虑当前内联主题脚本、动态样式、`data:` / `blob:` 图片、OCR Worker / WASM、字体，以及实际 Convex HTTPS / WebSocket 和身份服务来源，先在预发布验证。直接套用过严的 `default-src 'self'` 可能使 OCR、图片或登录失效。

自定义外链图片还受图片来源服务器的 CORS 约束。修改本站 CORS 不能让任意第三方图片可用于 Canvas 导出；优先下载成文件后本地上传。

## 13. 发布后验收

### 13.1 自动 HTTP 检查

```bash
node scripts/check-deployment.mjs https://design.example.com
```

完整检查 OCR 清单中的全部文件：

```bash
node scripts/check-deployment.mjs https://design.example.com --full
```

默认检查页面路由、入口引用的 JS / CSS、关键 OCR 文件、模型字节和 SHA-256，以及 APP 图标许可文件；`--full` 扩展到 OCR 清单中的全部资源，会产生约数十 MB 的下载。

网络慢时可适当调高单个请求超时：

```bash
HAISHEN_CHECK_TIMEOUT_MS=60000 node scripts/check-deployment.mjs https://design.example.com --full
```

退出码 `0` 表示已执行的关键检查通过，`1` 表示发现失败，`2` 表示命令参数使用错误。缺失静态文件的宽泛 HTML 回退会额外提示。

此脚本不枚举所有字体、不在浏览器里执行 OCR、不登录账户，也不证明业务权限或备份恢复成功。HTTP 检查通过后仍需下一节。

### 13.2 用真实浏览器检查

推荐使用全新测试作品，不操作生产用户原作品：

1. 首页、模板页、作品页能打开；直接输入页面地址并刷新仍可用。
2. 从内置模板新建作品，修改文字，看到“已保存到本地”。
3. 刷新恢复该作品；在第二标签页做冲突修改，原作不被旧修改覆盖。
4. 上传实际图片，选择原图背景和一次 OCR 流程，检查下载、识别、结果校正及编辑器入口。
5. 上传模板不显示手机设置；点击“进入作图”后切换品牌和型号，确认默认不强制切换画布尺寸。
6. 设置时间、电量、日期及 APP 通知图标；上传一个透明 PNG 自定义图标，保存后刷新仍保留。
7. 导出 PNG 和 JPEG，确认没有手机外壳或硬件开孔；透明 PNG 不包含画布背景图。
8. 导出模板文件，在新浏览器导入，图层、参数和自定义 APP 素材完整。
9. 生成 2–3 张批量图，指定随机型号与 APP 候选、数量范围，检查共同容量校验、均衡分配及预览与 ZIP 一致。
10. 导出完整备份，再恢复为副本，确认原作保留，图片、历史、作图预设与候选自定义图标可用。
11. 用手机宽度检查保存、导出、图标搜索和弹出面板。
12. 未启用云端时确认显示未启用；启用后按第 11 章做真实账户验收。

### 13.3 发布记录

每次发布至少记录：

- 日期、操作人、源码提交。
- 部署平台、正式域名、构建环境与模式。
- 公开构建变量对应的服务环境，不记录秘密值。
- 产物归档或镜像标签 / digest。
- HTTP 与浏览器验收结果。
- 已知问题、上一个可回滚版本。

不要把未执行、跳过或失败检查写成“全部通过”。

## 14. 更新发布与回滚

每次发布记录目标 Git 提交、当前线上版本和构建环境。先阅读数据格式变化说明，必要时导出完整备份，再安装锁定依赖、运行测试并生产构建。不要在运行中的发布目录直接修改源代码或更新依赖。

如果修改 Convex 函数或结构，先确保新后端兼容旧前端，再发布后端、发布前端；破坏性迁移应拆成兼容阶段。将完整 dist/public 发布到独立的新目录或平台预览部署，完成资源检查和浏览器验收后再切换生产流量。

自有服务器通过切换 current 符号链接回滚到保留的完整目录，执行 nginx -t 并重载；托管平台使用部署历史回滚；Docker 使用上一个明确版本或摘要启动容器后切换代理。不要只恢复 index.html，入口引用的所有资源必须完整。保留旧哈希资源可以照顾已经打开的页面。

静态回滚不会还原 Convex 数据或浏览器 IndexedDB。旧代码可能不认识新字段，旧版本再次保存可能丢失新数据；涉及格式变化时，先验证数据恢复方案。前端回滚、后端回滚与数据恢复分别记录。

GitHub 提交成功、CI 通过、正式域名上线是三个状态。本仓库 CI 不负责发布所有托管平台；接入平台 Git 集成后才由平台触发构建。每次保存部署编号、提交号、时间、验收结果和上一可用版本。

## 15. 域名迁移与数据备份

浏览器按“协议 + 主机名 + 端口”隔离本地数据。HTTP 换 HTTPS、预览域名换正式域名、www 换裸域都可能显示空作品库，不代表旧作品已删除。

迁移步骤：

1. 保留旧地址，在原浏览器与用户配置中打开旧站。
2. 导出完整备份，确认下载成功；重要作品另存单作品模板与图片。
3. 打开新地址导入，核对作品、素材、可编辑图层与导出结果。
4. 保存并刷新重新打开作品，确认恢复成功后再结束旧站服务。
5. 不同设备和浏览器配置分别迁移；隐私模式不可作为长期存储位置。

备份服务器静态文件不能恢复用户浏览器中的作品。云端单作品备份也不等同于本地完整备份，不能假定包含全部历史与素材。当前完整备份导入上限 100 MB，单作品模板 80 MB；云端单份作品包 8 MB，默认每账户最多 100 份。以当前界面及后端策略为准，增加 Nginx 上传限制不会突破应用校验。

清理站点数据、卸载浏览器、切换域名、升级数据格式或回滚前先下载可恢复备份。不要把清空 IndexedDB 当作常规排障第一步。

`/templates` 同时是应用页面和静态模板目录的前缀，Nginx 模板使用精确匹配处理页面，避免目录重定向或 403；不要删除这两条精确规则。

## 16. 故障排查

| 现象 | 检查与处理 |
| --- | --- |
| 找不到 Vite、TypeScript 或字体包 | 根目录使用 pnpm install --frozen-lockfile --prod=false，不能只装生产依赖。 |
| 锁文件不兼容 | 使用 Node 24、pnpm 11.25.0，不混用 npm/yarn 锁文件，不随意取消 frozen。 |
| esbuild/lightningcss 平台包缺失 | 使用 Linux x86_64 或 linux/amd64 构建，不复制其他系统的 node_modules。 |
| Docker 不能写用户目录 | 将 DOCKER_CONFIG 指向可写目录并创建，例如 /tmp/haishen-docker-config。 |
| 容器连不上包仓库 | 检查网络和组织代理；需要时传递 Docker 预定义代理参数，不把凭据写入 Dockerfile。 |
| SELF_SIGNED_CERT_IN_CHAIN | 由管理员提供可信 CA 并配置容器信任；不要关闭 TLS 或包完整性校验，不提交私有凭据。 |
| OCR 或照片校验失败 | 检查下载、锁文件及资源完整性，不修改摘要掩盖错误。 |
| 首页空白、JS MIME 错误 | 检查 JS 是否返回 HTML，发布目录是否 dist/public，入口与资源是否来自同一构建。 |
| 首页正常、刷新作品页 404 | 配置 SPA 回退并保留原 URL 与查询参数，登录回调不能被重定向到首页。 |
| /new/ 子目录导航失效 | 默认根路径部署；BASE_PATH 不会自动修改 BrowserRouter，优先独立域名根目录。 |
| 字体或模板图片缺失 | 发布完整目录，保留 templates、licenses、attributions 与字体文件。 |
| OCR 失败 | 检查用户启用状态、worker、核心、模型、WASM MIME 和模型摘要；避免旧缓存混入。gz 模型不应伪造 Content-Encoding。 |
| 更新后仍是旧页面 | 检查入口与 CDN 缓存、无哈希 OCR 文件缓存，不先清空作品数据。 |
| 复制等浏览器能力不可用 | 检查 HTTPS、安全上下文与浏览器授权；localhost 特例不代表公网 HTTP 可用。 |
| 云功能未启用 | 三个必需 VITE 变量完整且地址 HTTPS；修改后重新构建，Docker 运行时变量无效。 |
| 回调失败或 state 错误 | 核对协议、域名、端口与 /auth/callback 精确注册；保留回调参数，避免跨源切换。 |
| 登录成功而 Convex 拒绝 | 核对服务器 issuer、client ID 与 ID token 的 iss/aud；不能只检查 access token。 |
| 管理页无权限 | 配置实际完整 tokenIdentifier，邮箱或前端路由可见不构成管理员授权。 |
| 云端备份超限 | 分别检查作品包大小、账户数量与后端策略，完整本地备份不是单作品云包。 |
| 新域名没有作品 | 从旧源导出再导入，复制静态文件不能迁移 IndexedDB。 |
| iframe 嵌入被拒 | 默认 X-Frame-Options 为 DENY；确需嵌入时明确允许来源并重新设计响应头。 |

排障记录提交号、域名、浏览器版本、复现步骤、状态码与响应类型。分享前删除 Cookie、Authorization、身份令牌、账号信息与 OAuth 回调敏感参数，不上传 .env 或部署密钥。

## 17. 日常维护

- 定期检查正式域名、证书续期、DNS、构建失败、额度、磁盘和日志轮转。
- 资源检查不能代替真实编辑、导出、备份恢复和登录验证。未配置服务不能写成已上线。
- 清理发布目录前确认不是 current 实际目标，并遵守旧资源保留策略。
- 定期演练导出备份、新浏览器导入、编辑和导出图片，确认可恢复。
- 依赖更新单独提交锁文件与必要代码，再执行适用测试、生产构建和浏览器验收。
- 保留字体、图片与 APP 图标许可及来源说明，不能删除 licenses、attributions。
- 反向代理默认日志可能记录 OAuth 查询参数；回调路径应采用脱敏或不含查询串的日志格式。
- 部署密钥存平台秘密变量；泄露时撤销轮换并处理日志和历史，仅删除最新文件不够。

## 18. 验证范围、发布清单与参考资料

本文依据现有实现编写。模板可复制使用，不代表已在 Netlify、Cloudflare Pages、Vercel 或真实 Convex/OIDC 账户完成发布。实际域名、服务和账户仍需在目标平台配置。

本次已通过脚本与配置语法、目录链接、4 项非法参数检查；官方 Nginx 容器挂载既有生产产物后，31 项资源检查与 14 项 Playwright 流程全部通过。Nginx 语法、入口缓存、安全头、静态 404、WASM 类型及模型原始 gzip 字节均已检查。这不代表外部平台或真实云账户已发布。

本次完整 Docker 构建受到环境代理证书信任问题阻碍（SELF_SIGNED_CERT_IN_CHAIN），没有绕过 TLS 校验，因此不能宣称完整镜像构建通过。具体本地检查结果见交付说明。

发布清单：

- [ ] 目标提交、Node/pnpm、锁文件确认；公开变量和秘密变量分开。
- [ ] 适用测试及生产构建完成，资源目录完整。
- [ ] HTTPS、根路径、SPA 回退、静态 404、MIME 与缓存验收。
- [ ] 手机访问、保存、导出、OCR、备份恢复验收。
- [ ] 启用云功能时验证回调、两账户隔离、管理员授权、配额。
- [ ] 上一版本产物、数据备份、回滚方案与发布记录齐备。
- [ ] 分别核实 GitHub 同步、平台构建、正式域名上线。

平台界面、套餐和默认版本可能变化，执行时核对官方资料：

- [Node.js](https://nodejs.org/en/download)、[pnpm](https://pnpm.io/installation)、[Vite 部署](https://vite.dev/guide/static-deploy)
- [Netlify](https://docs.netlify.com/configure-builds/file-based-configuration/)、[Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[Vercel](https://vercel.com/docs/project-configuration)
- [Docker](https://docs.docker.com/build/)、[Nginx](https://nginx.org/en/docs/)、[Convex](https://docs.convex.dev/production/hosting/)、[OpenID Connect](https://openid.net/specs/openid-connect-core-1_0.html)

相关文件：[README](../README.md)、[部署模板](../deploy/)、[检查脚本](../scripts/check-deployment.mjs)。
