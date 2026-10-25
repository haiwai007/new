import type { OcrProvider } from "./types.ts";
import { tesseractProvider } from "./tesseract-provider.ts";

// Single place to choose the OCR implementation. Swap or add providers here
// (e.g. a cloud OCR action) without changing any UI code.
export function getOcrProvider(): OcrProvider {
  return tesseractProvider;
}

export type { AnalyzedLine, OcrResult, OcrProgress, Box } from "./types.ts";
