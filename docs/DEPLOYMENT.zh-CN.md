# Cloudflare Pages 部署与维护

[返回首页](../README.md) · [后台使用](ADMIN_CMS.zh-CN.md) · [本地开发](DEVELOPMENT.zh-CN.md)

本项目只维护当前方式：**GitHub main → Cloudflare Pages 自动构建，D1＋私有 R2 提供内容后台**。不需要单独的 Node.js 生产服务器。现有站点已经部署时，不必重复创建项目、数据库或存储桶。

## 1. 准备

- GitHub 仓库及其访问权限，当前仓库为 `haiwai007/new`。
- Cloudflare 账号，能访问 Pages、D1 和 R2。R2 未开通时按控制台提示开通。
- 本地运行维护命令时需要 Node.js 24.x、pnpm 11.25.0。

本地作品使用 IndexedDB；后台目录和设置使用 D1；模板文件、图片使用 R2。GitHub 保存代码，不自动备份线上 D1、R2 或浏览器作品。

## 2. 创建并关联 Pages

在 Cloudflare“Workers 和 Pages”创建 **Pages** 项目，连接 GitHub，选择仓库和 `main` 分支。若当前界面要求填写 Worker 的“部署命令”，返回选择 Pages 项目。

| 设置 | 值 |
| --- | --- |
| 项目根目录 | 仓库根目录，留空或 `/` |
| 生产分支 | `main` |
| 框架预设 | None |
| 构建命令 | 见下方完整命令 |
| 构建输出目录 | `artifacts/caishen-studio/dist/public` |

使用当前固定 pnpm 版本的安装与构建命令：

```bash
npx --yes pnpm@11.25.0 install --frozen-lockfile --prod=false && npx --yes pnpm@11.25.0 build:studio
```

生产环境的构建变量：

| 名称 | 类型 | 值 |
| --- | --- | --- |
| `NODE_VERSION` | 文本 | `24` |
| `BASE_PATH` | 文本 | `/` |
| `SKIP_DEPENDENCY_INSTALL` | 文本 | `1` |

该命令自行安装依赖，因此跳过平台的自动安装。开发依赖不能省略，构建需要 Vite、TypeScript、字体和 OCR 资源包。项目不支持仅修改 `BASE_PATH` 就迁移到任意子目录。

首次部署成功后得到 `*.pages.dev` 地址。此时本地作图可用，后台需继续完成资源绑定。

## 3. 创建并初始化 D1

在 Cloudflare“存储和数据库 → D1”创建数据库，例如 `haishen-catalog`。

进入该数据库的 Console／控制台，依次执行仓库迁移文件里的 SQL：

1. [0001_initial.sql](../migrations/catalog/0001_initial.sql)：基础表与分类。
2. [0002_submissions.sql](../migrations/catalog/0002_submissions.sql)：投稿审核表与索引。

打开文件，复制 SQL 正文，不要复制 Markdown 标记。在实际生产数据库执行，不能只初始化本地数据库。迁移可重复执行；后续升级依照新增迁移文件操作，不要删除原数据库重建。

