// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { pbkdf2Sync } from "node:crypto";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { handleApi } from "../../../server/handler";
import type { CmsEnv, Database, SqlStatement } from "../../../server/types";
import { BUILTIN_TEMPLATES } from "../template/builtin";
let sqlite: DatabaseSync, env: CmsEnv;
const password = "Only-For-Cms-Unit-Tests-739!",
  salt = "01020304050607080910111213141516";
const hash = `pbkdf2$100000$${salt}$${pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex")}`;
function adapter(db: DatabaseSync): Database {
  function statement(sql: string, args: unknown[] = []): SqlStatement {
    return {
      bind: (...values) => statement(sql, values),
      first: async <T>() =>
        (db.prepare(sql).get(...(args as never[])) ?? null) as T | null,
      all: async <T>() => ({
        results: db.prepare(sql).all(...(args as never[])) as T[],
      }),
      run: async () => ({
        meta: {
          changes: Number(db.prepare(sql).run(...(args as never[])).changes),
        },
      }),
    };
  }
  return {
    prepare: statement,
    batch: async (statements) => {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        db.exec("COMMIT");
        return results;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL(
        "../../../../../migrations/catalog/0001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const objects = new Map<string, Uint8Array>();
  env = {
    CATALOG_DB: adapter(sqlite),
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD_HASH: hash,
    CATALOG_FILES: {
      put: async (key, value) => {
        objects.set(
          key,
          typeof value === "string"
            ? new TextEncoder().encode(value)
            : new Uint8Array(value),
        );
      },
      get: async (key) => {
        const data = objects.get(key);
        return data
          ? {
              body: new ReadableStream({
                start: (c) => {
                  c.enqueue(data);
                  c.close();
                },
              }),
              arrayBuffer: async () =>
                data.buffer.slice(
                  data.byteOffset,
                  data.byteOffset + data.byteLength,
                ) as ArrayBuffer,
            }
          : null;
      },
      delete: async (keys) => {
        for (const key of typeof keys === "string" ? [keys] : keys)
          objects.delete(key);
      },
    },
  };
});
afterEach(() => sqlite.close());
async function call(
  path: string,
  method = "GET",
  value?: unknown,
  session?: { cookie: string; csrf: string },
  extra: Record<string, string> = {},
) {
  return handleApi(
    new Request(`https://studio.test/api/${path}`, {
      method,
      headers: {
        Origin: "https://studio.test",
        ...(session
          ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf }
          : {}),
        ...extra,
      },
      ...(value !== undefined
        ? { body: value instanceof FormData ? value : JSON.stringify(value) }
        : {}),
    }),
    env,
  );
}
async function admin() {
  const response = await call("admin/login", "POST", {
    username: "admin",
    password,
  });
  expect(response.status).toBe(200);
  const value = await response.json();
  return {
    cookie: response.headers.get("set-cookie")!.split(";")[0],
    csrf: value.csrf as string,
  };
}
function uploadForm(
  doc = structuredClone(
    BUILTIN_TEMPLATES.find((t) => t.id === "blank_square")!.doc,
  ),
) {
  const form = new FormData();
  form.set("name", "测试公开海报");
  form.set("category", "huimin-15");
  form.set(
    "file",
    new File([JSON.stringify(doc)], "template.json", {
      type: "application/json",
    }),
  );
  form.set(
    "thumbnail",
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
          "base64",
        ),
      ],
      "thumbnail.png",
      { type: "image/png" },
    ),
  );
  return form;
}
describe("Cloudflare CMS API", () => {
  it("allows anonymous public reads but protects every administrative write and file route", async () => {
    expect((await call("public/catalog")).status).toBe(200);
    for (const [path, method, value] of [
      ["admin/catalog", "GET"],
      ["admin/categories", "POST", {}],
      ["admin/popup", "PUT", {}],
      ["admin/templates", "POST", uploadForm()],
      ["admin/templates/00000000-0000-0000-0000-000000000001/package", "GET"],
    ] as const)
      expect((await call(path, method, value)).status, path).toBe(401);
    expect(
      (
        await call(
          "admin/login",
          "POST",
          { username: "admin", password },
          undefined,
          { Origin: "https://attacker.test" },
        )
      ).status,
    ).toBe(403);
    const session = await admin();
    const loginCookie = (
      await call("admin/login", "POST", { username: "admin", password })
    ).headers.get("set-cookie")!;
    expect(loginCookie).toContain("HttpOnly");
    expect(loginCookie).toContain("Secure");
    expect(loginCookie).toContain("SameSite=Strict");
    expect(
      (
        await call("admin/categories", "POST", {}, session, {
          "X-CSRF-Token": "wrong",
        })
      ).status,
    ).toBe(403);
    await call("admin/logout", "POST", {}, session);
    expect(
      (await call("admin/catalog", "GET", undefined, session)).status,
    ).toBe(401);
  });
  it("persists throttling across requests and reports missing configuration without fake success", async () => {
    for (let i = 0; i < 5; i++)
      expect(
        (
          await call("admin/login", "POST", {
            username: "admin",
            password: "wrong",
          })
        ).status,
      ).toBe(401);
    expect(
      (await call("admin/login", "POST", { username: "admin", password }))
        .status,
    ).toBe(429);
    const disabled = await handleApi(
      new Request("https://studio.test/api/admin/status"),
      {},
    );
    expect(await disabled.json()).toMatchObject({
      enabled: false,
      migrated: false,
    });
    expect(
      (
        await handleApi(
          new Request("https://studio.test/api/admin/login", {
            method: "POST",
          }),
          {},
        )
      ).status,
    ).toBe(503);
  });
  it("updates category visibility, prevents stale saves and refuses deleting occupied classifications", async () => {
    const session = await admin(),
      value = {
        id: "workshop",
        label: "创意工坊",
        position: 1,
        visible: true,
        revision: 0,
      };
    expect(
      (await call("admin/categories", "POST", value, session)).status,
    ).toBe(201);
    expect(
      (
        await call(
          "admin/categories/workshop",
          "PUT",
          { ...value, visible: false, revision: 1 },
          session,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "admin/categories/workshop",
          "PUT",
          { ...value, revision: 1 },
          session,
        )
      ).status,
    ).toBe(409);
    expect(
      (await (await call("public/catalog")).json()).categories.some(
        (c: { id: string }) => c.id === "workshop",
      ),
    ).toBe(false);
    expect(
      (
        await call(
          "admin/categories/poster",
          "DELETE",
          { revision: 1 },
          session,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "admin/categories/workshop",
          "DELETE",
          { revision: 2 },
          session,
        )
      ).status,
    ).toBe(200);
  });
  it("keeps drafts private, publishes complete packages and immediately removes public file access on unpublish or deletion", async () => {
    const session = await admin();
    const uploaded = await call(
      "admin/templates",
      "POST",
      uploadForm(),
      session,
    );
    expect(uploaded.status).toBe(201);
    const { id } = await uploaded.json();
    expect((await (await call("public/catalog")).json()).templates).toEqual([]);
    expect((await call(`public/templates/${id}/package`)).status).toBe(404);
    let row = (
      await (await call("admin/catalog", "GET", undefined, session)).json()
    ).templates[0];
    expect(
      (
        await call(
          `admin/templates/${id}`,
          "PUT",
          { ...row, published: true },
          session,
        )
      ).status,
    ).toBe(200);
    expect(
      (await (await call("public/catalog")).json()).templates,
    ).toHaveLength(1);
    expect((await call(`public/templates/${id}/package`)).status).toBe(200);
    expect(
      (
        await call(
          `admin/templates/${id}`,
          "PUT",
          { ...row, name: "stale" },
          session,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "admin/categories/huimin-15",
          "DELETE",
          { revision: 1 },
          session,
        )
      ).status,
    ).toBe(409);
    row = (
      await (await call("admin/catalog", "GET", undefined, session)).json()
    ).templates[0];
    await call(
      `admin/templates/${id}`,
      "PUT",
      { ...row, published: false },
      session,
    );
    expect((await call(`public/templates/${id}/thumbnail`)).status).toBe(404);
    expect(
      (await call(`admin/templates/${id}`, "DELETE", { revision: 3 }, session))
        .status,
    ).toBe(200);
    expect(
      (await (await call("admin/catalog", "GET", undefined, session)).json())
        .templates,
    ).toEqual([]);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM cms_gc").get()!.n).toBe(0);
  });
  it("validates uploaded data and keeps popup revisions coherent, including the initial save", async () => {
    const session = await admin(),
      doc = structuredClone(
        BUILTIN_TEMPLATES.find((t) => t.id === "blank_square")!.doc,
      );
    doc.canvas.backgroundImage = {
      kind: "url",
      url: "https://outside.test/picture.png",
    };
    expect(
      (await call("admin/templates", "POST", uploadForm(doc), session)).status,
    ).toBe(400);
    const initial = (await (await call("public/catalog")).json()).popup;
    expect(
      (await call("admin/popup", "PUT", { ...initial, revision: 77 }, session))
        .status,
    ).toBe(409);
    expect(
      (
        await call(
          "admin/popup",
          "PUT",
          {
            ...initial,
            mode: "button",
            title: "欢迎来到工作室",
            message: "<script>plain text</script>",
            enabled: true,
          },
          session,
        )
      ).status,
    ).toBe(200);
    const popup = (await (await call("public/catalog")).json()).popup;
    expect(popup).toMatchObject({ revision: 1, title: "欢迎来到工作室" });
    expect(
      (
        await call(
          "admin/popup",
          "PUT",
          { ...initial, enabled: false },
          session,
        )
      ).status,
    ).toBe(409);
    env.ADMIN_PASSWORD_HASH = hash.replace(
      salt,
      "11111111111111111111111111111111",
    );
    expect(
      (await call("admin/catalog", "GET", undefined, session)).status,
    ).toBe(401);
  });
});
