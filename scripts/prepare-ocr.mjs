import { createRequire } from "node:module";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const studio = path.join(root, "artifacts/caishen-studio");
const require = createRequire(path.join(studio, "package.json"));
const tessRoot = path.dirname(require.resolve("tesseract.js/package.json"));
const tessRequire = createRequire(path.join(tessRoot, "package.json"));
const coreRoot = path.dirname(
  tessRequire.resolve("tesseract.js-core/package.json"),
);
const target = path.join(studio, "public/ocr");
const files = [
  [path.join(tessRoot, "dist/worker.min.js"), "worker.min.js"],
  [path.join(tessRoot, "dist/worker.min.js.LICENSE.txt"), "worker.LICENSE.txt"],
  [path.join(tessRoot, "LICENSE.md"), "tesseract.LICENSE.md"],
  [path.join(coreRoot, "LICENSE"), "core/LICENSE"],
];
for (const filename of await readdir(coreRoot)) {
  if (
    /^tesseract-core(?:-simd|-relaxedsimd)?-lstm\.wasm(?:\.js)?$/.test(filename)
  )
    files.push([path.join(coreRoot, filename), `core/${filename}`]);
}
for (const lang of ["eng", "chi_sim"]) {
  const packageRoot = path.dirname(
    require.resolve(`@tesseract.js-data/${lang}/package.json`),
  );
  files.push([
    path.join(packageRoot, `4.0.0_best_int/${lang}.traineddata.gz`),
    `lang/${lang}.traineddata.gz`,
  ]);
  files.push([
    path.join(packageRoot, "package.json"),
    `licenses/${lang}.package.json`,
  ]);
  files.push([
    path.join(packageRoot, "README.md"),
    `licenses/${lang}.README.md`,
  ]);
}
const manifest = {};
for (const [source, relative] of files) {
  const bytes = await readFile(source); // Missing pinned package files are fatal, never silently use a CDN.
  const hash = createHash("sha256").update(bytes).digest("hex");
  const dest = path.join(target, relative);
  let existing;
  try {
    existing = createHash("sha256")
      .update(await readFile(dest))
      .digest("hex");
  } catch {}
  if (existing !== hash) {
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(source, dest);
  }
  manifest[relative] = hash;
}
await writeFile(
  path.join(target, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
// Keep font licensing with redistributed browser assets.
const fontRoot = path.join(studio, "node_modules/@fontsource");
try {
  for (const name of await readdir(fontRoot)) {
    const license = path.join(fontRoot, name, "LICENSE");
    const content = await readFile(license);
    const dest = path.join(studio, "public/licenses/fonts", `${name}.txt`);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, content);
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
console.log(
  `Prepared ${files.length} pinned OCR assets for same-origin loading.`,
);
const photosRoot = path.join(studio, "public/templates/unsplash");
const photos = JSON.parse(
  await readFile(path.join(photosRoot, "sources.json"), "utf8"),
);
for (const photo of photos) {
  if (!/^photo-[\w-]+\.jpg$/.test(photo.file))
    throw new Error("Invalid template photo manifest");
  const actual = createHash("sha256")
    .update(await readFile(path.join(photosRoot, photo.file)))
    .digest("hex");
  if (actual !== photo.sha256)
    throw new Error(`Template photo integrity check failed: ${photo.file}`);
}
