import { useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePublicCatalog } from "@/lib/catalog-service/provider";
import type { PopupSettings } from "@/lib/catalog-service/contracts";
import BrandMark from "./brand-mark";
export const ENTRY_SESSION_KEY = "haishen.entry-confirmed.v1";
function storageKey(settings: PopupSettings) {
  return settings.revision
    ? `${ENTRY_SESSION_KEY}:${settings.revision}`
    : ENTRY_SESSION_KEY;
}
function isConfirmed(settings: PopupSettings) {
  if (settings.frequency === "visit") return false;
  try {
    return sessionStorage.getItem(storageKey(settings)) === "yes";
  } catch {
    return false;
  }
}
/** The first visitor popup is frozen for this page load, so later edits never unmount active work. */
export function EntryGate({ children }: { children: ReactNode }) {
  const { popup, loading } = usePublicCatalog(),
    { pathname } = useLocation();
  const snapshot = useRef<PopupSettings | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [value, setValue] = useState("");
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return children;
  if (!snapshot.current && !loading) snapshot.current = popup;
  if (!snapshot.current)
    return (
      <main
        role="status"
        className="flex min-h-dvh items-center justify-center"
      >
        正在加载页面设置…
      </main>
    );
  const settings = snapshot.current;
  if (!settings.enabled || confirmed || isConfirmed(settings)) return children;
  function approve() {
    if (settings.frequency === "tab")
      try {
        sessionStorage.setItem(storageKey(settings), "yes");
      } catch {
        /* Allow this visit when storage is unavailable. */
      }
    setConfirmed(true);
  }
  function change(next: string, composing: boolean) {
    setValue(next);
    if (!composing && next === settings.phrase) approve();
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Dialog open>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <BrandMark className="mb-3 size-14 self-center sm:self-start" />
            <DialogTitle>{settings.title}</DialogTitle>
            <DialogDescription className="break-words whitespace-pre-wrap">
              {settings.message ||
                (settings.mode === "phrase"
                  ? `请输入“${settings.phrase}”，完整输入后即可进入。`
                  : "确认后进入作图。")}
            </DialogDescription>
          </DialogHeader>
          {settings.mode === "phrase" ? (
            <>
              <label
                htmlFor="entry-confirmation"
                className="text-sm font-medium"
              >
                输入确认文字
              </label>
              <Input
                id="entry-confirmation"
                value={value}
                placeholder={settings.phrase}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) =>
                  change(
                    e.target.value,
                    (e.nativeEvent as InputEvent).isComposing,
                  )
                }
                onCompositionEnd={(e) => change(e.currentTarget.value, false)}
              />
            </>
          ) : (
            <Button onClick={approve}>{settings.buttonText}</Button>
          )}
          <p className="text-xs text-muted-foreground">
            {settings.frequency === "tab"
              ? "本标签页内只需确认一次。"
              : "每次重新打开页面时显示。"}
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
