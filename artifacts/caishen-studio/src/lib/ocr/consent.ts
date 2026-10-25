// Remembers that the user agreed to download the OCR engine. Images are
// processed locally, so this is about the one-time engine/model download.
const KEY = "caishen.ocrConsent.v1";

export function hasOcrConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === "yes";
  } catch {
    return false;
  }
}

export function setOcrConsent(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY, "yes");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage may be unavailable (private mode); consent is then asked each time.
  }
}
