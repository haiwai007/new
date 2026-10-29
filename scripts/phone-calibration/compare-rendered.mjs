// Run the real Vite modules and renderer against measured native reference geometry.
// Requires the local studio dev server (default http://127.0.0.1:5194).
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../artifacts/caishen-studio/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const rows = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.addInitScript(() =>
    sessionStorage.setItem("haishen.entry-confirmed.v1", "yes"),
  );
  await page.goto(
    process.env.CALIBRATION_STUDIO_URL ?? "http://127.0.0.1:5194/",
  );
  const results = await page.evaluate(async (rows) => {
    const { BUILTIN_TEMPLATES } = await import("/src/lib/template/builtin.ts");
    const { naturalPhoneSettings, applyPhoneLayers } =
      await import("/src/lib/phone/layers.ts");
    const { settingsForModel } = await import("/src/lib/phone/profiles.ts");
    const { defaultStatusLocation, locationTestKey } =
      await import("/src/lib/status-location/model.ts");
    const { renderDoc } = await import("/src/lib/canvas/render.ts");
    const { DEVICE_LAYOUTS } = await import("/src/lib/phone/device-layouts.ts");
    const { phoneModel } = await import("/src/lib/phone/models.ts");
    const output = [];
    for (const row of rows) {
      const doc = structuredClone(
        BUILTIN_TEMPLATES.find((t) => t.id === "blank_portrait").doc,
      );
      const background = row.light ? "#000000" : "#f6f6f6";
      doc.canvas = {
        width: row.width,
        height: row.height,
        backgroundColor: background,
        backgroundImage: null,
      };
      doc.layers = [];
      doc.parameters = [];
      doc.source = null;
      const location = defaultStatusLocation(doc);
      location.layout = "device";
      location.approval = "direct";
      location.state = "confirmed";
      location.bounds = {
        x: 0,
        y: 0,
        width: 1,
        height: row.stripHeight / row.height,
      };
      location.background = "solid";
      location.color = background;
      location.fills = ["time", "apps", "system"].map((role) => ({
        role,
        top: background,
        bottom: background,
      }));
      location.testKey = locationTestKey(location);
      doc.statusLocation = location;
      const p = {
        ...settingsForModel(naturalPhoneSettings(), row.modelId),
        styleId: row.styleId,
        time: row.time,
        battery: row.battery,
        charging: row.charging,
        signal: row.signal,
        wifi: 3,
        network: "none",
        appIcons: [],
        showDate: false,
        showCarrier: false,
        showHomeIndicator: false,
        customColor: row.light ? "#ffffff" : "#111111",
        scale: 100,
      };
      const rendered = applyPhoneLayers(doc, p);
      const { canvas } = await renderDoc(rendered, { multiplier: 1 });
      try {
        const data = canvas
            .getContext("2d")
            .getImageData(0, 0, row.width, row.stripHeight).data,
          clock = [],
          system = [];
        for (let y = 0; y < row.stripHeight; y++)
          for (let x = 0; x < row.width; x++) {
            const i = (y * row.width + x) * 4,
              r = data[i],
              g = data[i + 1],
              b = data[i + 2],
              neutral = Math.max(r, g, b) - Math.min(r, g, b) < 45;
            const glyph = row.light
              ? Math.min(r, g, b) > 180 && neutral
              : Math.max(r, g, b) < 170 && neutral;
            if (glyph && x < Math.floor(row.width * row.clockFraction))
              clock.push([x, y]);
            if (
              (row.systemAllColours ? Math.max(r, g, b) > 40 : glyph) &&
              x > Math.floor(row.width * 0.7)
            )
              system.push([x, y]);
          }
        function box(points) {
          if (!points.length) throw Error("No rendered glyphs for " + row.id);
          return {
            left: Math.min(...points.map((p) => p[0])),
            top: Math.min(...points.map((p) => p[1])),
            right: Math.max(...points.map((p) => p[0])) + 1,
            bottom: Math.max(...points.map((p) => p[1])) + 1,
          };
        }
        const a = box(clock),
          b = box(system),
          layout = DEVICE_LAYOUTS[row.modelId].versions[row.styleId],
          unit = row.width / phoneModel(row.modelId).points;
        output.push({
          id: row.id,
          modelId: row.modelId,
          styleId: row.styleId,
          referenceSha256: row.sha256,
          referenceClock: row.clockBox,
          referenceSystem: row.systemBox,
          generatedClock: a,
          generatedSystem: b,
          clockLeftError: a.left - row.clockBox.left,
          clockBottomError: a.bottom - row.clockBox.bottom,
          systemRightError: b.right - row.systemBox.right,
          systemCenterError:
            (b.top + b.bottom - row.systemBox.top - row.systemBox.bottom) / 2,
          suggested: {
            clockCenterY: Number(
              (
                (layout.clockCenterY ?? layout.centerY) +
                (row.clockBox.bottom - a.bottom) / row.stripHeight
              ).toFixed(8),
            ),
            systemCenterY: Number(
              (
                (layout.systemCenterY ?? layout.centerY) +
                (row.systemBox.top + row.systemBox.bottom - b.top - b.bottom) /
                  (2 * row.stripHeight)
              ).toFixed(8),
            ),
            clockX: Number(
              (layout.clockX + (row.clockBox.left - a.left) / unit).toFixed(5),
            ),
            rightInset: Number(
              (
                layout.rightInset +
                (b.right - row.systemBox.right) / unit
              ).toFixed(5),
            ),
          },
          knownGaps: [
            "font identity and full outlines",
            "OS build/display scaling",
            "other states",
            "complete vertical layout",
          ],
        });
      } finally {
        canvas.width = canvas.height = 0;
      }
    }
    return output;
  }, rows);
  await fs.writeFile(
    process.argv[3],
    JSON.stringify(
      {
        schemaVersion: 1,
        checkedAt: new Date().toISOString(),
        scope: "horizontal geometry only; not full device approval",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      results.map((r) => ({
        id: r.id,
        clockLeftError: r.clockLeftError,
        systemRightError: r.systemRightError,
        suggested: r.suggested,
      })),
    ),
  );
} finally {
  await browser.close();
}
