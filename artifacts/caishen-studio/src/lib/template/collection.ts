import type { BuiltinTemplate, TemplateCategory } from "./builtin";
import type {
  Layer,
  TemplateDoc,
  TemplateParameter,
  TextLayer,
} from "../../types/template";
import { SCHEMA_VERSION } from "../../types/template";
import { createImageLayer, createShapeLayer, createTextLayer } from "./layers";
import { defaultGroupFor } from "./params";
import { defaultOrderRule } from "../parameters/order";

// Original editable layouts. Public research sources and scope are recorded in docs/TEMPLATE_LIBRARY.zh-CN.md.
const PALETTES = [
  { ink: "#153c36", accent: "#157f65", paper: "#edf5f1", soft: "#d7e9df" },
  { ink: "#172f55", accent: "#315fbb", paper: "#f0f4fb", soft: "#dbe5f6" },
  { ink: "#42234f", accent: "#8554a1", paper: "#f7f1f9", soft: "#eadcf1" },
  { ink: "#4c3520", accent: "#ac6c25", paper: "#faf5e9", soft: "#eedfc4" },
  { ink: "#163943", accent: "#167f91", paper: "#edf7f9", soft: "#d1ebef" },
  { ink: "#4c2530", accent: "#b44f68", paper: "#fbf0f3", soft: "#f2dce3" },
];
type Field = {
  name: string;
  value: string;
  type?: "text" | "date" | "number" | "order" | "multiline";
};
type Profile = {
  key: string;
  title: string;
  subtitle: string;
  fields: Field[];
  tags: string[];
  layout: number;
};
const f = (
  name: string,
  value: string,
  type: Field["type"] = "text",
): Field => ({ name, value, type });
class Design {
  layers: Layer[] = [];
  parameters: TemplateParameter[] = [];
  constructor(
    readonly id: string,
    readonly width: number,
    readonly height: number,
    readonly palette: (typeof PALETTES)[number],
  ) {}
  rect(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    radius = 0,
  ) {
    this.layers.push({
      ...createShapeLayer(
        "rect",
        { x, y, width, height },
        { fill, radius, strokeWidth: 0 },
      ),
      id,
      name: id,
    });
  }
  ellipse(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
  ) {
    this.layers.push({
      ...createShapeLayer(
        "ellipse",
        { x, y, width, height },
        { fill, strokeWidth: 0 },
      ),
      id,
      name: id,
    });
  }
  text(
    id: string,
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    overrides: Partial<TextLayer> = {},
  ) {
    this.layers.push({
      ...createTextLayer(
        { x, y, width, height },
        {
          text: value,
          fontSize: size,
          minFontSize: Math.min(size, 18),
          fill: this.palette.ink,
          autoShrink: true,
          verticalAlign: "middle",
          wrap: false,
          ...overrides,
        },
      ),
      id,
      name: id,
    });
  }
  editable(
    id: string,
    field: Field,
    x: number,
    y: number,
    width: number,
    height = 58,
    size = 36,
    overrides: Partial<TextLayer> = {},
  ) {
    this.text(id, field.value, x, y, width, height, size, overrides);
    const type = field.type ?? "text";
    this.parameters.push({
      id: `p_${id}`,
      name: field.name,
      type,
      layerId: id,
      property: "text",
      defaultValue: field.value,
      required: false,
      editable: true,
      allowEmpty: true,
      rules: type === "number" ? { decimals: 2 } : {},
      ...(type === "order"
        ? { order: { ...defaultOrderRule(), length: 10, prefix: "DEMO-" } }
        : {}),
      group: defaultGroupFor(type),
      description: "",
      placeholder: `填写${field.name}`,
    });
  }
  field(
    id: string,
    field: Field,
    x: number,
    y: number,
    width: number,
    size = 34,
  ) {
    this.text(`${id}_label`, field.name, x, y, width, 34, 23, {
      fill: "#6e7a84",
    });
    this.editable(id, field, x, y + 40, width, 58, size);
  }
  photo(x: number, y: number, width: number, height: number, avatar = false) {
    this.rect(
      "photo_base",
      x,
      y,
      width,
      height,
      this.palette.soft,
      avatar ? width / 2 : 16,
    );
    this.ellipse(
      "photo_head",
      x + width * 0.35,
      y + height * 0.18,
      width * 0.3,
      height * 0.3,
      this.palette.accent,
    );
    this.ellipse(
      "photo_body",
      x + width * 0.2,
      y + height * 0.55,
      width * 0.6,
      height * 0.35,
      this.palette.accent,
    );
    const image = {
      ...createImageLayer({ x, y, width, height }, null, {
        name: "头像",
        radius: avatar ? width / 2 : 16,
        lockAspect: avatar,
        autoFocus: false,
      }),
      id: "photo_image",
    };
    this.layers.push(image);
    this.parameters.push({
      id: "p_photo",
      name: "头像照片",
      type: "image",
      layerId: image.id,
      property: "src",
      defaultValue: null,
      required: false,
      editable: true,
      allowEmpty: true,
      rules: {},
      group: "图片",
      description: "上传后替换示例头像",
      placeholder: "",
      imageRole: "avatar",
      imageDefaults: {
        fit: "cover",
        focusX: 0.5,
        focusY: 0.5,
        cropZoom: 1,
        radius: image.radius,
      },
    });
  }
  footer(sample: string) {
    this.text(
      "sample_header",
      "海神设计 · 示例",
      this.width - 270,
      24,
      230,
      32,
      22,
      {
        textAlign: "right",
        fill: this.palette.accent,
        locked: true,
        editable: false,
      },
    );
    this.text(
      "sample_footer",
      sample,
      44,
      this.height - 82,
      this.width - 88,
      42,
      22,
      { textAlign: "center", fill: "#68747f", locked: true, editable: false },
    );
  }
  finish(
    profile: Profile,
    category: TemplateCategory,
    index: number,
    sample = false,
  ): BuiltinTemplate {
    const name = `${profile.title}${sample ? " · 示例" : ""}`;
    const doc: TemplateDoc = {
      schemaVersion: SCHEMA_VERSION,
      templateId: this.id,
      name,
      canvas: {
        width: this.width,
        height: this.height,
        backgroundColor: this.palette.paper,
        backgroundImage: null,
      },
      layers: this.layers,
      parameters: this.parameters,
      source: null,
    };
    return {
      id: this.id,
      name,
      category,
      popularity: 70 + (index % 17),
      addedAt: "2026-10-27",
      doc,
      tags: profile.tags,
      description: profile.subtitle,
      sample,
    };
  }
}

