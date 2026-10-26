import { fusionReady } from "@/lib/phone/fusion";
import { useState } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { useEditor } from "@/stores/editor.ts";
import { recordExport } from "@/lib/storage/works.ts";
import { getParamValue, validateParamValue } from "@/lib/template/params.ts";
import { formatBytes } from "@/lib/image/import.ts";
import { downloadBlob, exportDoc, sanitizeFileName, type ExportFormat } from "../_lib/export.ts";
import { SliderField } from "./fields.tsx";

export default function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const doc = useEditor((s) => s.doc);
  const workId = useEditor((s) => s.workId);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState(1);
  const [customW, setCustomW] = useState<string>("");
  const [quality, setQuality] = useState(0.92);
  const [transparent, setTransparent] = useState(false);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  if (!doc) return null;

  const width = customW && Number(customW) > 0 ? Math.round(Number(customW)) : Math.round(doc.canvas.width * scale);
  const height = Math.round((width * doc.canvas.height) / doc.canvas.width);
  const tooBig = width * height > 16384 * 16384 / 4 || width > 16000 || height > 16000;
  const paramErrors = doc.parameters
    .map((p) => validateParamValue(p, getParamValue(doc, p)))
    .filter((x): x is string => x !== null);

  const ready = fusionReady(doc);
  const run = async () => {
    if(!ready) return;
    setBusy(true);
    setWarnings([]);
    try {
      const name = `${sanitizeFileName(fileName || doc.name)}.${format === "png" ? "png" : "jpg"}`;
      const res = await exportDoc(doc, { format, width, quality, transparent, fileName: name });
      downloadBlob(res.blob, name);
      let historySaved = true;
      try {
        await recordExport({ workId, workName: doc.name, fileName: name, format, width: res.width, height: res.height });
      } catch {
        historySaved = false;
        toast.warning("图片已生成并开始下载，导出记录未保存", { description: "本地存储可能已满，请检查下载文件并清理空间。" });
      }
      setWarnings(res.warnings);
      if (historySaved) toast.success(`已导出 ${res.width}×${res.height}（${formatBytes(res.blob.size)}）`);
      if (res.warnings.length === 0) onOpenChange(false);
    } catch (e) {
      toast.error("导出失败", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导出图片</DialogTitle>
          <DialogDescription>{doc.phone ? "仅导出屏幕内容，保留状态栏，不包含灵动岛、刘海或摄像头开孔。" : "按原始设计尺寸重新渲染，不受编辑器缩放影响。"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>文件名</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder={doc.name} />
          </div>
          <div className="space-y-1">
            <Label>格式</Label>
            <ToggleGroup type="single" variant="outline" value={format} onValueChange={(v) => v && setFormat(v as ExportFormat)} className="w-full">
              <ToggleGroupItem value="png" className="flex-1">PNG</ToggleGroupItem>
              <ToggleGroupItem value="jpeg" className="flex-1">JPEG</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1">
            <Label>尺寸</Label>
            <ToggleGroup type="single" variant="outline" value={customW ? "" : String(scale)} onValueChange={(v) => { if (v) { setScale(Number(v)); setCustomW(""); } }} className="w-full">
              <ToggleGroupItem value="0.5" className="flex-1">0.5×</ToggleGroupItem>
              <ToggleGroupItem value="1" className="flex-1">1× 原尺寸</ToggleGroupItem>
              <ToggleGroupItem value="2" className="flex-1">2× 高清</ToggleGroupItem>
              <ToggleGroupItem value="3" className="flex-1">3×</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-center gap-2 pt-1">
              <Input type="number" value={customW} onChange={(e) => setCustomW(e.target.value)} placeholder="自定义宽度 px" className="h-8" />
              <span className="shrink-0 text-xs text-muted-foreground">输出 {width}×{height}</span>
            </div>
          </div>
          {format === "jpeg" ? (
            <SliderField label="质量" value={quality} min={0.4} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={setQuality} />
          ) : (
            <div className="flex items-center justify-between">
              <Label className="font-normal">透明背景（不导出背景色和背景图）</Label>
              <Switch checked={transparent} onCheckedChange={setTransparent} />
            </div>
          )}
          {!ready && <p role="status" className="text-xs text-destructive">状态栏尚未准备完成。原位替换请先在“状态栏定位”中测试并确认，并检查手机设置后重新生成；顶部新增请重新自动适配。</p>}
          {paramErrors.length > 0 && (
            <div className="rounded-md border border-amber-400/60 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              参数未通过校验：{paramErrors.join("；")}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-400/60 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              <p className="flex items-center gap-1 font-medium"><AlertTriangle className="size-3.5" /> 已导出，但存在以下问题：</p>
              {warnings.map((w) => <p key={w}>· {w}</p>)}
            </div>
          )}
          {tooBig && <p className="text-xs text-destructive">尺寸过大，浏览器可能无法生成，请减小宽度。</p>}
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={busy || tooBig || width < 1 || !ready}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            导出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
