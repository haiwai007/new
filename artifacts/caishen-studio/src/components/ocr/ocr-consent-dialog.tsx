import { useState } from "react";
import { Cpu, Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

/** Explains how OCR processes the image before anything runs. */
export default function OcrConsentDialog({
  open,
  providerLabel,
  onAnswer,
}: {
  open: boolean;
  providerLabel: string;
  onAnswer: (accepted: boolean, remember: boolean) => void;
}) {
  const [remember, setRemember] = useState(true);
  const items = [
    { icon: ShieldCheck, text: "图片只在你的浏览器里处理，不会上传到服务器，也不会发给任何第三方 AI 服务。" },
    { icon: Download, text: "首次使用需要从本站加载识别引擎和中英文模型（根据浏览器约 10–15MB），之后由浏览器缓存。" },
    { icon: Cpu, text: "识别在本机运行，大图可能需要 10–60 秒，期间可以随时取消。" },
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onAnswer(false, false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>启用文字识别</DialogTitle>
          <DialogDescription>使用「{providerLabel}」识别图片中的文字和位置。</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 text-sm">
          {items.map((i) => (
            <li key={i.text} className="flex gap-3">
              <i.icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          识别结果可能有错字或漏字，生成模板前可以逐条检查和修改。文字识别无法还原被文字遮住的背景。
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          以后不再询问
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onAnswer(false, false)}>取消</Button>
          <Button onClick={() => onAnswer(true, remember)}>同意并开始识别</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
