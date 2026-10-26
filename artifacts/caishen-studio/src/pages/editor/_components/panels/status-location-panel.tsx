import { applyLocationToWork } from "@/lib/status-location/apply";
import StatusLocationControl from "@/components/phone/status-location-control";
import { edit, useEditor } from "@/stores/editor";
export default function StatusLocationPanel({
  isTemplate = false,
}: {
  isTemplate?: boolean;
}) {
  const doc = useEditor((s) => s.doc);
  if (!doc) return null;
  return (
    <div className="space-y-3 p-3">
      <StatusLocationControl
        doc={doc}
        onChange={(statusLocation) =>
          edit((current) =>
            isTemplate
              ? { ...current, statusLocation }
              : applyLocationToWork(current, statusLocation),
          )
        }
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        这里只保存原状态栏位置和保护区，不设置型号、时间或随机规则。定位随模板、历史版本和备份保存；修改定位可撤销。
      </p>
    </div>
  );
}
