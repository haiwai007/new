import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../artifacts/caishen-studio/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto(process.env.ICON_MEASURE_URL || "http://127.0.0.1:5194/");
  const bounds = await page.evaluate(async () => {
    const { APP_ICONS, builtinAppIconSource } =
      await import("/src/lib/phone/app-icon-catalog.ts");
    const result = {};
    for (const icon of APP_ICONS) {
      const url = builtinAppIconSource(icon.id).url;
      const svg = decodeURIComponent(url.split(",").slice(1).join(","));
      const box = svg
        .match(/viewBox="([^"]+)"/)[1]
        .split(/\s+/)
        .map(Number);
      const image = new Image();
      image.src = url;
      await image.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 192;
      const ctx = c.getContext("2d");
      ctx.drawImage(image, 0, 0, 192, 192);
      const d = ctx.getImageData(0, 0, 192, 192).data;
      let l = 192,
        t = 192,
        r = 0,
        b = 0;
      for (let y = 0; y < 192; y++)
        for (let x = 0; x < 192; x++)
          if (d[(y * 192 + x) * 4 + 3] > 16) {
            l = Math.min(l, x);
            t = Math.min(t, y);
            r = Math.max(r, x + 1);
            b = Math.max(b, y + 1);
          }
      if (r <= l) throw Error(icon.id);
      const s = Math.min(192 / box[2], 192 / box[3]),
        ox = (192 - box[2] * s) / 2,
        oy = (192 - box[3] * s) / 2;
      const side = (Math.max(r - l, b - t) / s) * 1.08;
      result[icon.id] = [
        box[0] + ((l + r) / 2 - ox) / s - side / 2,
        box[1] + ((t + b) / 2 - oy) / s - side / 2,
        side,
        side,
      ].map((v) => Number(v.toFixed(5)));
    }
    return result;
  });
  await fs.writeFile(
    "artifacts/caishen-studio/src/lib/phone/app-icon-ink.ts",
    "// Visible-ink bounds measured from locally bundled SVGs; scripts/measure-app-icon-ink.mjs.\nexport const APP_ICON_INK: Record<string, readonly number[]> = " +
      JSON.stringify(bounds, null, 2) +
      ";\n",
  );
  console.log("Measured", Object.keys(bounds).length, "icons");
} finally {
  await browser.close();
}