const transferScenarios = [
  ["personal", "个人转账", "日常往来", "转账已完成"],
  ["business", "企业对公转账", "企业付款", "转账已完成"],
  ["interbank", "跨行转账", "跨行汇款", "转账处理中"],
  ["refund", "退款到账", "订单退款", "退款已入账"],
  ["salary", "工资发放", "工资薪酬", "工资已发放"],
  ["expense", "报销入账", "差旅报销", "报销已入账"],
  ["split", "AA 分摊收款", "聚餐分摊", "分摊已收齐"],
  ["received", "收款通知", "收款提醒", "已收到款项"],
  ["scheduled", "预约转账", "定时付款", "已预约"],
  ["pending", "转账待处理", "付款申请", "等待处理"],
  ["cancelled", "转账撤回", "撤回记录", "已撤回"],
  ["international", "国际汇款", "跨境款项", "汇款已提交"],
  ["settlement", "商户结算", "经营结算", "结算已完成"],
  ["balance", "余额入账", "余额变动", "余额已更新"],
  ["commission", "佣金结算", "服务佣金", "佣金已结算"],
  ["service", "服务费收款", "服务结算", "服务费已收取"],
  ["deposit", "订金收款", "预订订金", "订金已收取"],
  ["final", "尾款收款", "合同尾款", "尾款已结清"],
  ["donation", "公益捐赠记录", "公益活动", "捐赠已记录"],
  ["membership", "会员充值", "会员账户", "充值已入账"],
] as const;
function transfer(profile: Profile, index: number) {
  const screen = profile.layout % 2 === 0,
    w = 1080,
    h = screen ? 1680 : 1440;
  const d = new Design(
    `bt_transfer_${profile.key}`,
    w,
    h,
    PALETTES[index % PALETTES.length],
  );
  const p = d.palette;
  if (screen) {
    d.rect("navigation", 0, 0, w, 160, p.ink);
    d.text("brand", "海神演示钱包", 64, 56, 700, 64, 36, {
      fill: "#ffffff",
      fontWeight: "bold",
    });
    d.rect("summary", 48, 200, 984, 460, "#ffffff", 28);
    d.ellipse("status_circle", 466, 244, 148, 148, p.soft);
    d.text("status_mark", "✓", 466, 244, 148, 148, 78, {
      fill: p.accent,
      textAlign: "center",
    });
    d.editable("status", profile.fields[0], 100, 410, 880, 68, 40, {
      textAlign: "center",
    });
    d.text("currency", "CNY · 人民币", 100, 500, 880, 42, 26, {
      textAlign: "center",
      fill: "#6e7a84",
    });
    d.editable("amount", profile.fields[1], 100, 552, 880, 90, 76, {
      textAlign: "center",
      fontWeight: "bold",
    });
    d.rect("details", 48, 704, 984, 770, "#ffffff", 28);
    profile.fields.slice(2).forEach((field, i) => {
      const y = 744 + i * 126;
      d.text(`label_${i}`, field.name, 88, y, 260, 70, 28, { fill: "#6e7a84" });
      d.editable(`detail_${i}`, field, 350, y, 640, 70, i === 3 ? 28 : 34, {
        textAlign: "right",
      });
      if (i < 4) d.rect(`divider_${i}`, 88, y + 96, 904, 1, "#e7eced");
    });
  } else {
    d.rect("accent", 0, 0, w, 24, p.accent);
    d.text("eyebrow", "HAISHEN / DEMO TRANSACTION", 72, 100, 936, 48, 26, {
      fill: p.accent,
      letterSpacing: 3,
    });
    d.text("title", profile.title, 72, 178, 936, 120, 66, {
      fontWeight: "bold",
    });
    d.rect("amount_band", 72, 348, 936, 260, p.ink, 24);
    d.editable("status", profile.fields[0], 112, 376, 856, 54, 28, {
      fill: "#ffffff",
    });
    d.editable("amount", profile.fields[1], 112, 456, 856, 110, 82, {
      fill: "#ffffff",
      fontWeight: "bold",
    });
    profile.fields
      .slice(2)
      .forEach((field, i) =>
        d.field(
          `detail_${i}`,
          field,
          72 + (i % 2) * 480,
          688 + Math.floor(i / 2) * 180,
          430,
          i === 3 ? 27 : 32,
        ),
      );
  }
  d.footer("示例交易记录 · 非真实到账凭证");
  return d.finish(profile, "transfer", index, true);
}

