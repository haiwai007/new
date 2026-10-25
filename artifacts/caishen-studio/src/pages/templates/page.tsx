import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { BUILTIN_TEMPLATES, CATEGORIES } from "@/lib/template/builtin.ts";
import TemplateCard from "@/components/templates/template-card.tsx";
import { useStartTemplate } from "@/hooks/use-start-template.ts";
import { useTemplateFavorites } from "@/hooks/use-template-favorites.ts";
import { useWorks } from "@/hooks/use-works.ts";
import { startFromDoc } from "@/lib/template/start.ts";
import { cn } from "@/lib/utils.ts";
import CustomTemplateGrid from "./_components/custom-template-grid.tsx";

type Sort = "popular" | "latest" | "name";

export default function TemplatesPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "all";
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const [onlyFav, setOnlyFav] = useState(false);
  const { favs, toggle } = useTemplateFavorites();
  const { start, busy } = useStartTemplate();
  const { state, refresh } = useWorks();
  const navigate = useNavigate();

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return BUILTIN_TEMPLATES.filter((t) => category === "all" || t.category === category)
      .filter((t) => !onlyFav || favs.includes(t.id))
      .filter((t) => !kw || t.name.toLowerCase().includes(kw) || t.doc.parameters.some((p) => p.name.includes(kw)))
      .sort((a, b) =>
        sort === "popular"
          ? b.popularity - a.popularity
          : sort === "latest"
            ? b.addedAt.localeCompare(a.addedAt)
            : a.name.localeCompare(b.name, "zh"),
      );
  }, [category, q, sort, onlyFav, favs]);

  const customTemplates =
    state.status === "ready"
      ? state.works
          .filter((w) => w.kind === "template")
          .filter((w) => !onlyFav || w.favorite)
          .filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()))
      : [];

  const useCustom = async (id: string) => {
    const w = state.status === "ready" ? state.works.find((x) => x.id === id) : undefined;
    if (!w) return;
    try {
      const workId = await startFromDoc(w.doc, w.name, w.id);
      navigate(`/editor/${workId}`);
    } catch (e) {
      toast.error("无法使用模板", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const tabs = [{ id: "all", label: "全部" }, ...CATEGORIES, { id: "custom", label: "自定义模板" }];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">{category === "custom" ? "我的模板" : "模板库"}</h1>
          <p className="mt-1 text-muted-foreground">每个模板都由独立图层组成，可直接编辑或通过参数批量改内容。</p>
        </div>
        <Button asChild>
          <Link to="/custom">
            <Upload className="size-4" /> 从图片生成模板
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setParams(t.id === "all" ? {} : { category: t.id })}
            className={cn(
              "cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors",
              category === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索模板，例如：海报、价格" className="pl-9" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">最热门</SelectItem>
            <SelectItem value="latest">最新</SelectItem>
            <SelectItem value="name">按名称</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={onlyFav ? "default" : "secondary"} onClick={() => setOnlyFav((v) => !v)}>
          只看收藏
        </Button>
      </div>

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
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle>没有找到模板</EmptyTitle>
            <EmptyDescription>换个关键词试试，或者直接上传图片生成模板。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" asChild><Link to="/custom">上传图片</Link></Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.map((t) => (
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

      <div className="mt-10 flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          本平台不提供聊天截图、支付/钱包界面、银行卡、票据凭证等可能被用于伪造的模板，也请勿使用本平台制作冒充真实凭证或他人身份的图片。
        </p>
      </div>
    </div>
  );
}
