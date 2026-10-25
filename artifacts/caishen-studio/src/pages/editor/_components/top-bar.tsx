import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Copy,
  Download,
  Eye,
  FileDown,
  History,
  LayoutTemplate,
  Loader2,
  Maximize,
  MoreHorizontal,
  Redo2,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu.tsx";
import { downloadFile, exportTemplatePackage } from "@/lib/storage/template-package.ts";
import { sanitizeFileName } from "../_lib/export.ts";
import { MAX_WORK_NAME } from "@/lib/storage/names";
import { edit, useEditor } from "@/stores/editor.ts";
import BrandMark from "@/components/site/brand-mark.tsx";
import ExportDialog from "./export-dialog.tsx";
import PreviewDialog from "./preview-dialog.tsx";
import SaveTemplateDialog from "./save-template-dialog.tsx";

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SaveIndicator() {
  const status = useEditor((s) => s.saveStatus);
  const err = useEditor((s) => s.saveError);
  const map = {
    saved: { icon: <Check className="size-3.5" />, text: "已保存到本地", cls: "text-muted-foreground" },
    dirty: { icon: <span className="size-1.5 rounded-full bg-accent" />, text: "有未保存的修改", cls: "text-muted-foreground" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "正在保存…", cls: "text-muted-foreground" },
    error: { icon: <AlertCircle className="size-3.5" />, text: err ?? "保存失败", cls: "text-destructive" },
  }[status];
  return <span role="status" className={`order-last flex w-full min-w-0 items-center gap-1 break-words px-1 pb-1 text-xs lg:order-none lg:w-auto lg:max-w-36 lg:pb-0 ${map.cls}`}>{map.icon}{map.text}</span>;
}

