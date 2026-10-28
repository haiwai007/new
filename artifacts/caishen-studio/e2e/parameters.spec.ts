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
test.afterEach(() => expect(errors, "no browser exceptions").toEqual([]));
async function source(page: Page) {
  await page.goto("/custom");
  const encoded = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 700;
    const x = c.getContext("2d")!;
    x.fillStyle = "white";
    x.fillRect(0, 0, 400, 700);
    x.fillStyle = "black";
    x.font = "22px Arial";
    x.fillText("OLD-ORDER", 40, 100);
    x.fillStyle = "#aa0000";
    x.fillRect(40, 200, 100, 100);
    x.fillStyle = "#0088dd";
    x.fillRect(220, 200, 120, 100);
    x.fillStyle = "#11aa55";
    x.fillRect(0, 600, 400, 100);
    return c.toDataURL().split(",")[1];
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "parameters.png",
    mimeType: "image/png",
    buffer: Buffer.from(encoded, "base64"),
  });
  await page.getByText("保持原始尺寸", { exact: true }).click();
  await page.getByRole("button", { name: /原图背景模式/ }).click();
  await page
    .getByRole("button", { name: "生成初始模板并进入编辑器", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "参数", exact: true }).click();
  return encoded;
}
async function region(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  kind: string,
) {
  await page
    .getByRole("button", { name: "新增参数 · 框选区域", exact: true })
    .click();
  const canvas = page.locator("canvas.upper-canvas");
  await expect(canvas).toBeVisible();
  const b = (await canvas.boundingBox())!,
    dx = b.width / 400,
    dy = b.height / 700;
  await page.mouse.move(b.x + box.x * dx, b.y + box.y * dy);
  await page.mouse.down();
  await page.mouse.move(
    b.x + (box.x + box.width) * dx,
    b.y + (box.y + box.height) * dy,
    { steps: 8 },
  );
  await expect(page.getByTestId("draw-dimensions")).toBeVisible();
  await page.mouse.up();
  const toolbar = page.getByLabel("框选参数工具条", { exact: true });
  await expect(toolbar).toBeVisible();
  if (kind)
    await toolbar.getByRole("button", { name: kind, exact: true }).click();
}
async function packaged(page: Page, info: TestInfo, name: string) {
  await page.getByRole("button", { name: "更多", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "导出模板文件（含图片）", exact: true })
    .click();
  const path = info.outputPath(name);
  await (await download).saveAs(path);
  return JSON.parse(await readFile(path, "utf8"));
}
async function png(page: Page, info: TestInfo, name: string) {
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const d = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "导出", exact: true })
    .click();
  const path = info.outputPath(name);
  await (await d).saveAs(path);
  return readFile(path);
}
async function picture(page: Page, kind: "avatar" | "logo" | "red") {
  return Buffer.from(
    await page.evaluate((kind) => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = kind === "avatar" ? 32 : 64;
      const x = c.getContext("2d")!;
      if (kind === "avatar") {
        x.fillStyle = "#00ff00";
        x.fillRect(0, 0, 32, 32);
        x.fillStyle = "#ffff00";
        x.fillRect(32, 0, 32, 32);
      } else if (kind === "red") {
        x.fillStyle = "#ff0000";
        x.fillRect(0, 0, 64, 64);
      } else {
        x.fillStyle = "#0000ff";
        x.fillRect(16, 16, 32, 32);
      }
      return c.toDataURL().split(",")[1];
    }, kind),
    "base64",
  );
}
test("region order parameters preserve rules, previews, linked positions and frozen unique batch exports", async ({
  page,
}, info) => {
  await source(page);
  await region(page, { x: 34, y: 72, width: 310, height: 38 }, "订单号");
  await page.getByLabel("当前参数名称", { exact: true }).fill("交易订单号");
  await page.getByLabel("当前参数名称", { exact: true }).press("Tab");
  await page.getByLabel("订单号固定前缀", { exact: true }).fill("DD");
  await expect(
    page.getByLabel("订单号规则摘要", { exact: true }),
  ).toContainText("完整 12 位");
  await page.getByLabel("参数底图处理", { exact: true }).selectOption("solid");
  await page.getByRole("button", { name: "随机示例", exact: true }).click();
  const example = await page
    .getByLabel("参数临时示例", { exact: true })
    .inputValue();
  expect(example).toMatch(/^DD\d{10}$/);
  const trial = await packaged(page, info, "trial.json");
  expect(trial.doc.parameters[0].defaultValue).toBe("0000000000");
  expect(
    trial.doc.layers.find((l: any) => l.id === trial.doc.parameters[0].layerId)
      .text,
  ).toBe("0000000000");
  await page.getByRole("button", { name: "设为默认值", exact: true }).click();
  await region(page, { x: 34, y: 132, width: 310, height: 38 }, "");
  await page
    .getByLabel("绑定已有参数", { exact: true })
    .selectOption(trial.doc.parameters[0].id);
  await page.getByRole("button", { name: "绑定到此区域", exact: true }).click();
  const template = await packaged(page, info, "order-template.json");
  expect(template.doc.parameters).toHaveLength(1);
  expect(template.doc.parameters[0].linkedLayerIds).toHaveLength(1);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "进入作图", exact: true }).click();
  await page.getByRole("button", { name: "图层编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  if (await page.getByRole("button", { name: "手机", exact: true }).isVisible())
    await page.getByRole("button", { name: "手机", exact: true }).click();
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await page
    .getByRole("button", { name: "随机生成交易订单号", exact: true })
    .click();
  const current = await page
    .getByLabel("交易订单号", { exact: true })
    .inputValue();
  expect(current).toMatch(/^DD\d{10}$/);
  expect(current).not.toBe(example);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await expect(page.getByLabel("交易订单号", { exact: true })).toHaveValue(
    current,
  );
  const saved = await packaged(page, info, "drawing.json");
  const parameter = saved.doc.parameters[0];
  for (const id of [parameter.layerId, ...parameter.linkedLayerIds])
    expect(saved.doc.layers.find((l: any) => l.id === id).text).toBe(current);
  expect((await png(page, info, "order.png")).readUInt32BE(16)).toBe(400);
  await page.getByRole("button", { name: "另存为模板", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("订单号批量模板");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/batch");
  const option = page
    .getByLabel("作图模板", { exact: true })
    .locator("option")
    .filter({ hasText: "订单号批量模板" });
  await expect(option).toHaveCount(1);
  await page
    .getByLabel("作图模板", { exact: true })
    .selectOption((await option.getAttribute("value"))!);
  await page.getByLabel("生成张数", { exact: true }).fill("4");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  const summaries = page.locator('[aria-label$="张交易订单号"]');
  await expect(summaries).toHaveCount(4);
  const before = await summaries.allTextContents();
  expect(new Set(before).size).toBe(4);
  for (const text of before) expect(text).toMatch(/DD\d{10}$/);
  await page
    .getByRole("button", { name: "重新随机第 1 张", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "生成 4 张图片", exact: true }),
  ).toBeEnabled();
  const after = await summaries.allTextContents();
  expect(after.slice(1)).toEqual(before.slice(1));
  expect(new Set(after).size).toBe(4);
  await page
    .getByRole("button", { name: "生成 4 张图片", exact: true })
    .click();
  await expect(
    page.getByText("已生成 4 张图片", { exact: true }),
  ).toBeVisible();
  const d = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 ZIP", exact: true }).click();
  const path = info.outputPath("orders.zip");
  await (await d).saveAs(path);
  const { unzipSync } = await import("fflate");
  expect(
    Object.keys(unzipSync(new Uint8Array(await readFile(path)))),
  ).toHaveLength(4);
  expect(await summaries.allTextContents()).toEqual(after);
});
test("avatar and transparent logo defaults survive crop, replacement and portable import", async ({
  page,
  browser,
}, info) => {
  await source(page);
  await region(page, { x: 40, y: 200, width: 100, height: 100 }, "头像");
  await page.getByLabel("当前参数名称", { exact: true }).fill("买家头像");
  await page.getByLabel("当前参数名称", { exact: true }).press("Tab");
  await page.getByLabel("参数底图处理", { exact: true }).selectOption("solid");
  await page.getByLabel("上传买家头像", { exact: true }).setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: await picture(page, "avatar"),
  });
  await expect(
    page.getByText("临时示例，不写入默认值；保存和导出模板使用正式默认内容。", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "调整裁剪", exact: true }).click();
  await page.getByLabel("买家头像水平焦点", { exact: true }).focus();
  await page.getByLabel("买家头像水平焦点", { exact: true }).press("Home");
  await page.getByRole("button", { name: "设为默认值", exact: true }).click();
  await region(page, { x: 220, y: 200, width: 120, height: 100 }, "Logo");
  await page.getByLabel("当前参数名称", { exact: true }).fill("店铺Logo");
  await page.getByLabel("当前参数名称", { exact: true }).press("Tab");
  await page.getByLabel("参数底图处理", { exact: true }).selectOption("solid");
  await page.getByLabel("上传店铺Logo", { exact: true }).setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: await picture(page, "logo"),
  });
  await expect(
    page.getByRole("button", { name: "设为默认值", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "设为默认值", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "进入作图", exact: true }).click();
  await page.getByRole("button", { name: "图层编辑", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  if (await page.getByRole("button", { name: "手机", exact: true }).isVisible())
    await page.getByRole("button", { name: "手机", exact: true }).click();
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await page.getByLabel("上传买家头像", { exact: true }).setInputFiles({
    name: "red.png",
    mimeType: "image/png",
    buffer: await picture(page, "red"),
  });
  await page
    .getByLabel("参数买家头像", { exact: true })
    .getByRole("button", { name: "恢复默认", exact: true })
    .click();
  const logoControls = page.getByLabel("参数店铺Logo", { exact: true });
  await logoControls
    .getByRole("button", { name: "调整位置", exact: true })
    .click();
  const scale = page.getByLabel("店铺Logo框内缩放", { exact: true });
  await scale.focus();
  await scale.press("Home");
  for (let i = 0; i < 8; i++) await scale.press("ArrowRight");
  await page.getByLabel("店铺Logo水平焦点", { exact: true }).focus();
  await page.getByLabel("店铺Logo水平焦点", { exact: true }).press("End");
  const moved = await png(page, info, "logo-position.png");
  const position = await page.evaluate(async (encoded) => {
    const b = await createImageBitmap(
      new Blob([Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))], {
        type: "image/png",
      }),
    );
    const c = document.createElement("canvas");
    c.width = b.width;
    c.height = b.height;
    const x = c.getContext("2d")!;
    x.drawImage(b, 0, 0);
    b.close();
    return {
      new: [...x.getImageData(315, 250, 1, 1).data],
      old: [...x.getImageData(280, 250, 1, 1).data],
    };
  }, moved.toString("base64"));
  expect(position.new).toEqual([0, 0, 255, 255]);
  expect(position.old).toEqual([255, 255, 255, 255]);
  await logoControls
    .getByRole("button", { name: "恢复默认", exact: true })
    .click();
  const image = await png(page, info, "images.png");
  const pixels = await page.evaluate(async (encoded) => {
    const img = await createImageBitmap(
      new Blob([Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))], {
        type: "image/png",
      }),
    );
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    img.close();
    return {
      avatar: [...ctx.getImageData(90, 250, 1, 1).data],
      corner: [...ctx.getImageData(41, 201, 1, 1).data],
      logo: [...ctx.getImageData(280, 250, 1, 1).data],
      transparent: [...ctx.getImageData(225, 205, 1, 1).data],
    };
  }, image.toString("base64"));
  expect(pixels.avatar).toEqual([0, 255, 0, 255]);
  expect(pixels.corner).toEqual([255, 255, 255, 255]);
  expect(pixels.logo).toEqual([0, 0, 255, 255]);
  expect(pixels.transparent).toEqual([255, 255, 255, 255]);
  const packed = await packaged(page, info, "images.json");
  expect(packed.doc.parameters[0].imageDefaults.focusX).toBe(0);
  expect(packed.assets.length).toBeGreaterThanOrEqual(3);
  const context = await browser.newContext({
    baseURL: new URL("/", page.url()).href,
  });
  await context.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
  try {
    const fresh = await context.newPage();
    fresh.on("pageerror", (e) => errors.push(e.message));
    await fresh.goto("/works");
    await fresh
      .locator('input[type="file"]')
      .setInputFiles(info.outputPath("images.json"));
    await expect(fresh).toHaveURL(/\/editor\//);
    await fresh.getByRole("button", { name: "进入作图", exact: true }).click();
    await fresh.getByRole("button", { name: "图层编辑", exact: true }).click();
    await expect(fresh).toHaveURL(/\/editor\//);
    if (
      await fresh.getByRole("button", { name: "手机", exact: true }).isVisible()
    )
      await fresh.getByRole("button", { name: "手机", exact: true }).click();
    const restored = await png(fresh, info, "restored.png");
    expect(restored.equals(image)).toBe(true);
  } finally {
    await context.close();
  }
});

