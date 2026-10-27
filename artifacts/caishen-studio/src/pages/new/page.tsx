import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import { startGalleryTemplate } from "@/lib/catalog-service/start";
import { usePublicCatalog } from "@/lib/catalog-service/provider";

/** Shareable link: /new?template=bt_coffee creates a project from a built-in template. */
export default function NewFromTemplatePage() {
  const { templates, loading } = usePublicCatalog();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get("template") ?? "blank_portrait";
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-invocation creating two projects.
    if (started.current || loading) return;
    started.current = true;
    startGalleryTemplate(id, templates)
      .then((workId) => navigate(`/editor/${workId}`, { replace: true }))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "创建作品失败"),
      );
  }, [id, navigate, loading, templates]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      {error ? (
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon">
              <AlertTriangle />
            </ErrorStateMedia>
            <ErrorStateTitle>无法创建作品</ErrorStateTitle>
            <ErrorStateDescription>{error}</ErrorStateDescription>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button size="sm" asChild>
              <Link to="/templates">返回模板中心</Link>
            </Button>
          </ErrorStateContent>
        </ErrorState>
      ) : (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          正在创建作品…
        </p>
      )}
    </div>
  );
}
