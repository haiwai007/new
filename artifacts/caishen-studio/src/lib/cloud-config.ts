export function cloudConfiguration(env: Record<string, string | undefined>) {
  const required = ["VITE_CONVEX_URL", "VITE_HERCULES_OIDC_AUTHORITY", "VITE_HERCULES_OIDC_CLIENT_ID"];
  const missing = required.filter((key) => !env[key]?.trim());
  const invalid = ["VITE_CONVEX_URL", "VITE_HERCULES_OIDC_AUTHORITY"].filter((key) => {
    if (!env[key]) return false;
    try { return new URL(env[key]!).protocol !== "https:"; } catch { return true; }
  });
  return { enabled: missing.length === 0 && invalid.length === 0, missing, invalid };
}
export const cloudConfig = cloudConfiguration(import.meta.env);
