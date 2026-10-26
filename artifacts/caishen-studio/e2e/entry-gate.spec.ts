import { test, expect } from "@playwright/test";

test("entry prompt blocks deep links and dismisses only after the exact phrase", async ({
  page,
}) => {
  await page.goto("/templates");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  const input = page.getByRole("textbox", { name: "输入确认文字" });
  await input.fill("沐北是s");
  await expect(dialog).toBeVisible();
  await input.fill("沐北是SB");
  await expect(dialog).toBeVisible();
  await input.fill("沐北是sb");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "使用模板", exact: true }).first(),
  ).toBeVisible();
});

test("entry confirmation remains usable when session storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("Storage disabled");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", { name: "输入确认文字" }).fill("沐北是sb");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
