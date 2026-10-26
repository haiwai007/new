import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
let errors: string[];
async function confirmSession(context: import("@playwright/test").BrowserContext) {
  await context.addInitScript(() => sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"));
}
test.beforeEach(async ({ page, context }) => {
  await confirmSession(context);
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(() => {
  expect(errors, "No browser runtime exceptions").toEqual([]);
});
async function createFromBuiltin(page: Page, query?: string) {
  await page.goto("/templates");
  if(query)await page.getByPlaceholder("搜索模板，例如：海报、价格").fill(query);
  await page
    .getByRole("button", { name: "使用模板", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
}
async function confirmLocation(page: Page) {
  await page.getByRole("button", {name:"状态栏定位",exact:true}).click();
  await page.getByRole("button", {name:"定位原状态栏",exact:true}).click();
  const d=page.getByRole("dialog",{name:"模板状态栏定位",exact:true});
  await d.getByRole("button",{name:"自动定位",exact:true}).click();
  await expect(d.getByRole("button",{name:"自动定位",exact:true})).toBeEnabled();
  await d.getByRole("button",{name:"测试替换",exact:true}).click();
  await expect(d.getByText(/预览已生成：/)).toBeVisible();
  await d.getByRole("button",{name:"确认并保存定位",exact:true}).click();
  await expect(d).toHaveCount(0);
}
async function calibratedWork(page: Page) {
  await page.goto("/custom");
  const encoded=await page.evaluate(()=>{
    const c=document.createElement("canvas");c.width=1080;c.height=1350;
    const ctx=c.getContext("2d")!;ctx.scale(2.7,2.7);
    ctx.fillStyle="#f7f7f7";ctx.fillRect(0,0,400,500);
    ctx.fillStyle="#111111";ctx.font="14px Arial";ctx.fillText("20:06",14,24);
    ctx.font="12px Arial";ctx.fillText("HD HD 65",288,24);
    ctx.fillStyle="#2288dd";ctx.fillRect(65,12,12,14);
    ctx.fillStyle="#ffffff";ctx.fillRect(12,100,376,300);
    return c.toDataURL().split(",")[1];
  });
  await page.locator('input[type="file"]').setInputFiles({name:"batch-reference.png",mimeType:"image/png",buffer:Buffer.from(encoded,"base64")});
  await page.getByText("保持原始尺寸",{exact:true}).click();
  await page.getByRole("button",{name:/原图背景模式/}).click();
  await page.getByRole("button",{name:"生成初始模板并进入编辑器",exact:true}).click();
  await confirmLocation(page);
  await page.getByRole("button",{name:"进入作图",exact:true}).click();
}
async function calibratedBatch(page: Page) {
  await calibratedWork(page);
  await page.getByRole("button",{name:"另存为模板",exact:true}).click();
  await page.getByRole("dialog").getByRole("textbox").fill("已定位批量测试模板");
  await page.getByRole("button",{name:"保存模板",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/batch");
  const option=page.getByLabel("批量模板",{exact:true}).locator("option").filter({hasText:"已定位批量测试模板"});
  await expect(option).toHaveCount(1);
  await page.getByLabel("批量模板",{exact:true}).selectOption((await option.getAttribute("value"))!);
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
  await page.getByLabel("选择完整备份文件").setInputFiles({
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
test("batch parameter rules produce two real PNG files inside a ZIP", async ({
  page,
}, info) => {
  await createFromBuiltin(page);
  await page.getByRole("button", { name: "另存为模板", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("批量测试");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/batch");
  await page.getByLabel("批量模板", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await page.getByRole("button", { name: "自动编号", exact: true }).first().click();
  await page.getByRole("button", {name: "生成预览", exact: true}).click();
  await page.getByRole("button", { name: "生成 2 张图片", exact: true }).click();
  await expect(page.getByText("已生成 2 张图片", { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
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
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (width < 768) {
      await page.getByRole("button", { name: "打开菜单" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "我的作品", exact: true }).click();
    } else {
      await page.locator("header").getByRole("link", { name: "做图", exact: true }).click();
    }
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

test("phone model, status icons, date and battery persist and appear in PNG output", async ({
  page,
}, info) => {
  await createFromBuiltin(page,"空白 竖版");
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await page.getByText("布局兼容选项",{exact:true}).click();
  await page.getByLabel("状态栏布局版本",{exact:true}).selectOption("legacy");
  await page.getByRole("button",{name:"浅底黑字",exact:true}).click();
  await page
    .getByRole("combobox", { name: "手机型号" })
    .selectOption("iphone16");
  await page.getByLabel("同时适配机型画布尺寸").check();
  await page.getByLabel("状态栏时间", { exact: true }).fill("13:08");
  await page.getByLabel("显示日期", { exact: true }).check();
  await page.getByLabel("状态栏日期", { exact: true }).fill("2026-10-25");
  await page.getByLabel("日期格式", { exact: true }).selectOption("iso");
  await page.getByLabel("电量百分比", { exact: true }).fill("67");
  await page.getByLabel("正在充电", { exact: true }).check();
  await page.locator("summary").filter({ hasText: "信号与网络" }).click();
  await page.getByRole("radiogroup", { name: "Wi-Fi", exact: true }).getByRole("radio").first().click();
  await page.getByLabel("蜂窝网络类型", { exact: true }).selectOption("5G");
  await page.getByRole("button", { name: /应用.*状态栏/ }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await expect(page.getByLabel("电量百分比", { exact: true })).toHaveValue(
    "67",
  );
  await expect(page.getByLabel("状态栏时间", { exact: true })).toHaveValue(
    "13:08",
  );
  await expect(page.getByLabel("状态栏日期", { exact: true })).toHaveValue(
    "2026-10-25",
  );
  await expect(page.getByLabel("正在充电", { exact: true })).toBeChecked();
  const png = await exportPNG(page, info.outputPath("phone.png"));
  expect(png.readUInt32BE(16)).toBe(1179);
  expect(png.readUInt32BE(20)).toBe(2556);
  // Decode the real downloaded PNG to verify SVG status icons reached the exported canvas.
  const darkPixels = await page.evaluate(async (encoded) => {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = ctx.getImageData(800, 0, 325, 200).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i] < 70 &&
        pixels[i + 1] < 70 &&
        pixels[i + 2] < 70 &&
        pixels[i + 3] > 200
      )
        count++;
    const hardware = ctx.getImageData(430, 50, 300, 70).data;
    let hardwareDark = 0;
    for (let i = 0; i < hardware.length; i += 4)
      if (hardware[i] < 70 && hardware[i + 1] < 70 && hardware[i + 2] < 70)
        hardwareDark++;
    return { icons: count, hardwareDark };
  }, png.toString("base64"));
  expect(darkPixels.icons).toBeGreaterThan(100);
  expect(darkPixels.hardwareDark).toBe(0);
  await expect(
    page.getByLabel("显示灵动岛 / 刘海 / 开孔", { exact: true }),
  ).toBeChecked();
});

test("stale tabs preserve the winning original and create an editable conflict copy", async ({ page, context }) => {
  await createFromBuiltin(page);
  const originalUrl = page.url();
  const other = await context.newPage();
  await other.goto(originalUrl);
  await expect(other.getByLabel("项目名称", { exact: true })).toBeVisible();
  await page.getByLabel("项目名称", { exact: true }).fill("主标签页的新名称");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await other.getByLabel("项目名称", { exact: true }).fill("旧标签页的修改");
  await other.getByRole("button", { name: "保存", exact: true }).click();
  const recovery = other.getByRole("link", { name: "打开冲突副本继续编辑" });
  await expect(recovery).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue("主标签页的新名称");
  await recovery.click();
  await expect(other).not.toHaveURL(originalUrl);
  await expect(other.getByLabel("项目名称", { exact: true })).toHaveValue("旧标签页的修改（冲突副本）");
  await other.reload();
  await expect(other.getByLabel("项目名称", { exact: true })).toHaveValue("旧标签页的修改（冲突副本）");
  await other.close();
});

test("mobile editor keeps save, export and save status within the viewport", async ({ page }) => {
  await createFromBuiltin(page);
  for (const width of [320, 360, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const header = page.locator("header");
    for (const name of ["保存", "导出", "更多"]) {
      const button = header.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      await expect(button).toHaveCSS("height", "44px");
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(header.getByText("已保存到本地", { exact: true })).toBeVisible();
    expect(await header.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "更多", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "适应屏幕" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "导出图片" })).toBeVisible();
});

test("export log failure does not report a successful PNG download as failed", async ({ page }, info) => {
  await createFromBuiltin(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "exports") throw new DOMException("full export log", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await exportPNG(page, info.outputPath("export-without-log.png"));
  await expect(page.getByText("图片已生成并开始下载，导出记录未保存", { exact: true })).toBeVisible();
  await expect(page.getByText("导出失败", { exact: true })).toHaveCount(0);
});

test("transparent PNG omits background images", async ({ page }) => {
  await page.goto("/custom");
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0000ff";
    ctx.fillRect(0, 0, 100, 100);
    return canvas.toDataURL().split(",")[1];
  });
  await page.locator('input[type="file"]').setInputFiles({ name: "blue.png", mimeType: "image/png", buffer: Buffer.from(data, "base64") });
  await page.getByRole("button", { name: /原图背景模式/ }).click();
  await page.getByRole("button", { name: "生成初始模板并进入编辑器" }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await page.getByRole("dialog").getByRole("switch").click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "导出", exact: true }).click();
  const bytes = await readFile((await (await downloaded).path())!);
  const alpha = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(50, 50, 1, 1).data[3];
  }, bytes.toString("base64"));
  expect(alpha).toBe(0);
});

test("batch status-bar rules change real exported pixels and keep the source template intact", async ({ page }, info) => {
  await calibratedWork(page);
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await page.getByRole("button", { name: "应用手机状态栏", exact: true }).click();
  await page.getByRole("button", { name: "另存为模板", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("状态栏随机回归");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/batch");
  await page.getByLabel("批量模板", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await expect(page.getByLabel("第 1 张状态栏", { exact: true })).toContainText("09:41 · 电量 100%");
  const downloadBatch = async (name: string) => {
    if (await page.getByRole("button", {name: "生成预览", exact: true}).isEnabled()) await page.getByRole("button", {name: "生成预览", exact: true}).click();
    await page.getByRole("button", { name: "生成 2 张图片", exact: true }).click();
    await expect(page.getByText("已生成 2 张图片", { exact: true })).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
    const path = info.outputPath(name);
    await (await downloaded).saveAs(path);
    const { unzipSync } = await import("fflate");
    const files = Object.values(unzipSync(new Uint8Array(await readFile(path))));
    expect(files).toHaveLength(2);
    return files;
  };
  const baseline = await downloadBatch("baseline.zip");
  await page.getByRole("button",{name:"状态栏修改状态栏",exact:true}).click();
  await page.getByRole("button",{name:"时间区间随机",exact:true}).click();
  await page.getByRole("button",{name:"电量区间随机",exact:true}).click();
  await expect(page.getByRole("link", { name: "下载 ZIP", exact: true })).toHaveCount(0);
  await page.getByLabel("随机开始时间", { exact: true }).fill("13:08");
  await page.getByLabel("随机结束时间", { exact: true }).fill("13:08");
  await page.getByLabel("随机最低电量", { exact: true }).fill("67");
  await page.getByLabel("随机最高电量", { exact: true }).fill("20");
  await expect(page.getByRole("button", { name: "生成 0 张图片", exact: true })).toBeDisabled();
  await page.getByLabel("随机最高电量", { exact: true }).fill("67");
  await page.getByText("更多设置",{exact:true}).click();
  await page.getByRole("button", {name: "生成预览", exact: true}).click();
  for (const index of [1, 2]) await expect(page.getByLabel(`第 ${index} 张状态栏`, { exact: true })).toContainText("13:08 · 电量 67%");
  const randomized = await downloadBatch("randomized.zip");
  const difference = await page.evaluate(async ([a, b]) => {
    const pixels = async (encoded: string) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0); bitmap.close();
      return { width: canvas.width, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const original = await pixels(a), changed = await pixels(b);
    let top = 0, middle = 0;
    for (let i = 0; i < original.data.length; i += 4) {
      const y = Math.floor(i / 4 / original.width);
      if ([0, 1, 2, 3].some(channel => original.data[i + channel] !== changed.data[i + channel])) {
        if (y < 260) top++;
        if (y >= 300 && y < 1000) middle++;
      }
    }
    return { top, middle };
  }, [Buffer.from(baseline[0]).toString("base64"), Buffer.from(randomized[0]).toString("base64")]);
  expect(difference.top).toBeGreaterThan(100);
  expect(difference.middle).toBe(0);
  // Switching templates keeps drawing settings, without changing the saved template.
  await page.getByLabel("批量模板", { exact: true }).selectOption("");
  await page.getByLabel("批量模板", { exact: true }).selectOption({ index: 1 });
  await expect(page.getByRole("button", {name:"时间区间随机",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByLabel("第 1 张状态栏", { exact: true })).toContainText("13:08 · 电量 67%");
});

test("upload model selection protects unrelated top controls and switches brand layouts automatically", async ({ page }, info) => {
  await page.goto("/custom");
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1179; canvas.height = 2556;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#6a97bb"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8f8f8"; ctx.fillRect(0, 0, canvas.width, 180);
    ctx.fillStyle="#111111";ctx.font="40px Arial";ctx.fillText("20:06",42,70);ctx.font="34px Arial";ctx.fillText("HD HD 65",850,70);
    // A right-only control is not evidence of a status bar and must be preserved.
    ctx.fillStyle = "#ff0000"; ctx.fillRect(900, 140, 150, 25);
    return canvas.toDataURL().split(",")[1];
  });
  await page.locator('input[type="file"]').setInputFiles({ name: "iphone-reference.png", mimeType: "image/png", buffer: Buffer.from(encoded, "base64") });
  await page.getByText("保持原始尺寸", { exact: true }).click();
  await page.getByRole("button", { name: /原图背景模式/ }).click();
  await expect(page.getByRole("combobox", {name: "手机品牌", exact: true})).toHaveCount(0);
  await page.getByRole("button", {name: "生成初始模板并进入编辑器"}).click();
  await expect(page).toHaveURL(/\/editor\//);
  await expect(page.getByRole("button", {name: "手机", exact: true})).toHaveCount(0);
  await confirmLocation(page);
  await page.getByRole("button", {name: "进入作图", exact: true}).click();
  await expect(page.getByRole("button", {name: "手机", exact: true})).toBeVisible();
  await page.getByRole("combobox", { name: "手机品牌", exact: true }).selectOption("Samsung");
  await page.getByRole("combobox", { name: "手机型号", exact: true }).selectOption("galaxys24ultra");
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
  await page.getByRole("button", { name: "添加微信图标", exact: true }).click();
  const samsung = await exportPNG(page, info.outputPath("samsung-upload.png"));
  expect(samsung.readUInt32BE(16)).toBe(1179);
  expect(samsung.readUInt32BE(20)).toBe(2556);
  const rgba = await page.evaluate(async base64 => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: "image/png" }));
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
    return { oldIcon: [...ctx.getImageData(1000, 150, 1, 1).data], body: [...ctx.getImageData(500, 1000, 1, 1).data] };
  }, samsung.toString("base64"));
  expect(rgba.oldIcon).toEqual([255, 0, 0, 255]);
  expect(rgba.body).toEqual([106, 151, 187, 255]);
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "手机型号", exact: true })).toHaveValue("galaxys24ultra");
  await page.getByRole("combobox", { name: "手机品牌", exact: true }).selectOption("Google");
  await page.getByRole("combobox", { name: "手机型号", exact: true }).selectOption("pixel9");
  // No Apply click: the selected profile must already be in the saved/exported document.
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "手机型号", exact: true })).toHaveValue("pixel9");
  const pixel = await exportPNG(page, info.outputPath("pixel-upload.png"));
  expect(pixel.readUInt32BE(16)).toBe(1179);
  expect(pixel.readUInt32BE(20)).toBe(2556);
  expect(pixel.equals(samsung)).toBe(false);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/custom");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("APP notification icons support custom uploads, visibility, portable templates and batch export", async ({ page, browser }, info) => {
  await createFromBuiltin(page);
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await page.getByText("布局兼容选项",{exact:true}).click();
  await page.getByLabel("状态栏布局版本",{exact:true}).selectOption("legacy");
  for (const name of ["微信", "快手", "抖音", "QQ"]) await page.getByRole("button", { name: `添加${name}图标`, exact: true }).click();
  await expect(page.getByRole("list", { name: "已选 APP 图标" }).getByRole("listitem")).toHaveCount(4);
  await page.getByLabel("上传 APP 图标文件", { exact: true }).setInputFiles({name:"bad.svg",mimeType:"image/svg+xml",buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')});
  await expect(page.getByRole("alert")).toContainText("仅支持 PNG");
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width=64; canvas.height=32;
    const ctx=canvas.getContext("2d")!; ctx.fillStyle="#00ff00";ctx.fillRect(0,0,64,32);
    return canvas.toDataURL().split(",")[1];
  });
  await page.getByLabel("上传 APP 图标文件", { exact: true }).setInputFiles({name:"自定义通知.png",mimeType:"image/png",buffer:Buffer.from(encoded,"base64")});
  await expect(page.getByRole("list", { name:"已选 APP 图标" }).getByRole("listitem")).toHaveCount(5);
  await page.getByRole("button", { name:"上移自定义通知图标", exact:true }).click();
  await page.getByLabel("APP 图标大小", { exact:true }).fill("20");
  await page.getByRole("switch", {name:"显示抖音图标",exact:true}).uncheck();
  await page.getByRole("button", {name:"保存",exact:true}).click();
  await expect(page.getByText("已保存到本地", {exact:true})).toBeVisible();
  const greenPixels = async (target: Page, bytes: Buffer) => target.evaluate(async encoded => {
    const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:"image/png"}));
    const canvas=document.createElement("canvas");canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext("2d")!;ctx.drawImage(bitmap,0,0);bitmap.close();
    const data=ctx.getImageData(0,0,canvas.width,Math.min(150,canvas.height)).data;
    let green=0;for(let i=0;i<data.length;i+=4)if(data[i]<50&&data[i+1]>200&&data[i+2]<50&&data[i+3]>200)green++;
    return green;
  }, bytes.toString("base64"));
  const visible = await exportPNG(page,info.outputPath("app-icons-visible.png"));
  expect(await greenPixels(page,visible)).toBeGreaterThan(10);
  await page.getByRole("switch", {name:"显示自定义通知图标",exact:true}).uncheck();
  const hidden = await exportPNG(page,info.outputPath("app-icons-hidden.png"));
  expect(await greenPixels(page,hidden)).toBe(0);
  await page.getByRole("button", {name:"保存",exact:true}).click();
  await page.getByRole("button", {name:"更多",exact:true}).click();
  const download=page.waitForEvent("download");
  await page.getByRole("menuitem", {name:"导出模板文件（含图片）",exact:true}).click();
  const path=info.outputPath("app-template.haishen.json");await(await download).saveAs(path);
  const packaged=JSON.parse(await readFile(path,"utf8"));
  expect(packaged.doc.phone.appIcons).toHaveLength(5);
  const custom=packaged.doc.phone.appIcons.find((icon:{kind:string})=>icon.kind==="custom");
  expect(custom.visible).toBe(false);
  const asset=packaged.assets.find((asset:{id:string})=>asset.id===custom.src.assetId);
  expect(asset).toMatchObject({mime:"image/png",width:128,height:128});
  // Import in an empty browser context so no source assets can hide broken ID remapping.
  const fresh=await browser.newContext({viewport:{width:1440,height:1000}});
  await confirmSession(fresh);
  const restored=await fresh.newPage();restored.on("pageerror",error=>errors.push(error.message));
  try {
    await restored.goto(new URL("/works",page.url()).href);
    await restored.locator('input[type="file"]').setInputFiles(path);
    await expect(restored).toHaveURL(/\/editor\//);
    await restored.getByRole("button", {name:"进入作图",exact:true}).click();
    await restored.getByRole("button", {name:"手机",exact:true}).click();
    await expect(restored.getByRole("list", {name:"已选 APP 图标"}).getByRole("listitem")).toHaveCount(5);
    await expect(restored.getByRole("switch", {name:"显示自定义通知图标",exact:true})).not.toBeChecked();
    await restored.getByRole("switch", {name:"显示自定义通知图标",exact:true}).check();
    await restored.getByRole("combobox", {name:"手机品牌",exact:true}).selectOption("Samsung");
    await restored.getByRole("button", {name:"保存",exact:true}).click();
    await expect(restored.getByText("已保存到本地", {exact:true})).toBeVisible();
    await restored.reload();await restored.getByRole("button", {name:"手机",exact:true}).click();
    await expect(restored.getByRole("switch", {name:"显示自定义通知图标",exact:true})).toBeChecked();
    expect(await greenPixels(restored,await exportPNG(restored,info.outputPath("app-icons-restored.png")))).toBeGreaterThan(10);
    await restored.getByLabel("作图预设名称", {exact:true}).fill("导入图标作图设置");
    await restored.getByRole("button", {name:"保存为新预设",exact:true}).click();
    await expect(restored.getByLabel("选择作图预设").locator("option").filter({hasText:"导入图标作图设置"})).toHaveCount(1);
    await restored.getByRole("button",{name:"另存为模板",exact:true}).click();
    await restored.getByRole("dialog").getByRole("textbox").fill("导入图标批量模板");
    await restored.getByRole("button",{name:"保存模板",exact:true}).click();
    await expect(restored.getByRole("dialog")).toHaveCount(0);
    await restored.goto(new URL("/batch",page.url()).href);
    const importedOption=restored.getByLabel("批量模板",{exact:true}).locator("option").filter({hasText:"导入图标批量模板"});
    await expect(importedOption).toHaveCount(1);
    await restored.getByLabel("批量模板",{exact:true}).selectOption((await importedOption.getAttribute("value"))!);
    await restored.getByLabel("生成张数",{exact:true}).fill("1");
    await expect(restored.getByLabel("选择作图预设",{exact:true})).toHaveCount(0);
    await restored.getByRole("button", {name: "生成预览", exact: true}).click();
    await restored.getByRole("button",{name:"生成 1 张图片",exact:true}).click();
    await expect(restored.getByText("已生成 1 张图片",{exact:true})).toBeVisible();
    const batch=restored.waitForEvent("download");await restored.getByRole("link",{name:"下载 ZIP",exact:true}).click();
    const batchPath=info.outputPath("app-batch.zip");await(await batch).saveAs(batchPath);
    const {unzipSync}=await import("fflate");const files=Object.values(unzipSync(new Uint8Array(await readFile(batchPath))));
    expect(files).toHaveLength(1);expect(await greenPixels(restored,Buffer.from(files[0]))).toBeGreaterThan(10);
  } finally { await fresh.close(); }
});

test("expanded APP library supports search, selection limits, saving and PNG export", async ({page},info) => {
  await createFromBuiltin(page);
  await page.getByRole("button",{name:"手机",exact:true}).click();
  await page.getByText("布局兼容选项",{exact:true}).click();
  await page.getByLabel("状态栏布局版本",{exact:true}).selectOption("legacy");
  const choices=page.getByRole("group",{name:"内置 APP 图标",exact:true});
  await expect(choices.getByRole("button")).toHaveCount(28);
  for (const name of ["小红书","淘宝","美团","知乎","豆瓣","百度","钉钉","WhatsApp"]) {
    await page.getByLabel("搜索 APP 图标",{exact:true}).fill(name);
    await page.getByRole("button",{name:`添加${name}图标`,exact:true}).click();
  }
  await expect(page.getByRole("list",{name:"已选 APP 图标",exact:true}).getByRole("listitem")).toHaveCount(8);
  await page.getByLabel("搜索 APP 图标",{exact:true}).fill("Zoom");
  await expect(page.getByRole("button",{name:"添加Zoom图标",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"保存",exact:true}).click();
  await expect(page.getByText("已保存到本地",{exact:true})).toBeVisible();
  await page.reload();await page.getByRole("button",{name:"手机",exact:true}).click();
  await expect(page.getByRole("switch",{name:"显示小红书图标",exact:true})).toBeChecked();
  await expect(page.getByRole("switch",{name:"显示钉钉图标",exact:true})).toBeChecked();
  await expect(page.getByRole("switch",{name:"显示WhatsApp图标",exact:true})).toBeChecked();
  await exportPNG(page,info.outputPath("expanded-app-icons.png"));
});

test("batch chooses specified models evenly, samples checked APPs and preserves preview results", async ({page}, info) => {
  await calibratedBatch(page);
  await page.getByLabel("生成张数", {exact: true}).fill("4");
  await page.getByRole("button", {name:"状态栏修改状态栏",exact:true}).click();
  await page.getByRole("button", {name:"手机型号随机",exact:true}).click();
  await page.getByRole("button", {name: "清空型号", exact: true}).click();
  await page.getByLabel("候选型号 iPhone 16", {exact: true}).check();
  await page.getByLabel("候选型号 Google Pixel 9", {exact: true}).check();
  await page.getByLabel("手机型号分配方式", {exact: true}).selectOption("balanced");
  await page.getByRole("button", {name:"APP 图标随机",exact:true}).click();
  await page.getByLabel("候选 APP 微信", {exact: true}).check();
  await page.getByLabel("候选 APP QQ", {exact: true}).check();
  await page.getByLabel("候选 APP 抖音", {exact: true}).check();
  await page.getByLabel("随机 APP 最少数量", {exact: true}).fill("1");
  await page.getByLabel("随机 APP 最多数量", {exact: true}).fill("2");
  await expect(page.getByRole("button", {name: "生成 4 张图片", exact: true})).toBeDisabled();
  await page.getByRole("button", {name: "生成预览", exact: true}).click();
  const summaries = page.locator('[aria-label$="张状态栏"]');
  const before = await summaries.allTextContents();
  expect(before.filter(s => s.includes("iPhone 16"))).toHaveLength(2);
  expect(before.filter(s => s.includes("Pixel 9"))).toHaveLength(2);
  expect(before.every(s => /APP：(微信|QQ|抖音)/.test(s))).toBe(true);
  const model = before[0].split(" · ")[0];
  await page.getByRole("button", {name: "重新随机第 1 张", exact: true}).click();
  const after = await summaries.allTextContents();
  expect(after[0].split(" · ")[0]).toBe(model); expect(after.slice(1)).toEqual(before.slice(1));
  await page.getByRole("button", {name: "生成 4 张图片", exact: true}).click();
  await expect(page.getByText("已生成 4 张图片", {exact: true})).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", {name: "下载 ZIP", exact: true}).click();
  const path = info.outputPath("models-and-apps.zip"); await (await downloading).saveAs(path);
  const {unzipSync} = await import("fflate");
  const images = Object.values(unzipSync(new Uint8Array(await readFile(path)))); expect(images).toHaveLength(4);
  for (const image of images) {const png = Buffer.from(image); expect(png.readUInt32BE(16)).toBe(1080); expect(png.readUInt32BE(20)).toBe(1350);}
  expect(await summaries.allTextContents()).toEqual(after);
  await expect(page.getByLabel("作图预设名称",{exact:true})).toHaveCount(0);
  await expect(page.getByLabel("批量状态栏设置摘要",{exact:true})).toContainText("随机 2 个型号");
  await expect(page.getByLabel("批量状态栏设置摘要",{exact:true})).toContainText("APP 1～2 个");
  await page.setViewportSize({width: 375, height: 900});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("single-drawing custom APP preset survives full backup in a fresh browser",async({page,browser},info)=>{
  await createFromBuiltin(page,"空白 竖版");
  await page.getByRole("button",{name:"手机",exact:true}).click();
  await page.getByText("布局兼容选项",{exact:true}).click();
  await page.getByLabel("状态栏布局版本",{exact:true}).selectOption("legacy");
  const encoded=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=c.height=64;const ctx=c.getContext("2d")!;ctx.fillStyle="#00ff00";ctx.fillRect(0,0,64,64);return c.toDataURL().split(",")[1];});
  await page.getByLabel("上传 APP 图标文件",{exact:true}).setInputFiles({name:"绿色通知.png",mimeType:"image/png",buffer:Buffer.from(encoded,"base64")});
  await expect(page.getByRole("switch",{name:"显示绿色通知图标",exact:true})).toBeChecked();
  await page.getByRole("button",{name:"保存",exact:true}).click();await expect(page.getByText("已保存到本地",{exact:true})).toBeVisible();
  await page.getByLabel("作图预设名称",{exact:true}).fill("自定义图标备份");
  await page.getByRole("button",{name:"保存为新预设",exact:true}).click();
  await expect(page.getByLabel("选择作图预设").locator("option").filter({hasText:"自定义图标备份"})).toHaveCount(1);
  await page.goto("/backup");const downloading=page.waitForEvent("download");await page.getByRole("button",{name:"导出完整备份",exact:true}).click();
  const path=info.outputPath("preset-backup.json");await(await downloading).saveAs(path);
  const backup=JSON.parse(await readFile(path,"utf8"));expect(backup.drawingPresets).toHaveLength(1);expect(backup.assets).toHaveLength(1);
  const context=await browser.newContext({baseURL:new URL("/",page.url()).href,viewport:{width:1440,height:1000}});await confirmSession(context);
  try {
    const fresh=await context.newPage();fresh.on("pageerror",e=>errors.push(e.message));
    await fresh.goto(new URL("/backup",page.url()).href);await fresh.getByLabel("选择完整备份文件",{exact:true}).setInputFiles(path);
    await fresh.getByRole("button",{name:/确认恢复/}).click();await expect(fresh.getByText(/恢复完成：/)).toBeVisible();
    await createFromBuiltin(fresh,"空白 竖版");await fresh.getByRole("button",{name:"手机",exact:true}).click();
    const restoredPreset=fresh.getByLabel("选择作图预设",{exact:true}).locator("option").filter({hasText:"自定义图标备份"});await expect(restoredPreset).toHaveCount(1);
    await fresh.getByLabel("选择作图预设",{exact:true}).selectOption((await restoredPreset.getAttribute("value"))!);await fresh.getByRole("button",{name:"应用预设",exact:true}).click();
    await expect(fresh.getByRole("switch",{name:"显示绿色通知图标",exact:true})).toBeChecked();
    const png=await exportPNG(fresh,info.outputPath("restored-preset.png"));
    const pixels=await fresh.evaluate(async base64=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:"image/png"}));const c=document.createElement("canvas");c.width=b.width;c.height=b.height;const ctx=c.getContext("2d")!;ctx.drawImage(b,0,0);b.close();const d=ctx.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<60&&d[i+1]>180&&d[i+2]<60)n++;return n;},png.toString("base64"));expect(pixels).toBeGreaterThan(10);
  }finally{await context.close();}
});

test("adding a status bar shifts real background pixels once and restores original on removal", async ({page}, info) => {
  await createFromBuiltin(page);
  const original = await exportPNG(page, info.outputPath("body-before.png"));
  await page.getByRole("button", {name: "手机", exact: true}).click();
  await page.getByLabel("状态栏处理方式", {exact: true}).selectOption("prepend");
  const added = await exportPNG(page, info.outputPath("body-added.png"));
  const offset = added.readUInt32BE(20) - original.readUInt32BE(20);
  expect(offset).toBeGreaterThan(0); expect(added.readUInt32BE(16)).toBe(original.readUInt32BE(16));
  await page.getByLabel("电量百分比", {exact: true}).fill("55");
  const again = await exportPNG(page, info.outputPath("body-added-again.png"));
  expect(again.readUInt32BE(20)).toBe(added.readUInt32BE(20));
  const difference = await page.evaluate(async ([a,b,offset]) => {
    const decode = async (encoded: string) => {const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], {type:"image/png"})); const canvas = document.createElement("canvas"); canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext("2d")!;ctx.drawImage(bitmap,0,0);bitmap.close();return ctx;};
    const first = await decode(a as string), second = await decode(b as string);
    const x = 100, y = 350, w = 500, h = 500;
    const one = first.getImageData(x,y,w,h).data, two = second.getImageData(x,y+Number(offset),w,h).data;
    let different = 0; for(let i=0;i<one.length;i++) if(one[i]!==two[i])different++; return different;
  }, [original.toString("base64"), again.toString("base64"), offset]);
  expect(difference).toBe(0);
  await page.getByLabel("状态栏处理方式", {exact: true}).selectOption("keep");
  const removed = await exportPNG(page, info.outputPath("body-restored.png"));
  expect(removed.equals(original)).toBe(true);
});

