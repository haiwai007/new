import { useEffect, useState } from "react";
import { AlertTriangle, ScanText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { useOcr } from "@/hooks/use-ocr.ts";
import OcrConsentDialog from "@/components/ocr/ocr-consent-dialog.tsx";
import OcrProgressBar from "@/components/ocr/ocr-progress.tsx";
import { linesToLayers } from "@/lib/ocr/to-layers.ts";
import type { AnalyzedLine } from "@/lib/ocr/index.ts";
import { addLayers } from "@/lib/template/doc-ops.ts";
import { suggestParameters } from "@/lib/template/params.ts";
import { edit, useEditor, type OcrRequest } from "@/stores/editor.ts";
import { resolveOcrSource, type OcrSource } from "../_lib/ocr-source.ts";

type Row = AnalyzedLine & { include: boolean };
type Phase = { kind: "idle" } | { kind: "review"; source: OcrSource; rows: Row[] } | { kind: "error"; message: string };

/** Runs OCR for requests coming from the editor (box tool or whole image) and inserts the results as layers. */
export default function EditorOcrDialog() {
  const request = useEditor((s) => s.ocrRequest);
  const setRequest = useEditor((s) => s.setOcrRequest);
  const ocr = useOcr();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [addMasks, setAddMasks] = useState(true);
  const [asParams, setAsParams] = useState(true);

  useEffect(() => {
    if (!request) return;
    let alive = true;
    const go = async (req: OcrRequest) => {
      const doc = useEditor.getState().doc;
      if (!doc) return;
      try {
        const source = await resolveOcrSource(doc, req.full ? null : req);
        const res = await ocr.run({ image: source.blob, region: source.region, singleBlock: !req.full });
        if (!alive) return;
        if (!res) {
          // Declined or cancelled — the error (if any) is shown by the hook state.
          setRequest(null);
          return;
        }
        if (res.lines.length === 0) {
          toast.warning("没有识别到文字", { description: "可以尝试框选更小、更清晰的区域，或用「框选添加文字」手动添加。" });
          setRequest(null);
          return;
        }
        setPhase({ kind: "review", source, rows: res.lines.map((l) => ({ ...l, include: true })) });
      } catch (e) {
        if (alive) setPhase({ kind: "error", message: e instanceof Error ? e.message : "识别失败" });
      }
    };
    void go(request);
    return () => {
      alive = false;
    };
    // `ocr.run` is stable; only react to new requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const close = () => {
    setPhase({ kind: "idle" });
    setRequest(null);
  };

  const insert = () => {
    if (phase.kind !== "review") return;
    const doc = useEditor.getState().doc;
    if (!doc) return;
    const lines = phase.rows.filter((r) => r.include && r.text.trim()).map((r) => ({ ...r, text: r.text.trim() }));
    const res = linesToLayers(lines, phase.source.image, doc.canvas, { addMasks });
    if (res.layers.length === 0) {
      toast.warning("没有可添加的文字");
      return;
    }
    const newIds = new Set(res.layers.map((l) => l.id));
    edit((d) => {
      const withLayers = addLayers(d, res.layers);
      if (!asParams) return withLayers;
      const params = suggestParameters(withLayers).filter((p) => newIds.has(p.layerId));
      return { ...withLayers, parameters: [...withLayers.parameters, ...params] };
    });
    useEditor.getState().select(res.layers.filter((l) => l.type === "text").map((l) => l.id));
    toast.success(`已添加 ${res.textCount} 个文字图层`, {
      description: [res.maskCount ? `${res.maskCount} 个遮罩` : null, res.maskSkipped ? `${res.maskSkipped} 处背景复杂未加遮罩` : null]
        .filter(Boolean)
        .join("，") || undefined,
    });
    close();
  };

  const update = (id: string, patch: Partial<Row>) =>
    phase.kind === "review" && setPhase({ ...phase, rows: phase.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const running = ocr.state.status === "running";
  const hookError = ocr.state.status === "error" ? ocr.state.message : null;
  const errorMsg = phase.kind === "error" ? phase.message : hookError;

  return (
    <>
      {running && ocr.state.status === "running" && (
        <div className="absolute left-1/2 top-14 z-30 w-[min(92vw,420px)] -translate-x-1/2 shadow-lg">
          <OcrProgressBar progress={ocr.state.progress} onCancel={() => { void ocr.cancel(); setRequest(null); }} />
        </div>
      )}
      <OcrConsentDialog open={ocr.consentOpen} providerLabel={ocr.provider.label} onAnswer={ocr.answerConsent} />

      <Dialog open={Boolean(errorMsg) && !running} onOpenChange={(o) => { if (!o) { close(); ocr.cancel(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-destructive" />文字识别失败</DialogTitle>
            <DialogDescription>{errorMsg}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => { close(); void ocr.cancel(); }}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={phase.kind === "review"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScanText className="size-5 text-primary" />识别结果</DialogTitle>
            <DialogDescription>来源：{phase.kind === "review" ? phase.source.label : ""}。修改错字、取消勾选不需要的条目后添加到画布。</DialogDescription>
          </DialogHeader>
          {phase.kind === "review" && (
            <ul className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {phase.rows.map((r, i) => (
                <li key={r.id} className={cn("flex items-center gap-2", !r.include && "opacity-60")}>
                  <Checkbox checked={r.include} onCheckedChange={(v) => update(r.id, { include: v === true })} aria-label={`保留第 ${i + 1} 条`} />
                  <Input value={r.text} onChange={(e) => update(r.id, { text: e.target.value })} className="h-8 flex-1" />
                  <span className={cn("w-10 text-right text-[11px] tabular-nums", r.confidence < 55 ? "text-destructive" : "text-muted-foreground")}>{r.confidence}%</span>
                  <input type="color" value={r.color} onChange={(e) => update(r.id, { color: e.target.value })} className="size-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5" aria-label="文字颜色" />
                  <Button size="icon" variant="ghost" className="size-8" aria-label="删除" onClick={() => setPhase({ ...phase, rows: phase.rows.filter((x) => x.id !== r.id) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2"><Switch checked={addMasks} onCheckedChange={setAddMasks} />用纯色遮罩盖住原文字</label>
            <label className="flex cursor-pointer items-center gap-2"><Switch checked={asParams} onCheckedChange={setAsParams} />同时设为模板参数</label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button onClick={insert}>添加到画布</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
