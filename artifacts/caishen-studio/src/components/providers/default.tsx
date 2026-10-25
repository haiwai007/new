import { lazy, Suspense } from "react";
import { cloudConfig } from "@/lib/cloud-config";
const CloudServices = lazy(() => import("./cloud-services"));
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  const content = (
    <QueryClientProvider>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          {children}
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
  return cloudConfig.enabled ? (
    <Suspense
      fallback={
        <div role="status" className="p-6">
          正在初始化账户服务…
        </div>
      }
    >
      <CloudServices>{content}</CloudServices>
    </Suspense>
  ) : (
    content
  );
}
