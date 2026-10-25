import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  Brush,
  Download,
  FileImage,
  Layers,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { BUILTIN_TEMPLATES, CATEGORIES } from "@/lib/template/builtin.ts";
import TemplateCard from "@/components/templates/template-card.tsx";
import { useStartTemplate } from "@/hooks/use-start-template.ts";
import { useTemplateFavorites } from "@/hooks/use-template-favorites.ts";
import RecentWorks from "./_components/recent-works.tsx";
import HeroCanvas from "./_components/hero-canvas.tsx";

const STEPS = [
  { icon: Upload, title: "上传参考图", desc: "拖拽、点击或粘贴图片，自动读取尺寸与格式" },
  { icon: Layers, title: "拆成图层", desc: "框选文字、图片区域，遮盖原文字，生成独立图层" },
  { icon: SlidersHorizontal, title: "设置参数", desc: "把标题、价格、图片变成表单参数，改参数就出图" },
  { icon: Download, title: "高清导出", desc: "按原始分辨率或倍率导出 PNG / JPEG" },
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function Index() {
  const navigate = useNavigate();
  const { start, busy } = useStartTemplate();
  const { favs, toggle } = useTemplateFavorites();
  const real = BUILTIN_TEMPLATES.filter((t) => t.category !== "blank");
  const hot = [...real].sort((a, b) => b.popularity - a.popularity).slice(0, 4);
  const latest = [...real].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 4);

  return (
    <div>
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.8_0.13_80/0.35),transparent_55%),radial-gradient(ellipse_at_bottom_left,oklch(0.52_0.2_25/0.18),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(45deg,currentColor_0_1px,transparent_1px_14px)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 md:grid-cols-[1.1fr_1fr] md:px-6 md:py-20">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground dark:text-accent"
            >
              <Sparkles className="size-3.5" /> 打开网页即可作图 · 无需下载 · 无需注册
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease }}
              className="mt-5 text-balance font-serif text-4xl font-bold leading-tight md:text-6xl"
            >
              上传一张图，
              <br />
              <span className="text-primary">变成能改参数的模板</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease }}
              className="mt-5 max-w-xl text-lg text-muted-foreground"
            >
              把参考图拆成独立的文字、图片和形状图层，再把关键内容设置成参数。下次只需填写表单，就能得到一张新图。
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24, ease }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Button size="lg" className="h-12 px-6 text-base" onClick={() => navigate("/custom")}>
                <Upload className="size-5" /> 上传图片，立即生成模板
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-6 text-base"
                onClick={() => start("blank_portrait")}
                disabled={busy !== null}
              >
                <Brush className="size-5" /> 开始创作
              </Button>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease }}
          >
            <HeroCanvas />
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to={`/templates?category=${c.id}`}
              className="cursor-pointer rounded-full border bg-card px-4 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
            >
              {c.label}
            </Link>
          ))}
          <Link
            to="/templates?category=custom"
            className="cursor-pointer rounded-full border bg-card px-4 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
          >
            我的自定义模板
          </Link>
        </div>
      </section>

      <RecentWorks />

      {[
        { title: "热门模板", items: hot },
        { title: "最新模板", items: latest },
      ].map((s) => (
        <section key={s.title} className="mx-auto max-w-7xl px-4 pb-12 md:px-6">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-serif text-2xl font-bold">{s.title}</h2>
            <Link to="/templates" className="flex cursor-pointer items-center gap-1 text-sm text-primary">
              查看全部 <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {s.items.map((t) => (
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
        </section>
      ))}

      <section className="border-t bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
          <h2 className="font-serif text-2xl font-bold">新手指引：四步做出你的模板</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-serif text-3xl font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <p className="mt-4 font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
            <FileImage className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              关于自动识别：文字识别（OCR）在你的浏览器本地运行，图片不会发给第三方。它能识别文字、位置、颜色和纯色色块，结果可以逐条修改；识别不到的内容可以在编辑器里手动框选补上。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
