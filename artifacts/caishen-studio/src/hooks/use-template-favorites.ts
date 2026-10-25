import { useCallback, useEffect, useState } from "react";
import { getKv, setKv } from "@/lib/storage/works.ts";

const KEY = "favoriteTemplates";

/** Favorites for built-in templates, persisted locally. */
export function useTemplateFavorites() {
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => {
    getKv<string[]>(KEY, []).then(setFavs).catch(() => setFavs([]));
  }, []);
  const toggle = useCallback((id: string) => {
    setFavs((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      void setKv(KEY, next);
      return next;
    });
  }, []);
  return { favs, toggle };
}
