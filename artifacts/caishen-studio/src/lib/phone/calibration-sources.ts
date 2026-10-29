import { DEVICE_LAYOUTS } from "./device-layouts";
import type { PhoneModelId } from "./models";
import type { SystemStyleId } from "./system-styles";

/** Reviewed public evidence; native photographs stay with the publisher, not in the app bundle. */
export const CALIBRATION_SOURCES: Record<
  string,
  {
    modelId: PhoneModelId;
    observedSystem: string;
    reviewUrl: string;
    imageUrl: string;
    sha256: string;
    nativeSize: readonly [number, number];
  }
> = {
  "pixel9-android14": {
    modelId: "pixel9",
    sha256: "0a5a79fde8ef1c8262c4d6ec64c190abb1b9b49e8a74af2ab14072de995926c3",
    nativeSize: [1080, 2424],
    observedSystem: "Android 14（精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Google-Pixel-9-review-The-small-Google-smartphone-has-taken-the-wrong-path.907380.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Google/Pixel_9/Screenshot_20241012-100143.png",
  },
  "iphone16-ios18.0.1": {
    modelId: "iphone16",
    sha256: "f3a1cb40ecb9d1e0c9d162a0df70148289e8ce3d87e645852aa657aa89836b85",
    nativeSize: [1179, 2556],
    observedSystem: "iOS 18.0.1（截图直接显示版本；显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Apple-iPhone-16-smartphone-review-More-innovations-than-one-would-think.908118.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Apple/iPhone_16/Screenshots_OS_1.PNG",
  },
  "galaxys24-oneui6.1": {
    modelId: "galaxys24",
    sha256: "d97a6db356bb7cfc0da69fb7a658b537a4fdf8999772a0f100ad31cdc3e6bc0e",
    nativeSize: [1080, 2340],
    observedSystem: "One UI 6.1 / Android 14（评测正文；精确构建与缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Samsung-Galaxy-S24-review-The-best-small-Android-smartphone-gets-cheaper-but-not-better.809474.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Samsung/Galaxy_S24/Screenshot_20240225_125610_Settings.jpg",
  },
};
export function calibrationFor(
  modelId: PhoneModelId,
  styleId: SystemStyleId = "auto",
) {
  const record = DEVICE_LAYOUTS[modelId],
    version = styleId === "auto" ? record.defaultStyle : styleId;
  const evidence = record.versions[version]?.evidence;
  const sources = (evidence?.sourceIds ?? [])
    .map((id) => CALIBRATION_SOURCES[id])
    .filter(Boolean);
  return {
    version,
    status: evidence?.status ?? "reference",
    scopes: evidence?.scopes ?? [],
    pending: evidence?.pending ?? [],
    sources,
  };
}
