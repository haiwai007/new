import { proposeStatusLocation } from "@/lib/status-location/engine";
import { defaultStatusLocation } from "@/lib/status-location/model";
import ManualReferenceNotice from "./_components/manual-reference-notice";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import { getWork } from "@/lib/storage/works.ts";
import { loadTemplateDoc } from "@/lib/template/migrate.ts";
import { imageFromClipboard } from "@/lib/image/import.ts";
import { useEditor } from "@/stores/editor.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import TopBar from "./_components/top-bar.tsx";
import LeftSidebar, {
  LeftPanelContent,
  ToolRail,
} from "./_components/left-sidebar.tsx";
import { LEFT_TOOLS } from "./_lib/left-tools.ts";
import CanvasStage, { type StageApi } from "./_components/canvas-stage.tsx";
import PropertiesPanel from "./_components/properties-panel.tsx";
import ParamsPanel from "./_components/params-panel.tsx";
import { useAutosave } from "./_hooks/use-autosave.ts";
import { useEditorShortcuts } from "./_hooks/use-editor-shortcuts.ts";
import { addImageFromFile } from "./_lib/actions.ts";
import EditorOcrDialog from "./_components/ocr-dialog.tsx";
import RepairDialog from "./_components/repair-dialog.tsx";
import VersionsDialog from "@/components/templates/versions-dialog.tsx";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; isTemplate: boolean };

function RightPanel() {
  const tab = useEditor((s) => s.rightTab);
  const setTab = useEditor((s) => s.setRightTab);
  const count = useEditor((s) => s.doc?.parameters.length ?? 0);
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as "props" | "params")}
      className="flex h-full flex-col gap-0"
    >
      <TabsList className="m-2 grid w-auto grid-cols-2">
        <TabsTrigger value="props">属性</TabsTrigger>
        <TabsTrigger value="params">
          模板参数
          {count > 0 && (
            <span className="ml-1 text-[10px] text-primary">{count}</span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="props" className="flex-1 overflow-y-auto">
        <PropertiesPanel />
      </TabsContent>
      <TabsContent value="params" className="flex-1 overflow-y-auto">
        <ParamsPanel />
      </TabsContent>
    </Tabs>
  );
}

export default function EditorPage() {
  const { workId } = useParams();
  // Remount per work so load state starts fresh.
  return <EditorInner key={workId} workId={workId} />;
}

