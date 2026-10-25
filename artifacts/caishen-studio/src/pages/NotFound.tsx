import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-2xl font-semibold">页面不存在</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          这个页面可能已被移动，或地址输入有误。
        </p>
        <div className="pt-4">
          <Button asChild>
            <Link to="/">返回首页</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