test("custom parameter labels support rename, cancel, undo, persistence and batch display without rebinding", async ({page}, info) => {
  await createFromBuiltin(page);
  const readDoc = () => page.evaluate(async () => {
    const id = location.pathname.split("/").pop()!;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {const request = indexedDB.open("caishen-studio"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);});
    try {return await new Promise<any>((resolve, reject) => {const request = db.transaction("works").objectStore("works").get(id); request.onsuccess = () => resolve(request.result.doc); request.onerror = () => reject(request.error);});} finally {db.close();}
  });
  const original = await readDoc();
  await page.getByRole("button", {name: "参数", exact: true}).click();
  const first = page.getByRole("button", {name: /^重命名参数：/}).first();
  const originalLabel = await first.getAttribute("aria-label");
  await first.click();
  await page.getByLabel("自定义参数名称", {exact: true}).fill("   ");
  await page.getByLabel("自定义参数名称", {exact: true}).press("Enter");
  await expect(page.getByRole("alert")).toHaveText("参数名称不能为空");
  await page.getByLabel("自定义参数名称", {exact: true}).fill(" 活动主标题 ");
  await page.getByLabel("自定义参数名称", {exact: true}).press("Enter");
  await expect(page.getByRole("button", {name: "重命名参数：活动主标题", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "撤销", exact: true}).click();
  await expect(page.getByRole("button", {name: originalLabel!, exact: true})).toBeVisible();
  await page.getByRole("button", {name: "重做", exact: true}).click();
  await page.getByRole("button", {name: "重命名参数：活动主标题", exact: true}).click();
  await page.getByLabel("自定义参数名称", {exact: true}).fill("放弃修改");
  await page.getByLabel("自定义参数名称", {exact: true}).press("Escape");
  await expect(page.getByRole("button", {name: "重命名参数：活动主标题", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "保存", exact: true}).click();
  await expect(page.getByText("已保存到本地", {exact: true})).toBeVisible();
  const renamed = await readDoc();
  expect(renamed.layers).toEqual(original.layers);
  expect(renamed.parameters.map((p: any) => ({...p, name: ""}))).toEqual(original.parameters.map((p: any) => ({...p, name: ""})));
  await page.reload();
  await page.getByRole("button", {name: "参数", exact: true}).click();
  await expect(page.getByRole("button", {name: "重命名参数：活动主标题", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "参数设置", exact: true}).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("参数名称", {exact: true})).toHaveValue("活动主标题");
  await dialog.getByLabel("参数名称", {exact: true}).fill("商品名称");
  await dialog.getByRole("button", {name: "保存", exact: true}).click();
  await expect(page.getByRole("button", {name: "重命名参数：商品名称", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "另存为模板", exact: true}).click();
  await page.getByRole("dialog").getByRole("textbox").fill("参数自定义名称回归");
  await page.getByRole("button", {name: "保存模板", exact: true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/batch");
  await page.getByLabel("批量模板", {exact: true}).selectOption({index: 1});
  await expect(page.getByTitle("商品名称", {exact: true})).toBeVisible();
  await page.getByLabel("生成张数", {exact: true}).fill("1");
  await page.getByRole("button", {name: "生成预览", exact: true}).click();
  await page.getByRole("button", {name: "生成 1 张图片", exact: true}).click();
  await expect(page.getByText("已生成 1 张图片", {exact: true})).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", {name: "下载 ZIP", exact: true}).click();
  const path = info.outputPath("renamed-parameter.zip"); await (await downloading).saveAs(path);
  const {unzipSync} = await import("fflate");
  expect(Object.keys(unzipSync(new Uint8Array(await readFile(path))))).toHaveLength(1);
});

test("manual region editing preserves source colors, cancels cleanly and repairs legacy faded references", async ({page}, info) => {
  await page.goto("/custom");
  const encoded = await page.evaluate(() => {const c=document.createElement("canvas");c.width=600;c.height=900;const ctx=c.getContext("2d")!;ctx.fillStyle="#2476b8";ctx.fillRect(0,0,600,900);ctx.fillStyle="#ea6830";ctx.fillRect(430,80,100,100);return c.toDataURL().split(",")[1];});
  await page.locator('input[type="file"]').setInputFiles({name:"manual-colors.png",mimeType:"image/png",buffer:Buffer.from(encoded,"base64")});
  await page.getByRole("button", {name:/手动重建模式/}).click();
  await page.getByRole("button", {name:"生成初始模板并进入编辑器",exact:true}).click();
  await expect(page).toHaveURL(/\/editor\//);
  const colorAt = (x: number, y: number) => page.locator("canvas.lower-canvas").evaluate((el, [x,y]) => {const c=el as HTMLCanvasElement;return [...c.getContext("2d")!.getImageData(Math.floor(c.width*x),Math.floor(c.height*y),1,1).data];}, [x,y]);
  const blue = [36,118,184,255];
  await expect.poll(() => colorAt(.85,.85)).toEqual(blue);
  await page.getByRole("button", {name:"文字",exact:true}).click();
  await page.getByRole("button", {name:"框选区域添加文字",exact:true}).click();
  const bounds = (await page.locator("canvas.upper-canvas").boundingBox())!;
  const start={x:bounds.x+bounds.width*.2,y:bounds.y+bounds.height*.25};
  const end={x:bounds.x+bounds.width*.6,y:bounds.y+bounds.height*.36};
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});
  await expect.poll(() => colorAt(.85,.85)).toEqual(blue);
  await expect.poll(() => colorAt(.4,.3)).toEqual(blue);
  await page.keyboard.press("Escape");await page.mouse.up();
  await expect.poll(() => colorAt(.4,.3)).toEqual(blue);
  await page.getByRole("button", {name:"框选区域添加文字",exact:true}).click();
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up();
  await expect.poll(() => colorAt(.85,.85)).toEqual(blue);
  await page.getByRole("button", {name:"保存",exact:true}).click();
  await expect(page.getByText("已保存到本地",{exact:true})).toBeVisible();
  const pixels = (image: Buffer) => page.evaluate(async encoded => {const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:"image/png"}));const c=document.createElement("canvas");c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext("2d")!;ctx.drawImage(bitmap,0,0);bitmap.close();return [...ctx.getImageData(510,765,1,1).data];}, image.toString("base64"));
  expect(await pixels(await exportPNG(page,info.outputPath("manual-original-colors.png")))).toEqual(blue);
  await page.getByRole("button", {name:"更多",exact:true}).click();
  const downloading=page.waitForEvent("download");
  await page.getByRole("menuitem", {name:"导出模板文件（含图片）",exact:true}).click();
  const path=info.outputPath("manual-reference.haishen.json");await(await downloading).saveAs(path);
  const packaged=JSON.parse(await readFile(path,"utf8"));
  expect(packaged.doc.layers.filter((l: any) => l.type==="text")).toHaveLength(1);
  const reference=packaged.doc.layers.find((l: any) => l.name==="原图参考（可隐藏或删除）");
  expect(reference.opacity).toBe(1);
  reference.opacity=.35;
  // An unrelated deliberately translucent layer must not be changed by the repair.
  const unrelated={...reference,id:"intentional-tint",name:"自定义透明效果",x:0,y:0,width:20,height:20,opacity:.2};
  packaged.doc.layers.push(unrelated);
  await page.goto("/works");
  await page.locator('input[type="file"]').setInputFiles({name:"legacy-manual.haishen.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(packaged))});
  await expect(page).toHaveURL(/\/editor\//);
  await expect(page.getByRole("button", {name:"恢复原图清晰度",exact:true})).toBeVisible();
  await page.getByRole("button", {name:"恢复原图清晰度",exact:true}).click();
  await expect.poll(() => colorAt(.85,.85)).toEqual(blue);
  await page.getByRole("button", {name:"撤销",exact:true}).click();
  await expect(page.getByRole("button", {name:"恢复原图清晰度",exact:true})).toBeVisible();
  await page.getByRole("button", {name:"重做",exact:true}).click();
  await page.getByRole("button", {name:"保存",exact:true}).click();
  await expect(page.getByText("已保存到本地",{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", {name:"恢复原图清晰度",exact:true})).toHaveCount(0);
  expect(await pixels(await exportPNG(page,info.outputPath("legacy-reference-repaired.png")))).toEqual(blue);
  const retained = await page.evaluate(async () => {const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open("caishen-studio");request.onsuccess=()=>resolve(request.result);});try {return await new Promise<number>(resolve=>{const r=db.transaction("works").objectStore("works").get(location.pathname.split("/").pop()!);r.onsuccess=()=>resolve(r.result.doc.layers.find((l: any)=>l.id==="intentional-tint").opacity);});}finally{db.close();}});
  expect(retained).toBe(.2);
});

test("calibrated rendering keeps manual appearance and tints custom icons", async ({page},info)=>{
  await calibratedWork(page);
  await page.getByLabel("手机品牌",{exact:true}).selectOption("Samsung");
  await page.getByLabel("手机型号",{exact:true}).selectOption("galaxys24ultra");
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
  await page.getByLabel("系统参考样式",{exact:true}).selectOption("oneui7");
  const countGreen=(image:Buffer)=>page.evaluate(async encoded=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:"image/png"}));const c=document.createElement("canvas");c.width=b.width;c.height=b.height;const ctx=c.getContext("2d")!;ctx.drawImage(b,0,0);b.close();const d=ctx.getImageData(0,0,c.width,Math.min(140,c.height)).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<60&&d[i+1]>180&&d[i+2]<60)n++;return n;},image.toString("base64"));
  const icon=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=c.height=64;const ctx=c.getContext("2d")!;ctx.fillStyle="#00ff00";ctx.beginPath();ctx.arc(32,32,25,0,Math.PI*2);ctx.fill();return c.toDataURL().split(",")[1];});
  await page.getByLabel("上传 APP 图标文件",{exact:true}).setInputFiles({name:"圆形通知.png",mimeType:"image/png",buffer:Buffer.from(icon,"base64")});
  await expect(page.getByLabel("显示圆形通知图标",{exact:true})).toBeChecked();
  const original=await exportPNG(page,info.outputPath("fusion-color.png"));expect(await countGreen(original)).toBeGreaterThan(10);
  await page.getByLabel("自定义 APP 颜色",{exact:true}).selectOption("mono");
  const mono=await exportPNG(page,info.outputPath("fusion-mono.png"));expect(await countGreen(mono)).toBe(0);
  const body=await page.evaluate(async encoded=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:"image/png"}));const c=document.createElement("canvas");c.width=b.width;c.height=b.height;const ctx=c.getContext("2d")!;ctx.drawImage(b,0,0);b.close();return [...ctx.getImageData(500,500,1,1).data];},mono.toString("base64"));
  expect(body).toEqual([255,255,255,255]);
  await page.getByLabel("电量百分比",{exact:true}).fill("57");
  await page.getByRole("button",{name:"保存",exact:true}).click();
  await expect(page.getByText("已保存到本地",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"更多",exact:true}).click();
  const downloading=page.waitForEvent("download");await page.getByRole("menuitem",{name:"导出模板文件（含图片）",exact:true}).click();
  const path=info.outputPath("fusion-template.json");await(await downloading).saveAs(path);
  const saved=JSON.parse(await readFile(path,"utf8"));
  expect(saved.doc.phone).toMatchObject({rendering:"natural",styleId:"oneui7",customAppStyle:"mono",battery:57});
  expect(saved.doc.statusLocation.state).toBe("confirmed");
  expect(saved.doc.layers.find((l:any)=>l.id===`${saved.doc.phone.groupId}_background`).type).toBe("image");
  await page.setViewportSize({width:375,height:900});
  await page.reload();
  await page.getByRole("button",{name:"手机",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"手机",exact:true}).getByTestId("status-location-state")).toHaveText("已确认");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("batch automatically fits per-model results without a separate apply step",async({page},info)=>{
  await calibratedBatch(page);
  await page.getByLabel("生成张数",{exact:true}).fill("4");
  await expect(page.getByRole("button",{name:"状态栏保留原图",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"状态栏修改状态栏",exact:true}).click();
  await expect(page.getByRole("button",{name:"应用手机状态栏",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"手机型号随机",exact:true}).click();
  await page.getByRole("button",{name:"清空型号",exact:true}).click();
  await page.getByLabel("候选型号 iPhone 16",{exact:true}).check();
  await page.getByLabel("候选型号 Google Pixel 9",{exact:true}).check();
  await page.getByLabel("手机型号分配方式",{exact:true}).selectOption("balanced");
  await page.getByRole("button",{name:"生成预览",exact:true}).click();
  await expect(page.getByRole("button",{name:"生成 4 张图片",exact:true})).toBeEnabled();
  const summaries=page.locator('[aria-label$="张状态栏"]');const before=await summaries.allTextContents();
  expect(before.filter(s=>s.includes("iPhone 16"))).toHaveLength(2);expect(before.filter(s=>s.includes("Pixel 9"))).toHaveLength(2);
  await page.getByRole("button",{name:"重新随机第 1 张",exact:true}).click();
  await expect(page.getByRole("button",{name:"生成 4 张图片",exact:true})).toBeEnabled();
  expect((await summaries.allTextContents()).slice(1)).toEqual(before.slice(1));
  await page.getByRole("button",{name:"生成 4 张图片",exact:true}).click();await expect(page.getByText("已生成 4 张图片",{exact:true})).toBeVisible();
  const downloading=page.waitForEvent("download");await page.getByRole("link",{name:"下载 ZIP",exact:true}).click();const path=info.outputPath("fused-batch.zip");await(await downloading).saveAs(path);
  const {unzipSync}=await import("fflate");expect(Object.keys(unzipSync(new Uint8Array(await readFile(path))))).toHaveLength(4);
});

test("uploaded compact status bar controls actual layer and exported image sizes", async ({page}, info) => {
  await page.goto("/custom");
  const encoded = await page.evaluate(() => {
    const c=document.createElement("canvas");c.width=360;c.height=800;const ctx=c.getContext("2d")!;
    ctx.fillStyle="#f5f5f5";ctx.fillRect(0,0,360,800);ctx.fillStyle="#191919";
    ctx.font="10px Arial";ctx.fillText("20:06",16,16);
    ctx.fillText("HD 65",274,16);
    ctx.fillStyle="#1166cc";ctx.fillRect(0,30,360,10);
    return c.toDataURL().split(",")[1];
  });
  await page.locator('input[type="file"]').setInputFiles({name:"compact-status.png",mimeType:"image/png",buffer:Buffer.from(encoded,"base64")});
  await page.getByText("保持原始尺寸",{exact:true}).click();
  await page.getByRole("button",{name:/原图背景模式/}).click();
  await page.getByRole("button",{name:"生成初始模板并进入编辑器"}).click();
  await confirmLocation(page);
  await page.getByRole("button",{name:"进入作图",exact:true}).click();
  await page.getByRole("combobox",{name:"手机品牌",exact:true}).selectOption("Apple");
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
  await page.getByRole("button",{name:"保存",exact:true}).click();
  await expect(page.getByText("已保存到本地",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"更多",exact:true}).click();
  const downloading=page.waitForEvent("download");await page.getByRole("menuitem",{name:"导出模板文件（含图片）",exact:true}).click();
  const path=info.outputPath("compact-status.json");await(await downloading).saveAs(path);
  const saved=JSON.parse(await readFile(path,"utf8"));
  const prefix=saved.doc.phone.groupId;
  expect(saved.doc.layers.find((l:any)=>l.id===`${prefix}_background`).height).toBeLessThan(25);
  expect(saved.doc.layers.find((l:any)=>l.id===`${prefix}_time`).height).toBeLessThan(12);
  const bytes=await exportPNG(page,info.outputPath("compact-status.png"));
  expect(bytes.readUInt32BE(16)).toBe(360);expect(bytes.readUInt32BE(20)).toBe(800);
  const marker=await page.evaluate(async base64=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:"image/png"}));const c=document.createElement("canvas");c.width=b.width;c.height=b.height;const ctx=c.getContext("2d")!;ctx.drawImage(b,0,0);b.close();return [...ctx.getImageData(180,35,1,1).data];},bytes.toString("base64"));
  expect(marker).toEqual([17,102,204,255]);
});

