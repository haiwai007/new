// Read the publisher's public WordPress API. Search results are candidates, never approval.
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { identifyModel } from "./model-match.mjs";
const inventory = JSON.parse(
  await fs.readFile("docs/phone-calibration/source-inventory.json", "utf8"),
);
const english = (name) =>
  name
    .replace("小米", "Xiaomi")
    .replace("华为", "Huawei")
    .replace("荣耀", "Honor")
    .replace("一加", "OnePlus")
    .replace("（第 3 代）", " 2022");
const models = inventory.models.map((m) => ({
  id: m.modelId,
  name: english(m.name),
}));
const cache = "/tmp/phone-gizmo-phrase";
await fs.mkdir(cache, { recursive: true });
const rows = [];
for (const model of inventory.models.filter(
  (r) => r.status === "no-verified-source",
)) {
  const query = '"' + english(model.name) + '"';
  const url =
    "https://www.gizmochina.com/wp-json/wp/v2/posts?search=" +
    encodeURIComponent(query) +
    "&orderby=relevance&per_page=5&_fields=id,link,title,date,content";
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
      const text = await r.text();
      response = {
        status: r.status,
        text,
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      response = {
        status: 0,
        text: "",
        error: String(e),
        checkedAt: new Date().toISOString(),
      };
    }
    await fs.writeFile(`${cache}/${key}.json`, JSON.stringify(response));
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const blocked =
    [403, 429].includes(response.status) ||
    /<title[^>]*>[^<]*(?:verify|captcha)/i.test(response.text);
  let posts = [];
  try {
    const parsed = JSON.parse(response.text);
    if (Array.isArray(parsed)) posts = parsed;
  } catch {}
  const candidates = posts
    .map((post) => ({
      title: post.title.rendered
        .replace(/<[^>]*>/g, " ")
        .replaceAll("&amp;", "&"),
      url: post.link,
      publishedAt: post.date,
      id: post.id,
      contentHash: crypto
        .createHash("sha256")
        .update(post.content.rendered)
        .digest("hex"),
    }))
    .map((post) => ({
      ...post,
      exactModelMatch: identifyModel(post.title, models) === model.modelId,
      reviewTitle: /review|hands.on/i.test(post.title),
    }));
  rows.push({
    modelId: model.modelId,
    name: model.name,
    query,
    searchUrl: url,
    httpStatus: response.status,
    blocked,
    checkedAt: response.checkedAt,
    candidates,
  });
  await fs.writeFile(
    "docs/phone-calibration/gizmo-phrase-discovery.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        scope:
          "Publisher search candidates only; inspect model, firmware, region and images before use",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      modelId: model.modelId,
      httpStatus: response.status,
      blocked,
      candidates: candidates.length,
      exactReviews: candidates.filter((r) => r.exactModelMatch && r.reviewTitle)
        .length,
    }),
  );
  if (blocked) break;
}
