import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { FileUp, FolderOpen, Layers, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  ErrorState,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import { useWorks } from "@/hooks/use-works.ts";
import { listExports } from "@/lib/storage/works.ts";
import type { ExportRecord } from "@/lib/storage/db.ts";
import { importWorkFile } from "@/lib/storage/template-package.ts";
import WorkCard from "./_components/work-card.tsx";

type Filter =
  "all" | "project" | "template" | "upload" | "favorite" | "exports";

export default function WorksPage() {
  const { state, refresh } = useWorks();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [exportError, setExportError] = useState("");
  const [exports, setExports] = useState<ExportRecord[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const changeFilter = (next: Filter) => {
    setFilter(next);
    if (next !== "exports") return;
    setExports(null);
    setExportError("");
    listExports()
      .then(setExports)
      .catch((e) =>
        setExportError(e instanceof Error ? e.message : "读取导出记录失败"),
      );
  };

  const works = useMemo(() => {
    if (state.status !== "ready") return [];
    const kw = q.trim().toLowerCase();
    return state.works
      .filter((w) =>
        filter === "all"
          ? true
          : filter === "project"
            ? w.kind === "project"
            : filter === "template"
              ? w.kind === "template"
              : filter === "upload"
                ? w.fromUpload
                : filter === "favorite"
                  ? w.favorite
                  : true,
      )
      .filter((w) => !kw || w.name.toLowerCase().includes(kw));
  }, [state, filter, q]);

  const importJson = async (file: File) => {
    try {
      const res = await importWorkFile(file, { kind: "template" });
      const w = res.work;
      toast.success(`已导入模板「${w.name}」`, {
        description: [`包含 ${res.assetCount} 张图片`, ...res.warnings].join(
          "；",
        ),
      });
      refresh();
      navigate(`/editor/${w.id}`);
    } catch (e) {
      toast.error("导入失败", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">我的作品</h1>
          <p className="mt-1 text-muted-foreground">
            作品保存在当前浏览器中，刷新或重新打开浏览器后仍然存在。清除浏览器数据会删除它们。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/batch"><Layers className="size-4" /> 批量做图</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/backup">备份与恢复</Link>
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" /> 导入模板
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs value={filter} onValueChange={(v) => changeFilter(v as Filter)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="project">编辑项目</TabsTrigger>
            <TabsTrigger value="template">自定义模板</TabsTrigger>
            <TabsTrigger value="upload">上传生成</TabsTrigger>
            <TabsTrigger value="favorite">收藏</TabsTrigger>
            <TabsTrigger value="exports">导出记录</TabsTrigger>
          </TabsList>
        </Tabs>
        {filter !== "exports" && (
          <div className="relative md:ml-auto md:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索作品名称"
              className="pl-9"
            />
          </div>
        )}
      </div>

      {filter === "exports" ? (
        exportError ? (
          <p role="alert" className="mt-6 text-destructive">
            {exportError}
          </p>
        ) : (
          <ExportList exports={exports} />
        )
      ) : state.status === "loading" ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5]" />
          ))}
        </div>
      ) : state.status === "error" ? (
        <ErrorState className="mt-10">
          <ErrorStateHeader>
            <ErrorStateTitle>无法读取本地作品</ErrorStateTitle>
            <ErrorStateDescription>
              {state.error}
              。请确认浏览器没有禁用本地存储（隐私/无痕模式可能会限制）。
            </ErrorStateDescription>
          </ErrorStateHeader>
        </ErrorState>
      ) : works.length === 0 ? (
        <Empty className="mt-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen />
            </EmptyMedia>
            <EmptyTitle>
              {state.works.length === 0 ? "还没有作品" : "没有符合条件的作品"}
            </EmptyTitle>
            <EmptyDescription>
              从模板开始，或上传一张参考图生成你的第一个模板。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center gap-2">
            <Button size="sm" asChild>
              <Link to="/templates">浏览模板</Link>
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/custom">上传图片</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {works.map((w) => (
            <WorkCard key={w.id} work={w} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExportList({ exports }: { exports: ExportRecord[] | null }) {
  if (exports === null)
    return (
      <div className="mt-6 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  if (exports.length === 0)
    return (
      <p className="mt-10 text-center text-sm text-muted-foreground">
        还没有导出过图片。
      </p>
    );
  return (
    <div className="mt-6 overflow-hidden rounded-xl border">
      {exports.map((e) => (
        <div
          key={e.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 text-sm last:border-b-0"
        >
          <span className="font-medium">{e.fileName}</span>
          <span className="text-muted-foreground">
            {e.format.toUpperCase()} · {e.width}×{e.height}
          </span>
          <span className="text-muted-foreground">来自「{e.workName}」</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {format(new Date(e.createdAt), "yyyy-MM-dd HH:mm")}
          </span>
          {e.workId && (
            <Link
              to={`/editor/${e.workId}`}
              className="cursor-pointer text-xs text-primary"
            >
              打开作品
            </Link>
          )}
        </div>
      ))}
      <p className="bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        只记录导出信息，图片文件本身已下载到你的设备上。
      </p>
    </div>
  );
}
