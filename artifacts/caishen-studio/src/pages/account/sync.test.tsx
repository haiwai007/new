import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  listWorks: vi.fn(),
  createWork: vi.fn(),
  exportPackage: vi.fn(),
  importFile: vi.fn(),
  remote: [] as Array<{
    _id: string;
    localId: string;
    name: string;
    kind: "project";
    revision: number;
    updatedAt: number;
    bytes: number;
  }>,
}));
vi.mock("@/lib/cloud-config", () => ({ cloudConfig: { enabled: true } }));
vi.mock("@usehercules/auth/react", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    signout: vi.fn(),
  }),
}));
vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  const { getFunctionName } = await import("convex/server");
  return {
    ...actual,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(ref) === "cloudWorks:list"
        ? mocks.remote
        : { allowed: false },
    useAction: (ref: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(ref) === "cloudFiles:save" ? mocks.save : mocks.download,
    useMutation: () => mocks.remove,
  };
});
vi.mock("@/lib/storage/works", () => ({
  listWorks: mocks.listWorks,
  createWork: mocks.createWork,
}));
vi.mock("@/lib/storage/template-package", () => ({
  exportTemplatePackage: mocks.exportPackage,
  importWorkFile: mocks.createWork,
}));
import AccountPage from "./page";
const local = {
  id: "local-1",
  name: "本地设计",
  version: 1,
  kind: "project",
  doc: { name: "文档" },
};
function open() {
  render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>,
  );
}
function remote() {
  return {
    _id: "cloud-1",
    localId: "local-1",
    name: "云端设计",
    kind: "project" as const,
    revision: 3,
    updatedAt: 1,
    bytes: 100,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.remote = [];
  mocks.listWorks.mockResolvedValue([local]);
  mocks.exportPackage.mockResolvedValue({
    blob: { size: 100, text: async () => "package" },
    missing: 0,
  });
  mocks.save.mockResolvedValue("cloud-1");
  mocks.download.mockResolvedValue({
    payload: "{}",
    name: "云端设计",
    kind: "project",
  });
  mocks.importFile.mockResolvedValue({
    doc: { name: "导入文档" },
    warnings: [],
  });
});
describe("manual cloud backup interactions", () => {
  it("uploads a new work and reports real progress until the request completes", async () => {
    let finish!: () => void;
    mocks.save.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    open();
    fireEvent.click(await screen.findByRole("button", { name: "上传备份" }));
    await screen.findByText("正在上传并校验云端备份，请勿关闭页面…");
    expect(screen.getByRole("button", { name: "上传备份" })).toBeDisabled();
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        localId: local.id,
        payload: "package",
        expectedRevision: 0,
      }),
    );
    finish();
    await screen.findByText("云端备份已保存");
  });
  it("requires confirmation before replacing an existing cloud backup", async () => {
    mocks.remote = [remote()];
    open();
    fireEvent.click(await screen.findByRole("button", { name: "上传备份" }));
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认上传" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({ expectedRevision: 3 }),
      ),
    );
  });
  it("shows a conflict without reporting success or overwriting local data", async () => {
    mocks.save.mockRejectedValue(new ConvexError("云端版本已变化"));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "上传备份" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "云端版本已变化",
    );
    expect(screen.queryByText("云端备份已保存")).not.toBeInTheDocument();
    expect(mocks.createWork).not.toHaveBeenCalled();
  });
  it("rejects oversized or incomplete packages before calling the backend", async () => {
    mocks.exportPackage.mockResolvedValue({
      blob: { size: 8 * 1024 * 1024 + 1 },
      missing: 0,
    });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "上传备份" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("8MB");
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.exportPackage.mockResolvedValue({ blob: { size: 100 }, missing: 1 });
    fireEvent.click(screen.getByRole("button", { name: "上传备份" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("缺少图片"),
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("restores into a new local work and confirms before deleting only the cloud backup", async () => {
    mocks.remote = [remote()];
    open();
    fireEvent.click(await screen.findByRole("button", { name: "恢复副本" }));
    await waitFor(() =>
      expect(mocks.createWork).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({ name: "云端设计（云端副本）", strict: true }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "删除备份" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "删除备份" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        id: "cloud-1",
        expectedRevision: 3,
      }),
    );
  });
  it("does not create a local work when downloading fails", async () => {
    mocks.remote = [remote()];
    mocks.download.mockRejectedValue(new Error("网络中断"));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "恢复副本" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("网络中断");
    expect(mocks.importFile).not.toHaveBeenCalled();
    expect(mocks.createWork).not.toHaveBeenCalled();
  });
});
