// Collect public app-publisher artwork; retain provenance and bundle it for offline use.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { TARGETS } from "./popular-cn-app-targets.mjs";
const cache = "/tmp/popular-cn-apps";
await fs.mkdir(cache, { recursive: true });
await fs.mkdir("docs/app-icons", { recursive: true });
const candidates = new Map(),
  searches = [];
// Search at <= 20 requests/minute. A verification/rate limit stops collection.
let lastRequest = 0;
for (const target of TARGETS) {
  if (
    [...candidates.values()].some((app) =>
      new RegExp(target[3], "i").test(app.trackName),
    )
  )
    continue;
  const url =
    "https://itunes.apple.com/search?entity=software&country=cn&limit=8&term=" +
    encodeURIComponent(target[2]);
  const key = createHash("sha256").update(url).digest("hex");
  let result;
  try {
    result = JSON.parse(await fs.readFile(`${cache}/${key}.json`, "utf8"));
  } catch {
    await new Promise((r) =>
      setTimeout(r, Math.max(0, 3100 - (Date.now() - lastRequest))),
    );
    lastRequest = Date.now();
    const response = await fetch(url, {
      credentials: "omit",
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw Error(`${response.status}: ${url}`);
    result = await response.json();
    await fs.writeFile(`${cache}/${key}.json`, JSON.stringify(result));
  }
  searches.push({
    query: target[2],
    url,
    ids: result.results.map((a) => a.trackId),
  });
  for (const app of result.results) candidates.set(app.trackId, app);
  await fs.writeFile(
    "/tmp/popular-cn-candidates.json",
    JSON.stringify({ searches, apps: [...candidates.values()] }, null, 2),
  );
  console.log(target[2], result.results.map((a) => a.trackName).join(" | "));
}
