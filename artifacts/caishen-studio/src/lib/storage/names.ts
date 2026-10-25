/** Shared limit for newly entered local/cloud work names. Backups retain legacy names verbatim. */
export const MAX_WORK_NAME = 200;
export function workName(value: string, suffix = "") {
  const base = value.trim() || "未命名作品";
  return base.slice(0, Math.max(0, MAX_WORK_NAME - suffix.length)) + suffix;
}
