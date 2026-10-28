import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
let errors: string[];
test.beforeEach(async ({ page, context }) => {
  await context.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function createCoffee(page: Page) {
  await page.goto("/templates");
  await page.getByLabel("搜索模板", { exact: true }).fill("咖啡");
  await page.getByRole("button", { name: "使用模板", exact: true }).click();
  await expect(page).toHaveURL(/\/draw\?/);
  await page.getByRole("button", { name: "图层编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  if (await page.getByRole("button", { name: "手机", exact: true }).isVisible())
    await page.getByRole("button", { name: "手机", exact: true }).click();
}
async function packaged(page: Page, info: TestInfo) {
  await page.getByRole("button", { name: "更多", exact: true }).click();
  const d = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
    .click();
  const path = info.outputPath("retained.json");
  await (await d).saveAs(path);
  return JSON.parse(await readFile(path, "utf8"));
}
test("retained catalogue exposes eleven templates without withdrawn categories on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/templates");
  await expect(
    page.getByText(
      "现有 11 套模板、8 个分类，可编辑图层，也可按参数批量生成。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(11);
  await expect(
    page.getByRole("navigation", { name: "模板分页", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^转账与收款/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /^机票与行程/ })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("转账模板渠道", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("搜索模板", { exact: true })
    .fill("海神作图 · 设计示例");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("搜索模板", { exact: true }).fill("咖啡");
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "只看收藏", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(1);
  await page.goto("/templates?category=transfer&channel=wechat");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(11);
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(
    page.getByLabel("模板分类", { exact: true }).locator("option"),
  ).toHaveCount(10);
  await page.getByLabel("模板分类", { exact: true }).selectOption("huimin-15");
  await expect(page).toHaveURL(/category=huimin-15/);
  await expect(
    page.getByText("惠民十五五暂无模板", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("模板分类", { exact: true })).toHaveValue(
    "huimin-15",
  );
  await page.getByLabel("模板分类", { exact: true }).selectOption("blank");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
test("retained templates still edit, save and export actual PNGs", async ({
  page,
}, info) => {
  await createCoffee(page);
  await page.getByRole("button", { name: "参数", exact: true }).click();
  const price = page
    .getByLabel("参数价格", { exact: true })
    .locator("input")
    .first();
  await price.fill("¥58");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const doc = await packaged(page, info);
  expect(doc.doc.layers.find((l: any) => l.id === "text_price").text).toBe(
    "¥58",
  );
  expect(
    doc.doc.layers.some(
      (l: any) => l.type === "text" && l.text.includes("海神作图 · 设计示例"),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const d = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "导出", exact: true })
    .click();
  const path = info.outputPath("retained.png");
  await (await d).saveAs(path);
  const image = await readFile(path);
  expect(image.readUInt32BE(16)).toBe(1080);
  expect(image.readUInt32BE(20)).toBe(1350);
  await page.reload();
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await expect(
    page.getByLabel("参数价格", { exact: true }).locator("input").first(),
  ).toHaveValue("¥58");
});
test("saved copies remain intact while batch selectors exclude withdrawn builtins", async ({
  page,
}, info) => {
  await createCoffee(page);
  const data = await packaged(page, info);
  data.doc.name = "历史标注模板";
  const text = data.doc.layers.find((l: any) => l.type === "text");
  data.doc.layers.push({
    ...text,
    id: "existing_example_label",
    text: "海神作图 · 设计示例",
    x: 40,
    y: 40,
    width: 900,
    height: 60,
    fontSize: 24,
  });
  await page.goto("/works");
  await page.locator('input[type="file"]').setInputFiles({
    name: "saved-copy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page).toHaveURL(/\/editor\//);
  const existingUrl = page.url();
  const saved = await packaged(page, info);
  expect(
    saved.doc.layers.find((l: any) => l.id === "existing_example_label").text,
  ).toBe("海神作图 · 设计示例");
  await page.goto("/templates?category=custom");
  await expect(page.getByText("历史标注模板", { exact: true })).toBeVisible();
  await page.goto("/batch?template=b%3Abt_pay_wechat_transfer_completed");
  const options = page
    .getByLabel("作图模板", { exact: true })
    .locator("option");
  expect(
    (
      await options.evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLOptionElement).value),
      )
    ).some(
      (v) =>
        v.startsWith("b:bt_pay_") ||
        v.startsWith("b:bt_transfer_") ||
        v.startsWith("b:bt_flight_"),
    ),
  ).toBe(false);
  await expect(
    page.getByLabel("筛选作图模板分类", { exact: true }).locator("option"),
  ).toHaveCount(10);
  await expect(page.getByLabel("批量转账渠道", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("筛选作图模板分类", { exact: true })
    .selectOption("huimin-15");
  await expect(
    page.getByLabel("作图模板", { exact: true }).locator("option"),
  ).toHaveCount(1);
  await page
    .getByLabel("筛选作图模板分类", { exact: true })
    .selectOption("all");
  await page
    .getByLabel("作图模板", { exact: true })
    .selectOption("b:bt_coffee");
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "生成 2 张图片", exact: true }),
  ).toBeEnabled();
  await page.goto(existingUrl);
  const after = await packaged(page, info);
  expect(
    after.doc.layers.find((l: any) => l.id === "existing_example_label").text,
  ).toBe("海神作图 · 设计示例");
});
