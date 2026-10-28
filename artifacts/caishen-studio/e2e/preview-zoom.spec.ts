import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
});
async function drawing(page: Page) {
  await page.goto("/templates");
  await page.getByLabel("搜索模板", { exact: true }).fill("咖啡");
  await page.getByRole("button", { name: "使用模板", exact: true }).click();
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "放大查看第 1 张预览", exact: true }),
  ).toBeEnabled();
}
async function png(page: Page, path: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 PNG", exact: true }).click();
  await (await event).saveAs(path);
  return readFile(path);
}
test("preview opens at high resolution, supports zoom and pan, and leaves the exported result frozen", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await drawing(page);
  await page
    .getByRole("button", { name: "生成 1 张图片", exact: true })
    .click();
  const original = await png(page, info.outputPath("before.png"));
  const open = page.getByRole("button", {
    name: "放大查看第 1 张预览",
    exact: true,
  });
  await open.click();
  const dialog = page.getByRole("dialog", {
    name: "第 1 张放大预览",
    exact: true,
  });
  const image = dialog.getByAltText("放大预览图", { exact: true });
  await expect(image).toBeVisible();
  expect(
    await image.evaluate((img) => (img as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(600);
  await page.screenshot({ path: info.outputPath("preview-zoom.png") });
  const percent = dialog.getByLabel("预览缩放比例", { exact: true });
  await dialog.getByRole("button", { name: "原图尺寸", exact: true }).click();
  await expect(percent).toHaveText("100%");
  const viewport = dialog.getByLabel("放大预览画布", { exact: true });
  const box = (await viewport.boundingBox())!;
  const before = await viewport.evaluate((el) => el.scrollTop);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 - 70,
    box.y + box.height / 2 - 70,
    { steps: 5 },
  );
  await page.mouse.up();
  expect(await viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  await page.mouse.wheel(0, -120);
  await expect(percent).not.toHaveText("100%");
  await dialog.getByRole("button", { name: "适应窗口", exact: true }).click();
  expect(Number((await percent.textContent())!.replace("%", ""))).toBeLessThan(
    100,
  );
  await dialog.getByRole("button", { name: "放大预览图", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  expect((await png(page, info.outputPath("after.png"))).equals(original)).toBe(
    true,
  );
  await page.getByRole("button", { name: "多张作图", exact: true }).click();
  await page.getByLabel("生成张数", { exact: true }).fill("2");
  await page.getByRole("button", { name: "生成预览", exact: true }).click();
  await page.getByRole("button", { name: "放大查看第 2 张预览", exact: true }).click();
  const second = page.getByRole("dialog", { name: "第 2 张放大预览", exact: true });
  await expect(second.getByAltText("放大预览图", { exact: true })).toBeVisible();
  await second.getByRole("button", { name: "关闭放大预览", exact: true }).click();
  expect(errors).toEqual([]);
});

test("mobile preview supports pinch gestures and closing without horizontal page overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await drawing(page);
  await page
    .getByRole("button", { name: "放大查看第 1 张预览", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "第 1 张放大预览",
    exact: true,
  });
  await expect(
    dialog.getByAltText("放大预览图", { exact: true }),
  ).toBeVisible();
  const percent = dialog.getByLabel("预览缩放比例", { exact: true });
  const initial = Number((await percent.textContent())!.replace("%", ""));
  const box = (await dialog
    .getByLabel("放大预览画布", { exact: true })
    .boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const point = (id: number, x: number) => ({
    id,
    x: box.x + box.width / 2 + x,
    y: box.y + box.height / 2,
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(0, -35), point(1, 35)],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [point(0, -75), point(1, 75)],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => Number((await percent.textContent())!.replace("%", "")))
    .toBeGreaterThan(initial);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "关闭放大预览", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});
