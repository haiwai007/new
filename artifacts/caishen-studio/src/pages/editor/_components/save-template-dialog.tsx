import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useEditor } from "@/stores/editor.ts";
import { createWork } from "@/lib/storage/works.ts";
import { safeThumb } from "@/lib/template/start.ts";

export default function SaveTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const doc = useEditor((s) => s.doc);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!doc) return null;
  const save = async () => {
    setBusy(true);
    try {
      const n = name.trim() || `${doc.name} 模板`;
      const w = await createWork({ kind: "template", name: n, doc, thumbnail: await safeThumb(doc), origin: useEditor.getState().workId });
      onOpenChange(false);
      toast.success(`模板「${n}」已保存`, {
        description: "已保存到「我的作品 · 自定义模板」，之后修改模板不会影响已有作品。",
        action: { label: "编辑模板", onClick: () => navigate(`/editor/${w.id}`) },
      });
    } catch (e) {
      toast.error("保存模板失败", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>另存为模板</DialogTitle>
          <DialogDescription>
            保存当前的全部图层和 {doc.parameters.length} 个参数。模板与作品分开保存，互不影响。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>模板名称</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${doc.name} 模板`} autoFocus />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}保存模板
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