const flightScenarios = [
  ["domestic", "国内航班登机牌", "北京首都 PEK", "上海虹桥 SHA"],
  ["international", "国际航班登机牌", "上海浦东 PVG", "东京成田 NRT"],
  ["return", "往返机票行程", "杭州萧山 HGH", "成都天府 TFU"],
  ["connection", "联程航班行程", "广州白云 CAN", "新加坡 SIN"],
  ["business", "商务出行机票", "深圳宝安 SZX", "北京大兴 PKX"],
  ["family", "家庭出游机票", "武汉天河 WUH", "三亚凤凰 SYX"],
  ["student", "学生出行机票", "南京禄口 NKG", "西安咸阳 XIY"],
  ["honeymoon", "蜜月旅行机票", "上海浦东 PVG", "马累 MLE"],
  ["night", "夜间航班登机牌", "重庆江北 CKG", "曼谷 BKK"],
  ["morning", "清晨航班登机牌", "厦门高崎 XMN", "杭州萧山 HGH"],
  ["pickup", "机场接送行程卡", "北京首都 PEK", "城市中心"],
  ["change", "航班改签通知", "成都天府 TFU", "广州白云 CAN"],
  ["delay", "航班延误通知", "上海虹桥 SHA", "深圳宝安 SZX"],
  ["vacation", "海岛度假机票", "香港 HKG", "普吉 HKT"],
  ["study", "留学出行行程", "北京首都 PEK", "伦敦 LHR"],
  ["weekend", "周末短途机票", "上海虹桥 SHA", "青岛胶东 TAO"],
  ["group", "团队出行行程", "长沙黄花 CSX", "昆明长水 KMG"],
  ["premium", "商务舱登机牌", "上海浦东 PVG", "巴黎 CDG"],
  ["travelcard", "旅行纪念登机牌", "海神 DEMO", "梦想之城 XXX"],
  ["overview", "航班订单概览", "天津滨海 TSN", "大连周水子 DLC"],
] as const;
function flight(profile: Profile, index: number) {
  const wide = profile.layout % 2 === 0,
    w = wide ? 1600 : 1080,
    h = wide ? 1000 : 1560;
  const d = new Design(
      `bt_flight_${profile.key}`,
      w,
      h,
      PALETTES[(index + 1) % PALETTES.length],
    ),
    p = d.palette;
  d.rect("header", 0, 0, w, wide ? 180 : 230, p.ink);
  d.text(
    "airline",
    "海神示例航空 / DEMO AIR",
    64,
    70,
    w - 128,
    70,
    wide ? 38 : 34,
    { fill: "#ffffff", fontWeight: "bold" },
  );
  d.text(
    "title",
    profile.title,
    64,
    wide ? 230 : 292,
    w - 128,
    100,
    wide ? 60 : 56,
    { fontWeight: "bold" },
  );
  const routeY = wide ? 360 : 440,
    boxW = (w - 220) / 2;
  d.field("departure", profile.fields[0], 64, routeY, boxW, wide ? 42 : 34);
  d.field(
    "arrival",
    profile.fields[1],
    w / 2 + 62,
    routeY,
    boxW,
    wide ? 42 : 34,
  );
  d.text("route_arrow", "→", w / 2 - 42, routeY + 30, 84, 80, 60, {
    textAlign: "center",
    fill: p.accent,
  });
  d.rect("route_line", 64, routeY + 150, w - 128, 3, p.accent);
  const columns = wide ? 4 : 2,
    fieldW = (w - 128) / columns;
  profile.fields
    .slice(2)
    .forEach((field, i) =>
      d.field(
        `flight_${i}`,
        field,
        64 + (i % columns) * fieldW,
        routeY + 206 + Math.floor(i / columns) * (wide ? 130 : 190),
        fieldW - 24,
        i === 5 ? 27 : 34,
      ),
    );
  d.rect("stub", 64, h - 198, w - 128, 60, p.soft, 12);
  d.text(
    "stub_text",
    "SAMPLE / NOT VALID FOR TRAVEL",
    84,
    h - 194,
    w - 168,
    52,
    26,
    {
      fill: p.accent,
      letterSpacing: 2,
      textAlign: "center",
      locked: true,
      editable: false,
    },
  );
  d.footer("示例行程 · 不含可用登机码 · 不可用于乘机");
  return d.finish(profile, "flight", index, true);
}

const badgeScenarios = [
  ["employee", "企业工作证", "海神设计工作室", "产品设计师"],
  ["student", "校园学生证", "海神示例学院", "视觉设计专业"],
  ["visitor", "访客通行卡", "海神创意园区", "访客"],
  ["conference", "会议参会证", "海神设计大会", "参会嘉宾"],
  ["staff", "活动工作人员证", "海神艺术节", "现场执行"],
  ["volunteer", "志愿者证", "海神公益计划", "志愿者"],
  ["club", "社团会员证", "海神摄影社", "社团会员"],
  ["library", "图书借阅卡", "海神阅读空间", "读者"],
  ["gym", "健身会员卡", "海神运动空间", "年度会员"],
  ["exhibitor", "展商工作证", "海神创意展", "展商代表"],
  ["media", "媒体采访证", "海神示例展会", "采访人员"],
  ["speaker", "讲师嘉宾证", "海神开放课堂", "特邀讲师"],
  ["camp", "营地学员证", "海神自然营地", "营员"],
  ["intern", "实习工作证", "海神创新实验室", "实习生"],
  ["team", "团队成员卡", "海神产品团队", "团队成员"],
  ["mentor", "导师身份卡", "海神成长计划", "项目导师"],
  ["pet", "宠物资料卡", "海神宠物俱乐部", "家庭成员"],
  ["community", "社区志愿卡", "海神邻里中心", "社区志愿者"],
  ["artist", "艺术家参展证", "海神独立艺术展", "参展艺术家"],
  ["vip", "贵宾邀请卡", "海神品牌沙龙", "特邀贵宾"],
] as const;
function badge(profile: Profile, index: number) {
  const wide = profile.layout % 3 === 1,
    w = wide ? 1440 : 1000,
    h = wide ? 900 : 1440;
  const d = new Design(
      `bt_badge_${profile.key}`,
      w,
      h,
      PALETTES[(index + 2) % PALETTES.length],
    ),
    p = d.palette;
  d.rect("card", 40, 64, w - 80, h - 164, "#ffffff", 32);
  d.rect("header", 40, 64, w - 80, wide ? 160 : 250, p.ink, 32);
  d.text("title", profile.title, 80, 104, w - 160, 70, 44, {
    fill: "#ffffff",
    fontWeight: "bold",
  });
  d.editable(
    "organization",
    profile.fields[0],
    80,
    wide ? 248 : 220,
    w - 160,
    60,
    30,
    { fill: wide ? p.ink : "#ffffff" },
  );
  const px = wide ? 88 : 340,
    py = wide ? 310 : 370,
    pw = wide ? 270 : 320;
  d.photo(px, py, pw, wide ? 340 : 320, !wide);
  const x = wide ? 430 : 112,
    y = wide ? 310 : 750,
    width = wide ? 880 : 776;
  d.editable("person", profile.fields[1], x, y, width, 100, wide ? 66 : 72, {
    fontWeight: "bold",
    textAlign: wide ? "left" : "center",
  });
  d.editable("role", profile.fields[2], x, y + 116, width, 64, 36, {
    fill: p.accent,
    textAlign: wide ? "left" : "center",
  });
  d.field("number", profile.fields[3], x, y + 218, width, 32);
  d.field("validity", profile.fields[4], x, y + 358, width, 28);
  d.footer("设计样卡 · 非官方身份证件或有效通行凭证");
  return d.finish(profile, "credential", index, true);
}

// Every scenario has its own fields and content; layout families share editable construction primitives.
const sheetScenarios: Record<
  "receipt" | "ticket" | "business" | "education" | "life",
  [string, string, string, Field[]][]
