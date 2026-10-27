import {
  useEffect,
  useState,
  cloneElement,
  isValidElement,
  type ReactElement,
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestJson } from "@/lib/catalog-service/client";
import { usePublicCatalog } from "@/lib/catalog-service/provider";
import {
  CMS_MAX_PACKAGE_BYTES,
  type AdminCatalogue,
  type ManagedCategory,
  type ManagedTemplate,
  type PopupSettings,
} from "@/lib/catalog-service/contracts";
import { BUILTIN_TEMPLATES } from "@/lib/template/builtin";
import { parseTemplateFile, mapImageSources } from "@/lib/template/package";
import { renderDoc } from "@/lib/canvas/render";
import { base64ToBlob } from "@/lib/storage/encoding";
import { cloudConfig } from "@/lib/cloud-config";
import { toast } from "sonner";
type Status = { enabled: boolean; missing: string[]; migrated: boolean };
type Mutate = (
  path: string,
  method: string,
  value?: unknown,
) => Promise<boolean>;
export default function AdminPage() {
  const [status, setStatus] = useState<Status | null>(null),
    [auth, setAuth] = useState(false),
    [csrf, setCsrf] = useState(""),
    [data, setData] = useState<AdminCatalogue | null>(null),
    [tab, setTab] = useState("categories"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [hint, setHint] = useState("");
  const { refresh } = usePublicCatalog();
  const load = async () =>
    setData(await requestJson<AdminCatalogue>("/api/admin/catalog"));
  const initialize = async () => {
    setError("");
    try {
      const s = await requestJson<Status>("/api/admin/status");
      setStatus(s);
      if (s.enabled) {
        const session = await requestJson<{
          authenticated: boolean;
          csrf?: string;
        }>("/api/admin/session");
        setAuth(session.authenticated);
        setCsrf(session.csrf ?? "");
        if (session.authenticated) await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "管理接口暂不可用");
    }
  };
  useEffect(() => {
    void initialize();
  }, []);
  const mutate: Mutate = async (path, method, value) => {
    setBusy(true);
    setError("");
    setHint("");
    try {
      await requestJson(path, {
        method,
        headers: { "X-CSRF-Token": csrf },
        ...(value !== undefined
          ? { body: value instanceof FormData ? value : JSON.stringify(value) }
          : {}),
      });
      setHint("设置已保存。");
      toast.success("设置已保存");
      if (path.endsWith("/logout") || path.endsWith("/password")) return true;
      try {
        await load();
        await refresh();
      } catch {
        setError("保存已完成，但列表刷新失败，请重新加载。");
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      if ((e as { status?: number }).status === 401) {
        setAuth(false);
        setCsrf("");
      }
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">管理后台</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理公开分类、共享模板和网站弹窗。前台访客无需登录。
          </p>
        </div>
        {auth && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void initialize()}
            >
              刷新列表
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                if (await mutate("/api/admin/logout", "POST")) {
                  setAuth(false);
                  setCsrf("");
                  setData(null);
                }
              }}
            >
              退出登录
            </Button>
          </div>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {hint && auth && (
        <p role="status" className="text-sm text-green-700">
          {hint}
        </p>
      )}
      {!status && !error && <p role="status">正在检查后台服务…</p>}
      {status && !status.enabled && (
        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="text-xl font-semibold">后台服务尚未启用</h2>
          <p>
            需要在 Cloudflare 为当前 Pages 项目绑定 D1 数据库和 R2
            存储，再设置管理员密码摘要并初始化数据库。
          </p>
          {status.missing.length > 0 && (
            <p className="break-all text-sm">
              待配置：{status.missing.join("、")}
            </p>
          )}
          {!status.migrated && (
            <p className="text-sm">
              数据库尚未初始化，请执行项目中的 CMS 数据库迁移。
            </p>
          )}
          <a
            className="text-primary underline"
            href="https://github.com/haiwai007/new/blob/main/docs/ADMIN_CMS.zh-CN.md"
            target="_blank"
            rel="noreferrer"
          >
            查看后台启用步骤
          </a>
          <p className="text-sm text-muted-foreground">
            前台的内置模板和本地作图仍可使用，不会显示模拟上传成功。
          </p>
          <Button variant="outline" onClick={() => void initialize()}>
            重新检查配置
          </Button>
        </section>
      )}
      {status?.enabled && !auth && (
        <Login
          onLogin={async (username, password) => {
            setBusy(true);
            setError("");
            try {
              const session = await requestJson<{ csrf: string }>(
                "/api/admin/login",
                {
                  method: "POST",
                  body: JSON.stringify({ username, password }),
                },
              );
              setCsrf(session.csrf);
              setAuth(true);
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "登录失败");
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}
      {auth && !data && <p role="status">正在读取管理内容…</p>}
      {auth && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["分类", data.categories.length],
              ["已上传模板", data.templates.length],
              ["已发布", data.templates.filter((t) => t.published).length],
            ].map(([label, n]) => (
              <div key={label} className="rounded-xl border p-4 text-sm">
                {label}
                <strong className="mt-1 block text-2xl">{n}</strong>
              </div>
            ))}
          </div>
          <nav aria-label="内容管理模块" className="flex flex-wrap gap-2">
            {[
              ["categories", "分类管理"],
              ["templates", "模板管理"],
              ["popup", "弹窗设置"],
              ["audit", "操作记录"],
              ["password", "修改密码"],
            ].map(([key, label]) => (
              <Button
                key={key}
                variant={tab === key ? "default" : "outline"}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </Button>
            ))}
          </nav>
          {tab === "categories" && (
            <Categories data={data} busy={busy} mutate={mutate} />
          )}
          {tab === "templates" && (
            <Templates data={data} busy={busy} mutate={mutate} />
          )}
          {tab === "popup" && (
            <Popup
              key={data.popup.revision}
              value={data.popup}
              busy={busy}
              mutate={mutate}
            />
          )}
          {tab === "audit" && <Audit />}
          {tab === "password" && (
            <PasswordSettings
              busy={busy}
              onSave={async (currentPassword, newPassword) => {
                if (
                  await mutate("/api/admin/password", "POST", {
                    currentPassword,
                    newPassword,
                  })
                ) {
                  setAuth(false);
                  setCsrf("");
                  setData(null);
                  setHint("密码已修改，请使用新密码重新登录。");
                }
              }}
            />
          )}
        </>
      )}
      {cloudConfig.enabled && (
        <p className="text-sm">
          <Link className="text-primary underline" to="/admin/cloud">
            打开原云端账户与备份管理
          </Link>
        </p>
      )}
    </div>
  );
}
function PasswordSettings({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      aria-label="修改管理员密码"
      className="max-w-md space-y-4 rounded-xl border p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (next !== confirm) {
          setError("两次输入的新密码不一致");
          return;
        }
        await onSave(current, next);
      }}
    >
      <h2 className="font-semibold">修改管理员密码</h2>
      <p className="text-sm text-muted-foreground">
        新密码至少 12
        个字符。修改后所有后台会话退出，需要重新登录；不需要重新部署网站。
      </p>
      <Field label="当前密码">
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <Field label="新密码">
        <Input
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </Field>
      <Field label="确认新密码">
        <Input
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy} type="submit">
        保存新密码
      </Button>
    </form>
  );
}
function Login({
  onLogin,
  busy,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
  busy: boolean;
}) {
  const [username, setUsername] = useState("admin"),
    [password, setPassword] = useState("");
  return (
    <form
      aria-label="管理员登录"
      className="mx-auto max-w-md space-y-4 rounded-xl border p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        await onLogin(username, password);
        setPassword("");
      }}
    >
      <h2 className="text-xl font-semibold">管理员登录</h2>
      <Field label="管理员账号">
        <Input
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={busy}
        />
      </Field>
      <Field label="管理员密码">
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? "正在登录…" : "登录后台"}
      </Button>
    </form>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const element = isValidElement(children)
    ? (children as ReactElement<{ "aria-label"?: string }>)
    : null;
  return (
    <label className="block space-y-1.5 text-sm">
      {label}
      {element
        ? cloneElement(element, {
            "aria-label": element.props["aria-label"] ?? label,
          })
        : children}
    </label>
  );
}
function Categories({
  data,
  busy,
  mutate,
}: {
  data: AdminCatalogue;
  busy: boolean;
  mutate: Mutate;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [editorVersion, setEditorVersion] = useState(0);
  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">分类管理</h2>
        <p className="text-sm text-muted-foreground">
          修改名称、排序或显示状态；排序数字越小越靠前。隐藏分类同时隐藏其中的前台模板。
        </p>
        {data.categories.map((c) => {
          const count =
            data.templates.filter((t) => t.category === c.id).length +
            BUILTIN_TEMPLATES.filter((t) => t.category === c.id).length;
          return (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <strong>{c.label}</strong>
                <p className="text-xs text-muted-foreground">
                  {count} 套模板 · 顺序 {c.position} ·{" "}
                  {c.visible ? "显示" : "隐藏"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelected(c.id)}
              >
                编辑分类
              </Button>
            </div>
          );
        })}
        <Button
          variant="secondary"
          onClick={() => {
            setSelected(null);
            setEditorVersion((v) => v + 1);
          }}
        >
          新增分类
        </Button>
      </div>
      <CategoryEditor
        key={`${editorVersion}:${selected ?? "new"}:${data.categories.find((c) => c.id === selected)?.revision ?? 0}`}
        category={data.categories.find((c) => c.id === selected)}
        count={
          selected
            ? data.templates.filter((t) => t.category === selected).length +
              BUILTIN_TEMPLATES.filter((t) => t.category === selected).length
            : 0
        }
        busy={busy}
        mutate={mutate}
        onDone={() => {
          setSelected(null);
          setEditorVersion((v) => v + 1);
        }}
      />
    </section>
  );
}
function CategoryEditor({
  category,
  count,
  busy,
  mutate,
  onDone,
}: {
  category?: ManagedCategory;
  count: number;
  busy: boolean;
  mutate: Mutate;
  onDone: () => void;
}) {
  const [id] = useState(
      category?.id ?? `cat-${crypto.randomUUID().slice(0, 12)}`,
    ),
    [label, setLabel] = useState(category?.label ?? ""),
    [position, setPosition] = useState(category?.position ?? 100),
    [visible, setVisible] = useState(category?.visible ?? true);
  return (
    <form
      aria-label="分类编辑"
      className="h-fit space-y-4 rounded-xl border p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await mutate(
            category ? `/api/admin/categories/${id}` : "/api/admin/categories",
            category ? "PUT" : "POST",
            { id, label, position, visible, revision: category?.revision ?? 0 },
          )
        )
          onDone();
      }}
    >
      <h3 className="font-semibold">{category ? "编辑分类" : "新增分类"}</h3>
      <Field label="分类名称">
        <Input
          maxLength={40}
          required
          value={label}
          disabled={busy}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <Field label="分类顺序">
        <Input
          type="number"
          min={0}
          max={100000}
          required
          value={position}
          disabled={busy}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={visible}
          disabled={busy}
          onChange={(e) => setVisible(e.target.checked)}
        />
        在前台显示分类
      </label>
      <Button disabled={busy} type="submit">
        保存分类
      </Button>
      {category && (
        <Button
          type="button"
          className="ml-2"
          variant="destructive"
          disabled={busy || count > 0}
          title={count ? "分类仍有模板，可先隐藏分类" : "删除空分类"}
          onClick={async () => {
            if (
              confirm(`确认删除空分类“${label}”？`) &&
              (await mutate(`/api/admin/categories/${id}`, "DELETE", {
                revision: category.revision,
              }))
            )
              onDone();
          }}
        >
          删除分类
        </Button>
      )}
      {category && count > 0 && (
        <p className="text-xs text-muted-foreground">
          分类内仍有模板，可隐藏；移走上传模板后可删除空分类。
        </p>
      )}
    </form>
  );
}
function Templates({
  data,
  busy,
  mutate,
}: {
  data: AdminCatalogue;
  busy: boolean;
  mutate: Mutate;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section className="space-y-5">
      <Upload categories={data.categories} busy={busy} mutate={mutate} />
      <div>
        <h2 className="text-xl font-semibold">已上传模板</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          只有已发布且分类可见的模板才会展示给访客。内置模板继续保留在原分类中。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.templates.map((t) => (
          <article key={t.id} className="overflow-hidden rounded-xl border">
            <img
              alt={t.name}
              src={t.thumbnailUrl}
              loading="lazy"
              className="h-48 w-full bg-muted object-contain"
            />
            <div className="space-y-2 p-3">
              <strong className="block break-words">{t.name}</strong>
              <p className="text-xs text-muted-foreground">
                {data.categories.find((c) => c.id === t.category)?.label} ·{" "}
                {t.width}×{t.height} · {t.parameterCount} 个参数 ·{" "}
                {t.published ? "已发布" : "草稿"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setSelected(t.id)}
                >
                  编辑模板
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void mutate(`/api/admin/templates/${t.id}`, "PUT", {
                      ...t,
                      published: !t.published,
                    })
                  }
                >
                  {t.published ? "下架" : "发布"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        `确认删除模板“${t.name}”？已创建的个人作品不会删除。`,
                      )
                    )
                      void mutate(`/api/admin/templates/${t.id}`, "DELETE", {
                        revision: t.revision,
                      });
                  }}
                >
                  删除
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!data.templates.length && (
        <p className="rounded-xl border border-dashed p-6 text-muted-foreground">
          尚未上传共享模板。
        </p>
      )}
      {selected && data.templates.find((t) => t.id === selected) && (
        <TemplateEditor
          key={`${selected}:${data.templates.find((t) => t.id === selected)!.revision}`}
          template={data.templates.find((t) => t.id === selected)!}
          categories={data.categories}
          busy={busy}
          mutate={mutate}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function CategorySelect({
  categories,
  value,
  onChange,
  disabled = false,
}: {
  categories: ManagedCategory[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label="模板所属分类"
      value={value}
      disabled={disabled}
      required
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded border bg-background px-2"
    >
      <option value="">请选择分类</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
          {c.visible ? "" : "（隐藏）"}
        </option>
      ))}
    </select>
  );
}
function Upload({
  categories,
  busy,
  mutate,
}: {
  categories: ManagedCategory[];
  busy: boolean;
  mutate: Mutate;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [name, setName] = useState(""),
    [category, setCategory] = useState(""),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-4 rounded-xl border p-5"
      aria-label="上传共享模板"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file || !preview) return;
        const data = new FormData();
        data.set("file", file);
        data.set(
          "thumbnail",
          base64ToBlob(preview.split(",")[1], "image/png"),
          "thumbnail.png",
        );
        data.set("name", name);
        data.set("category", category);
        data.set("tags", "[]");
        if (await mutate("/api/admin/templates", "POST", data)) {
          setFile(null);
          setPreview("");
          setName("");
        }
      }}
    >
      <h2 className="text-xl font-semibold">上传模板</h2>
      <p className="text-sm text-muted-foreground">
        选择编辑器导出的 .haishen.json／JSON 模板文件，需包含图片，最大
        20MB。上传后保存为草稿，检查预览后再发布。
      </p>
      <input
        aria-label="选择共享模板文件"
        className="block max-w-full text-sm"
        type="file"
        accept=".json,application/json"
        disabled={busy || preparing}
        onChange={async (e) => {
          const next = e.target.files?.[0];
          e.target.value = "";
          if (!next) return;
          setPreparing(true);
          setError("");
          setFile(null);
          setPreview("");
          try {
            if (next.size > CMS_MAX_PACKAGE_BYTES)
              throw new Error("模板文件不能超过 20MB");
            const parsed = parseTemplateFile(JSON.parse(await next.text()));
            if (!parsed.ok) throw new Error(parsed.error);
            if (
              parsed.assets.some(
                (a) =>
                  !["image/png", "image/jpeg", "image/webp"].includes(a.mime),
              )
            )
              throw new Error("模板图片仅支持 PNG、JPEG 和 WebP");
            const images = new Map(
              parsed.assets.map((a) => [
                a.id,
                `data:${a.mime};base64,${a.data}`,
              ]),
            );
            const doc = mapImageSources(parsed.doc, (src) => {
              if (src.kind === "url" || !images.has(src.assetId))
                throw new Error("请导出包含全部图片的完整模板文件");
              return { kind: "url", url: images.get(src.assetId)! };
            });
            const { canvas } = await renderDoc(doc, {
              multiplier: Math.min(
                1,
                480 / Math.max(doc.canvas.width, doc.canvas.height),
              ),
            });
            let image = "";
            try {
              image = canvas.toDataURL("image/png");
            } finally {
              canvas.width = canvas.height = 0;
            }
            setPreview(image);
            setFile(next);
            setName(parsed.doc.name.slice(0, 120));
          } catch (e) {
            setError(e instanceof Error ? e.message : "模板读取失败");
          } finally {
            setPreparing(false);
          }
        }}
      />
      {preparing && <p role="status">正在读取模板并生成真实预览…</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {file && (
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <img
            src={preview}
            alt="待上传模板预览"
            className="max-h-56 w-full bg-muted object-contain"
          />
          <div className="space-y-3">
            <Field label="模板名称">
              <Input
                required
                maxLength={120}
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="模板分类">
              <CategorySelect
                categories={categories}
                value={category}
                onChange={setCategory}
                disabled={busy}
              />
            </Field>
            <Button type="submit" disabled={busy || preparing || !category}>
              上传为草稿
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
function TemplateEditor({
  template: t,
  categories,
  busy,
  mutate,
  close,
}: {
  template: ManagedTemplate;
  categories: ManagedCategory[];
  busy: boolean;
  mutate: Mutate;
  close: () => void;
}) {
  const [name, setName] = useState(t.name),
    [category, setCategory] = useState(t.category),
    [description, setDescription] = useState(t.description),
    [tags, setTags] = useState(t.tags.join("，")),
    [position, setPosition] = useState(t.position),
    [published, setPublished] = useState(t.published);
  return (
    <form
      aria-label="编辑共享模板"
      className="space-y-4 rounded-xl border p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await mutate(`/api/admin/templates/${t.id}`, "PUT", {
            name,
            category,
            description,
            tags: tags
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean),
            position,
            published,
            revision: t.revision,
          })
        )
          close();
      }}
    >
      <h3 className="text-lg font-semibold">编辑模板 · {t.name}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="模板名称">
          <Input
            required
            value={name}
            maxLength={120}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="模板分类">
          <CategorySelect
            categories={categories}
            value={category}
            onChange={setCategory}
            disabled={busy}
          />
        </Field>
        <Field label="模板标签">
          <Input
            value={tags}
            disabled={busy}
            onChange={(e) => setTags(e.target.value)}
            placeholder="用逗号分隔，最多 20 个"
          />
        </Field>
        <Field label="模板顺序">
          <Input
            required
            type="number"
            min={0}
            max={100000}
            value={position}
            disabled={busy}
            onChange={(e) => setPosition(Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="模板说明">
        <Textarea
          value={description}
          maxLength={300}
          disabled={busy}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={published}
          disabled={busy}
          onChange={(e) => setPublished(e.target.checked)}
        />
        在前台发布
      </label>
      <div className="flex gap-2">
        <Button disabled={busy} type="submit">
          保存模板设置
        </Button>
        <Button disabled={busy} type="button" variant="outline" onClick={close}>
          取消编辑
        </Button>
      </div>
    </form>
  );
}
function Popup({
  value,
  busy,
  mutate,
}: {
  value: PopupSettings;
  busy: boolean;
  mutate: Mutate;
}) {
  const [form, setForm] = useState(value);
  const patch = (data: Partial<PopupSettings>) =>
    setForm((v) => ({ ...v, ...data }));
  return (
    <form
      aria-label="网站弹窗设置"
      className="max-w-2xl space-y-4 rounded-xl border p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await mutate("/api/admin/popup", "PUT", form);
      }}
    >
      <h2 className="text-xl font-semibold">网站弹窗设置</h2>
      <p className="text-sm text-muted-foreground">
        保存后在访客新打开或刷新的页面生效，不打断已打开的编辑器。后台入口不受前台弹窗影响。
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          disabled={busy}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        启用访问弹窗
      </label>
      <Field label="弹窗标题">
        <Input
          required
          value={form.title}
          maxLength={80}
          disabled={busy}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </Field>
      <Field label="弹窗正文">
        <Textarea
          value={form.message}
          maxLength={2000}
          disabled={busy}
          onChange={(e) => patch({ message: e.target.value })}
          placeholder="支持换行，按纯文本显示"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="确认方式">
          <select
            className="h-10 w-full rounded border bg-background px-2"
            value={form.mode}
            disabled={busy}
            onChange={(e) =>
              patch({ mode: e.target.value as PopupSettings["mode"] })
            }
          >
            <option value="button">点击按钮进入</option>
            <option value="phrase">输入指定文字</option>
          </select>
        </Field>
        <Field label="显示频率">
          <select
            className="h-10 w-full rounded border bg-background px-2"
            value={form.frequency}
            disabled={busy}
            onChange={(e) =>
              patch({ frequency: e.target.value as PopupSettings["frequency"] })
            }
          >
            <option value="tab">同一标签页一次</option>
            <option value="visit">每次打开页面</option>
          </select>
        </Field>
      </div>
      {form.mode === "phrase" ? (
        <>
          <Field label="弹窗确认文字">
            <Input
              value={form.phrase}
              maxLength={100}
              required={form.enabled}
              disabled={busy}
              onChange={(e) => patch({ phrase: e.target.value })}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            确认文字只是访客提示，不是管理员密码。
          </p>
        </>
      ) : (
        <Field label="按钮文字">
          <Input
            value={form.buttonText}
            maxLength={40}
            required
            disabled={busy}
            onChange={(e) => patch({ buttonText: e.target.value })}
          />
        </Field>
      )}
      <div className="rounded-lg bg-muted p-4" aria-label="弹窗内容预览">
        <strong className="block">{form.title}</strong>
        <p className="mt-2 whitespace-pre-wrap text-sm">
          {form.message || "确认后进入作图。"}
        </p>
        <span className="mt-3 inline-block rounded bg-primary px-3 py-1 text-sm text-primary-foreground">
          {form.mode === "phrase" ? `输入：${form.phrase}` : form.buttonText}
        </span>
      </div>
      <Button type="submit" disabled={busy}>
        保存弹窗设置
      </Button>
    </form>
  );
}
function Audit() {
  const [rows, setRows] = useState<
      { id: number; action: string; object_id: string; created_at: number }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    requestJson<typeof rows>("/api/admin/audit")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="space-y-3 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">最近 100 条操作记录</h2>
      {error && <p role="alert">{error}</p>}
      {rows.map((r) => (
        <div key={r.id} className="break-all border-b py-2 text-sm">
          {new Date(r.created_at).toLocaleString()} · {r.action} · {r.object_id}
        </div>
      ))}
      {!rows.length && !error && <p>暂无记录。</p>}
    </section>
  );
}
