// Public Chinese search: cache responses, throttle requests, stop on verification/rate limits.
import fs from "node:fs/promises";
import crypto from "node:crypto";
const inventory = JSON.parse(
  await fs.readFile("docs/phone-calibration/source-inventory.json", "utf8"),
);
const cache = "/tmp/phone-chinese-search";
await fs.mkdir(cache, { recursive: true });
const decode = (s) =>
  s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const plain = (s) =>
  decode(
    s
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
const rows = [];
for (const model of inventory.models.filter(
  (r) => r.status === "no-verified-source",
)) {
  const query =
    model.name.replace("Redmi", "红米").replace("OPPO", "OPPO") +
    " 评测 系统 界面";
  const url = "https://www.baidu.com/s?wd=" + encodeURIComponent(query);
  const key = crypto.createHash("sha256").update(url).digest("hex");
  let response;
  try {
    response = JSON.parse(await fs.readFile(`${cache}/${key}.json`, "utf8"));
  } catch {
    try {
      const r = await fetch(url, {
        credentials: "omit",
        signal: AbortSignal.timeout(20000),
      });
      response = {
        status: r.status,
        url: r.url,
        html: await r.text(),
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      response = {
        status: 0,
        url,
        error: String(e),
        html: "",
        checkedAt: new Date().toISOString(),
      };
    }
    await fs.writeFile(`${cache}/${key}.json`, JSON.stringify(response));
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const blocked =
    [403, 429].includes(response.status) ||
    /<title[^>]*>[^<]*(?:验证|访问受限|captcha|verify)/i.test(response.html);
  const cards = [
    ...response.html.matchAll(/<div\b[^>]*\bmu=["']([^"']+)["'][^>]*>/g),
  ];
  const results = [];
  for (let i = 0; i < cards.length; i++) {
    const target = decode(cards[i][1]);
    if (!/^https?:\/\//.test(target)) continue;
    const body = response.html.slice(
      cards[i].index,
      cards[i + 1]?.index ?? response.html.length,
    );
    const title = plain(body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    if (title && !results.some((r) => r.url === target))
      results.push({ title, url: target });
  }
  rows.push({
    modelId: model.modelId,
    name: model.name,
    query,
    searchUrl: url,
    httpStatus: response.status,
    blocked,
    checkedAt: response.checkedAt,
    results,
  });
  console.log(
    JSON.stringify({
      modelId: model.modelId,
      httpStatus: response.status,
      blocked,
      results: results.length,
    }),
  );
  await fs.writeFile(
    "docs/phone-calibration/chinese-discovery.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        scope:
          "Public search results only; verify exact model, ROM, version and screenshot before calibration",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  if (blocked) break;
}
