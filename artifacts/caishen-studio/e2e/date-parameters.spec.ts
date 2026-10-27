import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  makeTemplate,
  titleParam,
  textLayer,
} from "../src/lib/batch/test-fixtures";
test("optional date seconds persist in templates and work in fixed and random batch exports", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const doc = makeTemplate();
  doc.name = "日期精度测试";
  doc.layers = [textLayer(titleParam.layerId, "2026-10-27")];
  doc.parameters = [
    {
      ...titleParam,
      name: "活动日期",
      type: "date",
      defaultValue: "2026-10-27",
      rules: {},
    },
  ];
  await page.goto("/works");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "date.haishen.json",
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
  await page.getByRole("button", { name: "进入作图", exact: true }).click();
  await page.getByRole("button", { name: "参数", exact: true }).click();
  const precision = page.getByLabel("活动日期日期精度", { exact: true }),
    input = page.getByLabel("活动日期", { exact: true });
  await expect(precision).toHaveValue("date");
  await expect(input).toHaveAttribute("step", "1");
  expect(await input.evaluate((el:HTMLInputElement)=>el.validity.valid)).toBe(true);
  await precision.selectOption("second");
  await expect(input).toHaveAttribute("step", "1");
  await input.fill("2026-10-27T20:06:37");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await expect(precision).toHaveValue("second");
  await expect(input).toHaveValue("2026-10-27T20:06:37");
  await page.getByRole("button", { name: "更多", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
    .click();
  const filename = info.outputPath("date.json");
  await (await downloaded).saveAs(filename);
  const packed = JSON.parse(await readFile(filename, "utf8"));
  expect(packed.doc.parameters[0].rules.datePrecision).toBe("second");
  expect(packed.doc.layers[0].text).toBe("2026-10-27 20:06:37");
  await page.getByRole("button", {name:"参数设置",exact:true}).click();
  const settings=page.getByRole("dialog");
  await settings.getByLabel("日期参数精度", {exact:true}).click();
  await page.getByRole("option", {name:"到分钟",exact:true}).click();
  await settings.getByRole("button", {name:"保存",exact:true}).click();
  await expect(settings).toHaveCount(0);
  await expect(input).toHaveValue("2026-10-27T20:06");
  await precision.selectOption("date");
  await expect(input).toHaveValue("2026-10-27");
  await precision.selectOption("second");
  await input.fill("2026-10-27T20:06:37");
  await page.getByRole("button", { name: "另存为模板", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("秒级日期批量");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/batch");
  const select = page.getByLabel("批量模板", { exact: true });
  const option = select.locator("option").filter({ hasText: "秒级日期批量" });
  await select.selectOption((await option.getAttribute("value"))!);
  await page.getByRole("button", { name: "固定值", exact: true }).click();
  await expect(
    page.getByLabel("活动日期日期精度", { exact: true }),
  ).toHaveValue("second");
  await page
    .getByLabel("活动日期", { exact: true })
    .fill("2026-10-27T20:06:38");
  await page.getByRole("button", { name: "随机时间段", exact: true }).click();
  const format = page
    .locator("select")
    .filter({ has: page.locator('option[value="yyyy-MM-dd HH:mm:ss"]') });
  await format.selectOption("yyyy-MM-dd HH:mm:ss");
  const times = page.locator('input[type="datetime-local"]');
  await expect(times).toHaveCount(2);
  await expect(times.first()).toHaveAttribute("step", "1");
  await times.nth(0).fill("2026-10-27T20:06:37");
  await times.nth(1).fill("2026-10-27T20:06:39");
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await page
    .getByRole("button", { name: "生成 2 张图片", exact: true })
    .click();
  await expect(
    page.getByText("已生成 2 张图片", { exact: true }),
  ).toBeVisible();
  const zip = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
  const zipfile = info.outputPath("seconds.zip");
  await (await zip).saveAs(zipfile);
  const { unzipSync } = await import("fflate");
  expect(
    Object.keys(unzipSync(new Uint8Array(await readFile(zipfile)))),
  ).toHaveLength(2);
  expect(errors).toEqual([]);
});