test("mobile parameter drawing closes sheets, locks ratios, saves settings and supports two-finger zoom", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await source(page);
  const manager = page.getByRole("dialog");
  await expect(manager).toBeVisible();
  await manager
    .getByRole("button", { name: "新增参数 · 框选区域", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("框选比例", { exact: true }).selectOption("1");
  const canvas = page.locator("canvas.upper-canvas"),
    b = (await canvas.boundingBox())!;
  await page.mouse.move(
    b.x + (40 * b.width) / 400,
    b.y + (200 * b.height) / 700,
  );
  await page.mouse.down();
  await page.mouse.move(
    b.x + (140 * b.width) / 400,
    b.y + (260 * b.height) / 700,
    { steps: 6 },
  );
  await page.mouse.up();
  const toolbar = page.getByLabel("框选参数工具条", { exact: true });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "头像", exact: true }).click();
  const settings = page.getByRole("dialog");
  await expect(
    settings.getByLabel("当前参数名称", { exact: true }),
  ).toBeVisible();
  await settings.getByLabel("当前参数名称", { exact: true }).fill("手机头像");
  await settings
    .getByRole("button", { name: "保存当前模板", exact: true })
    .click();
  await settings
    .getByRole("button", { name: "收起参数设置", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const data = await packaged(page, info, "mobile-template.json");
  const p = data.doc.parameters[0],
    l = data.doc.layers.find((l: any) => l.id === p.layerId);
  expect(p.name).toBe("手机头像");
  expect(l.width).toBeCloseTo(l.height);
  expect(l.radius).toBeCloseTo(l.width / 2);
  const zoomBefore = (await canvas.boundingBox())!.width;
  await canvas.evaluate((el) => {
    const r = el.getBoundingClientRect(),
      x = r.left + Math.min(r.width / 2, 120),
      y = r.top + Math.min(r.height / 2, 180);
    const touch = (id: number, dx: number) =>
      new Touch({ identifier: id, target: el, clientX: x + dx, clientY: y });
    el.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [touch(1, -30), touch(2, 30)],
        targetTouches: [touch(1, -30), touch(2, 30)],
      }),
    );
    el.dispatchEvent(
      new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
        touches: [touch(1, -60), touch(2, 60)],
        targetTouches: [touch(1, -60), touch(2, 60)],
      }),
    );
    el.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [],
        changedTouches: [touch(1, -60), touch(2, 60)],
      }),
    );
  });
  await expect
    .poll(async () => (await canvas.boundingBox())!.width)
    .toBeGreaterThan(zoomBefore * 1.5);
});

