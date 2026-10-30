import AppIconRegionFilter from "@/components/phone/app-icon-region-filter";
import type { TemplateDoc } from "@/types/template";
import PhoneModeSwitch from "./phone-mode-switch";
import PhoneModelPicker from "@/components/phone/model-picker";
import { settingsForModel } from "@/lib/phone/profiles";
import { IconPreview } from "@/components/phone/app-icons-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PHONE_BRANDS, PHONE_MODELS } from "@/lib/phone/models";
import {
  APP_ICONS,
  builtinAppIconSource,
  matchesAppIconRegion,
  type AppIconFilter,
} from "@/lib/phone/app-icon-catalog";
import { uploadAppIcon } from "@/lib/phone/app-icon-upload";
import { deleteAsset } from "@/lib/storage/assets";
import { newId } from "@/lib/template/ids";
import {
  appIconKey,
  minimumAppCapacity,
  type PhoneBatchRules,
} from "@/lib/batch/phone-rules";
import type { PhoneAppIcon } from "@/lib/phone/schema";
const selectClass =
  "h-9 w-full min-w-0 rounded border bg-background px-2 text-xs";
export function ModelOptions({
  value,
  onChange,
}: {
  value: PhoneBatchRules;
  onChange: (v: PhoneBatchRules) => void;
}) {
  const [brand, setBrand] = useState(""),
    [query, setQuery] = useState(""),
    [selecting, setSelecting] = useState(false);
  const settings = value.setup!.settings;
  const models = value.models ?? {
    enabled: false,
    ids: [settings.modelId],
    distribution: "random",
  };
  const choices = PHONE_MODELS.filter(
    (m) =>
      (!brand || m.brand === brand) &&
      `${m.brand} ${m.name} ${m.id}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  return (
    <section className="space-y-3 rounded-lg border p-3">
      <PhoneModeSwitch
        label="手机型号"
        value={models.enabled ? "random" : "fixed"}
        options={[
          { value: "fixed", label: "固定" },
          { value: "random", label: "随机" },
        ]}
        onChange={(mode) => {
          setSelecting(mode === "random");
          onChange({
            ...value,
            models: { ...models, enabled: mode === "random" },
          });
        }}
      />
      {!models.enabled && (
        <PhoneModelPicker
          compact
          value={settings.modelId}
          styleId={settings.styleId}
          onChange={(id) => {
            if (id)
              onChange({
                ...value,
                setup: {
                  ...value.setup!,
                  settings: settingsForModel(settings, id),
                },
              });
          }}
        />
      )}
      {models.enabled && (
        <>
          <p className="break-words text-xs text-muted-foreground">
            已选 {models.ids.length} 个型号：
            {PHONE_MODELS.filter((m) => models.ids.includes(m.id))
              .map((m) => m.name)
              .slice(0, 4)
              .join("、")}
            {models.ids.length > 4 ? "…" : ""}
          </p>
          <details
            open={selecting}
            onToggle={(e) => setSelecting(e.currentTarget.open)}
          >
            <summary className="cursor-pointer text-xs font-medium">
              修改型号选择
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                aria-label="筛选手机品牌"
                className={selectClass}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              >
                <option value="">全部品牌</option>
                {PHONE_BRANDS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
              <Input
                aria-label="搜索随机手机型号"
                placeholder="搜索具体型号"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onChange({
                    ...value,
                    models: {
                      ...models,
                      ids: [
                        ...new Set([
                          ...models.ids,
                          ...choices.map((m) => m.id),
                        ]),
                      ],
                    },
                  })
                }
              >
                全选当前筛选结果
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  onChange({ ...value, models: { ...models, ids: [] } })
                }
              >
                清空型号
              </Button>
            </div>
            <div
              aria-label="随机手机型号候选"
              className="grid max-h-60 grid-cols-1 gap-2 overflow-auto rounded border p-2 sm:grid-cols-2"
            >
              {choices.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    aria-label={`候选型号 ${m.name}`}
                    checked={models.ids.includes(m.id)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        models: {
                          ...models,
                          ids: e.target.checked
                            ? [...models.ids, m.id]
                            : models.ids.filter((id) => id !== m.id),
                        },
                      })
                    }
                  />
                  {m.brand} · {m.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              已选 {models.ids.length}{" "}
              个型号，自动应用对应系统布局；画布宽度与正文尺寸保持不变。
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setSelecting(false)}
            >
              完成型号选择
            </Button>
          </details>
          <select
            aria-label="手机型号分配方式"
            className={selectClass}
            value={models.distribution}
            onChange={(e) =>
              onChange({
                ...value,
                models: {
                  ...models,
                  distribution: e.target.value as "random" | "balanced",
                },
              })
            }
          >
            <option value="random">独立随机（允许连续重复）</option>
            <option value="balanced">均衡分配（数量最多相差一次）</option>
          </select>
        </>
      )}
    </section>
  );
}
export function AppOptions({
  doc,
  value,
  onChange,
  onBusyChange,
}: {
  value: PhoneBatchRules;
  onChange: (v: PhoneBatchRules) => void;
  onBusyChange: (busy: boolean) => void;
  doc?: TemplateDoc;
}) {
  const [region, setRegion] = useState<AppIconFilter>("all");
  const [query, setQuery] = useState(""),
    [selectedOnly, setSelectedOnly] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selecting, setSelecting] = useState(false);
  const [uploaded, setUploaded] = useState<PhoneAppIcon[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const settings = value.setup!.settings;
  const apps = value.apps ?? {
    mode: "fixed",
    fixed: [],
    candidates: [],
    min: 0,
    max: 1,
    order: "list",
  };
  const builtin = useMemo<PhoneAppIcon[]>(
    () =>
      APP_ICONS.map((app) => ({
        id: newId("app"),
        name: app.name,
        kind: "builtin",
        builtinId: app.id,
        visible: true,
      })),
    [],
  );
  const all = [
    ...new Map(
      [
        ...apps.fixed,
        ...apps.candidates,
        ...settings.appIcons,
        ...uploaded,
        ...builtin,
      ].map((i) => [appIconKey(i), i]),
    ).values(),
  ];
  const role = (i: PhoneAppIcon) =>
    apps.fixed.some((a) => appIconKey(a) === appIconKey(i))
      ? "fixed"
      : apps.candidates.some((a) => appIconKey(a) === appIconKey(i))
        ? "candidate"
        : "none";
  const choices = all.filter(
    (i) =>
      `${i.name} ${i.kind === "builtin" ? i.builtinId : ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (!selectedOnly || role(i) !== "none") &&
      matchesAppIconRegion(
        region,
        i.kind === "builtin" ? i.builtinId : undefined,
      ),
  );
  const patch = (next: Partial<NonNullable<PhoneBatchRules["apps"]>>) =>
    onChange({ ...value, apps: { ...apps, ...next } });
  function assign(icon: PhoneAppIcon, to: string) {
    patch({
      fixed: [
        ...apps.fixed.filter((i) => appIconKey(i) !== appIconKey(icon)),
        ...(to === "fixed" ? [icon] : []),
      ],
      candidates: [
        ...apps.candidates.filter((i) => appIconKey(i) !== appIconKey(icon)),
        ...(to === "candidate" ? [icon] : []),
      ],
    });
  }
  function move(key: "fixed" | "candidates", id: string, delta: number) {
    const next = [...apps[key]],
      index = next.findIndex((i) => i.id === id),
      target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ [key]: next });
  }
  const capacity = minimumAppCapacity(value, settings, doc);
  const random = apps.mode === "random";
  const picked = random
    ? apps.candidates
    : apps.mode === "keep"
      ? settings.appIcons.filter((i) => i.visible)
      : apps.fixed;
  function changeMode(mode: "none" | "fixed" | "random") {
    if (mode === "random") {
      patch({
        mode,
        fixed: [],
        candidates: apps.candidates.length ? apps.candidates : apps.fixed,
      });
      setSelecting(true);
    } else if (mode === "fixed") {
      patch({ mode, fixed: apps.fixed.length ? apps.fixed : apps.candidates });
      setSelecting(true);
    } else patch({ mode });
  }
  return (
    <section className="space-y-3 rounded-lg border p-3">
      <PhoneModeSwitch
        label="APP 图标"
        value={apps.mode === "keep" ? "fixed" : apps.mode}
        options={[
          { value: "none", label: "不显示" },
          { value: "fixed", label: "固定" },
          { value: "random", label: "随机" },
        ]}
        onChange={changeMode}
      />
      {apps.mode !== "none" && (
        <>
          <p className="break-words text-xs text-muted-foreground">
            {random ? "候选" : "已选"}：
            {picked.length
              ? picked
                  .slice(0, 5)
                  .map((i) => i.name)
                  .join("、")
              : "未选择图标"}
            {picked.length > 5 ? `…（共 ${picked.length} 个）` : ""}
          </p>
          <details
            open={selecting}
            onToggle={(e) => setSelecting(e.currentTarget.open)}
          >
            <summary className="cursor-pointer text-xs font-medium">
              修改 APP 选择
            </summary>
            <fieldset disabled={busy} className="mt-3 min-w-0 space-y-3">
              <AppIconRegionFilter
                value={region}
                onChange={setRegion}
                includeCustom
                counts={{
                  all: all.length,
                  domestic: all.filter((i) =>
                    matchesAppIconRegion(
                      "domestic",
                      i.kind === "builtin" ? i.builtinId : undefined,
                    ),
                  ).length,
                  international: all.filter((i) =>
                    matchesAppIconRegion(
                      "international",
                      i.kind === "builtin" ? i.builtinId : undefined,
                    ),
                  ).length,
                  custom: all.filter((i) => i.kind !== "builtin").length,
                }}
              />
              <Input
                aria-label="搜索随机 APP 图标"
                placeholder="搜索58同城、唯品会、微信或自定义图标"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedOnly}
                  onChange={(e) => setSelectedOnly(e.target.checked)}
                />
                只看已选
              </label>
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
                {!choices.length && (
                  <p className="col-span-full py-4 text-center text-xs text-muted-foreground">
                    没有找到匹配图标，请尝试其他分类或关键词。
                  </p>
                )}
                {choices.map((icon) => (
                  <label
                    key={appIconKey(icon)}
                    className="flex min-w-0 items-center gap-2 rounded border p-2"
                  >
                    <input
                      type="checkbox"
                      aria-label={`${random ? "候选" : "固定"} APP ${icon.name}`}
                      checked={picked.some(
                        (i) => appIconKey(i) === appIconKey(icon),
                      )}
                      onChange={(e) =>
                        assign(
                          icon,
                          e.target.checked
                            ? random
                              ? "candidate"
                              : "fixed"
                            : "none",
                        )
                      }
                    />
                    <IconPreview
                      source={
                        icon.kind === "builtin"
                          ? builtinAppIconSource(icon.builtinId)
                          : icon.src
                      }
                      name={icon.name}
                      background={settings.backgroundColor}
                    />
                    <span className="min-w-0 truncate text-xs">
                      {icon.name}
                    </span>
                  </label>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={busy || all.length >= 128}
                onClick={() => input.current?.click()}
              >
                上传批量自定义 APP 图标
              </Button>
              <input
                ref={input}
                aria-label="上传批量 APP 图标文件"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || busy) return;
                  setBusy(true);
                  onBusyChange(true);
                  setError("");
                  let id: string | undefined;
                  try {
                    const asset = await uploadAppIcon(file);
                    id = asset.id;
                    if (!alive.current) return;
                    const icon: PhoneAppIcon = {
                      id: newId("app"),
                      kind: "custom",
                      name: asset.name,
                      visible: true,
                      src: { kind: "asset", assetId: asset.id },
                    };
                    setUploaded((previous) => [...previous, icon]);
                    assign(
                      icon,
                      apps.mode === "random" ? "candidate" : "fixed",
                    );
                    id = undefined;
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "上传失败");
                  } finally {
                    if (id) await deleteAsset(id).catch(() => {});
                    if (alive.current) {
                      setBusy(false);
                      onBusyChange(false);
                    }
                  }
                }}
              />

              <p className="text-[11px] text-muted-foreground">
                支持 PNG / JPG / WebP，最大 2MB、1024×1024，推荐透明 PNG。
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setSelecting(false)}
              >
                完成 APP 选择
              </Button>
            </fieldset>
          </details>
          {random && (
            <div className="grid grid-cols-2 gap-2">
              {(["min", "max"] as const).map((key) => (
                <label key={key} className="space-y-1 text-xs">
                  每张{key === "min" ? "最少" : "最多"}图标数
                  <Input
                    aria-label={`随机 APP ${key === "min" ? "最少" : "最多"}数量`}
                    type="number"
                    min={0}
                    max={apps.candidates.length}
                    value={Number.isFinite(apps[key]) ? apps[key] : ""}
                    onChange={(e) =>
                      patch({
                        [key]:
                          e.target.value === "" ? NaN : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {random
              ? `从 ${apps.candidates.length} 个候选中选取，每张不重复。`
              : "每张使用相同图标。"}
            所选型号共同容量 {capacity} 个。
          </p>
          {picked.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs">排列顺序</summary>
              <div className="mt-2 space-y-2">
                {picked.map((icon, index) => (
                  <div
                    key={icon.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{icon.name}</span>
                    <button
                      type="button"
                      disabled={!index}
                      aria-label={`上移批量${icon.name}`}
                      onClick={() =>
                        move(random ? "candidates" : "fixed", icon.id, -1)
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === picked.length - 1}
                      aria-label={`下移批量${icon.name}`}
                      onClick={() =>
                        move(random ? "candidates" : "fixed", icon.id, 1)
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`移除批量${icon.name}`}
                      onClick={() => assign(icon, "none")}
                    >
                      移除
                    </button>
                  </div>
                ))}
                <select
                  aria-label="批量 APP 排列方式"
                  className={selectClass}
                  value={apps.order}
                  onChange={(e) =>
                    patch({ order: e.target.value as "list" | "random" })
                  }
                >
                  <option value="list">按设置顺序</option>
                  <option value="random">随机顺序</option>
                </select>
              </div>
            </details>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
