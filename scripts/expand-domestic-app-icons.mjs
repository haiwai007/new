// Rebuild additional offline notification icons from pinned/licensed upstreams.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(
  new URL("../artifacts/caishen-studio/package.json", import.meta.url),
);
const si = require("react-icons/si");
const base = "https://raw.githubusercontent.com/lobehub/lobe-icons/";
const manifestPath = "docs/app-icons/sources.json";
let previous;
try {
  previous = JSON.parse(await fs.readFile(manifestPath, "utf8"));
} catch {}
const revision =
  previous?.lobeRevision ??
  (
    await (
      await fetch(
        "https://api.github.com/repos/lobehub/lobe-icons/commits?per_page=1",
        { credentials: "omit" },
      )
    ).json()
  )[0].sha;
const simple = [
  ["dianping", "大众点评", "SiDazhongdianping", "#FF6633"],
  ["wegame", "WeGame", "SiWegame", "#FAAB00"],
  ["railway12306", "铁路 12306", "SiChinarailway", "#003E8C"],
  ["airchina", "中国国航", "SiAirchina", "#E30E17"],
  ["chinaeastern", "东方航空", "SiChinaeasternairlines", "#1A2477"],
  ["chinasouthern", "南方航空", "SiChinasouthernairlines", "#008BCB"],
  ["csdn", "CSDN", "SiCsdn", "#FC5531"],
  ["juejin", "掘金", "SiJuejin", "#007FFF"],
  ["gitee", "Gitee 码云", "SiGitee", "#C71D23"],
  ["gitcode", "GitCode", "SiGitcode", "#F64959"],
  ["doubanread", "豆瓣阅读", "SiDoubanread", "#389EAC"],
  ["deepseek", "DeepSeek", "SiDeepseek", "#4D6BFE"],
  ["qwen", "通义千问", "SiQwen", "#615CED"],
  ["hailuo", "海螺 AI", "SiMinimax", "#F23F5D"],
  ["coze", "扣子", "SiCoze", "#4D53E8"],
  ["aliyun", "阿里云", "SiAlibabacloud", "#FF6A00"],
  ["renren", "人人", "SiRenren", "#217DC6"],
];
const lobe = [
  ["doubao", "豆包", "#3B8DFF"],
  ["kimi", "Kimi", "#171717"],
  ["wenxin", "文小言（文心一言）", "#5368F9"],
  ["spark", "讯飞星火", "#1465FF"],
  ["chatglm", "智谱清言", "#3859FF"],
  ["yuanbao", "腾讯元宝", "#00AD8E"],
  ["jimeng", "即梦 AI", "#32C3C5"],
  ["kling", "可灵 AI", "#FF6A00"],
  ["hunyuan", "腾讯混元", "#006EFF"],
  ["stepfun", "阶跃星辰", "#005BFF"],
  ["baiducloud", "百度智能云", "#2468F2"],
  ["tencentcloud", "腾讯云", "#006EFF"],
  ["baichuan", "百川智能", "#FF6933"],
];
const additions = [],
  sources = [];
for (const [id, name, exportName, color] of simple) {
  const icon = si[exportName]({});
  const paths = icon.props.children.map((c) => {
    if (c.type !== "path" || !c.props.d)
      throw Error("Review non-path icon: " + id);
    return c.props.d;
  });
  additions.push({ id, name, color, viewBox: icon.props.attr.viewBox, paths });
  sources.push({
    id,
    provider: "Simple Icons via react-icons",
    exportName,
    license: "CC0-1.0",
  });
}
async function download(url) {
  const r = await fetch(url, {
    credentials: "omit",
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw Error(`${r.status}: ${url}`);
  return await r.text();
}
for (const [id, name, color] of lobe) {
  const url =
    base + revision + "/packages/static-svg/icons/" + id + "-color.svg";
  const svg = await download(url);
  if (
    /<\s*(script|foreignObject|image|style)|\bon\w+\s*=|(?:href|url\(\s*["']?https?:)/i.test(
      svg,
    )
  )
    throw Error("Review unsafe external SVG: " + id);
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw Error("No viewBox");
  const rootFill = svg.match(/<svg\b[^>]*?\bfill="([^"]+)"/)?.[1] ?? "black";
  const body = svg
    .replace(/^.*?<svg\b[^>]*>/s, "")
    .replace(/<\/svg>\s*$/, "")
    .replaceAll("currentColor", color);
  const svgBody = `<g fill="${rootFill.replaceAll("currentColor", color)}">${body}</g>`;
  additions.push({ id, name, color, viewBox, paths: [], svgBody });
  sources.push({
    id,
    provider: "Lobe Icons",
    url,
    license: "MIT",
    sha256: createHash("sha256").update(svg).digest("hex"),
  });
}
const license = await download(base + revision + "/LICENSE");
await fs.writeFile(
  "artifacts/caishen-studio/public/attributions/lobe-app-icons-MIT.txt",
  license,
);
await fs.writeFile(
  "artifacts/caishen-studio/src/lib/phone/app-icon-additions.ts",
  "// Generated offline brand-colour notification artwork. See docs/app-icons/sources.json and public/attributions.\nexport const ADDITIONAL_APP_ICONS = " +
    JSON.stringify(additions, null, 2) +
    " as const;\n",
);
await fs.writeFile(
  manifestPath,
  JSON.stringify(
    {
      lobeRevision: revision,
      reactIconsVersion: JSON.parse(
        await fs.readFile(
          new URL(
            "../package.json",
            pathToFileURL(require.resolve("react-icons/si")),
          ),
          "utf8",
        ),
      ).version,
      scope:
        "Small notification renditions of app/service brand marks; not full official application icons.",
      sources,
    },
    null,
    2,
  ) + "\n",
);
console.log("Generated", additions.length, "domestic app/service icons");
