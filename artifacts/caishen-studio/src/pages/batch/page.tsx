import PhoneSetup from "./_components/phone-setup";
import { phoneModel } from "@/lib/phone/models";
import { defaultPhoneSettings } from "@/lib/phone/layers";
import { applyPhoneBatchRules, drawingRules } from "@/lib/batch/phone-rules";
import { type PhoneBatchRules } from "@/lib/batch/phone-rules";
import { phoneTime } from "@/lib/phone/layers";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Check,
  Dices,
  Download,
  LayoutTemplate,
  LoaderCircle,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { useWorks } from "@/hooks/use-works.ts";
import { listAssets } from "@/lib/storage/assets.ts";
import type { AssetRecord } from "@/lib/storage/db.ts";
import { BUILTIN_TEMPLATES } from "@/lib/template/builtin.ts";
import { collectParamValues } from "@/lib/template/params.ts";
import {
  MAX_BATCH_COUNT,
  createRng,
  defaultRule,
  generateItems,
  type GeneratedItem,
  isLockedParam,
  type BatchRules,
  type ParamRule,
  type RuleMode,
} from "@/lib/batch/rules.ts";
import {
  createBatchArchive,
  safeFileName,
  type BatchItemOutcome,
  type BatchProgress,
} from "@/lib/batch/generation.ts";
import type { TemplateDoc } from "@/types/template.ts";
import BatchPreview from "./_components/batch-preview.tsx";
import RuleEditor from "./_components/rule-editor.tsx";

