import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
const rows = JSON.parse(
  await fs.readFile("docs/phone-calibration/native-measurements.json", "utf8"),
);
const cache =
  process.env.PHONE_RESEARCH_CACHE ?? "/tmp/phone-calibration-reviewed";
await fs.mkdir(cache, { recursive: true });
for (const row of rows) {
  if (new URL(row.url).hostname !== "www.notebookcheck.net")
    throw Error("Unreviewed source host");
  const response = await fetch(row.url, {
    signal: AbortSignal.timeout(20000),
    credentials: "omit",
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("image/")
  )
    throw Error("Screenshot unavailable: " + row.id);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash("sha256").update(buffer).digest("hex") !== row.sha256)
    throw Error(
      "Screenshot changed; review it again before accepting: " + row.id,
    );
  row.file = path.join(cache, row.id + ".image");
  await fs.writeFile(row.file, buffer);
}
await fs.writeFile(
  path.join(cache, "measurement-input.json"),
  JSON.stringify(rows, null, 2) + "\n",
);
console.log(path.join(cache, "measurement-input.json"));
