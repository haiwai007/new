import { test, expect } from "@playwright/test";
import { PHONE_MODELS } from "../src/lib/phone/models";
import { naturalPhoneSettings, statusIconsSvg } from "../src/lib/phone/layers";
import { settingsForModel } from "../src/lib/phone/profiles";

test("inside battery percentages remain visible across every model and custom colour", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
  await page.goto("/draw");
  const cases = PHONE_MODELS.flatMap((model) =>
    ["#111111", "#ffffff"].map((customColor) => ({
      modelId: model.id,
      customColor,
      battery: 100,
      charging: false,
      lowPower: false,
    })),
  );
  for (const modelId of [
    "iphone16",
    "galaxys25",
    "galaxys24",
    "vivox200pro",
  ] as const)
    for (const battery of [0, 5, 20, 35, 50, 65, 100])
      for (const charging of [false, true])
        cases.push({
          modelId,
          battery,
          charging,
          lowPower: battery <= 20 && !charging,
          customColor: "#3b278b",
        });
  const pairs = cases.map((item) => {
    const settings = {
      ...settingsForModel(naturalPhoneSettings(), item.modelId),
      ...item,
      batteryStyle: "inside" as const,
      appIcons: [],
    };
    return {
      name: `${item.modelId}/${item.customColor}/${item.battery}/${item.charging}`,
      on: statusIconsSvg({ ...settings, showBatteryPercent: true }),
      off: statusIconsSvg({ ...settings, showBatteryPercent: false }),
    };
  });
  const results = await page.evaluate(async (pairs) => {
    async function pixels(svg: string) {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * 5;
      canvas.height = 100;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    const results = [];
    for (const item of pairs) {
      const on = await pixels(item.on),
        off = await pixels(item.off);
      let changed = 0;
      for (let i = 0; i < on.length; i += 4)
        if ([0, 1, 2, 3].some((c) => Math.abs(on[i + c] - off[i + c]) > 50))
          changed++;
      results.push({ name: item.name, changed });
    }
    return results;
  }, pairs);
  expect(results).toHaveLength(256);
  for (const result of results)
    expect(result.changed, result.name).toBeGreaterThan(4);
});
