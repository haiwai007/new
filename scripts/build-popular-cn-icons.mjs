import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { TARGETS } from "./popular-cn-app-targets.mjs";
const manifestPath = "docs/app-icons/popular-cn-sources.json",
  cache = "/tmp/popular-cn-artwork";
await fs.mkdir(cache, { recursive: true });
let previous;
try {
  previous = JSON.parse(await fs.readFile(manifestPath, "utf8"));
} catch {}
let selected;
if (previous) selected = previous.rows;
else {
  const { apps } = JSON.parse(
    await fs.readFile("/tmp/popular-cn-candidates.json", "utf8"),
  );
  selected = TARGETS.map(([id, name, query, pattern]) => {
    const app = apps.find((a) => new RegExp(pattern, "i").test(a.trackName));
    if (!app) throw Error("No exact candidate: " + id);
    return {
      id,
      name,
      query,
      trackId: app.trackId,
      trackName: app.trackName,
      bundleId: app.bundleId,
      sellerName: app.sellerName,
      storeUrl: app.trackViewUrl,
      artworkUrl: app.artworkUrl100,
    };
  });
}
if (new Set(selected.map((a) => a.trackId)).size !== selected.length)
  throw Error("Duplicate application identity");
const rows = [],
  icons = [];
for (const row of selected) {
  let bytes, mime;
  const file = `${cache}/${row.trackId}.bin`;
  try {
    bytes = await fs.readFile(file);
    mime = await fs.readFile(file + ".mime", "utf8");
  } catch {
    const r = await fetch(row.artworkUrl, {
      credentials: "omit",
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw Error(`${r.status} ${row.id}`);
    mime = r.headers.get("content-type")?.split(";")[0];
    bytes = Buffer.from(await r.arrayBuffer());
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(mime) ||
      bytes.length > 150000
    )
      throw Error("Unexpected artwork " + row.id);
    await fs.writeFile(file, bytes);
    await fs.writeFile(file + ".mime", mime);
    await new Promise((r) => setTimeout(r, 150));
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (row.sha256 && row.sha256 !== sha256)
    throw Error("Changed pinned artwork: " + row.id);
  rows.push({ ...row, mime, bytes: bytes.length, sha256 });
  icons.push({
    id: row.id,
    name: row.name,
    color: "#FF5A00",
    viewBox: "0 0 100 100",
    paths: [],
    imageData: `data:${mime};base64,${bytes.toString("base64")}`,
  });
  console.log(row.id, row.trackId, bytes.length);
}
await fs.writeFile(
  manifestPath,
  JSON.stringify(
    {
      scope:
        "Public App Store publisher artwork for app identification. Artwork rights remain with the respective publishers; not CC0/MIT artwork.",
      checkedAt: previous?.checkedAt ?? new Date().toISOString(),
      rows,
    },
    null,
    2,
  ) + "\n",
);
await fs.writeFile(
  "artifacts/caishen-studio/src/lib/phone/app-icon-popular-cn.ts",
  "// Offline publisher artwork. See docs/app-icons/popular-cn-sources.json and public/attributions/statusbar-app-icons.txt.\nexport const POPULAR_CN_APP_ICONS = " +
    JSON.stringify(icons, null, 2) +
    " as const;\n",
);
console.log(
  JSON.stringify({
    icons: icons.length,
    bytes: rows.reduce((n, r) => n + r.bytes, 0),
  }),
);
