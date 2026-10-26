import { expect, it, vi } from "vitest";
import { prepareFusionItems } from "./fusion";
import {
  applyPhoneLayers,
  naturalPhoneSettings,
  removePhoneLayers,
} from "../phone/layers";
import { BUILTIN_TEMPLATES } from "../template/builtin";
vi.mock("../phone/fusion", () => ({
  fitPhoneToImage: vi
    .fn()
    .mockRejectedValue(new Error("顶部没有安全状态栏区域")),
}));
it("restores original content in failed batch previews instead of retaining a destructive draft overlay", async () => {
  const source = structuredClone(BUILTIN_TEMPLATES[0].doc);
  const doc = applyPhoneLayers(source, naturalPhoneSettings());
  const result = await prepareFusionItems([{ index: 0, doc, errors: [] }]);
  expect(result[0].doc).toEqual(removePhoneLayers(doc));
  expect(result[0].errors).toEqual(["顶部没有安全状态栏区域"]);
  expect(result[0].doc.phone).toBeUndefined();
  expect(doc.phone).toBeDefined();
});
