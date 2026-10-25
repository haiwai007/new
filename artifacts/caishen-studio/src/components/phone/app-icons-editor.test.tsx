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
