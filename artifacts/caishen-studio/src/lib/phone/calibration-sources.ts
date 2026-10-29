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

  "pixel8a-pixel14": {
    modelId: "pixel8a",
    observedSystem: "Android 14（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Google-Pixel-8a-review-The-small-Google-smartphone-is-unique-within-the-mid-range-segment.853973.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Google/Pixel_8a/Screenshot_20240622-172238.png",
    sha256: "d47c577646a4e92195dcb9db85ace66a1f9408b52c60c54b1c93b74055afbf3b",
    nativeSize: [1080, 2400],
  },
  "pixel9a-pixel15": {
    modelId: "pixel9a",
    observedSystem: "Android 15（评测正文；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Great-battery-life-and-a-handy-size-Google-Pixel-9a-review.1039364.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Google/Pixel_9a/Screenshot_20250612-154901.png",
    sha256: "b3def8b5d361e3155d6fb9c81e9ddfedf55f39e92de30810b53972713faeb7c8",
    nativeSize: [1080, 2424],
  },
  "galaxys25-oneui7": {
    modelId: "galaxys25",
    observedSystem:
      "One UI 7.0 / Android 15（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Samsung-Galaxy-S25-review-The-star-among-compact-smartphones-is-losing-ground.989246.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Samsung/Galaxy_S25/Screenshot_20250321_160249_One-UI-Home.jpg",
    sha256: "a8d4b9df0457c07b077784786ef9ddbbde5160cc154d8cbc8822f3027ab3f159",
    nativeSize: [1080, 2340],
  },
  "iphone17-ios26": {
    modelId: "iphone17",
    observedSystem: "iOS 26（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Apple-iPhone-17-smartphone-review-The-best-iPhone-of-the-year-is-unbelievably-close-to-an-iPhone-Pro.1129296.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Apple/iPhone_17/Screenshots_Apple_iPhone_17_OS_1.PNG",
    sha256: "862d0cbee01a4ecff69d6b42896c770c00b4c9cdb2e31055ed5f2d9ccda88430",
    nativeSize: [1206, 2622],
  },
  "iphone17promax-ios26": {
    modelId: "iphone17promax",
    observedSystem: "iOS 26（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Setting-new-battery-life-records-Apple-iPhone-17-Pro-Max-smartphone-review.1148795.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Apple/iPhone_17_Pro_Max/Screenshots_Apple_iPhone_17_Pro_Max_OS_1.jpg",
    sha256: "1c513a84e1286d997a30a83cc3d05a3466ebe9f2d3329df370fe15bdb3f98056",
    nativeSize: [1320, 2868],
  },
  "iphone16pro-ios18": {
    modelId: "iphone16pro",
    observedSystem: "iOS 18（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Apple-iPhone-16-Pro-smartphone-review-The-small-Pro-phone-with-the-big-display.899301.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Apple/iPhone_16_Pro/Screenshots_OS_1.PNG",
    sha256: "473740914e3960516891321c04aa201b78603a6ecc025e7483fff1ce4414d7b8",
    nativeSize: [1206, 2622],
  },
  "vivox200pro-originos5": {
    modelId: "vivox200pro",
    observedSystem:
      "OriginOS 5 / Android 15 国行（评测正文；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/The-best-photo-smartphone-of-2024-comes-with-Android-Vivo-X200-Pro-review.935687.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Vivo/X200_Pro/Screenshot_20241212_151435.jpg",
    sha256: "2b755b3d64e88d3e2ddf7dfecddece26f59df0ab7350bd558495a3b390ae2b46",
    nativeSize: [1260, 2800],
  },
  "realmegt6-realme5": {
    modelId: "realmegt6",
    observedSystem:
      "realme UI 5.0 / Android 14（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Realme-GT-6-review-Mid-range-smartphone-with-6-000-nits-and-spectacular-runtimes.873275.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Realme/GT_6/Screenshot_2024-07-28-15-40-01-95_fc704e6b13c4fb26bf5e411f75da84f2.jpg",
    sha256: "b1caa2804848c1f866c1a26d38c9d3707e10afeff47ed34d193ee2a43df2f16f",
    nativeSize: [1264, 2780],
  },

  "galaxys24plus-oneui61": {
    modelId: "galaxys24plus",
    observedSystem:
      "One UI 6.1 / Android 14（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Samsung-Galaxy-S24-smartphone-review-The-big-Galaxy-S24-inches-closer-to-the-S24-Ultra.811860.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Samsung/Galaxy_S24_Plus/Screenshot_20240302_102048_Settings.jpg",
    sha256: "95532545a6af9baf4f0cf0fd54c4a8ce3951608d1831011c59fe77b1c7bef2cb",
    nativeSize: [1440, 3120],
  },
  "galaxys24ultra-oneui61": {
    modelId: "galaxys24ultra",
    observedSystem:
      "One UI 6.1 / Android 14（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Samsung-Galaxy-S24-Ultra-review-The-ultimate-smartphone-becomes-an-AI-smartphone.809187.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Samsung/Galaxy_S24_Ultra/Screenshot_20240223_112031_One-UI-Home.jpg",
    sha256: "701b9a68a88f68eadb1ec7d8380dda6817e143baaf7c6c38bf36ed37df18fe8d",
    nativeSize: [1440, 3120],
  },
  "galaxya55-oneui61": {
    modelId: "galaxya55",
    observedSystem:
      "One UI 6.1 / Android 14（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Samsung-Galaxy-A55-5G-review-A-lot-of-premium-features-in-a-midrange-smartphone.835803.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Samsung/Galaxy_A55_5G/Screenshot_20240503_152342_One-UI-Home.jpg",
    sha256: "27864694221a416e982d6091f68afa31b26e9bacc524c7db05bb0affeebcbab5",
    nativeSize: [1080, 2340],
  },
  "xiaomi15ultra-hyperos2": {
    modelId: "xiaomi15ultra",
    observedSystem:
      "HyperOS 2.0 / Android 15（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Xiaomi-15-Ultra-review-Leica-powered-powerhouse.975197.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Xiaomi/15_Ultra/Screenshot_2025-03-07-11-12-45-914_com.miui.home.jpg",
    sha256: "38e4e0d52ad241481511890361501833fe1e727bc3be1152261aed4d7b9ed8c2",
    nativeSize: [1440, 3200],
  },
  "iphone16e-ios18": {
    modelId: "iphone16e",
    observedSystem: "iOS 18（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Apple-s-new-budget-wonder-weapon-against-the-competition-Apple-iPhone-16e-review.1009234.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Apple/iPhone_16e/Screenshots_Apple_iPhone_16e_OS_1.PNG",
    sha256: "c57e356b8f90003feddae0b90db32451db7d71e11a01317b7b4f3cf9429e220c",
    nativeSize: [1170, 2532],
  },

  "galaxys25ultra-oneui7": {
    modelId: "galaxys25ultra",
    observedSystem: "One UI 7 / Android 15（评测正文；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Samsung-Galaxy-S25-Ultra-review-The-AI-phone-relies-fully-on-artificial-intelligence-and-small-hardware-upgrades.968346.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Samsung/Galaxy_S25_Ultra/Screenshot_20250224_173903_Personal-data-intelligence.jpg",
    sha256: "d7d64bb358dd14acfe5f0aa5a84595bd5785796d36ed0144b41b2ab9d0c33e69",
    nativeSize: [1440, 3120],
  },
  "xiaomi14-hyperos1": {
    modelId: "xiaomi14",
    observedSystem:
      "HyperOS 1 / Android 14（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Xiaomi-14-review-New-top-model-and-fastest-compact-Android-smartphone.797218.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Xiaomi/14/Screenshots_OS_4.jpg",
    sha256: "0bc4773923737ba66f90d284277537d92fcd0e1bef865635e2a84866d91eb5a7",
    nativeSize: [1200, 2670],
  },
  "xiaomi14pro-hyperos1": {
    modelId: "xiaomi14pro",
    observedSystem:
      "HyperOS 1 / Android 14（评测正文；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Xiaomi-14-Pro-review-Leica-camera-smartphone-with-a-great-display-leaves-some-questions.788160.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Xiaomi/14_Pro/Screenshot_2023-12-22-14-05-35-698_com.android.settings95.jpg",
    sha256: "e33fdb953dfd6c484306e2c54ff73e2966d0bdd84809a529b03043c96bfedc7b",
    nativeSize: [1440, 3200],
  },
  "xiaomi14ultra-hyperos1": {
    modelId: "xiaomi14ultra",
    observedSystem:
      "HyperOS 1.0 / Android 14（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Xiaomi-14-Ultra-review-The-Leica-phone-comes-up-trumps.830640.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Xiaomi/14_Ultra/Screenshot_2024-04-19-12-41-01-748_com.duokan.phone.remotecontroller.jpg",
    sha256: "49c0b384572e12efeb2c43bb2ba3f0288d2a81eca1291ee5687a98e0d75211ab",
    nativeSize: [1440, 3200],
  },
  "xiaomi15-hyperos2": {
    modelId: "xiaomi15",
    observedSystem:
      "HyperOS 2.0 / Android 15（评测规格；12 小时不显示 AM/PM；精确构建与缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Xiaomi-15-smartphone-review-Xiaomi-s-flagship-phone-sets-new-benchmarks-for-performance-and-battery-life.931175.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Xiaomi/15/Screenshots_OS_1.jpg",
    sha256: "bced8f07a93597a2969de56818562b4f2f9bda629cdf20b115956478e0375858",
    nativeSize: [1200, 2670],
  },
  "xiaomi15pro-hyperos2": {
    modelId: "xiaomi15pro",
    observedSystem:
      "HyperOS 2.0 / Android 15（评测正文；12 小时不显示 AM/PM；精确构建与缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Xiaomi-15-Pro-review-One-of-the-most-efficient-flagship-smartphones-thanks-to-a-special-display.939116.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Xiaomi/15_Pro/Screenshot_2024-12-27-13-38-23-754_com.android.settings.jpg",
    sha256: "5da79c2780567f4df6ea141cf52f2f555bff88140bc6dbfce1734390280dca7c",
    nativeSize: [1440, 3200],
  },
  "honormagic6pro-magic8": {
    modelId: "honormagic6pro",
    observedSystem:
      "MagicOS 8.0 / Android 14（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Honor-Magic6-Pro-review-The-smartphone-with-magical-battery-life.817062.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Honor/Magic6_Pro/Screenshot_20240320_150349_com.hihonor.desktop.systemui.jpg",
    sha256: "f9157375b600f457bc845de87f55c42b07d8196f45f9c3ea19699b598766d5db",
    nativeSize: [1280, 2800],
  },
  "honormagic7pro-magic9": {
    modelId: "honormagic7pro",
    observedSystem:
      "MagicOS 9.0 / Android 15（评测规格；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Honor-Magic7-Pro-review-A-powerful-camera-smartphone-with-lots-of-features.948829.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Honor/Magic7_Pro/Screenshot_20250110_134610_com_hihonor_controlcenter_ControlHomeActivity.jpg",
    sha256: "8d9a9eee1e87cf9a7752a75ec4e5c6e92849b7b56eef053798127d3be4ea0fbd",
    nativeSize: [1280, 2800],
  },
  "vivox200promini-originos5": {
    modelId: "vivox200promini",
    observedSystem:
      "OriginOS 5 / Android 15 国行（评测正文；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/The-best-compact-smartphone-for-photography-Vivo-X200-Pro-Mini-review.965620.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Vivo/X200_Pro_Mini/Screenshot_20250215_190246.jpg",
    sha256: "79e4867ef72ff1153984d7dd6bf66493c9e71e6d07df6ed7a7d095e43a1ef2ca",
    nativeSize: [1216, 2640],
  },
  "redminote14proplus-hyperos1": {
    modelId: "redminote14proplus",
    observedSystem:
      "HyperOS 1.0 / Android 14（评测正文；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/Xiaomi-Redmi-Note-14-Pro-5G-review-Mid-range-heavyweight-with-a-200-MPix-camera.963252.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/Xiaomi/Redmi_Note_14_Pro_Plus_5G/Screenshot_2025-02-14-11-39-31-074_com.android.htmlviewer.jpg",
    sha256: "3283754e9559cb13429653217c4800aa05bcd65b8ab7ae58bd75e3bda0994b90",
    nativeSize: [1220, 2712],
  },

  "oneplus13-coloros15": {
    modelId: "oneplus13",
    observedSystem:
      "ColorOS 15 / Android 15 国行（评测正文明确为进口国行；精确构建与显示缩放未知）",
    reviewUrl:
      "https://www.notebookcheck.net/OnePlus-13-Smartphone-Review-Let-the-battery-revolution-begin.932327.0.html",
    imageUrl:
      "https://www.notebookcheck.net/fileadmin/Notebooks/OnePlus/13/Screenshot_2024-12-05-16-37-15-40_b783bf344239542886fee7b48fa4b892.jpg",
    sha256: "c6865fb0166030ee5005742530b3f32741b198e852a507f2dd13e2275b6ded42",
    nativeSize: [1440, 3168],
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
