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

export function paginationWindow(
  current: number,
  total: number,
): (number | "gap")[] {
  const pages = [
    ...new Set(
      [1, total, current - 1, current, current + 1].filter(
        (n) => n >= 1 && n <= total,
      ),
    ),
  ].sort((a, b) => a - b);
  return pages.flatMap((n, i) =>
    i && n - pages[i - 1] > 1 ? ["gap" as const, n] : [n],
  );
}
