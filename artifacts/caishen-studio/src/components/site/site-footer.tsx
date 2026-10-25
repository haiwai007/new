import { Link } from "react-router-dom";
import BrandMark from "./brand-mark.tsx";

export default function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-2">
          <BrandMark className="size-6" />
          <span>© {new Date().getFullYear()} 海神作图 · 作品默认仅保存在你的浏览器本地</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link className="cursor-pointer hover:text-foreground" to="/backup">备份与恢复</Link>
          <Link className="cursor-pointer hover:text-foreground" to="/templates">模板</Link>
          <Link className="cursor-pointer hover:text-foreground" to="/works">做图</Link>
          <Link className="cursor-pointer hover:text-foreground" to="/help">帮助中心</Link>
          <Link className="cursor-pointer hover:text-foreground" to="/help#usage">使用规范</Link>
        </div>
      </div>
    </footer>
  );
}