test("step 04 keeps fixed and cross-midnight values, enforces low-power battery and exports the frozen preview",async({page},info)=>{
  await calibratedBatch(page);
  await page.getByLabel("生成张数",{exact:true}).fill("6");
  await expect(page.getByRole("button",{name:"状态栏保留原图",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("group",{name:"时间模式",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"状态栏修改状态栏",exact:true}).click();
  await page.getByLabel("固定状态栏时间",{exact:true}).fill("20:06");
  await page.getByRole("button",{name:"时间区间随机",exact:true}).click();
  await page.getByLabel("随机开始时间",{exact:true}).fill("22:00");await page.getByLabel("随机结束时间",{exact:true}).fill("02:00");
  await expect(page.getByText("跨午夜：结束时间为次日。",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"时间固定",exact:true}).click();await expect(page.getByLabel("固定状态栏时间",{exact:true})).toHaveValue("20:06");
  await page.getByRole("button",{name:"时间区间随机",exact:true}).click();await expect(page.getByLabel("随机结束时间",{exact:true})).toHaveValue("02:00");
  await page.getByLabel("固定状态栏电量",{exact:true}).fill("65");
  await page.getByRole("button",{name:"电量区间随机",exact:true}).click();await page.getByLabel("随机最低电量",{exact:true}).fill("50");await page.getByLabel("随机最高电量",{exact:true}).fill("90");
  await page.getByRole("button",{name:"电量固定",exact:true}).click();await expect(page.getByLabel("固定状态栏电量",{exact:true})).toHaveValue("65");
  await page.getByRole("button",{name:"电量区间随机",exact:true}).click();
  await page.getByRole("button",{name:"APP 图标不显示",exact:true}).click();
  await page.getByText("更多设置",{exact:true}).click();
  await page.getByRole("switch",{name:"随机低电量模式",exact:true}).check();
  await expect(page.getByText(/低电量模式开启的图片/)).toBeVisible();
  await page.getByRole("button",{name:"生成预览",exact:true}).click();
  const summaries=page.locator('[aria-label$="张状态栏"]');const before=await summaries.allTextContents();expect(before).toHaveLength(6);
  for(const text of before){const m=text.match(/(\d{2}):(\d{2}) · 电量 (\d+)%/)!;const minutes=Number(m[1])*60+Number(m[2]);const battery=Number(m[3]);expect(minutes>=1320||minutes<=120).toBe(true);expect(battery<=20||(battery>=50&&battery<=90)).toBe(true);}
  await page.setViewportSize({width:375,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole("button",{name:"生成 6 张图片",exact:true}).click();await expect(page.getByText("已生成 6 张图片",{exact:true})).toBeVisible();
  expect(await summaries.allTextContents()).toEqual(before);
  const downloading=page.waitForEvent("download");await page.getByRole("link",{name:"下载 ZIP",exact:true}).click();const path=info.outputPath("simple-step-04.zip");await(await downloading).saveAs(path);
  const {unzipSync}=await import("fflate");expect(Object.keys(unzipSync(new Uint8Array(await readFile(path))))).toHaveLength(6);
});

test("batch custom APP candidate can be unchecked, reselected and exported as real pixels",async({page},info)=>{
  await calibratedBatch(page);await page.getByLabel("生成张数",{exact:true}).fill("1");
  await page.getByRole("button",{name:"状态栏修改状态栏",exact:true}).click();await page.getByRole("button",{name:"APP 图标随机",exact:true}).click();
  const encoded=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=c.height=64;const ctx=c.getContext("2d")!;ctx.fillStyle="#00ff00";ctx.fillRect(0,0,64,64);return c.toDataURL().split(",")[1];});
  await page.getByLabel("上传批量 APP 图标文件",{exact:true}).setInputFiles({name:"批量绿色通知.png",mimeType:"image/png",buffer:Buffer.from(encoded,"base64")});
  const candidate=page.getByLabel("候选 APP 批量绿色通知",{exact:true});await expect(candidate).toBeChecked();await candidate.uncheck();await expect(candidate).not.toBeChecked();await candidate.check();
  await page.getByLabel("随机 APP 最少数量",{exact:true}).fill("1");await page.getByRole("button",{name:"完成 APP 选择",exact:true}).click();
  await page.getByRole("button",{name:"生成预览",exact:true}).click();await expect(page.getByLabel("第 1 张状态栏",{exact:true})).toContainText("APP：批量绿色通知");
  await page.getByRole("button",{name:"生成 1 张图片",exact:true}).click();await expect(page.getByText("已生成 1 张图片",{exact:true})).toBeVisible();
  const downloading=page.waitForEvent("download");await page.getByRole("link",{name:"下载 ZIP",exact:true}).click();const path=info.outputPath("custom-app.zip");await(await downloading).saveAs(path);
  const {unzipSync}=await import("fflate");const images=Object.values(unzipSync(new Uint8Array(await readFile(path))));expect(images).toHaveLength(1);
  const green=await page.evaluate(async base64=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:"image/png"}));const c=document.createElement("canvas");c.width=b.width;c.height=b.height;const ctx=c.getContext("2d")!;ctx.drawImage(b,0,0);b.close();const d=ctx.getImageData(0,0,c.width,Math.min(150,c.height)).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<60&&d[i+1]>180&&d[i+2]<60)n++;return n;},Buffer.from(images[0]).toString("base64"));expect(green).toBeGreaterThan(10);
});

