import { useState } from "react";
import { BUILTIN_TEMPLATES } from "@/lib/template/builtin.ts";
import TemplatePreview from "@/components/templates/template-preview.tsx";
import { applyParamValue } from "@/lib/template/params.ts";

const base = BUILTIN_TEMPLATES.find((t) => t.id === "bt_coffee")!;
const VARIANTS = ["桂花燕麦拿铁", "生椰冷萃", "焦糖海盐美式"];

/** Hero: the same template rendered with different parameter values. */
export default function HeroCanvas() {
  const [i, setI] = useState(0);
  const titleParam = base.doc.parameters.find((p) => p.id === "p_title")!;
  const doc = applyParamValue(base.doc, titleParam, VARIANTS[i]);
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="absolute -inset-4 -z-10 rotate-3 rounded-3xl bg-accent/30" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <TemplatePreview doc={doc} cacheKey={`hero_${i}`} />
      </div>
      <div className="mt-4 rounded-xl border bg-card p-3 shadow-lg">
        <p className="text-xs text-muted-foreground">模板参数 · 主标题</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {VARIANTS.map((v, idx) => (
            <button
              key={v}
              type="button"
              onClick={() => setI(idx)}
              className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm transition-colors ${
                idx === i ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
