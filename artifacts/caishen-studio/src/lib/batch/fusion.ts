import { fitPhoneToImage } from "../phone/fusion";
import type { GeneratedItem } from "./rules";
export async function prepareFusionItems(
  items: GeneratedItem[],
  onProgress?: (n: number) => void,
): Promise<GeneratedItem[]> {
  const result: GeneratedItem[] = [];
  for (const [index, item] of items.entries()) {
    try {
      result.push(
        item.preservePhone || item.errors.length || !item.doc.phone?.fusion.enabled
          ? item
          : { ...item, doc: await fitPhoneToImage(item.doc, item.doc.phone) },
      );
    } catch (e) {
      result.push({
        ...item,
        errors: [
          ...item.errors,
          e instanceof Error
            ? e.message
            : "自动适配失败，请检查原图或改用手动设置",
        ],
      });
    }
    onProgress?.(index + 1);
    if (index % 6 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return result;
}
