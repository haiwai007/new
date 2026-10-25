// OCR is defined as a replaceable provider interface. The default provider
// runs Tesseract inside the browser; a cloud provider can implement the same
// contract later without touching the template-building code.

export type Box = { x: number; y: number; width: number; height: number };

/** One recognized text line in source-image pixel coordinates. */
export type OcrLine = {
  id: string;
  text: string;
  /** 0–100 as reported by the engine. */
  confidence: number;
  bbox: Box;
};

/** A recognized line enriched with style info sampled from the image pixels. */
export type AnalyzedLine = OcrLine & {
  color: string;
  bgColor: string;
  /** True when the area around the text is a flat color, so a mask looks natural. */
  bgUniform: boolean;
  bold: boolean;
};

export type OcrProgress = { stage: string; progress: number };

export type OcrRequest = {
  image: Blob;
  /** Optional crop in source-image pixels. Returned boxes stay in full-image coordinates. */
  region?: Box;
  /** Treat the image as a single text block (better for small user-drawn regions). */
  singleBlock?: boolean;
  onProgress?: (p: OcrProgress) => void;
};

export type OcrResult = {
  engine: string;
  lines: AnalyzedLine[];
  /** Solid color blocks (buttons, banners) found in the image, in source pixels. */
  blocks: (Box & { color: string })[];
  /** Dominant color along the image border — a reasonable canvas background guess. */
  backgroundColor: string;
  imageWidth: number;
  imageHeight: number;
  durationMs: number;
};

export type OcrProvider = {
  id: string;
  label: string;
  /** Where the image is processed — shown to the user before consent. */
  processing: "local" | "cloud";
  recognize: (req: OcrRequest) => Promise<OcrResult>;
  /** Abort any running job and free resources. */
  cancel: () => Promise<void>;
};
