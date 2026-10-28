import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  makeTemplate,
  titleParam,
  textLayer,
} from "../src/lib/batch/test-fixtures";
test.skip(
  process.env.CMS_E2E !== "1",
  "Requires real local Cloudflare Worker, D1 and R2",
);
const password = "Local-Cms-Test-Only-729!";
async function adminLogin(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("管理员密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录后台", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "分类管理", exact: true }),
  ).toBeVisible();
}
async function preparePublic(request: APIRequestContext, origin: string) {
  const result = await request.post("/api/admin/login", {
    headers: { Origin: origin },
    data: { username: "admin", password },
  });
  expect(result.status()).toBe(200);
  const { csrf } = await result.json();
  const data = await (await request.get("/api/admin/catalog")).json();
  expect(
    (
      await request.put("/api/admin/popup", {
        headers: { Origin: origin, "X-CSRF-Token": csrf },
        data: { ...data.popup, enabled: false },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/admin/logout", {
        headers: { Origin: origin, "X-CSRF-Token": csrf },
      })
    ).status(),
  ).toBe(200);
}
function templateFile(name: string) {
  const doc = makeTemplate();
  doc.name = name;
  doc.layers = [textLayer(titleParam.layerId, "春日读书活动")];
  doc.parameters = [
    { ...titleParam, name: "活动标题", defaultValue: "春日读书活动" },
  ];
  return {
    name: "poster.haishen.json",
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
  };
}
async function submit(page: Page, name: string) {
  await page.goto("/submit");
  await page
    .getByLabel("选择投稿模板文件", { exact: true })
    .setInputFiles(templateFile(name));
  await expect(page.getByAltText("投稿模板真实预览")).toBeVisible();
  await page.getByLabel("投稿模板分类", { exact: true }).selectOption("poster");
  await page.getByLabel("模板说明", { exact: true }).fill("原创可编辑活动海报");
  await page.getByText("提交者信息与备注（可选）", { exact: true }).click();
  await page.getByLabel("称呼", { exact: true }).fill("读书活动设计者");
  await page
    .getByLabel("联系方式", { exact: true })
    .fill("private-submission@example.test");
  await page
    .getByLabel("给管理员的备注", { exact: true })
    .fill("这是给管理员的私密说明");
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "模板已提交", exact: true }),
  ).toBeVisible();
  const receipt = await page.getByText(/提交编号：/).textContent();
  return receipt!.replace("提交编号：", "").trim();
}
test("anonymous submissions stay private until an administrator inspects actual details and publishes", async ({
  page,
  browser,
  request,
  baseURL,
}, info) => {
  await preparePublic(request, new URL(baseURL!).origin);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/templates");
  await page.getByRole("link", { name: "提交模板", exact: true }).click();
  await expect(page).toHaveURL(/\/submit$/);
  const id = await submit(page, "匿名读书海报投稿");
  expect((await page.request.get("/api/admin/catalog")).status()).toBe(401);
  expect(
    (await page.request.get(`/api/public/templates/${id}/package`)).status(),
  ).toBe(404);
  let publicData = await (await page.request.get("/api/public/catalog")).json();
  expect(publicData.templates.some((t: any) => t.id === id)).toBe(false);
  expect(JSON.stringify(publicData)).not.toContain("private-submission");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const context = await browser.newContext({ baseURL });
  try {
    const admin = await context.newPage();
    admin.on("pageerror", (e) => errors.push(e.message));
    await adminLogin(admin);
    await admin.getByRole("button", { name: /^投稿审核/ }).click();
    const card = admin
      .locator("article")
      .filter({
        has: admin.getByRole("heading", {
          name: "匿名读书海报投稿",
          exact: true,
        }),
      });
    await card.getByRole("button", { name: "查看详情", exact: true }).click();
    const detail = admin.getByRole("region", { name: "投稿详情", exact: true });
    await expect(detail.getByAltText("投稿实际模板预览")).toBeVisible();
    await expect(
      detail.getByText("private-submission@example.test", { exact: true }),
    ).toBeVisible();
    await expect(
      detail.getByText("这是给管理员的私密说明", { exact: true }),
    ).toBeVisible();
    await expect(detail.getByText(/活动标题 · text/)).toBeVisible();
    await detail
      .getByLabel("发布名称", { exact: true })
      .fill("审核发布的读书海报");
    await detail
      .getByLabel("投稿发布分类", { exact: true })
      .selectOption("notice");
    await detail
      .getByRole("button", { name: "审核并发布", exact: true })
      .click();
    await expect(detail).toHaveCount(0);
    publicData = await (await page.request.get("/api/public/catalog")).json();
    expect(publicData.templates.find((t: any) => t.id === id)).toMatchObject({
      name: "审核发布的读书海报",
      category: "notice",
    });
    expect(JSON.stringify(publicData)).not.toContain("private-submission");
    expect(JSON.stringify(publicData)).not.toContain("私密说明");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/templates?category=notice");
    await page
      .getByRole("button", { name: "使用模板 审核发布的读书海报", exact: true })
      .click();
    await expect(page).toHaveURL(/\/editor\//);
    await page.getByRole("button", { name: "导出", exact: true }).click();
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "导出", exact: true })
      .click();
    const png = info.outputPath("reviewed-poster.png");
    await (await downloaded).saveAs(png);
    const bytes = await readFile(png);
    expect(bytes.readUInt32BE(16)).toBe(600);
    expect(bytes.readUInt32BE(20)).toBe(400);
  } finally {
    await context.close();
  }
  expect(errors).toEqual([]);
});
test("rejection remains private and administrators can remove the rejected files on mobile", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  await preparePublic(request, new URL(baseURL!).origin);
  const id = await submit(page, "待修改的活动投稿");
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 375, height: 812 },
  });
  try {
    const admin = await context.newPage();
    await adminLogin(admin);
    await admin.getByRole("button", { name: /^投稿审核/ }).click();
    const card = admin
      .locator("article")
      .filter({
        has: admin.getByRole("heading", {
          name: "待修改的活动投稿",
          exact: true,
        }),
      });
    await card.getByRole("button", { name: "查看详情", exact: true }).click();
    const detail = admin.getByRole("region", { name: "投稿详情", exact: true });
    await expect(detail.getByAltText("投稿实际模板预览")).toBeVisible();
    expect(
      await admin.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await detail
      .getByLabel("拒绝备注（可选）", { exact: true })
      .fill("请完善活动标题参数");
    admin.once("dialog", (d) => d.accept());
    await detail.getByRole("button", { name: "拒绝投稿", exact: true }).click();
    await expect(detail).toHaveCount(0);
    expect(
      (
        await page.request.get(`/api/public/templates/${id}/thumbnail`)
      ).status(),
    ).toBe(404);
    await admin.getByRole("button", { name: /^已拒绝（/ }).click();
    const rejected = admin
      .locator("article")
      .filter({
        has: admin.getByRole("heading", {
          name: "待修改的活动投稿",
          exact: true,
        }),
      });
    await rejected
      .getByRole("button", { name: "查看详情", exact: true })
      .click();
    await expect(
      admin.getByText("请完善活动标题参数", { exact: true }),
    ).toBeVisible();
    admin.once("dialog", (d) => d.accept());
    await rejected
      .getByRole("button", { name: "删除投稿", exact: true })
      .click();
    await expect(rejected).toHaveCount(0);
    expect(
      (await admin.request.get(`/api/admin/templates/${id}/package`)).status(),
    ).toBe(404);
  } finally {
    await context.close();
  }
});
