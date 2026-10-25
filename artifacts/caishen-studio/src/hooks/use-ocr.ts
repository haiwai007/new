import { useCallback, useRef, useState } from "react";
import { getOcrProvider, type OcrProgress, type OcrResult } from "@/lib/ocr/index.ts";
import type { OcrRequest } from "@/lib/ocr/types.ts";
import { hasOcrConsent, setOcrConsent } from "@/lib/ocr/consent.ts";

export type OcrRunState =
  | { status: "idle" }
  | { status: "running"; progress: OcrProgress }
  | { status: "error"; message: string };

type Request = Omit<OcrRequest, "onProgress">;

/**
 * Runs OCR with an explicit one-time consent step and progress reporting.
 * `run` resolves to null when the user declines or cancels.
 */
export function useOcr() {
  const [state, setState] = useState<OcrRunState>({ status: "idle" });
  const [consentOpen, setConsentOpen] = useState(false);
  const pending = useRef<{ req: Request; resolve: (r: OcrResult | null) => void } | null>(null);
  const runId = useRef(0);

  const execute = useCallback(async (req: Request): Promise<OcrResult | null> => {
    const id = ++runId.current;
    setState({ status: "running", progress: { stage: "准备识别", progress: 0 } });
    try {
      const result = await getOcrProvider().recognize({
        ...req,
        onProgress: (p) => {
          if (runId.current === id) setState({ status: "running", progress: p });
        },
      });
      if (runId.current !== id) return null;
      setState({ status: "idle" });
      return result;
    } catch (e) {
      if (runId.current !== id) return null;
      setState({ status: "error", message: e instanceof Error ? e.message : "文字识别失败" });
      return null;
    }
  }, []);

  const run = useCallback(
    (req: Request): Promise<OcrResult | null> => {
      if (hasOcrConsent()) return execute(req);
      return new Promise((resolve) => {
        pending.current = { req, resolve };
        setConsentOpen(true);
      });
    },
    [execute],
  );

  const answerConsent = useCallback(
    (accepted: boolean, remember: boolean) => {
      setConsentOpen(false);
      const p = pending.current;
      pending.current = null;
      if (!p) return;
      if (!accepted) {
        p.resolve(null);
        return;
      }
      if (remember) setOcrConsent(true);
      void execute(p.req).then(p.resolve);
    },
    [execute],
  );

  const cancel = useCallback(async () => {
    runId.current += 1;
    setState({ status: "idle" });
    await getOcrProvider().cancel();
  }, []);

  return { state, run, cancel, consentOpen, answerConsent, provider: getOcrProvider() };
}
