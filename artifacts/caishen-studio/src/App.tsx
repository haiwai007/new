import { PublicCatalogProvider } from "./lib/catalog-service/provider";
import { EntryGate } from "./components/site/entry-gate";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { cloudConfig } from "./lib/cloud-config.ts";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SiteLayout from "./components/site/site-layout.tsx";
import { Spinner } from "./components/ui/spinner.tsx";

import PageBoundary from "./components/page-boundary";
import { authCallbackMessages } from "./pages/auth/callback-messages";
// The editor pulls in most of the UI; load it on demand.
const EditorPage = lazy(() => import("./pages/editor/page.tsx"));

const BackupPage = lazy(() => import("./pages/backup/page.tsx"));
const AccountPage = lazy(() => import("./pages/account/page.tsx"));
const AdminPage = lazy(() => import("./pages/admin/page.tsx"));
const CloudAdminPage = lazy(() => import("./pages/admin/cloud-admin.tsx"));
const AuthCallback = lazy(() => import("./pages/auth/Callback.tsx"));
const TemplatesPage = lazy(() => import("./pages/templates/page.tsx"));
const CustomTemplatePage = lazy(() => import("./pages/custom/page.tsx"));
const WorksPage = lazy(() => import("./pages/works/page.tsx"));
const HelpPage = lazy(() => import("./pages/help/page.tsx"));
const NewFromTemplatePage = lazy(() => import("./pages/new/page.tsx"));
const BatchPage = lazy(() => import("./pages/batch/page.tsx"));
const AssetsPage = lazy(() => import("./pages/assets/page.tsx"));

export default function App() {
  return (
    <PublicCatalogProvider>
      <BrowserRouter>
        <EntryGate>
          <DefaultProviders>
            <AppRoutes />
          </DefaultProviders>
        </EntryGate>
      </BrowserRouter>
    </PublicCatalogProvider>
  );
}
function AppRoutes() {
  const location = useLocation();
  return (
    <PageBoundary key={location.pathname}>
      <Suspense
        fallback={
          <div
            role="status"
            className="flex min-h-[50vh] items-center justify-center gap-3"
          >
            <Spinner />
            正在加载页面…
          </div>
        }
      >
        <Routes>
          <Route
            path="/auth/callback"
            element={
              cloudConfig.enabled ? (
                <AuthCallback messages={authCallbackMessages.zh} />
              ) : (
                <AccountPage />
              )
            }
          />
          <Route
            path="/editor/:workId"
            element={
              <Suspense
                fallback={
                  <div className="flex h-screen items-center justify-center">
                    <Spinner />
                  </div>
                }
              >
                <EditorPage />
              </Suspense>
            }
          />
          <Route path="/new" element={<NewFromTemplatePage />} />
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/custom" element={<CustomTemplatePage />} />
            <Route path="/works" element={<WorksPage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/cloud" element={<CloudAdminPage />} />
            <Route path="/help" element={<HelpPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </PageBoundary>
  );
}
