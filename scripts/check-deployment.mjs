import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const input = args.find(arg => !arg.startsWith("--"));
if (!input || args.some(arg => arg.startsWith("--") && arg !== "--full")) {
  console.error("用法：node scripts/check-deployment.mjs https://design.example.com [--full]");
  process.exit(2);
}
let origin;
try {
  origin = new URL(input);
  if (!/^(https?:)$/.test(origin.protocol) || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error("请提供站点根地址，不包含子目录、登录信息、查询参数或片段");
  }
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const timeout = Number(process.env.HAISHEN_CHECK_TIMEOUT_MS ?? 30000);
if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 120000) throw new Error("检查超时须为 1000–120000 毫秒");
let failures = 0;
const seen = new Set();
const cache = new Map();
async function request(path) {
  const url = new URL(path, origin);
  if (url.origin !== origin.origin) throw new Error(`资源不属于本站：${url.pathname}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (response.url && new URL(response.url).origin !== origin.origin) throw new Error(`资源被重定向到其他站点：${url.pathname}`);
  if (!response.ok) throw new Error(`${url.pathname} 返回 HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { response, bytes };
}
async function check(path, validate) {
  try {
    const data = cache.get(path) ?? await request(path);
    cache.set(path, data);
    await validate(data);
    if (!seen.has(path)) console.log(`通过 ${path}`);
    seen.add(path);
    return data;
  } catch (error) {
    failures++;
    console.error(`失败 ${path}：${error instanceof Error ? error.message : error}`);
    return null;
  }
}
const type = response => response.headers.get("content-type") ?? "";
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const html = ({ response, bytes }) => {
  assert(/text\/html/i.test(type(response)), "页面不是 text/html");
  assert(/<div\s+id=["']root["']/.test(bytes.toString()), "不是当前应用的入口 HTML");
};
if (origin.protocol !== "https:") console.warn("提示：本次使用 HTTP；公网正式发布还需要有效 HTTPS，脚本不会签发证书。");
const entry = await check("/", html);
for (const path of ["/templates", "/works", "/custom", "/batch", "/auth/callback"]) await check(path, html);
if (entry) {
  const urls = [...entry.bytes.toString().matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]).filter(path => /\.(?:js|css)(?:\?|$)/.test(path));
  assert(urls.some(path => /\.js(?:\?|$)/.test(path)), "入口没有找到 JS 构建资源");
  for (const path of urls) await check(path, ({response,bytes}) => {
    assert(!/^\s*(?:<!doctype|<html)/i.test(bytes.toString("utf8",0,100)), "静态文件被错误回退成 HTML");
    assert(/\.css(?:\?|$)/.test(path) ? /text\/css/i.test(type(response)) : /(?:javascript|ecmascript)/i.test(type(response)), "JS / CSS 的 MIME 类型不正确");
  });
}
const manifest = await check("/ocr/manifest.json", ({bytes}) => assert(Object.keys(JSON.parse(bytes.toString())).length > 0, "OCR 清单为空"));
if (manifest) {
  const files = JSON.parse(manifest.bytes.toString());
  const paths = args.includes("--full") ? Object.keys(files) : ["worker.min.js", "core/tesseract-core-lstm.wasm", "lang/eng.traineddata.gz", "lang/chi_sim.traineddata.gz"];
  for (const path of paths) await check(`/ocr/${path}`, ({response,bytes}) => {
    assert(typeof files[path] === "string", "OCR 清单缺少此资源");
    assert(createHash("sha256").update(bytes).digest("hex") === files[path], "与同一部署的 OCR 清单 SHA-256 不符，可能是 HTML 回退、错误压缩或缓存混版");
    if (path.endsWith(".wasm")) assert(/application\/wasm/i.test(type(response)), "WASM 应使用 application/wasm");
    if (path.endsWith(".js")) assert(/(?:javascript|ecmascript)/i.test(type(response)), "Worker / WASM 包装脚本 MIME 不正确");
    if (path.endsWith(".gz")) assert(bytes[0] === 0x1f && bytes[1] === 0x8b, "模型返回的不是 gzip 文件字节");
  });
}
await check("/attributions/statusbar-app-icons.txt", ({bytes}) => assert(bytes.toString().includes("Ant Design"), "缺少 APP 图标来源说明"));
try {
  const response = await fetch(new URL("/assets/__haishen_missing_check__.js",origin), {signal:AbortSignal.timeout(timeout)});
  if (response.status !== 404) console.warn(`提示：不存在的静态资源返回 ${response.status}，建议增加静态目录 404 规则，避免把 JS 请求回退成 HTML。`);
} catch (error) { console.warn(`缺失资源检查未完成：${error.message}`); }
console.log(`完成：${seen.size} 个关键地址通过，${failures} 项失败。此检查不替代真实 OCR、图片导出及账户权限验收。`);
process.exitCode = failures ? 1 : 0;
