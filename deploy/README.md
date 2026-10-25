# 部署配置模板

完整步骤见[详细部署手册](../docs/DEPLOYMENT.zh-CN.md)。

- `Dockerfile`：Node 24 / pnpm 11.25.0 构建，Nginx 提供静态站点。仓库根目录作为构建上下文。
- `nginx.conf`：根路径 SPA、静态资源 404、OCR MIME、缓存及安全响应头；HTTPS 由外层处理。
- `netlify.example.toml`：选择 Netlify 时复制为根目录 `netlify.toml`。
- `vercel.example.json`：选择 Vercel 时复制为根目录 `vercel.json`。

example 文件默认不启用，不会触发现有站点发布。不要提交部署密钥或 .env；前端 VITE 变量在构建时编译，运行容器时设置不能修改成品。生产构建目录为 `artifacts/caishen-studio/dist/public`。

发布后运行 `node scripts/check-deployment.mjs https://你的域名 --full`，再执行手册中的浏览器验收。
