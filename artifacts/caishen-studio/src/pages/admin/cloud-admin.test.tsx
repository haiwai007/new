import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  allowed: true,
  save: vi.fn(),
  more: vi.fn(),
  policy: { uploadsEnabled: true, notice: "", revision: 0 },
}));
vi.mock("@/lib/cloud-config", () => ({ cloudConfig: { enabled: true } }));
vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  const { getFunctionName } = await import("convex/server");
  return {
    ...actual,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(ref);
      if (name === "admin:access")
        return { allowed: mocks.allowed, tokenIdentifier: "account-id" };
      if (name === "cloudWorks:policy") return mocks.policy;
      return { userCount: 0, workCount: 0, truncated: false };
    },
    usePaginatedQuery: () => ({
      results: [],
      status: "CanLoadMore",
      loadMore: mocks.more,
    }),
    useMutation: () => mocks.save,
  };
});
import AdminPage from "./cloud-admin";
function app() {
  return (
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.allowed = true;
  mocks.policy = { uploadsEnabled: true, notice: "", revision: 0 };
  mocks.save.mockResolvedValue({ revision: 1 });
});
describe("admin controls", () => {
  it("hides all controls from a non-administrator", () => {
    mocks.allowed = false;
    render(app());
    expect(screen.getByText("无管理员权限")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "维护设置" }),
    ).not.toBeInTheDocument();
  });
  it("loads the next page explicitly", () => {
    render(app());
    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    expect(mocks.more).toHaveBeenCalledWith(20);
  });
  it("requires confirmation before saving an upload maintenance change", async () => {
    render(app());
    fireEvent.click(screen.getByRole("button", { name: "维护设置" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "允许云端上传" }));
    fireEvent.change(screen.getByLabelText(/账户页公告/), {
      target: { value: "维护中" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认保存设置" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({
        uploadsEnabled: false,
        notice: "维护中",
        expectedRevision: 0,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("设置已保存");
  });
  it("preserves unsaved input when another administrator changes the server settings", () => {
    const view = render(app());
    fireEvent.click(screen.getByRole("button", { name: "维护设置" }));
    fireEvent.change(screen.getByLabelText(/账户页公告/), {
      target: { value: "我的草稿" },
    });
    mocks.policy = {
      uploadsEnabled: false,
      notice: "另一位管理员的公告",
      revision: 1,
    };
    view.rerender(app());
    expect(screen.getByLabelText(/账户页公告/)).toHaveValue("我的草稿");
    fireEvent.click(screen.getByRole("button", { name: "加载最新设置" }));
    expect(screen.getByLabelText(/账户页公告/)).toHaveValue(
      "另一位管理员的公告",
    );
    expect(
      screen.getByRole("checkbox", { name: "允许云端上传" }),
    ).not.toBeChecked();
  });
});
