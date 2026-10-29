import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEVICE_LAYOUTS } from "./device-layouts";
import { CALIBRATION_SOURCES, calibrationFor } from "./calibration-sources";
const json = (name: string) =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../../docs/phone-calibration", name),
      "utf8",
    ),
  );
describe("source-backed phone calibration", () => {
  it("keeps discovery separate from approval, with a complete 100-model inventory", () => {
    const inventory = json("source-inventory.json");
    expect(
      new Set(inventory.models.map((r: { modelId: string }) => r.modelId)),
    ).toEqual(new Set(Object.keys(DEVICE_LAYOUTS)));
    const nativeOwners = new Map<string, string>();
    for (const row of inventory.models)
      for (const image of row.screenshots) {
        if (image.nativeSizeMatch) {
          const owner = nativeOwners.get(image.sha256);
          expect(owner === undefined || owner === row.modelId).toBe(true);
          nativeOwners.set(image.sha256, row.modelId);
        }
        expect(image.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(image.width).toBeGreaterThan(0);
        expect(image.height).toBeGreaterThan(0);
        expect(image.nativeSizeMatch).toBe(
          image.width ===
            DEVICE_LAYOUTS[row.modelId as keyof typeof DEVICE_LAYOUTS]
              .referenceSize[0] &&
            image.height ===
              DEVICE_LAYOUTS[row.modelId as keyof typeof DEVICE_LAYOUTS]
                .referenceSize[1],
        );
      }
  });
  it("matches each reviewed sample to the correct model, version, native dimensions and image hash", () => {
    for (const row of json("native-measurements.json")) {
      const source = CALIBRATION_SOURCES[row.id];
      expect(source).toBeDefined();
      expect(source.modelId).toBe(row.modelId);
      expect(source.sha256).toBe(row.sha256);
      expect(source.nativeSize).toEqual([row.width, row.height]);
      const state = calibrationFor(row.modelId, row.styleId);
      expect(state.status).toBe("partial");
      expect(state.pending.length).toBeGreaterThan(0);
      expect(state.sources).toContain(source);
    }
    expect(calibrationFor("iphone16", "ios18").status).toBe("reference");
    expect(calibrationFor("galaxys24", "oneui7").status).toBe("reference");
    expect(calibrationFor("pixel9", "pixel15").status).toBe("reference");
  });
  it("does not label incomplete samples or family documentation as fully calibrated", () => {
    for (const record of Object.values(DEVICE_LAYOUTS))
      for (const layout of Object.values(record.versions)) {
        if (!layout?.evidence) continue;
        expect(layout.evidence.sourceIds.length).toBeGreaterThan(0);
        for (const id of layout.evidence.sourceIds)
          expect(CALIBRATION_SOURCES[id]?.modelId).toBe(record.modelId);
        if (layout.evidence.status === "calibrated") {
          expect(layout.evidence.pending).toEqual([]);
          for (const scope of ["geometry", "fonts", "icons", "state-coverage"])
            expect(layout.evidence.scopes).toContain(scope);
        } else expect(layout.evidence.pending.length).toBeGreaterThan(0);
      }
  });
  it("records actual before/after renderer measurements rather than a successful-download flag", () => {
    const before = json("rendered-before.json"),
      after = json("rendered-after.json");
    expect(after.results).toHaveLength(json("native-measurements.json").length);
    for (const row of after.results) {
      const old = before.results.find((r: { id: string }) => r.id === row.id);
      expect(Math.abs(old.clockLeftError)).toBeGreaterThan(0);
      expect(Math.abs(row.clockLeftError)).toBeLessThanOrEqual(1);
      expect(Math.abs(row.clockBottomError)).toBeLessThanOrEqual(1);
      expect(Math.abs(row.systemRightError)).toBeLessThanOrEqual(1);
      expect(Math.abs(row.systemCenterError)).toBeLessThanOrEqual(1);
      expect(row.knownGaps.length).toBeGreaterThan(0);
    }
  });
});
