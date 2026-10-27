import type { BuiltinTemplate } from "./builtin";
import { Design } from "./collection";

export const FINANCE_SCENES = [
  { id: "transfer", label: "转账汇款" },
  { id: "collection", label: "收款到账" },
  { id: "refund", label: "退款退回" },
  { id: "account", label: "充值提现" },
  { id: "business", label: "经营结算" },
  { id: "bill", label: "账单对账" },
] as const;
type Scene = (typeof FINANCE_SCENES)[number]["id"];
type Channel = {
  id: string;
  label: string;
  short: string;
  group: "wallet" | "bank";
  color: string;
  aliases: string[];
};
export const FINANCE_CHANNELS: Channel[] = [
  {
    id: "wechat",
    label: "微信",
    short: "微信",
    group: "wallet",
    color: "#21845b",
    aliases: ["微信支付", "WeChat", "零钱"],
  },
  {
    id: "alipay",
    label: "支付宝",
    short: "支付宝",
    group: "wallet",
    color: "#2268b2",
    aliases: ["Alipay", "余额"],
  },
  ...(
    [
      ["icbc", "工商银行", "工行", "#9c3842", "ICBC"],
      ["abc", "农业银行", "农行", "#23786a", "ABC"],
      ["boc", "中国银行", "中行", "#984252", "BOC"],
      ["ccb", "建设银行", "建行", "#315a9a", "CCB"],
      ["bocom", "交通银行", "交行", "#395899", "BOCOM"],
      ["cmb", "招商银行", "招行", "#9b394a", "CMB"],
      ["psbc", "邮储银行", "邮储", "#357e58", "PSBC 中国邮政储蓄银行"],
      ["spdb", "浦发银行", "浦发", "#364f88", "SPDB 上海浦东发展银行"],
      ["citic", "中信银行", "中信", "#9e4244", "CITIC"],
      ["ceb", "光大银行", "光大", "#75609b", "CEB 中国光大银行"],
      ["cmbc", "民生银行", "民生", "#397c8c", "CMBC 中国民生银行"],
      ["cib", "兴业银行", "兴业", "#3d6695", "CIB"],
      ["cgb", "广发银行", "广发", "#a3494b", "CGB"],
      ["pab", "平安银行", "平安", "#b26e31", "PAB"],
      ["hxb", "华夏银行", "华夏", "#9a414d", "HXB"],
      ["bob", "北京银行", "北京银行", "#984258", "BOB"],
      ["bosh", "上海银行", "上海银行", "#3a5f93", "Bank of Shanghai"],
      ["jsb", "江苏银行", "江苏银行", "#3f6c9c", "JSBANK"],
      ["nbcb", "宁波银行", "宁波银行", "#b46b36", "NBCB"],
      ["hzb", "杭州银行", "杭州银行", "#34778c", "HZBANK"],
    ] as const
  ).map(([id, label, short, color, aliases]) => ({
    id,
    label,
    short,
    color,
    group: "bank" as const,
    aliases: [short, ...aliases.split(" ")],
  })),
];
type Scenario = {
  id: string;
  title: string;
  scene: Scene;
  status: string;
  purpose: string;
  detail: [string, string];
  layout: number;
};
// Distinct transaction states, parties, business fields and layouts, rather than color-only copies.
const WALLET_SCENARIOS: Scenario[] = [
  {
    id: "transfer_completed",
    title: "个人转账完成",
    scene: "transfer",
    status: "转账已完成（示例）",
    purpose: "亲友往来",
    detail: ["转账备注", "生活费用分摊"],
    layout: 0,
  },
  {
    id: "transfer_waiting",
    title: "转账待收款",
    scene: "transfer",
    status: "等待收款（示例）",
    purpose: "待接收款项",
    detail: ["收款时限", "24 小时内"],
    layout: 1,
  },
  {
    id: "transfer_returned",
    title: "转账已退还",
    scene: "refund",
    status: "已退还（示例）",
    purpose: "主动退还",
    detail: ["退还原因", "收款方退还"],
    layout: 2,
  },
  {
    id: "transfer_expired",
    title: "转账超时退回",
    scene: "refund",
    status: "超时退回（示例）",
    purpose: "未领取退回",
    detail: ["原转账时间", "2026-11-17 20:06"],
    layout: 3,
  },
  {
    id: "merchant_scan",
    title: "商户扫码收款",
    scene: "collection",
    status: "商户收款（示例）",
    purpose: "门店消费",
    detail: ["门店名称", "海神示例商店"],
    layout: 4,
  },
  {
    id: "merchant_received",
    title: "经营收款到账",
    scene: "collection",
    status: "收款已记录（示例）",
    purpose: "经营入账",
    detail: ["经营项目", "文创商品销售"],
    layout: 5,
  },
  {
    id: "merchant_pending",
    title: "经营款待结算",
    scene: "business",
    status: "待结算（示例）",
    purpose: "结算进度",
    detail: ["预计结算日", "2026-11-19"],
    layout: 6,
  },
  {
    id: "customer_refund",
    title: "顾客退款完成",
    scene: "refund",
    status: "退款已记录（示例）",
    purpose: "订单退款",
    detail: ["退款原因", "订单取消"],
    layout: 7,
  },
  {
    id: "partial_refund",
    title: "订单部分退款",
    scene: "refund",
    status: "部分退款（示例）",
    purpose: "分项退回",
    detail: ["原订单金额", "388.00 元"],
    layout: 0,
  },
  {
    id: "balance_income",
    title: "账户余额入账",
    scene: "account",
    status: "余额入账（示例）",
    purpose: "账户收入",
    detail: ["入账来源", "示例账户"],
    layout: 1,
  },
  {
    id: "balance_expense",
    title: "账户余额支出",
    scene: "account",
    status: "余额支出（示例）",
    purpose: "账户支出",
    detail: ["支出用途", "日常采购"],
    layout: 2,
  },
  {
    id: "withdraw_completed",
    title: "银行卡提现完成",
    scene: "account",
    status: "提现已记录（示例）",
    purpose: "余额提现",
    detail: ["到账账户", "示例银行卡 **** 0000"],
    layout: 3,
  },
  {
    id: "withdraw_pending",
    title: "银行卡提现处理中",
    scene: "account",
    status: "提现处理中（示例）",
    purpose: "提现进度",
    detail: ["预计到账", "下一个工作日"],
    layout: 4,
  },
  {
    id: "withdraw_returned",
    title: "银行卡提现退回",
    scene: "account",
    status: "提现退回（示例）",
    purpose: "提现退回记录",
    detail: ["退回原因", "示例账户信息待确认"],
    layout: 5,
  },
  {
    id: "recharge",
    title: "银行卡充值",
    scene: "account",
    status: "充值已记录（示例）",
    purpose: "账户充值",
    detail: ["充值账户", "示例银行卡 **** 0000"],
    layout: 6,
  },
  {
    id: "friend_received",
    title: "亲友收款详情",
    scene: "collection",
    status: "已收款（示例）",
    purpose: "亲友往来",
    detail: ["对方备注", "周末聚餐分摊"],
    layout: 7,
  },
  {
    id: "group_collection",
    title: "群收款进度",
    scene: "collection",
    status: "群收款记录（示例）",
    purpose: "集体活动",
    detail: ["参与人数", "8 人 / 10 人"],
    layout: 0,
  },
  {
    id: "aa_collection",
    title: "AA 账单分摊",
    scene: "collection",
    status: "AA 分摊（示例）",
    purpose: "聚餐费用",
    detail: ["人均金额", "88.00 元"],
    layout: 1,
  },
  {
    id: "salary_income",
    title: "工资收入详情",
    scene: "collection",
    status: "工资收入（示例）",
    purpose: "薪酬入账",
    detail: ["工资月份", "2026 年 11 月"],
    layout: 2,
  },
  {
    id: "expense_income",
    title: "报销到账详情",
    scene: "collection",
    status: "报销入账（示例）",
    purpose: "差旅报销",
    detail: ["报销项目", "交通与住宿"],
    layout: 3,
  },
  {
    id: "service_collection",
    title: "服务费收款",
    scene: "business",
    status: "服务费收款（示例）",
    purpose: "服务项目结算",
    detail: ["服务项目", "品牌视觉设计"],
    layout: 4,
  },
  {
    id: "deposit_collection",
    title: "订金收款详情",
    scene: "business",
    status: "订金收款（示例）",
    purpose: "预约订金",
    detail: ["预约项目", "摄影服务预约"],
    layout: 5,
  },
  {
    id: "final_collection",
    title: "尾款结清详情",
    scene: "business",
    status: "尾款结清（示例）",
    purpose: "项目尾款",
    detail: ["项目名称", "示例设计项目"],
    layout: 6,
  },
  {
    id: "rent_collection",
    title: "租金收款详情",
    scene: "collection",
    status: "租金收款（示例）",
    purpose: "租赁收款",
    detail: ["租赁周期", "2026 年 11 月"],
    layout: 7,
  },
  {
    id: "rent_payment",
    title: "房租支付记录",
    scene: "transfer",
    status: "房租支付（示例）",
    purpose: "租金支出",
    detail: ["租赁房屋", "示例小区 A 栋"],
    layout: 0,
  },
  {
    id: "donation",
    title: "公益捐赠记录",
    scene: "transfer",
    status: "捐赠记录（示例）",
    purpose: "公益活动",
    detail: ["公益项目", "海岸清洁计划"],
    layout: 1,
  },
  {
    id: "member_recharge",
    title: "会员充值记录",
    scene: "business",
    status: "会员充值（示例）",
    purpose: "门店会员账户",
    detail: ["会员方案", "年度创作者会员"],
    layout: 2,
  },
  {
    id: "online_payment",
    title: "线上订单付款",
    scene: "transfer",
    status: "订单付款（示例）",
    purpose: "线上消费",
    detail: ["商品名称", "海神文创礼盒"],
    layout: 3,
  },
  {
    id: "store_payment",
    title: "线下门店付款",
    scene: "transfer",
    status: "门店付款（示例）",
    purpose: "线下消费",
    detail: ["门店名称", "海神示例咖啡"],
    layout: 4,
  },
  {
    id: "automatic_payment",
    title: "自动扣款记录",
    scene: "transfer",
    status: "自动扣款（示例）",
    purpose: "订阅费用",
    detail: ["订阅服务", "示例灵感资料库"],
    layout: 5,
  },
  {
    id: "commission",
    title: "佣金结算详情",
    scene: "business",
    status: "佣金结算（示例）",
    purpose: "服务佣金",
    detail: ["结算周期", "2026-11-01 至 11-15"],
    layout: 6,
  },
  {
    id: "project_settlement",
    title: "项目结算详情",
    scene: "business",
    status: "项目结算（示例）",
    purpose: "项目费用",
    detail: ["合同项目", "示例视觉升级服务"],
    layout: 7,
  },
  {
    id: "refund_progress",
    title: "退款进度查询",
    scene: "refund",
    status: "退款处理中（示例）",
    purpose: "退款状态展示",
    detail: ["退款去向", "示例原支付账户"],
    layout: 0,
  },
  {
    id: "monthly_summary",
    title: "月度收支汇总",
    scene: "bill",
    status: "月度账单（示例）",
    purpose: "月度对账",
    detail: ["统计月份", "2026 年 11 月"],
    layout: 1,
  },
  {
    id: "income_detail",
    title: "收入明细账单",
    scene: "bill",
    status: "收入明细（示例）",
    purpose: "收入分类",
    detail: ["收入类别", "经营与服务收入"],
    layout: 2,
  },
  {
    id: "expense_detail",
    title: "支出明细账单",
    scene: "bill",
    status: "支出明细（示例）",
    purpose: "支出分类",
    detail: ["支出类别", "日常采购支出"],
    layout: 3,
  },
  {
    id: "transfer_note",
    title: "带备注转账详情",
    scene: "transfer",
    status: "转账备注（示例）",
    purpose: "附言转账",
    detail: ["完整附言", "示例项目第二阶段设计费用"],
    layout: 4,
  },
  {
    id: "collection_notice",
    title: "实时收款通知",
    scene: "collection",
    status: "收款通知（示例）",
    purpose: "收款提醒",
    detail: ["通知场景", "海神示例门店收款"],
    layout: 5,
  },
  {
    id: "multi_reconciliation",
    title: "多笔收款对账",
    scene: "bill",
    status: "对账清单（示例）",
    purpose: "批次汇总",
    detail: ["汇总笔数", "12 笔"],
    layout: 6,
  },
  {
    id: "yearly_summary",
    title: "年度收支概览",
    scene: "bill",
    status: "年度账单（示例）",
    purpose: "年度收支",
    detail: ["统计年度", "2026 年"],
    layout: 7,
  },
];
const BANK_SCENARIOS: Scenario[] = [
  {
    id: "personal_transfer",
    title: "个人网银转账",
    scene: "transfer",
    status: "转账记录（示例）",
    purpose: "个人汇款",
    detail: ["付款渠道", "个人网上银行场景"],
    layout: 2,
  },
  {
    id: "received",
    title: "网银收款到账",
    scene: "collection",
    status: "收款记录（示例）",
    purpose: "账户入账",
    detail: ["收入来源", "示例往来款"],
    layout: 3,
  },
  {
    id: "corporate_transfer",
    title: "企业网银付款",
    scene: "business",
    status: "企业付款（示例）",
    purpose: "对公往来",
    detail: ["业务项目", "示例采购结算"],
    layout: 6,
  },
  {
    id: "interbank",
    title: "跨行汇款详情",
    scene: "transfer",
    status: "跨行汇款（示例）",
    purpose: "跨行往来",
    detail: ["收款银行", "其他示例银行"],
    layout: 7,
  },
  {
    id: "payroll",
    title: "企业批量代发",
    scene: "business",
    status: "批次代发（示例）",
    purpose: "工资代发",
    detail: ["批次人数", "12 人"],
    layout: 4,
  },
  {
    id: "statement",
    title: "账户收支对账",
    scene: "bill",
    status: "收支对账（示例）",
    purpose: "网银对账",
    detail: ["对账周期", "2026-11-01 至 11-30"],
    layout: 5,
  },
];
const LAYOUT_NAMES = [
  "手机摘要",
  "金额卡片",
  "横版双栏",
  "交易时间线",
  "账户对照",
  "账单分区",
  "网银表单",
  "横版明细",
];
function build(
  channel: Channel,
  scenario: Scenario,
  index: number,
): BuiltinTemplate {
  const variant = scenario.layout,
    wide = variant === 2 || variant === 7;
  const w = wide ? 1600 : 1080,
    h = wide ? 1180 : variant === 5 ? 1640 : 1720;
  const d = new Design(`bt_pay_${channel.id}_${scenario.id}`, w, h, {
    ink: "#233443",
    accent: channel.color,
    paper: "#f1f4f6",
    soft: "#e3eaf0",
  });
  const title = `${channel.label} · ${scenario.title}`;
  const amount = (128 + (index % 40) * 37.25).toFixed(2);
  const field = (
    name: string,
    value: string,
    type: "text" | "number" | "order" = "text",
  ) => ({ name, value, type });
  const details = [
    field("付款方", "示例付款人"),
    field("收款方", "示例收款人"),
    field("交易时间", "2026-11-18 20:06"),
    field("交易订单号", `DEMO-${String(index + 1).padStart(10, "0")}`, "order"),
    field(scenario.detail[0], scenario.detail[1]),
    field("业务用途", scenario.purpose),
  ];
  if (channel.group === "bank") {
    details.push(
      field("付款账户", "示例账户 **** 0000"),
      field("收款账户", "示例账户 **** 1111"),
      field("机构名称", `${channel.label}（场景示例）`),
    );
  } else {
    details.push(
      field("交易对方昵称", "海神示例用户"),
      field(
        "收支类型",
        scenario.scene === "collection" ? "收入记录" : "示例交易",
      ),
    );
  }
  if (scenario.scene === "bill") {
    details[0] = field("账单所属人", "示例账单用户");
    details[1] = field("账单类型", scenario.purpose);
    details[6] = field("收入合计", "2860.00 元");
    details[7] = field("支出合计", "1580.00 元");
  }
  d.rect("topbar", 0, 0, w, wide ? 130 : 160, channel.color);
  d.text(
    "channel_label",
    `${channel.label}场景设计 / DEMO`,
    52,
    56,
    w - 104,
    58,
    wide ? 32 : 30,
    { fill: "#ffffff", fontWeight: "bold" },
  );
  d.text(
    "scene_title",
    scenario.title,
    60,
    wide ? 178 : 210,
    w - 120,
    90,
    wide ? 54 : 50,
    { fontWeight: "bold" },
  );
  if (wide) {
    d.rect("summary_card", 60, 322, 430, 648, "#ffffff", 24);
    d.text("currency", "示例金额 / CNY", 92, 370, 366, 50, 27, {
      fill: "#687786",
    });
    d.editable(
      "amount",
      field("金额", amount, "number"),
      92,
      460,
      366,
      108,
      78,
      { fill: channel.color, fontWeight: "bold" },
    );
    d.editable(
      "status",
      field("交易状态", scenario.status),
      92,
      606,
      366,
      94,
      29,
      { wrap: true, maxLines: 2 },
    );
    d.text("summary_note", "仅用于界面与排版演示", 92, 830, 366, 70, 25, {
      fill: "#687786",
      wrap: true,
    });
    d.rect("details_card", 526, 322, w - 586, 648, "#ffffff", 24);
    const colWidth = (w - 666) / 2;
    details.forEach((f, i) =>
      d.field(
        `detail_${i}`,
        f,
        566 + (i % 2) * (colWidth + 24),
        352 + Math.floor(i / 2) * 120,
        colWidth - 8,
        i === 3 ? 25 : 28,
      ),
    );
  } else if (variant === 0 || variant === 1) {
    d.rect("summary_card", 48, 330, 984, 310, "#ffffff", 28);
    d.editable(
      "status",
      field("交易状态", scenario.status),
      88,
      360,
      904,
      65,
      36,
      { textAlign: variant === 0 ? "center" : "left" },
    );
    d.editable(
      "amount",
      field("金额", amount, "number"),
      88,
      456,
      904,
      116,
      86,
      {
        fontWeight: "bold",
        textAlign: variant === 0 ? "center" : "left",
        fill: channel.color,
      },
    );
    d.rect("details_card", 48, 686, 984, 806, "#ffffff", 28);
    details.forEach((f, i) =>
      d.field(
        `detail_${i}`,
        f,
        88 + (i % 2) * 460,
        730 + Math.floor(i / 2) * 152,
        420,
        i === 3 ? 27 : 30,
      ),
    );
  } else if (variant === 3) {
    d.rect("summary_card", 48, 330, 984, 252, "#ffffff", 24);
    d.editable(
      "amount",
      field("金额", amount, "number"),
      88,
      368,
      904,
      100,
      82,
      { fontWeight: "bold", fill: channel.color },
    );
    d.editable(
      "status",
      field("交易状态", scenario.status),
      88,
      492,
      904,
      55,
      32,
    );
    details.forEach((f, i) => {
      const y = 640 + i * 98;
      d.ellipse(`node_${i}`, 60, y + 20, 14, 14, channel.color);
      d.text(`label_${i}`, f.name, 106, y, 250, 64, 25, { fill: "#687786" });
      d.editable(`detail_${i}`, f, 374, y, 626, 64, i === 3 ? 28 : 30);
      if (i < details.length - 1)
        d.rect(`line_${i}`, 66, y + 40, 2, 64, "#c7d2dc");
    });
  } else if (variant === 4) {
    d.rect("summary_card", 48, 330, 984, 250, channel.color, 24);
    d.editable(
      "status",
      field("交易状态", scenario.status),
      88,
      360,
      904,
      58,
      32,
      { fill: "#ffffff" },
    );
    d.editable(
      "amount",
      field("金额", amount, "number"),
      88,
      432,
      904,
      112,
      82,
      { fill: "#ffffff", fontWeight: "bold" },
    );
    details.forEach((f, i) => {
      const x = 48 + (i % 2) * 506,
        y = 638 + Math.floor(i / 2) * 176;
      d.rect(`tile_${i}`, x, y, 478, 152, "#ffffff", 18);
      d.field(`detail_${i}`, f, x + 26, y + 20, 426, i === 3 ? 27 : 30);
    });
  } else if (variant === 5) {
    d.text("currency", "示例账单金额 / CNY", 60, 334, 960, 48, 28, {
      fill: "#687786",
    });
    d.editable(
      "amount",
      field("金额", amount, "number"),
      60,
      402,
      960,
      122,
      94,
      { fill: channel.color, fontWeight: "bold" },
    );
    d.editable(
      "status",
      field("交易状态", scenario.status),
      60,
      550,
      960,
      64,
      34,
    );
    details.forEach((f, i) => {
      const y = 672 + Math.floor(i / 2) * 166,
        x = 60 + (i % 2) * 492;
      d.rect(`rule_${i}`, x, y - 16, 452, 3, channel.color);
      d.field(`detail_${i}`, f, x, y, 450, i === 3 ? 27 : 30);
    });
  } else {
    d.rect("summary_card", 48, 330, 984, 248, "#ffffff", 18);
    d.editable(
      "status",
      field("交易状态", scenario.status),
      88,
      360,
      904,
      58,
      34,
    );
    d.editable(
      "amount",
      field("金额", amount, "number"),
      88,
      432,
      904,
      112,
      82,
      { fill: channel.color, fontWeight: "bold" },
    );
    details.forEach((f, i) => {
      const y = 636 + i * 98;
      d.rect(
        `row_${i}`,
        48,
        y,
        984,
        84,
        i % 2 === 0 ? "#ffffff" : "#e6edf2",
        8,
      );
      d.text(`label_${i}`, f.name, 76, y + 10, 260, 64, 25, {
        fill: "#687786",
      });
      d.editable(`detail_${i}`, f, 356, y + 10, 636, 64, i === 3 ? 28 : 30);
    });
  }
  // Visible example labels are ordinary saved artwork, independent of generated parameter values.
  d.text(
    "finance_watermark",
    "示例 · 非真实凭证",
    wide ? 590 : 160,
    wide ? 1010 : h - 174,
    wide ? 850 : 760,
    64,
    wide ? 42 : 38,
    {
      fill: channel.color,
      textAlign: "center",
      fontWeight: "bold",
      locked: true,
      editable: false,
    },
  );
  d.footer("场景设计示例 · 非官方界面 · 不代表真实转账、收款或到账结果");
  const base = d.finish(
    {
      key: scenario.id,
      title,
      subtitle: `${channel.label} · ${scenario.purpose} · ${LAYOUT_NAMES[variant]}`,
      fields: [],
      layout: variant,
      tags: [
        channel.label,
        channel.short,
        ...channel.aliases,
        ...[channel.label, ...channel.aliases].map(
          (alias) =>
            alias +
            {
              transfer: "转账",
              collection: "收款",
              refund: "退款",
              account: "充值提现",
              business: "结算",
              bill: "账单",
            }[scenario.scene],
        ),
        scenario.title,
        scenario.purpose,
        FINANCE_SCENES.find((s) => s.id === scenario.scene)!.label,
        channel.group === "bank" ? "网银 银行转账 银行收款" : "移动支付 钱包",
      ],
    },
    "transfer",
    index,
    true,
  );
  return {
    ...base,
    channel: channel.id,
    financeScene: scenario.scene,
    layoutFamily: LAYOUT_NAMES[variant],
  };
}
export const FINANCIAL_TEMPLATES: BuiltinTemplate[] = FINANCE_CHANNELS.flatMap(
  (channel, channelIndex) =>
    (channel.group === "wallet" ? WALLET_SCENARIOS : BANK_SCENARIOS).map(
      (scenario, i) => build(channel, scenario, channelIndex * 40 + i),
    ),
);
