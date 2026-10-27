import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
});
async function packageDoc(page: Page, info: TestInfo, name: string) {
  await page.getByRole("button", { name: "更多", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
    .click();
  const path = info.outputPath(name);
  await (await download).saveAs(path);
  return JSON.parse(await readFile(path, "utf8"));
}
async function exportPNG(page: Page, info: TestInfo, name: string) {
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "导出", exact: true }).click();
  const path = info.outputPath(name);
  await (await download).saveAs(path);
  return readFile(path);
}
test("expanded catalogue supports counts, semantic search, pagination, favorites and mobile categories", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/templates");
  await expect(
    page.getByText(
      "现有 331 套模板、15 个分类，可编辑图层，也可按参数批量生成。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(24);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(
    page.getByRole("status", { name: "模板筛选结果", exact: true }),
  ).toContainText("第 2 / 14 页");
  await page.getByRole("button", { name: /^机票与行程/ }).click();
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(20);
  await page.getByLabel("搜索模板", { exact: true }).fill("东京");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText("国际航班登机牌 · 示例", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  await page.getByRole("button", { name: "只看收藏", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "只看收藏", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "只看收藏", exact: true }).click();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByLabel("模板分类", { exact: true }).selectOption("credential");
  await page.getByLabel("搜索模板", { exact: true }).fill("头像 企业工作证");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("img", { name: "企业工作证 · 示例", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/haishen-catalog-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
for (const scenario of [
  {
    category: "transfer",
    query: "个人转账",
    id: "bt_transfer_personal",
    field: "金额",
    value: "258.50",
    width: 1080,
    height: 1680,
  },
  {
    category: "flight",
    query: "国际航班",
    id: "bt_flight_international",
    field: "乘机人",
    value: "示例旅客 / LIN HAI",
    width: 1080,
    height: 1560,
  },
  {
    category: "credential",
    query: "企业工作证",
    id: "bt_badge_employee",
    field: "姓名",
    value: "林海 / SAMPLE",
    width: 1000,
    height: 1440,
  },
  {
    category: "education",
    query: "课程结业",
    id: "bt_education_completion",
    field: "学员姓名",
    value: "示例学员 林海",
    width: 1600,
    height: 1120,
  },
])
  test(`new ${scenario.category} templates create editable works and export real PNGs`, async ({
    page,
  }, info) => {
    await page.goto(`/templates?category=${scenario.category}`);
    if(scenario.category==="transfer")await page.getByLabel("转账模板渠道",{exact:true}).selectOption("general");
    await page.getByLabel("搜索模板", { exact: true }).fill(scenario.query);
    await page.getByRole("button", { name: "使用模板", exact: true }).click();
    await expect(page).toHaveURL(/\/editor\//);
    await page.getByRole("button", { name: "参数", exact: true }).click();
    const field = page.getByLabel(`参数${scenario.field}`, { exact: true });
    await field.locator("input").first().fill(scenario.value);
    await field.locator("input").first().press("Tab");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const packed = await packageDoc(page, info, `${scenario.category}.json`);
    expect(packed.doc.templateId).toBe(page.url().split("/").pop());
    const p = packed.doc.parameters.find((p: any) => p.name === scenario.field);
    expect(packed.doc.layers.find((l: any) => l.id === p.layerId).text).toBe(
      scenario.value,
    );
    expect(
      packed.doc.layers.find((l: any) => l.id === "sample_footer").text,
    ).toMatch(/示例|样卡|纪念/);
    const png = await exportPNG(page, info, `${scenario.category}.png`);
    expect(png.readUInt32BE(16)).toBe(scenario.width);
    expect(png.readUInt32BE(20)).toBe(scenario.height);
    await page.reload();
    await page.getByRole("button", { name: "参数", exact: true }).click();
    await expect(
      page
        .getByLabel(`参数${scenario.field}`, { exact: true })
        .locator("input")
        .first(),
    ).toHaveValue(scenario.value);
  });
test("batch template category and keyword filters retain the selected rules and generate ticket ZIPs", async ({
  page,
}, info) => {
  await page.goto("/batch");
  await page
    .getByLabel("筛选批量模板分类", { exact: true })
    .selectOption("ticket");
  await expect(
    page.getByLabel("批量模板", { exact: true }).locator("option"),
  ).toHaveCount(13);
  await page.getByLabel("搜索批量模板", { exact: true }).fill("音乐现场");
  await page
    .getByLabel("批量模板", { exact: true })
    .selectOption("b:bt_ticket_concert");
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await page
    .getByLabel("搜索批量模板", { exact: true })
    .fill("不存在的其他模板");
  await expect(page.getByLabel("批量模板", { exact: true })).toHaveValue(
    "b:bt_ticket_concert",
  );
  await expect(page.getByText("观众姓名", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "生成 2 张图片", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "生成 2 张图片", exact: true })
    .click();
  await expect(
    page.getByText("已生成 2 张图片", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
  const path = info.outputPath("tickets.zip");
  await (await download).saveAs(path);
  const { unzipSync } = await import("fflate");
  const files = Object.values(unzipSync(new Uint8Array(await readFile(path))));
  expect(files).toHaveLength(2);
  for (const file of files) {
    expect(Buffer.from(file).readUInt32BE(16)).toBe(1440);
    expect(Buffer.from(file).readUInt32BE(20)).toBe(1000);
  }
});
