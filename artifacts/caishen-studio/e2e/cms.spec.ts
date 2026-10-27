import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.skip(
  process.env.CMS_E2E !== "1",
  "Requires the actual local Cloudflare Worker, D1 and R2 runtime",
);
const password = "Local-Cms-Test-Only-729!";
async function login(page: Page) {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "管理员登录", exact: true }),
  ).toBeVisible();
  await page.getByLabel("管理员密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录后台", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "分类管理", exact: true }),
  ).toBeVisible();
}
async function anonymous(
  browser: import("@playwright/test").Browser,
  page: Page,
  confirm = true,
) {
  const ctx = await browser.newContext({
    baseURL: new URL("/", page.url()).href,
  });
  if (confirm)
    await ctx.addInitScript(() =>
      sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
    );
  return ctx;
}
async function poster(page: Page) {
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 600;
    const x = c.getContext("2d")!;
    x.fillStyle = "white";
    x.fillRect(0, 0, 400, 600);
    x.fillStyle = "#118844";
    x.fillRect(0, 500, 400, 100);
    return c.toDataURL().split(",")[1];
  });
  return Buffer.from(
    JSON.stringify({
      format: "caishen-template",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      doc: {
        schemaVersion: 1,
        templateId: "spring-poster",
        name: "共享活动海报",
        canvas: {
          width: 400,
          height: 600,
          backgroundColor: "#ffffff",
          backgroundImage: { kind: "asset", assetId: "poster-bg" },
        },
        source: null,
        layers: [
          {
            type: "text",
            id: "title",
            name: "活动标题",
            x: 30,
            y: 50,
            width: 340,
            height: 140,
            text: "春日花园活动",
            fontSize: 48,
            fontWeight: "bold",
            fill: "#153c36",
          },
        ],
        parameters: [
          {
            id: "p_title",
            name: "活动标题",
            type: "text",
            property: "text",
            layerId: "title",
            defaultValue: "春日花园活动",
            rules: {},
            editable: true,
            allowEmpty: true,
            required: false,
          },
        ],
      },
      assets: [
        {
          id: "poster-bg",
          name: "背景",
          mime: "image/png",
          width: 400,
          height: 600,
          data: png,
        },
      ],
    }),
  );
}
test("administrator publishes a categorized template and anonymous visitors create independent editable PNGs", async ({
  page,
  browser,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const form = page.getByRole("form", { name: "分类编辑", exact: true });
  await form.getByLabel("分类名称", { exact: true }).fill("公开活动");
  await form.getByLabel("分类顺序", { exact: true }).fill("1");
  await form.getByRole("button", { name: "保存分类", exact: true }).click();
  await expect(page.getByText("公开活动", { exact: true })).toBeVisible();
  const catalogue = await (
    await page.request.get("/api/public/catalog")
  ).json();
  const category = catalogue.categories.find(
    (c: any) => c.label === "公开活动",
  );
  expect(category).toBeTruthy();
  await page.getByRole("button", { name: "模板管理", exact: true }).click();
  await page.getByLabel("选择共享模板文件", { exact: true }).setInputFiles({
    name: "poster.haishen.json",
    mimeType: "application/json",
    buffer: await poster(page),
  });
  await expect(
    page.getByRole("img", { name: "待上传模板预览", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("模板所属分类", { exact: true })
    .selectOption(category.id);
  await page.getByRole("button", { name: "上传为草稿", exact: true }).click();
  const article = page.locator("article").filter({ hasText: "共享活动海报" });
  await expect(article).toContainText("草稿");
  expect(
    (await (await page.request.get("/api/public/catalog")).json()).templates,
  ).toHaveLength(0);
  const visitor = await anonymous(browser, page);
  try {
    const front = await visitor.newPage();
    front.on("pageerror", (e) => errors.push(e.message));
    await front.goto(`/templates?category=${category.id}`);
    await expect(
      front.getByRole("status", { name: "模板筛选结果", exact: true }),
    ).toContainText("找到 0 套");
    await article.getByRole("button", { name: "发布", exact: true }).click();
    await expect(article).toContainText("已发布");
    await front.reload();
    await expect(
      front.getByRole("button", { name: "使用模板", exact: true }),
    ).toHaveCount(1);
    await expect(
      front.getByRole("img", { name: "共享活动海报", exact: true }),
    ).toBeVisible();
    await front.getByRole("button", { name: "使用模板", exact: true }).click();
    await expect(front).toHaveURL(/\/editor\//);
    const workUrl = front.url();
    await front.getByRole("button", { name: "参数", exact: true }).click();
    await front
      .getByLabel("参数活动标题", { exact: true })
      .locator("input")
      .first()
      .fill("周末花园相会");
    await front.getByRole("button", { name: "保存", exact: true }).click();
    await front.getByRole("button", { name: "导出", exact: true }).click();
    const d = front.waitForEvent("download");
    await front
      .getByRole("dialog")
      .getByRole("button", { name: "导出", exact: true })
      .click();
    const path = info.outputPath("shared-poster.png");
    await (await d).saveAs(path);
    const bytes = await readFile(path);
    expect(bytes.readUInt32BE(16)).toBe(400);
    expect(bytes.readUInt32BE(20)).toBe(600);
    const pixel = await front.evaluate(async (base64) => {
      const b = await createImageBitmap(
        new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
          type: "image/png",
        }),
      );
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 600;
      const x = c.getContext("2d")!;
      x.drawImage(b, 0, 0);
      b.close();
      return [...x.getImageData(10, 550, 1, 1).data];
    }, bytes.toString("base64"));
    expect(pixel).toEqual([17, 136, 68, 255]);
    const liveCatalogue = await (
      await front.request.get("/api/public/catalog")
    ).json();
    const sharedId = liveCatalogue.templates.find(
      (t: any) => t.name === "共享活动海报",
    ).id;
    await front.goto("/batch");
    await front
      .getByLabel("筛选批量模板分类", { exact: true })
      .selectOption(category.id);
    await front
      .getByLabel("批量模板", { exact: true })
      .selectOption(`b:${sharedId}`);
    await expect(front.getByTitle("活动标题", { exact: true })).toBeVisible();
    await front.getByLabel("生成张数", { exact: true }).fill("2");
    await front.getByRole("button", { name: "生成预览", exact: true }).click();
    await expect(
      front.getByRole("button", { name: "生成 2 张图片", exact: true }),
    ).toBeEnabled();
    await front
      .getByRole("button", { name: "生成 2 张图片", exact: true })
      .click();
    await expect(
      front.getByText("已生成 2 张图片", { exact: true }),
    ).toBeVisible();
    const zipped = front.waitForEvent("download");
    await front.getByRole("link", { name: "下载 ZIP", exact: true }).click();
    const zipPath = info.outputPath("shared-batch.zip");
    await (await zipped).saveAs(zipPath);
    const { unzipSync } = await import("fflate");
    const files = Object.values(
      unzipSync(new Uint8Array(await readFile(zipPath))),
    );
    expect(files).toHaveLength(2);
    for (const file of files) {
      expect(Buffer.from(file).readUInt32BE(16)).toBe(400);
      expect(Buffer.from(file).readUInt32BE(20)).toBe(600);
    }
    await article.getByRole("button", { name: "下架", exact: true }).click();
    await expect(article).toContainText("草稿");
    await front.goto(`/templates?category=${category.id}`);
    await expect(
      front.getByRole("status", { name: "模板筛选结果", exact: true }),
    ).toContainText("找到 0 套");
    await front.goto(workUrl);
    await front.getByRole("button", { name: "参数", exact: true }).click();
    await expect(
      front
        .getByLabel("参数活动标题", { exact: true })
        .locator("input")
        .first(),
    ).toHaveValue("周末花园相会");
  } finally {
    await visitor.close();
  }
  expect(errors).toEqual([]);
});
test("administrator controls popup title, plain text, button, phrase, frequency and disabling without requiring visitor login", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole("button", { name: "弹窗设置", exact: true }).click();
  await page.getByLabel("弹窗标题", { exact: true }).fill("欢迎来到灵感工作室");
  await page
    .getByLabel("弹窗正文", { exact: true })
    .fill("<b>这里只显示文字</b>\n访客无需注册即可创作。");
  await page.getByLabel("确认方式", { exact: true }).selectOption("button");
  await page.getByLabel("按钮文字", { exact: true }).fill("开始创作");
  await page.getByRole("button", { name: "保存弹窗设置", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "设置已保存" }),
  ).toBeVisible();
  const visitor = await anonymous(browser, page, false);
  try {
    const front = await visitor.newPage();
    await front.goto("/templates");
    const dialog = front.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "欢迎来到灵感工作室", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("<b>这里只显示文字</b>", { exact: false }),
    ).toBeVisible();
    await expect(dialog.locator("b")).toHaveCount(0);
    await dialog.getByRole("button", { name: "开始创作", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await front.reload();
    await expect(
      front.getByRole("button", { name: "使用模板", exact: true }).first(),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await page.getByLabel("启用访问弹窗", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "保存弹窗设置", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "设置已保存" }),
    ).toBeVisible();
    await front.reload();
    await expect(
      front.getByRole("button", { name: "使用模板", exact: true }).first(),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await page.getByLabel("启用访问弹窗", { exact: true }).check();
    await page.getByLabel("确认方式", { exact: true }).selectOption("phrase");
    await page.getByLabel("弹窗确认文字", { exact: true }).fill("欢迎使用");
    await page.getByLabel("显示频率", { exact: true }).selectOption("visit");
    await page
      .getByRole("button", { name: "保存弹窗设置", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "设置已保存" }),
    ).toBeVisible();
    await front.reload();
    await expect(dialog).toBeVisible();
    await front.getByLabel("输入确认文字", { exact: true }).fill("错误文字");
    await expect(dialog).toBeVisible();
    await front.getByLabel("输入确认文字", { exact: true }).fill("欢迎使用");
    await expect(dialog).toHaveCount(0);
    await front.reload();
    await expect(dialog).toBeVisible();
    await front.goto("/admin");
    await expect(
      front.getByRole("heading", { name: "管理员登录", exact: true }),
    ).toBeVisible();
    await expect(front.getByRole("dialog")).toHaveCount(0);
  } finally {
    await visitor.close();
  }
  await page.getByLabel("启用访问弹窗", { exact: true }).uncheck();
  await page.getByRole("button", { name: "保存弹窗设置", exact: true }).click();
});
test("public APIs remain anonymous while admin APIs reject anonymous and cross-origin writes", async ({
  page,
  browser,
}) => {
  await page.goto("/admin");
  const visitor = await anonymous(browser, page);
  try {
    expect((await visitor.request.get("/api/public/catalog")).status()).toBe(
      200,
    );
    expect((await visitor.request.get("/api/admin/catalog")).status()).toBe(
      401,
    );
    expect(
      (
        await visitor.request.post("/api/admin/categories", {
          headers: {
            Origin: new URL(
              page.url() === "about:blank"
                ? "http://127.0.0.1:5178"
                : page.url(),
            ).origin,
          },
          data: {},
        })
      ).status(),
    ).toBe(401);
  } finally {
    await visitor.close();
  }
  await login(page);
  const session = await (await page.request.get("/api/admin/session")).json();
  expect(
    (
      await page.request.post("/api/admin/categories", {
        headers: {
          Origin: "https://outside.test",
          "X-CSRF-Token": session.csrf,
        },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "管理员登录", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/catalog")).status()).toBe(401);
});
