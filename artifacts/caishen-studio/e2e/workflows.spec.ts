import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(() => {
  expect(errors, "No browser runtime exceptions").toEqual([]);
});
async function createFromBuiltin(page: Page) {
  await page.goto("/templates");
  await page
    .getByRole("button", { name: "使用模板", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
}
async function textImage(page: Page, path: string) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 250;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 900, 250);
    ctx.fillStyle = "black";
    ctx.font = "bold 52px Arial";
    ctx.fillText("HELLO WORLD 123", 70, 140);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await writeFile(path, Buffer.from(encoded, "base64"));
}
async function exportPNG(page: Page, path: string) {
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "导出", exact: true })
    .click();
  await (await downloaded).saveAs(path);
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(bytes.length).toBeGreaterThan(1000);
  return bytes;
}
test("create, save, reload and export a fully local template", async ({
  page,
}, info) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      new URL(r.url()).origin !== new URL(page.url()).origin &&
      !r.url().startsWith("http://127.0.0.1:")
    )
      external.push(r.url());
  });
  await createFromBuiltin(page);
  await page.reload();
  const png = await exportPNG(page, info.outputPath("design.png"));
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1350);
  expect(external).toEqual([]);
});
test("complete backup restores photos, works and history without replacing originals", async ({
  page,
}, info) => {
  await createFromBuiltin(page);
  const image = info.outputPath("reference.png");
  await textImage(page, image);
  await page.goto("/custom");
  await page.locator("input[type=file]").setInputFiles(image);
  await page.getByRole("button", { name: /原图背景模式/ }).click();
  await page.getByRole("button", { name: "生成初始模板并进入编辑器" }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.goto("/backup");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份" }).click();
  const path = info.outputPath("workspace.json");
  await (await download).saveAs(path);
  const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.works).toHaveLength(2);
  expect(backup.versions).toHaveLength(4);
  expect(backup.assets.length).toBeGreaterThanOrEqual(2);
  await page.getByLabel("选择完整备份文件").setInputFiles(path);
  await expect(page.getByRole("heading", { name: "恢复预览" })).toBeVisible();
  await page.getByRole("button", { name: "确认恢复副本" }).click();
  await expect(page.getByText(/恢复完成：2 个作品/)).toBeVisible();
  await page.goto("/works");
  const copies = page.getByRole("link", { name: /打开作品.*备份恢复/ });
  await expect(copies).toHaveCount(2);
  await copies.first().click();
  await exportPNG(page, info.outputPath("restored.png"));
  await page.goto("/backup");
  await page.getByLabel("选择完整备份文件").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toContainText("备份文件格式无效");
  await expect(page.getByRole("button", { name: "确认恢复副本" })).toHaveCount(
    0,
  );
});
test("OCR loads the pinned engine locally, recognizes real text and creates an editable template", async ({
  page,
}, info) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (/^https:\/\//.test(r.url())) external.push(r.url());
  });
  await page.goto("/custom");
  const image = info.outputPath("ocr.png");
  await textImage(page, image);
  await page.locator("input[type=file]").setInputFiles(image);
  await page.getByRole("button", { name: "开始识别文字" }).click();
  await expect(
    page.getByRole("dialog", { name: "启用文字识别" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "同意并开始识别" }).click();
  await expect(
    page.getByRole("heading", { name: "自定义模板 · 识别结果" }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("textbox", { name: "第 1 条文字" })).toHaveValue(
    /HELLO WORLD 123/,
  );
  await page.getByRole("button", { name: /用 \d+ 条文字生成模板/ }).click();
  await expect(page).toHaveURL(/\/editor\//);
  expect(external).toEqual([]);
});
test("batch parameter rules produce two real PNG files inside a ZIP", async ({
  page,
}, info) => {
  await createFromBuiltin(page);
  await page.getByRole("button", { name: "另存为模板", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("批量测试");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/batch");
  await page.getByLabel("批量模板", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await page.getByRole("button", { name: "自动编号", exact: true }).first().click();
  await page.getByRole("button", { name: "生成 2 张图片", exact: true }).click();
  await expect(page.getByText("已生成 2 张图片", { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
  const path = info.outputPath("batch.zip");
  await (await downloaded).saveAs(path);
  const { unzipSync } = await import("fflate");
  const entries = Object.values(
    unzipSync(new Uint8Array(await readFile(path))),
  );
  expect(entries).toHaveLength(2);
  for (const entry of entries)
    expect(entry.subarray(0, 8)).toEqual(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    );
});
test("mobile layouts, local-only service status and 404 recovery", async ({
  page,
}) => {
  for (const width of [375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (width < 768) {
      await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "我的作品", exact: true }).click();
    } else {
      await page.locator("header").getByRole("link", { name: "做图", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/works$/);
  }
  for (const route of ["/account", "/admin"]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "云端服务未启用" }),
    ).toBeVisible();
  }
  await page.goto("/missing-page");
  await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();
  await page.getByRole("link", { name: "返回首页" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("phone model, status icons, date and battery persist and appear in PNG output", async ({
  page,
}, info) => {
  await createFromBuiltin(page);
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await page
    .getByRole("combobox", { name: "手机型号" })
    .selectOption("iphone16");
  await page.getByLabel("同时适配机型画布尺寸").check();
  await page.getByLabel("状态栏时间", { exact: true }).fill("13:08");
  await page.getByLabel("显示日期", { exact: true }).check();
  await page.getByLabel("状态栏日期", { exact: true }).fill("2026-10-25");
  await page.getByLabel("日期格式", { exact: true }).selectOption("iso");
  await page.getByLabel("电量百分比", { exact: true }).fill("67");
  await page.getByLabel("正在充电", { exact: true }).check();
  await page.locator("summary").filter({ hasText: "信号与网络" }).click();
  await page.getByRole("radiogroup", { name: "Wi-Fi", exact: true }).getByRole("radio").first().click();
  await page.getByLabel("蜂窝网络类型", { exact: true }).selectOption("5G");
  await page.getByRole("button", { name: "应用手机状态栏" }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await expect(page.getByLabel("电量百分比", { exact: true })).toHaveValue(
    "67",
  );
  await expect(page.getByLabel("状态栏时间", { exact: true })).toHaveValue(
    "13:08",
  );
  await expect(page.getByLabel("状态栏日期", { exact: true })).toHaveValue(
    "2026-10-25",
  );
  await expect(page.getByLabel("正在充电", { exact: true })).toBeChecked();
  const png = await exportPNG(page, info.outputPath("phone.png"));
  expect(png.readUInt32BE(16)).toBe(1179);
  expect(png.readUInt32BE(20)).toBe(2556);
  // Decode the real downloaded PNG to verify SVG status icons reached the exported canvas.
  const darkPixels = await page.evaluate(async (encoded) => {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = ctx.getImageData(800, 63, 325, 60).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i] < 70 &&
        pixels[i + 1] < 70 &&
        pixels[i + 2] < 70 &&
        pixels[i + 3] > 200
      )
        count++;
    const hardware = ctx.getImageData(430, 50, 300, 70).data;
    let hardwareDark = 0;
    for (let i = 0; i < hardware.length; i += 4)
      if (hardware[i] < 70 && hardware[i + 1] < 70 && hardware[i + 2] < 70)
        hardwareDark++;
    return { icons: count, hardwareDark };
  }, png.toString("base64"));
  expect(darkPixels.icons).toBeGreaterThan(100);
  expect(darkPixels.hardwareDark).toBe(0);
  await expect(
    page.getByLabel("显示灵动岛 / 刘海 / 开孔", { exact: true }),
  ).toBeChecked();
});

test("stale tabs preserve the winning original and create an editable conflict copy", async ({ page, context }) => {
  await createFromBuiltin(page);
  const originalUrl = page.url();
  const other = await context.newPage();
  await other.goto(originalUrl);
  await expect(other.getByLabel("项目名称", { exact: true })).toBeVisible();
  await page.getByLabel("项目名称", { exact: true }).fill("主标签页的新名称");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await other.getByLabel("项目名称", { exact: true }).fill("旧标签页的修改");
  await other.getByRole("button", { name: "保存", exact: true }).click();
  const recovery = other.getByRole("link", { name: "打开冲突副本继续编辑" });
  await expect(recovery).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue("主标签页的新名称");
  await recovery.click();
  await expect(other).not.toHaveURL(originalUrl);
  await expect(other.getByLabel("项目名称", { exact: true })).toHaveValue("旧标签页的修改（冲突副本）");
  await other.reload();
  await expect(other.getByLabel("项目名称", { exact: true })).toHaveValue("旧标签页的修改（冲突副本）");
  await other.close();
});

test("mobile editor keeps save, export and save status within the viewport", async ({ page }) => {
  await createFromBuiltin(page);
  for (const width of [320, 360, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const header = page.locator("header");
    for (const name of ["保存", "导出", "更多"]) {
      const button = header.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      await expect(button).toHaveCSS("height", "44px");
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(header.getByText("已保存到本地", { exact: true })).toBeVisible();
    expect(await header.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "更多", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "适应屏幕" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "导出图片" })).toBeVisible();
});

test("export log failure does not report a successful PNG download as failed", async ({ page }, info) => {
  await createFromBuiltin(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "exports") throw new DOMException("full export log", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await exportPNG(page, info.outputPath("export-without-log.png"));
  await expect(page.getByText("图片已生成并开始下载，导出记录未保存", { exact: true })).toBeVisible();
  await expect(page.getByText("导出失败", { exact: true })).toHaveCount(0);
});

test("transparent PNG omits background images", async ({ page }) => {
  await page.goto("/custom");
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0000ff";
    ctx.fillRect(0, 0, 100, 100);
    return canvas.toDataURL().split(",")[1];
  });
  await page.locator('input[type="file"]').setInputFiles({ name: "blue.png", mimeType: "image/png", buffer: Buffer.from(data, "base64") });
  await page.getByRole("button", { name: /原图背景模式/ }).click();
  await page.getByRole("button", { name: "生成初始模板并进入编辑器" }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await page.getByRole("dialog").getByRole("switch").click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "导出", exact: true }).click();
  const bytes = await readFile((await (await downloaded).path())!);
  const alpha = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(50, 50, 1, 1).data[3];
  }, bytes.toString("base64"));
  expect(alpha).toBe(0);
});
