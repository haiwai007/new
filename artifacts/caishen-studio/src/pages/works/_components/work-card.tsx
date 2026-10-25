import { MAX_WORK_NAME } from "@/lib/storage/names";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Copy,
  Download,
  Heart,
  History,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import type { WorkRecord } from "@/lib/storage/db.ts";
import { deleteWork, duplicateWork, patchWork } from "@/lib/storage/works.ts";
import { startFromDoc } from "@/lib/template/start.ts";
import { cn } from "@/lib/utils.ts";
import VersionsDialog from "@/components/templates/versions-dialog.tsx";
import {
  downloadFile,
  exportTemplatePackage,
} from "@/lib/storage/template-package.ts";
import { sanitizeFileName } from "@/pages/editor/_lib/export.ts";

export default function WorkCard({
  work,
  onChanged,
}: {
  work: WorkRecord;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(work.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const exportJson = async () => {
    try {
      const { blob, assetCount, missing } = await exportTemplatePackage(
        work.doc,
      );
      downloadFile(blob, `${sanitizeFileName(work.name)}.haishen.json`);
      toast.success("已导出模板文件", {
        description: `包含 ${assetCount} 张图片${missing ? `，${missing} 张本地图片已丢失未包含` : ""}。可在任意浏览器的「我的作品 → 导入模板」中打开。`,
      });
    } catch (e) {
      toast.error("导出失败", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <Link
        aria-label={`打开作品 ${work.name}`}
        to={`/editor/${work.id}`}
        className="relative flex aspect-[4/5] cursor-pointer items-center justify-center bg-muted"
      >
        {work.thumbnail ? (
          <img
            src={work.thumbnail}
            alt={work.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-xs text-muted-foreground">无预览</span>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {work.kind === "template" && (
            <Badge className="text-[10px]">模板</Badge>
          )}
          {work.fromUpload && (
            <Badge variant="secondary" className="text-[10px]">
              上传生成
            </Badge>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start gap-1">
          {renaming ? (
            <Input
              autoFocus
              maxLength={MAX_WORK_NAME} value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setRenaming(false);
                if (name.trim() && name !== work.name)
                  void run(() => patchWork(work.id, { name: name.trim() }));
                else setName(work.name);
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
              className="h-7 text-sm"
            />
          ) : (
            <p
              className="min-w-0 flex-1 truncate font-medium"
              title={work.name}
            >
              {work.name}
            </p>
          )}
          <button
            type="button"
            className="cursor-pointer p-1 text-muted-foreground hover:text-primary"
            aria-label="收藏"
            onClick={() =>
              run(() => patchWork(work.id, { favorite: !work.favorite }))
            }
          >
            <Heart
              className={cn(
                "size-4",
                work.favorite && "fill-primary text-primary",
              )}
            />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="cursor-pointer p-1 text-muted-foreground hover:text-foreground"
                aria-label="更多操作"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/editor/${work.id}`)}>
                <Pencil className="size-4" />
                继续编辑
              </DropdownMenuItem>
              {work.kind === "template" && (
                <DropdownMenuItem
                  onClick={() =>
                    run(async () =>
                      navigate(
                        `/editor/${await startFromDoc(work.doc, work.name, work.id)}`,
                      ),
                    )
                  }
                >
                  <Play className="size-4" />
                  用此模板新建作品
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <Pencil className="size-4" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => run(() => duplicateWork(work.id), "已复制")}
              >
                <Copy className="size-4" />
                复制
              </DropdownMenuItem>
              {work.kind === "project" && (
                <DropdownMenuItem
                  onClick={() =>
                    run(
                      () => duplicateWork(work.id, "template"),
                      "已另存为模板",
                    )
                  }
                >
                  <LayoutTemplate className="size-4" />
                  另存为模板
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setVersionsOpen(true)}>
                <History className="size-4" />
                历史版本
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportJson()}>
                <Download className="size-4" />
                导出模板文件
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {work.doc.canvas.width}×{work.doc.canvas.height} · v{work.version} ·{" "}
          {format(new Date(work.updatedAt), "yyyy-MM-dd HH:mm")}
        </p>
        <Button size="sm" variant="secondary" className="mt-2" asChild>
          <Link to={`/editor/${work.id}`}>继续编辑</Link>
        </Button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除「{work.name}」？</DialogTitle>
            <DialogDescription>
              作品及其全部历史版本会被永久删除，无法恢复。由它创建的其他作品不受影响。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => run(() => deleteWork(work.id), "已删除")}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <VersionsDialog
        workId={work.id}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestored={onChanged}
      />
    </div>
  );
}
