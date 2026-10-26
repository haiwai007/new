import { invalidateLocation } from "@/lib/status-location/model";
import { syncPhoneTextSettings } from "@/lib/phone/layers";
import { create } from "zustand";
import type { Layer, TemplateDoc } from "@/types/template.ts";
import { cloneLayers, addLayers, expandToGroups, removeLayers } from "@/lib/template/doc-ops.ts";

const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;

export type Tool = "select" | "draw-text" | "draw-image" | "draw-mask" | "draw-rect" | "draw-ocr";
/** Canvas-space region the user asked to run OCR on. */
export type OcrRequest = { x: number; y: number; width: number; height: number; full: boolean };
export type SaveStatus = "saved" | "dirty" | "saving" | "error";
export type LeftPanel =
  | "templates"
  | "custom"
  | "layers"
  | "text"
  | "image"
  | "shape"
  | "background"
  | "assets"
  | "params"
  | "phone"
  | "status-location";

type CommitOptions = {
  /** Consecutive commits with the same key inside a short window merge into one undo step. */
  coalesceKey?: string;
};

type EditorState = {
  workId: string | null;
  doc: TemplateDoc | null;
  revision: number;
  loadId: number;
  recoveryWorkId: string | null;
  past: TemplateDoc[];
  future: TemplateDoc[];
  lastCommit: { key: string; at: number } | null;
  selectedIds: string[];
  clipboard: Layer[];
  zoom: number;
  tool: Tool;
  saveStatus: SaveStatus;
  saveError: string | null;
  leftPanel: LeftPanel;
  rightTab: "props" | "params";
  ocrRequest: OcrRequest | null;
  setOcrRequest: (r: OcrRequest | null) => void;
  repairOpen: boolean;
  setRepairOpen: (o: boolean) => void;
  load: (workId: string, doc: TemplateDoc, revision?: number) => void;
  reset: () => void;
  commit: (doc: TemplateDoc, opts?: CommitOptions) => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  deleteSelected: () => void;
  setZoom: (z: number) => void;
  setTool: (t: Tool) => void;
  setSaveStatus: (s: SaveStatus, error?: string | null) => void;
  setLeftPanel: (p: LeftPanel) => void;
  setRightTab: (t: "props" | "params") => void;
};

export const useEditor = create<EditorState>((set, get) => ({
  revision: 0,
  loadId: 0,
  recoveryWorkId: null,
  workId: null,
  doc: null,
  past: [],
  future: [],
  lastCommit: null,
  selectedIds: [],
  clipboard: [],
  zoom: 0.5,
  tool: "select",
  saveStatus: "saved",
  saveError: null,
  leftPanel: "layers",
  rightTab: "props",
  ocrRequest: null,
  setOcrRequest: (ocrRequest) => set({ ocrRequest }),
  repairOpen: false,
  setRepairOpen: (repairOpen) => set({ repairOpen }),

  load: (workId, doc, revision = 0) =>
    set({
      workId,
      doc,
      revision,
      loadId: get().loadId + 1,
      recoveryWorkId: null,
      past: [],
      future: [],
      lastCommit: null,
      selectedIds: [],
      saveStatus: "saved",
      saveError: null,
      tool: "select",
      ocrRequest: null,
      repairOpen: false,
    }),

  reset: () => set({ workId: null, doc: null, past: [], future: [], selectedIds: [] }),

  commit: (doc, opts) => {
    const { doc: prev, past, lastCommit } = get();
    if (!prev || prev === doc) return;
    doc = invalidateLocation(syncPhoneTextSettings(doc));
    const now = Date.now();
    const merge =
      opts?.coalesceKey !== undefined &&
      lastCommit?.key === opts.coalesceKey &&
      now - lastCommit.at < COALESCE_MS;
    const ids = new Set(doc.layers.map((l) => l.id));
    set({
      doc,
      past: merge ? past : [...past, prev].slice(-HISTORY_LIMIT),
      future: [],
      lastCommit: opts?.coalesceKey ? { key: opts.coalesceKey, at: now } : null,
      selectedIds: get().selectedIds.filter((id) => ids.has(id)),
      saveStatus: "dirty",
    });
  },

  undo: () => {
    const { past, doc, future } = get();
    if (!doc || past.length === 0) return;
    const prev = past[past.length - 1];
    const ids = new Set(prev.layers.map((l) => l.id));
    set({
      doc: prev,
      past: past.slice(0, -1),
      future: [doc, ...future],
      lastCommit: null,
      selectedIds: get().selectedIds.filter((id) => ids.has(id)),
      saveStatus: "dirty",
    });
  },

  redo: () => {
    const { past, doc, future } = get();
    if (!doc || future.length === 0) return;
    const [next, ...rest] = future;
    const ids = new Set(next.layers.map((l) => l.id));
    set({
      doc: next,
      past: [...past, doc],
      future: rest,
      lastCommit: null,
      selectedIds: get().selectedIds.filter((id) => ids.has(id)),
      saveStatus: "dirty",
    });
  },

  select: (ids) => {
    const doc = get().doc;
    const next = doc ? expandToGroups(doc, ids) : ids;
    const cur = get().selectedIds;
    if (cur.length === next.length && cur.every((id, i) => id === next[i])) return;
    set({ selectedIds: next });
  },

  copy: () => {
    const { doc, selectedIds } = get();
    if (!doc) return;
    set({ clipboard: doc.layers.filter((l) => selectedIds.includes(l.id)) });
  },

  paste: () => {
    const { doc, clipboard, commit } = get();
    if (!doc || clipboard.length === 0) return;
    const clones = cloneLayers(clipboard);
    commit(addLayers(doc, clones));
    set({ selectedIds: clones.map((l) => l.id), clipboard: clones });
  },

  duplicate: () => {
    const { doc, selectedIds, commit } = get();
    if (!doc) return;
    const src = doc.layers.filter((l) => selectedIds.includes(l.id));
    if (src.length === 0) return;
    const clones = cloneLayers(src);
    commit(addLayers(doc, clones));
    set({ selectedIds: clones.map((l) => l.id) });
  },

  deleteSelected: () => {
    const { doc, selectedIds, commit } = get();
    if (!doc) return;
    const deletable = doc.layers.filter((l) => selectedIds.includes(l.id) && !l.locked).map((l) => l.id);
    if (deletable.length === 0) return;
    commit(removeLayers(doc, deletable));
    set({ selectedIds: [] });
  },

  setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.05, z)) }),
  setTool: (tool) => set({ tool }),
  setSaveStatus: (saveStatus, error = null) => set({ saveStatus, saveError: error }),
  setLeftPanel: (leftPanel) => set({ leftPanel }),
  setRightTab: (rightTab) => set({ rightTab }),
}));

/** Convenience: commit a transformation of the current document. */
export function edit(fn: (doc: TemplateDoc) => TemplateDoc, opts?: CommitOptions) {
  const { doc, commit } = useEditor.getState();
  if (!doc) return;
  commit(fn(doc), opts);
}