> = {
  receipt: [
    [
      "retail",
      "零售购物小票",
      "门店消费明细",
      [
        f("商户名称", "海神生活商店"),
        f("商品明细", "手作笔记本 × 2"),
        f("实付金额", "58.00", "number"),
        f("支付方式", "示例支付"),
        f("消费时间", "2026-11-18 14:30"),
        f("订单号", "DEMO-0000000001", "order"),
      ],
    ],
    [
      "cafe",
      "咖啡消费小票",
      "饮品订单记录",
      [
        f("门店名称", "海神咖啡"),
        f("饮品明细", "燕麦拿铁 × 1"),
        f("实付金额", "28.00", "number"),
        f("取餐号", "A018"),
        f("下单时间", "2026-11-18 09:15"),
        f("订单号", "DEMO-0000000002", "order"),
      ],
    ],
    [
      "restaurant",
      "餐饮消费清单",
      "餐桌点单与费用",
      [
        f("餐厅名称", "海神小馆"),
        f("消费明细", "双人套餐 × 1"),
        f("实付金额", "168.00", "number"),
        f("桌号", "06 桌"),
        f("用餐人数", "2 人"),
        f("订单号", "DEMO-0000000003", "order"),
      ],
    ],
    [
      "hotel",
      "酒店费用清单",
      "住宿费用分项",
      [
        f("酒店名称", "海神山居"),
        f("房型", "园景双床房"),
        f("合计金额", "680.00", "number"),
        f("入住日期", "2026-11-18", "date"),
        f("离店日期", "2026-11-20", "date"),
        f("订单号", "DEMO-0000000004", "order"),
      ],
    ],
    [
      "taxi",
      "出行费用记录",
      "用车与里程",
      [
        f("服务名称", "海神示例出行"),
        f("行程", "创意园区 → 城市车站"),
        f("费用金额", "36.00", "number"),
        f("行程距离", "12.5 km"),
        f("乘车时间", "2026-11-18 08:20"),
        f("订单号", "DEMO-0000000005", "order"),
      ],
    ],
    [
      "delivery",
      "外卖订单清单",
      "商品与配送信息",
      [
        f("店铺名称", "海神轻食"),
        f("商品明细", "能量沙拉 × 1"),
        f("实付金额", "32.00", "number"),
        f("配送方式", "配送到店"),
        f("下单时间", "2026-11-18 12:00"),
        f("订单号", "DEMO-0000000006", "order"),
      ],
    ],
    [
      "parking",
      "停车费用记录",
      "停车时长与费用",
      [
        f("停车场", "海神广场停车场"),
        f("停车时长", "2 小时 30 分"),
        f("实付金额", "15.00", "number"),
        f("车位编号", "B2-018"),
        f("离场时间", "2026-11-18 17:30"),
        f("订单号", "DEMO-0000000007", "order"),
      ],
    ],
    [
      "repair",
      "维修服务清单",
      "项目与工时费用",
      [
        f("服务门店", "海神维修工坊"),
        f("服务项目", "屏幕检测与清洁"),
        f("合计金额", "80.00", "number"),
        f("受理人", "示例服务员"),
        f("服务日期", "2026-11-18", "date"),
        f("订单号", "DEMO-0000000008", "order"),
      ],
    ],
    [
      "subscription",
      "订阅费用清单",
      "周期性费用",
      [
        f("服务名称", "海神灵感库"),
        f("订阅方案", "年度创作者方案"),
        f("费用金额", "199.00", "number"),
        f("生效日期", "2026-11-18", "date"),
        f("到期日期", "2027-11-17", "date"),
        f("订单号", "DEMO-0000000009", "order"),
      ],
    ],
    [
      "rental",
      "设备租赁清单",
      "设备、时长与押金",
      [
        f("租赁门店", "海神器材库"),
        f("设备名称", "摄影灯套装"),
        f("租金金额", "120.00", "number"),
        f("租赁周期", "3 天"),
        f("归还日期", "2026-11-21", "date"),
        f("订单号", "DEMO-0000000010", "order"),
      ],
    ],
    [
      "wholesale",
      "批发采购清单",
      "采购与交付",
      [
        f("供应商", "海神文创工坊"),
        f("采购内容", "定制帆布袋 × 100"),
        f("合计金额", "2500.00", "number"),
        f("交付方式", "到店自提"),
        f("交付日期", "2026-11-28", "date"),
        f("订单号", "DEMO-0000000011", "order"),
      ],
    ],
    [
      "refund",
      "退款明细清单",
      "退款原因与金额",
      [
        f("店铺名称", "海神生活商店"),
        f("退款原因", "商品取消"),
        f("退款金额", "58.00", "number"),
        f("处理状态", "示例退款记录"),
        f("处理日期", "2026-11-18", "date"),
        f("订单号", "DEMO-0000000012", "order"),
      ],
    ],
  ],
  ticket: [
    [
      "concert",
      "音乐现场门票",
      "独立音乐之夜",
      [
        f("活动名称", "海风现场 LIVE"),
        f("举办地点", "城市音乐空间"),
        f("活动时间", "2026-12-06 19:30"),
        f("观众姓名", "示例观众"),
        f("座位区域", "A 区 06 排 08 座"),
        f("票号", "DEMO-0000000101", "order"),
      ],
    ],
    [
      "exhibition",
      "艺术展览门票",
      "展览预约卡",
      [
        f("展览名称", "海的形状"),
        f("展览地点", "城市当代艺术馆"),
        f("预约时间", "2026-12-06 14:00"),
        f("观众姓名", "示例观众"),
        f("票种", "单人参观"),
        f("票号", "DEMO-0000000102", "order"),
      ],
    ],
    [
      "cinema",
      "电影放映票",
      "社区电影之夜",
      [
        f("影片名称", "海神短片合集"),
        f("影厅", "城市影像空间 2 厅"),
        f("放映时间", "2026-12-06 20:00"),
        f("观众姓名", "示例观众"),
        f("座位", "05 排 06 座"),
        f("票号", "DEMO-0000000103", "order"),
      ],
    ],
    [
      "theatre",
      "剧场演出票",
      "舞台与座位信息",
      [
        f("剧目名称", "海边来信"),
        f("剧场名称", "城市小剧场"),
        f("演出时间", "2026-12-06 19:00"),
        f("观众姓名", "示例观众"),
        f("座位", "一楼 08 排 12 座"),
        f("票号", "DEMO-0000000104", "order"),
      ],
    ],
    [
      "workshop",
      "手作体验票",
      "手作预约确认",
      [
        f("课程名称", "海玻璃手作体验"),
        f("体验地点", "海神手作工坊"),
        f("体验时间", "2026-12-06 10:00"),
        f("参与人", "示例学员"),
        f("参与人数", "1 人"),
        f("预约号", "DEMO-0000000105", "order"),
      ],
    ],
    [
      "sports",
      "运动赛事门票",
      "赛事观赛信息",
      [
        f("赛事名称", "城市篮球友谊赛"),
        f("比赛地点", "城市体育中心"),
        f("比赛时间", "2026-12-06 15:00"),
        f("观众姓名", "示例观众"),
        f("看台区域", "东看台 B 区"),
        f("票号", "DEMO-0000000106", "order"),
      ],
    ],
    [
      "park",
      "主题园区门票",
      "园区游玩预约",
      [
        f("园区名称", "海神探索乐园"),
        f("园区地址", "海滨大道 18 号"),
        f("入园日期", "2026-12-06", "date"),
        f("游客姓名", "示例游客"),
        f("票种", "日间单人票"),
        f("票号", "DEMO-0000000107", "order"),
      ],
    ],
    [
      "camp",
      "营地体验门票",
      "自然体验活动",
      [
        f("活动名称", "海岸星空露营"),
        f("营地名称", "海神自然营地"),
        f("集合时间", "2026-12-06 16:00"),
        f("参与人", "示例营员"),
        f("营位", "C 区 08 号"),
        f("预约号", "DEMO-0000000108", "order"),
      ],
    ],
    [
      "talk",
      "讲座入场票",
      "分享会预约",
      [
        f("讲座名称", "城市与海的对话"),
        f("举办地点", "海神开放书房"),
        f("开始时间", "2026-12-06 14:30"),
        f("听众姓名", "示例听众"),
        f("席位", "开放席位"),
        f("票号", "DEMO-0000000109", "order"),
      ],
    ],
    [
      "market",
      "市集入场票",
      "周末生活市集",
      [
        f("市集名称", "海风周末市集"),
        f("举办地点", "海神创意园"),
        f("开放时间", "2026-12-06 10:00"),
        f("游客姓名", "示例游客"),
        f("票种", "单日入场"),
        f("票号", "DEMO-0000000110", "order"),
      ],
    ],
    [
      "festival",
      "音乐节通票",
      "多日音乐活动",
      [
        f("活动名称", "海岸音乐节"),
        f("举办地点", "城市海滩公园"),
        f("活动日期", "2026-12-06", "date"),
        f("观众姓名", "示例观众"),
        f("票种", "双日通票"),
        f("票号", "DEMO-0000000111", "order"),
      ],
    ],
    [
      "museum",
      "博物馆预约票",
      "文化场馆参观",
      [
        f("场馆名称", "海神海洋博物馆"),
        f("展厅", "常设展厅"),
        f("预约时间", "2026-12-06 09:30"),
        f("参观人", "示例观众"),
        f("参观人数", "2 人"),
        f("预约号", "DEMO-0000000112", "order"),
      ],
    ],
  ],
  business: [
    [
      "contact",
      "个人商务名片",
      "联系方式展示",
      [
        f("姓名", "林海"),
        f("职位", "品牌设计师"),
        f("公司", "海神设计工作室"),
        f("联系电话", "000-0000-0000"),
        f("电子邮箱", "hello@example.com"),
        f("地址", "海神创意园 A 栋"),
      ],
    ],
    [
      "studio",
      "设计工作室介绍",
      "团队与业务",
      [
        f("工作室", "海神设计"),
        f("服务方向", "品牌 / 视觉 / 产品"),
        f("核心理念", "让好想法被看见"),
        f("服务城市", "线上协作"),
        f("联系邮箱", "studio@example.com"),
        f("预约说明", "工作日 10:00—18:00"),
      ],
    ],
    [
      "quote",
      "项目报价单",
      "服务项目与金额",
      [
        f("项目名称", "品牌视觉升级"),
        f("服务内容", "标志与基础应用设计"),
        f("报价金额", "8800.00", "number"),
        f("交付周期", "20 个工作日"),
        f("有效日期", "2026-12-31", "date"),
        f("报价编号", "DEMO-0000000201", "order"),
      ],
    ],
    [
      "meeting",
      "商务会议邀请",
      "会议安排",
      [
        f("会议主题", "年度品牌共创会"),
        f("举办方", "海神设计工作室"),
        f("会议时间", "2026-12-06 14:00"),
        f("会议地点", "城市共创空间"),
        f("联系人", "示例联系人"),
        f("报名邮箱", "meeting@example.com"),
      ],
    ],
    [
      "proposal",
      "项目提案封面",
      "方案与版本",
      [
        f("提案名称", "海岸品牌焕新方案"),
        f("客户名称", "海神示例品牌"),
        f("方案版本", "V1.0"),
        f("提交团队", "海神设计工作室"),
        f("提交日期", "2026-11-18", "date"),
        f("项目编号", "DEMO-0000000202", "order"),
      ],
    ],
    [
      "delivery",
      "项目交付清单",
      "交付文件与验收",
      [
        f("项目名称", "品牌设计交付"),
        f("交付内容", "标志源文件 / 应用规范"),
        f("交付版本", "正式版 V1.0"),
        f("交付方式", "文件包"),
        f("交付日期", "2026-11-18", "date"),
        f("项目编号", "DEMO-0000000203", "order"),
      ],
    ],
    [
      "recruit",
      "招聘信息卡",
      "岗位与申请",
      [
        f("招聘岗位", "视觉设计师"),
        f("所属团队", "海神设计工作室"),
        f("工作方式", "远程 / 混合办公"),
        f("经验要求", "1—3 年相关经验"),
        f("投递邮箱", "jobs@example.com"),
        f("申请截止", "2026-12-31", "date"),
      ],
    ],
    [
      "hours",
      "门店营业信息",
      "营业与联系",
      [
        f("门店名称", "海神生活空间"),
        f("营业时间", "周一至周日 10:00—21:00"),
        f("门店地址", "海神创意园 1 层"),
        f("咨询电话", "000-0000-0000"),
        f("主营业务", "咖啡 / 书籍 / 文创"),
        f("服务说明", "欢迎预约活动"),
      ],
    ],
    [
      "launch",
      "品牌发布邀请",
      "新品与发布活动",
      [
        f("发布主题", "向海而生"),
        f("品牌名称", "海神示例品牌"),
        f("活动时间", "2026-12-06 19:00"),
        f("举办地点", "城市展览空间"),
        f("预约邮箱", "launch@example.com"),
        f("活动说明", "预约参加品牌发布"),
      ],
    ],
    [
      "coupon",
      "门店优惠券",
      "优惠权益展示",
      [
        f("优惠标题", "新客礼遇"),
        f("门店名称", "海神生活商店"),
        f("优惠内容", "满 100 减 20"),
        f("适用范围", "指定文创商品"),
        f("有效日期", "2026-12-31", "date"),
        f("券编号", "DEMO-0000000204", "order"),
      ],
    ],
    [
      "member",
      "会员权益卡",
      "会员服务说明",
      [
        f("会员名称", "海神创作者会员"),
        f("权益内容", "课程 / 活动 / 灵感资料"),
        f("会员等级", "年度会员"),
        f("服务周期", "12 个月"),
        f("咨询邮箱", "member@example.com"),
        f("会员编号", "DEMO-0000000205", "order"),
      ],
    ],
    [
      "thankyou",
      "客户感谢卡",
      "售后与品牌问候",
      [
        f("感谢标题", "感谢你的选择"),
        f("品牌名称", "海神手作工坊"),
        f("问候语", "愿每件小物陪伴你的日常"),
        f("服务说明", "如需帮助请联系工作室"),
        f("联系邮箱", "care@example.com"),
        f("署名", "海神团队"),
      ],
    ],
  ],
  education: [
    [
      "completion",
      "课程结业证书",
      "学习与结业纪念",
      [
        f("学员姓名", "示例学员"),
        f("课程名称", "视觉设计入门课程"),
        f("课程时长", "24 学时"),
        f("授课机构", "海神开放课堂"),
        f("颁发日期", "2026-11-18", "date"),
        f("证书编号", "DEMO-0000000301", "order"),
      ],
    ],
    [
      "honor",
      "学习荣誉证书",
      "学习表现纪念",
      [
        f("获奖人", "示例学员"),
        f("荣誉名称", "学习之星"),
        f("获奖说明", "积极探索，持续进步"),
        f("颁发单位", "海神成长计划"),
        f("颁发日期", "2026-11-18", "date"),
        f("证书编号", "DEMO-0000000302", "order"),
      ],
    ],
    [
      "participation",
      "活动参与证书",
      "活动参与纪念",
      [
        f("参与人", "示例学员"),
        f("活动名称", "海岸创意工作坊"),
        f("参与时长", "6 小时"),
        f("举办方", "海神创意社区"),
        f("颁发日期", "2026-11-18", "date"),
        f("证书编号", "DEMO-0000000303", "order"),
      ],
    ],
    [
      "volunteer",
      "志愿服务纪念证",
      "服务与感谢",
      [
        f("志愿者姓名", "示例志愿者"),
        f("服务项目", "海岸清洁行动"),
        f("服务时长", "8 小时"),
        f("组织名称", "海神公益计划"),
        f("服务日期", "2026-11-18", "date"),
        f("证书编号", "DEMO-0000000304", "order"),
      ],
    ],
    [
      "schedule",
      "每周课程安排",
      "课程与时间",
      [
        f("课程主题", "一周创作计划"),
        f("周一课程", "构图与观察 19:00"),
        f("周三课程", "色彩与表达 19:00"),
        f("周五课程", "作品分享 19:00"),
        f("上课地点", "海神线上课堂"),
        f("任课教师", "示例老师"),
      ],
    ],
    [
      "reading",
      "阅读打卡卡片",
      "阅读记录",
      [
        f("阅读书目", "海边的故事"),
        f("阅读者", "示例读者"),
        f("阅读进度", "第 1—3 章"),
        f("阅读时长", "30 分钟"),
        f("阅读日期", "2026-11-18", "date"),
        f("阅读感想", "记录今天的新发现"),
      ],
    ],
    [
      "workshop",
      "课程招募海报",
      "课程介绍",
      [
        f("课程名称", "零基础手机摄影"),
        f("课程时间", "周六 14:00—16:00"),
        f("课程地点", "海神生活空间"),
        f("授课老师", "示例老师"),
        f("适合人群", "摄影爱好者"),
        f("报名邮箱", "learn@example.com"),
      ],
    ],
    [
      "plan",
      "学习目标计划",
      "目标拆解",
      [
        f("学习主题", "30 天设计练习"),
        f("本周目标", "完成 3 张主题海报"),
        f("每日投入", "45 分钟"),
        f("练习重点", "构图 / 字体 / 配色"),
        f("开始日期", "2026-11-18", "date"),
        f("计划人", "示例学员"),
      ],
    ],
    [
      "feedback",
      "课堂反馈卡",
      "学习反馈",
      [
        f("课程名称", "创意思维训练"),
        f("学员姓名", "示例学员"),
        f("今日收获", "掌握三个发散思考方法"),
        f("练习建议", "每周完成一次主题练习"),
        f("授课教师", "示例老师"),
        f("反馈日期", "2026-11-18", "date"),
      ],
    ],
    [
      "competition",
      "创意比赛奖状",
      "比赛参与与荣誉",
      [
        f("获奖人", "示例作者"),
        f("比赛名称", "海岸创意设计赛"),
        f("奖项名称", "优秀创意奖"),
        f("主办单位", "海神创意社区"),
        f("颁发日期", "2026-11-18", "date"),
        f("奖状编号", "DEMO-0000000305", "order"),
      ],
    ],
    [
      "admission",
      "课程报名确认",
      "报名与开课信息",
      [
        f("报名人", "示例学员"),
        f("课程名称", "插画创作基础"),
        f("开课时间", "2026-12-06 10:00"),
        f("上课地点", "海神开放课堂"),
        f("课程老师", "示例老师"),
        f("报名编号", "DEMO-0000000306", "order"),
      ],
    ],
    [
      "milestone",
      "学习里程碑卡",
      "阶段成果",
      [
        f("学习者", "示例学员"),
        f("达成目标", "完成 100 天阅读"),
        f("阶段成果", "阅读 12 本书"),
        f("鼓励寄语", "每一步都算数"),
        f("达成日期", "2026-11-18", "date"),
        f("记录人", "海神阅读计划"),
      ],
    ],
  ],
  life: [
    [
      "hotel",
      "酒店预订卡",
      "住宿与入住安排",
      [
        f("酒店名称", "海神山居"),
        f("住客姓名", "示例旅客"),
        f("入住日期", "2026-12-06", "date"),
        f("退房日期", "2026-12-08", "date"),
        f("预订房型", "园景大床房"),
        f("预订编号", "DEMO-0000000401", "order"),
      ],
    ],
    [
      "restaurant",
      "餐厅预约卡",
      "餐位与人数",
      [
        f("餐厅名称", "海神小馆"),
        f("预约人", "示例客人"),
        f("预约时间", "2026-12-06 18:30"),
        f("用餐人数", "4 人"),
        f("餐位安排", "靠窗卡座"),
        f("预约编号", "DEMO-0000000402", "order"),
      ],
    ],
    [
      "beauty",
      "护理服务预约",
      "服务与到店时间",
      [
        f("门店名称", "海神护理空间"),
        f("预约人", "示例客人"),
        f("服务项目", "基础皮肤护理"),
        f("预约时间", "2026-12-06 15:00"),
        f("服务时长", "60 分钟"),
        f("预约编号", "DEMO-0000000403", "order"),
      ],
    ],
    [
      "fitness",
      "运动课程预约",
      "课程与教练",
      [
        f("课程名称", "轻松瑜伽"),
        f("预约人", "示例学员"),
        f("上课时间", "2026-12-06 09:00"),
        f("上课地点", "海神运动空间"),
        f("授课教练", "示例教练"),
        f("预约编号", "DEMO-0000000404", "order"),
      ],
    ],
    [
      "pet",
      "宠物护理预约",
      "宠物与服务",
      [
        f("门店名称", "海神宠物护理"),
        f("宠物名字", "小海"),
        f("服务项目", "洗护与基础整理"),
        f("预约时间", "2026-12-06 11:00"),
        f("联系人", "示例主人"),
        f("预约编号", "DEMO-0000000405", "order"),
      ],
    ],
    [
      "moving",
      "搬家服务安排",
      "地址与时间",
      [
        f("服务名称", "海神搬运服务"),
        f("预约人", "示例客户"),
        f("搬出地址", "创意园 A 栋"),
        f("搬入地址", "城市社区 B 栋"),
        f("服务时间", "2026-12-06 08:00"),
        f("服务编号", "DEMO-0000000406", "order"),
      ],
    ],
    [
      "cleaning",
      "保洁服务预约",
      "项目与时长",
      [
        f("服务名称", "海神生活服务"),
        f("预约人", "示例客户"),
        f("服务项目", "日常清洁"),
        f("服务时间", "2026-12-06 10:00"),
        f("服务时长", "3 小时"),
        f("服务编号", "DEMO-0000000407", "order"),
      ],
    ],
    [
      "photography",
      "摄影服务预约",
      "拍摄安排",
      [
        f("工作室", "海神影像"),
        f("预约人", "示例客户"),
        f("拍摄主题", "日常人像"),
        f("拍摄时间", "2026-12-06 14:00"),
        f("拍摄地点", "海岸公园"),
        f("预约编号", "DEMO-0000000408", "order"),
      ],
    ],
    [
      "delivery",
      "快递寄件记录",
      "寄送信息",
      [
        f("寄件人", "示例寄件人"),
        f("收件人", "示例收件人"),
        f("物品名称", "文创礼盒"),
        f("寄件日期", "2026-12-06", "date"),
        f("服务方式", "示例寄件"),
        f("寄件编号", "DEMO-0000000409", "order"),
      ],
    ],
    [
      "rental",
      "民宿入住指引",
      "入住与联系",
      [
        f("民宿名称", "海神小屋"),
        f("入住人", "示例住客"),
        f("入住时间", "15:00 后"),
        f("退房时间", "次日 12:00 前"),
        f("民宿地址", "海滨步道 18 号"),
        f("联系邮箱", "stay@example.com"),
      ],
    ],
    [
      "travel",
      "旅行日程卡",
      "每日出游安排",
      [
        f("旅行主题", "海岸两日游"),
        f("旅行者", "示例旅人"),
        f("第一日行程", "海滩漫步 / 城市咖啡"),
        f("第二日行程", "日出观景 / 返程"),
        f("出发日期", "2026-12-06", "date"),
        f("旅行寄语", "把美好留在路上"),
      ],
    ],
    [
      "celebration",
      "生日聚会邀请",
      "聚会安排",
      [
        f("聚会主题", "一起庆祝美好日常"),
        f("邀请人", "示例主人"),
        f("聚会时间", "2026-12-06 18:00"),
        f("聚会地点", "海神生活空间"),
        f("着装建议", "轻松自然"),
        f("回复邮箱", "party@example.com"),
      ],
    ],
  ],
};
function sheet(
  profile: Profile,
  category: keyof typeof sheetScenarios,
  index: number,
) {
  const certificate =
    category === "education" &&
    [
      "completion",
      "honor",
      "participation",
      "volunteer",
      "competition",
    ].includes(profile.key);
  const horizontal =
    (category === "ticket" && index % 2 === 0) ||
    (category === "business" &&
      ["contact", "studio", "member", "coupon"].includes(profile.key));
  const w = certificate ? 1600 : horizontal ? 1440 : 1080,
    h = certificate ? 1120 : horizontal ? 1000 : 1440;
  const d = new Design(
      `bt_${category}_${profile.key}`,
      w,
      h,
      PALETTES[(index + 3) % PALETTES.length],
    ),
    p = d.palette;
  if (certificate) {
    d.rect("border_outer", 30, 30, w - 60, h - 60, p.accent, 8);
    d.rect("certificate_paper", 42, 42, w - 84, h - 84, "#fffdf7", 4);
    d.rect("top_rule", 90, 100, w - 180, 4, p.accent);
    d.text("kicker", "HAISHEN / LEARNING MOMENTS", 100, 140, w - 200, 52, 28, {
      textAlign: "center",
      fill: p.accent,
      letterSpacing: 4,
    });
    d.text("title", profile.title, 100, 220, w - 200, 130, 80, {
      fontFamily: "Noto Serif SC",
      fontWeight: "bold",
      textAlign: "center",
    });
    d.editable("recipient", profile.fields[0], 180, 400, w - 360, 120, 78, {
      textAlign: "center",
      fontFamily: "Noto Serif SC",
      fontWeight: "bold",
    });
    d.field("achievement", profile.fields[1], 180, 560, w - 360, 46);
    profile.fields
      .slice(2)
      .forEach((field, i) =>
        d.field(
          `item_${i}`,
          field,
          180 + (i % 2) * 650,
          730 + Math.floor(i / 2) * 136,
          600,
          i === 3 ? 26 : 30,
        ),
      );
  } else {
    const compact = horizontal,
      split = profile.layout % 3 === 1 && !horizontal,
      headerH = compact ? 210 : 320;
    d.rect("header", 0, 0, w, headerH, p.ink);
    d.text(
      "eyebrow",
      category === "ticket"
        ? "HAISHEN / EVENT PASS"
        : "HAISHEN / DESIGN COLLECTION",
      64,
      64,
      w - 128,
      48,
      25,
      { fill: "#ffffff", letterSpacing: 3 },
    );
    d.text(
      "title",
      profile.title,
      64,
      compact ? 126 : 150,
      w - 128,
      compact ? 70 : 110,
      compact ? 48 : 60,
      { fill: "#ffffff", fontWeight: "bold" },
    );
    if (!compact)
      d.text("subtitle", profile.subtitle, 64, 270, w - 128, 40, 26, {
        fill: "#ffffff",
      });
    const columns = horizontal ? 3 : split ? 1 : 2,
      fieldW = (w - 128) / columns,
      step = horizontal
        ? 210
        : split
          ? category === "ticket"
            ? 130
            : 144
          : 240,
      start = horizontal ? 300 : 410;
    profile.fields.forEach((field, i) => {
      const x = 64 + (i % columns) * fieldW,
        y = start + Math.floor(i / columns) * step;
      if (split) {
        d.text(`label_${i}`, field.name, x, y, 250, 82, 26, {
          fill: "#6e7a84",
        });
        d.editable(
          `item_${i}`,
          field,
          x + 270,
          y,
          w - 404,
          82,
          field.type === "number" ? 46 : 32,
        );
        d.rect(`rule_${i}`, 64, y + 112, w - 128, 1, p.soft);
      } else
        d.field(
          `item_${i}`,
          field,
          x,
          y,
          fieldW - 32,
          field.type === "number" ? 48 : 32,
        );
    });
    if (category === "ticket") {
      d.rect("ticket_stub", 64, h - 232, w - 128, 76, p.soft, 14);
      d.text(
        "stub_text",
        "SAMPLE / EVENT DESIGN",
        80,
        h - 222,
        w - 160,
        54,
        30,
        {
          fill: p.accent,
          textAlign: "center",
          letterSpacing: 3,
          locked: true,
          editable: false,
        },
      );
    }
  }
  const sample =
    ["receipt", "ticket"].includes(category) ||
    certificate ||
    (profile.key === "delivery" && category === "life");
  d.footer(
    category === "receipt"
      ? "示例消费清单 · 不作为付款、报销或税务凭证"
      : category === "ticket"
        ? "门票设计示例 · 不含真实核验码"
        : certificate
          ? "学习纪念设计 · 非学历或职业资格证明"
          : "海神原创设计 / HAISHEN DESIGN",
  );
  return d.finish(profile, category, index, sample);
}
export const EXTENDED_TEMPLATES: BuiltinTemplate[] = [
  ...transferScenarios.map(([key, title, subtitle, status], i) =>
    transfer(
      {
        key,
        title,
        subtitle,
        layout: i % 4,
        tags: ["转账", "收款", "付款", "交易", subtitle],
        fields: [
          f("交易状态", status),
          f("金额", (88 + i * 73.5).toFixed(2), "number"),
          f("付款方", "示例付款人"),
          f("收款方", "示例收款人"),
          f("交易时间", "2026-11-18 20:06"),
          f("交易订单号", `DEMO-${String(i + 1).padStart(10, "0")}`, "order"),
          f("交易说明", subtitle),
          f("服务机构", "海神演示机构"),
        ],
      },
      i,
    ),
  ),
  ...flightScenarios.map(([key, title, from, to], i) =>
    flight(
      {
        key,
        title,
        subtitle: `${from} → ${to}`,
        layout: i % 4,
        tags: ["机票", "航班", "登机牌", "行程单", from, to],
        fields: [
          f("出发地", from),
          f("目的地", to),
          f("乘机人", "示例旅客 / SAMPLE"),
          f("出发日期", "2026-12-06", "date"),
          f("航班号", `DEMO ${180 + i}`),
          f("登机时间", i === 8 ? "23:10" : "09:20"),
          f("座位", "18A"),
          f("舱位", i === 17 ? "商务舱" : "经济舱"),
          f("航站楼与登机口", "T2 / A18"),
          f("行程编号", `DEMO-${String(100 + i).padStart(10, "0")}`, "order"),
        ],
      },
      i,
    ),
  ),
  ...badgeScenarios.map(([key, title, organization, role], i) =>
    badge(
      {
        key,
        title,
        subtitle: `${organization} · ${role}`,
        layout: i % 3,
        tags: ["证件", "卡牌", "工牌", "头像", role],
        fields: [
          f("所属机构", organization),
          f("姓名", "林海 / SAMPLE"),
          f("身份职务", role),
          f("编号", `DEMO-${String(200 + i).padStart(10, "0")}`, "order"),
          f("有效期", "2026-12-01 至 2027-11-30"),
        ],
      },
      i,
    ),
  ),
  ...(
    Object.entries(sheetScenarios) as [
      keyof typeof sheetScenarios,
      typeof sheetScenarios.receipt,
    ][]
  ).flatMap(([category, profiles]) =>
    profiles.map(([key, title, subtitle, fields], i) =>
      sheet(
        {
          key,
          title,
          subtitle,
          fields,
          layout: i % 3,
          tags: [title, subtitle, ...fields.map((field) => field.name)],
        },
        category,
        i,
      ),
    ),
  ),
];
