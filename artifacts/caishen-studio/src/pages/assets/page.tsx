import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDownToLine, Check, ImagePlus, LoaderCircle, Search, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { importImageFile, formatBytes, formatLabel, type ImportedImage } from "@/lib/image/import.ts";
import { deleteAsset, listAssets, resolveImageUrl, saveAsset, updateAsset } from "@/lib/storage/assets.ts";
import { assetsInUse } from "@/lib/storage/works.ts";
import type { AssetRecord } from "@/lib/storage/db.ts";

type PreviewAsset = AssetRecord & { url: string };
type ImportFeedback = { id: string; name: string; status: "working" | "success" | "error"; message: string };
const CATEGORIES = ["未分类", "背景", "装饰", "商品", "人物", "标志", "其他"];

function getDownloadName(asset: AssetRecord) {
  if (/\.[a-z0-9]{2,6}$/i.test(asset.name)) return asset.name;
  const extension = asset.mime === "image/jpeg" ? "jpg" : asset.mime.split("/")[1]?.toLowerCase();
  return extension ? `${asset.name}.${extension}` : asset.name;
}

function AssetImage({ asset, onOpen }: { asset: AssetRecord; onOpen: (asset: PreviewAsset) => void }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    resolveImageUrl({ kind: "asset", assetId: asset.id }).then((resolved) => {
      if (active) setUrl(resolved);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [asset.id]);
  return (
    <button
      type="button"
      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-[linear-gradient(135deg,#f3e9d4,#e9dfca)] text-left"
      onClick={() => url && onOpen({ ...asset, url })}
      aria-label={`预览素材：${asset.name}`}
      data-testid={`button-preview-asset-${asset.id}`}
    >
      {url ? <img src={url} alt={asset.name} className="size-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.035]" /> :
        failed ? <span className="flex size-full items-center justify-center text-xs text-muted-foreground">预览不可用</span> : <Skeleton className="size-full" />}
      <span className="absolute bottom-2 right-2 rounded-md bg-[#292318]/75 px-2 py-1 font-mono text-[10px] text-[#fff8e9]">{asset.width} × {asset.height}</span>
    </button>
  );
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRecord[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部分类");
  const [preview, setPreview] = useState<PreviewAsset | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ asset: AssetRecord; usedBy: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<ImportFeedback[]>([]);
  const [importingCount, setImportingCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setLoadError("");
    try {
      const rows = await listAssets();
      setAssets(rows.filter((asset) => asset.scope === "library"));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "读取本地素材失败，请重试。");
      setAssets([]);
    }
  };
  useEffect(() => { void reload(); }, []);

  const categories = useMemo(() => ["全部分类", ...new Set((assets ?? []).map((a) => a.category || "未分类"))], [assets]);
  const filtered = useMemo(() => (assets ?? []).filter((asset) =>
    asset.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (category === "全部分类" || (asset.category || "未分类") === category)
  ), [assets, query, category]);

  const importFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) return;
    setImportingCount((count) => count + selected.length);
    const batch = selected.map((file, index) => ({ id: `${Date.now()}-${index}-${file.name}`, name: file.name, status: "working" as const, message: "正在校验并保存到本地…" }));
    setFeedback((current) => [...batch, ...current].slice(0, 12));
    const saved: AssetRecord[] = [];
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      const row = batch[index];
      let imported: ImportedImage | null = null;
      try {
        imported = await importImageFile(file);
        const record = await saveAsset(imported.blob, {
          name: imported.name,
          width: imported.width,
          height: imported.height,
          category: "未分类",
          scope: "library",
        });
        saved.push(record);
        setFeedback((current) => current.map((item) => item.id === row.id ? { ...item, status: "success", message: `已保存 · ${formatBytes(imported!.size)} · ${imported!.width} × ${imported!.height}` } : item));
      } catch (error) {
        const message = error instanceof Error ? error.message : "保存失败，请检查浏览器存储空间。";
        setFeedback((current) => current.map((item) => item.id === row.id ? { ...item, status: "error", message } : item));
      } finally {
        if (imported) URL.revokeObjectURL(imported.previewUrl);
        setImportingCount((count) => Math.max(0, count - 1));
      }
    }
    if (saved.length) await reload();
  };

  const openPreview = (asset: PreviewAsset) => {
    setPreview(asset);
    setEditName(asset.name);
    setEditCategory(asset.category || "未分类");
  };
  const saveEdits = async () => {
    if (!preview || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateAsset(preview.id, { name: editName.trim(), category: editCategory });
      await reload();
      setPreview({ ...preview, name: editName.trim(), category: editCategory });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "修改素材失败，请重试。");
    } finally {
      setSavingEdit(false);
    }
  };
  const askDelete = async (asset: AssetRecord) => {
    try {
      const usage = await assetsInUse();
      setPendingDelete({ asset, usedBy: usage.get(asset.id) ?? [] });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法读取素材引用情况，因此暂不能删除。");
    }
  };
  const confirmDelete = async () => {
    if (!pendingDelete || pendingDelete.asset.scope !== "library") return;
    setDeleting(true);
    try {
      await deleteAsset(pendingDelete.asset.id);
      if (preview?.id === pendingDelete.asset.id) setPreview(null);
      setPendingDelete(null);
      await reload();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "删除素材失败，请重试。");
    } finally {
      setDeleting(false);
    }
  };
  const download = (asset: AssetRecord) => {
    const href = URL.createObjectURL(asset.blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = getDownloadName(asset);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-[#e5d8bd] bg-[#f4ead5] px-6 py-7 shadow-[0_18px_50px_-38px_rgba(88,56,20,.45)] md:px-10 md:py-9">
        <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full border border-[#cfb77f]/50" />
        <div className="pointer-events-none absolute -right-1 top-[-5.5rem] size-64 rounded-full border border-[#cfb77f]/40" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c9ad70] bg-[#fff9eb]/65 px-3 py-1.5 text-xs font-medium text-[#76551d]">
              <ShieldCheck className="size-3.5" /> 仅保存在此浏览器
            </div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-[#382719] md:text-[2.65rem]">素材库<span className="ml-3 align-middle font-sans text-sm font-normal tracking-normal text-[#8a7556]">本地图片档案</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#75644b]">把常用图片收在手边。可随时搜索、整理并复用于作品；不会上传，也无需登录。</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden rounded-xl border border-[#dfcfab] bg-[#fff9eb]/65 px-4 py-2.5 text-right sm:block">
              <div className="font-mono text-xl font-semibold text-[#573c1b]" data-testid="text-asset-count">{assets?.length ?? "—"}</div>
              <div className="text-[11px] text-[#8a7556]">张本地素材</div>
            </div>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" data-testid="input-import-assets" onChange={(event) => { if (event.currentTarget.files) void importFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
            <Button className="h-11 rounded-xl bg-[#8e3528] px-5 text-[#fff8e9] shadow-sm hover:bg-[#74291f]" onClick={() => inputRef.current?.click()} disabled={importingCount > 0} data-testid="button-import-assets">
              {importingCount ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {importingCount ? "正在导入…" : "导入图片"}
            </Button>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#dfcfab] pt-4 text-xs text-[#806e53]">
          <span>PNG / JPG / WebP</span><span>单张不超过 20 MB</span><span>最长边不超过 8000 px</span><span>支持一次选择多张</span>
        </div>
      </section>

      <section className="mt-8" aria-label="素材管理">
        <div className="flex flex-col gap-3 border-b border-[#e7dfd1] pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#3c3023]">你的图片</h2>
            <p className="mt-1 text-xs text-muted-foreground">编辑器模板内部图片不会显示在这里。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a806f]" />
              <input aria-label="按名称搜索素材" placeholder="搜索素材名称…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-lg border border-[#ded6c7] bg-[#fffdf8] pl-9 pr-3 text-sm outline-none transition focus:border-[#a77c3d] focus:ring-2 focus:ring-[#a77c3d]/15" data-testid="input-search-assets" />
            </label>
            <select aria-label="按分类筛选" value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-lg border border-[#ded6c7] bg-[#fffdf8] px-3 text-sm text-[#514536] outline-none focus:border-[#a77c3d]" data-testid="select-asset-category">
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {loadError && <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-[#e8c2b8] bg-[#fff2ed] p-4 text-sm text-[#8e3528]" data-testid="status-asset-error"><AlertCircle className="mt-0.5 size-4 shrink-0" /><div className="flex-1">{loadError}</div><button type="button" className="underline underline-offset-2" onClick={() => void reload()} data-testid="button-retry-assets">重试</button></div>}

        {feedback.length > 0 && <div className="mt-4 space-y-2" aria-live="polite" data-testid="list-import-feedback">
          {feedback.map((item) => <div key={item.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${item.status === "error" ? "border-[#e7c3b8] bg-[#fff5f0] text-[#9b4434]" : "border-[#dfd7c7] bg-[#fbf8f0] text-[#655a48]"}`} data-testid={`status-import-${item.id}`}>
            {item.status === "working" ? <LoaderCircle className="size-3.5 animate-spin" /> : item.status === "success" ? <Check className="size-3.5 text-[#54714e]" /> : <AlertCircle className="size-3.5" />}
            <span className="max-w-[40%] truncate font-medium">{item.name}</span><span className="flex-1">{item.message}</span>
          </div>)}
        </div>}

        {assets === null ? <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }, (_, index) => <Skeleton key={index} className="aspect-[4/3] rounded-xl" />)}</div> :
          filtered.length === 0 ? <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#d8cebd] bg-[#faf7f0] px-6 text-center" data-testid="state-assets-empty">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#efe5d2] text-[#8e6033]">{query || category !== "全部分类" ? <Search className="size-6" /> : <ImagePlus className="size-6" />}</div>
            <h3 className="font-serif text-lg font-semibold text-[#493b2c]">{query || category !== "全部分类" ? "没有找到匹配的图片" : "素材库还空着"}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{query || category !== "全部分类" ? "试试更短的关键词，或切换到其他分类。" : "导入常用的背景、商品图或装饰图片，它们会留在此浏览器中供你复用。"}</p>
            {!query && category === "全部分类" && <Button className="mt-5" variant="outline" onClick={() => inputRef.current?.click()} data-testid="button-import-first-asset"><Upload className="size-4" />选择图片</Button>}
          </div> :
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="grid-assets">
            {filtered.map((asset) => <article key={asset.id} className="overflow-hidden rounded-xl border border-[#e6dfd2] bg-[#fffdf8] shadow-[0_6px_20px_-18px_rgba(56,39,25,.5)] transition duration-200 hover:-translate-y-0.5 hover:border-[#c9b58d] hover:shadow-[0_14px_30px_-20px_rgba(56,39,25,.45)]" data-testid={`card-asset-${asset.id}`}>
              <AssetImage asset={asset} onOpen={openPreview} />
              <div className="p-3">
                <div className="truncate text-sm font-medium text-[#3f3427]" title={asset.name} data-testid={`text-asset-name-${asset.id}`}>{asset.name}</div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#857966]"><span className="rounded-full bg-[#f1eadc] px-2 py-0.5">{asset.category || "未分类"}</span><span>{formatBytes(asset.size)}</span></div>
                <div className="mt-3 flex gap-2 border-t border-[#eee8dc] pt-2.5">
                  <button type="button" className="flex-1 rounded-md py-1.5 text-xs text-[#76551d] transition-colors hover:bg-[#f4ecd9]" onClick={async () => { try { const url = await resolveImageUrl({ kind: "asset", assetId: asset.id }); openPreview({ ...asset, url }); } catch (error) { setLoadError(error instanceof Error ? error.message : "无法打开素材预览。"); } }} data-testid={`button-open-asset-${asset.id}`}>查看详情</button>
                  <button type="button" className="rounded-md px-2 py-1.5 text-[#8e3528] transition-colors hover:bg-[#f9e9e4]" aria-label={`删除素材：${asset.name}`} onClick={() => void askDelete(asset)} data-testid={`button-delete-asset-${asset.id}`}><Trash2 className="size-4" /></button>
                </div>
              </div>
            </article>)}
          </div>}
      </section>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl" data-testid="dialog-asset-preview">
          <DialogHeader><DialogTitle>素材详情</DialogTitle><DialogDescription>原图保存在当前浏览器，可修改名称和分类，或下载原始文件。</DialogDescription></DialogHeader>
          {preview && <div className="grid gap-5 md:grid-cols-[1.15fr_.85fr]">
            <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl border bg-[#f4efe5] p-3"><img src={preview.url} alt={preview.name} className="max-h-[52vh] max-w-full object-contain" data-testid={`img-preview-${preview.id}`} /></div>
            <div className="space-y-4">
              <label className="block text-sm font-medium">素材名称<input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal" data-testid="input-edit-asset-name" /></label>
              <label className="block text-sm font-medium">分类<select value={editCategory} onChange={(event) => setEditCategory(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal" data-testid="select-edit-asset-category">{!CATEGORIES.includes(editCategory) && <option value={editCategory}>{editCategory}</option>}{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-muted/60 p-3 text-xs">
                <dt className="text-muted-foreground">格式</dt><dd className="text-right">{formatLabel(preview.mime)}</dd>
                <dt className="text-muted-foreground">文件大小</dt><dd className="text-right">{formatBytes(preview.size)}</dd>
                <dt className="text-muted-foreground">图片尺寸</dt><dd className="text-right font-mono">{preview.width} × {preview.height} px</dd>
                <dt className="text-muted-foreground">加入时间</dt><dd className="text-right">{new Date(preview.createdAt).toLocaleDateString("zh-CN")}</dd>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveEdits()} disabled={!editName.trim() || savingEdit} data-testid="button-save-asset-edits">{savingEdit && <LoaderCircle className="size-4 animate-spin" />}保存修改</Button>
                <Button variant="outline" onClick={() => download(preview)} data-testid="button-download-asset"><ArrowDownToLine className="size-4" />下载原图</Button>
              </div>
            </div>
          </div>}
          <DialogFooter><Button variant="ghost" onClick={() => setPreview(null)} data-testid="button-close-asset-preview"><X className="size-4" />关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <DialogContent data-testid="dialog-confirm-delete-asset">
          <DialogHeader><DialogTitle>确认删除这张素材？</DialogTitle>
            <DialogDescription className="leading-6">
              {pendingDelete?.usedBy.length ? <><span className="font-medium text-foreground">「{pendingDelete.asset.name}」正在被以下作品或历史版本引用：</span><span className="mt-2 block rounded-lg bg-[#fff2ed] p-3 text-[#8e3528]" data-testid="text-asset-usage-warning">{pendingDelete.usedBy.join("、")}</span><span className="mt-2 block">删除后，这些作品及历史版本中的图片将无法显示。此操作无法撤销。</span></> : <>「{pendingDelete?.asset.name}」当前没有被任何作品或历史版本引用。删除后无法恢复。</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting} data-testid="button-cancel-delete-asset">保留素材</Button><Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting} data-testid="button-confirm-delete-asset">{deleting && <LoaderCircle className="size-4 animate-spin" />}仍然删除</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
