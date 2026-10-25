import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEditor } from "@/stores/editor";
import { BUILTIN_TEMPLATES } from "@/lib/template/builtin";
const mocks = vi.hoisted(() => ({ save: vi.fn(), thumb: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/storage/works.ts", async (original) => ({ ...(await original<typeof import("@/lib/storage/works")>()), saveWork: mocks.save, createWork: mocks.create }));
vi.mock("@/lib/template/start.ts", () => ({ safeThumb: mocks.thumb }));
import { useAutosave } from "./use-autosave";
beforeEach(() => {
  vi.resetAllMocks();
  useEditor.getState().reset();
  useEditor
    .getState()
    .load("work-1", structuredClone(BUILTIN_TEMPLATES[0].doc));
  mocks.save.mockResolvedValue({});
  mocks.thumb.mockResolvedValue(null);
});
describe("autosave ordering", () => {
  it("does not allow a slow thumbnail save to overwrite a later manual save", async () => {
    let finish!: () => void;
    mocks.thumb.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(null);
        }),
    );
    const { result } = renderHook(() => useAutosave());
    let first!: Promise<boolean>;
    act(() => {
      first = result.current.saveNow({ silent: true });
    });
    await waitFor(() => expect(mocks.thumb).toHaveBeenCalledOnce());
    let second!: Promise<boolean>;
    act(() => {
      const doc = useEditor.getState().doc!;
      useEditor.setState({
        doc: { ...doc, name: "newest" },
        saveStatus: "dirty",
      });
      second = result.current.saveNow({ silent: true });
    });
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => {
      finish();
      expect(await first).toBe(true);
      expect(await second).toBe(true);
    });
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[1][1].name).toBe("newest");
    expect(useEditor.getState().saveStatus).toBe("saved");
    result.current.cancelPending();
  });
  it("does not mark a different work as saved when a previous save completes", async () => {
    let finish!: () => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({});
        }),
    );
    const { result } = renderHook(() => useAutosave());
    let operation!: Promise<boolean>;
    act(() => {
      operation = result.current.saveNow({ silent: true });
    });
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    act(() => {
      useEditor
        .getState()
        .load("work-2", structuredClone(BUILTIN_TEMPLATES[0].doc));
      useEditor.getState().setSaveStatus("dirty");
    });
    await act(async () => {
      finish();
      await operation;
    });
    expect(useEditor.getState().workId).toBe("work-2");
    expect(useEditor.getState().saveStatus).toBe("dirty");
    result.current.cancelPending();
  });
});

it("saves stale edits into one durable conflict copy and keeps updating that copy", async () => {
  const { WorkConflictError } = await import("@/lib/storage/works");
  mocks.save.mockRejectedValueOnce(new WorkConflictError());
  mocks.create.mockResolvedValue({ id: "recovery-1", name: "设计（冲突副本）", revision: 0 });
  const { result } = renderHook(() => useAutosave());
  await act(async () => { expect(await result.current.saveNow({ silent: true })).toBe(false); });
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(useEditor.getState().recoveryWorkId).toBe("recovery-1");
  expect(useEditor.getState().saveStatus).toBe("error");
  mocks.save.mockResolvedValue({ id: "recovery-1", name: "设计（冲突副本）", revision: 1 });
  act(() => useEditor.getState().commit({ ...useEditor.getState().doc!, name: "later edit" }));
  await act(async () => { await result.current.saveNow({ silent: true }); });
  expect(mocks.save.mock.calls[1][0]).toBe("recovery-1");
  expect(mocks.save.mock.calls[1][2].expectedRevision).toBe(0);
  expect(mocks.create).toHaveBeenCalledOnce();
  result.current.cancelPending();
});
