import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Check, ChevronDown, Download, FileSpreadsheet, Image as ImageIcon, LoaderCircle, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { useWorks } from "@/hooks/use-works.ts";
import { listAssets } from "@/lib/storage/assets.ts";
import type { AssetRecord, WorkRecord } from "@/lib/storage/db.ts";
import {
  createBatchArchive,
  parseBatchCsv,
  prepareBatchRow,
  suggestColumnMapping,
  type BatchMapping,
  type BatchProgress,
  type BatchRowOutcome,
  type ParsedBatchCsv,
} from "@/lib/batch/generation.ts";
import BatchPreview from "./_components/batch-preview.tsx";

type PreviewBatchRow = ParsedBatchCsv["rows"][number] & {
  doc: WorkRecord["doc"];
  errors: string[];
};

export default function BatchPage() {
  const { state, refresh } = useWorks();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetLoadError, setAssetLoadError] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [csv, setCsv] = useState<ParsedBatchCsv | null>(null);
  const [csvName, setCsvName] = useState("");
  const [csvError, setCsvError] = useState("");
  const [mappings, setMappings] = useState<BatchMapping>({});
  const [filenameColumn, setFilenameColumn] = useState("");
  const [selectedRow, setSelectedRow] = useState(0);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [outcomes, setOutcomes] = useState<BatchRowOutcome[]>([]);
  const [result, setResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [zipUrl, setZipUrl] = useState("");
  const [zipName, setZipName] = useState("");
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let alive = true;
    listAssets().then((items) => alive && setAssets(items)).catch((reason: unknown) => {
      if (alive) setAssetLoadError(reason instanceof Error ? reason.message : "读取素材库失败");
    });
    return () => { alive = false; };
  }, []);
  useEffect(() => () => { if (zipUrl) URL.revokeObjectURL(zipUrl); }, [zipUrl]);

  const templates = state.status === "ready" ? state.works.filter((work) => work.kind === "template" && work.doc.parameters.length > 0) : [];
  const selectedTemplate = templates.find((work) => work.id === templateId) ?? null;
  const rows: PreviewBatchRow[] = useMemo(() => {
    if (!selectedTemplate || !csv) return [];
    return csv.rows.map((row) => ({ ...row, ...prepareBatchRow(selectedTemplate.doc, row, mappings, assets) }));
  }, [selectedTemplate, csv, mappings, assets]);
  const validRows = rows.filter((row) => row.errors.length === 0);
  const previewRow = rows[selectedRow];

  const importCsv = async (file?: File) => {
    if (!file) return;
    setCsvName(file.name);
    setCsvError("");
    setOutcomes([]);
    setResult(null);
    setDownloadError("");
    try {
      const parsed = await parseBatchCsv(file);
      setCsv(parsed);
      setSelectedRow(0);
      setFilenameColumn("");
      if (selectedTemplate) setMappings(suggestColumnMapping(selectedTemplate.doc.parameters, parsed.headers));
    } catch (reason) {
      setCsv(null);
      setCsvError(reason instanceof Error ? reason.message : "无法读取 CSV 文件");
    }
  };

  const selectTemplate = (id: string) => {
    setTemplateId(id);
    setOutcomes([]);
    setResult(null);
    const work = templates.find((item) => item.id === id);
    setMappings(work && csv ? suggestColumnMapping(work.doc.parameters, csv.headers) : {});
  };

  const setMapping = (paramId: string, column: string) => setMappings((old) => ({ ...old, [paramId]: column || undefined }));

  const generate = async () => {
    if (!selectedTemplate || !csv || working || rows.length === 0) return;
    setWorking(true);
    setProgress(null);
    setOutcomes([]);
    setResult(null);
    setDownloadError("");
    if (zipUrl) URL.revokeObjectURL(zipUrl);
    setZipUrl("");
    try {
      const archiveResult = await createBatchArchive({
        template: selectedTemplate.doc,
        csv,
        mapping: mappings,
        assets,
        filenameColumn: filenameColumn || undefined,
        onProgress: (nextProgress) => {
          setProgress(nextProgress);
          setOutcomes((current) => [...current, nextProgress.latest]);
        },
      });
      setResult({ succeeded: archiveResult.succeeded, failed: archiveResult.failed });
      setOutcomes(archiveResult.outcomes);
      if (archiveResult.archive) {
        setZipUrl(URL.createObjectURL(archiveResult.archive));
        const safeName = selectedTemplate.name.replace(/[\\/:*?"<>|]/g, "-").trim() || "设计";
        setZipName(`${safeName}-批量图片.zip`);
      }
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : "批量生成或 ZIP 打包失败");
    } finally {
      setWorking(false);
    }
  };

  const canGenerate = !!selectedTemplate && !!csv && rows.length > 0 && !working;
  const progressPercent = progress?.total ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-col justify-between gap-5 border-b border-border/80 pb-6 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ead7bf] bg-[#fbf2e7] px-3 py-1 text-xs font-medium text-[#966340]">
            <WandSparkles className="size-3.5" /> 本地处理 · 文件不离开此浏览器
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">批量生成</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">把模板参数和表格列对应起来，一次导出多张高清 PNG。</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">1</span> 选择模板
          <ArrowRight className="size-3.5" />
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">2</span> 导入数据
          <ArrowRight className="size-3.5" />
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">3</span> 导出 ZIP
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-card p-5 shadow-sm shadow-[#5d3510]/[0.03]">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f8e9d8] text-[#9c5b27]"><span className="font-mono text-sm font-semibold">01</span></div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">选择一个参数模板</h2>
                <p className="mt-1 text-sm text-muted-foreground">仅显示本地保存且已设置参数的模板。</p>
                {state.status === "loading" ? <div className="mt-4 h-11 animate-pulse rounded-md bg-muted" data-testid="status-templates-loading" />
                  : state.status === "error" ? <div className="mt-3 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" data-testid="status-templates-error"><span>{state.error}</span><Button variant="outline" size="sm" onClick={refresh} data-testid="button-retry-templates">重试</Button></div>
                    : <select value={templateId} onChange={(event) => selectTemplate(event.target.value)} className="mt-4 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid="select-batch-template">
                      <option value="">选择已保存的模板</option>
                      {templates.map((work: WorkRecord) => <option key={work.id} value={work.id}>{work.name} · {work.doc.parameters.length} 个参数</option>)}
                    </select>}
                {state.status === "ready" && templates.length === 0 && <div className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-testid="empty-parameter-templates">还没有可用模板。先在「自定义模板」中制作模板，并为图层添加参数。</div>}
                {selectedTemplate && <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground" data-testid="text-selected-template-meta"><span className="rounded bg-muted px-2 py-1">{selectedTemplate.doc.canvas.width} × {selectedTemplate.doc.canvas.height} px</span><span className="rounded bg-muted px-2 py-1">{selectedTemplate.doc.parameters.length} 个可填参数</span></div>}
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm shadow-[#5d3510]/[0.03]">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f8e9d8] text-[#9c5b27]"><span className="font-mono text-sm font-semibold">02</span></div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">导入 CSV 表格</h2>
                 <p className="mt-1 text-sm text-muted-foreground">第一行为列名；每一行数据将生成一张图。未映射或空白单元格沿用模板当前值。</p>
                <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#d8c4ac] bg-[#fcf8f2] px-4 text-center transition-colors hover:border-primary/60 hover:bg-[#faf2e7]" data-testid="dropzone-batch-csv">
                  <FileSpreadsheet className="mb-2 size-6 text-[#a56c3d]" />
                  <span className="text-sm font-medium">{csvName || "选择 .csv 文件"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">本地读取，支持 UTF-8 编码</span>
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => importCsv(event.target.files?.[0])} data-testid="input-batch-csv" />
                </label>
                {csvError && <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" data-testid="status-csv-error"><AlertCircle className="mt-0.5 size-4 shrink-0" />{csvError}</div>}
                {csv && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" data-testid="status-csv-loaded"><span className="flex items-center gap-1.5 font-medium text-chart-3"><Check className="size-4" /> 已读取 {csv.rows.length} 行</span><span className="text-muted-foreground">{csv.headers.length} 列</span><span className="text-xs text-muted-foreground">{csv.headers.join(" · ")}</span></div>}
              </div>
            </div>
          </section>

          {selectedTemplate && csv && <section className="rounded-xl border bg-card p-5 shadow-sm shadow-[#5d3510]/[0.03]">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f8e9d8] text-[#9c5b27]"><span className="font-mono text-sm font-semibold">03</span></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div><h2 className="font-semibold">匹配模板参数与 CSV 列</h2><p className="mt-1 text-sm text-muted-foreground">已按参数名称和编号自动建议，可手动调整。</p></div>
                  <div className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground" data-testid="text-batch-validation-summary">{validRows.length} 行可生成 · {rows.length - validRows.length} 行需检查</div>
                </div>
                <div className="mt-4 divide-y rounded-lg border">
                  {selectedTemplate.doc.parameters.map((parameter) => {
                    const invalidCount = rows.filter((row) => row.errors.some((error) => error.includes(`「${parameter.name}」`))).length;
                    return <div key={parameter.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)] sm:items-center" data-testid={`mapping-row-${parameter.id}`}>
                      <div><p className="text-sm font-medium">{parameter.name}{parameter.required && <span className="ml-1 text-primary">*</span>}</p><p className="mt-0.5 text-xs text-muted-foreground">{parameter.type === "image" ? "图片 · 用本地素材名称匹配" : parameter.type}{parameter.description ? ` · ${parameter.description}` : ""}{invalidCount > 0 && <span className="ml-2 text-destructive">{invalidCount} 行异常</span>}</p></div>
                      <select value={mappings[parameter.id] ?? ""} onChange={(event) => setMapping(parameter.id, event.target.value)} className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid={`select-column-${parameter.id}`}>
                        <option value="">使用模板当前值</option>
                        {csv.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                      </select>
                    </div>;
                  })}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)] sm:items-end">
                  <label className="text-sm font-medium">文件名列 <span className="font-normal text-muted-foreground">（可选）</span>
                    <select value={filenameColumn} onChange={(event) => setFilenameColumn(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid="select-filename-column">
                      <option value="">自动编号</option>{csv.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </label>
                  <div className="text-xs text-muted-foreground">{assetLoadError ? <span className="text-destructive" data-testid="status-assets-error">{assetLoadError}</span> : <span className="flex items-center gap-1.5"><ImageIcon className="size-3.5" /> 图片列仅从本地素材库按名称解析{assets.length ? `（${assets.length} 项）` : "（当前为空）"}</span>}</div>
                </div>
              </div>
            </div>
          </section>}
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border bg-card p-4 shadow-sm shadow-[#5d3510]/[0.03]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div><h2 className="font-semibold">预览与数据检查</h2><p className="mt-1 text-xs text-muted-foreground">{previewRow ? `CSV 第 ${previewRow.sourceLine} 行 / 共 ${rows.length} 行` : "导入表格后查看行预览"}</p></div>
              {rows.length > 0 && <select value={selectedRow} onChange={(event) => setSelectedRow(Number(event.target.value))} className="h-8 max-w-32 rounded-md border bg-background px-2 text-xs" data-testid="select-preview-row">{rows.map((row, index) => <option key={index} value={index}>第 {row.sourceLine} 行{row.errors.length ? " · 检查" : ""}</option>)}</select>}
            </div>
            <BatchPreview doc={previewRow?.doc ?? selectedTemplate?.doc ?? null} />
            {previewRow && <div className="mt-3">
              {previewRow.errors.length ? <div className="rounded-lg border border-amber-300/70 bg-amber-50/70 p-3" data-testid={`status-row-invalid-${previewRow.sourceLine}`}><p className="text-sm font-medium text-amber-900">此行需要检查</p><ul className="mt-1.5 space-y-1 text-xs text-amber-800">{previewRow.errors.map((error) => <li key={error}>· {error}</li>)}</ul></div>
                : <p className="flex items-center gap-1.5 text-sm text-chart-3" data-testid={`status-row-valid-${previewRow.sourceLine}`}><Check className="size-4" /> 此行数据有效</p>}
            </div>}
          </section>

          <section className="rounded-xl border bg-[#fffaf3] p-5 shadow-sm shadow-[#5d3510]/[0.03]">
            <div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f8e9d8] text-[#9c5b27]"><span className="font-mono text-sm font-semibold">04</span></div><div><h2 className="font-semibold">生成与下载</h2><p className="mt-1 text-sm text-muted-foreground">按模板原始尺寸渲染 PNG，再打包成 ZIP。</p></div></div>
            <Button className="mt-4 w-full" onClick={generate} disabled={!canGenerate} data-testid="button-generate-batch">
              {working ? <><LoaderCircle className="size-4 animate-spin" /> 正在生成 {progress?.completed ?? 0}/{progress?.total ?? rows.length}</> : <><WandSparkles className="size-4" /> 校验并生成 {rows.length} 行</>}
            </Button>
            {!working && selectedTemplate && csv && rows.length > 0 && validRows.length === 0 && <p className="mt-2 text-xs text-destructive" data-testid="status-no-valid-rows">当前行均有校验问题；可检查预览后再生成，失败行不会进入 ZIP。</p>}
            {working && <div className="mt-4 space-y-2" data-testid="status-generation-progress"><div className="flex justify-between text-xs text-muted-foreground"><span>逐行渲染并打包</span><span>{progress?.completed ?? 0}/{progress?.total ?? rows.length} · {progress?.succeeded ?? 0} 成功</span></div><Progress value={progressPercent} /></div>}
            {!working && result && result.succeeded > 0 && <div className="mt-4 rounded-lg border border-emerald-300/70 bg-emerald-50/60 p-3" data-testid="status-generation-success"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><Check className="size-4" />已生成 {result.succeeded} 张图片</p><p className="mt-1 text-xs text-emerald-800">生成文件仅保存在此浏览器中，下载 ZIP 后可另行保存。</p></div>}
            {zipUrl && <a href={zipUrl} download={zipName} className="mt-3 flex h-10 items-center justify-center gap-2 rounded-md bg-[#315c46] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#264b38]" data-testid="link-download-batch-zip"><Download className="size-4" />下载 ZIP</a>}
            {downloadError && <p className="mt-3 text-sm text-destructive" data-testid="status-zip-error">{downloadError}</p>}
            {outcomes.some((outcome) => outcome.status === "failed") && <div className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3" data-testid="status-generation-failures"><p className="text-sm font-semibold text-destructive">{outcomes.filter((outcome) => outcome.status === "failed").length} 行渲染或校验失败</p><ul className="mt-2 max-h-36 space-y-1 overflow-auto text-xs text-muted-foreground">{outcomes.filter((outcome) => outcome.status === "failed").map((outcome) => <li key={`${outcome.sourceLine}-${outcome.message}`}>第 {outcome.sourceLine} 行：{outcome.message}</li>)}</ul></div>}
            {csv && rows.some((row) => row.errors.length) && <p className="mt-3 text-xs text-muted-foreground" data-testid="text-invalid-rows-skipped">校验未通过的 {rows.filter((row) => row.errors.length).length} 行不会进入 ZIP。</p>}
          </section>
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"><ChevronDown className="mt-0.5 size-3.5 shrink-0" />处理完全在浏览器本地完成，素材和表格不会上传。建议先检查预览和异常行，再导出。</div>
        </aside>
      </div>
    </div>
  );
}
