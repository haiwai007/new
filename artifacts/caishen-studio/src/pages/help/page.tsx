import {
  CheckCircle2,
  CircleDashed,
  Keyboard,
  ShieldAlert,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import { Link } from "react-router-dom";
import { cloudConfig } from "@/lib/cloud-config";
import { Kbd } from "@/components/ui/kbd.tsx";

const SHORTCUTS: [string, string][] = [
  ["Ctrl / ⌘ + Z", "撤销"],
  ["Ctrl / ⌘ + Y 或 Shift + Z", "重做"],
  ["Ctrl / ⌘ + C / V", "复制 / 粘贴图层"],
  ["Ctrl / ⌘ + D", "复制所选"],
  ["Ctrl / ⌘ + S", "保存并创建历史版本"],
  ["Ctrl / ⌘ + A", "全选"],
  ["Delete / Backspace", "删除所选"],
  ["方向键（+ Shift）", "微移 1px（10px）"],
  ["Ctrl / ⌘ + 滚轮 或 + / -", "缩放画布"],
  ["Esc", "取消框选工具 / 取消选择"],
];

const STATUS: { done: boolean; label: string }[] = [
  { done: true, label: "手机机型预设、状态栏图标、时间、日期、电量、充电、信号和网络设置" },
  { done: true, label: "首页、模板中心、内置可编辑模板（真实图层数据）" },
  {
    done: true,
    label:
      "编辑器：文字、图片、形状、背景、图层、对齐、组合、锁定、隐藏、撤销重做",
  },
  {
    done: true,
    label: "上传参考图生成模板：原图背景模式、手动重建模式、框选文字/图片/遮罩",
  },
  {
    done: true,
    label:
      "模板参数：16 种参数类型、分组、填写说明、字数/数值范围/步长、手机号/邮箱/网址/价格等格式校验、排序、恢复默认值",
  },
  {
    done: true,
    label:
      "本地保存（浏览器 IndexedDB）、自动保存、历史版本（预览图、改动说明、备注、恢复、删除、复制为新作品）",
  },
  { done: true, label: "模板文件导入导出（包含图片，可在其他浏览器打开）" },
  { done: true, label: "PNG / JPEG 高清导出、透明背景、自定义尺寸" },
  {
    done: true,
    label:
      "文字自动识别（OCR，浏览器本地运行）：智能重建模式、识别结果校正、编辑器内框选识别",
  },
  {
    done: true,
    label:
      "背景修复（浏览器本地按周围颜色填补旧文字区域，修复前后滑动对比，可恢复原图）",
  },
  {
    done: true,
    label:
      "智能排版：画布换尺寸时智能适配、文字自动缩小或加高、图片智能焦点裁剪",
  },
  { done: false, label: "AI 照片背景修复（复杂照片细节还原，需接入云端服务）" },
  {
    done: true,
    label: "批量生成（CSV 导入、字段映射、逐行校验、PNG 导出与 ZIP 打包）",
  },
  {
    done: true,
    label: "独立素材库（浏览器本地图片管理、预览、分类与安全删除）",
  },
  {
    done: true,
    label: "整库备份与事务恢复：作品、历史版本、素材库、导出记录和收藏",
  },
  {
    done: true,
    label: `账户与手动云端备份、管理员审计及维护设置（${cloudConfig.enabled ? "已填写服务配置，连接状态请查看账户页" : "当前未启用，需配置并部署服务"}）`,
  },
];

const FAQ = [
  { q: "如何选择手机型号并设置时间、电量？", a: "在编辑器左侧（手机端底部）的‘手机’工具中选择机型，调整时间、日期、电量、充电、信号、Wi-Fi、飞行模式等，再点击‘应用手机状态栏’。默认不改画布尺寸；需要时勾选‘同时适配机型画布尺寸’。设置会保存并出现在导出图片中，支持撤销。生成图层默认锁定，重新应用会按面板设置更新并置顶。" },
  {
    q: "完整备份与云端备份有什么区别？",
    a: "备份与恢复页面可以导出不超过 100MB 的整库文件，包含作品、历史版本、素材库、导出记录和收藏；确认恢复后创建副本，不覆盖原有数据。账户页的云端备份按作品手动上传，每个账户最多 100 个，单个不超过 8MB，包含当前文档和引用图片，不包含历史版本与未引用素材。完整备份不包含登录凭据和服务密钥。",
  },
  {
    q: "作品保存在哪里？",
    a: "默认保存在当前浏览器的本地存储（IndexedDB）中。只有启用云端服务、登录并主动上传备份时，所选作品和引用图片才会上传。换浏览器不会自动显示本地作品；可使用完整备份恢复，或登录同一账户下载已上传的云端副本。清理站点数据前请先备份。",
  },
  {
    q: "上传图片后为什么文字不能直接编辑？",
    a: "图片里的文字是像素，不是文字。上传时选择「智能重建」，系统会在浏览器本地识别文字和位置，生成可编辑的文字图层，并可选择「修复背景」去掉原图中的旧文字，或用纯色遮罩盖住。识别有误可以逐条修改；漏掉的文字可在编辑器「文字」面板中用「框选区域识别文字」或「框选区域添加文字」补上。",
  },
  {
    q: "背景修复的效果如何？",
    a: "背景修复在浏览器本地运行，按旧文字周围的颜色平滑填补。纯色、渐变和简单纹理背景效果很好；照片中细节丰富的区域（人物、物品、复杂花纹）修复后会显得模糊，无法还原被文字挡住的真实细节。修复前可以滑动对比，应用后可按 Ctrl+Z 撤销，或在「背景」中恢复为上传的原图。",
  },
  {
    q: "文字识别会上传我的图片吗？",
    a: "不会。识别引擎（Tesseract.js）在浏览器中运行。首次使用需要从本站加载约 10–15MB 的引擎和中英文模型，之后由浏览器缓存。使用前会弹窗说明并征求你的同意。",
  },
  {
    q: "怎么把模板发给别人或换电脑使用？",
    a: "在「我的作品」的作品菜单，或编辑器右上角「⋯」中选择「导出模板文件」，会下载一个包含全部图层、参数和图片的 .caishen.json 文件。对方在「我的作品 → 导入模板」中选择这个文件即可打开。文件超过 80MB 时无法导出。",
  },
  {
    q: "什么是模板参数？",
    a: "把某个图层的文字、图片、颜色、字号、位置等设为参数后，可以在右侧「模板参数」面板中像填表一样修改。参数通过图层的固定编号绑定，调整图层顺序不会影响绑定。",
  },
  {
    q: "导出的图片为什么很清晰？",
    a: "导出时会按照设计的原始尺寸（或你选择的倍率）重新渲染，与编辑器当前的缩放比例无关。导出前会检查字体和图片是否加载完成，并提示缺失的资源。",
  },
  {
    q: "修改模板会影响已经做好的作品吗？",
    a: "不会。用模板新建作品时会复制一份完整数据，之后修改模板不会改动已有作品。",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <h1 className="font-serif text-3xl font-bold">帮助中心</h1>
      <div className="mt-4 flex gap-5 text-sm text-primary">
        <Link to="/backup" className="underline">
          备份与恢复
        </Link>
        <Link to="/account" className="underline">
          账户与云端状态
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">当前版本功能</h2>
        <ul className="mt-3 space-y-2">
          {STATUS.map((s) => (
            <li key={s.label} className="flex items-start gap-2 text-sm">
              {s.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-3" />
              ) : (
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={s.done ? "" : "text-muted-foreground"}>
                {s.label}
                {!s.done && "（开发中）"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">常见问题</h2>
        <Accordion type="single" collapsible className="mt-2">
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="cursor-pointer">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Keyboard className="size-5" /> 键盘快捷键
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SHORTCUTS.map(([k, d]) => (
            <div
              key={k}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>{d}</span>
              <Kbd>{k}</Kbd>
            </div>
          ))}
        </div>
      </section>

      <section id="usage" className="mt-10 rounded-xl border bg-muted/40 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldAlert className="size-5 text-primary" /> 使用规范
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          本平台仅用于合法的设计创作。禁止使用本平台制作或伪造聊天记录、支付或转账截图、银行卡、票据、证件、凭证等，或冒充他人及其他机构。因此平台不提供此类模板。
        </p>
      </section>
    </div>
  );
}
