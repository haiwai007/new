import AppIconRegionFilter from "./app-icon-region-filter";
import { naturalAppCapacity } from "@/lib/phone/fusion-metrics";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  APP_ICONS,
  matchesAppIconRegion,
  type AppIconFilter,
  MAX_APP_ICONS,
  builtinAppIconSource,
} from "@/lib/phone/app-icon-catalog";
import { uploadAppIcon } from "@/lib/phone/app-icon-upload";
import { deleteAsset, resolveImageUrl } from "@/lib/storage/assets";
import { newId } from "@/lib/template/ids";
import type { PhoneAppIcon, PhoneSettings } from "@/lib/phone/schema";
import type { ImageSource } from "@/types/template";
export function IconPreview({
  source,
  name,
  background,
}: {
  source: ImageSource;
  name: string;
  background: string;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const key = source.kind === "asset" ? source.assetId : source.url;
  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUrl("");
    resolveImageUrl(source)
      .then((url) => {
        if (alive) setUrl(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded border p-1"
      style={{ backgroundColor: background }}
    >
      {failed ? (
        <span className="text-xs text-destructive">丢失</span>
      ) : url ? (
        <img
          alt={`${name}图标`}
          src={url}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <span className="text-xs">…</span>
      )}
    </span>
  );
}
export default function AppIconsEditor({
  settings,
  onChange,
  scopeKey,
  disabled = false,
  capacity,
  onBusyChange,
}: {
  settings: PhoneSettings;
  onChange: (settings: PhoneSettings) => boolean | void;
  scopeKey: string;
  disabled?: boolean;
  capacity?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<AppIconFilter>("all");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const latest = useRef({ settings, onChange, scopeKey });
  latest.current = { settings, onChange, scopeKey };
  useEffect(() => {
    alive.current = true;
    onBusyChange?.(false);
    return () => {
      alive.current = false;
      onBusyChange?.(false);
    };
  }, [onBusyChange]);
  const limit =
    capacity ??
    (settings.rendering === "natural"
      ? naturalAppCapacity(settings)
      : MAX_APP_ICONS);
  const background = settings.backgroundColor;
  const keyword = query.trim().toLowerCase();
  const choices = APP_ICONS.filter(
    (app) =>
      matchesAppIconRegion(region, app.id) &&
      (app.name.toLowerCase().includes(keyword) || app.id.includes(keyword)),
  );
  function change(next: PhoneSettings) {
    setError("");
    try {
      if (onChange(next) === false)
        throw new Error("无法应用图标，请检查状态栏设置");
    } catch (error) {
      setError(error instanceof Error ? error.message : "修改失败");
    }
  }
  function move(id: string, delta: number) {
    const icons = [...settings.appIcons];
    const index = icons.findIndex((icon) => icon.id === id),
      target = index + delta;
    if (target < 0 || target >= icons.length) return;
    [icons[index], icons[target]] = [icons[target], icons[index]];
    change({ ...settings, appIcons: icons });
  }
  async function upload(file: File) {
    if (busy) return;
    const scope = scopeKey;
    let assetId: string | undefined;
    let attached = false;
    setError("");
    setBusy(true);
    onBusyChange?.(true);
    try {
      const asset = await uploadAppIcon(file);
      assetId = asset.id;
      if (!alive.current || latest.current.scopeKey !== scope) return;
      const current = latest.current;
      if (
        current.settings.appIcons.length >=
        (current.settings.rendering === "natural"
          ? naturalAppCapacity(current.settings)
          : MAX_APP_ICONS)
      )
        throw new Error(`最多添加 ${MAX_APP_ICONS} 个 APP 图标，请先移除一个`);
      const icon: PhoneAppIcon = {
        id: newId("app"),
        name: asset.name,
        kind: "custom",
        src: { kind: "asset", assetId: asset.id },
        visible: true,
      };
      if (
        current.onChange({
          ...current.settings,
          appIcons: [...current.settings.appIcons, icon],
        }) === false
      )
        throw new Error("无法应用图标，请检查状态栏设置");
      attached = true;
    } catch (error) {
      if (alive.current && latest.current.scopeKey === scope)
        setError(error instanceof Error ? error.message : "上传失败");
    } finally {
      if (assetId && !attached) await deleteAsset(assetId).catch(() => {});
      if (alive.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }
  return (
    <section className="space-y-3 rounded-lg border p-3">
      <h3 className="text-sm font-semibold">APP 通知图标</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        显示在时间旁，当前机型最多 {limit} 个。
        {settings.rendering === "natural"
          ? "空间不足时请调整大小或数量。"
          : "旧版布局空间不足时自动缩小。"}
        内置 {APP_ICONS.length} 种图标保留品牌配色，自定义图标保留上传颜色。
      </p>
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        <AppIconRegionFilter
          value={region}
          onChange={setRegion}
          counts={{
            all: APP_ICONS.length,
            domestic: APP_ICONS.filter((app) => app.region === "domestic")
              .length,
            international: APP_ICONS.filter(
              (app) => app.region === "international",
            ).length,
          }}
        />
        <Input
          aria-label="搜索 APP 图标"
          placeholder="搜索 APP，如小红书、QQ、WhatsApp"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          内置 {APP_ICONS.length} 种 · 已选 {settings.appIcons.length}/{limit}
        </p>
        <div
          role="group"
          aria-label="内置 APP 图标"
          className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1"
        >
          {!choices.length && (
            <p className="col-span-full py-4 text-center text-xs text-muted-foreground">
              没有找到匹配图标，请尝试其他分类或关键词。
            </p>
          )}
          {choices.map((app) => {
            const selected = settings.appIcons.some(
              (icon) => icon.kind === "builtin" && icon.builtinId === app.id,
            );
            return (
              <Button
                key={app.id}
                type="button"
                variant={selected ? "secondary" : "outline"}
                size="sm"
                className="h-auto min-h-10 w-full min-w-0 justify-start overflow-hidden px-2 text-xs"
                aria-label={`${selected ? "移除" : "添加"}${app.name}图标`}
                aria-pressed={selected}
                disabled={!selected && settings.appIcons.length >= limit}
                onClick={() =>
                  change({
                    ...settings,
                    appIcons: selected
                      ? settings.appIcons.filter(
                          (icon) =>
                            !(
                              icon.kind === "builtin" &&
                              icon.builtinId === app.id
                            ),
                        )
                      : [
                          ...settings.appIcons,
                          {
                            id: newId("app"),
                            kind: "builtin",
                            builtinId: app.id,
                            name: app.name,
                            visible: true,
                          },
                        ],
                  })
                }
              >
                <img
                  src={builtinAppIconSource(app.id).url}
                  alt=""
                  className="size-4 shrink-0"
                />
                <span className="min-w-0 truncate">{app.name}</span>
              </Button>
            );
          })}
        </div>
        {choices.length === 0 && (
          <p className="text-xs text-muted-foreground">
            未找到匹配的 APP，可上传自定义图标。
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          disabled={busy || settings.appIcons.length >= limit}
          onClick={() => input.current?.click()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          上传自定义 APP 图标
        </Button>
        <input
          ref={input}
          aria-label="上传 APP 图标文件"
          className="hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy || settings.appIcons.length >= limit}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          PNG / JPG / WebP，最大 2MB、1024×1024；推荐透明
          PNG。图片仅存于当前浏览器，会随模板和备份携带。
        </p>
        {
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs">
                图标大小
                <Input
                  aria-label="APP 图标大小"
                  type="number"
                  min={8}
                  max={20}
                  step={1}
                  value={settings.appIconSize}
                  onChange={(e) =>
                    change({
                      ...settings,
                      appIconSize: Math.max(
                        8,
                        Math.min(20, Math.round(Number(e.target.value) || 8)),
                      ),
                    })
                  }
                />
              </label>
              <label className="space-y-1 text-xs">
                图标间距
                <Input
                  aria-label="APP 图标间距"
                  type="number"
                  min={1}
                  max={8}
                  step={1}
                  value={settings.appIconGap}
                  onChange={(e) =>
                    change({
                      ...settings,
                      appIconGap: Math.max(
                        1,
                        Math.min(8, Math.round(Number(e.target.value) || 1)),
                      ),
                    })
                  }
                />
              </label>
            </div>
            <ol aria-label="已选 APP 图标" className="space-y-2">
              {settings.appIcons.map((icon, index) => (
                <li
                  key={icon.id}
                  className="flex min-w-0 flex-wrap items-center gap-1.5 rounded border p-2"
                >
                  <IconPreview
                    source={
                      icon.kind === "builtin"
                        ? builtinAppIconSource(icon.builtinId)
                        : icon.src
                    }
                    name={icon.name}
                    background={background}
                  />
                  <span
                    className="min-w-0 flex-1 truncate text-xs"
                    title={icon.name}
                  >
                    {icon.name}
                  </span>
                  <Switch
                    aria-label={`显示${icon.name}图标`}
                    checked={icon.visible}
                    onCheckedChange={(visible) =>
                      change({
                        ...settings,
                        appIcons: settings.appIcons.map((item) =>
                          item.id === icon.id ? { ...item, visible } : item,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`上移${icon.name}图标`}
                    disabled={index === 0}
                    onClick={() => move(icon.id, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`下移${icon.name}图标`}
                    disabled={index === settings.appIcons.length - 1}
                    onClick={() => move(icon.id, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`删除${icon.name}图标`}
                    onClick={() =>
                      change({
                        ...settings,
                        appIcons: settings.appIcons.filter(
                          (item) => item.id !== icon.id,
                        ),
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ol>
          </>
        }
      </fieldset>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
