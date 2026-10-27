import { toast } from "sonner";
import { storeImageFile } from "@/pages/editor/_lib/actions";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { AssetRecord } from "@/lib/storage/db.ts";
import { resolveImageUrl } from "@/lib/storage/assets.ts";

function AssetThumb({ asset }: { asset: AssetRecord }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    // Shared cache: URLs are owned by the asset store, so no revoke here.
    resolveImageUrl({ kind: "asset", assetId: asset.id })
      .then((u) => alive && setUrl(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [asset.id]);
  return url ? (
    <img src={url} alt={asset.name} className="size-full object-cover" />
  ) : null;
}

type Props = {
  assets: AssetRecord[];
  selected: string[];
  multiple: boolean;
  onChange: (ids: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
  onAssetsAdded?: (assets: AssetRecord[]) => void;
};

/** Grid of library images; single or multi selection. */
export default function AssetPicker({
  assets,
  selected,
  multiple,
  onChange,
  onBusyChange,
  onAssetsAdded,
}: Props) {
  const [uploaded, setUploaded] = useState<AssetRecord[]>([]),
    [busy, setBusy] = useState(false);
  const all = [
    ...new Map([...assets, ...uploaded].map((a) => [a.id, a])).values(),
  ];
  const toggle = (id: string) =>
    multiple
      ? onChange(
          selected.includes(id)
            ? selected.filter((x) => x !== id)
            : [...selected, id],
        )
      : onChange([id]);
  return (
    <div className="space-y-2">
      <label className="block text-xs">
        {multiple ? "上传候选图片（可多选）" : "上传固定图片"}
        <input
          type="file"
          className="mt-1 max-w-full text-xs"
          aria-label="上传批量参数图片"
          accept="image/png,image/jpeg,image/webp"
          multiple={multiple}
          disabled={busy}
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 200);
            e.target.value = "";
            if (!files.length) return;
            setBusy(true);
            onBusyChange?.(true);
            const added: AssetRecord[] = [];
            try {
              for (const file of files)
                try {
                  added.push(await storeImageFile(file));
                } catch (error) {
                  toast.error(
                    `${file.name}：${error instanceof Error ? error.message : "上传失败"}`,
                  );
                }
              setUploaded((old) => [...old, ...added]);
              onAssetsAdded?.(added);
              if (added.length)
                onChange(
                  multiple
                    ? [...selected, ...added.map((a) => a.id)]
                    : [added[0].id],
                );
            } finally {
              setBusy(false);
              onBusyChange?.(false);
            }
          }}
        />
      </label>
      {!all.length && (
        <p className="rounded border border-dashed p-2 text-xs text-muted-foreground">
          上传图片，或从素材库中选择。
        </p>
      )}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {all.map((a) => {
          const index = selected.indexOf(a.id);
          return (
            <button
              key={a.id}
              type="button"
              title={a.name}
              aria-label={`选择图片${a.name}`}
              disabled={busy}
              onClick={() => toggle(a.id)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border-2",
                index >= 0
                  ? "border-primary"
                  : "border-transparent hover:border-primary/40",
              )}
            >
              <AssetThumb asset={a} />
              {index >= 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {multiple ? index + 1 : <Check className="size-3" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {multiple && selected.length > 0 && (
        <div className="space-y-1">
          {selected.map((id, i) => {
            const asset = all.find((a) => a.id === id);
            return (
              <div key={id} className="flex items-center gap-1 text-xs">
                <span className="min-w-0 flex-1 truncate">
                  {i + 1}. {asset?.name ?? "已选图片"}
                </span>
                <button
                  disabled={i === 0 || busy}
                  aria-label={`上移图片${asset?.name ?? i}`}
                  onClick={() => {
                    const next = [...selected];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    onChange(next);
                  }}
                >
                  ↑
                </button>
                <button
                  disabled={i === selected.length - 1 || busy}
                  aria-label={`下移图片${asset?.name ?? i}`}
                  onClick={() => {
                    const next = [...selected];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    onChange(next);
                  }}
                >
                  ↓
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
