import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { useWorks } from "@/hooks/use-works.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function RecentWorks() {
  const { state } = useWorks();
  if (state.status === "error") return null;
  if (state.status === "ready" && state.works.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 md:px-6">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-serif text-2xl font-bold">我的最近作品</h2>
        <Link to="/works" className="flex cursor-pointer items-center gap-1 text-sm text-primary">
          全部作品 <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {state.status === "loading"
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full" />)
          : state.works.slice(0, 6).map((w) => (
              <Link
                key={w.id}
                to={`/editor/${w.id}`}
                className="group cursor-pointer overflow-hidden rounded-xl border bg-card"
              >
                <div className="flex aspect-square items-center justify-center bg-muted">
                  {w.thumbnail ? (
                    <img src={w.thumbnail} alt={w.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">无预览</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(w.updatedAt), { addSuffix: true, locale: zhCN })}
                  </p>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
