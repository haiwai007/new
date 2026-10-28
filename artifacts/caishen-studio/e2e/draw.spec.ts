import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import {
  makeTemplate,
  titleParam,
  textLayer,
} from "../src/lib/batch/test-fixtures";
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
});
async function download(
  page: Page,
  info: import("@playwright/test").TestInfo,
  label: string,
  name: string,
) {
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: label, exact: true }).click();
  const file = info.outputPath(name);
  await (await event).saveAs(file);
  return readFile(file);
}
test("using a gallery template opens the unified existing batch workspace and one/many share values", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/templates");
  await page.getByLabel("搜索模板", { exact: true }).fill("咖啡");
  await page.getByRole("button", { name: "使用模板", exact: true }).click();
  await expect(page).toHaveURL(/\/draw\?template=b%3Abt_coffee/);
  await expect(
    page.getByRole("heading", { name: "做图", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("作图模板", { exact: true })).toHaveValue(
    "b:bt_coffee",
  );
  await expect(page.getByLabel("生成张数", { exact: true })).toHaveValue("1");
  const title = page.getByLabel("主标题固定值", { exact: true });
  await title.fill("统一工作台咖啡");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await page
    .getByRole("button", { name: "生成 1 张图片", exact: true })
    .click();
  const png = await download(page, info, "下载 PNG", "single.png");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  await page.getByRole("button", { name: "多张作图", exact: true }).click();
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await expect(title).toHaveValue("统一工作台咖啡");
  await expect(
    page.getByRole("link", { name: "下载 PNG", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await page
    .getByRole("button", { name: "生成 2 张图片", exact: true })
    .click();
  const zip = await download(page, info, "下载 ZIP", "many.zip");
  const images = Object.values(unzipSync(new Uint8Array(zip)));
  expect(images).toHaveLength(2);
  for (const image of images) expect(Buffer.from(image).equals(png)).toBe(true);
  await page.getByRole("button", { name: "单张作图", exact: true }).click();
  await expect(title).toHaveValue("统一工作台咖啡");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await page.getByRole("button", { name: "保存为作品", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "作品已保存" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "图层编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await expect(
    page.getByLabel("参数主标题", { exact: true }).locator("input").first(),
  ).toHaveValue("统一工作台咖啡");
  await page.goto("/works");
  await expect(page.getByLabel(/打开作品/)).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("custom template entry, refresh and legacy batch links work on a phone without editing the template", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const doc = makeTemplate();
  doc.name = "本地统一作图模板";
  doc.layers = [textLayer(titleParam.layerId, "原始内容")];
  doc.parameters = [{ ...titleParam, defaultValue: "原始内容", rules: {} }];
  await page.goto("/works");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "draw-template.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "caishen-template",
          formatVersion: 1,
          exportedAt: new Date().toISOString(),
          doc,
          assets: [],
        }),
      ),
    });
  await expect(page).toHaveURL(/\/editor\//);
  await page.goto("/templates?category=custom");
  await page.getByRole("button", { name: "使用模板", exact: true }).click();
  await expect(page).toHaveURL(/\/draw\?template=w%3A/);
  const sourceUrl = page.url();
  await page.reload();
  await expect(page.getByLabel("主标题固定值", { exact: true })).toHaveValue(
    "原始内容",
  );
  await page.getByLabel("主标题固定值", { exact: true }).fill("手机作图内容");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await page
    .getByRole("button", { name: "生成 1 张图片", exact: true })
    .click();
  const png = await download(page, info, "下载 PNG", "phone.png");
  expect(png.readUInt32BE(16)).toBe(600);
  expect(png.readUInt32BE(20)).toBe(400);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(sourceUrl.replace("/draw?", "/batch?"));
  await expect(
    page.getByRole("heading", { name: "做图", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("主标题固定值", { exact: true })).toHaveValue(
    "原始内容",
  );
});
test("numeric random ranges preserve plus prefixes and thousands grouping in exported and saved drawings", async ({ page }, info) => {
  const doc = makeTemplate();
  doc.name = "正号数字测试";
  doc.parameters = [{ ...titleParam, type: "number", defaultValue: "0.00", rules: { decimals: 2 } }];
  doc.layers = [textLayer(titleParam.layerId, "0.00")];
  await page.goto("/works");
  await page.locator('input[type="file"]').setInputFiles({
    name: "numeric-prefix.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "caishen-template", formatVersion: 1, exportedAt: new Date().toISOString(), doc, assets: [] })),
  });
  await expect(page).toHaveURL(/\/editor\//);
  await page.goto("/templates?category=custom");
  await page.getByRole("button", { name: "使用模板", exact: true }).click();
  await page.getByRole("button", { name: "随机区间", exact: true }).click();
  await page.getByLabel("最小值", { exact: true }).fill("125000");
  await page.getByLabel("最大值", { exact: true }).fill("375000");
  await page.getByLabel("小数位", { exact: true }).fill("2");
  await expect(page.getByRole("switch", { name: "主标题千位分隔符", exact: true })).toBeChecked();
  await page.getByLabel("前缀", { exact: true }).fill("+");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await page.getByRole("button", { name: "生成 1 张图片", exact: true }).click();
  const png = await download(page, info, "下载 PNG", "numeric-plus.png");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  await page.getByRole("button", { name: "图层编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await expect(page.getByLabel("参数主标题", { exact: true }).locator("input").first()).toHaveValue(/^\+\d{1,3}(,\d{3})+\.\d{2}$/);
  await expect(page.getByText("「主标题」必须是数字", { exact: true })).toHaveCount(0);
});
