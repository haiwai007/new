import { expect, it } from "vitest";
import { NUMERIC_FONT_DATA } from "./numeric-font-data";
import {
  numericAdvance,
  numericSvg,
  clockFontForSettings,
} from "./numeric-font";
import { naturalPhoneSettings } from "./layers";
import { settingsForModel } from "./profiles";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
it("ships complete licensed numeric contours with no runtime font request", () => {
  for (const id of Object.keys(
    NUMERIC_FONT_DATA,
  ) as (keyof typeof NUMERIC_FONT_DATA)[]) {
    for (const text of [
      "0123456789",
      "00:00",
      "23:59",
      "12:05 AM",
      "100\u00a0%",
    ]) {
      expect(numericAdvance(id, text)).toBeGreaterThan(0);
      const svg = numericSvg(id, text, 14, 20, 150, "#123456");
      expect(svg).toContain("<path");
      expect(svg).not.toContain("<text");
      expect(svg).not.toContain("@font-face");
      expect(svg).not.toContain("NaN");
    }
  }
  const sources = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../../docs/phone-calibration/font-sources.json"),
      "utf8",
    ),
  );
  const gs = sources.rows.find((r: { id: string }) => r.id === "google-sans");
  const licence = readFileSync(
    resolve(process.cwd(), "public/attributions/google-sans-glyphs-OFL.txt"),
  );
  expect(createHash("sha256").update(licence).digest("hex")).toBe(
    gs.licenseSha256,
  );
});
it("uses the observed device font without inheriting it across unverified variants or legacy mode", () => {
  const base = settingsForModel(naturalPhoneSettings(), "pixel9");
  expect(clockFontForSettings(base)).toBe("google-sans-17-500");
  expect(clockFontForSettings({ ...base, styleId: "pixel15" })).toBeUndefined();
  expect(
    clockFontForSettings({ ...base, rendering: "legacy" }),
  ).toBeUndefined();
  expect(clockFontForSettings(settingsForModel(base, "pixel8a"))).toBe(
    "google-sans-18-500",
  );
  expect(() =>
    numericSvg("roboto-400", "非法", 14, 20, 150, "#111111"),
  ).toThrow();
});
