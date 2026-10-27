import { z } from "zod";
export const CMS_MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
export const popupSchema = z
  .object({
    enabled: z.boolean(),
    title: z.string().trim().min(1).max(80),
    message: z.string().max(2000),
    buttonText: z.string().trim().min(1).max(40),
    mode: z.enum(["button", "phrase"]),
    phrase: z.string().max(100),
    frequency: z.enum(["tab", "visit"]),
    revision: z.number().int().nonnegative(),
  })
  .refine(
    (p) => !p.enabled || p.mode !== "phrase" || p.phrase.trim().length > 0,
    { message: "文字确认方式需要填写确认文字", path: ["phrase"] },
  );
export type PopupSettings = z.infer<typeof popupSchema>;
export const DEFAULT_POPUP: PopupSettings = {
  enabled: true,
  title: "欢迎使用海神作图",
  message: "",
  buttonText: "进入作图",
  mode: "phrase",
  phrase: "沐北是sb",
  frequency: "tab",
  revision: 0,
};
export const categoryInput = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,59}$/)
    .refine(
      (id) => !["all", "custom", "mine", "builtin", "shared"].includes(id),
      "该分类标识已保留，请使用其他标识",
    ),
  label: z.string().trim().min(1).max(40),
  position: z.number().int().min(0).max(100000),
  visible: z.boolean(),
  revision: z.number().int().nonnegative(),
});
export type ManagedCategory = z.infer<typeof categoryInput>;
export const templateInput = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().min(1).max(60),
  description: z.string().max(300),
  tags: z.array(z.string().trim().min(1).max(30)).max(20),
  position: z.number().int().min(0).max(100000),
  published: z.boolean(),
  revision: z.number().int().nonnegative(),
});
export type ManagedTemplate = z.infer<typeof templateInput> & {
  id: string;
  width: number;
  height: number;
  parameterCount: number;
  createdAt: number;
  updatedAt: number;
  packageUrl: string;
  thumbnailUrl: string;
};
export type PublicCatalogue = {
  enabled: boolean;
  categories: ManagedCategory[];
  templates: ManagedTemplate[];
  popup: PopupSettings;
  message?: string;
};
export type AdminCatalogue = {
  categories: ManagedCategory[];
  templates: ManagedTemplate[];
  popup: PopupSettings;
};
