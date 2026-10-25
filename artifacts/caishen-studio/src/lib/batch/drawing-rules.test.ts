import { describe, expect, it } from "vitest";
import { generateItems } from "./rules";
import {
  appIconCapacity,
  drawingRules,
  validatePhoneBatchRules,
} from "./phone-rules";
import { defaultPhoneSettings, removePhoneLayers } from "../phone/layers";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { newId } from "../template/ids";
import type { PhoneAppIcon } from "../phone/schema";
const template = () => structuredClone(BUILTIN_TEMPLATES[0].doc);
const icon = (
  builtinId: "wechat" | "qq" | "douyin" | "kuaishou",
): PhoneAppIcon => ({
  id: newId("app"),
  name: builtinId,
  kind: "builtin",
  builtinId,
  visible: true,
});
function rules() {
  const r = drawingRules(defaultPhoneSettings());
  r.enabled = true;
  r.models = {
    enabled: true,
    ids: ["iphone16", "pixel9", "galaxys24ultra"],
    distribution: "balanced",
  };
  r.apps = {
    mode: "random",
    fixed: [icon("wechat")],
    candidates: [icon("qq"), icon("douyin"), icon("kuaishou")],
    min: 0,
    max: 2,
    order: "list",
  };
  return r;
}
describe("independent drawing and batch phone effects", () => {
  it("adds a status bar to an ordinary template without changing content or canvas", () => {
    const source = template(),
      before = structuredClone(source);
    const result = generateItems(source, {}, 1, 77, rules())[0];
    expect(result.errors).toEqual([]);
    expect(result.doc.phone).toBeDefined();
    expect(result.doc.canvas).toEqual(source.canvas);
    expect(removePhoneLayers(result.doc).layers).toEqual(source.layers);
    expect(source).toEqual(before);
  });
  it("balances counts to a difference of at most one, including more models than images", () => {
    for (const total of [1, 2, 8, 200]) {
      const r = rules(),
        items = generateItems(template(), {}, total, 987, r);
      const counts = r.models!.ids.map(
        (id) => items.filter((i) => i.doc.phone?.modelId === id).length,
      );
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(items.every((i) => !i.errors.length)).toBe(true);
    }
  });
  it("only uses specified models and uses their actual system profiles", () => {
    const items = generateItems(template(), {}, 40, 99, rules());
    for (const item of items) {
      expect(rules().models!.ids).toContain(item.doc.phone!.modelId);
      expect(item.doc.phone!.timeWeight).toBe(
        item.doc.phone!.modelId === "iphone16" ? "bold" : "normal",
      );
      expect(item.doc.layers.some((l) => l.id.endsWith("_icons"))).toBe(true);
    }
  });
  it("keeps fixed icons, samples unique candidates within the interval and is deterministic", () => {
    const r = rules(),
      source = template();
    const a = generateItems(source, {}, 40, 13, r),
      b = generateItems(source, {}, 40, 13, r);
    expect(a).toEqual(b);
    const amounts = new Set<number>();
    for (const item of a) {
      const icons = item.doc.phone!.appIcons;
      expect(icons[0]).toMatchObject({ builtinId: "wechat", visible: true });
      expect(icons.length).toBeGreaterThanOrEqual(1);
      expect(icons.length).toBeLessThanOrEqual(3);
      expect(new Set(icons.map((i) => i.id)).size).toBe(icons.length);
      expect(
        icons.every(
          (i) =>
            i.kind === "builtin" &&
            ["wechat", "qq", "douyin", "kuaishou"].includes(i.builtinId),
        ),
      ).toBe(true);
      amounts.add(icons.length);
    }
    expect(amounts.size).toBe(3);
  });
  it("changing APP choices never changes model allocation, time, battery or content", () => {
    const r = rules(),
      a = generateItems(template(), {}, 20, 44, r);
    r.apps!.candidates = [...r.apps!.candidates].reverse();
    r.apps!.max = 1;
    const b = generateItems(template(), {}, 20, 44, r);
    expect(
      b.map((i) => [
        i.doc.phone!.modelId,
        i.doc.phone!.time,
        i.doc.phone!.battery,
      ]),
    ).toEqual(
      a.map((i) => [
        i.doc.phone!.modelId,
        i.doc.phone!.time,
        i.doc.phone!.battery,
      ]),
    );
    expect(b.map((i) => removePhoneLayers(i.doc).layers)).toEqual(
      a.map((i) => removePhoneLayers(i.doc).layers),
    );
  });
  it("rejects empty models, duplicate APP selections, invalid intervals and capacity overflow", () => {
    const r = rules();
    r.models!.ids = [];
    expect(validatePhoneBatchRules(r).join()).toMatch(/手机型号/);
    r.models!.ids = ["iphone16"];
    r.apps!.min = 3;
    r.apps!.max = 1;
    expect(validatePhoneBatchRules(r).join()).toMatch(/区间/);
    r.apps!.min = 0;
    r.apps!.max = 2;
    r.apps!.candidates.push(r.apps!.fixed[0]);
    expect(validatePhoneBatchRules(r).join()).toMatch(/重复/);
    r.apps!.candidates.pop();
    r.apps!.max = 3;
    r.setup!.settings.appIconSize = 20;
    expect(validatePhoneBatchRules(r).join()).toMatch(/容纳/);
    expect(
      generateItems(template(), {}, 2, 1, r).every((i) => i.errors.length > 0),
    ).toBe(true);
  });
  it("permits zero random icons and can hide all APP icons", () => {
    const r = rules();
    r.apps!.fixed = [];
    r.apps!.min = r.apps!.max = 0;
    expect(
      generateItems(template(), {}, 3, 1, r).every(
        (i) => i.doc.phone!.appIcons.length === 0,
      ),
    ).toBe(true);
    r.apps!.mode = "none";
    expect(
      generateItems(template(), {}, 3, 1, r).every(
        (i) => i.doc.phone!.appIcons.length === 0,
      ),
    ).toBe(true);
  });
  it("retains uploaded candidates and never mutates their source", () => {
    const r = rules();
    r.apps!.fixed = [];
    r.apps!.min = r.apps!.max = 1;
    r.apps!.candidates = [
      {
        id: newId("app"),
        name: "自定义",
        kind: "custom",
        visible: true,
        src: { kind: "asset", assetId: "custom-png" },
      },
    ];
    const before = structuredClone(r);
    expect(
      generateItems(template(), {}, 2, 4, r)[0].doc.phone!.appIcons[0],
    ).toMatchObject({ src: { assetId: "custom-png" } });
    expect(r).toEqual(before);
  });
  it("keeps original phone content when preserve mode is selected", () => {
    const r = rules();
    r.setup!.mode = "keep";
    expect(generateItems(template(), {}, 2, 4, r)[0].doc.phone).toBeUndefined();
    expect(
      validatePhoneBatchRules({ ...r, models: { ...r.models!, ids: [] } }),
    ).toEqual([]);
  });
  it("reports oversized prepend as a batch validation error rather than crashing", () => {
    const source = template();
    source.canvas.height = 8000;
    const r = rules();
    r.setup!.mode = "prepend";
    expect(generateItems(source, {}, 1, 4, r)[0].errors.join()).toMatch(/8000/);
  });
  it("capacity responds to requested icon size, gap and selected model", () => {
    const phone = defaultPhoneSettings();
    expect(appIconCapacity({ ...phone, appIconSize: 8 })).toBeGreaterThan(
      appIconCapacity({ ...phone, appIconSize: 20 }),
    );
    expect(appIconCapacity(phone)).toBeGreaterThan(0);
  });
});
