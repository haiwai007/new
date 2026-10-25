import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import type { OcrProgress } from "@/lib/ocr/index.ts";

export default function OcrProgressBar({ progress, onCancel }: { progress: OcrProgress; onCancel: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="flex-1">{progress.stage}…</span>
        <span className="tabular-nums text-muted-foreground">{Math.round(progress.progress * 100)}%</span>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="size-4" /> 取消
        </Button>
      </div>
      <Progress value={progress.progress * 100} />
    </div>
  );
}
