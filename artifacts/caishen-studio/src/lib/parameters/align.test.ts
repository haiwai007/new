import { describe, it, expect } from "vitest";
import { findBuiltin } from "@/lib/template/builtin";
import { createRegionParameter } from "./document";
import { alignParameterRegions } from "./align";
import { useEditor } from "@/stores/editor";

function fixture() {
  let doc = { ...findBuiltin("bt_coffee")!.doc, parameters: [] };
  const ids: string[] = [];
  for (const box of [
    { x: 20, y: 20, width: 40, height: 30 },
    { x: 100, y: 90, width: 60, height: 40 },
    { x: 240, y: 180, width: 80, height: 50 },
  ]) {
    const next = createRegionParameter(doc, box, "text");
    doc = next.doc;
    ids.push(next.layerId);
  }
  return { doc, ids };
}
describe("parameter region alignment", () => {
  it.each(["left", "right", "hcenter", "top", "bottom", "vcenter"] as const)(
    "aligns %s with a fixed reference without changing unrelated layers",
    (action) => {
      const { doc, ids } = fixture();
      const next = alignParameterRegions(doc, ids, action, ids[1]);
      const layers = ids.map((id) => next.layers.find((l) => l.id === id)!);
      const value = (l: (typeof layers)[number]) =>
        action === "left"
          ? l.x
          : action === "right"
            ? l.x + l.width
            : action === "hcenter"
              ? l.x + l.width / 2
              : action === "top"
                ? l.y
                : action === "bottom"
                  ? l.y + l.height
                  : l.y + l.height / 2;
      expect(new Set(layers.map(value)).size).toBe(1);
      expect(layers[1]).toEqual(doc.layers.find((l) => l.id === ids[1]));
      expect(next.layers.filter((l) => !ids.includes(l.id))).toEqual(
        doc.layers.filter((l) => !ids.includes(l.id)),
      );
    },
  );
  it("ignores unbound, hidden and locked layers and never centers a remaining single region", () => {
    const { doc, ids } = fixture();
    doc.layers = doc.layers.map((l) =>
      l.id === ids[1]
        ? { ...l, locked: true }
        : l.id === ids[2]
          ? { ...l, visible: false }
          : l,
    );
    expect(
      alignParameterRegions(
        doc,
        doc.layers.map((l) => l.id),
        "left",
      ),
    ).toBe(doc);
  });
  it("uses visible edge gaps for unequal sized regions and keeps both endpoints", () => {
    const { doc, ids } = fixture();
    const next = alignParameterRegions(doc, ids, "distribute-x");
    const [a, b, c] = ids.map((id) => next.layers.find((l) => l.id === id)!);
    expect(b.x - a.x - a.width).toBe(c.x - b.x - b.width);
    expect(a.x).toBe(20);
    expect(c.x).toBe(240);
  });
  it("equalizes sizes and records one undoable edit", () => {
    const { doc, ids } = fixture();
    useEditor.getState().load("align-test", doc, 0, true);
    useEditor
      .getState()
      .commit(alignParameterRegions(doc, ids, "width", ids[1]));
    expect(
      ids.map(
        (id) =>
          useEditor.getState().doc!.layers.find((l) => l.id === id)!.width,
      ),
    ).toEqual([60, 60, 60]);
    useEditor.getState().undo();
    expect(useEditor.getState().doc).toBe(doc);
    useEditor.getState().redo();
    expect(
      useEditor.getState().doc!.layers.find((l) => l.id === ids[0])!.width,
    ).toBe(60);
  });
});
