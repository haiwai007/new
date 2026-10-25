import { getDb } from "./db";
import { newId } from "../template/ids";
import {
  validatePhoneBatchRules,
  type PhoneBatchRules,
} from "../batch/phone-rules";
import {
  DRAWING_PRESETS_KEY,
  drawingPresetSchema,
  presetAssetIds,
  storedPresets,
  type DrawingPreset,
} from "../phone/drawing-preset";
export async function listDrawingPresets() {
  return storedPresets(await (await getDb()).get("kv", DRAWING_PRESETS_KEY));
}
export async function saveDrawingPreset(name: string, rules: PhoneBatchRules) {
  const errors = validatePhoneBatchRules(rules);
  if (errors.length) throw new Error(errors.join("；"));
  const preset = drawingPresetSchema.parse({
    id: newId("preset"),
    name,
    rules,
    createdAt: new Date().toISOString(),
  }) as DrawingPreset;
  const db = await getDb();
  const tx = db.transaction(["kv", "assets"], "readwrite");
  void tx.done.catch(() => {});
  try {
    const rows = storedPresets(
      await tx.objectStore("kv").get(DRAWING_PRESETS_KEY),
    );
    if (rows.length >= 100)
      throw new Error("最多保存 100 个作图预设，请先删除不需要的预设");
    for (const id of presetAssetIds([preset]))
      if (!(await tx.objectStore("assets").get(id)))
        throw new Error("预设引用的自定义图标已丢失，请重新上传");
    await tx.objectStore("kv").put([...rows, preset], DRAWING_PRESETS_KEY);
    await tx.done;
    return preset;
  } catch (error) {
    try {
      tx.abort();
    } catch {}
    await tx.done.catch(() => {});
    throw error;
  }
}
export async function deleteDrawingPreset(id: string) {
  const db = await getDb(),
    tx = db.transaction("kv", "readwrite");
  const rows = storedPresets(await tx.store.get(DRAWING_PRESETS_KEY));
  await tx.store.put(
    rows.filter((p) => p.id !== id),
    DRAWING_PRESETS_KEY,
  );
  await tx.done;
}
