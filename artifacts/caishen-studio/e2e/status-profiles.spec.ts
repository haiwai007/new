import { test, expect } from "@playwright/test";
import { PHONE_MODELS } from "../src/lib/phone/models";
import { naturalPhoneSettings, statusIconsSvg } from "../src/lib/phone/layers";
import { settingsForModel, systemStyleLabel } from "../src/lib/phone/profiles";

test("all phone models resolve system layouts and flight icons render offline in both themes", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
  await page.goto("/draw");
  const variants = PHONE_MODELS.flatMap((model) =>
    [false, true].map((airplane) => {
      const settings = settingsForModel(
        {
          ...naturalPhoneSettings(),
          airplane,
          wifi: 3,
          battery: 65,
          theme: airplane ? "light" : "dark",
        },
        model.id,
      );
      return {
        name: `${model.name} · ${systemStyleLabel(settings)} · ${airplane ? "飞行" : "蜂窝"}`,
        airplane,
        svg: statusIconsSvg(settings),
      };
    }),
  );
  const results = await page.evaluate(async (variants) => {
    const gallery = document.createElement("div");
    gallery.style.cssText =
      "position:absolute;inset:0;z-index:99999;background:#eee;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px";
    document.body.replaceChildren(gallery);
    const results = [];
    for (const variant of variants) {
      const image = new Image();
      image.src =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(variant.svg);
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth * 3;
      canvas.height = 60;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let visible = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 100) visible++;
      results.push({ name: variant.name, visible, width: canvas.width });
      const tile = document.createElement("div");
      tile.style.cssText = `padding:12px;border-radius:8px;background:${variant.airplane ? "#222" : "white"};color:${variant.airplane ? "white" : "#111"};font:11px sans-serif`;
      const label = document.createElement("div");
      label.textContent = variant.name;
      image.style.cssText =
        "display:block;height:30px;max-width:100%;margin-top:8px;object-fit:contain";
      tile.append(label, image);
      gallery.append(tile);
    }
    return results;
  }, variants);
  expect(results).toHaveLength(PHONE_MODELS.length * 2);
  for (const result of results) {
    expect(result.visible, result.name).toBeGreaterThan(100);
    expect(result.width, result.name).toBeGreaterThan(60);
  }
  await page.screenshot({
    path: info.outputPath("phone-system-layouts.png"),
    fullPage: true,
  });
});
