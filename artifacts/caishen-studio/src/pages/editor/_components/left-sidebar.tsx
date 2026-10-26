import StatusLocationPanel from "./panels/status-location-panel";
import PhonePanel from "./panels/phone-panel";
import { useEditor, type LeftPanel } from "@/stores/editor.ts";
import { cn } from "@/lib/utils.ts";
import { LEFT_TOOLS } from "../_lib/left-tools.ts";
import LayersPanel from "./panels/layers-panel.tsx";
import {
  BackgroundPanel,
  ImagePanel,
  ShapePanel,
  TextPanel,
} from "./panels/add-panels.tsx";
import {
  AssetsPanel,
  CustomTemplatesPanel,
  TemplatesPanel,
} from "./panels/library-panels.tsx";
import ParamsPanel from "./params-panel.tsx";

export function LeftPanelContent({
  panel,
  isTemplate = false,
}: {
  panel: LeftPanel;
  isTemplate?: boolean;
}) {
  switch (panel) {
    case "templates":
      return <TemplatesPanel />;
    case "custom":
      return <CustomTemplatesPanel />;
    case "layers":
      return <LayersPanel />;
    case "text":
      return <TextPanel />;
    case "image":
      return <ImagePanel />;
    case "shape":
      return <ShapePanel />;
    case "background":
      return <BackgroundPanel />;
    case "assets":
      return <AssetsPanel />;
    case "status-location":
      return <StatusLocationPanel isTemplate={isTemplate} />;
    case "phone":
      return isTemplate ? (
        <p className="p-3 text-sm text-muted-foreground">
          模板专注内容；请使用模板进入作图后设置手机效果。
        </p>
      ) : (
        <PhonePanel />
      );
    case "params":
      return <ParamsPanel />;
  }
}

export function ToolRail({
  onPick,
  vertical = true,
  isTemplate = false,
}: {
  isTemplate?: boolean;
  onPick?: (p: LeftPanel) => void;
  vertical?: boolean;
}) {
  const panel = useEditor((s) => s.leftPanel);
  const setPanel = useEditor((s) => s.setLeftPanel);
  return (
    <nav
      className={cn(
        "flex shrink-0 gap-0.5 bg-sidebar",
        vertical
          ? "w-16 flex-col border-r py-2"
          : "overflow-x-auto border-t px-1 py-1",
      )}
    >
      {LEFT_TOOLS.filter((t) => !isTemplate || t.id !== "phone").map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            setPanel(t.id);
            onPick?.(t.id);
          }}
          className={cn(
            "flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] transition-colors",
            vertical ? "mx-1.5" : "min-w-14",
            panel === t.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <t.icon className="size-5" />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export default function LeftSidebar({
  isTemplate = false,
}: {
  isTemplate?: boolean;
}) {
  const panel = useEditor((s) => s.leftPanel);
  const label = LEFT_TOOLS.find((t) => t.id === panel)?.label;
  return (
    <div className="hidden h-full md:flex">
      <ToolRail isTemplate={isTemplate} />
      <aside className="flex w-64 flex-col border-r bg-background">
        <p className="border-b px-4 py-3 text-sm font-semibold">{label}</p>
        <div className="flex-1 overflow-y-auto">
          <LeftPanelContent panel={panel} isTemplate={isTemplate} />
        </div>
      </aside>
    </div>
  );
}
