import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
});
async function sourceImage(page: Page) {
  return page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 860;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f7f7f7";
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
  });
}
async function upload(page: Page) {
  await page.goto("/custom");
  const encoded = await sourceImage(page);
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
  await expect(dialog.getByText(/测试通过：/)).toBeVisible();
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

test("manual edits invalidate test approval and blank time areas cannot be confirmed", async ({
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
  await dialog.getByRole("button", { name: "测试替换", exact: true }).click();
  await expect(dialog.getByText(/测试通过：/)).toBeVisible();
  await dialog.getByLabel("定位区域", { exact: true }).selectOption("time");
  await dialog.getByLabel("定位区域 X", { exact: true }).fill("180");
  await expect(
    dialog.getByRole("button", { name: "确认并保存定位", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "测试替换", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/空白|未指定|区域/);
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
    .getByLabel("批量模板", { exact: true })
    .locator("option")
    .filter({ hasText: "location-source" });
  await expect(option).toHaveCount(1);
  await page
    .getByLabel("批量模板", { exact: true })
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

test("pointer adjustments support undo and overlapping protection blocks confirmation", async ({
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
  await d.getByLabel("定位区域", { exact: true }).selectOption("time");
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
  await d.getByRole("button", { name: "添加保护区", exact: true }).click();
  await d.getByLabel("定位区域 X", { exact: true }).fill("14");
  await d.getByLabel("定位区域 Y", { exact: true }).fill("12");
  await d.getByLabel("定位区域宽度", { exact: true }).fill("40");
  await d.getByLabel("定位区域高度", { exact: true }).fill("16");
  await d.getByRole("button", { name: "测试替换", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("保护区重叠");
  await expect(
    d.getByRole("button", { name: "确认并保存定位", exact: true }),
  ).toBeDisabled();
  await d.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByTestId("status-location-state")).toHaveText("待确认");
});
