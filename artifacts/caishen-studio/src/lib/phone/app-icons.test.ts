import { describe, expect, it } from "vitest";
import {
  APP_ICONS,
  matchesAppIconRegion,
  MAX_APP_ICONS,
  builtinAppIconSource,
} from "./app-icon-catalog";
import {
  defaultPhoneSettings,
  applyPhoneLayers,
  removePhoneLayers,
} from "./layers";
import { phoneSettingsSchema, type PhoneAppIcon } from "./schema";
import { PHONE_MODELS } from "./models";
import { BUILTIN_TEMPLATES } from "../template/builtin";
import { phoneScreenContent } from "./export";
import { generateItems } from "../batch/rules";
import { defaultPhoneBatchRules } from "../batch/phone-rules";
import { resizeDoc } from "../template/smart-resize";
import { mapImageSources, remapAssetIds } from "../template/package";
import { referencedAssetIds } from "../template/doc-ops";
const builtins = (): PhoneAppIcon[] =>
  APP_ICONS.slice(0, MAX_APP_ICONS).map((icon, i) => ({
    id: `app_aaaaaaaaa${i}`,
    kind: "builtin",
    name: icon.name,
    builtinId: icon.id,
    visible: true,
  }));
const template = () => structuredClone(BUILTIN_TEMPLATES[0].doc);
describe("status-bar app icon documents", () => {
  it("loads older templates without adding icons and rejects duplicate IDs or excessive icon counts", () => {
    const legacy = { ...defaultPhoneSettings() } as Record<string, unknown>;
    delete legacy.appIcons;
    delete legacy.appIconSize;
    delete legacy.appIconGap;
    expect(phoneSettingsSchema.parse(legacy).appIcons).toEqual([]);
    expect(
      phoneSettingsSchema.safeParse({
        ...legacy,
        appIcons: [...builtins(), builtins()[0]],
      }).success,
    ).toBe(false);
    expect(
      phoneSettingsSchema.safeParse({
        ...legacy,
        appIcons: [builtins()[0], builtins()[0]],
      }).success,
    ).toBe(false);
  });
  it("fits eight icons beside the clock across brands, canvas proportions and large scaling", () => {
    for (const model of PHONE_MODELS)
      for (const [width, height] of [
        [360, 800],
        [800, 360],
        [16, 16],
      ]) {
        const source = template();
        source.canvas = { ...source.canvas, width, height };
        const result = applyPhoneLayers(source, {
          ...defaultPhoneSettings(),
          modelId: model.id,
          appIcons: builtins(),
          appIconSize: 20,
          appIconGap: 8,
          scale: 150,
          timeFormat: "12h",
          showCarrier: true,
        });
        const time = result.layers.find(
          (l) => l.id === `${result.phone!.groupId}_time`,
        )!;
        const icons = result.layers.filter((l) => l.id.includes("_app_"));
        expect(icons).toHaveLength(8);
        let previousRight = time.x + time.width;
        for (const icon of icons) {
          expect(icon.x).toBeGreaterThanOrEqual(previousRight);
          expect(icon.x + icon.width).toBeLessThan(width / 2);
          expect(icon.y).toBeGreaterThanOrEqual(0);
          expect(icon.y + icon.height).toBeLessThanOrEqual(height);
          previousRight = icon.x + icon.width;
        }
        expect(result.canvas).toEqual(source.canvas);
      }
  });
  it("keeps order/visibility through resize, model refresh, screen-only export and batch randomization", () => {
    const appIcons = builtins().slice(0, 3);
    appIcons[1].visible = false;
    const doc = applyPhoneLayers(template(), {
      ...defaultPhoneSettings(),
      appIcons,
    });
    const again = applyPhoneLayers(doc, {
      ...doc.phone!,
      appIcons: [...appIcons].reverse(),
    });
    expect(
      again.layers.filter((l) => l.id.includes("_app_")).map((l) => l.name),
    ).toEqual(["手机 · APP · 微信", "手机 · APP · 抖音", "手机 · APP · 快手"]);
    const resized = resizeDoc(again, 750, 1600, "smart");
    expect(resized.phone!.appIcons).toEqual([...appIcons].reverse());
    expect(
      resized.layers.find((l) => l.id.endsWith(appIcons[1].id))!.visible,
    ).toBe(false);
    const batch = generateItems(again, {}, 2, 1, {
      ...defaultPhoneBatchRules(),
      enabled: true,
    });
    for (const item of batch)
      expect(item.doc.phone!.appIcons).toEqual(again.phone!.appIcons);
    expect(
      phoneScreenContent(again).layers.filter((l) => l.id.includes("_app_")),
    ).toHaveLength(3);
    expect(removePhoneLayers(again).layers).toEqual(template().layers);
    expect(
      applyPhoneLayers(again, { ...again.phone!, appIcons: [] }).layers.filter(
        (l) => l.id.includes("_app_"),
      ),
    ).toHaveLength(0);
  });
  it("tracks and remaps custom icon metadata even when the generated layer is hidden or removed", () => {
    const icon: PhoneAppIcon = {
      id: "app_aaaaaaaaaa",
      name: "自定义",
      kind: "custom",
      src: { kind: "asset", assetId: "old-asset" },
      visible: false,
    };
    const doc = applyPhoneLayers(template(), {
      ...defaultPhoneSettings(),
      appIcons: [icon],
    });
    doc.layers = doc.layers.filter((l) => !l.id.includes("_app_"));
    expect(referencedAssetIds(doc)).toContain("old-asset");
    const remapped = remapAssetIds(doc, new Map([["old-asset", "new-asset"]]));
    expect(remapped.phone!.appIcons[0]).toMatchObject({
      src: { kind: "asset", assetId: "new-asset" },
    });
    const mapped = mapImageSources(doc, (source) =>
      source.kind === "asset" ? { kind: "asset", assetId: "replaced" } : source,
    );
    expect(mapped.phone!.appIcons[0]).toMatchObject({
      src: { kind: "asset", assetId: "replaced" },
    });
  });
  it("renders offline brand colours independently of status-bar text colour", () => {
    for (const icon of APP_ICONS) {
      const url = builtinAppIconSource(icon.id).url;
      expect(url.startsWith("data:image/svg+xml")).toBe(true);
      const svg = decodeURIComponent(url);
      expect(svg).toContain("<svg");
      expect(svg).not.toMatch(/<script|onload=|https?:\/\/(?!www.w3.org)/);
    }
    expect(decodeURIComponent(builtinAppIconSource("wechat").url)).toContain(
      'fill="#07C160"',
    );
    expect(decodeURIComponent(builtinAppIconSource("douyin").url)).toContain(
      'fill="#25F4EE"',
    );
    const icons = builtins();
    const light = applyPhoneLayers(template(), {
      ...defaultPhoneSettings(),
      theme: "dark",
      appIcons: icons,
    });
    const dark = applyPhoneLayers(template(), {
      ...defaultPhoneSettings(),
      theme: "light",
      appIcons: icons,
    });
    expect(
      light.layers
        .filter((l) => l.id.includes("_app_"))
        .map((l) => l.type === "image" && l.src),
    ).toEqual(
      dark.layers
        .filter((l) => l.id.includes("_app_"))
        .map((l) => l.type === "image" && l.src),
    );
  });
});

