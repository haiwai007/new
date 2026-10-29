// Public search discovery only: do not solve challenges, rotate identities, or infer calibration.
import fs from "node:fs/promises";
import crypto from "node:crypto";
const inventory = JSON.parse(
  await fs.readFile("docs/phone-calibration/source-inventory.json", "utf8"),
);
const cache = "/tmp/phone-public-search";
await fs.mkdir(cache, { recursive: true });
const rows = [];
for (const model of inventory.models.filter(
  (r) => r.status === "no-verified-source",
)) {
  const name = model.name
    .replace("小米", "Xiaomi")
    .replace("华为", "Huawei")
    .replace("荣耀", "Honor")
    .replace("一加", "OnePlus")
    .replace("（第 3 代）", " 2022")
    .replace(/([a-z])([0-9])/gi, "$1 $2");
  const query = `site:notebookcheck.net "${name}" review`;
  const url = "https://search.brave.com/search?q=" + encodeURIComponent(query);
  const key = crypto.createHash("sha256").update(url).digest("hex");
  let html,
    status,
    blocked = false;
  try {
    const old = JSON.parse(await fs.readFile(`${cache}/${key}.json`, "utf8"));
    ({ html, status } = old);
  } catch {
    try {
      const r = await fetch(url, {
        credentials: "omit",
        signal: AbortSignal.timeout(20000),
      });
      status = r.status;
      html = await r.text();
      await fs.writeFile(
        `${cache}/${key}.json`,
        JSON.stringify({ status, html }),
      );
    } catch (e) {
      status = 0;
      html = "";
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  blocked =
    status === 429 ||
    status === 403 ||
    /<title[^>]*>[^<]*(?:captcha|verify|challenge)/i.test(html) ||
    /id=["'](?:challenge-form|captcha-container)["']/i.test(html);
  const links = [
    ...new Set(
      [
        ...html.matchAll(
          /https:\/\/www\.notebookcheck\.net\/[a-zA-Z0-9_+.%?=-]+\.\d+\.0\.html/g,
        ),
      ].map((m) => m[0]),
    ),
  ];
  rows.push({
    modelId: model.modelId,
    query,
    url,
    httpStatus: status,
    blocked,
    links,
    checkedAt: new Date().toISOString(),
  });
  console.log(
    JSON.stringify({
      modelId: model.modelId,
      status,
      blocked,
      links: links.length,
    }),
  );
  await fs.writeFile(
    "docs/phone-calibration/public-discovery.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        scope:
          "Search result links only, not model verification or calibration",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  if (blocked) break;
}
