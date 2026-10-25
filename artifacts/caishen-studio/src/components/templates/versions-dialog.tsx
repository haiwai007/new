import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Copy, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import type { VersionRecord } from "@/lib/storage/db.ts";
import { deleteVersion, listVersions, restoreVersion, updateVersionNote, versionToNewWork } from "@/lib/storage/works.ts";
import { describeDiff, diffDocs } from "@/lib/template/version-diff.ts";
import { cn } from "@/lib/utils.ts";

const REASON_LABEL: Record<NonNullable<VersionRecord["reason"]>, string> = {
  create: "创建",
  save: "手动保存",
  restore: "恢复",
  import: "导入",
};

export default function VersionsDialog(props: {
  workId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Called after a restore with the restored work's id. */
  onRestored: () => void;
  /** Shown above the list when there are unsaved edits (editor only). */
  unsavedWarning?: boolean;
  /** Runs before a restore (editor: flush unsaved edits into a version). Return false to abort. */
  beforeRestore?: () => Promise<boolean>;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>历史版本</DialogTitle>
          <DialogDescription>
            每次点击「保存」都会创建一个版本，最多保留 30 个，加了备注的版本会优先保留。自动保存不创建新版本。恢复旧版本会生成一个新版本，不会删除任何历史。
          </DialogDescription>
        </DialogHeader>
        {props.unsavedWarning && (
          <p className="rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
            当前有尚未保存为版本的修改。恢复旧版本前，这些修改会先自动保存为一个新版本，不会丢失。
          </p>
        )}
        {props.open && <VersionList {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function VersionList({
  workId,
  onOpenChange,
  onRestored,
  beforeRestore,
}: {
  workId: string;
  onOpenChange: (o: boolean) => void;
  onRestored: () => void;
  beforeRestore?: () => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const [versions, setVersions] = useState<VersionRecord[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    listVersions(workId)
      .then((list) => {
        setVersions(list);
        setSelectedId((cur) => (cur && list.some((v) => v.id === cur) ? cur : (list[0]?.id ?? null)));
      })
      .catch(() => setVersions([]));
  }, [workId]);
  useEffect(reload, [reload]);

  const selected = versions?.find((v) => v.id === selectedId) ?? null;
  const latest = versions?.[0] ?? null;
  const changes = useMemo(() => {
    if (!versions || !selected) return [];
    const idx = versions.indexOf(selected);
    const older = versions[idx + 1];
    return older ? describeDiff(diffDocs(older.doc, selected.doc)) : [];
  }, [versions, selected]);
  const vsLatest = useMemo(
    () => (selected && latest && selected !== latest ? describeDiff(diffDocs(selected.doc, latest.doc)) : []),
    [selected, latest],
  );

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const restore = (v: VersionRecord) =>
    act(async () => {
      if (beforeRestore && !(await beforeRestore())) return;
      const w = await restoreVersion(workId, v.id);
      toast.success(`已恢复到 v${v.version}，并保存为新版本 v${w.version}`);
      onRestored();
      onOpenChange(false);
    });

  const copyOut = (v: VersionRecord) =>
    act(async () => {
      const w = await versionToNewWork(workId, v.id);
      toast.success(`已把 v${v.version} 复制为新作品「${w.name}」`);
      onOpenChange(false);
      navigate(`/editor/${w.id}`);
    });

  const remove = (v: VersionRecord) =>
    act(async () => {
      await deleteVersion(workId, v.id);
      toast.success(`已删除 v${v.version}`);
      reload();
    });

  if (versions === null) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  }
  if (versions.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">暂无历史版本</p>;

  return (
    <div className="grid min-h-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1 md:max-h-[60vh]">
        {versions.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setSelectedId(v.id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/60",
              v.id === selectedId && "border-primary bg-primary/5",
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
              {v.thumbnail ? <img src={v.thumbnail} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[9px] text-muted-foreground">无</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                v{v.version}
                {i === 0 && <Badge className="h-4 px-1 text-[10px]">当前</Badge>}
                {v.reason && <span className="text-[10px] font-normal text-muted-foreground">{REASON_LABEL[v.reason]}</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{v.note || format(new Date(v.createdAt), "yyyy-MM-dd HH:mm:ss")}</p>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <VersionDetail
          key={selected.id}
          version={selected}
          isLatest={selected === latest}
          changes={changes}
          vsLatest={vsLatest}
          busy={busy}
          onRestore={() => restore(selected)}
          onCopy={() => copyOut(selected)}
          onDelete={() => remove(selected)}
          onNoteSaved={reload}
        />
      )}
    </div>
  );
}

function VersionDetail(props: {
  version: VersionRecord;
  isLatest: boolean;
  changes: string[];
  vsLatest: string[];
  busy: boolean;
  onRestore: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onNoteSaved: () => void;
}) {
  const { version: v } = props;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(v.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveNote = async () => {
    try {
      await updateVersionNote(v.id, note);
      setEditing(false);
      props.onNoteSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "备注保存失败");
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded bg-muted">
        {v.thumbnail ? <img src={v.thumbnail} alt={`v${v.version} 预览`} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">这个版本没有保存预览图</span>}
      </div>
      <div className="text-xs text-muted-foreground">
        v{v.version} · {v.name} · {v.doc.canvas.width}×{v.doc.canvas.height} · {v.doc.layers.length} 个图层 · {v.doc.parameters.length} 个参数
        <br />
        {format(new Date(v.createdAt), "yyyy-MM-dd HH:mm:ss")}
      </div>
      {editing ? (
        <div className="flex gap-2">
          <Input autoFocus value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void saveNote()} placeholder="例如：客户确认稿" className="h-8 text-sm" />
          <Button size="sm" onClick={saveNote}>保存</Button>
        </div>
      ) : (
        <button type="button" className="flex cursor-pointer items-center gap-1 text-left text-sm hover:text-primary" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5 shrink-0" />
          {v.note ? <span className="truncate">{v.note}</span> : <span className="text-muted-foreground">添加备注</span>}
        </button>
      )}
      <div className="space-y-1 text-xs">
        <p className="font-medium">这个版本的改动</p>
        {props.changes.length ? props.changes.map((c) => <p key={c} className="text-muted-foreground">· {c}</p>) : <p className="text-muted-foreground">最早的版本，或与上一版相同</p>}
      </div>
      {!props.isLatest && (
        <div className="space-y-1 text-xs">
          <p className="font-medium">与当前版本相比</p>
          {props.vsLatest.length ? props.vsLatest.map((c) => <p key={c} className="text-muted-foreground">· {c}</p>) : <p className="text-muted-foreground">内容相同</p>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {!props.isLatest && (
          <Button size="sm" disabled={props.busy} onClick={props.onRestore}><RotateCcw className="size-4" /> 恢复此版本</Button>
        )}
        <Button size="sm" variant="secondary" disabled={props.busy} onClick={props.onCopy}><Copy className="size-4" /> 复制为新作品</Button>
        {!props.isLatest && (
          confirmDelete ? (
            <Button size="sm" variant="destructive" disabled={props.busy} onClick={props.onDelete}>确认删除</Button>
          ) : (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> 删除</Button>
          )
        )}
      </div>
    </div>
  );
}
