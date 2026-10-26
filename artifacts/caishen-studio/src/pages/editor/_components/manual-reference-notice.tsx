import { Button } from "@/components/ui/button";
import { edit, useEditor } from "@/stores/editor";
import {
  fadedManualReferences,
  restoreManualReference,
} from "@/lib/template/manual-reference";
export default function ManualReferenceNotice() {
  const doc = useEditor((s) => s.doc);
  if (!doc || !fadedManualReferences(doc).length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="min-w-0 flex-1">
        原图参考处于半透明状态，未编辑区域可能发白。
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => edit(restoreManualReference)}
      >
        恢复原图清晰度
      </Button>
    </div>
  );
}
