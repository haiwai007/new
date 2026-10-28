import { test, expect } from "@playwright/test";
import {
  APP_ICONS,
  builtinAppIconSource,
} from "../src/lib/phone/app-icon-catalog";

test("all offline APP icons decode and brand colours survive canvas PNG encoding", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
  await page.goto("/draw");
  const icons = APP_ICONS.map((icon) => ({
    id: icon.id,
    name: icon.name,
    url: builtinAppIconSource(icon.id).url,
  }));
  const samples = await page.evaluate(async (icons) => {
    const gallery = document.createElement("div");
    gallery.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:#fff;display:grid;grid-template-columns:repeat(10,1fr);gap:12px;padding:20px;overflow:auto";
    document.body.append(gallery);
    const samples = [];
    for (const icon of icons) {
      const image = new Image();
      image.src = icon.url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 96;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0, 96, 96);
      // PNG round-trip checks the same browser image pipeline used by exports.
      const png = new Image();
      png.src = canvas.toDataURL("image/png");
      await png.decode();
      ctx.clearRect(0, 0, 96, 96);
      ctx.drawImage(png, 0, 0);
      const pixels = ctx.getImageData(0, 0, 96, 96).data;
      let visible = 0,
        coloured = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i + 3] > 200) {
          visible++;
          if (
            Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
              Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >
            40
          )
            coloured++;
        }
      samples.push({ id: icon.id, visible, coloured });
      const tile = document.createElement("div");
      tile.style.cssText = "text-align:center;color:#111;font:12px sans-serif";
      image.style.cssText =
        "display:block;width:48px;height:48px;object-fit:contain;margin:0 auto 6px";
      tile.append(image, document.createTextNode(icon.name));
      gallery.append(tile);
    }
    return samples;
  }, icons);
  expect(samples).toHaveLength(60);
  for (const sample of samples) {
    expect(sample.visible, sample.id).toBeGreaterThan(50);
    if (!["x", "notion", "github"].includes(sample.id))
      expect(sample.coloured, sample.id).toBeGreaterThan(50);
  }
  await page.screenshot({
    path: info.outputPath("colour-app-library.png"),
    fullPage: true,
  });
});
