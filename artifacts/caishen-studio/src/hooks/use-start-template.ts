import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { startGalleryTemplate } from "@/lib/catalog-service/start";
import { usePublicCatalog } from "@/lib/catalog-service/provider";

/** Create a project from a built-in template and open it in the editor. */
export function useStartTemplate() {
  const navigate = useNavigate();
  const { templates } = usePublicCatalog();
  const [busy, setBusy] = useState<string | null>(null);
  const start = async (id: string) => {
    setBusy(id);
    try {
      const workId = await startGalleryTemplate(id, templates);
      navigate(`/editor/${workId}`);
    } catch (e) {
      toast.error("无法创建作品", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };
  return { start, busy };
}
