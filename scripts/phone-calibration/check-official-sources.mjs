import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const sources = [
  [
    "apple-status-icons",
    "Apple",
    "official-guidance",
    "https://support.apple.com/guide/iphone/learn-the-meaning-of-the-status-icons-iphef7bb57dc/ios",
  ],
  [
    "samsung-status-icons",
    "Samsung",
    "official-guidance",
    "https://www.samsung.com/uk/support/mobile-devices/what-do-the-different-indicator-icons-mean-on-your-galaxy-phone/",
  ],
  [
    "google-hardware",
    "Google",
    "hardware-guidance",
    "https://support.google.com/pixelphone/answer/7157629?hl=en",
  ],
  [
    "android-system-bars",
    "AOSP / Google",
    "system-guidance",
    "https://developer.android.com/design/ui/mobile/guides/foundations/system-bars",
  ],
  [
    "pixel-factory-builds",
    "Google",
    "build-list",
    "https://developers.google.com/android/images?hl=en",
  ],
  [
    "xiaomi-guides",
    "小米 / Redmi",
    "guide-portal",
    "https://www.mi.com/global/support/user-guide/",
  ],
  [
    "huawei-guides",
    "华为",
    "guide-portal",
    "https://consumer.huawei.com/en/support/phones/",
  ],
  [
    "honor-guides",
    "荣耀",
    "guide-portal",
    "https://www.honor.com/global/support/",
  ],
  [
    "oppo-guides",
    "OPPO",
    "guide-portal",
    "https://support.oppo.com/en/user-guide/",
  ],
  [
    "oneplus-guides",
    "一加",
    "guide-portal",
    "https://service.oneplus.com/global/user-manual",
  ],
  [
    "vivo-guides",
    "vivo / iQOO",
    "guide-portal",
    "https://www.vivo.com.cn/service/instructions",
  ],
  [
    "realme-guides",
    "realme",
    "guide-portal",
    "https://www.realme.com/global/support",
  ],
  [
    "aosp14-dimens",
    "AOSP",
    "system-resource",
    "https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-14.0.0_r1/packages/SystemUI/res/values/dimens.xml?format=TEXT",
  ],
  [
    "aosp16-dimens",
    "AOSP",
    "system-resource",
    "https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-16.0.0_r1/packages/SystemUI/res/values/dimens.xml?format=TEXT",
  ],
  [
    "aosp16-airplane",
    "AOSP",
    "system-resource",
    "https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-16.0.0_r1/packages/SettingsLib/res/drawable/stat_sys_airplane_mode.xml?format=TEXT",
  ],
  [
    "aosp16-wifi3",
    "AOSP",
    "system-resource",
    "https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-16.0.0_r1/packages/SettingsLib/res/drawable/ic_wifi_3.xml?format=TEXT",
  ],
  [
    "aosp14-font-map",
    "AOSP",
    "system-resource",
    "https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-14.0.0_r1/data/fonts/fonts.xml?format=TEXT",
  ],
];
const directory = "docs/phone-calibration/upstream";
await fs.mkdir(directory, { recursive: true });
const results = [];
for (let start = 0; start < sources.length; start += 3) {
  for (const result of await Promise.all(
    sources.slice(start, start + 3).map(async ([id, brand, kind, url]) => {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(20000),
          credentials: "omit",
        });
        const data = Buffer.from(await response.arrayBuffer());
        const text = data.toString("utf8");
        const blocked = /captcha|challenge-form|turnstile check/i.test(
          text.slice(0, 12000),
        );
        const decoded =
          kind === "system-resource" && response.ok
            ? Buffer.from(text, "base64")
            : data;
        const validResource =
          (kind === "system-resource" &&
            decoded.toString("utf8").includes("<?xml")) ||
          (kind === "system-resource" &&
            decoded.toString("utf8").includes("<vector"));
        if (response.ok && validResource)
          await fs.writeFile(path.join(directory, id + ".xml"), decoded);
        return {
          id,
          brand,
          kind,
          requestedUrl: url,
          url: response.url,
          httpStatus: response.status,
          checkedAt: new Date().toISOString(),
          sha256: crypto.createHash("sha256").update(decoded).digest("hex"),
          title:
            text
              .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
              ?.replace(/\s+/g, " ")
              .trim() ?? null,
          status:
            !response.ok || blocked
              ? "unavailable"
              : kind === "guide-portal"
                ? "portal-only"
                : kind === "system-resource"
                  ? validResource
                    ? "resource-retrieved"
                    : "invalid-resource"
                  : "page-retrieved",
          calibrationScope:
            "Not proof of device-specific layout; source discovery only",
        };
      } catch (error) {
        return {
          id,
          brand,
          kind,
          url,
          httpStatus: 0,
          checkedAt: new Date().toISOString(),
          status: "unavailable",
          error: String(error),
        };
      }
    }),
  ))
    results.push(result);
}
await fs.writeFile(
  "docs/phone-calibration/official-sources.json",
  JSON.stringify(
    { schemaVersion: 1, checkedAt: new Date().toISOString(), sources: results },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    results.map((s) => ({
      id: s.id,
      status: s.status,
      httpStatus: s.httpStatus,
    })),
  ),
);
