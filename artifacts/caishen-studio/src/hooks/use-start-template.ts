import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { startFromBuiltin } from "@/lib/template/start.ts";

/** Create a project from a built-in template and open it in the editor. */
export function useStartTemplate() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const start = async (id: string) => {
    setBusy(id);
    try {
      const workId = await startFromBuiltin(id);
      navigate(`/editor/${workId}`);
    } catch (e) {
      toast.error("无法创建作品", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };
  return { start, busy };
}