export default function TopBar({
  onSave,
  onFit,
  isTemplate,
  onOpenHistory,
}: {
  onSave: () => void;
  onFit: () => void;
  isTemplate: boolean;
  onOpenHistory: () => void;
}) {
  const recoveryWorkId = useEditor((s) => s.recoveryWorkId);
  const doc = useEditor((s) => s.doc);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const zoom = useEditor((s) => s.zoom);
  const hasSel = useEditor((s) => s.selectedIds.length > 0);
  const { undo, redo, duplicate, setZoom } = useEditor.getState();
  const [exportOpen, setExportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  if (!doc) return null;

  const exportTemplate = async () => {
    try {
      const current = useEditor.getState().doc;
      if (!current) return;
      const { blob, assetCount, missing } = await exportTemplatePackage(current);
      downloadFile(blob, `${sanitizeFileName(current.name)}.haishen.json`);
      toast.success("已导出模板文件", {
        description: `包含 ${assetCount} 张图片${missing ? `，${missing} 张图片已丢失未包含` : ""}。可在「我的作品 → 导入模板」中打开。`,
      });
    } catch (e) {
      toast.error("导出失败", { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-1 border-b bg-background px-2 py-1 lg:gap-2 lg:px-3">
      <Tip label="返回首页">
        <Button size="icon" variant="ghost" className="size-11 shrink-0 lg:size-9" asChild>
          <Link to="/" aria-label="返回首页"><ChevronLeft className="size-5" /></Link>
        </Button>
      </Tip>
      <BrandMark className="hidden size-7 md:inline-flex" />
      <Input
        maxLength={MAX_WORK_NAME}
        value={doc.name}
        onChange={(e) => edit((d) => ({ ...d, name: e.target.value }), { coalesceKey: "rename" })}
        className="h-11 w-0 min-w-0 flex-1 border-transparent bg-transparent font-medium hover:border-input focus:border-input lg:h-8 lg:w-40 lg:flex-none xl:w-56"
        aria-label="项目名称"
      />
      {isTemplate && <span className="hidden rounded bg-accent/30 px-1.5 py-0.5 text-[11px] text-accent-foreground sm:inline dark:text-accent">模板</span>}
      <SaveIndicator />
      {recoveryWorkId && <Link className="order-last w-full px-1 pb-1 text-xs font-medium text-primary underline" to={`/editor/${recoveryWorkId}`}>打开冲突副本继续编辑</Link>}

      <div className="mx-auto hidden items-center gap-0.5 lg:flex">
        <Tip label="撤销 Ctrl+Z"><Button size="icon" variant="ghost" onClick={undo} disabled={!canUndo} aria-label="撤销"><Undo2 className="size-4" /></Button></Tip>
        <Tip label="重做 Ctrl+Y"><Button size="icon" variant="ghost" onClick={redo} disabled={!canRedo} aria-label="重做"><Redo2 className="size-4" /></Button></Tip>
        <Tip label="复制所选 Ctrl+D"><Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={duplicate} disabled={!hasSel} aria-label="复制"><Copy className="size-4" /></Button></Tip>
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Tip label="缩小"><Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={() => setZoom(zoom / 1.2)} aria-label="缩小"><ZoomOut className="size-4" /></Button></Tip>
        <span className="hidden w-12 text-center text-xs tabular-nums sm:inline">{Math.round(zoom * 100)}%</span>
        <Tip label="放大"><Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={() => setZoom(zoom * 1.2)} aria-label="放大"><ZoomIn className="size-4" /></Button></Tip>
        <Tip label="适应屏幕"><Button size="icon" variant="ghost" onClick={onFit} aria-label="适应屏幕"><Maximize className="size-4" /></Button></Tip>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Tip label="预览"><Button size="icon" variant="ghost" className="hidden lg:inline-flex" onClick={() => setPreviewOpen(true)} aria-label="预览"><Eye className="size-4" /></Button></Tip>
        <Tip label="保存并创建历史版本 Ctrl+S">
          <Button size="sm" variant="ghost" className="size-11 p-0 lg:h-8 lg:w-auto lg:px-3" onClick={onSave} aria-label="保存"><Save className="size-4" /><span className="hidden lg:inline">保存</span></Button>
        </Tip>
        <DropdownMenu>
          <Tip label="更多">
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-11 lg:size-9" aria-label="更多"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="min-h-11 lg:hidden" onClick={undo} disabled={!canUndo}><Undo2 className="size-4" />撤销</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 lg:hidden" onClick={redo} disabled={!canRedo}><Redo2 className="size-4" />重做</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 lg:hidden" onClick={duplicate} disabled={!hasSel}><Copy className="size-4" />复制所选</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 lg:hidden" onClick={onFit}><Maximize className="size-4" />适应屏幕</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 lg:hidden" onClick={() => setZoom(zoom / 1.2)}><ZoomOut className="size-4" />缩小</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 lg:hidden" onClick={() => setZoom(zoom * 1.2)}><ZoomIn className="size-4" />放大</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 lg:hidden" onClick={() => setPreviewOpen(true)}><Eye className="size-4" />预览</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 lg:hidden" onClick={() => setTplOpen(true)}><LayoutTemplate className="size-4" />另存为模板</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenHistory}><History className="size-4" />历史版本</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void exportTemplate()}><FileDown className="size-4" />导出模板文件（含图片）</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tip label="另存为模板">
          <Button size="sm" variant="secondary" className="hidden lg:inline-flex" onClick={() => setTplOpen(true)} aria-label="另存为模板">
            <LayoutTemplate className="size-4" /><span className="hidden lg:inline">另存为模板</span>
          </Button>
        </Tip>
        <Button size="sm" className="size-11 p-0 lg:h-8 lg:w-auto lg:px-3" aria-label="导出" onClick={() => setExportOpen(true)}>
          <Download className="size-4" /><span className="hidden lg:inline">导出</span>
        </Button>
      </div>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} />
      <SaveTemplateDialog open={tplOpen} onOpenChange={setTplOpen} />
    </header>
  );
}
