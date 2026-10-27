// Production-built frontend + the actual Cloudflare Worker/D1/R2 runtime for integration tests.
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { passwordHash } from "./create-admin-password.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  tmp = process.env.CMS_TEST_TMP ?? "/tmp/haishen-cms-test";
const port = Number(process.env.E2E_PORT ?? 5178),
  staticPort = port + 100;
await mkdir(tmp, { recursive: true });
execFileSync(
  path.join(root, "node_modules/.bin/wrangler"),
  [
    "deploy",
    "artifacts/caishen-studio/server/worker.ts",
    "--dry-run",
    "--name",
    "haishen-cms-test",
    "--compatibility-date",
    "2026-10-01",
    "--outdir",
    tmp,
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? path.join(tmp, "config"),
    },
    stdio: "ignore",
  },
);
const require = createRequire(import.meta.url),
  wranglerRequire = createRequire(require.resolve("wrangler/package.json")),
  { Miniflare, convertV4MiniflareOptions } = wranglerRequire("miniflare");
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    rootPath: tmp,
    modulesRoot: tmp,
    script: (await readFile(path.join(tmp, "worker.js"), "utf8")).replace(
      /\/\/# sourceMappingURL=.*$/m,
      "",
    ),
    compatibilityDate: "2026-10-01",
    d1Databases: ["CATALOG_DB"],
    r2Buckets: ["CATALOG_FILES"],
    bindings: {
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD_HASH: passwordHash("Local-Cms-Test-Only-729!"),
    },
  }),
);
const db = await mf.getD1Database("CATALOG_DB");
for (const sql of (
  await readFile(path.join(root, "migrations/catalog/0001_initial.sql"), "utf8")
)
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean))
  await db.prepare(sql).run();
const appRequire = createRequire(
  path.join(root, "artifacts/caishen-studio/package.json"),
);
const staticServer = spawn(
  process.execPath,
  [
    path.join(
      path.dirname(appRequire.resolve("vite/package.json")),
      "bin/vite.js",
    ),
    "preview",
    "--config",
    "vite.config.ts",
    "--host",
    "127.0.0.1",
  ],
  {
    cwd: path.join(root, "artifacts/caishen-studio"),
    env: { ...process.env, PORT: String(staticPort) },
    stdio: "ignore",
  },
);
let ready = false;
for (let i = 0; i < 100; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${staticPort}/`);
    if (r.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
if (!ready) throw new Error("Static preview failed to start");
const server = createServer(async (req, res) => {
  try {
    const origin = `http://127.0.0.1:${port}`,
      url = new URL(req.url, origin);
    let response;
    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      response = await mf.dispatchFetch(url.href, {
        method: req.method,
        headers: req.headers,
        ...(!["GET", "HEAD"].includes(req.method) ? { body: bytes } : {}),
      });
    } else
      response = await fetch(
        `http://127.0.0.1:${staticPort}${url.pathname}${url.search}`,
        { headers: { accept: req.headers.accept ?? "*/*" } },
      );
    res.writeHead(
      response.status,
      Object.fromEntries(
        [...response.headers].filter(
          ([key]) =>
            ![
              "content-encoding",
              "transfer-encoding",
              "content-length",
            ].includes(key),
        ),
      ),
    );
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Local integration server failed" }));
    console.error(error.message);
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Cloudflare CMS integration ready on ${port}`),
);
const close = async () => {
  server.close();
  staticServer.kill();
  await mf.dispose();
  process.exit(0);
};
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