test("batch image parameters accept uploaded candidates and export their chosen order", async ({
  page,
}, info) => {
  await source(page);
  await region(page, { x: 40, y: 200, width: 100, height: 100 }, "头像");
  await page.getByLabel("当前参数名称", { exact: true }).fill("批量头像");
  await page.getByLabel("当前参数名称", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.goto("/batch");
  await page.getByLabel("作图模板", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await page.getByRole("button", { name: "按顺序使用", exact: true }).click();
  await page.getByLabel("上传批量参数图片", { exact: true }).setInputFiles([
    {
      name: "green-yellow.png",
      mimeType: "image/png",
      buffer: await picture(page, "avatar"),
    },
    {
      name: "red.png",
      mimeType: "image/png",
      buffer: await picture(page, "red"),
    },
  ]);
  await expect(
    page.getByRole("button", { name: "上移图片red.png", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "上移图片red.png", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "批量头像循环使用", exact: true })
    .uncheck();
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
  const path = info.outputPath("image-parameters.zip");
  await (await download).saveAs(path);
  const { unzipSync } = await import("fflate");
  const images = Object.entries(
    unzipSync(new Uint8Array(await readFile(path))),
  ).sort(([a], [b]) => a.localeCompare(b));
  expect(images).toHaveLength(2);
  const colors = await page.evaluate(
    async (encoded) =>
      Promise.all(
        encoded.map(async (value) => {
          const b = await createImageBitmap(
            new Blob([Uint8Array.from(atob(value), (c) => c.charCodeAt(0))], {
              type: "image/png",
            }),
          );
          const c = document.createElement("canvas");
          c.width = b.width;
          c.height = b.height;
          const x = c.getContext("2d")!;
          x.drawImage(b, 0, 0);
          b.close();
          return [...x.getImageData(70, 250, 1, 1).data];
        }),
      ),
    images.map(([, bytes]) => Buffer.from(bytes).toString("base64")),
  );
  expect(colors).toEqual([
    [255, 0, 0, 255],
    [0, 255, 0, 255],
  ]);
});
