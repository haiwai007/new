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
  await page
    .getByLabel("选择完整备份文件")
    .setInputFiles({
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
test("batch CSV produces two real PNG files inside a ZIP", async ({
  page,
}, info) => {
  await createFromBuiltin(page);
  await page.getByRole("button", { name: "另存为模板", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("批量测试");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/batch");
  await page.getByTestId("select-batch-template").selectOption({ index: 1 });
  await page
    .getByTestId("input-batch-csv")
    .setInputFiles({
      name: "data.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("主标题,价格\n新品一,¥28\n新品二,¥38\n"),
    });
  await expect(page.getByTestId("text-batch-validation-summary")).toContainText(
    "2 行可生成",
  );
  await page.getByTestId("button-generate-batch").click();
  await expect(page.getByTestId("status-generation-success")).toContainText(
    "已生成 2 张图片",
  );
  const downloaded = page.waitForEvent("download");
  await page.getByTestId("link-download-batch-zip").click();
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
    await expect(page.getByRole("button", { name: "打开菜单" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "打开菜单" }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "我的作品", exact: true })
      .click();
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
