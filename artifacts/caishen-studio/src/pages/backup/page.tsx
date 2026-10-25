import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileUp, HardDrive, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/storage/template-package";
import { backupSummary, type WorkspaceBackup } from "@/lib/backup/format";
import {
  exportWorkspace,
  readWorkspaceBackup,
  restoreWorkspace,
  workspaceSummary,
} from "@/lib/backup/workspace";
type Summary = Awaited<ReturnType<typeof workspaceSummary>>;
const labels: [keyof Summary, string][] = [
  ["works", "作品与模板"],
  ["versions", "历史版本"],
  ["assets", "图片素材"],
  ["exports", "导出记录"],
];
function Counts({ value }: { value: Summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {labels.map(([key, label]) => (
        <div key={key} className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value[key]}</p>
        </div>
      ))}
    </div>
  );
}
export default function BackupPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [preview, setPreview] = useState<WorkspaceBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  async function refresh() {
    setSummary(await workspaceSummary());
  }
  useEffect(() => {
    queueMicrotask(() =>
      void refresh().catch((e) =>
        setError(e instanceof Error ? e.message : "无法读取本地数据"),
      ),
    );
  }, []);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <div>
        <p className="flex items-center gap-2 text-sm text-primary">
          <HardDrive className="size-4" />
          本地数据安全
        </p>
        <h1 className="mt-2 text-3xl font-bold">备份与恢复</h1>
        <p className="mt-3 text-muted-foreground">
          完整备份作品、模板、历史版本、素材库、导出记录和内置模板收藏，无需登录。
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-4 text-destructive"
        >
          {error}
        </p>
      )}
      {status && (
        <p role="status" aria-live="polite" className="rounded-lg bg-muted p-4">
          {status}
        </p>
      )}
      <section className="space-y-4 rounded-xl border p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">当前浏览器数据</h2>
          <Button variant="ghost" disabled={busy} onClick={() => run(refresh)}>
            刷新统计
          </Button>
        </div>
        {summary ? <Counts value={summary} /> : <p>正在读取统计…</p>}
        <p className="text-sm text-muted-foreground">
          导出记录只保存文件信息，不包含之前下载的 PNG / JPEG
          文件。备份不包含账户登录凭据或外部服务密钥。
        </p>
        <Button
          disabled={busy || !summary}
          onClick={() =>
            run(async () => {
              setStatus("正在读取并打包本地数据，请勿关闭页面…");
              const blob = await exportWorkspace();
              downloadFile(
                blob,
                `海神作图-${new Date().toISOString().slice(0, 10)}.haishen-backup.json`,
              );
              setStatus(
                "备份文件已生成，请确认浏览器下载完成，并妥善保管。备份包含你的作品与图片。",
              );
            })
          }
        >
          <Download className="size-4" />
          导出完整备份
        </Button>
      </section>
      <section className="space-y-4 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">从备份恢复</h2>
        <p className="text-sm text-muted-foreground">
          选择本平台导出的 .haishen-backup.json 文件（不超过
          100MB）。先校验并预览，确认后创建副本；已有数据不会被覆盖。单个模板文件请在“我的作品”中导入。
        </p>
        <input
          aria-label="选择完整备份文件"
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              void run(async () => {
                setPreview(null);
                setStatus("正在校验备份文件…");
                setPreview(await readWorkspaceBackup(file));
                setStatus("校验通过，请确认下方内容后恢复。");
              });
          }}
        />
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <FileUp className="size-4" />
          选择备份文件
        </Button>
        {preview && (
          <div className="space-y-4 rounded-lg bg-muted/40 p-4">
            <h3 className="font-semibold">恢复预览</h3>
            <p className="text-sm">
              备份时间：{new Date(preview.createdAt).toLocaleString()}
            </p>
            <Counts value={backupSummary(preview)} />
            <p className="flex items-start gap-2 text-sm">
              <ShieldCheck className="size-4 shrink-0" />
              作品名称会加上“（备份恢复）”，图片和历史版本使用新的标识；重复恢复会创建另一份副本。
            </p>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    setStatus("正在恢复作品、历史版本和图片，请勿关闭页面…");
                    const result = await restoreWorkspace(preview);
                    setPreview(null);
                    setStatus(
                      `恢复完成：${result.works} 个作品、${result.versions} 个版本、${result.assets} 张图片。原有数据已保留。`,
                    );
                    await refresh();
                  })
                }
              >
                确认恢复副本
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setStatus("");
                }}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </section>
      <div className="flex gap-5 text-sm text-primary">
        <Link to="/works" className="underline">
          返回我的作品
        </Link>
        <Link to="/account" className="underline">
          账户与云端备份
        </Link>
      </div>
    </div>
  );
}
