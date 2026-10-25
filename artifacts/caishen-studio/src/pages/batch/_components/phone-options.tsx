import { IconPreview } from "@/components/phone/app-icons-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PHONE_BRANDS, PHONE_MODELS } from "@/lib/phone/models";
import { APP_ICONS, builtinAppIconSource } from "@/lib/phone/app-icon-catalog";
import { uploadAppIcon } from "@/lib/phone/app-icon-upload";
import { deleteAsset } from "@/lib/storage/assets";
import { newId } from "@/lib/template/ids";
import {
  appIconKey,
  minimumAppCapacity,
  type PhoneBatchRules,
} from "@/lib/batch/phone-rules";
import { phoneColor } from "@/lib/phone/layers";
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
    [query, setQuery] = useState("");
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
      <h3 className="text-sm font-semibold">批量手机型号</h3>
      <select
        aria-label="手机型号模式"
        className={selectClass}
        value={models.enabled ? "random" : "fixed"}
        onChange={(e) =>
          onChange({
            ...value,
            models: { ...models, enabled: e.target.value === "random" },
          })
        }
      >
        <option value="fixed">使用固定型号</option>
        <option value="random">从指定型号中随机</option>
      </select>
      {models.enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
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
                      ...new Set([...models.ids, ...choices.map((m) => m.id)]),
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
  value,
  onChange,
  onBusyChange,
}: {
  value: PhoneBatchRules;
  onChange: (v: PhoneBatchRules) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [query, setQuery] = useState(""),
    [selectedOnly, setSelectedOnly] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
    mode: "keep",
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
      [...apps.fixed, ...apps.candidates, ...settings.appIcons, ...builtin].map(
        (i) => [appIconKey(i), i],
      ),
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
      (!selectedOnly || role(i) !== "none"),
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
  const capacity = minimumAppCapacity(value, settings);
  return (
    <section className="space-y-3 rounded-lg border p-3">
      <h3 className="text-sm font-semibold">批量 APP 通知图标</h3>
      <select
        aria-label="APP 图标模式"
        className={selectClass}
        value={apps.mode}
        onChange={(e) => patch({ mode: e.target.value as typeof apps.mode })}
      >
        <option value="keep">沿用固定设置</option>
        <option value="none">不显示 APP 图标</option>
        <option value="fixed">固定图标</option>
        <option value="random">固定＋随机（固定可留空）</option>
      </select>
      {(apps.mode === "fixed" || apps.mode === "random") && (
        <fieldset disabled={busy} className="min-w-0 space-y-3">
          <Input
            aria-label="搜索随机 APP 图标"
            placeholder="搜索微信、QQ、自定义图标"
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
          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {choices.map((icon) => (
              <div
                key={appIconKey(icon)}
                className="flex min-w-0 items-center gap-2 rounded border p-2"
              >
                <IconPreview
                  source={
                    icon.kind === "builtin"
                      ? builtinAppIconSource(
                          icon.builtinId,
                          phoneColor(settings),
                        )
                      : icon.src
                  }
                  name={icon.name}
                  background={settings.backgroundColor}
                />
                <span className="min-w-0 flex-1 truncate text-xs">
                  {icon.name}
                </span>
                <select
                  aria-label={`${icon.name}批量用途`}
                  className="h-8 max-w-32 rounded border bg-background px-1 text-xs"
                  value={role(icon)}
                  onChange={(e) => assign(icon, e.target.value)}
                >
                  <option value="none">不选</option>
                  <option value="fixed">固定出现</option>
                  <option value="candidate" disabled={apps.mode !== "random"}>
                    随机候选
                  </option>
                </select>
              </div>
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
                assign(icon, apps.mode === "random" ? "candidate" : "fixed");
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
            支持 PNG / JPG / WebP，最大 2MB、1024×1024。上传后等比居中，推荐透明
            PNG；保存作图预设后可随完整备份迁移。
          </p>
          {(["fixed", "candidates"] as const)
            .filter((key) => key === "fixed" || apps.mode === "random")
            .map((key) => (
              <div key={key} className="space-y-1">
                <p className="text-xs font-medium">
                  {key === "fixed" ? "固定顺序" : "候选顺序"}
                </p>
                {apps[key].map((icon, index) => (
                  <div
                    key={icon.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{icon.name}</span>
                    <button
                      type="button"
                      disabled={!index}
                      aria-label={`上移批量${icon.name}`}
                      onClick={() => move(key, icon.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === apps[key].length - 1}
                      aria-label={`下移批量${icon.name}`}
                      onClick={() => move(key, icon.id, 1)}
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
              </div>
            ))}
          {apps.mode === "random" && (
            <div className="grid grid-cols-2 gap-2">
              {(["min", "max"] as const).map((key) => (
                <label key={key} className="space-y-1 text-xs">
                  随机增加{key === "min" ? "最少" : "最多"}数量
                  <Input
                    aria-label={`随机 APP ${key === "min" ? "最少" : "最多"}数量`}
                    type="number"
                    min={0}
                    max={apps.candidates.length}
                    value={Number.isNaN(apps[key]) ? "" : apps[key]}
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
            固定 {apps.fixed.length} 个 · 候选 {apps.candidates.length} 个 ·
            最终每张{" "}
            {apps.fixed.length + (apps.mode === "random" ? apps.min : 0)}～
            {apps.fixed.length + (apps.mode === "random" ? apps.max : 0)}{" "}
            个；所选型号共同容量 {capacity} 个。
          </p>
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
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
