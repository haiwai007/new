import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { defaultPhoneSettings } from "@/lib/phone/layers";
import AppIconsEditor from "./app-icons-editor";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/phone/app-icon-upload", () => ({ uploadAppIcon: mocks.upload }));
vi.mock("@/lib/storage/assets", () => ({
  deleteAsset: mocks.remove,
  resolveImageUrl: vi.fn(async () => "data:image/png;base64,AA=="),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.remove.mockResolvedValue(undefined);
});
it("discards a completed upload when the user has switched to a different editing session", async () => {
  let finish!: (value: unknown) => void;
  mocks.upload.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const onChange = vi.fn(),
    settings = defaultPhoneSettings();
  const { rerender } = render(
    <AppIconsEditor
      settings={settings}
      onChange={onChange}
      scopeKey="work-a"
    />,
  );
  fireEvent.change(screen.getByLabelText("上传 APP 图标文件"), {
    target: { files: [new File(["png"], "app.png", { type: "image/png" })] },
  });
  await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
  rerender(
    <AppIconsEditor
      settings={settings}
      onChange={onChange}
      scopeKey="work-b"
    />,
  );
  await act(async () => {
    finish({ id: "discarded", name: "app" });
  });
  expect(onChange).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledWith("discarded");
});
it("releases the upload readiness flag on unmount and cleans up the unattached asset", async () => {
  let finish!: (value: unknown) => void;
  mocks.upload.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const onChange = vi.fn(),
    onBusyChange = vi.fn();
  const { unmount } = render(
    <AppIconsEditor
      settings={defaultPhoneSettings()}
      onChange={onChange}
      scopeKey="upload-image"
      onBusyChange={onBusyChange}
    />,
  );
  fireEvent.change(screen.getByLabelText("上传 APP 图标文件"), {
    target: { files: [new File(["png"], "app.png", { type: "image/png" })] },
  });
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
  unmount();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  await act(async () => {
    finish({ id: "unmounted", name: "app" });
  });
  expect(onChange).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledWith("unmounted");
});
it("merges a pending upload with the latest icon settings instead of reverting concurrent edits", async () => {
  let finish!: (value: unknown) => void;
  mocks.upload.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const onChange = vi.fn(),
    settings = defaultPhoneSettings();
  const { rerender } = render(
    <AppIconsEditor
      settings={settings}
      onChange={onChange}
      scopeKey="work-a"
    />,
  );
  fireEvent.change(screen.getByLabelText("上传 APP 图标文件"), {
    target: { files: [new File(["png"], "app.png", { type: "image/png" })] },
  });
  await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
  const updated = { ...settings, appIconSize: 20 };
  rerender(
    <AppIconsEditor settings={updated} onChange={onChange} scopeKey="work-a" />,
  );
  await act(async () => {
    finish({ id: "new-icon", name: "app" });
  });
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      appIconSize: 20,
      appIcons: [
        expect.objectContaining({
          kind: "custom",
          src: { kind: "asset", assetId: "new-icon" },
        }),
      ],
    }),
  );
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("offers 140 built-ins and searches Chinese names or case-insensitive English IDs", () => {
  const onChange = vi.fn();
  render(
    <AppIconsEditor
      settings={defaultPhoneSettings()}
      onChange={onChange}
      scopeKey="catalog"
    />,
  );
  const choices = screen.getByRole("group", { name: "内置 APP 图标" });
  expect(choices.querySelectorAll("button")).toHaveLength(140);
  fireEvent.change(screen.getByLabelText("搜索 APP 图标"), {
    target: { value: "小红书" },
  });
  expect(choices.querySelectorAll("button")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "添加小红书图标" }));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      appIcons: [
        expect.objectContaining({ kind: "builtin", builtinId: "xiaohongshu" }),
      ],
    }),
  );
  fireEvent.change(screen.getByLabelText("搜索 APP 图标"), {
    target: { value: "WHATSAPP" },
  });
  expect(
    screen.getByRole("button", { name: "添加WhatsApp图标" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("搜索 APP 图标"), {
    target: { value: "不存在的APP" },
  });
  expect(choices.querySelectorAll("button")).toHaveLength(0);
  expect(
    screen.getByText("未找到匹配的 APP，可上传自定义图标。"),
  ).toBeInTheDocument();
});
it("filters domestic and international icons without changing the selection, and searches inside the category", () => {
  const onChange = vi.fn();
  render(
    <AppIconsEditor
      settings={{
        ...defaultPhoneSettings(),
        appIcons: [
          {
            id: "app_existing",
            kind: "builtin",
            builtinId: "wechat",
            name: "微信",
            visible: true,
          },
        ],
      }}
      onChange={onChange}
      scopeKey="regions"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "国内APP图标" }));
  expect(
    screen.getByRole("button", { name: "移除微信图标" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "添加WhatsApp图标" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("搜索 APP 图标"), {
    target: { value: "deepseek" },
  });
  fireEvent.click(screen.getByRole("button", { name: "添加DeepSeek图标" }));
  expect(onChange).toHaveBeenCalledOnce();
  expect(
    onChange.mock.calls[0][0].appIcons.map(
      (i: { builtinId: string }) => i.builtinId,
    ),
  ).toEqual(["wechat", "deepseek"]);
  fireEvent.click(screen.getByRole("button", { name: "国外APP图标" }));
  expect(
    screen.getByText("没有找到匹配图标，请尝试其他分类或关键词。"),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("搜索 APP 图标"), {
    target: { value: "" },
  });
  expect(
    screen.getByRole("button", { name: "添加WhatsApp图标" }),
  ).toBeInTheDocument();
  expect(onChange).toHaveBeenCalledOnce();
});

it("finds and selects 58同城 and 唯品会 in the domestic catalogue", () => {
  const onChange = vi.fn();
  render(
    <AppIconsEditor
      settings={defaultPhoneSettings()}
      onChange={onChange}
      scopeKey="popular-cn"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "国内APP图标" }));
  fireEvent.change(screen.getByLabelText("搜索 APP 图标"), {
    target: { value: "58" },
  });
  fireEvent.click(screen.getByRole("button", { name: "添加58同城图标" }));
  expect(onChange.mock.calls[0][0].appIcons[0].builtinId).toBe("tongcheng58");
  fireEvent.change(screen.getByLabelText("搜索 APP 图标"), {
    target: { value: "唯品会" },
  });
  fireEvent.click(screen.getByRole("button", { name: "添加唯品会图标" }));
  expect(onChange.mock.calls[1][0].appIcons[0].builtinId).toBe("vipshop");
  fireEvent.click(screen.getByRole("button", { name: "国外APP图标" }));
  expect(
    screen.queryByRole("button", { name: "添加唯品会图标" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "全部APP图标" }));
  fireEvent.change(screen.getByLabelText("搜索 APP 图标"), {
    target: { value: "vipshop" },
  });
  expect(
    screen.getByRole("button", { name: "添加唯品会图标" }),
  ).toBeInTheDocument();
});
