import {
  defaultStatusLocation,
  locationSourceKey,
  locationTestKey,
} from "@/lib/status-location/model";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditor } from "@/stores/editor";
import { BUILTIN_TEMPLATES } from "@/lib/template/builtin";
import PhonePanel from "./phone-panel";
beforeEach(() => {
  useEditor.getState().reset();
  const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
  const location = defaultStatusLocation(doc);
  location.state = "confirmed";
  location.fills = ["time", "apps", "system"].map((role) => ({
    role: role as "time" | "apps" | "system",
    top: "#ffffff",
    bottom: "#ffffff",
  }));
  location.sourceKey = locationSourceKey(doc, location.bounds);
  location.testKey = locationTestKey(location);
  doc.statusLocation = location;
  useEditor.getState().load("work1", doc);
});
describe("phone settings panel", () => {
  it("preserves the canvas until sizing is explicitly selected, and supports undo", () => {
    render(<PhonePanel />);
    fireEvent.change(screen.getByLabelText("电量百分比"), {
      target: { value: "67" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用手机状态栏" }));
    expect(useEditor.getState().doc!.canvas.height).toBe(1350);
    expect(useEditor.getState().doc!.phone!.battery).toBe(67);
    useEditor.getState().undo();
    expect(useEditor.getState().doc!.phone).toBeUndefined();
  });
  it("resizes only on request, requires a new location confirmation and preserves size when removing effects", () => {
    render(<PhonePanel />);
    fireEvent.change(screen.getByRole("combobox", { name: "手机品牌" }), {
      target: { value: "Google" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "手机型号" }), {
      target: { value: "pixel9" },
    });
    fireEvent.click(screen.getByLabelText("同时适配机型画布尺寸"));
    fireEvent.click(screen.getByRole("button", { name: /应用.*状态栏/ }));
    expect(useEditor.getState().doc!.canvas).toMatchObject({
      width: 1080,
      height: 2424,
    });
    expect(useEditor.getState().doc!.statusLocation!.state).toBe("stale");
    fireEvent.click(screen.getByRole("button", { name: "移除手机状态栏" }));
    expect(useEditor.getState().doc!.phone).toBeUndefined();
    expect(useEditor.getState().doc!.canvas.height).toBe(2424);
  });
  it("updates the canvas live once applied, merging rapid edits into one undo step", () => {
    render(<PhonePanel />);
    fireEvent.click(screen.getByRole("button", { name: "应用手机状态栏" }));
    fireEvent.change(screen.getByLabelText("电量百分比"), {
      target: { value: "42" },
    });
    fireEvent.change(screen.getByLabelText("电量百分比"), {
      target: { value: "43" },
    });
    expect(useEditor.getState().doc!.phone!.battery).toBe(43);
    useEditor.getState().undo();
    expect(useEditor.getState().doc!.phone!.battery).toBe(100);
  });
  it("rejects an out-of-range battery without changing the document", () => {
    render(<PhonePanel />);
    fireEvent.change(screen.getByLabelText("电量百分比"), {
      target: { value: "101" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用手机状态栏" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(useEditor.getState().doc!.phone).toBeUndefined();
  });
});

it("applies the selected brand system immediately without requiring the Apply button", () => {
  render(<PhonePanel />);
  fireEvent.change(screen.getByRole("combobox", { name: "手机品牌" }), {
    target: { value: "Samsung" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "手机型号" }), {
    target: { value: "galaxys24ultra" },
  });
  expect(useEditor.getState().doc!.phone).toMatchObject({
    modelId: "galaxys24ultra",
    timeWeight: "normal",
    batteryStyle: "outline",
  });
  expect(useEditor.getState().doc!.canvas).toMatchObject({
    width: 1080,
    height: 1350,
  });
  expect(
    useEditor.getState().doc!.layers.find((l) => l.id.endsWith("_icons")),
  ).toBeDefined();
});
