import { ConvexError } from "convex/values";
/** Present domain errors without the transport's request IDs and server stack. */
export function cloudErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    if (typeof error.data === "string") return error.data;
    if (
      error.data &&
      typeof error.data === "object" &&
      "message" in error.data &&
      typeof error.data.message === "string"
    )
      return error.data.message;
  }
  if (
    error instanceof Error &&
    error.message &&
    !error.message.includes("[CONVEX")
  )
    return error.message;
  return "云端操作失败，请检查网络和服务配置后重试；本地作品未被覆盖。";
}