test("status-bar replacement preserves every navigation and body pixel in single and batch exports",async({page},info)=>{
  await page.goto("/custom");
  const encoded=await page.evaluate(()=>{
    const c=document.createElement("canvas");c.width=400;c.height=860;const ctx=c.getContext("2d")!;
    ctx.fillStyle="#f7f7f7";ctx.fillRect(0,0,400,860);
    ctx.fillStyle="#141414";ctx.font="14px Arial";ctx.fillText("20:06",14,18);ctx.font="12px Arial";ctx.fillText("HD HD 65",288,18);
    ctx.fillStyle="#55bbee";ctx.fillRect(62,6,12,14);ctx.fillStyle="#2388dd";ctx.fillRect(79,6,12,14);
    ctx.fillStyle="#ffffff";ctx.beginPath();ctx.roundRect(300,32,90,32,16);ctx.fill();ctx.strokeStyle="#dddddd";ctx.stroke();
    ctx.fillStyle="#111111";ctx.beginPath();ctx.arc(322,48,3,0,Math.PI*2);ctx.arc(330,48,3,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#111111";ctx.beginPath();ctx.arc(374,48,8,0,Math.PI*2);ctx.stroke();
    ctx.font="bold 19px sans-serif";ctx.fillText("收款小账本",148,55);
    ctx.font="bold 18px sans-serif";ctx.fillText("补充经营信息，开启更多服务",12,110);
    ctx.fillStyle="#ffffff";ctx.fillRect(12,145,376,350);ctx.fillStyle="#222222";ctx.font="bold 30px Arial";ctx.fillText("¥18.80",140,245);
    return c.toDataURL().split(",")[1];
  });
  await page.locator('input[type="file"]').setInputFiles({name:"receipt-navigation.png",mimeType:"image/png",buffer:Buffer.from(encoded,"base64")});
  await page.getByText("保持原始尺寸",{exact:true}).click();await page.getByRole("button",{name:/原图背景模式/}).click();await page.getByRole("button",{name:"生成初始模板并进入编辑器",exact:true}).click();
  await confirmLocation(page);
  await page.getByRole("button",{name:"进入作图",exact:true}).click();await page.getByLabel("手机品牌",{exact:true}).selectOption("Samsung");
  await expect(page.getByTestId("status-location-state")).toHaveText("已确认");
  await expect(page.getByRole("switch",{name:"显示底部手势条",exact:true})).not.toBeChecked();
  const diff=async(png:Buffer)=>page.evaluate(async([original,output])=>{
    const pixels=async(base64:string)=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:"image/png"}));const c=document.createElement("canvas");c.width=b.width;c.height=b.height;const ctx=c.getContext("2d")!;ctx.drawImage(b,0,0);b.close();return {w:c.width,h:c.height,data:ctx.getImageData(0,0,c.width,c.height).data};};
    const a=await pixels(original),b=await pixels(output);let top=0,outside=0;
    for(let i=0;i<a.data.length;i+=4)if([0,1,2,3].some(k=>a.data[i+k]!==b.data[i+k])){if(i/4/a.w>=32)outside++;else top++;}
    return {outside,top,w:b.w,h:b.h};
  },[encoded,png.toString("base64")]);
  const single=await exportPNG(page,info.outputPath("protected-single.png"));const singleDiff=await diff(single);expect(singleDiff).toMatchObject({outside:0,w:400,h:860});expect(singleDiff.top).toBeGreaterThan(0);
  await page.getByRole("button",{name:"另存为模板",exact:true}).click();await page.getByRole("dialog").getByRole("textbox").fill("状态栏边界保护模板");await page.getByRole("button",{name:"保存模板",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/batch");const option=page.getByLabel("批量模板",{exact:true}).locator("option").filter({hasText:"状态栏边界保护模板"});await expect(option).toHaveCount(1);await page.getByLabel("批量模板",{exact:true}).selectOption((await option.getAttribute("value"))!);
  await page.getByLabel("生成张数",{exact:true}).fill("2");await page.getByRole("button",{name:"状态栏修改状态栏",exact:true}).click();await page.getByRole("button",{name:"时间区间随机",exact:true}).click();await page.getByRole("button",{name:"生成预览",exact:true}).click();
  await page.getByRole("button",{name:"生成 2 张图片",exact:true}).click();await expect(page.getByText("已生成 2 张图片",{exact:true})).toBeVisible();
  const downloading=page.waitForEvent("download");await page.getByRole("link",{name:"下载 ZIP",exact:true}).click();const path=info.outputPath("protected-batch.zip");await(await downloading).saveAs(path);
  const {unzipSync}=await import("fflate");const images=Object.values(unzipSync(new Uint8Array(await readFile(path))));expect(images).toHaveLength(2);
  for(const image of images)expect(await diff(Buffer.from(image))).toMatchObject({outside:0,w:400,h:860});
});