function EditorInner({ workId }: { workId: string | undefined }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [warnings, setWarnings] = useState<string[]>([]);
  // Bumped after a version restore to re-read the work from storage.
  const [reloadKey, setReloadKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const stageApi = useRef<StageApi | null>(null);
  const isMobile = useIsMobile();
  const [drawer, setDrawer] = useState<null | "tools" | "props">(null);
  const leftPanel = useEditor((s) => s.leftPanel);
  const dirty = useEditor(
    (s) => s.saveStatus === "dirty" || s.saveStatus === "error",
  );
  const { saveNow } = useAutosave();
  const onSave = useCallback(() => void saveNow(), [saveNow]);
  useEditorShortcuts(onSave);

  // Flush unsaved edits into their own version so a restore never loses work.
  const beforeRestore = useCallback(async () => {
    const s = useEditor.getState().saveStatus;
    if (s !== "dirty" && s !== "error") return true;
    return saveNow({ silent: true });
  }, [saveNow]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!workId) throw new Error("缺少作品编号");
      const work = await getWork(workId);
      if (!work)
        throw new Error("作品不存在，可能已被删除或保存在其他浏览器中");
      const res = loadTemplateDoc(work.doc);
      if (!res.ok) throw new Error(res.error);
      if (!alive) return;
      useEditor.getState().load(work.id, res.doc, work.revision ?? 0);
      setWarnings(res.warnings);
      setState({ status: "ready", isTemplate: work.kind === "template" });
    };
    load().catch(
      (e: unknown) =>
        alive &&
        setState({
          status: "error",
          error: e instanceof Error ? e.message : "加载失败",
        }),
    );
    return () => {
      alive = false;
    };
  }, [workId, reloadKey]);

  useEffect(() => {
    if (state.status !== "ready" || !state.isTemplate) return;
    const current = useEditor.getState().doc;
    if (!current?.source) return;
    if (current.statusLocation) {
      if (current.statusLocation.state === "pending")
        useEditor.getState().setLeftPanel("status-location");
      return;
    }
    let active = true;
    void proposeStatusLocation(current)
      .catch(() => null)
      .then((candidate) => {
        if (!active || useEditor.getState().doc !== current) return;
        useEditor
          .getState()
          .commit({
            ...current,
            statusLocation: candidate ?? defaultStatusLocation(current),
          });
        useEditor.getState().setLeftPanel("status-location");
      });
    return () => {
      active = false;
    };
  }, [
    state.status,
    state.status === "ready" ? state.isTemplate : false,
    workId,
    reloadKey,
  ]);

  useEffect(() => () => useEditor.getState().reset(), []);

  // Paste or drop image files onto the editor.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)
        return;
      const f = imageFromClipboard(e);
      if (f) {
        e.preventDefault();
        void addImageFromFile(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const onDrop = (e: React.DragEvent): void => {
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    e.preventDefault();
    if (!f.type.startsWith("image/")) {
      toast.error("只能拖入图片文件");
      return;
    }
    void addImageFromFile(f);
  };

  // Open the properties drawer on mobile when something is selected.
  const hasSel = useEditor((s) => s.selectedIds.length > 0);

  if (state.status === "loading") {
    return (
      <div className="flex h-screen flex-col">
        <Skeleton className="h-14 w-full rounded-none" />
        <div className="flex flex-1 gap-4 p-4">
          <Skeleton className="hidden w-72 md:block" />
          <Skeleton className="flex-1" />
          <Skeleton className="hidden w-72 md:block" />
        </div>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon">
              <AlertTriangle />
            </ErrorStateMedia>
            <ErrorStateTitle>无法打开作品</ErrorStateTitle>
            <ErrorStateDescription>{state.error}</ErrorStateDescription>
          </ErrorStateHeader>
          <ErrorStateContent className="flex-row gap-2">
            <Button size="sm" asChild>
              <Link to="/works">我的作品</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/">返回首页</Link>
            </Button>
          </ErrorStateContent>
        </ErrorState>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <TopBar
        onSave={onSave}
        onFit={() => stageApi.current?.fit()}
        isTemplate={state.isTemplate}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <ManualReferenceNotice />
      {workId && (
        <VersionsDialog
          workId={workId}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          unsavedWarning={dirty}
          beforeRestore={beforeRestore}
          onRestored={() => setReloadKey((k) => k + 1)}
        />
      )}
      {warnings.length > 0 && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-1.5 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          <AlertTriangle className="size-3.5" /> {warnings.join("；")}
          <button
            type="button"
            className="ml-auto cursor-pointer"
            onClick={() => setWarnings([])}
            aria-label="关闭"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <LeftSidebar isTemplate={state.isTemplate} />
        <div
          className="relative flex min-w-0 flex-1 flex-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <CanvasStage onReady={(api) => (stageApi.current = api)} />
          <EditorOcrDialog />
          <RepairDialog />
        </div>
        <aside className="hidden w-72 shrink-0 border-l bg-background md:block">
          <RightPanel />
        </aside>
      </div>

      {isMobile && (
        <>
          <div className="flex items-stretch md:hidden">
            <div className="min-w-0 flex-1">
              <ToolRail
                isTemplate={state.isTemplate}
                vertical={false}
                onPick={() => setDrawer("tools")}
              />
            </div>
            <button
              type="button"
              onClick={() => setDrawer("props")}
              className={`flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 border-l border-t px-3 text-[11px] ${hasSel ? "text-primary" : "text-muted-foreground"}`}
            >
              <SlidersHorizontal className="size-5" />
              属性
            </button>
          </div>
          <Drawer
            open={drawer !== null}
            onOpenChange={(o) => !o && setDrawer(null)}
          >
            <DrawerContent className="max-h-[70vh]">
              <DrawerHeader className="py-2">
                <DrawerTitle className="text-sm">
                  {drawer === "props"
                    ? "属性与参数"
                    : LEFT_TOOLS.find((t) => t.id === leftPanel)?.label}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto pb-6">
                {drawer === "props" ? (
                  <RightPanel />
                ) : (
                  <LeftPanelContent
                    panel={leftPanel}
                    isTemplate={state.isTemplate}
                  />
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}
    </div>
  );
}
