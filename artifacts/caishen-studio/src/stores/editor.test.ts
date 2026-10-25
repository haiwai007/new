import { beforeEach, describe, expect, it } from "vitest";
import { useEditor } from "./editor.ts";
import { findBuiltin } from "@/lib/template/builtin.ts";
import { updateLayer } from "@/lib/template/doc-ops.ts";

const doc = findBuiltin("bt_coffee")!.doc;

describe("editor store history", () => {
  beforeEach(() => useEditor.getState().load("w1", doc));

  it("undoes and redoes commits", () => {
    const s = useEditor.getState();
    s.commit(updateLayer(doc, "text_title", { x: 5 }));
    expect(useEditor.getState().doc?.layers.find((l) => l.id === "text_title")?.x).toBe(5);
    useEditor.getState().undo();
    expect(useEditor.getState().doc).toBe(doc);
    useEditor.getState().redo();
    expect(useEditor.getState().doc?.layers.find((l) => l.id === "text_title")?.x).toBe(5);
    expect(useEditor.getState().saveStatus).toBe("dirty");
  });

  it("coalesces rapid commits with the same key into one undo step", () => {
    const { commit } = useEditor.getState();
    commit(updateLayer(doc, "text_title", { text: "a" }), { coalesceKey: "k" });
    const d1 = useEditor.getState().doc!;
    commit(updateLayer(d1, "text_title", { text: "ab" }), { coalesceKey: "k" });
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().doc).toBe(doc);
  });

  it("a new commit clears redo history", () => {
    const { commit } = useEditor.getState();
    commit(updateLayer(doc, "text_title", { x: 1 }));
    useEditor.getState().undo();
    useEditor.getState().commit(updateLayer(doc, "text_title", { x: 2 }));
    expect(useEditor.getState().future).toHaveLength(0);
  });

  it("copy/paste creates new layers with new ids and selects them", () => {
    const s = useEditor.getState();
    s.select(["text_title"]);
    s.copy();
    useEditor.getState().paste();
    const st = useEditor.getState();
    expect(st.doc!.layers).toHaveLength(doc.layers.length + 1);
    expect(st.selectedIds[0]).not.toBe("text_title");
  });

  it("deleteSelected skips locked layers", () => {
    const locked = updateLayer(doc, "text_title", { locked: true });
    useEditor.getState().load("w1", locked);
    useEditor.getState().select(["text_title", "text_sub"]);
    useEditor.getState().deleteSelected();
    const ids = useEditor.getState().doc!.layers.map((l) => l.id);
    expect(ids).toContain("text_title");
    expect(ids).not.toContain("text_sub");
  });
});
