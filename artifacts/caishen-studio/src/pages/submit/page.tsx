import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePublicCatalog } from "@/lib/catalog-service/provider";
import { requestJson } from "@/lib/catalog-service/client";
import { prepareSharedTemplate } from "@/lib/catalog-service/prepare-template";
import { base64ToBlob } from "@/lib/storage/encoding";
type Status = { enabled: boolean; message?: string };
export default function SubmitTemplatePage() {
  const { categories } = usePublicCatalog();
  const [status, setStatus] = useState<Status | null>(null),
    [checking, setChecking] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [summary, setSummary] = useState(""),
    [name, setName] = useState(""),
    [category, setCategory] = useState(""),
    [description, setDescription] = useState(""),
    [tags, setTags] = useState(""),
    [submitter, setSubmitter] = useState(""),
    [contact, setContact] = useState(""),
    [note, setNote] = useState(""),
    [preparing, setPreparing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState("");
  const requestId = useMemo(
    () => crypto.randomUUID(),
    [file, name, category, description, tags, submitter, contact, note],
  );
  const check = async () => {
    setChecking(true);
    setError("");
    try {
      setStatus(await requestJson<Status>("/api/public/submissions/status"));
    } catch (e) {
      setStatus({
        enabled: false,
        message: e instanceof Error ? e.message : "模板提交暂未启用",
      });
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    void check();
  }, []);
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-3xl font-bold">提交模板</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          无需登录，提交后由管理员查看详情并审核，审核发布后才会出现在模板库。
        </p>
      </div>
      {checking && <p role="status">正在检查提交服务…</p>}
      {status && !status.enabled && (
        <div role="alert" className="space-y-3 rounded-xl border p-4">
          <p>{status.message || "模板提交暂未启用"}</p>
          <Button
            variant="outline"
            onClick={() => void check()}
            disabled={checking}
          >
            重新检查提交服务
          </Button>
        </div>
      )}
      {receipt ? (
        <section role="status" className="space-y-3 rounded-xl border p-6">
          <h2 className="text-xl font-semibold">模板已提交</h2>
          <p>管理员已收到你的模板，审核发布后会出现在对应分类中。</p>
          <p className="break-all text-sm">提交编号：{receipt}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setReceipt("");
                setFile(null);
                setPreview("");
                setName("");
                setDescription("");
                setTags("");
                setNote("");
              }}
            >
              继续提交
            </Button>
            <Button asChild variant="outline">
              <Link to="/templates">返回模板库</Link>
            </Button>
          </div>
        </section>
      ) : (
        <form
          aria-label="前台提交模板"
          className="space-y-5 rounded-xl border p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file || !preview || !status?.enabled || busy) return;
            setBusy(true);
            setError("");
            const data = new FormData();
            data.set("file", file);
            data.set(
              "thumbnail",
              base64ToBlob(preview.split(",")[1], "image/png"),
              "thumbnail.png",
            );
            for (const [key, value] of Object.entries({
              name,
              category,
              description,
              submitter,
              contact,
              note,
              tags: JSON.stringify(
                tags
                  .split(/[,，]/)
                  .map((t) => t.trim())
                  .filter(Boolean),
              ),
            }))
              data.set(key, value);
            try {
              const result = await requestJson<{
                submitted: boolean;
                id: string;
              }>("/api/public/submissions", {
                method: "POST",
                headers: { "Idempotency-Key": requestId },
                body: data,
              });
              setReceipt(result.id);
            } catch (e) {
              setError(e instanceof Error ? e.message : "提交失败，请重试");
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset
            disabled={busy || preparing || !status?.enabled}
            className="min-w-0 space-y-4 disabled:opacity-60"
          >
            <label className="block space-y-2 text-sm font-medium">
              <span>模板文件</span>
              <input
                className="block max-w-full text-sm"
                aria-label="选择投稿模板文件"
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const next = e.target.files?.[0];
                  e.target.value = "";
                  if (!next) return;
                  setPreparing(true);
                  setError("");
                  setFile(null);
                  setPreview("");
                  try {
                    const prepared = await prepareSharedTemplate(next);
                    setFile(next);
                    setPreview(prepared.preview);
                    setName(prepared.doc.name.slice(0, 120));
                    setSummary(
                      `${prepared.doc.canvas.width} × ${prepared.doc.canvas.height} px · ${prepared.doc.parameters.length} 个参数`,
                    );
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "模板读取失败");
                  } finally {
                    setPreparing(false);
                  }
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              在编辑器“更多 → 导出模板文件（含图片）”获取 .haishen.json
              文件，最大 20MB。预览自动生成，无需另传封面。
            </p>
            {preview && (
              <figure className="space-y-2">
                <img
                  src={preview}
                  alt="投稿模板真实预览"
                  className="max-h-80 max-w-full rounded border bg-muted object-contain"
                />
                <figcaption className="text-xs text-muted-foreground">
                  {summary}
                </figcaption>
              </figure>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                模板名称
                <Input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                所属分类
                <select
                  required
                  aria-label="投稿模板分类"
                  value={category}
                  className="h-10 w-full rounded border bg-background px-2"
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">请选择分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              模板说明
              <Textarea
                maxLength={300}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="介绍模板适用场景、可编辑内容"
              />
            </label>
            <label className="block space-y-1 text-sm">
              标签（可选，逗号分隔）
              <Input
                value={tags}
                maxLength={600}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如：活动、海报"
              />
            </label>
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm">
                提交者信息与备注（可选）
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block space-y-1 text-sm">
                  称呼
                  <Input
                    maxLength={60}
                    value={submitter}
                    onChange={(e) => setSubmitter(e.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  联系方式
                  <Input
                    maxLength={120}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  给管理员的备注
                  <Textarea
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  这些信息仅后台管理员可见，不会随模板公开。
                </p>
              </div>
            </details>
          </fieldset>
          {preparing && <p role="status">正在读取模板并生成真实预览…</p>}
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={!file || !status?.enabled || preparing || busy}
            >
              {busy ? "正在提交…" : "提交审核"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/templates">返回模板库</Link>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
