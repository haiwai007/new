import { Link, NavLink } from "react-router-dom";
import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet.tsx";
import { cn } from "@/lib/utils.ts";
import BrandMark from "./brand-mark.tsx";

const NAV = [
  { to: "/", label: "首页", end: true },
  { to: "/templates", label: "模板中心" },
  { to: "/custom", label: "自定义模板" },
  { to: "/works", label: "我的作品" },
  { to: "/batch", label: "批量生成" },
  { to: "/assets", label: "素材库" },
  { to: "/help", label: "帮助中心" },
  { to: "/account", label: "云端账户" },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={onNavigate}
          data-testid={`link-nav-${n.to === "/" ? "home" : n.to.slice(1)}`}
          className={({ isActive }) =>
            cn(
              "cursor-pointer rounded-md px-3 py-2 text-sm transition-colors",
              isActive ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          {n.label}
        </NavLink>
      ))}
    </>
  );
}

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link to="/" className="flex cursor-pointer items-center gap-2">
          <BrandMark />
          <span className="font-serif text-lg font-bold tracking-wide">海神作图</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 xl:flex">
          <NavItems />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/account">账户与同步</Link></Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/custom">
              <Sparkles className="size-4" />
              上传生成模板
            </Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="xl:hidden" aria-label="打开菜单">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>海神作图</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                <NavItems />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
