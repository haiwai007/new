// Pin open-source Android resources; retain original Apache-2.0 headers.
import fs from "node:fs/promises";
import crypto from "node:crypto";
const cache = "/tmp/phone-aosp-glyphs";
await fs.mkdir(cache, { recursive: true });
const names = [
  ...Array.from({ length: 5 }, (_, i) => `ic_wifi_signal_${i}.xml`),
  ...Array.from({ length: 5 }, (_, i) => `ic_signal_cellular_${i}_4_bar.xml`),
  "ic_qs_airplane.xml",
  "ic_signal_cellular.xml",
];
const rows = [],
  variants = {};
for (const version of [14, 15]) {
  const files = {};
  for (const name of names) {
    const url = `https://android.googlesource.com/platform/frameworks/base/+/android-${version}.0.0_r1/core/res/res/drawable/${name}?format=TEXT`;
    const file = `${cache}/aosp${version}-${name}`;
    let body;
    try {
      body = await fs.readFile(file, "utf8");
    } catch {
      const r = await fetch(url, {
        credentials: "omit",
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw Error(`${r.status}: ${name}`);
      body = Buffer.from(await r.text(), "base64").toString("utf8");
      await fs.writeFile(file, body);
      await new Promise((r) => setTimeout(r, 250));
    }
    const readPaths = (fragment, clipD) =>
      [...fragment.matchAll(/<path\b([\s\S]*?)\/>/g)].map((m) => ({
        d: m[1].match(/android:pathData="([^"]+)"/)?.[1].replace(/\s+/g, " "),
        fillRule: m[1].match(/android:fillType="([^"]+)"/)?.[1] ?? "nonZero",
        ...(clipD ? { clipD } : {}),
      }));
    const clipped = [];
    const base = body.replace(
      /<clip-path\b([^>]*)>([\s\S]*?)<\/clip-path>/g,
      (_, attrs, inner) => {
        const d = attrs.match(/android:pathData="([^"]+)"/)?.[1];
        if (!d) throw Error("Missing clip geometry");
        clipped.push(...readPaths(inner, d));
        return "";
      },
    );
    const paths = [...readPaths(base), ...clipped];
    if (
      name !== "ic_signal_cellular.xml" &&
      (!paths.length ||
        paths.some((p) => !p.d) ||
        /<group|<clip-path/.test(base))
    )
      throw Error(
        "Review unsupported vector structure: " + version + "/" + name,
      );
    files[name] = paths;
    rows.push({
      androidVersion: version,
      file: name,
      url,
      sha256: crypto.createHash("sha256").update(body).digest("hex"),
      paths,
    });
    await fs.writeFile(
      `docs/phone-calibration/upstream/aosp${version}-${name}`,
      body,
    );
  }
  variants[version] = files;
}
const changedFiles = names.filter(
  (name) =>
    JSON.stringify(variants[14][name]) !== JSON.stringify(variants[15][name]),
);
const data = Object.fromEntries(
  [14, 15].map((version) => [
    version,
    {
      wifi: Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          i,
          variants[version][`ic_wifi_signal_${i}.xml`],
        ]),
      ),
      signal: Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          i,
          variants[version][`ic_signal_cellular_${i}_4_bar.xml`],
        ]),
      ),
      airplane: variants[version]["ic_qs_airplane.xml"],
    },
  ]),
);
const batterySources = [];
for (const version of [14, 15]) {
  const url = `https://android.googlesource.com/platform/frameworks/base/+/android-${version}.0.0_r1/core/res/res/values/config.xml?format=TEXT`;
  const file = `${cache}/aosp${version}-battery-config.xml`;
  let body;
  try {
    body = await fs.readFile(file, "utf8");
  } catch {
    const r = await fetch(url, {
      credentials: "omit",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error("Battery config unavailable");
    body = Buffer.from(await r.text(), "base64").toString();
    await fs.writeFile(file, body);
  }
  const values = Object.fromEntries(
    [
      ...body.matchAll(
        /<string[^>]*name="(config_batterymeter[^"]*)"[^>]*>([\s\S]*?)<\/string>/g,
      ),
    ].map((m) => [m[1], m[2].replace(/\s+/g, " ").trim()]),
  );
  const battery = {
    perimeter: values.config_batterymeterPerimeterPath,
    fillMask: values.config_batterymeterFillMask,
    bolt: values.config_batterymeterBoltPath,
    plus: values.config_batterymeterPowersavePath,
  };
  if (
    Object.values(battery).some((v) => !v) ||
    battery.fillMask !== "M2,18 v-14 h8 v14 z"
  )
    throw Error("Review changed battery geometry: " + version);
  data[version].battery = battery;
  batterySources.push({
    androidVersion: version,
    url,
    sha256: crypto.createHash("sha256").update(body).digest("hex"),
    paths: battery,
  });
}
await fs.writeFile(
  "artifacts/caishen-studio/src/lib/phone/aosp-glyph-data.ts",
  `// Generated from pinned AOSP XML. Copyright The Android Open Source Project. Apache-2.0.\n// See docs/phone-calibration/aosp-glyph-sources.json and public/attributions/statusbar-system-icons.txt.\nexport type AospPath = { d: string; fillRule: string; clipD?: string };\nexport const AOSP_GLYPH_DATA: Record<14 | 15, { wifi: Record<number, AospPath[]>; signal: Record<number, AospPath[]>; airplane: AospPath[]; battery: { perimeter: string; fillMask: string; bolt: string; plus: string } }> = ${JSON.stringify(data, null, 2)};\n`,
);
await fs.writeFile(
  "docs/phone-calibration/aosp-glyph-sources.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      scope:
        "Pinned AOSP core vector paths; Android 14/15 resources stored separately, including clip paths. Not OEM calibration approval.",
      changedFiles,
      batterySources,
      rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ resources: rows.length, versions: [14, 15], changedFiles }),
);
