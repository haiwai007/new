import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/cloud-config", () => ({ cloudConfig: { enabled: false } }));
import AccountPage from "./page";
import AdminPage from "../admin/cloud-admin";
describe("local-only mode", () => {
  it("renders the account page without auth or Convex providers", () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("云端服务未启用")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看本地作品" })).toHaveAttribute(
      "href",
      "/works",
    );
    expect(
      screen.queryByRole("button", { name: "上传备份" }),
    ).not.toBeInTheDocument();
  });
  it("renders the admin page without accessing a missing backend", () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("云端服务未启用")).toBeInTheDocument();
    expect(screen.queryByText("用户列表")).not.toBeInTheDocument();
  });
});