如果已经在自己的电脑登录 Wrangler，也可以初始化同一个 Cloudflare 数据库：

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 execute haishen-catalog --remote --file=migrations/catalog/0001_initial.sql
pnpm exec wrangler d1 execute haishen-catalog --remote --file=migrations/catalog/0002_submissions.sql
```

数据库名称不同则替换命令中的名称。这是数据库维护命令，不替代 Pages 的 Git 自动部署。

## 4. 创建私有 R2 存储桶

进入“存储和数据库 → R2”，创建存储桶，例如 `haishen-template-files`。

保持私有，不启用公开 `r2.dev` 地址或公开文件域名。模板由项目 API 按发布状态提供；草稿和投稿不能通过存储桶公开读取。费用及额度以实际账号套餐为准。

## 5. 绑定到 Pages 生产环境

进入“Workers 和 Pages → 你的 Pages 项目 → 设置 → 绑定”，添加：

| 绑定类型 | 变量名称 | 资源 |
| --- | --- | --- |
| D1 数据库 | `CATALOG_DB` | 上一步的 D1 数据库 |
| R2 存储桶 | `CATALOG_FILES` | 上一步的私有 R2 桶 |

名称区分大小写，不能作为普通文本变量填写。项目根目录仍为仓库根目录，`functions/` 必须参与部署，不能只上传前端静态文件。

预览环境如果需要后台，请使用独立测试资源，避免预览分支修改生产内容。

## 6. 设置管理员密码

后台没有内置默认密码。仓库根目录执行：

```bash
node scripts/create-admin-password.mjs
```

输入自己选择的 12～256 字符密码。输入不回显，程序输出完整摘要，格式为：

```text
pbkdf2$100000$随机盐$摘要
```

这是格式示意，不能直接使用。复制实际输出，在 Pages 生产环境“设置 → 变量和机密”添加：

| 名称 | 类型 | 值 |
| --- | --- | --- |
| `ADMIN_PASSWORD_HASH` | 机密／加密 | 程序生成的完整摘要 |
| `ADMIN_USERNAME` | 文本，可选 | 管理员账号，未设时为 `admin` |

不要填入 `VITE_*`，不要提交密码或实际摘要到仓库。登录时输入原密码，不是摘要。确需临时初始密码时，脚本支持 `--initial`（至少 6 位），登录后立即在后台改为长期密码。

## 7. 重新部署并验证

绑定、机密或构建变量修改后，在 Pages 部署页重新部署最新 `main`。仅保存变量不会修改已经运行的部署。

检查：

- `/admin` 显示管理员登录表单。
- `/api/admin/status` 返回 `enabled: true`、`migrated: true`、`missing: []`。
- `/api/public/catalog` 可匿名读取公开目录。
- 未登录请求 `/api/admin/catalog` 返回 401，说明后台权限保护正常。
- 上传图片制作模板、预览、图片导出和教学下载正常。

可在本地运行只读 HTTP 检查：

```bash
node scripts/check-deployment.mjs https://你的域名 --full
```

进入后台后修改密码。日常后台改密无需重新部署，会让旧会话失效。忘记密码时重新生成摘要、更新 `ADMIN_PASSWORD_HASH` 并重新部署；新的摘要会重置后台密码。普通代码部署不会重置已修改的密码。

## 8. 域名与访问

在 Pages 项目的“自定义域”中添加域名，按 Cloudflare 指引配置 DNS，等待 HTTPS 证书生效。保持日常使用域名稳定：不同域名的浏览器本地作品彼此隔离。

不要对整个站点开启 Cloudflare Access 登录保护，前端应保持免登录。后台已有独立管理员认证。

`public/_redirects` 提供前端路由回退，`functions/` 处理 `/api/*`。不要设置把 JS、WASM、字体、模板或 API 全部重定向到首页的规则，也不要缓存后台登录和写入接口。

## 9. 更新与回退

1. 将已验证代码推送到 GitHub `main`。
2. 等待 Cloudflare 对应提交构建成功。
3. 检查部署对应的提交、页面、后台状态及静态资源。
4. 构建失败时查看日志，原成功版本通常仍继续提供服务。

回退时在 Pages 部署列表选择之前成功的生产部署，使用回滚操作。**代码回滚不会回滚 D1 或 R2**，涉及数据迁移前应备份，并确认旧代码兼容当前数据结构。

后台分类、模板、审核和弹窗修改实时保存到云端，不需要每次重新构建网站。用户本地作品也不因推送代码自动上传。

## 10. 常见故障

| 现象 | 检查方式 |
| --- | --- |
| pnpm 版本或锁文件错误 | 使用完整构建命令，确认 Node 24、pnpm 11.25.0 和锁文件同步 |
| `vite` 或字体包不存在 | 安装必须包含开发依赖，不能使用仅生产依赖安装 |
| 后台提示未启用 | 查看缺失项，核对生产环境绑定、机密，重新部署 |
| 数据库未初始化 | 在实际绑定的生产 D1 执行迁移 |
| `/api/*` 返回 HTML | 确认项目根目录和 `functions/`，排除错误回退规则 |
| 直接访问编辑器返回 404 | 检查 `_redirects` 是否出现在产物中 |
| OCR／字体加载失败 | 检查产物中的 OCR、字体、许可文件和 MIME，不只部署首页 |
| 切换域名后作品消失 | 回到原域名导出备份，再到新域名导入 |
| 登录失败 | 输入原密码，确认 HTTPS 与 Cookie，核对当前部署的机密 |
| 预览环境改动了线上模板 | 测试环境不能绑定生产 D1／R2 |

## 11. 备份与日常维护

- 定期备份生产 D1 和 R2；数据库记录与文件应配套保留。
- 更换域名或浏览器前导出个人完整备份。
- 保留 `pnpm-lock.yaml`、数据库迁移、素材许可及来源文件。
- 依赖更新先运行[开发检查](DEVELOPMENT.zh-CN.md)，再推送部署。
- 不把真实密码、密钥、`.env.local`、`.dev.vars` 或 Wrangler 状态提交到仓库。
