import { describe, expect, it } from "vitest";
import { AOSP_GLYPH_DATA } from "./aosp-glyph-data";
import { aospSignal, aospWifi } from "./aosp-glyphs";
import { naturalPhoneSettings, statusIconsSvg } from "./layers";
import { maximumWifiLevel, settingsForModel } from "./profiles";
import { phoneSettingsSchema } from "./schema";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "../../docs/phone-calibration/aosp-glyph-sources.json",
    ),
    "utf8",
  ),
);
describe("source-backed stock Android glyphs", () => {
  it("preserves pinned resource hashes and every signal/Wi-Fi level separately for both releases", () => {
    expect(manifest.rows).toHaveLength(24);
    for (const row of manifest.rows) {
      const xml = readFileSync(
        resolve(
          process.cwd(),
          `../../docs/phone-calibration/upstream/aosp${row.androidVersion}-${row.file}`,
        ),
      );
      expect(createHash("sha256").update(xml).digest("hex")).toBe(row.sha256);
    }
    for (const version of [14, 15] as const)
      for (let level = 0; level <= 4; level++) {
        expect(AOSP_GLYPH_DATA[version].signal[level].length).toBeGreaterThan(
          0,
        );
        expect(AOSP_GLYPH_DATA[version].wifi[level].length).toBeGreaterThan(0);
      }
    expect(AOSP_GLYPH_DATA[15].signal[1].some((p) => p.clipD)).toBe(true);
    expect(AOSP_GLYPH_DATA[14].signal[1].some((p) => p.clipD)).toBe(false);
  });
  it("offers all four enabled stock Wi-Fi states and clamps them when switching to another system", () => {
    const pixel = settingsForModel(naturalPhoneSettings(), "pixel9");
    expect(maximumWifiLevel(pixel)).toBe(4);
    const states = new Set(
      [1, 2, 3, 4].map((level) => aospWifi(level, 14).svg("#111111")),
    );
    expect(states.size).toBe(4);
    expect(settingsForModel({ ...pixel, wifi: 4 }, "galaxys25").wifi).toBe(3);
    expect(maximumWifiLevel(settingsForModel(pixel, "galaxys25"))).toBe(3);
    expect(aospSignal(1, 15).svg("#fff")).not.toBe(
      aospSignal(4, 15).svg("#fff"),
    );
  });
  it("distinguishes hidden cellular service from zero bars, while retaining airplane mode", () => {
    const pixel = {
      ...settingsForModel(naturalPhoneSettings(), "pixel9"),
      signal: 0,
      wifi: 4,
      hd: true,
      dualSim: true,
    };
    expect(statusIconsSvg(pixel)).toContain('data-aosp-signal="14-0"');
    const hidden = statusIconsSvg({ ...pixel, showCellular: false });
    expect(hidden).not.toContain("data-aosp-signal");
    expect(hidden).not.toContain(">HD<");
    expect(hidden).toContain('data-aosp-wifi="14-4"');
    expect(
      statusIconsSvg({ ...pixel, showCellular: false, airplane: true }),
    ).toContain('data-airplane="aosp14"');
  });
  it("keeps old documents valid and records optional percentage spacing without changing inside numbers", () => {
    const old = { ...naturalPhoneSettings() } as Record<string, unknown>;
    delete old.showCellular;
    delete old.spaceBeforePercent;
    const parsed = phoneSettingsSchema.parse(old);
    expect(parsed.showCellular).toBe(true);
    expect(parsed.spaceBeforePercent).toBe(false);
    const pixel = settingsForModel(parsed, "pixel9");
    const compact = statusIconsSvg({
      ...pixel,
      showBatteryPercent: true,
      spaceBeforePercent: false,
    });
    const spaced = statusIconsSvg({
      ...pixel,
      showBatteryPercent: true,
      spaceBeforePercent: true,
    });
    expect(spaced).not.toBe(compact);
    expect(spaced).toContain('data-numeric-font="roboto-400"');
  });
});
