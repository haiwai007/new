import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BUILTIN_TEMPLATES,
  CATEGORIES,
  type BuiltinTemplate,
} from "../template/builtin";
import { SCHEMA_VERSION } from "../../types/template";
import {
  DEFAULT_POPUP,
  type ManagedCategory,
  type PopupSettings,
  type ManagedTemplate,
} from "./contracts";
import { readPublicCatalogue } from "./client";
export type SharedGalleryTemplate = BuiltinTemplate & {
  shared?: ManagedTemplate;
  categoryName?: string;
  thumbnailUrl?: string;
  parameterCount?: number;
};
type State = {
  categories: { id: string; label: string }[];
  templates: SharedGalleryTemplate[];
  popup: PopupSettings;
  loading: boolean;
  enabled: boolean;
  refresh: () => Promise<void>;
};
const fallback = {
  categories: CATEGORIES,
  templates: BUILTIN_TEMPLATES,
  popup: DEFAULT_POPUP,
  loading: true,
  enabled: false,
  refresh: async () => {},
};
const Context = createContext<State>(fallback);
export function PublicCatalogProvider({ children }: { children: ReactNode }) {
  const [data, setData] =
      useState<Awaited<ReturnType<typeof readPublicCatalogue>>>(null),
    [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const next = await readPublicCatalogue();
    if (current === generation.current) {
      setData(next);
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  const value = useMemo<State>(() => {
    if (!data) return { ...fallback, loading, refresh };
    const categories = data.categories
        .filter((c) => c.visible)
        .sort((a, b) => a.position - b.position),
      ids = new Set(categories.map((c) => c.id));
    const builtin = BUILTIN_TEMPLATES.filter((t) => ids.has(t.category)).map(
      (t) => ({
        ...t,
        categoryName: categories.find((c) => c.id === t.category)?.label,
      }),
    );
    const shared: SharedGalleryTemplate[] = data.templates
      .filter((t) => t.published && ids.has(t.category))
      .map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        categoryName: categories.find((c) => c.id === t.category)?.label,
        description: t.description,
        tags: t.tags,
        addedAt: new Date(t.createdAt).toISOString().slice(0, 10),
        popularity: 100000 - t.position,
        shared: t,
        thumbnailUrl: t.thumbnailUrl,
        parameterCount: t.parameterCount,
        doc: {
          schemaVersion: SCHEMA_VERSION,
          templateId: t.id,
          name: t.name,
          canvas: {
            width: t.width,
            height: t.height,
            backgroundColor: "#ffffff",
            backgroundImage: null,
          },
          parameters: [],
          layers: [],
          source: null,
        },
      }));
    return {
      categories,
      templates: [...shared, ...builtin],
      popup: data.popup,
      loading,
      enabled: true,
      refresh,
    };
  }, [data, loading, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const usePublicCatalog = () => useContext(Context);
