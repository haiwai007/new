import { identifyModel } from "./model-match.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
const root = process.cwd();
const cache =
  process.env.PHONE_RESEARCH_CACHE ?? "/tmp/phone-source-research/collection";
const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
const decode = (text) =>
  text
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const plain = (text) =>
  decode(
    text
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
const box = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    await fs.readFile(
      path.join(root, "artifacts/caishen-studio/src/lib/phone/models.ts"),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  box,
);
const models = box.exports.PHONE_MODELS;
const english = (m) =>
  m.name
    .replace("小米", "Xiaomi")
    .replace("华为", "Huawei")
    .replace("荣耀", "Honor")
    .replace("一加", "OnePlus")
    .replace("（第 3 代）", "2022");
const identify = (text) =>
  identifyModel(
    text,
    models.map((m) => ({ id: m.id, name: english(m) })),
  );
const candidates = new Map(models.map((m) => [m.id, []]));
const records = new Map();
// Preserve prior verified discovery URLs; revalidate exact model identity before reuse.
try {
  const prior = JSON.parse(
    await fs.readFile(
      process.env.PHONE_RESEARCH_PRIOR ??
        path.join(root, "docs/phone-calibration/source-inventory.json"),
      "utf8",
    ),
  );
  for (const row of prior.models ?? [])
    if (row.review && identify(row.review.title) === row.modelId)
      candidates.get(row.modelId)?.push(row.review.url);
} catch {}

const checkedAt = new Date().toISOString();
let lastRequest = 0,
  searchBlocked = process.env.PHONE_RESEARCH_SKIP_SEARCH === "1";
await fs.mkdir(cache, { recursive: true });
async function request(url) {
  const parsed = new URL(url);
  if (
    !["www.notebookcheck.net", "html.duckduckgo.com"].includes(parsed.hostname)
  )
    throw Error("Unapproved source host");
  const key = sha(url),
    metaFile = path.join(cache, key + ".json"),
    bodyFile = path.join(cache, key + ".bin");
  try {
    const meta = JSON.parse(await fs.readFile(metaFile, "utf8"));
    return { ...meta, bytes: await fs.readFile(bodyFile) };
  } catch {}
  const wait = Math.max(0, 600 - (Date.now() - lastRequest));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      credentials: "omit",
    });
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 12_000_000) throw Error("Source exceeds 12MB limit");
    const meta = {
      requestedUrl: url,
      url: response.url,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      sha256: sha(data),
      checkedAt: new Date().toISOString(),
    };
    await fs.writeFile(bodyFile, data);
    await fs.writeFile(metaFile, JSON.stringify(meta));
    return { ...meta, bytes: data };
  } catch (e) {
    return {
      url,
      status: 0,
      contentType: "",
      sha256: "",
      error: String(e),
      checkedAt: new Date().toISOString(),
      bytes: Buffer.alloc(0),
    };
  }
}
function discover(html) {
  for (const m of html.matchAll(
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
  )) {
    let url;
    try {
      url = new URL(decode(m[1]), "https://www.notebookcheck.net/");
    } catch {
      continue;
    }
    if (
      url.hostname !== "www.notebookcheck.net" ||
      !/(review|test)[^/]*\.\d+\.0\.html$/i.test(url.pathname)
    )
      continue;
    const id = identify(plain(m[2]) + " " + url.pathname);
    if (id && !candidates.get(id).includes(url.href))
      candidates.get(id).push(url.href);
  }
}
function size(bytes) {
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (bytes[0] === 255 && bytes[1] === 216) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 255) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      i += 2;
      if (marker === 216 || marker === 217) continue;
      const length = bytes.readUInt16BE(i);
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      )
        return [bytes.readUInt16BE(i + 5), bytes.readUInt16BE(i + 3)];
      if (length < 2) break;
      i += length;
    }
  }
  return null;
}
async function inspect(model, url) {
  const r = await request(url);
  if (r.status !== 200) return null;
  const html = r.bytes.toString("utf8");
  if (/captcha|turnstile/i.test(html.slice(0, 5000))) return null;
  discover(html);
  const title = plain(
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
  );
  if (
    identify(title) !== model.id ||
    !/review/i.test(title) ||
    /collection|Notebookcheck News/i.test(title)
  )
    return null;
  const os = plain(
    html.match(
      /Operating System<\/div>\s*<div class="specs_details">([\s\S]*?)<\/div>/i,
    )?.[1] ?? "",
  );
  const dirs = [
    ...html.matchAll(
      /https:\/\/www\.notebookcheck\.net\/fileadmin\/Notebooks\/[^"<>\s]+/g,
    ),
  ]
    .map((m) => m[0])
    .filter((s) => !s.includes("&"));
  const directory = dirs[0]?.slice(0, dirs[0].lastIndexOf("/") + 1);
  const images = [
    ...html.matchAll(
      /<a\b[^>]*href="([^"]+\.(?:png|jpg|jpeg))"[^>]*>[\s\S]*?<img\b[^>]*>[\s\S]*?<\/a>/gi,
    ),
  ]
    .map((m) => decode(m[1]))
    .filter((s) => /screenshot|screenshots_os/i.test(s));
  const screenshots = [];
  for (const image of images.slice(0, 2)) {
    const processed = new URL(image, "https://www.notebookcheck.net/").href;
    const filename = path
      .basename(new URL(processed).pathname)
      .replace(/^csm_/, "")
      .replace(/_[a-f0-9]{10}(\.[^.]+)$/, "$1");
    const options = directory
      ? [
          new URL(filename, directory).href,
          ...(/\.png$/i.test(filename)
            ? [new URL(filename.replace(/\.png$/i, ".PNG"), directory).href]
            : []),
        ]
      : [];
    let asset;
    for (const option of [...new Set([...options, processed])]) {
      const response = await request(option),
        dimensions = size(response.bytes);
      if (response.status === 200 && dimensions) {
        asset = {
          url: response.url,
          discovery:
            option === processed
              ? "linked-scaled-image"
              : "publisher-original-path",
          contentType: response.contentType,
          sha256: response.sha256,
          width: dimensions[0],
          height: dimensions[1],
          nativeSizeMatch:
            dimensions[0] === model.width && dimensions[1] === model.height,
        };
        if (asset.nativeSizeMatch || option === processed) break;
      }
    }
    if (asset) screenshots.push(asset);
    if (asset?.nativeSizeMatch) break;
  }
  return {
    modelId: model.id,
    name: model.name,
    review: {
      url: r.url,
      title,
      sha256: r.sha256,
      reportedOs: os,
      checkedAt: r.checkedAt,
    },
    screenshots,
    status: screenshots.some((s) => s.nativeSizeMatch)
      ? "native-screenshot-candidate"
      : screenshots.length
        ? "scaled-screenshot-only"
        : "review-only",
    calibration: "reference",
    missing: [
      "exact-build-and-display-settings",
      "state-coverage",
      "rendered-overlay-comparison",
    ],
  };
}
const seeds = [
  "https://www.notebookcheck.net/Google-Pixel-9-review-The-small-Google-smartphone-has-taken-the-wrong-path.907380.0.html",
  "https://www.notebookcheck.net/Apple-iPhone-16-smartphone-review-More-innovations-than-one-would-think.908118.0.html",
  "https://www.notebookcheck.net/Samsung-Galaxy-S24-review-The-best-small-Android-smartphone-gets-cheaper-but-not-better.809474.0.html",
  "https://www.notebookcheck.net/Apple-iPhone-16-Pro-smartphone-review-The-small-Pro-phone-with-the-big-display.899301.0.html",
  "https://www.notebookcheck.net/Apple-iPhone-16-Plus-smartphone-review-The-big-one-with-a-new-design-and-lots-of-buttons.895629.0.html",
];
for (const url of seeds) {
  const r = await request(url);
  if (r.status === 200) discover(r.bytes.toString("utf8"));
  const id = identify(url);
  if (id && !candidates.get(id).includes(url)) candidates.get(id).unshift(url);
}
async function save() {
  const rows = models.map(
    (m) =>
      records.get(m.id) ?? {
        modelId: m.id,
        name: m.name,
        status: "no-verified-source",
        calibration: "reference",
        review: null,
        screenshots: [],
        missing: [
          "model-specific-review",
          "native-screenshot",
          "exact-build-and-display-settings",
          "state-coverage",
          "rendered-overlay-comparison",
        ],
      },
  );
  const output = {
    schemaVersion: 1,
    checkedAt,
    scope: "Public review discovery, not device calibration approval",
    searchBlocked,
    summary: {
      models: rows.length,
      nativeCandidates: rows.filter(
        (r) => r.status === "native-screenshot-candidate",
      ).length,
      scaledOnly: rows.filter((r) => r.status === "scaled-screenshot-only")
        .length,
      reviewsOnly: rows.filter((r) => r.status === "review-only").length,
      missing: rows.filter((r) => r.status === "no-verified-source").length,
      fullyCalibrated: 0,
    },
    models: rows,
  };
  await fs.writeFile(
    path.join(root, "docs/phone-calibration/source-inventory.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  return output.summary;
}
for (const model of models) {
  let found = null;
  for (const url of candidates.get(model.id).slice(0, 3)) {
    found = await inspect(model, url);
    if (found) break;
  }
  if (!found && !searchBlocked) {
    const search = await request(
      "https://html.duckduckgo.com/html/?q=" +
        encodeURIComponent(
          'site:notebookcheck.net "' + english(model) + '" review',
        ),
    );
    const html = search.bytes.toString("utf8");
    if (
      search.status !== 200 ||
      /anomaly\.js|bots use duckduckgo|challenge-form/i.test(html)
    )
      searchBlocked = true;
    else {
      for (const m of html.matchAll(
        /<a[^>]*class="result__a"[^>]*href="([^"]+)"/g,
      )) {
        try {
          const u = new URL(decode(m[1]), "https://duckduckgo.com");
          const dest = u.searchParams.get("uddg") ?? u.href;
          if (
            new URL(dest).hostname === "www.notebookcheck.net" &&
            !candidates.get(model.id).includes(dest)
          )
            candidates.get(model.id).push(dest);
        } catch {}
      }
      for (const url of candidates.get(model.id).slice(-4)) {
        found = await inspect(model, url);
        if (found) break;
      }
    }
  }
  if (found) records.set(model.id, found);
  console.log(
    JSON.stringify({
      modelId: model.id,
      status: found?.status ?? "no-verified-source",
    }),
  );
  await save();
}
// Later reviews can expose links for models processed earlier; revisit those candidates without more search requests.
for (let pass = 0; pass < 2; pass++)
  for (const model of models.filter((m) => !records.has(m.id))) {
    for (const url of candidates.get(model.id).slice(0, 5)) {
      const found = await inspect(model, url);
      if (found) {
        records.set(model.id, found);
        console.log(
          JSON.stringify({
            revisit: pass,
            modelId: model.id,
            status: found.status,
          }),
        );
        await save();
        break;
      }
    }
  }
console.log(JSON.stringify(await save()));
