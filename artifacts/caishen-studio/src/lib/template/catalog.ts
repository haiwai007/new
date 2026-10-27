import { BUILTIN_TEMPLATES, CATEGORIES, type BuiltinTemplate } from "./builtin";
export const TEMPLATE_PAGE_SIZE = 24;
export function templateMatches(
  template: BuiltinTemplate,
  query: string,
): boolean {
  const keywords = query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const haystack = [
    template.name,
    template.description ?? "",
    ...(template.tags ?? []),
    CATEGORIES.find((c) => c.id === template.category)?.label ?? "",
    ...template.doc.parameters.map((p) => p.name),
  ]
    .join(" ")
    .toLocaleLowerCase();
  return keywords.every((keyword) => haystack.includes(keyword));
}
export const CATEGORY_COUNTS = Object.fromEntries(
  CATEGORIES.map((c) => [
    c.id,
    BUILTIN_TEMPLATES.filter((t) => t.category === c.id).length,
  ]),
);
