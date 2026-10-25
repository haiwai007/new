import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
export default class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 px-6"
      >
        <h1 className="text-2xl font-semibold">页面暂时无法加载</h1>
        <p className="text-muted-foreground">
          请检查网络后重试。已保存到本浏览器的作品不会被删除；重新加载可能丢失尚未保存的修改。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => window.location.reload()}>重新加载</Button>
          <Button asChild variant="outline">
            <Link to="/works">返回我的作品</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/backup">备份本地数据</Link>
          </Button>
        </div>
      </div>
    );
  }
}
