import {
  categoryInput,
  templateInput,
  popupSchema,
  DEFAULT_POPUP,
  CMS_MAX_PACKAGE_BYTES,
  type ManagedCategory,
  type ManagedTemplate,
} from "../src/lib/catalog-service/contracts";
import { BUILTIN_TEMPLATES } from "../src/lib/template/builtin";
import {
  parseTemplateFile,
  buildPackage,
  mapImageSources,
} from "../src/lib/template/package";
import { referencedAssetIds } from "../src/lib/template/doc-ops";
import { ApiError, type CmsEnv, type Database } from "./types";
import {
  changePassword,
  validPasswordHash,
  readSession,
  requireSession,
  login,
  logout,
} from "./auth";

type CategoryRow = {
  id: string;
  label: string;
  position: number;
  visible: number;
  revision: number;
};
type TemplateRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string;
  position: number;
  published: number;
  revision: number;
  width: number;
  height: number;
  parameter_count: number;
  package_key: string;
  thumbnail_key: string;
  created_at: number;
  updated_at: number;
};
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const category = (r: CategoryRow): ManagedCategory => ({
  ...r,
  visible: !!r.visible,
});
const template = (r: TemplateRow, admin = false): ManagedTemplate => ({
  id: r.id,
  name: r.name,
  category: r.category,
  description: r.description,
  tags: JSON.parse(r.tags),
  position: r.position,
  published: !!r.published,
  revision: r.revision,
  width: r.width,
  height: r.height,
  parameterCount: r.parameter_count,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  packageUrl: `/api/${admin ? "admin" : "public"}/templates/${r.id}/package`,
  thumbnailUrl: `/api/${admin ? "admin" : "public"}/templates/${r.id}/thumbnail`,
});
async function popup(db: Database) {
  const row = await db
    .prepare("SELECT payload,revision FROM cms_settings WHERE id='popup'")
    .first<{ payload: string; revision: number }>();
  return row
    ? popupSchema.parse({ ...JSON.parse(row.payload), revision: row.revision })
    : DEFAULT_POPUP;
}
async function catalogue(db: Database, admin = false) {
  const categories = (
    await db
      .prepare(
        `SELECT id,label,position,visible,revision FROM cms_categories ${admin ? "" : "WHERE visible=1"} ORDER BY position,id`,
      )
      .all<CategoryRow>()
  ).results.map(category);
  const rows = (
    await db
      .prepare(
        `SELECT t.* FROM cms_templates t JOIN cms_categories c ON c.id=t.category ${admin ? "" : "WHERE t.published=1 AND c.visible=1"} ORDER BY t.position,t.created_at DESC LIMIT 1000`,
      )
      .all<TemplateRow>()
  ).results;
  return {
    categories,
    templates: rows.map((r) => template(r, admin)),
    popup: await popup(db),
  };
}
async function body(request: Request, max = 32 * 1024) {
  const bytes = await bounded(request, max);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "请求不是有效 JSON");
  }
}
async function bounded(request: Request, max: number) {
  if (Number(request.headers.get("Content-Length") ?? 0) > max)
    throw new ApiError(413, "上传内容超过限制");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "请求内容为空");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new ApiError(413, "上传内容超过限制");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
function parsed<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: { message: string }[] } };
  },
  value: unknown,
) {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new ApiError(400, r.error.issues[0]?.message ?? "输入无效");
  return r.data;
}
const audit = (db: Database, action: string, id: string) =>
  db
    .prepare(
      "INSERT INTO cms_audit(action,object_id,created_at) SELECT ?,?,? WHERE changes()>0",
    )
    .bind(action, id, Date.now());
