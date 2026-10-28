import { useState } from "react";
import { useNavigate } from "react-router-dom";

/** Open the shared single/batch drawing workspace without editing the source template. */
export function useStartTemplate() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const start = async (id: string) => {
    setBusy(id);
    try {
      navigate(`/draw?template=${encodeURIComponent(`b:${id}`)}`);
    } finally {
      setBusy(null);
    }
  };
  return { start, busy };
}
