// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/template/start.ts", () => ({
  safeThumb: vi.fn(async () => null),
}));
import { createUploadTemplate } from "./create-upload-template";
import { defaultPhoneSettings } from "@/lib/phone/layers";
import { settingsForModel } from "@/lib/phone/profiles";
import { getWork } from "@/lib/storage/works";
import { getDb } from "@/lib/storage/db";
beforeEach(async () => {
  const db = await getDb();
  for (const name of ["works", "versions", "assets"] as const)
    await db.clear(name);
});
it("persists the selected Android system without changing source image dimensions", async () => {
  const blob = new Blob(["image"], { type: "image/png" });
  const { workId } = await createUploadTemplate({
    image: {
      blob,
      name: "screen.png",
      mime: blob.type,
      size: blob.size,
      width: 1179,
      height: 2556,
      previewUrl: "blob:test",
    },
    size: { width: 393, height: 852 },
    mode: "background",
    name: "手机模板",
    phone: settingsForModel(defaultPhoneSettings(), "galaxys24"),
  });
  const work = (await getWork(workId))!;
  expect(work.doc.canvas).toMatchObject({ width: 393, height: 852 });
  expect(work.doc.phone).toMatchObject({
    modelId: "galaxys24",
    batteryStyle: "outline",
    timeWeight: "normal",
  });
  expect(
    work.doc.layers.filter((l) => l.groupId === work.doc.phone!.groupId),
  ).toHaveLength(7);
  expect(work.doc.source).toMatchObject({
    originalWidth: 1179,
    originalHeight: 2556,
  });
});