const PREVIEW_COUNT = 6;
type Option = {
  id: string;
  name: string;
  doc: TemplateDoc;
  group: "builtin" | "mine";
};
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function BatchPage() {
  const { state } = useWorks();
  const [params] = useSearchParams();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [templateId, setTemplateId] = useState(
    () => params.get("template") ?? "",
  );
  const [count, setCount] = useState(20);
  const [rules, setRules] = useState<BatchRules>({});
  const [phoneRules, setPhoneRules] = useState<PhoneBatchRules>(() => ({
    ...drawingRules(defaultPhoneSettings()),
    setup: { mode: "keep", settings: defaultPhoneSettings() },
  }));
  const [configured, setConfigured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<GeneratedItem[] | null>(null);
  const [needsPreview, setNeedsPreview] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [seed, setSeed] = useState(newSeed);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [failures, setFailures] = useState<BatchItemOutcome[]>([]);
  const [zip, setZip] = useState<{
    url: string;
    name: string;
    count: number;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listAssets()
      .then(setAssets)
      .catch(() => setAssets([]));
  }, []);
  useEffect(
    () => () => {
      if (zip) URL.revokeObjectURL(zip.url);
    },
    [zip],
  );

  const options = useMemo<Option[]>(() => {
    const builtin = BUILTIN_TEMPLATES.map((t) => ({
      id: `b:${t.id}`,
      name: t.name,
      doc: t.doc,
      group: "builtin" as const,
    }));
    const mine =
      state.status === "ready"
        ? state.works
            .filter((w) => w.kind === "template")
            .map((w) => ({
              id: `w:${w.id}`,
              name: w.name,
              doc: w.doc,
              group: "mine" as const,
            }))
        : [];
    return [...mine, ...builtin];
  }, [state]);
  const selected = options.find((o) => o.id === templateId) ?? null;

  const computedItems = useMemo(
    () =>
      selected
        ? generateItems(selected.doc, rules, count, seed, phoneRules)
        : [],
    [selected, rules, count, seed, phoneRules],
  );
  const items = preview ?? computedItems;
  const invalid = (needsPreview ? computedItems : items).filter(
    (i) => i.errors.length > 0,
  );

  const resetOutput = (invalidate = true) => {
    if (invalidate) setNeedsPreview(true);
    setZip(null);
    setFailures([]);
    setProgress(null);
    setError("");
  };
  const selectTemplate = (id: string) => {
    setTemplateId(id);
    setRules({});
    if (!configured) {
      const saved = options.find((o) => o.id === id)?.doc.phone;
      const next = drawingRules(saved ?? defaultPhoneSettings());
      if (!saved) next.setup!.mode = "keep";
      setPhoneRules(next);
    }
    setPreview(null);
    setPreviewPage(0);
    resetOutput(false);
    setNeedsPreview(false);
  };
  const setRule = (paramId: string, rule: ParamRule) => {
    setRules((old) => ({ ...old, [paramId]: rule }));
    resetOutput();
  };
  const setMode = (paramId: string, mode: RuleMode) => {
    if (!selected) return;
    const param = selected.doc.parameters.find((p) => p.id === paramId);
    if (!param) return;
    setRule(
      paramId,
      defaultRule(
        mode,
        param,
        collectParamValues(selected.doc)[paramId] ?? null,
      ),
    );
  };

  const generate = async () => {
    if (!selected || working || uploading || needsPreview) return;
    resetOutput(false);
    setWorking(true);
    try {
      const result = await createBatchArchive({
        name: selected.name,
        items,
        onProgress: setProgress,
      });
      setFailures(result.outcomes.filter((o) => o.status === "failed"));
      if (result.archive) {
        setZip({
          url: URL.createObjectURL(result.archive),
          name: `${safeFileName(selected.name, "设计")}-批量${result.succeeded}张.zip`,
          count: result.succeeded,
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量生成或打包失败");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-end">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground dark:text-accent">
            <WandSparkles className="size-3.5" /> 本地生成 · 图片不离开此浏览器
          </p>
          <h1 className="font-serif text-3xl font-bold md:text-4xl">
            批量做图
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            选择模板，设置张数和每个参数的规则：固定值、随机区间、随机时间段、候选随机或自动编号。
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
        <fieldset
          disabled={working || uploading}
          className="min-w-0 space-y-5 disabled:opacity-70"
        >
          <Step n="01" title="选择模板">
            {state.status === "loading" ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="[&>[data-slot=native-select-wrapper]]:w-full">
                <NativeSelect
                  aria-label="批量模板"
                  className="w-full"
                  value={templateId}
                  onChange={(e) => selectTemplate(e.target.value)}
                >
                  <NativeSelectOption value="">
                    请选择一个模板
                  </NativeSelectOption>
                  {(["mine", "builtin"] as const).map((g) => {
                    const list = options.filter((o) => o.group === g);
                    return list.length ? (
                      <NativeSelectOptGroup
                        key={g}
                        label={g === "mine" ? "我的模板" : "模板库"}
                      >
                        {list.map((o) => (
                          <NativeSelectOption key={o.id} value={o.id}>
                            {o.name} · {o.doc.parameters.length} 个参数
                          </NativeSelectOption>
                        ))}
                      </NativeSelectOptGroup>
                    ) : null;
                  })}
                </NativeSelect>
              </div>
            )}
            {selected && (
              <p className="mt-2 text-xs text-muted-foreground">
                {selected.doc.canvas.width} × {selected.doc.canvas.height} px ·
                未设置规则的参数沿用模板当前内容
              </p>
            )}
          </Step>

          <Step n="02" title="生成张数">
            <div className="flex items-center gap-4">
              <Slider
                className="flex-1"
                min={1}
                max={MAX_BATCH_COUNT}
                step={1}
                value={[count]}
                onValueChange={([v]) => {
                  setCount(v);
                  resetOutput();
                }}
              />
              <Input
                aria-label="生成张数"
                type="number"
                min={1}
                max={MAX_BATCH_COUNT}
                value={count}
                className="w-24"
                onChange={(e) => {
                  setCount(
                    Math.max(
                      1,
                      Math.min(MAX_BATCH_COUNT, Number(e.target.value) || 1),
                    ),
                  );
                  resetOutput();
                }}
              />
              <span className="text-sm text-muted-foreground">张</span>
            </div>
          </Step>

          <Step n="03" title="参数规则">
            {!selected ? (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LayoutTemplate />
                  </EmptyMedia>
                  <EmptyTitle>先选择一个模板</EmptyTitle>
                  <EmptyDescription>
                    模板里设置好的参数会在这里列出，逐个设置生成规则。
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button size="sm" variant="secondary" asChild>
                    <Link to="/templates">浏览模板</Link>
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="-mx-5 divide-y border-y">
                {selected.doc.parameters.length === 0 && (
                  <p className="px-5 py-4 text-sm text-muted-foreground">
                    此模板没有内容参数，可直接在下方设置状态栏随机。
                  </p>
                )}
                {selected.doc.parameters.map((p) => (
                  <RuleEditor
                    key={p.id}
                    param={p}
                    rule={rules[p.id] ?? { mode: "keep" }}
                    locked={isLockedParam(selected.doc, p)}
                    assets={assets}
                    onModeChange={(m) => setMode(p.id, m)}
                    onChange={(r) => setRule(p.id, r)}
                  />
                ))}
              </div>
            )}
          </Step>
          <Step n="04" title="手机效果与随机规则">
            {selected ? (
              <PhoneSetup
                doc={selected.doc}
                value={phoneRules}
                disabled={working || uploading}
                onBusyChange={setUploading}
                onChange={(next) => {
                  setConfigured(true);
                  setPhoneRules(next);
                  resetOutput();
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                先选择内容模板，再设置手机效果。普通模板也可以直接添加状态栏。
              </p>
            )}
          </Step>
        </fieldset>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">预览</h2>
                <p className="text-xs text-muted-foreground">
                  {selected
                    ? `第 ${previewPage * PREVIEW_COUNT + 1}–${Math.min((previewPage + 1) * PREVIEW_COUNT, items.length)} 张 / 共 ${items.length} 张`
                    : "选择模板后显示"}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!selected || working || uploading}
                onClick={() => {
                  setSeed(newSeed());
                  setPreview(null);
                  setNeedsPreview(false);
                  resetOutput(false);
                }}
              >
                <Dices className="size-4" /> 换一批
              </Button>
            </div>
            {needsPreview && (
              <p
                role="status"
                className="mb-3 rounded border border-amber-400/40 bg-amber-50 p-2 text-xs text-amber-900"
              >
                规则已修改，需要重新生成预览，才能导出。
              </p>
            )}
            <Button
              className="mb-3 w-full"
              variant="outline"
              disabled={
                !selected ||
                working ||
                uploading ||
                (!needsPreview && preview !== null)
              }
              onClick={() => {
                setPreview(computedItems);
                setPreviewPage(0);
                setNeedsPreview(false);
                resetOutput(false);
              }}
            >
              生成预览
            </Button>
            <div
              className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${needsPreview ? "opacity-50" : ""}`}
            >
              {selected ? (
                items
                  .slice(
                    previewPage * PREVIEW_COUNT,
                    (previewPage + 1) * PREVIEW_COUNT,
                  )
                  .map((i) => (
                    <div key={i.index} className="min-w-0 space-y-1">
                      <BatchPreview
                        doc={i.doc}
                        label={String(i.index + 1)}
                        invalid={i.errors.length > 0}
                        maxSize={160}
                      />
                      {i.doc.phone && (
                        <p
                          aria-label={`第 ${i.index + 1} 张状态栏`}
                          className="break-words text-[11px] text-muted-foreground"
                        >
                          {phoneModel(i.doc.phone.modelId).name} ·{" "}
                          {phoneTime(i.doc.phone)} · 电量 {i.doc.phone.battery}%
                          {i.doc.phone.showDate ? ` · ${i.doc.phone.date}` : ""}{" "}
                          · 信号 {i.doc.phone.signal} 格 · Wi-Fi{" "}
                          {i.doc.phone.wifi} 格 · {i.doc.phone.network} · APP：
                          {i.doc.phone.appIcons
                            .filter((a) => a.visible)
                            .map((a) => a.name)
                            .join("、") || "无"}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {i.doc.canvas.width} × {i.doc.canvas.height}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto w-full whitespace-normal px-1 py-1 text-[11px]"
                        disabled={working || uploading || needsPreview}
                        onClick={() => {
                          if (!selected) return;
                          const nextSeed = newSeed();
                          let replacement = generateItems(
                            selected.doc,
                            rules,
                            count,
                            nextSeed,
                            phoneRules,
                          )[i.index];
                          if (
                            phoneRules.models?.enabled &&
                            phoneRules.models.distribution === "balanced" &&
                            i.doc.phone &&
                            !replacement.errors.length
                          ) {
                            try {
                              replacement = {
                                ...replacement,
                                doc: applyPhoneBatchRules(
                                  replacement.doc,
                                  phoneRules,
                                  createRng(nextSeed),
                                  i.doc.phone.modelId,
                                ),
                              };
                            } catch (e) {
                              setError(
                                e instanceof Error ? e.message : "重新随机失败",
                              );
                              return;
                            }
                          }
                          setPreview(
                            items.map((item) =>
                              item.index === i.index ? replacement : item,
                            ),
                          );
                          resetOutput(false);
                        }}
                      >
                        重新随机第 {i.index + 1} 张
                      </Button>
                    </div>
                  ))
              ) : (
                <div className="col-span-full">
                  <BatchPreview doc={null} />
                </div>
              )}
            </div>
            {selected && items.length > PREVIEW_COUNT && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={previewPage === 0 || working}
                  onClick={() => setPreviewPage((p) => p - 1)}
                >
                  上一页
                </Button>
                <span className="text-xs">
                  {previewPage + 1} / {Math.ceil(items.length / PREVIEW_COUNT)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    (previewPage + 1) * PREVIEW_COUNT >= items.length || working
                  }
                  onClick={() => setPreviewPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
            {invalid.length > 0 && (
              <details className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <summary className="cursor-pointer font-medium text-destructive">
                  {invalid.length} 张不符合模板规则，导出时会跳过
                </summary>
                <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-muted-foreground">
                  {invalid.slice(0, 20).map((i) => (
                    <li key={i.index}>
                      第 {i.index + 1} 张：{i.errors.join("；")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">生成与下载</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              按当前预览尺寸导出屏幕内容 PNG，打包成 ZIP；添加状态栏会增加高度。
            </p>
            <Button
              className="mt-4 w-full"
              onClick={generate}
              disabled={
                !selected ||
                working ||
                uploading ||
                needsPreview ||
                invalid.length === items.length
              }
            >
              {working ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" /> 正在生成{" "}
                  {progress?.completed ?? 0}/{items.length}
                </>
              ) : (
                <>
                  <WandSparkles className="size-4" /> 生成{" "}
                  {items.length - invalid.length} 张图片
                </>
              )}
            </Button>
            {working && (
              <Progress
                className="mt-3"
                value={
                  progress ? (progress.completed / progress.total) * 100 : 0
                }
              />
            )}
            {zip && (
              <>
                <p className="mt-4 flex items-center gap-2 text-sm font-medium text-chart-3">
                  <Check className="size-4" /> 已生成 {zip.count} 张图片
                </p>
                <Button asChild className="mt-2 w-full" variant="secondary">
                  <a href={zip.url} download={zip.name}>
                    <Download className="size-4" /> 下载 ZIP
                  </a>
                </Button>
              </>
            )}
            {failures.length > 0 && (
              <p className="mt-3 text-xs text-destructive">
                {failures.length} 张未通过检查或渲染失败，已跳过。
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </section>
          <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            模板只负责内容，手机效果在此设置。导出使用当前预览结果，不重新抽签，也不会修改原模板。均衡分配时，单张重新随机保留其型号。
          </p>
        </aside>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-semibold text-primary">
          {n}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
