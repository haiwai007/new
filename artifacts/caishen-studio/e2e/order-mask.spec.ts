import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import {
  makeTemplate,
  titleParam,
  textLayer,
} from "../src/lib/batch/test-fixtures";
import { defaultOrderRule } from "../src/lib/parameters/order";
test("masked orders can be entered manually and keep star positions in saved templates and frozen batch exports", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const doc = makeTemplate();
  doc.name = "脱敏订单号模板";
  doc.layers = [textLayer(titleParam.layerId, "6205****5522")];
  doc.parameters = [
    {
      ...titleParam,
      name: "订单号",
      type: "order",
      defaultValue: "6205****5522",
      rules: {},
      order: { ...defaultOrderRule(), length: 12 },
    },
  ];
  await page.goto("/works");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "masked-order.json",
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
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await page
    .getByRole("button", { name: "选择参数订单号", exact: true })
    .click();
  await page.getByLabel("订单号脱敏示例", { exact: true }).fill("6205****5522");
  await expect(
    page.getByLabel("订单号随机部分位数", { exact: true }),
  ).toHaveValue("12");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await page
    .getByRole("button", { name: "选择参数订单号", exact: true })
    .click();
  await expect(page.getByLabel("订单号脱敏示例", { exact: true })).toHaveValue(
    "6205****5522",
  );
  await page.getByRole("button", { name: "更多", exact: true }).click();
  const packed = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
    .click();
  const json = info.outputPath("masked-order.json");
  await (await packed).saveAs(json);
  const data = JSON.parse(await readFile(json, "utf8"));
  expect(data.doc.parameters[0].order).toMatchObject({
    length: 12,
    maskPattern: "6205****5522",
  });
  expect(data.doc.layers[0].text).toBe("6205****5522");
  await page.getByRole("button", { name: "进入作图", exact: true }).click();
  await expect(page).toHaveURL(/\/draw\?/);
  await page.getByRole("button", { name: "固定值", exact: true }).click();
  await page.getByLabel("订单号固定值", { exact: true }).fill("6205****5522");
  await expect(page.getByText(/字符类型或首位规则不符合/)).toHaveCount(0);
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await expect(page.getByLabel("第 1 张订单号", { exact: true })).toHaveText(
    "订单号：6205****5522",
  );
  await page
    .getByRole("button", { name: "生成 1 张图片", exact: true })
    .click();
  const single = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 PNG", exact: true }).click();
  const singlePath = info.outputPath("masked-single.png");
  await (await single).saveAs(singlePath);
  expect((await readFile(singlePath)).readUInt32BE(16)).toBe(600);
  await page.getByRole("button", { name: "按模板随机", exact: true }).click();
  await page.getByLabel("生成张数", { exact: true }).fill("3");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  const summaries = page.locator('[aria-label$="张订单号"]');
  await expect(summaries).toHaveCount(3);
  const before = await summaries.allTextContents();
  expect(new Set(before).size).toBe(3);
  for (const value of before)
    expect(value).toMatch(/^订单号：\d{4}\*{4}\d{4}$/);
  await page
    .getByRole("button", { name: "重新随机第 1 张", exact: true })
    .click();
  const after = await summaries.allTextContents();
  expect(after.slice(1)).toEqual(before.slice(1));
  expect(new Set(after).size).toBe(3);
  expect(after[0]).toMatch(/^订单号：\d{4}\*{4}\d{4}$/);
  await page
    .getByRole("button", { name: "生成 3 张图片", exact: true })
    .click();
  const batch = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
  const zip = info.outputPath("masked-batch.zip");
  await (await batch).saveAs(zip);
  expect(
    Object.values(unzipSync(new Uint8Array(await readFile(zip)))),
  ).toHaveLength(3);
  expect(await summaries.allTextContents()).toEqual(after);
  expect(errors).toEqual([]);
});
