import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/catalog-service/client", () => ({ requestJson: mocks.request }));
vi.mock("@/lib/cloud-config", () => ({
  cloudConfig: { enabled: false, missing: [], invalid: [] },
}));
import AdminPage from "./page";
beforeEach(() => {
  mocks.request.mockReset();
});
describe("Cloudflare content management gate", () => {
  it("shows missing real resources rather than simulated editing controls", async () => {
    mocks.request.mockResolvedValue({
      enabled: false,
      missing: ["CATALOG_DB", "CATALOG_FILES", "ADMIN_PASSWORD_HASH"],
      migrated: false,
    });
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "后台服务尚未启用" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/待配置：CATALOG_DB/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "保存分类" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "上传为草稿" }),
    ).not.toBeInTheDocument();
  });
  it("keeps administrative controls hidden when login fails", async () => {
    mocks.request.mockImplementation((path: string) => {
      if (path.endsWith("/status"))
        return Promise.resolve({ enabled: true, missing: [], migrated: true });
      if (path.endsWith("/session"))
        return Promise.resolve({ authenticated: false });
      return Promise.reject(
        Object.assign(new Error("管理员账号或密码不正确"), { status: 401 }),
      );
    });
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "管理员登录" });
    fireEvent.change(screen.getByLabelText("管理员密码"), {
      target: { value: "incorrect-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录后台" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "管理员账号或密码不正确",
    );
    expect(
      screen.queryByRole("button", { name: "分类管理" }),
    ).not.toBeInTheDocument();
  });
});
