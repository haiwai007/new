import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  ManagedSubmission,
  ManagedCategory,
} from "@/lib/catalog-service/contracts";
import { prepareSharedTemplate } from "@/lib/catalog-service/prepare-template";
import type { TemplateDoc } from "@/types/template";
type Props = {
  submissions: ManagedSubmission[];
  categories: ManagedCategory[];
  busy: boolean;
  mutate: (path: string, method: string, value?: unknown) => Promise<boolean>;
};
const LABEL = { pending: "待审核", published: "已通过", rejected: "已拒绝" };
export default function Submissions({
  submissions,
  categories,
  busy,
  mutate,
}: Props) {
  const [filter, setFilter] = useState("pending"),
    [selected, setSelected] = useState("");
  const list = submissions.filter(
      (s) => filter === "all" || s.status === filter,
    ),
    current = submissions.find((s) => s.id === selected);
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">投稿审核</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          前台提交先进入待审核；查看实际模板详情后，再决定发布或拒绝。已通过模板也可在“模板管理”中下架或编辑。
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["pending", "published", "rejected", "all"] as const).map((key) => (
          <Button
            size="sm"
            key={key}
            variant={filter === key ? "default" : "outline"}
            aria-pressed={filter === key}
            onClick={() => {
              setFilter(key);
              setSelected("");
            }}
          >
            {key === "all" ? "全部" : LABEL[key]}（
            {key === "all"
              ? submissions.length
              : submissions.filter((s) => s.status === key).length}
            ）
          </Button>
        ))}
      </div>
      {!list.length && (
        <p className="rounded-xl border border-dashed p-5 text-muted-foreground">
          暂无符合条件的投稿。
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => (
          <article
            key={s.id}
            className="min-w-0 overflow-hidden rounded-xl border"
          >
            <img
              src={s.thumbnailUrl}
              alt={`${s.name}投稿缩略图`}
              className="h-44 w-full bg-muted object-contain"
              loading="lazy"
            />
            <div className="space-y-2 p-3">
              <h3 className="break-words font-semibold">{s.name}</h3>
              <p className="text-xs text-muted-foreground">
                {LABEL[s.status]} ·{" "}
                {categories.find((c) => c.id === s.category)?.label ??
                  s.category}{" "}
                · {s.parameterCount} 个参数
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(s.submittedAt).toLocaleString("zh-CN")} ·{" "}
                {s.submitter || "匿名提交"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(s.id)}
                >
                  查看详情
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      confirm(
                        s.status === "published"
                          ? `删除“${s.name}”会同时移除已发布模板，已有个人副本保留。确认删除？`
                          : `确认删除投稿“${s.name}”及其文件？`,
                      )
                    )
                      if (
                        await mutate(`/api/admin/templates/${s.id}`, "DELETE", {
                          revision: s.revision,
                        })
                      )
                        if (selected === s.id) setSelected("");
                  }}
                >
                  删除投稿
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {current && (
        <SubmissionDetail
          key={`${current.id}:${current.revision}`}
          submission={current}
          categories={categories}
          busy={busy}
          mutate={mutate}
          close={() => setSelected("")}
        />
      )}
    </section>
  );
}
function SubmissionDetail({
  submission: s,
  categories,
  busy,
  mutate,
  close,
}: { submission: ManagedSubmission; close: () => void } & Omit<
  Props,
  "submissions"
>) {
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    region.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const [name, setName] = useState(s.name),
    [category, setCategory] = useState(s.category),
    [description, setDescription] = useState(s.description),
    [tags, setTags] = useState(s.tags.join("，")),
    [reviewNote, setReviewNote] = useState(""),
    [doc, setDoc] = useState<TemplateDoc | null>(null),
    [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError("");
    setDoc(null);
    setPreview("");
    (async () => {
      try {
        const response = await fetch(s.packageUrl, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("投稿文件暂不可用，请刷新列表或重新读取");
        const prepared = await prepareSharedTemplate(
          new File([await response.blob()], "review.json", {
            type: "application/json",
          }),
        );
        if (!cancelled) {
          setDoc(prepared.doc);
          setPreview(prepared.preview);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "投稿详情读取失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [s.packageUrl, retry]);
  return (
    <section
      ref={region}
      role="region"
      aria-label="投稿详情"
      className="space-y-5 rounded-xl border p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">投稿详情 · {LABEL[s.status]}</h2>
        <Button variant="outline" onClick={close}>
          关闭详情
        </Button>
      </div>
      <p className="break-all text-xs text-muted-foreground">
        提交编号：{s.id} · {s.width} × {s.height} px ·{" "}
        {new Date(s.submittedAt).toLocaleString("zh-CN")}
      </p>
      {loading && <p role="status">正在读取实际模板并生成审核预览…</p>}
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            重新读取投稿详情
          </Button>
        </div>
      )}
      {preview && (
        <img
          src={preview}
          alt="投稿实际模板预览"
          className="max-h-[600px] max-w-full rounded border bg-muted object-contain"
        />
      )}
      <dl className="grid gap-3 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">提交者</dt>
          <dd className="break-all">{s.submitter || "未填写"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">联系方式（仅后台可见）</dt>
          <dd className="break-all">{s.contact || "未填写"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">投稿备注</dt>
          <dd className="whitespace-pre-wrap break-words">
            {s.note || "未填写"}
          </dd>
        </div>
        {s.reviewNote && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">审核备注</dt>
            <dd className="whitespace-pre-wrap break-words">{s.reviewNote}</dd>
          </div>
        )}
      </dl>
      {doc && (
        <details open className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">
            模板参数（{doc.parameters.length} 个）
          </summary>
          <div className="mt-3 space-y-3">
            {doc.parameters.map((p) => (
              <div key={p.id} className="min-w-0 rounded border p-3 text-sm">
                <p className="break-words font-medium">
                  {p.name} · {p.type} · {p.editable ? "可编辑" : "锁定"}
                </p>
                <p className="break-words">
                  默认值：
                  {typeof p.defaultValue === "object"
                    ? p.type === "image"
                      ? "图片参数"
                      : "未设置"
                    : String(p.defaultValue ?? "未设置")}
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-muted-foreground">
                  {JSON.stringify({...p.rules,...(p.order?{order:p.order}:{}),...(p.card?{card:p.card}:{})}, null, 2)}
                </pre>
              </div>
            ))}
            {!doc.parameters.length && (
              <p className="text-sm text-muted-foreground">
                没有可编辑参数，仍可查看图层和原始模板文件。
              </p>
            )}
          </div>
        </details>
      )}
      <Button asChild variant="outline">
        <a href={s.packageUrl} target="_blank" rel="noreferrer">
          查看完整模板文件
        </a>
      </Button>
      <form
        aria-label="审核投稿"
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!doc || s.status !== "pending") return;
          if (
            await mutate(`/api/admin/submissions/${s.id}/approve`, "POST", {
              name,
              category,
              description,
              tags: tags
                .split(/[,，]/)
                .map((t) => t.trim())
                .filter(Boolean),
              position: s.position,
              published: true,
              revision: s.revision,
            })
          )
            close();
        }}
      >
        <fieldset
          disabled={busy || s.status !== "pending"}
          className="min-w-0 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              发布名称
              <Input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              发布分类
              <select
                aria-label="投稿发布分类"
                required
                value={category}
                className="h-10 w-full rounded border bg-background px-2"
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.visible ? "" : "（隐藏）"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            发布说明
            <Textarea
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            发布标签
            <Input
              value={tags}
              maxLength={600}
              onChange={(e) => setTags(e.target.value)}
            />
          </label>
          {s.status === "pending" && (
            <label className="block space-y-1 text-sm">
              拒绝备注（可选）
              <Textarea
                maxLength={500}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </label>
          )}
        </fieldset>
        {s.status === "pending" && (
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy || loading || !doc}>
              审核并发布
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (confirm(`确认拒绝投稿“${s.name}”？`))
                  if (
                    await mutate(
                      `/api/admin/submissions/${s.id}/reject`,
                      "POST",
                      { revision: s.revision, reviewNote },
                    )
                  )
                    close();
              }}
            >
              拒绝投稿
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
