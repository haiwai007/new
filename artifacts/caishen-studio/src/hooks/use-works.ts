import { useCallback, useEffect, useState } from "react";
import { listWorks } from "@/lib/storage/works.ts";
import type { WorkRecord } from "@/lib/storage/db.ts";

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; works: WorkRecord[] };

const toError = (e: unknown): State => ({
  status: "error",
  error: e instanceof Error ? e.message : "读取本地作品失败",
});

/** Load works from IndexedDB. Call `refresh` after mutations. */
export function useWorks() {
  const [state, setState] = useState<State>({ status: "loading" });
  const refresh = useCallback(() => {
    listWorks()
      .then((works) => setState({ status: "ready", works }))
      .catch((e: unknown) => setState(toError(e)));
  }, []);
  useEffect(() => {
    let alive = true;
    listWorks()
      .then((works) => alive && setState({ status: "ready", works }))
      .catch((e: unknown) => alive && setState(toError(e)));
    return () => {
      alive = false;
    };
  }, []);
  return { state, refresh };
}
