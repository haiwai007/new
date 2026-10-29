// Download pinned, licensed sources; no font files are fetched by the application.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const target = process.argv[2] || "/tmp/phone-font-sources";
await fs.mkdir(target, { recursive: true });
const { rows } = JSON.parse(
  await fs.readFile("docs/phone-calibration/font-sources.json", "utf8"),
);
for (const row of rows)
  for (const [file, url, hash] of [
    [row.file, row.url, row.sha256],
    [row.licenseFile, row.licenseUrl, row.licenseSha256],
  ]) {
    const response = await fetch(url, {
      credentials: "omit",
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    let bytes = Buffer.from(await response.arrayBuffer());
    if (url.includes("format=TEXT"))
      bytes = Buffer.from(bytes.toString().trim(), "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== hash)
      throw new Error(`Source hash changed: ${file}`);
    await fs.writeFile(path.join(target, file), bytes);
    console.log(`Verified ${file}`);
  }
