import { ConvexProviderWithHerculesAuth } from "@usehercules/auth/convex-react";
import { ConvexReactClient } from "convex/react";

import { cloudConfig } from "@/lib/cloud-config.ts";
const convex = cloudConfig.enabled ? new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!) : null;

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  if (!convex) return <>{children}</>;
  return (
    <ConvexProviderWithHerculesAuth client={convex}>
      {children}
    </ConvexProviderWithHerculesAuth>
  );
}
