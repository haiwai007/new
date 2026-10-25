import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet.tsx";
import { cn } from "@/lib/utils.ts";
import BrandMark from "./brand-mark.tsx";
import { MORE_LINKS, SECTIONS, sectionFor } from "./nav-config.ts";

function useActiveSection() {
  const { pathname } = useLocation();
  return sectionFor(pathname)?.id;
}

export default function SiteHeader() {
  const active = useActiveSection();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link to="/" className="flex cursor-pointer items-center gap-2">
          <BrandMark />
          <span className="font-serif text-lg font-bold tracking-wide">海神作图</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              to={s.to}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-[15px] transition-colors",
                active === s.id ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <s.icon className="size-4" />
              {s.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                更多 <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {MORE_LINKS.map((l) => (
                <DropdownMenuItem key={l.to} asChild className="cursor-pointer">
                  <Link to={l.to}>{l.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/account">账户与同步</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="打开菜单">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle>海神作图</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 px-4">
                {SECTIONS.map((s) => (
                  <div key={s.id}>
                    <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                      <s.icon className="size-4 text-primary" /> {s.label}
                    </p>
                    {s.tabs.map((t) => (
                      <SheetClose asChild key={t.to}>
                        <Link to={t.to} className="block cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                          {t.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </div>
                ))}
                <div className="border-t pt-3">
                  {MORE_LINKS.map((l) => (
                    <SheetClose asChild key={l.to}>
                      <NavLink to={l.to} className="block cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                        {l.label}
                      </NavLink>
                    </SheetClose>
                  ))}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
