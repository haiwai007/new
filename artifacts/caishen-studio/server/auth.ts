import { ApiError, type CmsEnv, type Database } from "./types";
const COOKIE = "haishen_admin";
const bytes = (s: string) => new TextEncoder().encode(s);
export const hex = (a: ArrayBuffer | Uint8Array) =>
  Array.from(a instanceof Uint8Array ? a : new Uint8Array(a), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
export async function digest(s: string) {
  return hex(await crypto.subtle.digest("SHA-256", bytes(s)));
}
export const randomToken = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)));
export function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export function validPasswordHash(value: string | undefined) {
  return /^pbkdf2\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value ?? "");
}
export async function passwordMatches(password: string, hash: string) {
  if (password.length > 256 || !validPasswordHash(hash)) return false;
  const [, iterations, salt, expected] = hash.split("$");
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: Number(iterations),
      salt: Uint8Array.from(salt.match(/../g)!, (s) => parseInt(s, 16)),
    },
    key,
    256,
  );
  return equal(hex(derived), expected);
}
type Credentials = { hash: string; bootstrap: string };
async function storedCredentials(env: CmsEnv) {
  return env
    .CATALOG_DB!.prepare(
      "SELECT payload,revision FROM cms_settings WHERE id='admin-credentials'",
    )
    .first<{ payload: string; revision: number }>();
}
export async function effectivePasswordHash(env: CmsEnv) {
  const row = await storedCredentials(env);
  if (row) {
    const saved = JSON.parse(row.payload) as Credentials;
    if (
      saved.bootstrap === (await digest(env.ADMIN_PASSWORD_HASH!)) &&
      validPasswordHash(saved.hash)
    )
      return saved.hash;
  }
  return env.ADMIN_PASSWORD_HASH!;
}
async function makePasswordHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations: 100000, salt },
    key,
    256,
  );
  return `pbkdf2$100000$${hex(salt)}$${hex(hash)}`;
}
export async function changePassword(
  request: Request,
  env: CmsEnv,
  body: { currentPassword?: unknown; newPassword?: unknown },
) {
  if (
    typeof body.currentPassword !== "string" ||
    typeof body.newPassword !== "string" ||
    body.newPassword.length < 12 ||
    body.newPassword.length > 256
  )
    throw new ApiError(400, "新密码需为 12～256 个字符");
  const row = await storedCredentials(env);
  const current = await effectivePasswordHash(env);
  if (!(await passwordMatches(body.currentPassword, current)))
    throw new ApiError(400, "当前密码不正确");
  if (body.currentPassword === body.newPassword)
    throw new ApiError(400, "新密码不能与当前密码相同");
  const payload = JSON.stringify({
    hash: await makePasswordHash(body.newPassword),
    bootstrap: await digest(env.ADMIN_PASSWORD_HASH!),
  } satisfies Credentials);
  const now = Date.now(),
    db = env.CATALOG_DB!;
  const result = await db.batch([
    db
      .prepare(
        "INSERT INTO cms_settings(id,payload,revision,updated_at) SELECT 'admin-credentials',?,1,? WHERE COALESCE((SELECT revision FROM cms_settings WHERE id='admin-credentials'),0)=? ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=cms_settings.revision+1,updated_at=excluded.updated_at WHERE cms_settings.revision=?",
      )
      .bind(payload, now, row?.revision ?? 0, row?.revision ?? 0),
    db
      .prepare(
        "DELETE FROM cms_sessions WHERE EXISTS(SELECT 1 FROM cms_settings WHERE id='admin-credentials' AND payload=?)",
      )
      .bind(payload),
    db
      .prepare(
        "INSERT INTO cms_audit(action,object_id,created_at) SELECT 'admin.password-change','administrator',? WHERE EXISTS(SELECT 1 FROM cms_settings WHERE id='admin-credentials' AND payload=?)",
      )
      .bind(now, payload),
  ]);
  if (!result[0].meta.changes)
    throw new ApiError(409, "密码已在其他窗口修改，请重新登录");
  return sessionCookie(request, "", true);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new ApiError(403, "请求来源不正确", "BAD_ORIGIN");
}
export function sessionCookie(request: Request, value: string, clear = false) {
  return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 14400}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function readSession(request: Request, env: CmsEnv) {
  const token = request.headers
    .get("Cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (
    !token ||
    !/^[a-f0-9]{64}$/.test(token) ||
    !env.CATALOG_DB ||
    !env.ADMIN_PASSWORD_HASH
  )
    return null;
  const row = await env.CATALOG_DB.prepare(
    "SELECT csrf,expires_at,auth_version FROM cms_sessions WHERE token_hash=?",
  )
    .bind(await digest(token))
    .first<{ csrf: string; expires_at: number; auth_version: string }>();
  return row &&
    row.expires_at > Date.now() &&
    equal(row.auth_version, await digest(await effectivePasswordHash(env)))
    ? row
    : null;
}
export async function requireSession(request: Request, env: CmsEnv) {
  const session = await readSession(request, env);
  if (!session) throw new ApiError(401, "请先登录管理后台", "UNAUTHENTICATED");
  if (!["GET", "HEAD"].includes(request.method)) {
    sameOrigin(request);
    if (!equal(request.headers.get("X-CSRF-Token") ?? "", session.csrf))
      throw new ApiError(403, "会话校验失败，请刷新后台", "BAD_CSRF");
  }
  return session;
}
export async function login(
  request: Request,
  env: CmsEnv,
  body: { username?: unknown; password?: unknown },
) {
  sameOrigin(request);
  const db = env.CATALOG_DB!;
  const now = Date.now(),
    key = await digest(request.headers.get("CF-Connecting-IP") ?? "local"),
    window = 15 * 60 * 1000;
  const row = await db
    .prepare(
      "INSERT INTO cms_login_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts",
    )
    .bind(key, now + window, now, now, now + window)
    .first<{ attempts: number }>();
  if (!row || row.attempts > 5)
    throw new ApiError(429, "登录尝试过多，请在 15 分钟后重试", "RATE_LIMITED");
  const loginHash = await effectivePasswordHash(env);
  if (
    typeof body.username !== "string" ||
    typeof body.password !== "string" ||
    !equal(body.username, env.ADMIN_USERNAME ?? "admin") ||
    !(await passwordMatches(body.password, loginHash))
  )
    throw new ApiError(401, "管理员账号或密码不正确", "BAD_CREDENTIALS");
  const token = randomToken(),
    csrf = randomToken();
  await db.batch([
    db.prepare("DELETE FROM cms_sessions WHERE expires_at<=?").bind(now),
    db
      .prepare(
        "INSERT INTO cms_sessions(token_hash,csrf,expires_at,auth_version) VALUES(?,?,?,?)",
      )
      .bind(
        await digest(token),
        csrf,
        now + 4 * 60 * 60 * 1000,
        await digest(loginHash),
      ),
    db.prepare("DELETE FROM cms_login_limits WHERE key=?").bind(key),
  ]);
  return { csrf, cookie: sessionCookie(request, token) };
}
export async function logout(request: Request, db: Database) {
  const token = request.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)haishen_admin=([a-f0-9]{64})/)?.[1];
  if (token)
    await db
      .prepare("DELETE FROM cms_sessions WHERE token_hash=?")
      .bind(await digest(token))
      .run();
  return sessionCookie(request, "", true);
}
