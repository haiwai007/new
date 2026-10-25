import { useState } from "react";
import { toast } from "sonner";
import { CloudBoundary } from "@/components/providers/cloud-boundary";
import { Link } from "react-router-dom";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cloudConfig } from "@/lib/cloud-config";
import { cloudErrorMessage } from "@/lib/cloud-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CloudUnavailable } from "../account/page";
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">管理后台</h1>
      {cloudConfig.enabled ? (
        <CloudBoundary>
          <AdminGate />
        </CloudBoundary>
      ) : (
        <CloudUnavailable />
      )}
    </div>
  );
}
function AdminGate() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const access = useQuery(api.admin.access, isAuthenticated ? {} : "skip");
  if (isLoading || (isAuthenticated && !access))
    return <p role="status">正在验证管理员权限…</p>;
  if (!isAuthenticated)
    return (
      <p>
        请先
        <Link className="text-primary underline" to="/account">
          登录账户
        </Link>
        。
      </p>
    );
  if (!access?.allowed)
    return (
      <div className="rounded-xl border p-6">
        <h2 className="font-semibold">无管理员权限</h2>
        <p className="mt-2">如需访问，请联系部署管理员配置账户权限。</p>
        <p className="mt-4 break-all text-sm text-muted-foreground">
          你的账户标识：{access?.tokenIdentifier}
        </p>
      </div>
    );
  return <Overview />;
}
function Overview() {
  const data = useQuery(api.admin.overview);
  const [tab, setTab] = useState<"users" | "audit" | "settings">("users");
  if (!data) return <p role="status">正在加载管理概览…</p>;
  return (
    <>
      <p className="text-muted-foreground">
        查看真实账户记录、云端操作审计和上传维护设置。账户权限仍由部署管理员在服务端配置。
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border p-6">
          已登记用户
          <p className="mt-2 text-3xl font-bold">
            {data.userCount > 100 ? "100+" : data.userCount}
          </p>
        </div>
        <div className="rounded-xl border p-6">
          云端作品
          <p className="mt-2 text-3xl font-bold">
            {data.workCount > 100 ? "100+" : data.workCount}
          </p>
        </div>
      </div>
      {data.truncated && (
        <p className="text-sm text-muted-foreground">
          概览计数最多显示 100+；下方列表可继续加载更多记录。
        </p>
      )}
      <nav className="flex gap-2" aria-label="后台模块">
        {(
          [
            ["users", "用户列表"],
            ["audit", "操作审计"],
            ["settings", "维护设置"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={tab === key ? "default" : "outline"}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {tab === "users" ? <Users /> : tab === "audit" ? <Audit /> : <Settings />}
    </>
  );
}
function More({ status, onMore }: { status: string; onMore: () => void }) {
  if (status === "LoadingFirstPage") return <p role="status">正在读取记录…</p>;
  if (status === "Exhausted")
    return (
      <p className="mt-4 text-sm text-muted-foreground">已显示全部记录。</p>
    );
  return (
    <Button
      className="mt-4"
      variant="outline"
      disabled={status === "LoadingMore"}
      onClick={onMore}
    >
      {status === "LoadingMore" ? "正在加载…" : "加载更多"}
    </Button>
  );
}
function Users() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.usersPage,
    {},
    { initialNumItems: 20 },
  );
  return (
    <section className="rounded-xl border p-5">
      <h2 className="mb-4 text-xl font-semibold">用户列表</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-3">名称</th>
              <th className="p-3">邮箱</th>
              <th className="p-3">登记时间</th>
              <th className="p-3">最近登录</th>
            </tr>
          </thead>
          <tbody>
            {results.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="p-3">{user.name ?? "未提供"}</td>
                <td className="p-3">{user.email ?? "未提供"}</td>
                <td className="p-3">
                  {new Date(user.createdAt).toLocaleString()}
                </td>
                <td className="p-3">
                  {user.lastSeenAt
                    ? new Date(user.lastSeenAt).toLocaleString()
                    : "暂无记录"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!results.length && status === "Exhausted" && <p>暂无已登记用户。</p>}
      <More status={status} onMore={() => loadMore(20)} />
    </section>
  );
}
const ACTIONS = {
  create: "创建备份",
  update: "更新备份",
  delete: "删除备份",
  login: "账户登录",
  policy: "修改维护设置",
};
function Audit() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.auditPage,
    {},
    { initialNumItems: 20 },
  );
  return (
    <section className="rounded-xl border p-5">
      <h2 className="text-xl font-semibold">操作审计</h2>
      <p className="my-3 text-sm text-muted-foreground">
        仅记录启用审计后的成功云端操作，不记录作品正文、图片或登录令牌。账户标识用于追踪操作者。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-3">操作</th>
              <th className="p-3">对象</th>
              <th className="p-3">操作者</th>
              <th className="p-3">时间</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr key={row._id} className="border-t">
                <td className="whitespace-nowrap p-3">{ACTIONS[row.action]}</td>
                <td className="p-3">
                  {row.name}
                  {row.revision !== undefined && ` · v${row.revision}`}
                </td>
                <td className="max-w-64 break-all p-3 text-xs">{row.actor}</td>
                <td className="p-3">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!results.length && status === "Exhausted" && <p>暂无操作记录。</p>}
      <More status={status} onMore={() => loadMore(20)} />
    </section>
  );
}
function Settings() {
  const policy = useQuery(api.cloudWorks.policy);
  return policy ? (
    <PolicyEditor policy={policy} />
  ) : (
    <p role="status">正在读取设置…</p>
  );
}
function PolicyEditor({
  policy,
}: {
  policy: { uploadsEnabled: boolean; notice: string; revision: number };
}) {
  const save = useMutation(api.admin.savePolicy);
  const [baseRevision, setBaseRevision] = useState(policy.revision);
  const [uploadsEnabled, setUploadsEnabled] = useState(policy.uploadsEnabled);
  const [notice, setNotice] = useState(policy.notice);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  return (
    <section className="space-y-4 rounded-xl border p-6">
      <h2 className="text-xl font-semibold">云端上传维护</h2>
      <p className="text-sm text-muted-foreground">
        暂停仅影响云端上传；用户仍可下载已有备份、删除自己的备份或使用本地功能。所有改动都会记录审计日志。
      </p>
      {policy.revision > baseRevision && (
        <div role="status" className="rounded-lg border p-3 text-sm">
          <p>
            维护设置已在其他会话中更新。你的未保存修改已保留；加载最新设置会替换当前输入。
          </p>
          <Button
            variant="outline"
            className="mt-2"
            disabled={busy}
            onClick={() => {
              setBaseRevision(policy.revision);
              setUploadsEnabled(policy.uploadsEnabled);
              setNotice(policy.notice);
              setConfirm(false);
              setError("");
              setSuccess(false);
            }}
          >
            加载最新设置
          </Button>
        </div>
      )}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={uploadsEnabled}
          disabled={busy}
          onChange={(e) => {
            setUploadsEnabled(e.target.checked);
            setConfirm(false);
            setSuccess(false);
          }}
        />
        允许云端上传
      </label>
      <div className="space-y-2">
        <label htmlFor="cloud-notice" className="text-sm">
          账户页公告（最多 200 字符）
        </label>
        <Input
          id="cloud-notice"
          maxLength={200}
          value={notice}
          disabled={busy}
          onChange={(e) => {
            setNotice(e.target.value);
            setConfirm(false);
            setSuccess(false);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {success && <p role="status">设置已保存。</p>}
      {confirm && (
        <p>确认{uploadsEnabled ? "启用" : "暂停"}云端上传并保存公告？</p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={
            busy ||
            (uploadsEnabled === policy.uploadsEnabled &&
              notice === policy.notice)
          }
          onClick={async () => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            setBusy(true);
            setError("");
            try {
              const saved = await save({
                uploadsEnabled,
                notice,
                expectedRevision: baseRevision,
              });
              setBaseRevision(saved.revision);
              setNotice(notice.trim());
              setSuccess(true);
              toast.success("维护设置已保存");
              setConfirm(false);
            } catch (e) {
              setError(cloudErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "正在保存…" : confirm ? "确认保存设置" : "保存设置"}
        </Button>
        {confirm && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            取消
          </Button>
        )}
      </div>
    </section>
  );
}
