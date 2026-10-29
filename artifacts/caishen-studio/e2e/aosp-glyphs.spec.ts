import { test, expect } from "@playwright/test";
import { aospSignal, aospWifi } from "../src/lib/phone/aosp-glyphs";
import { numericSvg } from "../src/lib/phone/numeric-font";
test("stock Android resources decode with distinct, increasing signal coverage and portable clock contours", async ({
  page,
}) => {
  await page.goto("/");
  const clock = numericSvg(
    "google-sans-17-500",
    "12:34",
    14,
    20,
    50,
    "#111111",
  );
  expect(clock).not.toContain("<text");
  expect(
    await page.evaluate(async (svg) => {
      const img = new Image();
      img.src = "data:image/svg+xml," + encodeURIComponent(svg);
      await img.decode();
      return img.naturalWidth;
    }, clock),
  ).toBe(50);
  const rows = [14, 15].flatMap((v) =>
    ["signal", "wifi"].flatMap((kind) =>
      (kind === "wifi" ? [1, 2, 3, 4] : [0, 1, 2, 3, 4]).map((level) => {
        const item =
          kind === "signal"
            ? aospSignal(level, v as 14 | 15)
            : aospWifi(level, v as 14 | 15);
        return {
          key: `${v}/${kind}`,
          level,
          svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${item.width}" height="20" viewBox="0 0 ${item.width} 20">${item.svg("#111111")}</svg>`,
        };
      }),
    ),
  );
  const results = await page.evaluate(async (rows) => {
    const out = [];
    for (const row of rows) {
      const img = new Image();
      img.src = "data:image/svg+xml," + encodeURIComponent(row.svg);
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width * 8;
      c.height = 160;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      let coverage = 0;
      for (
        let i = 3, d = ctx.getImageData(0, 0, c.width, c.height).data;
        i < d.length;
        i += 4
      )
        coverage += d[i] / 255;
      out.push({ ...row, svg: undefined, coverage });
    }
    return out;
  }, rows);
  for (const key of new Set(results.map((r) => r.key))) {
    const items = results.filter((r) => r.key === key);
    for (let i = 1; i < items.length; i++)
      expect(items[i].coverage, `${key}/${i}`).toBeGreaterThan(
        items[i - 1].coverage,
      );
  }
});
