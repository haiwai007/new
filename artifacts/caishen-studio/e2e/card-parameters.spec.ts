import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import {
  makeTemplate,
  titleParam,
  textLayer,
} from "../src/lib/batch/test-fixtures";
import { defaultCardRule } from "../src/lib/parameters/card";
test("multiple fixed card heads, stars and random tails persist and work in single and frozen batch drawing", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const doc = makeTemplate();
  doc.name = "卡号参数模板";
  doc.layers = [textLayer(titleParam.layerId, "6205****0000")];
  doc.parameters = [
    {
      ...titleParam,
      name: "卡号",
      type: "card",
      defaultValue: "6205****0000",
      rules: {},
      card: defaultCardRule(),
    },
  ];
  await page.goto("/works");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "card.json",
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
  await page.getByRole("button", { name: "选择参数卡号", exact: true }).click();
  await page.getByLabel("卡号固定卡头", { exact: true }).fill("6205\n6222");
  await page.getByLabel("卡号星号数量", { exact: true }).fill("4");
  await page.getByLabel("卡号随机尾号位数", { exact: true }).fill("4");
  await page.getByRole("button", { name: "随机卡号示例", exact: true }).click();
  await expect(page.getByLabel("参数临时示例", { exact: true })).toHaveValue(
    /^(6205|6222)\*{4}\d{4}$/,
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await page.getByRole("button", { name: "选择参数卡号", exact: true }).click();
  await expect(page.getByLabel("卡号固定卡头", { exact: true })).toHaveValue(
    "6205\n6222",
  );
  await page.getByRole("button", { name: "更多", exact: true }).click();
  const packed = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
    .click();
  const json = info.outputPath("card-template.json");
  await (await packed).saveAs(json);
  const data = JSON.parse(await readFile(json, "utf8"));
  expect(data.doc.parameters[0]).toMatchObject({
    type: "card",
    card: { prefixes: ["6205", "6222"], maskCount: 4, tailLength: 4 },
  });
  await page.getByRole("button", { name: "进入作图", exact: true }).click();
  await expect(page).toHaveURL(/\/draw\?/);
  const single = page.getByLabel("第 1 张卡号", { exact: true });
  await expect(single).toHaveText(/^卡号：(6205|6222)\*{4}\d{4}$/);
  const first = await single.textContent();
  await page
    .getByRole("button", { name: "重新随机第 1 张", exact: true })
    .click();
  await expect(single).not.toHaveText(first!);
  await page
    .getByRole("button", { name: "生成 1 张图片", exact: true })
    .click();
  const image = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 PNG", exact: true }).click();
  const png = info.outputPath("single-card.png");
  await (await image).saveAs(png);
  expect((await readFile(png)).readUInt32BE(16)).toBe(600);
  await page.getByRole("button", { name: "图层编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await page.getByRole("button", { name: "随机生成卡号", exact: true }).click();
  await expect(page.getByLabel("卡号", { exact: true })).toHaveValue(
    /^(6205|6222)\*{4}\d{4}$/,
  );
  await page.getByRole("button", { name: "另存为模板", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("卡号批量测试");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/templates?category=custom");
  await page.getByLabel("搜索模板", { exact: true }).fill("卡号批量测试");
  await page.getByRole("button", { name: "使用模板", exact: true }).click();
  await page.getByLabel("生成张数", { exact: true }).fill("3");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  const rows = page.locator('[aria-label$="张卡号"]');
  await expect(rows).toHaveCount(3);
  const before = await rows.allTextContents();
  expect(new Set(before).size).toBe(3);
  for (const value of before)
    expect(value).toMatch(/^卡号：(6205|6222)\*{4}\d{4}$/);
  await page
    .getByRole("button", { name: "重新随机第 1 张", exact: true })
    .click();
  await expect(rows.first()).not.toHaveText(before[0]);
  const after = await rows.allTextContents();
  expect(after.slice(1)).toEqual(before.slice(1));
  expect(new Set(after).size).toBe(3);
  await page
    .getByRole("button", { name: "生成 3 张图片", exact: true })
    .click();
  const batch = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
  const zip = info.outputPath("cards.zip");
  await (await batch).saveAs(zip);
  const images = Object.values(unzipSync(new Uint8Array(await readFile(zip))));
  expect(images).toHaveLength(3);
  for (const image of images) {
    expect(Buffer.from(image).readUInt32BE(16)).toBe(600);
    expect(Buffer.from(image).readUInt32BE(20)).toBe(400);
  }
  expect(await rows.allTextContents()).toEqual(after);
  expect(errors).toEqual([]);
});
