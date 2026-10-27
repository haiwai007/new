import { TEMPLATE_EXAMPLE_LABEL } from "./labels";
import { describe, it, expect } from "vitest";
import {
  FINANCIAL_TEMPLATES,
  FINANCE_CHANNELS,
  FINANCE_SCENES,
} from "./financial";
import {
  FINANCE_CHANNEL_COUNTS,
  paginationWindow,
  templateMatches,
} from "./catalog";
import { applyParamValues } from "./params";
import { generateItems } from "../batch/rules";
describe("payment scene catalogue", () => {
  it("adds 200 stable named designs covering two wallets, twenty banks and eight layouts", () => {
    expect(FINANCIAL_TEMPLATES).toHaveLength(200);
    expect(FINANCE_CHANNELS.filter((c) => c.group === "wallet")).toHaveLength(
      2,
    );
    expect(FINANCE_CHANNELS.filter((c) => c.group === "bank")).toHaveLength(20);
    expect(FINANCE_CHANNEL_COUNTS).toMatchObject({
      wechat: 40,
      alipay: 40,
      general: 20,
    });
    for (const channel of FINANCE_CHANNELS) {
      const templates = FINANCIAL_TEMPLATES.filter(
        (t) => t.channel === channel.id,
      );
      expect(templates).toHaveLength(channel.group === "wallet" ? 40 : 6);
      expect(new Set(templates.map((t) => t.name)).size).toBe(templates.length);
      expect(
        new Set(templates.map((t) => t.financeScene)).size,
      ).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(FINANCIAL_TEMPLATES.map((t) => t.layoutFamily)).size).toBe(
      8,
    );
    for (const scene of FINANCE_SCENES)
      expect(FINANCIAL_TEMPLATES.some((t) => t.financeScene === scene.id)).toBe(
        true,
      );
  });
  it("supports channel names, bank abbreviations, English aliases and joined search phrases", () => {
    const wechat = FINANCIAL_TEMPLATES.find(
      (t) => t.id === "bt_pay_wechat_merchant_scan",
    )!;
    expect(templateMatches(wechat, "微信收款")).toBe(true);
    expect(templateMatches(wechat, "WeChat 收款")).toBe(true);
    const bank = FINANCIAL_TEMPLATES.find(
      (t) => t.id === "bt_pay_icbc_personal_transfer",
    )!;
    expect(templateMatches(bank, "工行转账")).toBe(true);
    expect(templateMatches(bank, "ICBC 网银")).toBe(true);
    expect(templateMatches(bank, "支付宝")).toBe(false);
  });
  it("keeps visible example artwork when values change and batches randomize", () => {
    for (const t of FINANCIAL_TEMPLATES) {
      expect(t.sample).toBe(true);
      const marks = t.doc.layers.filter(
        (l) => l.id === "finance_watermark" || l.id === "sample_footer",
      );
      expect(marks).toHaveLength(2);
      expect(marks.every(l=>l.type==="text"&&l.text===TEMPLATE_EXAMPLE_LABEL)).toBe(true);
      expect(marks.every((l) => l.visible && l.locked && !l.editable)).toBe(
        true,
      );
      expect(
        t.doc.parameters.some((p) => marks.some((l) => l.id === p.layerId)),
      ).toBe(false);
      const amount = t.doc.parameters.find((p) => p.name === "金额")!;
      const edited = applyParamValues(t.doc, { [amount.id]: "1234.50" });
      for (const item of generateItems(edited, {}, 2, 3))
        expect(
          item.doc.layers.filter((l) => marks.some((mark) => mark.id === l.id)),
        ).toEqual(marks);
    }
  });
  it("keeps pagination short and reachable in a fourteen-page catalogue", () => {
    expect(paginationWindow(1, 14)).toEqual([1, 2, "gap", 14]);
    expect(paginationWindow(7, 14)).toEqual([1, "gap", 6, 7, 8, "gap", 14]);
    expect(paginationWindow(14, 14)).toEqual([1, "gap", 13, 14]);
    expect(paginationWindow(1, 1)).toEqual([1]);
  });
});
