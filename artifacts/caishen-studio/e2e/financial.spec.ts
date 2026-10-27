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
async function packaged(page: Page, info: TestInfo) {
  await page.getByRole("button", { name: "更多", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
    .click();
  const path = info.outputPath("payment.json");
  await (await download).saveAs(path);
  return JSON.parse(await readFile(path, "utf8"));
}
async function exportPNG(page: Page, info: TestInfo) {
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "导出", exact: true })
    .click();
  const path = info.outputPath("payment.png");
  await (await download).saveAs(path);
  return readFile(path);
}
async function watermarkPixels(
  page: Page,
  bytes: Buffer,
  width: number,
  height: number,
) {
  return page.evaluate(
    async ({ data, width, height }) => {
      const b = await createImageBitmap(
        new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], {
          type: "image/png",
        }),
      );
      const c = document.createElement("canvas");
      c.width = b.width;
      c.height = b.height;
      const x = c.getContext("2d")!;
      x.drawImage(b, 0, 0);
      b.close();
      const pixels = x.getImageData(
        width === 1600 ? 590 : 160,
        width === 1600 ? 1010 : height - 174,
        width === 1600 ? 850 : 760,
        64,
      ).data;
      let colored = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
            Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >
            24 &&
          pixels[i + 3] > 200
        )
          colored++;
      return colored;
    },
    { data: bytes.toString("base64"), width, height },
  );
}
test("payment catalogue filters 220 examples by wallet, bank and transaction scene on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/templates?category=transfer");
  await expect(
    page.getByRole("status", { name: "模板筛选结果", exact: true }),
  ).toContainText("找到 220 套");
  await page.getByLabel("转账模板渠道", { exact: true }).selectOption("wechat");
  await expect(
    page.getByRole("status", { name: "模板筛选结果", exact: true }),
  ).toContainText("找到 40 套");
  await page
    .getByLabel("转账模板业务场景", { exact: true })
    .selectOption("refund");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(5);
  await page.getByLabel("搜索模板", { exact: true }).fill("部分退款");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("转账模板渠道", { exact: true })).toHaveValue(
    "wechat",
  );
  await expect(
    page.getByLabel("转账模板业务场景", { exact: true }),
  ).toHaveValue("refund");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(5);
  await page
    .getByLabel("转账模板业务场景", { exact: true })
    .selectOption("all");
  await page.getByLabel("转账模板渠道", { exact: true }).selectOption("icbc");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(6);
  await page.getByLabel("搜索模板", { exact: true }).fill("工行转账");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(2);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByLabel("搜索模板", { exact: true }).fill("");
  await page.getByLabel("转账模板渠道", { exact: true }).selectOption("alipay");
  await page.getByLabel("搜索模板", { exact: true }).fill("银行卡提现");
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/haishen-payments-mobile.png",
    fullPage: true,
  });
});
for (const layout of [
  { channel: "wechat", query: "个人转账完成", width: 1080, height: 1720 },
  { channel: "alipay", query: "转账待收款", width: 1080, height: 1720 },
  { channel: "icbc", query: "个人网银转账", width: 1600, height: 1180 },
  { channel: "wechat", query: "转账超时退回", width: 1080, height: 1720 },
  { channel: "icbc", query: "企业批量代发", width: 1080, height: 1720 },
  { channel: "alipay", query: "银行卡提现退回", width: 1080, height: 1640 },
  { channel: "icbc", query: "企业网银付款", width: 1080, height: 1720 },
  { channel: "icbc", query: "跨行汇款详情", width: 1600, height: 1180 },
])
  test(`${layout.channel} ${layout.query} exports editable values and visible example artwork`, async ({
    page,
  }, info) => {
    await page.goto(`/templates?category=transfer&channel=${layout.channel}`);
    await page.getByLabel("搜索模板", { exact: true }).fill(layout.query);
    await page.getByRole("button", { name: "使用模板", exact: true }).click();
    await expect(page).toHaveURL(/\/editor\//);
    await page.getByRole("button", { name: "参数", exact: true }).click();
    const amount = page
      .getByLabel("参数金额", { exact: true })
      .locator("input")
      .first();
    await amount.fill("1258.50");
    await amount.press("Tab");
    await page
      .getByRole("button", { name: "随机生成交易订单号", exact: true })
      .click();
    const order = await page
      .getByLabel("交易订单号", { exact: true })
      .inputValue();
    expect(order).toMatch(/^DEMO-\d{10}$/);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const saved = await packaged(page, info);
    expect(saved.doc.layers.find((l: any) => l.id === "amount").text).toBe(
      "1258.50",
    );
    expect(
      saved.doc.layers.find((l: any) => l.id === "finance_watermark"),
    ).toMatchObject({ text: "示例 · 非真实凭证", visible: true, locked: true });
    const image = await exportPNG(page, info);
    expect(image.readUInt32BE(16)).toBe(layout.width);
    expect(image.readUInt32BE(20)).toBe(layout.height);
    expect(
      await watermarkPixels(page, image, layout.width, layout.height),
    ).toBeGreaterThan(100);
    await page.reload();
    await page.getByRole("button", { name: "参数", exact: true }).click();
    await expect(page.getByLabel("交易订单号", { exact: true })).toHaveValue(
      order,
    );
  });
test("batch bank filters keep selected rules and export two distinct frozen order numbers", async ({
  page,
}, info) => {
  await page.goto("/batch");
  await page
    .getByLabel("筛选批量模板分类", { exact: true })
    .selectOption("transfer");
  await page.getByLabel("批量转账渠道", { exact: true }).selectOption("icbc");
  await expect(
    page.getByLabel("批量模板", { exact: true }).locator("option"),
  ).toHaveCount(7);
  await page
    .getByLabel("批量转账业务场景", { exact: true })
    .selectOption("transfer");
  await expect(
    page.getByLabel("批量模板", { exact: true }).locator("option"),
  ).toHaveCount(3);
  await page
    .getByLabel("批量模板", { exact: true })
    .selectOption("b:bt_pay_icbc_personal_transfer");
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await page.getByLabel("批量转账渠道", { exact: true }).selectOption("alipay");
  await expect(page.getByLabel("批量模板", { exact: true })).toHaveValue(
    "b:bt_pay_icbc_personal_transfer",
  );
  await page.setViewportSize({width:375,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  const summaries = page.locator('[aria-label$="张交易订单号"]');
  await expect(summaries).toHaveCount(2);
  const orders = await summaries.allTextContents();
  expect(new Set(orders).size).toBe(2);
  await page
    .getByRole("button", { name: "生成 2 张图片", exact: true })
    .click();
  await expect(
    page.getByText("已生成 2 张图片", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
  const path = info.outputPath("bank-payments.zip");
  await (await download).saveAs(path);
  const { unzipSync } = await import("fflate");
  const files = Object.values(unzipSync(new Uint8Array(await readFile(path))));
  expect(files).toHaveLength(2);
  for (const file of files) {
    const b = Buffer.from(file);
    expect(b.readUInt32BE(16)).toBe(1600);
    expect(b.readUInt32BE(20)).toBe(1180);
    expect(await watermarkPixels(page, b, 1600, 1180)).toBeGreaterThan(100);
  }
  expect(await summaries.allTextContents()).toEqual(orders);
});
