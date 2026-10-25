import { useEffect } from "react";
import { useEditor } from "@/stores/editor.ts";
import { edit } from "@/stores/editor.ts";
import { updateLayers } from "@/lib/template/doc-ops.ts";
import type { Layer } from "@/types/template.ts";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useEditorShortcuts(onSave: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      // Fabric's hidden textarea for inline text editing.
      if (document.activeElement?.getAttribute("data-fabric") === "textarea") return;
      const mod = e.ctrlKey || e.metaKey;
      const s = useEditor.getState();
      const k = e.key.toLowerCase();
      if (mod && k === "z" && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if ((mod && k === "y") || (mod && k === "z" && e.shiftKey)) {
        e.preventDefault();
        s.redo();
      } else if (mod && k === "c") {
        s.copy();
      } else if (mod && k === "v") {
        // Paste layers only; images are pasted via the paste event.
        if (s.clipboard.length) {
          e.preventDefault();
          s.paste();
        }
      } else if (mod && k === "d") {
        e.preventDefault();
        s.duplicate();
      } else if (mod && k === "s") {
        e.preventDefault();
        onSave();
      } else if (mod && k === "a") {
        e.preventDefault();
        if (s.doc) s.select(s.doc.layers.filter((l) => !l.locked && l.visible).map((l) => l.id));
      } else if (k === "delete" || k === "backspace") {
        if (s.selectedIds.length) {
          e.preventDefault();
          s.deleteSelected();
        }
      } else if (k === "escape") {
        if (s.tool !== "select") s.setTool("select");
        else s.select([]);
      } else if (k.startsWith("arrow") && s.selectedIds.length && s.doc) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = k === "arrowleft" ? -step : k === "arrowright" ? step : 0;
        const dy = k === "arrowup" ? -step : k === "arrowdown" ? step : 0;
        const patches: Record<string, Partial<Layer>> = {};
        for (const l of s.doc.layers) {
          if (s.selectedIds.includes(l.id) && !l.locked) patches[l.id] = { x: l.x + dx, y: l.y + dy };
        }
        edit((d) => updateLayers(d, patches), { coalesceKey: "nudge" });
      } else if (mod && (k === "=" || k === "+")) {
        e.preventDefault();
        s.setZoom(s.zoom * 1.2);
      } else if (mod && k === "-") {
        e.preventDefault();
        s.setZoom(s.zoom / 1.2);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);
}
