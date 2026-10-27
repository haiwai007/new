import type { PublicCatalogue } from "./contracts";
export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (typeof options.body === "string")
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
      signal:
        options.signal ??
        AbortSignal.timeout(options.body instanceof FormData ? 120000 : 15000),
    });
  } catch (error) {
    throw new Error(
      (error as Error).name === "TimeoutError"
        ? "请求超时，请刷新列表确认结果后再重试"
        : "无法连接后台，请检查网络后重试",
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("管理接口未启用，请检查 Cloudflare Pages Functions 部署");
  const value = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(value.error ?? value.message ?? "服务请求失败"),
      { status: response.status, code: value.code },
    );
  return value;
}
export async function readPublicCatalogue(): Promise<PublicCatalogue | null> {
  try {
    const response = await fetch("/api/public/catalog", {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      return null;
    const data = await response.json();
    return response.ok && data.enabled ? data : null;
  } catch {
    return null;
  }
}
