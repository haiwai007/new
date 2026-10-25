import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import { sectionFor } from "./nav-config.ts";

export default function SectionTabs() {
  const { pathname, search } = useLocation();
  const section = sectionFor(pathname);
  if (!section) return null;
  return (
    <div className="border-b bg-muted/30">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 md:px-6">
        <span className="mr-3 flex shrink-0 items-center gap-1.5 py-3 text-sm font-semibold">
          <section.icon className="size-4 text-primary" />
          {section.label}
        </span>
        {section.tabs.map((t) => {
          const active = t.match(pathname, search);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "shrink-0 cursor-pointer border-b-2 px-3 py-3 text-sm transition-colors",
                active
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
