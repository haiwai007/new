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
    resolveImageUrl({ kind: "asset", assetId: asset.id }).then((u) => alive && setUrl(u)).catch(() => undefined);
    return () => { alive = false; };
  }, [asset.id]);
  return url ? <img src={url} alt={asset.name} className="size-full object-cover" /> : null;
}

type Props = { assets: AssetRecord[]; selected: string[]; multiple: boolean; onChange: (ids: string[]) => void };

/** Grid of library images; single or multi selection. */
export default function AssetPicker({ assets, selected, multiple, onChange }: Props) {
  if (assets.length === 0) {
    return <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">素材库还没有图片。先到「更多 → 素材库」上传图片。</p>;
  }
  const toggle = (id: string) => {
    if (!multiple) return onChange([id]);
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {assets.map((a) => {
        const on = selected.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            title={a.name}
            onClick={() => toggle(a.id)}
            className={cn("relative aspect-square cursor-pointer overflow-hidden rounded-md border-2 bg-muted", on ? "border-primary" : "border-transparent hover:border-primary/40")}
          >
            <AssetThumb asset={a} />
            {on && <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
          </button>
        );
      })}
    </div>
  );
}
