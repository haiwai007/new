type WorkChange = { id: string; revision: number | null };
const listeners = new Set<(change: WorkChange) => void>();
let channel: BroadcastChannel | undefined;
function getChannel() {
  if (
    !channel &&
    typeof window !== "undefined" &&
    typeof BroadcastChannel !== "undefined"
  ) {
    try {
      channel = new BroadcastChannel("haishen-work-changes");
    } catch {
      return undefined;
    }
    channel.onmessage = (event: MessageEvent<WorkChange>) => {
      const value = event.data;
      if (
        value &&
        typeof value.id === "string" &&
        (value.revision === null || Number.isSafeInteger(value.revision))
      )
        for (const listener of listeners) listener(value);
    };
  }
  return channel;
}
export function notifyWorkChange(id: string, revision: number | null) {
  try {
    getChannel()?.postMessage({ id, revision });
  } catch {
    /* Storage is authoritative if notifications are unavailable. */
  }
}
export function subscribeWorkChanges(listener: (change: WorkChange) => void) {
  listeners.add(listener);
  getChannel();
  return () => {
    listeners.delete(listener);
  };
}
