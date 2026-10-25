import { CloudBoundary } from "@/components/providers/cloud-boundary";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@usehercules/auth/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { cloudErrorMessage } from "@/lib/cloud-errors";
import { MAX_CLOUD_PACKAGE_BYTES } from "@/lib/cloud-limits";
import { cloudConfig } from "@/lib/cloud-config";
import { Button } from "@/components/ui/button";
import { listWorks } from "@/lib/storage/works";
import {
  exportTemplatePackage,
  importWorkFile,
} from "@/lib/storage/template-package";
import type { WorkRecord } from "@/lib/storage/db";
import type { Id } from "../../../convex/_generated/dataModel";

export function CloudUnavailable() {
  return (
    <div className="rounded-xl border bg-muted/30 p-6" role="status">
      <h2 className="text-xl font-semibold">云端服务未启用</h2>
      <p className="mt-3 text-muted-foreground">
        仍可免登录使用编辑器、模板、批量生成和素材库。作品保存在当前浏览器，清理浏览器数据前请导出备份。
      </p>
      <p className="mt-3 text-sm">
        云端登录与跨设备同步需要管理员完成服务配置后才能使用。
      </p>
      <Button asChild className="mt-4">
        <Link to="/works">查看本地作品</Link>
      </Button>
    </div>
  );
}
export default function AccountPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <p className="text-sm text-primary">海神作图 · 本地优先</p>
        <h1 className="mt-2 text-3xl font-bold">账户与云端同步</h1>
      </div>
      {cloudConfig.enabled ? (
        <CloudBoundary>
          <ConnectedAccount />
        </CloudBoundary>
      ) : (
        <CloudUnavailable />
      )}
    </div>
  );
}
function ConnectedAccount() {
  const { isAuthenticated, isLoading, signin, signout, error } = useAuth();
  const backend = useConvexAuth();
  const [authBusy, setAuthBusy] = useState(false);
  async function authenticate() {
    setAuthBusy(true);
    try {
      if (isAuthenticated) await signout();
      else await signin();
    } catch (e) {
      toast.error(cloudErrorMessage(e));
    } finally {
      setAuthBusy(false);
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
        <div>
          <h2 className="font-semibold">
            {isAuthenticated ? "账户已登录" : "登录后使用跨设备备份"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            上传由你手动触发；恢复始终创建本地副本，不覆盖现有作品。
          </p>
        </div>
        <Button disabled={isLoading || authBusy} onClick={authenticate}>
          {isAuthenticated ? "退出登录" : "登录账户"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          登录失败：{error.message}
        </p>
      )}
      {isAuthenticated &&
        (backend.isAuthenticated ? (
          <SyncPanel />
        ) : (
          <p role="status">
            {backend.isLoading
              ? "正在验证云端身份…"
              : "云端身份验证未通过，请检查服务配置或重新登录。"}
          </p>
        ))}
    </>
  );
}
function SyncPanel() {
  const remote = useQuery(api.cloudWorks.list);
  const access = useQuery(api.admin.access);
  const policy = useQuery(api.cloudWorks.policy);
  const save = useAction(api.cloudFiles.save);
  const download = useAction(api.cloudFiles.download);
  const remove = useMutation(api.cloudWorks.remove);
  const [local, setLocal] = useState<WorkRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [operationError, setOperationError] = useState("");
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  async function refresh() {
    try {
      setLocal(await listWorks());
      setLocalError("");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "读取本地作品失败");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    setOperationError("");
    try {
      await task();
      toast.success(message);
      setStage(message);
      setPendingUpload(null);
      await refresh();
    } catch (e) {
      const message = cloudErrorMessage(e);
      setOperationError(message);
      setStage("");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(work: WorkRecord) {
    setStage("正在打包作品和图片…");
    const pkg = await exportTemplatePackage(work.doc);
    if (pkg.missing)
      throw new Error("作品缺少图片，无法完整备份，请先修复缺失素材");
    if (pkg.blob.size > MAX_CLOUD_PACKAGE_BYTES)
      throw new Error(
        "单个云端作品上限为 8MB（含图片），请使用本地文件导出保存大型作品",
      );
    setStage("正在上传并校验云端备份，请勿关闭页面…");
    await save({
      localId: work.id,
      name: work.name,
      kind: work.kind,
      payload: await pkg.blob.text(),
      expectedRevision:
        remote?.find((r) => r.localId === work.id)?.revision ?? 0,
    });
  }
  async function restore(id: Id<"cloudWorks">) {
    setStage("正在下载云端备份…");
    const row = await download({ id });
    setStage("正在恢复图片和本地作品副本…");
    await importWorkFile(
      new File([row.payload], "cloud.json", { type: "application/json" }),
      {
        kind: row.kind,
        name: `${row.name}（云端副本）`,
        strict: true,
      },
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>手动同步 · 每账户最多 100 个作品 · 单个上限 8MB（含图片）</span>
        {access?.allowed && (
          <Link className="text-primary underline" to="/admin">
            管理后台
          </Link>
        )}
      </div>
      {policy?.notice && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {policy.notice}
        </p>
      )}
      {policy?.uploadsEnabled === false && (
        <p className="text-sm text-muted-foreground">
          云端上传已暂停；恢复备份和本地编辑仍可使用。
        </p>
      )}
      {stage && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg bg-muted p-3 text-sm"
        >
          {stage}
        </p>
      )}
      {operationError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-3 text-sm text-destructive"
        >
          {operationError}
        </p>
      )}
      <section className="rounded-xl border p-5">
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">本地作品</h2>
          <Button variant="outline" disabled={busy} onClick={refresh}>
            刷新列表
          </Button>
        </div>
        {localError && <p role="alert">{localError}</p>}
        {!local.length && !localError && (
          <p className="py-6 text-muted-foreground">
            暂无本地作品，先创建一个作品再上传。
          </p>
        )}
        {local.map((work) => (
          <div
            className="flex items-center justify-between gap-4 border-b py-4 last:border-0"
            key={work.id}
          >
            <div>
              <p className="font-medium">{work.name}</p>
              <p className="text-sm text-muted-foreground">
                本地 v{work.version} ·{" "}
                {remote?.some((r) => r.localId === work.id)
                  ? "已有云端备份，上传将更新备份"
                  : "尚未备份"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingUpload === work.id ? (
                <>
                  <p className="w-full text-sm text-muted-foreground">
                    确认用本地作品替换已有云端备份？
                  </p>
                  <Button
                    disabled={
                      busy || !remote || policy?.uploadsEnabled === false
                    }
                    onClick={() => run(() => upload(work), "云端备份已保存")}
                  >
                    确认上传
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setPendingUpload(null)}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  disabled={busy || !remote || policy?.uploadsEnabled === false}
                  onClick={() => {
                    if (remote?.some((r) => r.localId === work.id))
                      setPendingUpload(work.id);
                    else void run(() => upload(work), "云端备份已保存");
                  }}
                >
                  上传备份
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="rounded-xl border p-5">
        <h2 className="text-xl font-semibold">云端作品</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          恢复包含当前画布、参数和引用图片；历史版本、未引用素材及导出记录仍只保存在原浏览器。
        </p>
        {!remote ? (
          <p role="status" className="py-6">
            正在读取云端作品…
          </p>
        ) : remote.length === 0 ? (
          <p className="py-6 text-muted-foreground">暂无云端备份。</p>
        ) : (
          remote.map((row) => (
            <div
              key={row._id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-0"
            >
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-sm text-muted-foreground">
                  云端 v{row.revision} ·{" "}
                  {new Date(row.updatedAt).toLocaleString()} ·{" "}
                  {Math.ceil(row.bytes / 1024)}KB
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(() => restore(row._id), "已恢复为新的本地副本")
                  }
                >
                  恢复副本
                </Button>
                {pendingDelete === row._id ? (
                  <>
                    <Button
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          setStage("正在删除云端备份…");
                          await remove({
                            id: row._id,
                            expectedRevision: row.revision,
                          });
                          setPendingDelete(null);
                        }, "云端备份已删除，本地作品保留")
                      }
                    >
                      确认删除
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setPendingDelete(null)}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setPendingDelete(row._id)}
                  >
                    删除备份
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