it("can randomize a legacy IndexedDB work before its missing APP defaults have been migrated", () => {
  const doc = applyPhoneLayers(template(), defaultPhoneSettings());
  const legacy = doc.phone as unknown as Record<string, unknown>;
  delete legacy.appIcons;
  delete legacy.appIconSize;
  delete legacy.appIconGap;
  const items = generateItems(doc, {}, 2, 1, {
    ...defaultPhoneBatchRules(),
    enabled: true,
    time: { enabled: true, start: "01:00", end: "01:00" },
  });
  expect(
    items.every(
      (item) =>
        item.errors.length === 0 && item.doc.phone!.appIcons.length === 0,
    ),
  ).toBe(true);
});

it("keeps existing IDs and persists the expanded colour library in portable templates", async () => {
  const { buildPackage, parseTemplateFile } =
    await import("../template/package");
  expect(APP_ICONS).toHaveLength(90);
  expect(APP_ICONS.slice(0, 8).map((icon) => icon.id)).toEqual([
    "kuaishou",
    "douyin",
    "wechat",
    "qq",
    "bilibili",
    "weibo",
    "alipay",
    "telegram",
  ]);
  expect(new Set(APP_ICONS.map((icon) => icon.id)).size).toBe(90);
  expect(new Set(APP_ICONS.map((icon) => icon.name)).size).toBe(90);
  const added = APP_ICONS.slice(8);
  expect(added).toHaveLength(82);
  for (let index = 0; index < added.length; index += MAX_APP_ICONS) {
    const icons = added.slice(index, index + MAX_APP_ICONS).map((icon, i) => ({
      id: `app_${i.toString(36).padStart(10, "a")}`,
      kind: "builtin" as const,
      builtinId: icon.id,
      name: icon.name,
      visible: true,
    }));
    const doc = applyPhoneLayers(template(), {
      ...defaultPhoneSettings(),
      appIcons: icons,
    });
    const imported = parseTemplateFile(buildPackage(doc, []));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.error);
    expect(imported.doc.phone!.appIcons).toEqual(icons);
    expect(
      imported.doc.layers.filter((layer) => layer.id.includes("_app_")),
    ).toHaveLength(icons.length);
  }
});

it("classifies every builtin once and keeps custom uploads separate", () => {
  expect(APP_ICONS.filter((i) => i.region === "domestic")).toHaveLength(48);
  expect(APP_ICONS.filter((i) => i.region === "international")).toHaveLength(
    42,
  );
  expect(matchesAppIconRegion("domestic", "doubao")).toBe(true);
  expect(matchesAppIconRegion("international", "whatsapp")).toBe(true);
  expect(matchesAppIconRegion("domestic", undefined)).toBe(false);
  expect(matchesAppIconRegion("custom", undefined)).toBe(true);
  expect(matchesAppIconRegion("custom", "wechat")).toBe(false);
});
