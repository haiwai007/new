import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
export class CloudBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div role="alert" className="rounded-xl border p-6"><h2 className="font-semibold">云端服务暂时不可用</h2><p className="my-3">请检查网络和服务部署后重试。本地作品仍保存在当前浏览器中。</p><Button onClick={() => this.setState({ failed: false })}>重试</Button></div>;
    return this.props.children;
  }
}
