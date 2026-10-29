// Manufacturer device pages establish hardware identity, not status-bar calibration.
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { identifyModel } from "./model-match.mjs";
const inventory = JSON.parse(
  await fs.readFile("docs/phone-calibration/source-inventory.json", "utf8"),
);
const paths = {
  redmik70: "https://www.mi.com/redmi-k70/",
  redmik70pro: "https://www.mi.com/redmi-k70-pro/",
  redmik80: "https://www.mi.com/prod/redmi-k80",
  redmik80pro: "https://www.mi.com/prod/redmi-k80-pro",
  huaweipura70: "https://consumer.huawei.com/cn/support/phones/pura70/",
  huaweipura70pro: "https://consumer.huawei.com/cn/support/phones/pura70-pro/",
  huaweimate60: "https://consumer.huawei.com/cn/support/phones/mate60/",
  huaweimate60pro: "https://consumer.huawei.com/cn/support/phones/mate60-pro/",
  huaweimate70: "https://consumer.huawei.com/cn/phones/mate70/",
  huaweimate70pro: "https://consumer.huawei.com/cn/phones/mate70-pro/",
  huaweip60: "https://consumer.huawei.com/cn/support/phones/p60/",
  honor200: "https://www.honor.com/cn/phones/honor-200/",
  honormagic6: "https://www.honor.com/cn/phones/honor-magic6/",
  honormagic5: "https://www.honor.com/cn/phones/honor-magic5/",
  honormagic7: "https://www.honor.com/cn/phones/honor-magic7/",
  oppofindx7: "https://www.oppo.com/cn/smartphones/series-find-x/find-x7/",
  oppofindx8: "https://www.oppo.com/cn/smartphones/series-find-x/find-x8/",
  oppofindx6: "https://www.oppo.com/cn/smartphones/series-find-x/find-x6/",
  opporeno12: "https://www.oppo.com/cn/smartphones/series-reno/reno12/",
  opporeno11pro: "https://www.oppo.com/cn/smartphones/series-reno/reno11-pro/",
  opporeno12pro: "https://www.oppo.com/cn/smartphones/series-reno/reno12-pro/",
  oneplusace3: "https://www.oneplus.com/cn/ace-3",
  oneplusace3pro: "https://www.oneplus.com/cn/ace-3-pro",
  vivox100: "https://www.vivo.com.cn/vivo/x100",
  vivox200: "https://www.vivo.com.cn/vivo/x200",
  vivox90: "https://www.vivo.com.cn/vivo/x90",
  vivox100ultra: "https://www.vivo.com.cn/vivo/x100ultra",
  iqoo12: "https://www.vivo.com.cn/vivo/param/iqoo12",
  iqoo13: "https://www.vivo.com.cn/vivo/param/iqoo13",
  iqooneo9: "https://www.vivo.com.cn/vivo/param/iqooneo9",
  iqoo12pro: "https://www.vivo.com.cn/vivo/param/iqoo12pro",
  realmegt7pro: "https://www.realme.com/cn/realme-gt-7-pro",
  realmegt5pro: "https://www.realme.com/cn/realme-gt-5-pro",
};
const english = (name) =>
  name
    .replace("小米", "Xiaomi")
    .replace("华为", "Huawei")
    .replace("荣耀", "Honor")
    .replace("一加", "OnePlus");
const models = inventory.models.flatMap((m) => [
  { id: m.modelId, name: english(m.name) },
  { id: m.modelId, name: m.name.replace("realme", "真我") },
]);
const cache = "/tmp/phone-official-devices";
await fs.mkdir(cache, { recursive: true });
const rows = [],
  hostTimes = new Map(),
  blockedHosts = new Set();
for (const model of inventory.models.filter(
  (r) => r.status === "no-verified-source",
)) {
  const url = paths[model.modelId];
  if (!url) throw Error("Missing device route: " + model.modelId);
  const host = new URL(url).hostname;
  if (blockedHosts.has(host)) {
    rows.push({
      modelId: model.modelId,
      url,
      status: "host-rate-limited",
      calibration: "unverified",
    });
    continue;
  }
  const key = crypto.createHash("sha256").update(url).digest("hex");
  let response;
  try {
    response = JSON.parse(await fs.readFile(`${cache}/${key}.json`, "utf8"));
  } catch {
    const wait = Math.max(0, 1500 - (Date.now() - (hostTimes.get(host) ?? 0)));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    hostTimes.set(host, Date.now());
    try {
      const r = await fetch(url, {
        credentials: "omit",
        signal: AbortSignal.timeout(20000),
      });
      response = {
        status: r.status,
        url: r.url,
        text: await r.text(),
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      response = {
        status: 0,
        url,
        text: "",
        error: String(e),
        checkedAt: new Date().toISOString(),
      };
    }
    await fs.writeFile(`${cache}/${key}.json`, JSON.stringify(response));
  }
  const title = (
    response.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""
  )
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .trim();
  const blocked =
    [403, 429].includes(response.status) ||
    /captcha|验证|access denied|just a moment|verify/i.test(title);
  if (blocked) blockedHosts.add(host);
  const exactModelMatch = identifyModel(title, models) === model.modelId;
  rows.push({
    modelId: model.modelId,
    name: model.name,
    url: response.url,
    httpStatus: response.status,
    title,
    exactModelMatch,
    status:
      response.status === 200 && exactModelMatch
        ? "official-hardware-page-verified"
        : blocked
          ? "access-limited"
          : "needs-manual-route-review",
    calibration: "unverified",
    sha256: crypto.createHash("sha256").update(response.text).digest("hex"),
    checkedAt: response.checkedAt,
  });
  await fs.writeFile(
    "docs/phone-calibration/official-device-pages.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        scope:
          "Hardware identity only; not proof of status-bar firmware or geometry",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      modelId: model.modelId,
      status: rows.at(-1).status,
      title,
    }),
  );
}
await fs.writeFile(
  "docs/phone-calibration/official-device-pages.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      scope:
        "Hardware identity only; not proof of status-bar firmware or geometry",
      rows,
    },
    null,
    2,
  ) + "\n",
);
