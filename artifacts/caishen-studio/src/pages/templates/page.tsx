import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Layers3, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { usePublicCatalog } from "@/lib/catalog-service/provider";
import {
  paginationWindow,
  TEMPLATE_PAGE_SIZE,
  templateMatches,
} from "@/lib/template/catalog";
import TemplateCard from "@/components/templates/template-card.tsx";
import { useStartTemplate } from "@/hooks/use-start-template.ts";
import { useTemplateFavorites } from "@/hooks/use-template-favorites.ts";
import { useWorks } from "@/hooks/use-works.ts";
import { startFromDoc } from "@/lib/template/start.ts";
import { cn } from "@/lib/utils.ts";
import CustomTemplateGrid from "./_components/custom-template-grid.tsx";

type Sort = "popular" | "latest" | "name";

export default function TemplatesPage() {
  const { templates: BUILTIN_TEMPLATES, categories: CATEGORIES } =
    usePublicCatalog();
  const CATEGORY_COUNTS = Object.fromEntries(
    CATEGORIES.map((c) => [
      c.id,
      BUILTIN_TEMPLATES.filter((t) => t.category === c.id).length,
    ]),
  );
  const [params, setParams] = useSearchParams();
  const requestedCategory = params.get("category") ?? "all";
  const category =
    requestedCategory === "custom" ||
    CATEGORIES.some((c) => c.id === requestedCategory)
      ? requestedCategory
      : "all";
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [onlyFav, setOnlyFav] = useState(false);
  const { favs, toggle } = useTemplateFavorites();
  const { start, busy } = useStartTemplate();
  const { state, refresh } = useWorks();
  const navigate = useNavigate();

  const list = useMemo(() => {
    return BUILTIN_TEMPLATES.filter(
      (t) => category === "all" || t.category === category,
    )
      .filter((t) => !onlyFav || favs.includes(t.id))
      .filter((t) => templateMatches(t, q))
      .sort((a, b) =>
        sort === "popular"
          ? b.popularity - a.popularity
          : sort === "latest"
            ? b.addedAt.localeCompare(a.addedAt)
            : a.name.localeCompare(b.name, "zh"),
      );
  }, [category, q, sort, onlyFav, favs, BUILTIN_TEMPLATES]);

  const customTemplates =
    state.status === "ready"
      ? state.works
          .filter((w) => w.kind === "template")
          .filter((w) => !onlyFav || w.favorite)
          .filter(
            (w) =>
              !q.trim() ||
              w.name.toLowerCase().includes(q.trim().toLowerCase()),
          )
      : [];

  const useCustom = async (id: string) => {
    const w =
      state.status === "ready"
        ? state.works.find((x) => x.id === id)
        : undefined;
    if (!w) return;
    try {
      const workId = await startFromDoc(w.doc, w.name, w.id);
      navigate(`/editor/${workId}`);
    } catch (e) {
      toast.error("无法使用模板", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const tabs = [
    { id: "all", label: "全部" },
    ...CATEGORIES,
    { id: "custom", label: "自定义模板" },
  ];
  const pageCount = Math.max(1, Math.ceil(list.length / TEMPLATE_PAGE_SIZE));
  const currentPage = Math.min(Math.floor(page), pageCount);
  const visibleList = list.slice(
    (currentPage - 1) * TEMPLATE_PAGE_SIZE,
    currentPage * TEMPLATE_PAGE_SIZE,
  );
  const changePage = (next: number) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("page", String(next));
    setParams(nextParams);
  };
  const resetPage = () => {
    if (params.has("page")) {
      const next = new URLSearchParams(params);
      next.delete("page");
      setParams(next, { replace: true });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">
            {category === "custom" ? "我的模板" : "模板库"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            现有 {BUILTIN_TEMPLATES.length} 套模板、{CATEGORIES.length}{" "}
            个分类，可编辑图层，也可按参数批量生成。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/submit">提交模板</Link>
          </Button>
          <Button asChild>
            <Link to="/custom">
              <Upload className="size-4" /> 从图片生成模板
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 sm:hidden">
        <label className="block space-y-1 text-sm font-medium">
          模板分类
          <select
            aria-label="模板分类"
            value={category}
            onChange={(e) =>
              setParams(
                e.target.value === "all" ? {} : { category: e.target.value },
              )
            }
            className="h-11 w-full rounded-lg border bg-card px-3 text-sm"
          >
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.id === "all"
                  ? `（${BUILTIN_TEMPLATES.length}）`
                  : t.id !== "custom"
                    ? `（${CATEGORY_COUNTS[t.id]}）`
                    : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setParams(t.id === "all" ? {} : { category: t.id })}
            className={cn(
              "cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors",
              category === t.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-primary",
            )}
          >
            {t.label}{" "}
            <span className="ml-1 opacity-65">
              {t.id === "all"
                ? BUILTIN_TEMPLATES.length
                : t.id === "custom"
                  ? state.status === "ready"
                    ? state.works.filter((w) => w.kind === "template").length
                    : ""
                  : CATEGORY_COUNTS[t.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="搜索模板"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
            placeholder="搜索模板，例如：海报、价格、旅行"
            className="pl-9"
          />
        </div>
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v as Sort);
            resetPage();
          }}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">最热门</SelectItem>
            <SelectItem value="latest">最新</SelectItem>
            <SelectItem value="name">按名称</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={onlyFav ? "default" : "secondary"}
          onClick={() => {
            setOnlyFav((v) => !v);
            resetPage();
          }}
        >
          只看收藏
        </Button>
      </div>

      {category !== "custom" && (
        <p
          role="status"
          aria-label="模板筛选结果"
          className="mt-4 text-sm text-muted-foreground"
        >
          找到 {list.length} 套模板 · 每页 {TEMPLATE_PAGE_SIZE} 套
          {pageCount > 1 && ` · 第 ${currentPage} / ${pageCount} 页`}
        </p>
      )}

      {category === "custom" ? (
        <CustomTemplateGrid
          loading={state.status === "loading"}
          templates={customTemplates}
          onUse={useCustom}
          onChanged={refresh}
        />
      ) : list.length === 0 ? (
        <Empty className="mt-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>
              {category === "huimin-15" && !q.trim() && !onlyFav
                ? "惠民十五五暂无模板"
                : "没有找到模板"}
            </EmptyTitle>
            <EmptyDescription>
              {category === "huimin-15" && !q.trim() && !onlyFav
                ? "分类已建立，暂未收录模板。"
                : "换个关键词试试，或者直接上传图片生成模板。"}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" asChild>
              {category === "huimin-15" ? (
                <Link to="/templates">查看全部模板</Link>
              ) : (
                <Link to="/custom">上传图片</Link>
              )}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {visibleList.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              favorite={favs.includes(t.id)}
              onToggleFavorite={() => toggle(t.id)}
              onUse={() => start(t.id)}
              busy={busy === t.id}
            />
          ))}
        </div>
      )}

      {category !== "custom" && pageCount > 1 && (
        <nav
          aria-label="模板分页"
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          <Button
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => changePage(currentPage - 1)}
          >
            上一页
          </Button>
          {paginationWindow(currentPage, pageCount).map((n, i) =>
            n === "gap" ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-1">
                …
              </span>
            ) : (
              <Button
                key={n}
                variant={n === currentPage ? "default" : "outline"}
                aria-label={`第 ${n} 页`}
                aria-current={n === currentPage ? "page" : undefined}
                onClick={() => changePage(n)}
              >
                {n}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            disabled={currentPage >= pageCount}
            onClick={() => changePage(currentPage + 1)}
          >
            下一页
          </Button>
        </nav>
      )}

      <div className="mt-10 flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Layers3 className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          选择模板后会创建独立作品，可修改图层和参数；保存自己的设计后，也可另存为自定义模板。
        </p>
      </div>
    </div>
  );
}
