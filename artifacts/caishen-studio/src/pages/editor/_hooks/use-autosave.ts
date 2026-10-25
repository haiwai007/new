import { useCallback, useEffect, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { toast } from "sonner";
import { useEditor } from "@/stores/editor.ts";
import {
  createWork,
  WorkConflictError,
  saveWork,
} from "@/lib/storage/works.ts";
import type { WorkRecord } from "@/lib/storage/db";
import { workName } from "@/lib/storage/names";
import { subscribeWorkChanges } from "@/lib/storage/work-events";
import { safeThumb } from "@/lib/template/start.ts";

/**
 * Debounced autosave to IndexedDB, plus manual save that creates a
 * history version. Status is shown in the top bar.
 */
export function useAutosave() {
  const revisions = useRef(new Map<string, number>());
  const drafts = useRef(new Map<string, WorkRecord>());
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const persist = useCallback(async (snapshot: boolean) => {
    const { workId, doc, revision, loadId, setSaveStatus } =
      useEditor.getState();
    if (!workId || !doc) return false;
    const session = `${workId}:${loadId}`;
    if (!revisions.current.has(session))
      revisions.current.set(session, revision);
    // Capture immediately (including unmount flush), then serialize thumbnail work and writes.
    // A slower manual thumbnail must never overwrite a newer autosave.
    const task = async () => {
      if (
        useEditor.getState().workId === workId &&
        useEditor.getState().loadId === loadId
      )
        setSaveStatus("saving");
      try {
        const thumbnail = snapshot ? await safeThumb(doc) : undefined;
        let saved: WorkRecord;
        const draft = drafts.current.get(session);
        if (draft) {
          saved = await saveWork(
            draft.id,
            { ...doc, name: draft.name },
            {
              snapshot,
              thumbnail,
              expectedRevision: draft.revision ?? 0,
            },
          );
          drafts.current.set(session, saved);
        } else {
          try {
            saved = await saveWork(workId, doc, {
              snapshot,
              thumbnail,
              expectedRevision: revisions.current.get(session),
            });
            revisions.current.set(session, saved.revision ?? 0);
          } catch (error) {
            if (!(error instanceof WorkConflictError)) throw error;
            saved = await createWork({
              kind: "project",
              name: workName(doc.name, "（冲突副本）"),
              doc,
              thumbnail,
              origin: workId,
            });
            drafts.current.set(session, saved);
            toast.warning("检测到其他标签页的修改，当前修改已另存为冲突副本");
          }
        }
        const current = useEditor.getState();
        if (current.workId === workId && current.loadId === loadId) {
          const recovery = drafts.current.get(session);
          if (recovery) {
            useEditor.setState({ recoveryWorkId: recovery.id });
            setSaveStatus(
              current.doc === doc ? "error" : "dirty",
              "原作已变更，当前修改已自动保存为冲突副本；请打开副本继续编辑",
            );
          } else {
            useEditor.setState({
              revision: saved.revision ?? 0,
              ...(current.doc === doc && saved.name && saved.name !== doc.name
                ? { doc: { ...doc, name: saved.name } }
                : {}),
            });
            setSaveStatus(current.doc === doc ? "saved" : "dirty");
          }
        }
        return !drafts.current.has(session);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "保存失败";
        if (
          useEditor.getState().workId === workId &&
          useEditor.getState().loadId === loadId
        )
          setSaveStatus("error", msg);
        toast.error("保存失败", { description: msg });
        return false;
      }
    };
    const operation = queueRef.current.then(task, task);
    queueRef.current = operation;
    return operation;
  }, []);

  useEffect(
    () =>
      subscribeWorkChanges((change) => {
        const current = useEditor.getState();
        if (
          current.workId === change.id &&
          change.revision !== current.revision &&
          current.saveStatus === "saved"
        )
          current.setSaveStatus(
            "error",
            "作品已在其他标签页修改或删除；继续修改将自动另存冲突副本",
          );
      }),
    [],
  );

  const debounced = useDebouncedCallback(() => void persist(false), 1200);

  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        if (s.doc !== prev.doc && s.saveStatus === "dirty") debounced();
      }),
    [debounced],
  );

  // Flush on unmount / tab close.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (
        ["dirty", "saving", "error"].includes(useEditor.getState().saveStatus)
      ) {
        debounced.flush();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      debounced.flush();
    };
  }, [debounced]);

  const saveNow = useCallback(
    async (opts?: { silent?: boolean }) => {
      debounced.cancel();
      const ok = await persist(true);
      if (ok && !opts?.silent)
        toast.success("已保存到本地，并创建了一个历史版本");
      return ok;
    },
    [debounced, persist],
  );

  /** Drop any pending autosave (used before replacing the document from outside). */
  const cancelPending = useCallback(() => debounced.cancel(), [debounced]);

  return { saveNow, cancelPending };
}
