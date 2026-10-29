// Coverage is computed from exact records; discovery never grants calibration approval.
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
async function moduleAt(file) {
  const box = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(await fs.readFile(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    box,
  );
  return box.exports;
}
const { PHONE_MODELS } = await moduleAt(
  "artifacts/caishen-studio/src/lib/phone/models.ts",
);
const { DEVICE_LAYOUTS } = await moduleAt(
  "artifacts/caishen-studio/src/lib/phone/device-layouts.ts",
);
const inventory = JSON.parse(
  await fs.readFile("docs/phone-calibration/source-inventory.json", "utf8"),
);
const warnings = JSON.parse(
  await fs.readFile("docs/phone-calibration/reference-warnings.json", "utf8"),
);
const requirements = [
  "geometry",
  "fonts",
  "icons",
  "state-coverage",
  "native-frame-height",
  "os-build-display-scale",
];
const rows = PHONE_MODELS.flatMap((model) =>
  Object.entries(DEVICE_LAYOUTS[model.id].versions).map(([version, layout]) => {
    const evidence = layout.evidence;
    const missing = requirements.filter(
      (scope) => !evidence?.scopes.includes(scope),
    );
    if (
      evidence?.status === "calibrated" &&
      (missing.length || evidence.pending.length)
    )
      throw Error("Incomplete approval: " + model.id + "/" + version);
    return {
      modelId: model.id,
      name: model.name,
      version,
      status: evidence?.status ?? "reference",
      sourceIds: evidence?.sourceIds ?? [],
      verifiedScopes: evidence?.scopes ?? [],
      missing,
      sourceDiscovery: inventory.models.find((r) => r.modelId === model.id)
        ?.status,
      warning:
        warnings.rows.find((r) => r.modelId === model.id)?.reason ?? null,
    };
  }),
);
const summary = {
  models: PHONE_MODELS.length,
  versions: rows.length,
  partialVariants: rows.filter((r) => r.status === "partial").length,
  referenceVariants: rows.filter((r) => r.status === "reference").length,
  fullyCalibrated: rows.filter((r) => r.status === "calibrated").length,
  nativeScreenshotFiles: inventory.models
    .flatMap((r) => r.screenshots)
    .filter((r) => r.nativeSizeMatch).length,
};
await fs.writeFile(
  "docs/phone-calibration/coverage-matrix.json",
  JSON.stringify({ schemaVersion: 1, requirements, summary, rows }, null, 2) +
    "\n",
);
const lines = [
  "# 全型号／版本证据覆盖表",
  "",
  `共 ${summary.models} 个型号、${summary.versions} 个版本记录；${summary.partialVariants} 个版本仅完成样本位置部分核对，完整真机核准 ${summary.fullyCalibrated}。资料库存有 ${summary.nativeScreenshotFiles} 张原始尺寸截图候选，截图数量不是校准数量。`,
  "",
  "每个版本都需补齐：完整几何、字体轮廓、图标轮廓、多状态、原生状态栏高度、精确系统构建与显示缩放。部分核对不能代替这些验收。",
  "",
  "| 型号 | 版本 | 当前结果 | 资料问题 |",
  "|---|---|---|---|",
];
for (const r of rows)
  lines.push(
    `| ${r.name} | ${r.version} | ${r.status === "partial" ? "样本位置部分核对；完整验收未完成" : "参考配置；完整验收未完成"} | ${r.warning ?? (r.sourceDiscovery === "no-verified-source" ? "尚缺可靠实机资料" : "仍需本版本的完整证据")} |`,
  );
await fs.writeFile(
  "docs/phone-calibration/COVERAGE.zh-CN.md",
  lines.join("\n") + "\n",
);
const audit = [
  "# 逐型号状态栏配置核对表",
  "",
  `当前 ${summary.models} 个型号、30 种系统参考样式、${summary.versions} 个型号／版本记录。${summary.partialVariants} 个版本部分核对，完整真机核准为 ${summary.fullyCalibrated}。同型号的其他版本不继承核对结果。`,
  "",
  "详见[来源和复现](phone-calibration/README.md)与[全部版本缺口](phone-calibration/COVERAGE.zh-CN.md)。不能使用旧系统、海外 ROM 或锁屏截图冒充其他系统、国行 ROM 与普通界面的证据。",
  "",
  "| 型号 | 参考截图尺寸 | 独立版本记录 | 核对状态 |",
  "|---|---|---|---|",
];
for (const model of PHONE_MODELS) {
  const record = DEVICE_LAYOUTS[model.id];
  const partial = Object.entries(record.versions)
    .filter(([, l]) => l.evidence?.status === "partial")
    .map(([v]) => v);
  audit.push(
    `| ${model.name} | ${record.referenceSize.join("×")} | ${Object.keys(record.versions).join("、")} | ${partial.length ? partial.join("、") + " 样本位置部分核对；其他待标定" : "独立参考配置／待真机标定"} |`,
  );
}
await fs.writeFile(
  "docs/DEVICE_LAYOUT_AUDIT.zh-CN.md",
  audit.join("\n") + "\n",
);
console.log(JSON.stringify(summary));
