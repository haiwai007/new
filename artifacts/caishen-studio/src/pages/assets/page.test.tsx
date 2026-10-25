import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssetsPage from "./page.tsx";
import { importImageFile } from "@/lib/image/import.ts";
import {
  deleteAsset,
  listAssets,
  resolveImageUrl,
  saveAsset,
  updateAsset,
} from "@/lib/storage/assets.ts";
import { assetsInUse } from "@/lib/storage/works.ts";
import type { AssetRecord } from "@/lib/storage/db.ts";

vi.mock("@/lib/image/import.ts", () => ({
  importImageFile: vi.fn(),
  formatBytes: (size: number) => `${size} B`,
  formatLabel: (mime: string) => mime.split("/")[1]?.toUpperCase() ?? mime,
}));

vi.mock("@/lib/storage/assets.ts", () => ({
  deleteAsset: vi.fn(),
  listAssets: vi.fn(),
  resolveImageUrl: vi.fn(),
  saveAsset: vi.fn(),
  updateAsset: vi.fn(),
}));

vi.mock("@/lib/storage/works.ts", () => ({
  assetsInUse: vi.fn(),
}));

const asset: AssetRecord = {
  id: "asset-coffee",
  name: "桂花拿铁.png",
  blob: new Blob(["image"], { type: "image/png" }),
  mime: "image/png",
  size: 5,
  width: 800,
  height: 600,
  category: "商品",
  scope: "library",
  createdAt: "2026-10-20T08:00:00.000Z",
};

const revokeObjectURL = vi.fn();

describe("AssetsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.mocked(listAssets).mockResolvedValue([]);
    vi.mocked(resolveImageUrl).mockResolvedValue("blob:asset-preview");
    vi.mocked(saveAsset).mockResolvedValue(asset);
    vi.mocked(updateAsset).mockResolvedValue(undefined);
    vi.mocked(deleteAsset).mockResolvedValue(undefined);
    vi.mocked(assetsInUse).mockResolvedValue(new Map());
  });

  it("shows a usable empty state when no library images exist", async () => {
    render(<AssetsPage />);

    expect(await screen.findByTestId("state-assets-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-asset-count")).toHaveTextContent("0");
  });

  it("imports a validated file locally and refreshes the library", async () => {
    const file = new File(["image-data"], "new-image.png", { type: "image/png" });
    const imported = {
      blob: file,
      name: file.name,
      mime: file.type,
      size: file.size,
      width: 640,
      height: 480,
      previewUrl: "blob:temporary-import",
    };
    vi.mocked(importImageFile).mockResolvedValue(imported);
    vi.mocked(listAssets).mockResolvedValueOnce([]).mockResolvedValue([asset]);

    render(<AssetsPage />);
    await screen.findByTestId("state-assets-empty");
    fireEvent.change(screen.getByTestId("input-import-assets"), {
      target: { files: [file] },
    });

    expect(await screen.findByText(/已保存/)).toBeInTheDocument();
    await waitFor(() => expect(saveAsset).toHaveBeenCalledWith(file, {
      name: file.name,
      width: 640,
      height: 480,
      category: "未分类",
      scope: "library",
    }));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:temporary-import");
    expect(await screen.findByTestId(`card-asset-${asset.id}`)).toBeInTheDocument();
  });

  it("filters assets by name and category", async () => {
    const logo: AssetRecord = {
      ...asset,
      id: "asset-logo",
      name: "品牌标志.webp",
      mime: "image/webp",
      category: "标志",
    };
    vi.mocked(listAssets).mockResolvedValue([asset, logo]);

    render(<AssetsPage />);
    expect(await screen.findByTestId(`card-asset-${asset.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`card-asset-${logo.id}`)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-search-assets"), {
      target: { value: "品牌" },
    });
    expect(screen.queryByTestId(`card-asset-${asset.id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`card-asset-${logo.id}`)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-search-assets"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByTestId("select-asset-category"), {
      target: { value: "商品" },
    });
    expect(screen.getByTestId(`card-asset-${asset.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`card-asset-${logo.id}`)).not.toBeInTheDocument();
  });

  it("shows referencing works and prevents deleting used assets", async () => {
    vi.mocked(listAssets).mockResolvedValueOnce([asset]).mockResolvedValue([]);
    vi.mocked(assetsInUse).mockResolvedValue(
      new Map([[asset.id, ["春季海报", "商品模板"]]]),
    );

    render(<AssetsPage />);
    await screen.findByTestId(`card-asset-${asset.id}`);
    fireEvent.click(screen.getByTestId(`button-delete-asset-${asset.id}`));

    expect(await screen.findByTestId("text-asset-usage-warning")).toHaveTextContent(
      "春季海报、商品模板",
    );
    expect(deleteAsset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("button-confirm-delete-asset"));
    expect(screen.getByTestId("button-confirm-delete-asset")).toBeDisabled();
    expect(deleteAsset).not.toHaveBeenCalled();
  });
});
