import { PHONE_MODELS, PHONE_BRANDS } from "../src/lib/phone/models";
import { DEVICE_LAYOUTS } from "../src/lib/phone/device-layouts";
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
});
async function sourceImage(page: Page, width = 400, gradient = false) {
  return page.evaluate(
    ({ width, gradient }) => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = Math.round((width * 860) / 400);
      const ctx = c.getContext("2d")!;
      ctx.scale(c.width / 400, c.height / 860);
      ctx.fillStyle = "#f7f7f7";
      if (gradient) {
        const g = ctx.createLinearGradient(0, 0, 400, 0);
        g.addColorStop(0, "#f7f7f7");
        g.addColorStop(1, "#d0d0d0");
        ctx.fillStyle = g;
      }
      ctx.fillRect(0, 0, 400, 860);
      ctx.fillStyle = "#111111";
      ctx.font = "14px Arial";
      ctx.fillText("20:06", 14, 24);
      ctx.font = "12px Arial";
      ctx.fillText("HD HD 65", 288, 24);
      ctx.fillStyle = "#55bbee";
      ctx.fillRect(65, 12, 12, 14);
      ctx.fillStyle = "#2288dd";
      ctx.fillRect(82, 12, 12, 14);
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.roundRect(300, 40, 90, 30, 15);
      ctx.fill();
      ctx.strokeStyle = "#dddddd";
      ctx.stroke();
      ctx.fillStyle = "#111111";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("收款小账本", 145, 63);
      ctx.fillText("补充经营信息，开启更多服务", 12, 115);
      ctx.fillStyle = "white";
      ctx.fillRect(12, 155, 376, 350);
      ctx.fillStyle = "#222222";
      ctx.font = "bold 30px Arial";
      ctx.fillText("¥18.80", 140, 245);
      return c.toDataURL().split(",")[1];
    },
    { width, gradient },
  );
}
async function upload(page: Page, width = 400, gradient = false) {
  await page.goto("/custom");
  const encoded = await sourceImage(page, width, gradient);
  await page.locator('input[type="file"]').setInputFiles({
    name: "location-source.png",
    mimeType: "image/png",
    buffer: Buffer.from(encoded, "base64"),
  });
  await page.getByText("保持原始尺寸", { exact: true }).click();
  await page.getByRole("button", { name: /原图背景模式/ }).click();
  await page
    .getByRole("button", { name: "生成初始模板并进入编辑器", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor\//);
  return encoded;
}
async function confirm(page: Page) {
  await page.getByRole("button", { name: "状态栏定位", exact: true }).click();
  await page.getByRole("button", { name: "定位原状态栏", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "模板状态栏定位",
    exact: true,
  });
  await expect(
    dialog.getByRole("img", { name: "状态栏定位原图", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "自动定位", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "自动定位", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "测试替换", exact: true }).click();
  await expect(dialog.getByText(/预览已生成：/)).toBeVisible();
  await expect(dialog.getByText(/预览已生成：/)).toContainText(
    "外框外 0 个像素变化",
  );
  await dialog
    .getByRole("button", { name: "确认并保存定位", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
}

test("template automatically proposes a location, confirms by pixel test and replaces in place", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const encoded = await upload(page);
  await expect(page.getByTestId("status-location-state")).toHaveText("待确认");
  await expect(
    page.getByRole("button", { name: "手机", exact: true }),
  ).toHaveCount(0);
  await confirm(page);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "状态栏定位", exact: true }).click();
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
  await page.getByRole("button", { name: "进入作图", exact: true }).click();
  await page.getByRole("button", { name: "图层编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  if (await page.getByRole("button", { name: "手机", exact: true }).isVisible())
    await page.getByRole("button", { name: "手机", exact: true }).click();
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
  await page.getByLabel("手机品牌", { exact: true }).selectOption("Samsung");
  await page.getByLabel("状态栏时间", { exact: true }).fill("13:08");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "导出", exact: true })
    .click();
  const path = info.outputPath("located.png");
  await (await download).saveAs(path);
  const bytes = await readFile(path);
  expect(bytes.readUInt32BE(16)).toBe(400);
  expect(bytes.readUInt32BE(20)).toBe(860);
  const diff = await page.evaluate(
    async ([a, b]) => {
      const pixels = async (s: string) => {
        const i = await createImageBitmap(
          new Blob([Uint8Array.from(atob(s), (c) => c.charCodeAt(0))], {
            type: "image/png",
          }),
        );
        const c = document.createElement("canvas");
        c.width = i.width;
        c.height = i.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(i, 0, 0);
        i.close();
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const x = await pixels(a),
        y = await pixels(b);
      let outside = 0,
        inside = 0;
      for (let i = 0; i < x.length; i += 4)
        if ([0, 1, 2, 3].some((k) => x[i + k] !== y[i + k])) {
          const row = Math.floor(i / 4 / 400);
          if (row >= 38) outside++;
          else inside++;
        }
      return { outside, inside };
    },
    [encoded, bytes.toString("base64")],
  );
  expect(diff.outside).toBe(0);
  expect(diff.inside).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("manual selections can be saved without preview even when the time region is blank", async ({
  page,
}) => {
  await upload(page);
  await page.getByRole("button", { name: "状态栏定位", exact: true }).click();
  await page.getByRole("button", { name: "定位原状态栏", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "模板状态栏定位",
    exact: true,
  });
  await dialog.getByRole("button", { name: "自动定位", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "自动定位", exact: true }),
  ).toBeEnabled();
  await expect(dialog.getByLabel("定位区域", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("定位区域宽度", { exact: true }).fill("200");
  await dialog.getByLabel("定位区域 X", { exact: true }).fill("180");
  await expect(
    dialog.getByRole("button", { name: "确认并保存定位", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "确认并保存定位", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("confirmed locations survive template import and full backup with original images intact", async ({
  page,
  browser,
}, info) => {
  const encoded = await upload(page);
  await confirm(page);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "更多", exact: true }).click();
  const fileDownload = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
    .click();
  const path = info.outputPath("located-template.haishen.json");
  await (await fileDownload).saveAs(path);
  const packaged = JSON.parse(await readFile(path, "utf8"));
  expect(packaged.doc.statusLocation.state).toBe("confirmed");
  expect(
    packaged.assets.find(
      (a: any) => a.id === packaged.doc.source.originalAssetId,
    ).data,
  ).toBe(encoded);
  expect(packaged.doc.phone).toBeUndefined();
  await page.goto("/backup");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份", exact: true }).click();
  const backup = info.outputPath("located-backup.json");
  await (await download).saveAs(backup);
  for (const mode of ["template", "backup"] as const) {
    const context = await browser.newContext({
      baseURL: new URL("/", page.url()).href,
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(() =>
      sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
    );
    try {
      const fresh = await context.newPage();
      if (mode === "template") {
        await fresh.goto("/works");
        await fresh.locator('input[type="file"]').setInputFiles(path);
        await expect(fresh).toHaveURL(/\/editor\//);
      } else {
        await fresh.goto("/backup");
        await fresh
          .getByLabel("选择完整备份文件", { exact: true })
          .setInputFiles(backup);
        await fresh.getByRole("button", { name: /确认恢复/ }).click();
        await expect(fresh.getByText(/恢复完成：/)).toBeVisible();
        await fresh.goto("/works");
        await fresh
          .getByRole("link", { name: /打开作品.*备份恢复/ })
          .first()
          .click();
      }
      await fresh
        .getByRole("button", { name: "状态栏定位", exact: true })
        .click();
      await expect(fresh.getByTestId("status-location-state")).toHaveText(
        "已确认",
      );
      await fresh.getByRole("button", { name: "更多", exact: true }).click();
      const again = fresh.waitForEvent("download");
      await fresh
        .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
        .click();
      const restoredPath = info.outputPath(`${mode}-restored.json`);
      await (await again).saveAs(restoredPath);
      const restored = JSON.parse(await readFile(restoredPath, "utf8"));
      expect(restored.doc.statusLocation.bounds).toEqual(
        packaged.doc.statusLocation.bounds,
      );
      expect(restored.doc.source.originalAssetId).not.toBe(
        packaged.doc.source.originalAssetId,
      );
      expect(
        restored.assets.find(
          (a: any) => a.id === restored.doc.source.originalAssetId,
        ).data,
      ).toBe(encoded);
    } finally {
      await context.close();
    }
  }
});

test("batch reuses a confirmed template location and freezes exported results", async ({
  page,
}, info) => {
  await upload(page);
  await confirm(page);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.goto("/batch");
  const option = page
    .getByLabel("作图模板", { exact: true })
    .locator("option")
    .filter({ hasText: "location-source" });
  await expect(option).toHaveCount(1);
  await page
    .getByLabel("作图模板", { exact: true })
    .selectOption((await option.getAttribute("value"))!);
  await page.getByLabel("生成张数", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "状态栏修改状态栏", exact: true })
    .click();
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
  await page.getByRole("button", { name: "时间区间随机", exact: true }).click();
  await page.getByLabel("随机开始时间", { exact: true }).fill("22:00");
  await page.getByLabel("随机结束时间", { exact: true }).fill("02:00");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  const summaries = page.locator('[aria-label$="张状态栏"]');
  await expect(summaries).toHaveCount(3);
  const before = await summaries.allTextContents();
  await page
    .getByRole("button", { name: "生成 3 张图片", exact: true })
    .click();
  await expect(
    page.getByText("已生成 3 张图片", { exact: true }),
  ).toBeVisible();
  expect(await summaries.allTextContents()).toEqual(before);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
  const path = info.outputPath("located-batch.zip");
  await (await download).saveAs(path);
  const { unzipSync } = await import("fflate");
  const images = Object.values(unzipSync(new Uint8Array(await readFile(path))));
  expect(images).toHaveLength(3);
  for (const data of images) {
    const png = Buffer.from(data);
    expect(png.readUInt32BE(16)).toBe(400);
    expect(png.readUInt32BE(20)).toBe(860);
  }
});

test("outer-frame adjustments support undo and confirmation without inner slots", async ({
  page,
}) => {
  await upload(page);
  await page.getByRole("button", { name: "状态栏定位", exact: true }).click();
  await page.getByRole("button", { name: "定位原状态栏", exact: true }).click();
  const d = page.getByRole("dialog", { name: "模板状态栏定位", exact: true });
  await d.getByRole("button", { name: "自动定位", exact: true }).click();
  await expect(
    d.getByRole("button", { name: "自动定位", exact: true }),
  ).toBeEnabled();
  await expect(d.getByLabel("定位区域", { exact: true })).toHaveCount(0);
  await d.getByLabel("定位区域宽度", { exact: true }).fill("350");
  const x = d.getByLabel("定位区域 X", { exact: true });
  const original = await x.inputValue();
  const handle = await d.locator('rect[data-handle="move"]').boundingBox();
  expect(handle).not.toBeNull();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle!.x + handle!.width / 2 + 20,
    handle!.y + handle!.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(x).not.toHaveValue(original);
  await d.getByRole("button", { name: "撤销定位", exact: true }).click();
  await expect(x).toHaveValue(original);
  await expect(
    d.getByRole("button", { name: "添加保护区", exact: true }),
  ).toHaveCount(0);
  await expect(
    d.getByRole("button", { name: "确认并保存定位", exact: true }),
  ).toBeEnabled();
  await d.getByRole("button", { name: "确认并保存定位", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
  await page.getByRole("button", { name: "进入作图", exact: true }).click();
  await page.getByRole("button", { name: "图层编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  if (await page.getByRole("button", { name: "手机", exact: true }).isVisible())
    await page.getByRole("button", { name: "手机", exact: true }).click();
  await page.getByLabel("手机品牌", { exact: true }).selectOption("Samsung");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const width of [400, 1080, 1179]) {
  test(`fractional manual regions confirm and preserve every outside export pixel at ${width}px`, async ({
    page,
  }, info) => {
    const source = await upload(page, width, true);
    await page.getByRole("button", { name: "状态栏定位", exact: true }).click();
    await page
      .getByRole("button", { name: "定位原状态栏", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "模板状态栏定位",
      exact: true,
    });
    await dialog.getByRole("button", { name: "自动定位", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "自动定位", exact: true }),
    ).toBeEnabled();
    await expect(dialog.getByLabel("定位区域", { exact: true })).toHaveCount(0);
    const x = dialog.getByLabel("定位区域 X", { exact: true });
    const w = dialog.getByLabel("定位区域宽度", { exact: true });
    const originalX = Number(await x.inputValue()),
      originalWidth = Number(await w.inputValue());
    await w.fill(String(originalWidth - 0.54));
    await x.fill(String(originalX + 0.27));

    const y = dialog.getByLabel("定位区域 Y", { exact: true });
    const h = dialog.getByLabel("定位区域高度", { exact: true });
    const originalY = Number(await y.inputValue()),
      originalHeight = Number(await h.inputValue());
    await y.fill(String(originalY + 0.23));
    await h.fill(String(originalHeight - 0.46));
    await dialog.getByRole("button", { name: "测试替换", exact: true }).click();
    await expect(dialog.getByText(/预览已生成：/)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "确认并保存定位", exact: true }),
    ).toBeEnabled();
    await dialog
      .getByRole("button", { name: "确认并保存定位", exact: true })
      .click();
    await page.getByRole("button", { name: "进入作图", exact: true }).click();
    await page.getByRole("button", { name: "图层编辑", exact: true }).click();
    await expect(page).toHaveURL(/\/editor\//);
    if (
      await page.getByRole("button", { name: "手机", exact: true }).isVisible()
    )
      await page.getByRole("button", { name: "手机", exact: true }).click();
    await page.getByLabel("手机品牌", { exact: true }).selectOption("Samsung");
    await page.getByLabel("状态栏时间", { exact: true }).fill("13:08");
    await page.getByRole("button", { name: "更多", exact: true }).click();
    const metadataDownload = page.waitForEvent("download");
    await page
      .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
      .click();
    const jsonPath = info.outputPath("fractional.json");
    await (await metadataDownload).saveAs(jsonPath);
    const { doc } = JSON.parse(await readFile(jsonPath, "utf8"));
    await page.getByRole("button", { name: "导出", exact: true }).click();
    const outputWidth = width === 400 ? width * 3 : width;
    if (outputWidth !== width)
      await page
        .getByPlaceholder("自定义宽度 px", { exact: true })
        .fill(String(outputWidth));
    const imageDownload = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "导出", exact: true })
      .click();
    const imagePath = info.outputPath("fractional.png");
    await (await imageDownload).saveAs(imagePath);
    const bytes = await readFile(imagePath);
    expect(bytes.readUInt32BE(16)).toBe(outputWidth);
    const diff = await page.evaluate(
      async ({ source, result, location, outputWidth }) => {
        const read = async (s: string) => {
          const image = await createImageBitmap(
            new Blob([Uint8Array.from(atob(s), (c) => c.charCodeAt(0))], {
              type: "image/png",
            }),
          );
          const c = document.createElement("canvas");
          c.width = outputWidth;
          c.height = Math.round((image.height * outputWidth) / image.width);
          const ctx = c.getContext("2d")!;
          ctx.drawImage(image, 0, 0, c.width, c.height);
          image.close();
          return {
            w: c.width,
            h: c.height,
            data: ctx.getImageData(0, 0, c.width, c.height).data,
          };
        };
        const a = await read(source),
          b = await read(result);
        const roles = [location.bounds];
        const contains = (r: any, x: number, y: number) =>
          x >= r.x - 1e-7 &&
          y >= r.y - 1e-7 &&
          x <= r.x + r.width + 1e-7 &&
          y <= r.y + r.height + 1e-7;
        let outside = 0,
          protectedChanges = 0,
          inside = 0;
        for (let yy = 0; yy < a.h; yy++)
          for (let xx = 0; xx < a.w; xx++) {
            const i = (yy * a.w + xx) * 4;
            if (![0, 1, 2, 3].some((k) => a.data[i + k] !== b.data[i + k]))
              continue;
            const x = (xx + 0.5) / a.w,
              y = (yy + 0.5) / a.h;
            if (!roles.some((r) => contains(r, x, y))) outside++;
            else inside++;
            if (location.protected.some((r: any) => contains(r, x, y)))
              protectedChanges++;
          }
        return { outside, protectedChanges, inside };
      },
      {
        source,
        outputWidth,
        result: bytes.toString("base64"),
        location: doc.statusLocation,
      },
    );
    expect(diff.outside).toBe(0);
    expect(diff.protectedChanges).toBe(0);
    expect(diff.inside).toBeGreaterThan(0);
  });
}

for (const brand of PHONE_BRANDS) {
  test(`independent layouts export each ${brand} model and version without changing pixels outside the frame`, async ({
    page,
  }, info) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const original = await upload(page);
    await confirm(page);
    await page.getByRole("button", { name: "进入作图", exact: true }).click();
    await page.getByRole("button", { name: "图层编辑", exact: true }).click();
    await expect(page).toHaveURL(/\/editor\//);
    if (
      await page.getByRole("button", { name: "手机", exact: true }).isVisible()
    )
      await page.getByRole("button", { name: "手机", exact: true }).click();
    await page.getByLabel("手机品牌", { exact: true }).selectOption(brand);
    await page.getByRole("button", { name: "更多", exact: true }).click();
    const metaEvent = page.waitForEvent("download");
    await page
      .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
      .click();
    const metaPath = info.outputPath("frame.json");
    await (await metaEvent).saveAs(metaPath);
    const frame = JSON.parse(await readFile(metaPath, "utf8")).doc
      .statusLocation.bounds;
    for (const model of PHONE_MODELS.filter((m) => m.brand === brand)) {
      await page.getByLabel("手机型号", { exact: true }).selectOption(model.id);
      for (const version of Object.keys(DEVICE_LAYOUTS[model.id].versions)) {
        await page
          .getByLabel("系统参考样式", { exact: true })
          .selectOption(version);
        await page.getByRole("button", { name: "导出", exact: true }).click();
        const event = page.waitForEvent("download");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "导出", exact: true })
          .click();
        const path = info.outputPath(`${model.id}-${version}.png`);
        await (await event).saveAs(path);
        // A download starts before export history is saved and the dialog closes.
        // Wait for completion before opening the next export, avoiding a stale close.
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const bytes = await readFile(path);
        expect(bytes.readUInt32BE(16), model.id).toBe(400);
        expect(bytes.readUInt32BE(20), model.id).toBe(860);
        const changedOutside = await page.evaluate(
          async ({ original, png, frame }) => {
            async function pixels(s: string) {
              const img = await createImageBitmap(
                new Blob([Uint8Array.from(atob(s), (c) => c.charCodeAt(0))], {
                  type: "image/png",
                }),
              );
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(img, 0, 0);
              img.close();
              return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            }
            const a = await pixels(original),
              b = await pixels(png);
            let outside = 0;
            for (let y = 0; y < 860; y++)
              for (let x = 0; x < 400; x++) {
                if (
                  (x + 0.5) / 400 >= frame.x - 1e-7 &&
                  (x + 0.5) / 400 <= frame.x + frame.width + 1e-7 &&
                  (y + 0.5) / 860 >= frame.y - 1e-7 &&
                  (y + 0.5) / 860 <= frame.y + frame.height + 1e-7
                )
                  continue;
                const i = (y * 400 + x) * 4;
                if ([0, 1, 2, 3].some((c) => a[i + c] !== b[i + c])) outside++;
              }
            return outside;
          },
          { original, png: bytes.toString("base64"), frame },
        );
        expect(changedOutside, `${model.id}/${version}`).toBe(0);
      }
    }
    expect(errors).toEqual([]);
  });
}

test("source status follows exact model and system version without inheriting approval", async ({
  page,
}) => {
  await upload(page);
  await confirm(page);
  await page.getByRole("button", { name: "进入作图", exact: true }).click();
  await page.getByRole("button", { name: "图层编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "手机", exact: true }).click();
  const status = page.getByTestId("phone-layout-calibration");
  for (const item of [
    {
      brand: "Apple",
      model: "iphone16",
      partial: "ios1801",
      reference: "ios18",
    },
    {
      brand: "Google",
      model: "pixel9",
      partial: "pixel14",
      reference: "pixel15",
    },
    {
      brand: "Samsung",
      model: "galaxys24",
      partial: "oneui61",
      reference: "oneui7",
    },
  ]) {
    await page.getByLabel("手机品牌", { exact: true }).selectOption(item.brand);
    await page.getByLabel("手机型号", { exact: true }).selectOption(item.model);
    const style = page.getByLabel("系统参考样式", { exact: true });
    await style.selectOption(item.partial);
    await expect(status).toContainText("部分核对（样本位置）");
    await expect(status.getByRole("link")).toHaveAttribute(
      "href",
      /notebookcheck\.net/,
    );
    await style.selectOption(item.reference);
    await expect(status).toContainText("参考适配（尚未真机核准）");
    await expect(status.getByRole("link")).toHaveCount(0);
  }
});
