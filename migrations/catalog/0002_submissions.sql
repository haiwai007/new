-- Applied automatically by submission endpoints when the original CMS is configured.
CREATE TABLE IF NOT EXISTS cms_submissions (
 template_id TEXT PRIMARY KEY REFERENCES cms_templates(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected')),
 submitter TEXT NOT NULL DEFAULT '',contact TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',review_note TEXT NOT NULL DEFAULT '',
 submitted_at INTEGER NOT NULL,reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS cms_submissions_status ON cms_submissions(status,submitted_at);
