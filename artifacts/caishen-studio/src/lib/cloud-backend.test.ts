// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { modules } from "../../convex/test.setup";
import { BUILTIN_TEMPLATES } from "./template/builtin";
import { buildPackage } from "./template/package";

function setup() {
  const t = convexTest(schema, modules);
  const a = t.withIdentity({
    issuer: "https://identity.example",
    subject: "a",
    tokenIdentifier: "https://identity.example|a",
  });
  const b = t.withIdentity({
    issuer: "https://identity.example",
    subject: "b",
    tokenIdentifier: "https://identity.example|b",
  });
  const input = {
    localId: "local-1",
    name: "测试作品",
    kind: "project" as const,
    expectedRevision: 0,
    payload: JSON.stringify(buildPackage(BUILTIN_TEMPLATES[0].doc, [])),
  };
  return { t, a, b, input };
}
afterEach(() => vi.unstubAllEnvs());
describe("cloud ownership and revision control", () => {
  it("requires authentication", async () => {
    const { t, input } = setup();
    await expect(t.query(api.cloudWorks.list, {})).rejects.toThrow("请先登录");
    await expect(t.mutation(api.cloudWorks.save, input)).rejects.toThrow(
      "请先登录",
    );
  });
  it("roundtrips a complete package and isolates users", async () => {
    const { a, b, input } = setup();
    const id = await a.mutation(api.cloudWorks.save, input);
    expect((await a.query(api.cloudWorks.read, { id })).payload).toBe(
      input.payload,
    );
    expect(await b.query(api.cloudWorks.list, {})).toEqual([]);
    await expect(b.query(api.cloudWorks.read, { id })).rejects.toThrow(
      "不存在",
    );
    await expect(
      b.mutation(api.cloudWorks.remove, { id, expectedRevision: 1 }),
    ).rejects.toThrow("不存在");
    const list = await a.query(api.cloudWorks.list, {});
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("payload");
  });
  it("rejects stale uploads and deletes without destroying the saved version", async () => {
    const { a, input } = setup();
    const id = await a.mutation(api.cloudWorks.save, input);
    await expect(a.mutation(api.cloudWorks.save, input)).rejects.toThrow(
      "版本已变化",
    );
    await a.mutation(api.cloudWorks.save, {
      ...input,
      name: "新版本",
      expectedRevision: 1,
    });
    await expect(
      a.mutation(api.cloudWorks.remove, { id, expectedRevision: 1 }),
    ).rejects.toThrow("版本已变化");
    expect((await a.query(api.cloudWorks.read, { id })).revision).toBe(2);
    await a.mutation(api.cloudWorks.remove, { id, expectedRevision: 2 });
    expect(await a.query(api.cloudWorks.list, {})).toEqual([]);
  });
  it("rejects broken and oversized packages", async () => {
    const { a, input } = setup();
    await expect(
      a.mutation(api.cloudWorks.save, { ...input, payload: "bad" }),
    ).rejects.toThrow("JSON");
    await expect(
      a.mutation(api.cloudWorks.save, {
        ...input,
        payload: "x".repeat(900001),
      }),
    ).rejects.toThrow("900KB");
    await expect(
      a.mutation(api.cloudWorks.save, { ...input, payload: "{}" }),
    ).rejects.toThrow("作品包无效");
    expect(await a.query(api.cloudWorks.list, {})).toEqual([]);
  });
  it("enforces per-user quota", async () => {
    const { a, t, input } = setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++)
        await ctx.db.insert("cloudWorks", {
          owner: "https://identity.example|a",
          localId: String(i),
          name: "作品",
          kind: "project",
          payload: input.payload,
          revision: 1,
          updatedAt: 1,
        });
    });
    await expect(a.mutation(api.cloudWorks.save, input)).rejects.toThrow("100");
    await a.mutation(api.cloudWorks.save, {
      ...input,
      localId: "0",
      expectedRevision: 1,
    });
    expect(await a.query(api.cloudWorks.list, {})).toHaveLength(100);
  });
});
describe("admin authorization", () => {
  it("defaults to deny, uses server identity, and never exposes payloads", async () => {
    const { a, b, input } = setup();
    vi.stubEnv("ADMIN_TOKEN_IDENTIFIERS", "");
    expect((await a.query(api.admin.access, {})).allowed).toBe(false);
    await expect(a.query(api.admin.overview, {})).rejects.toThrow(
      "无管理员权限",
    );
    vi.stubEnv("ADMIN_TOKEN_IDENTIFIERS", "https://identity.example|a");
    await a.mutation(api.users.updateCurrentUser, {});
    await a.mutation(api.cloudWorks.save, input);
    expect((await a.query(api.admin.access, {})).allowed).toBe(true);
    await expect(b.query(api.admin.overview, {})).rejects.toThrow(
      "无管理员权限",
    );
    const overview = await a.query(api.admin.overview, {});
    expect(overview.userCount).toBe(1);
    expect(overview.workCount).toBe(1);
    expect(JSON.stringify(overview)).not.toContain("payload");
  });
});

