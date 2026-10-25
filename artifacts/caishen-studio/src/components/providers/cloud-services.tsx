import { AuthProvider } from "./auth";
import { ConvexProvider } from "./convex";
export default function CloudServices({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ConvexProvider>{children}</ConvexProvider>
    </AuthProvider>
  );
}
