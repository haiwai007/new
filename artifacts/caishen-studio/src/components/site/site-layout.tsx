import { Outlet } from "react-router-dom";
import SiteHeader from "./site-header.tsx";
import SiteFooter from "./site-footer.tsx";

export default function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