test("a poster without a safe status area is preserved until prepend is explicitly selected",async({page})=>{
  await page.goto("/batch");await page.getByLabel("批量模板",{exact:true}).selectOption("b:bt_coffee");await page.getByLabel("生成张数",{exact:true}).fill("1");
  await page.getByRole("button",{name:"状态栏修改状态栏",exact:true}).click();
  await expect(page.getByRole("button",{name:"生成预览",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"定位原状态栏",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"生成 0 张图片",exact:true})).toBeDisabled();
  await expect(page.getByLabel("第 1 张状态栏",{exact:true})).toHaveCount(0);
  await page.getByText("更多设置",{exact:true}).click();await page.getByLabel("批量状态栏添加方式",{exact:true}).selectOption("prepend");
  await page.getByRole("button",{name:"生成预览",exact:true}).click();await expect(page.getByRole("button",{name:"生成 1 张图片",exact:true})).toBeEnabled();
  await expect(page.getByLabel("第 1 张状态栏",{exact:true})).toBeVisible();
  const dimensions=await page.getByRole("img",{name:"第 1 张预览",exact:true}).evaluate(async el=>{const image=el as HTMLImageElement;await image.decode();return {w:image.naturalWidth,h:image.naturalHeight};});
  expect(dimensions.w).toBeGreaterThan(0);expect(dimensions.h).toBeGreaterThan(0);expect(dimensions.w/dimensions.h).toBeLessThan(1080/1350);
});
