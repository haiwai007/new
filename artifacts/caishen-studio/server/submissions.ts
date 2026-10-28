import { z } from "zod";
import { ApiError, type Database } from "./types";
import { digest } from "./auth";
export const submissionMeta = z.object({
  submitter: z.string().trim().max(60),
  contact: z.string().trim().max(120),
  note: z.string().trim().max(500),
});
export const SUBMISSION_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS cms_submissions (template_id TEXT PRIMARY KEY REFERENCES cms_templates(id) ON DELETE CASCADE,request_key TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected')),submitter TEXT NOT NULL DEFAULT '',contact TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',review_note TEXT NOT NULL DEFAULT '',submitted_at INTEGER NOT NULL,reviewed_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS cms_submissions_status ON cms_submissions(status,submitted_at)`,
];
export async function ensureSubmissions(db: Database) {
  // Existing CMS resources must have been initialized before this additive upgrade.
  await db.prepare("SELECT id FROM cms_categories LIMIT 1").first();
  const initialized = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='cms_submissions_status'",
    )
    .first();
  if (!initialized)
    await db.batch(SUBMISSION_SCHEMA.map((sql) => db.prepare(sql)));
}
export async function submissionRateLimit(request: Request, db: Database) {
  const now = Date.now();
  for (const [key, window, max] of [
    [
      `submission:ip:${await digest(request.headers.get("CF-Connecting-IP") ?? "local")}`,
      3600000,
      5,
    ],
    ["submission:global", 86400000, 100],
  ] as const) {
    const result = await db
      .prepare(
        "INSERT INTO cms_login_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING attempts",
      )
      .bind(key, now + window, now, now, now + window)
      .first<{ attempts: number }>();
    if (!result || result.attempts > max)
      throw new ApiError(429, "提交次数较多，请稍后再试", "RATE_LIMITED");
  }
}