async function update(
  db: Database,
  statement: ReturnType<Database["prepare"]>,
  action: string,
  id: string,
) {
  const results = await db.batch([statement, audit(db, action, id)]);
  if (!results[0].meta.changes)
    throw new ApiError(
      409,
      "内容已被其他管理员修改或删除，请刷新后重试",
      "CONFLICT",
    );
}
async function getCategory(db: Database, id: string) {
  const r = await db
    .prepare(
      "SELECT id,label,position,visible,revision FROM cms_categories WHERE id=?",
    )
    .bind(id)
    .first<CategoryRow>();
  if (!r) throw new ApiError(400, "请选择存在的分类");
  return r;
}
async function gc(env: CmsEnv) {
  const db = env.CATALOG_DB!;
  const rows = (
    await db.prepare("SELECT key FROM cms_gc LIMIT 10").all<{ key: string }>()
  ).results;
  for (const row of rows) {
    try {
      await env.CATALOG_FILES!.delete(row.key);
      await db.prepare("DELETE FROM cms_gc WHERE key=?").bind(row.key).run();
    } catch {
      /* Retried on the next admin request. */
    }
  }
}
function checkAssets(pkg: {
  doc: Parameters<typeof referencedAssetIds>[0];
  assets: {
    id: string;
    mime: string;
    data: string;
    width: number;
    height: number;
  }[];
}) {
  const have = new Set(pkg.assets.map((a) => a.id));
  if (referencedAssetIds(pkg.doc).some((id) => !have.has(id)))
    throw new ApiError(400, "文件缺少引用图片，请导出包含图片的完整模板");
  let external = false;
  mapImageSources(pkg.doc, (src) => {
    if (src.kind === "url") external = true;
    return src;
  });
  if (external)
    throw new ApiError(
      400,
      "请先将外部图片保存到模板，再导出包含图片的完整文件",
    );
  if (pkg.assets.length > 200)
    throw new ApiError(400, "单个模板最多包含 200 张图片");
  for (const a of pkg.assets) {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(a.mime) ||
      a.width * a.height > 40e6 ||
      a.width > 16000 ||
      a.height > 16000
    )
      throw new ApiError(
        400,
        "模板图片仅支持 PNG、JPEG、WebP，单张最多 4000 万像素",
      );
    const head = atob(a.data.slice(0, 64)),
      png = head.startsWith("\x89PNG\r\n\x1a\n"),
      jpeg = head.startsWith("\xff\xd8\xff"),
      webp = head.startsWith("RIFF") && head.slice(8, 12) === "WEBP";
    if (!(
      (a.mime === "image/png" && png) ||
      (a.mime === "image/jpeg" && jpeg) ||
      (a.mime === "image/webp" && webp)
    ))
      throw new ApiError(400, "模板图片内容与格式不符");
  }
  if (
    pkg.doc.canvas.width > 16000 ||
    pkg.doc.canvas.height > 16000 ||
    pkg.doc.canvas.width * pkg.doc.canvas.height > 40e6
  )
    throw new ApiError(400, "模板画布尺寸过大");
}
async function upload(request: Request, env: CmsEnv) {
  const db = env.CATALOG_DB!,
    raw = await bounded(request, CMS_MAX_PACKAGE_BYTES + 3 * 1024 * 1024);
  const form = await new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": request.headers.get("Content-Type") ?? "" },
    body: raw,
  }).formData();
  const file = form.get("file"),
    thumbnail = form.get("thumbnail");
  if (!(file instanceof File) || !(thumbnail instanceof File))
    throw new ApiError(400, "请选择模板文件及预览图");
  if (file.size > CMS_MAX_PACKAGE_BYTES || thumbnail.size > 2 * 1024 * 1024)
    throw new ApiError(413, "模板最多 20MB，预览图最多 2MB");
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new ApiError(400, "模板不是有效的 JSON 文件");
  }
  const p = parseTemplateFile(data);
  if (!p.ok) throw new ApiError(400, p.error);
  checkAssets(p);
  const meta = parsed(templateInput, {
    name: form.get("name") || p.doc.name,
    category: form.get("category"),
    description: form.get("description") ?? "",
    tags: JSON.parse(String(form.get("tags") ?? "[]")),
    position: Number(form.get("position") ?? 0),
    published: false,
    revision: 0,
  });
  await getCategory(db, meta.category);
  if (
    (await db
      .prepare("SELECT COUNT(*) AS n FROM cms_templates")
      .first<{ n: number }>())!.n >= 1000
  )
    throw new ApiError(
      400,
      "当前最多保存 1000 套上传模板，请先清理不再使用的草稿",
    );
  const thumb = new Uint8Array(await thumbnail.arrayBuffer());
  if (
    thumb.length < 24 ||
    !Array.from([137, 80, 78, 71, 13, 10, 26, 10]).every(
      (b, i) => thumb[i] === b,
    )
  )
    throw new ApiError(400, "预览图需要 PNG 格式");
  const view = new DataView(thumb.buffer);
  if (
    !view.getUint32(16) ||
    !view.getUint32(20) ||
    view.getUint32(16) > 2048 ||
    view.getUint32(20) > 2048
  )
    throw new ApiError(400, "预览图边长不能超过 2048 像素");
  const id = crypto.randomUUID(),
    key = `templates/${id}/package.json`,
    thumbKey = `templates/${id}/thumbnail.png`,
    now = Date.now();
  try {
    await env.CATALOG_FILES!.put(
      key,
      JSON.stringify(buildPackage(p.doc, p.assets)),
      { httpMetadata: { contentType: "application/json" } },
    );
    await env.CATALOG_FILES!.put(thumbKey, thumb, {
      httpMetadata: { contentType: "image/png" },
    });
    await db.batch([
      db
        .prepare(
          "INSERT INTO cms_templates(id,name,category,description,tags,position,published,revision,width,height,parameter_count,package_key,thumbnail_key,created_at,updated_at) VALUES(?,?,?,?,?,?,0,1,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          meta.name,
          meta.category,
          meta.description,
          JSON.stringify(meta.tags),
          meta.position,
          p.doc.canvas.width,
          p.doc.canvas.height,
          p.doc.parameters.length,
          key,
          thumbKey,
          now,
          now,
        ),
      audit(db, "template.upload", id),
    ]);
  } catch (error) {
    await env.CATALOG_FILES!.delete([key, thumbKey]).catch(() => undefined);
    throw error;
  }
  return json({ id, revision: 1, warnings: p.warnings }, 201);
}
export async function handleApi(
  request: Request,
  env: CmsEnv,
): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, ""),
    db = env.CATALOG_DB;
  const missing = [
    ...(!db ? ["CATALOG_DB"] : []),
    ...(!env.CATALOG_FILES ? ["CATALOG_FILES"] : []),
    ...(!validPasswordHash(env.ADMIN_PASSWORD_HASH)
      ? ["ADMIN_PASSWORD_HASH"]
      : []),
  ];
  try {
    if (path === "admin/status" && request.method === "GET") {
      let migrated = false;
      if (db) {
        try {
          await db.prepare("SELECT id FROM cms_categories LIMIT 1").first();
          migrated = true;
        } catch {
          /* The setup page shows the migration step. */
        }
      }
      return json({
        enabled: missing.length === 0 && migrated,
        missing,
        migrated,
      });
    }
    if (!db || !env.CATALOG_FILES)
      return json(
        {
          enabled: false,
          message: "共享模板服务未启用，请配置 Cloudflare D1 和 R2",
          code: "NOT_CONFIGURED",
        },
        503,
      );
    if (path === "public/catalog" && request.method === "GET")
      return json({ enabled: true, ...(await catalogue(db)) });
    if (!path.startsWith("admin/") && !path.startsWith("public/"))
      throw new ApiError(404, "接口不存在");
    if (path.startsWith("admin/")) {
      if (missing.length)
        throw new ApiError(503, "管理后台未配置完成", "NOT_CONFIGURED");
      if (path === "admin/login" && request.method === "POST") {
        const result = await login(request, env, await body(request));
        return json({ authenticated: true, csrf: result.csrf }, 200, {
          "Set-Cookie": result.cookie,
        });
      }
      if (path === "admin/session" && request.method === "GET") {
        const session = await readSession(request, env);
        return json({
          authenticated: !!session,
          ...(session ? { csrf: session.csrf } : {}),
        });
      }
      await requireSession(request, env);
      if (path === "admin/password" && request.method === "POST")
        return json({ authenticated: false }, 200, {
          "Set-Cookie": await changePassword(request, env, await body(request)),
        });
      if (path === "admin/logout" && request.method === "POST")
        return json({ authenticated: false }, 200, {
          "Set-Cookie": await logout(request, db),
        });
      if (path === "admin/catalog" && request.method === "GET") {
        await gc(env);
        return json(await catalogue(db, true));
      }
      if (path === "admin/audit" && request.method === "GET")
        return json(
          (
            await db
              .prepare(
                "SELECT id,action,object_id,created_at FROM cms_audit ORDER BY id DESC LIMIT 100",
              )
              .all()
          ).results,
        );
      if (path === "admin/categories" && request.method === "POST") {
        const data = parsed(categoryInput, await body(request));
        if (data.revision !== 0) throw new ApiError(400, "新增分类版本不正确");
        if (
          (await db
            .prepare("SELECT COUNT(*) AS n FROM cms_categories")
            .first<{ n: number }>())!.n >= 100
        )
          throw new ApiError(400, "最多创建 100 个分类");
        const now = Date.now();
        await db.batch([
          db
            .prepare(
              "INSERT INTO cms_categories(id,label,position,visible,revision,created_at,updated_at) VALUES(?,?,?,?,1,?,?)",
            )
            .bind(
              data.id,
              data.label,
              data.position,
              Number(data.visible),
              now,
              now,
            ),
          audit(db, "category.create", data.id),
        ]);
        return json({ revision: 1 }, 201);
      }
      const cat = path.match(/^admin\/categories\/([a-z][a-z0-9-]{0,59})$/);
      if (cat && request.method === "PUT") {
        const data = parsed(categoryInput, {
          ...(await body(request)),
          id: cat[1],
        });
        await update(
          db,
          db
            .prepare(
              "UPDATE cms_categories SET label=?,position=?,visible=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
            )
            .bind(
              data.label,
              data.position,
              Number(data.visible),
              Date.now(),
              data.id,
              data.revision,
            ),
          "category.update",
          data.id,
        );
        return json({ revision: data.revision + 1 });
      }
      if (cat && request.method === "DELETE") {
        if (BUILTIN_TEMPLATES.some((t) => t.category === cat[1]))
          throw new ApiError(409, "分类仍有内置模板，可将分类隐藏");
        const data = await body(request);
        if (!Number.isInteger(data.revision))
          throw new ApiError(400, "缺少分类版本");
        await update(
          db,
          db
            .prepare(
              "DELETE FROM cms_categories WHERE id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM cms_templates WHERE category=?)",
            )
            .bind(cat[1], data.revision, cat[1]),
          "category.delete",
          cat[1],
        );
        return json({ deleted: true });
      }
      if (path === "admin/popup" && request.method === "PUT") {
        const data = parsed(popupSchema, await body(request));
        const now = Date.now();
        const result = await db.batch([
          db
            .prepare(
              "INSERT INTO cms_settings(id,payload,revision,updated_at) SELECT 'popup',?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM cms_settings WHERE id='popup') ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=cms_settings.revision+1,updated_at=excluded.updated_at WHERE cms_settings.revision=?",
            )
            .bind(JSON.stringify(data), now, data.revision, data.revision),
          audit(db, "popup.update", "popup"),
        ]);
        if (!result[0].meta.changes)
          throw new ApiError(
            409,
            "弹窗已被其他管理员更新，请刷新后重试",
            "CONFLICT",
          );
        return json({ revision: data.revision + 1 });
      }
      if (path === "admin/templates" && request.method === "POST")
        return await upload(request, env);
      const item = path.match(/^admin\/templates\/([a-f0-9-]{36})$/);
      if (item && request.method === "PUT") {
        const data = parsed(templateInput, await body(request)),
          c = await getCategory(db, data.category);
        if (data.published && !c.visible)
          throw new ApiError(400, "请先启用分类，再发布模板");
        await update(
          db,
          db
            .prepare(
              "UPDATE cms_templates SET name=?,category=?,description=?,tags=?,position=?,published=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
            )
            .bind(
              data.name,
              data.category,
              data.description,
              JSON.stringify(data.tags),
              data.position,
              Number(data.published),
              Date.now(),
              item[1],
              data.revision,
            ),
          data.published ? "template.publish" : "template.save",
          item[1],
        );
        return json({ revision: data.revision + 1 });
      }
      if (item && request.method === "DELETE") {
        const data = await body(request);
        if (!Number.isInteger(data.revision))
          throw new ApiError(400, "缺少模板版本");
        const results = await db.batch([
          db
            .prepare(
              "INSERT OR IGNORE INTO cms_gc(key) SELECT package_key FROM cms_templates WHERE id=? AND revision=?",
            )
            .bind(item[1], data.revision),
          db
            .prepare(
              "INSERT OR IGNORE INTO cms_gc(key) SELECT thumbnail_key FROM cms_templates WHERE id=? AND revision=?",
            )
            .bind(item[1], data.revision),
          db
            .prepare("DELETE FROM cms_templates WHERE id=? AND revision=?")
            .bind(item[1], data.revision),
          audit(db, "template.delete", item[1]),
        ]);
        if (!results[2].meta.changes)
          throw new ApiError(
            409,
            "模板已被修改或删除，请刷新后重试",
            "CONFLICT",
          );
        await gc(env);
        return json({ deleted: true });
      }
    }
    const file = path.match(
      /^(admin|public)\/templates\/([a-f0-9-]{36})\/(package|thumbnail)$/,
    );
    if (file && request.method === "GET") {
      const row = await db
        .prepare(
          `SELECT t.* FROM cms_templates t JOIN cms_categories c ON c.id=t.category WHERE t.id=? ${file[1] === "public" ? "AND t.published=1 AND c.visible=1" : ""}`,
        )
        .bind(file[2])
        .first<TemplateRow>();
      if (!row) throw new ApiError(404, "模板不存在或尚未发布");
      const data = await env.CATALOG_FILES.get(
        file[3] === "package" ? row.package_key : row.thumbnail_key,
      );
      if (!data) throw new ApiError(404, "模板文件暂不可用");
      return new Response(data.body, {
        headers: {
          "Content-Type":
            file[3] === "package"
              ? "application/json; charset=utf-8"
              : "image/png",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
    throw new ApiError(404, "接口不存在");
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message, code: error.code }, error.status);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint"))
      return json(
        { error: "分类名称或标识已存在，请使用其他名称", code: "CONFLICT" },
        409,
      );
    if (message.includes("no such table"))
      return json(
        {
          enabled: false,
          error: "数据库尚未初始化，请执行 CMS 数据库迁移",
          code: "MIGRATION_REQUIRED",
        },
        503,
      );
    if (error instanceof SyntaxError)
      return json({ error: "请求数据格式不正确", code: "INVALID_DATA" }, 400);
    console.error(
      "CMS request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      { error: "服务暂时不可用，请稍后重试", code: "SERVICE_ERROR" },
      500,
    );
  }
}
