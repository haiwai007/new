import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import BrandMark from "./brand-mark";

export const ENTRY_SESSION_KEY = "haishen.entry-confirmed.v1";
const PHRASE = "沐北是sb";

function isConfirmed() {
  try {
    return sessionStorage.getItem(ENTRY_SESSION_KEY) === "yes";
  } catch {
    return false;
  }
}

/** A per-tab welcome prompt. The application mounts only after confirmation. */
export function EntryGate({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState(isConfirmed);
  const [value, setValue] = useState("");
  function confirm(next: string, composing: boolean) {
    setValue(next);
    if (composing || next !== PHRASE) return;
    try {
      sessionStorage.setItem(ENTRY_SESSION_KEY, "yes");
    } catch {
      /* Still allow this visit when storage is unavailable. */
    }
    setConfirmed(true);
  }
  if (confirmed) return children;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Dialog open>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <BrandMark className="mb-3 size-14 self-center sm:self-start" />
            <DialogTitle>欢迎使用海神作图</DialogTitle>
            <DialogDescription>
              请输入“{PHRASE}”，完整输入后即可进入。
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="entry-confirmation" className="text-sm font-medium">
            输入确认文字
          </label>
          <Input
            id="entry-confirmation"
            value={value}
            placeholder={PHRASE}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) =>
              confirm(
                event.target.value,
                (event.nativeEvent as InputEvent).isComposing,
              )
            }
            onCompositionEnd={(event) =>
              confirm(event.currentTarget.value, false)
            }
          />
          <p className="text-xs text-muted-foreground">
            本标签页内只需输入一次。
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
