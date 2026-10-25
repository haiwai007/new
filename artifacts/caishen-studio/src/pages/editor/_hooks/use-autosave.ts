import { useCallback, useEffect, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { toast } from "sonner";
import { useEditor } from "@/stores/editor.ts";
import { saveWork } from "@/lib/storage/works.ts";
import { safeThumb } from "@/lib/template/start.ts";

/**
 * Debounced autosave to IndexedDB, plus manual save that creates a
 * history version. Status is shown in the top bar.
 */
export function useAutosave() {
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const persist = useCallback(async (snapshot: boolean) => {
    const { workId, doc, setSaveStatus } = useEditor.getState();
    if (!workId || !doc) return false;
    // Capture immediately (including unmount flush), then serialize thumbnail work and writes.
    // A slower manual thumbnail must never overwrite a newer autosave.
    const task = async () => {
      if (useEditor.getState().workId === workId) setSaveStatus("saving");
      try {
        const thumbnail = snapshot ? await safeThumb(doc) : undefined;
        await saveWork(workId, doc, { snapshot, thumbnail });
        const current = useEditor.getState();
        if (current.workId === workId)
          setSaveStatus(current.doc === doc ? "saved" : "dirty");
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "保存失败";
        if (useEditor.getState().workId === workId) setSaveStatus("error", msg);
        toast.error("保存失败", { description: msg });
        return false;
      }
    };
    const operation = queueRef.current.then(task, task);
    queueRef.current = operation;
    return operation;
  }, []);

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