describe("file-backed cloud backups", () => {
  it("stores and downloads a package larger than the old document limit", async () => {
    const { a, b, t, input } = setup();
    const payload = input.payload + " ".repeat(1_000_000);
    const id = await a.action(api.cloudFiles.save, { ...input, payload });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.payload).toBeUndefined();
    expect(row?.storageId).toBeTruthy();
    const saved = await a.action(api.cloudFiles.download, { id });
    expect(saved.payload).toBe(payload);
    expect((await a.query(api.cloudWorks.list, {}))[0].bytes).toBe(
      new TextEncoder().encode(payload).length,
    );
    await expect(b.action(api.cloudFiles.download, { id })).rejects.toThrow(
      "不存在",
    );
    await expect(t.action(api.cloudFiles.download, { id })).rejects.toThrow(
      "请先登录",
    );
    await expect(t.action(api.cloudFiles.save, input)).rejects.toThrow(
      "请先登录",
    );
    await expect(a.query(api.cloudWorks.read, { id })).rejects.toThrow(
      "新版存储",
    );
  });
  it("cleans up rejected uploads and keeps the previous committed file", async () => {
    const { a, t, input } = setup();
    const id = await a.action(api.cloudFiles.save, input);
    const first = await t.run((ctx) => ctx.db.get(id));
    await expect(a.action(api.cloudFiles.save, input)).rejects.toThrow(
      "版本已变化",
    );
    const files = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    expect(files).toHaveLength(1);
    expect(files[0]._id).toBe(first?.storageId);
    expect((await a.action(api.cloudFiles.download, { id })).payload).toBe(
      input.payload,
    );
  });
  it("replaces and deletes file content together with work metadata", async () => {
    const { a, t, input } = setup();
    const id = await a.action(api.cloudFiles.save, input);
    const first = await t.run((ctx) => ctx.db.get(id));
    await a.action(api.cloudFiles.save, {
      ...input,
      name: "更新",
      expectedRevision: 1,
    });
    const second = await t.run((ctx) => ctx.db.get(id));
    expect(second?.storageId).not.toBe(first?.storageId);
    expect(await t.run((ctx) => ctx.storage.get(first!.storageId!))).toBeNull();
    expect((await a.action(api.cloudFiles.download, { id })).name).toBe("更新");
    await a.mutation(api.cloudWorks.remove, { id, expectedRevision: 2 });
    expect(
      await t.run((ctx) => ctx.db.system.query("_storage").collect()),
    ).toHaveLength(0);
  });
  it("supports old inline backups and upgrades them on the next upload", async () => {
    const { a, t, input } = setup();
    const id = await a.mutation(api.cloudWorks.save, input);
    expect((await a.action(api.cloudFiles.download, { id })).payload).toBe(
      input.payload,
    );
    expect(
      await a.action(api.cloudFiles.save, { ...input, expectedRevision: 1 }),
    ).toBe(id);
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.storageId).toBeTruthy();
    expect(row?.payload).toBeUndefined();
    expect(row?.revision).toBe(2);
  });
  it("rejects invalid or oversized uploads before writing storage", async () => {
    const { a, t, input } = setup();
    await expect(
      a.action(api.cloudFiles.save, {
        ...input,
        payload: "x".repeat(8 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow("8MB");
    await expect(
      a.action(api.cloudFiles.save, { ...input, payload: "{}" }),
    ).rejects.toThrow("作品包无效");
    await expect(
      a.action(api.cloudFiles.save, { ...input, localId: "x".repeat(201) }),
    ).rejects.toThrow("标识");
    await expect(
      a.action(api.cloudFiles.save, { ...input, expectedRevision: 0.5 }),
    ).rejects.toThrow("版本号无效");
    expect(
      await t.run((ctx) => ctx.db.system.query("_storage").collect()),
    ).toHaveLength(0);
  });
  it("reports a missing stored file instead of returning a successful restore", async () => {
    const { a, t, input } = setup();
    const id = await a.action(api.cloudFiles.save, input);
    const row = await t.run((ctx) => ctx.db.get(id));
    await t.run((ctx) => ctx.storage.delete(row!.storageId!));
    await expect(a.action(api.cloudFiles.download, { id })).rejects.toThrow(
      "文件不存在",
    );
  });
});

describe("administration and audit", () => {
  it("records only committed changes and paginates audit events without leaking work contents", async () => {
    const { a, t, input } = setup();
    vi.stubEnv("ADMIN_TOKEN_IDENTIFIERS", "https://identity.example|a");
    const id = await a.action(api.cloudFiles.save, input);
    await expect(a.action(api.cloudFiles.save, input)).rejects.toThrow("版本已变化");
    await a.action(api.cloudFiles.save, { ...input, expectedRevision: 1 });
    await a.mutation(api.cloudWorks.remove, { id, expectedRevision: 2 });
    const first = await a.query(api.admin.auditPage, { paginationOpts: { numItems: 2, cursor: null } });
    expect(first.page).toHaveLength(2);
    expect(first.isDone).toBe(false);
    const second = await a.query(api.admin.auditPage, { paginationOpts: { numItems: 2, cursor: first.continueCursor } });
    expect(second.page).toHaveLength(1);
    expect(new Set([...first.page, ...second.page].map(x => x.action))).toEqual(new Set(["create", "update", "delete"]));
    expect(JSON.stringify(first)).not.toContain("payload");
    expect(await t.run(ctx => ctx.db.query("auditLogs").collect())).toHaveLength(3);
  });
  it("denies users access to settings, audit data and user pages", async () => {
    const { a, b } = setup(); vi.stubEnv("ADMIN_TOKEN_IDENTIFIERS", "https://identity.example|a");
    await expect(b.query(api.admin.auditPage, { paginationOpts: { numItems: 20, cursor: null } })).rejects.toThrow("无管理员权限");
    await expect(b.query(api.admin.usersPage, { paginationOpts: { numItems: 20, cursor: null } })).rejects.toThrow("无管理员权限");
    await expect(b.mutation(api.admin.savePolicy, { uploadsEnabled: false, notice: "bad", expectedRevision: 0 })).rejects.toThrow("无管理员权限");
    await expect(a.query(api.admin.usersPage, { paginationOpts: { numItems: 101, cursor: null } })).rejects.toThrow("1–100");
  });
  it("pauses uploads server-side while retaining downloads and protects concurrent admin edits", async () => {
    const { a, b, t, input } = setup(); vi.stubEnv("ADMIN_TOKEN_IDENTIFIERS", "https://identity.example|a");
    const id = await b.action(api.cloudFiles.save, input);
    await a.mutation(api.admin.savePolicy, { uploadsEnabled: false, notice: "维护中", expectedRevision: 0 });
    expect(await b.query(api.cloudWorks.policy, {})).toEqual({ uploadsEnabled: false, notice: "维护中", revision: 1 });
    await expect(b.action(api.cloudFiles.save, { ...input, expectedRevision: 1 })).rejects.toThrow("维护中");
    await expect(b.mutation(api.cloudWorks.save, { ...input, expectedRevision: 1 })).rejects.toThrow("维护中");
    expect((await b.action(api.cloudFiles.download, { id })).payload).toBe(input.payload);
    expect(await t.run(ctx => ctx.db.system.query("_storage").collect())).toHaveLength(1);
    await expect(a.mutation(api.admin.savePolicy, { uploadsEnabled: true, notice: "", expectedRevision: 0 })).rejects.toThrow("其他管理员");
    await a.mutation(api.admin.savePolicy, { uploadsEnabled: true, notice: "", expectedRevision: 1 });
    await b.action(api.cloudFiles.save, { ...input, expectedRevision: 1 });
  });
  it("updates user profiles and last login while paginating registered users", async () => {
    const { a, b } = setup(); vi.stubEnv("ADMIN_TOKEN_IDENTIFIERS", "https://identity.example|a");
    await a.mutation(api.users.updateCurrentUser, {}); await b.mutation(api.users.updateCurrentUser, {});
    const one = await a.query(api.admin.usersPage, { paginationOpts: { numItems: 1, cursor: null } });
    const two = await a.query(api.admin.usersPage, { paginationOpts: { numItems: 1, cursor: one.continueCursor } });
    expect(one.page).toHaveLength(1); expect(two.page).toHaveLength(1);
    expect(one.page[0].id).not.toBe(two.page[0].id);
    expect(one.page[0].lastSeenAt).toBeGreaterThan(0);
  });
});
