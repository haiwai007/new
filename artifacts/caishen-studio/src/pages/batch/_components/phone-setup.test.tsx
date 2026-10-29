import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PhoneSetup from "./phone-setup";
import { drawingRules, type PhoneBatchRules } from "@/lib/batch/phone-rules";
import { naturalPhoneSettings } from "@/lib/phone/layers";
import { BUILTIN_TEMPLATES } from "@/lib/template/builtin";
const doc = structuredClone(BUILTIN_TEMPLATES[0].doc);
function Harness() {
  const [rules, setRules] = useState<PhoneBatchRules>(() => {
    const next = drawingRules(naturalPhoneSettings());
    next.setup!.mode = "keep";
    next.time.enabled = next.battery.enabled = false;
    next.apps!.mode = "fixed";
    return next;
  });
  return (
    <PhoneSetup
      doc={doc}
      value={rules}
      onChange={setRules}
      disabled={false}
      onBusyChange={vi.fn()}
    />
  );
}
describe("simplified batch step 04", () => {
  it("defaults to preserving the original, hides all four rows and has no batch preset controls", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    expect(
      screen.getByRole("button", { name: "状态栏保留原图" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("group", { name: "时间模式" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "状态栏修改状态栏" }));
    for (const label of [
      "手机型号模式",
      "时间模式",
      "电量模式",
      "APP 图标模式",
    ])
      expect(screen.getByRole("group", { name: label })).toBeVisible();
    expect(screen.queryByLabelText("作图预设名称")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "随机状态栏" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("批量状态栏设置摘要")).toHaveTextContent(
      "固定时间",
    );
  });
  it("keeps the fixed clock and interval independently through mode and preserve/modify switches", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "状态栏修改状态栏" }));
    const clock = screen.getByLabelText("固定状态栏时间");
    await user.clear(clock);
    await user.type(clock, "20:06");
    await user.click(screen.getByRole("button", { name: "时间区间随机" }));
    const start = screen.getByLabelText("随机开始时间"),
      end = screen.getByLabelText("随机结束时间");
    await user.clear(start);
    await user.type(start, "22:00");
    await user.clear(end);
    await user.type(end, "02:00");
    expect(screen.getByText("跨午夜：结束时间为次日。")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "时间固定" }));
    expect(screen.getByLabelText("固定状态栏时间")).toHaveValue("20:06");
    await user.click(screen.getByRole("button", { name: "状态栏保留原图" }));
    await user.click(screen.getByRole("button", { name: "状态栏修改状态栏" }));
    await user.click(screen.getByRole("button", { name: "时间区间随机" }));
    expect(screen.getByLabelText("随机开始时间")).toHaveValue("22:00");
    expect(screen.getByLabelText("随机结束时间")).toHaveValue("02:00");
  });
  it("shows network and all optional random statuses only inside more settings", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "状态栏修改状态栏" }));
    expect(
      screen.queryByRole("switch", { name: "随机低电量模式" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByText("更多设置", { exact: true }));
    for (const name of [
      "随机蜂窝信号（0–4 格）",
      "随机 Wi-Fi（关闭或按系统选择信号强度）",
      "随机网络类型",
      "随机充电",
      "随机飞行模式",
      "随机蓝牙",
      "随机定位",
      "随机闹钟",
      "随机静音",
      "随机勿扰",
      "随机VPN",
      "随机HD 高清通话",
      "随机双卡信号",
      "随机低电量模式",
    ])
      expect(screen.getByRole("switch", { name })).toBeVisible();
    await user.click(screen.getByRole("switch", { name: "随机低电量模式" }));
    expect(screen.getByText(/低电量模式开启的图片/)).toBeVisible();
    expect(doc).toEqual(BUILTIN_TEMPLATES[0].doc);
  });
});
it("keeps random candidates selected across domestic, international, search and custom filters", async () => {
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "状态栏修改状态栏" }));
  await user.click(screen.getByRole("button", { name: "APP 图标随机" }));
  await user.click(screen.getByRole("button", { name: "国内APP图标" }));
  await user.click(screen.getByLabelText("候选 APP 豆包"));
  await user.click(screen.getByRole("button", { name: "国外APP图标" }));
  expect(screen.queryByLabelText("候选 APP 豆包")).not.toBeInTheDocument();
  await user.click(screen.getByLabelText("候选 APP WhatsApp"));
  await user.click(screen.getByRole("button", { name: "国内APP图标" }));
  expect(screen.getByLabelText("候选 APP 豆包")).toBeChecked();
  await user.type(screen.getByLabelText("搜索随机 APP 图标"), "不存在的图标");
  expect(
    screen.getByText("没有找到匹配图标，请尝试其他分类或关键词。"),
  ).toBeVisible();
  await user.clear(screen.getByLabelText("搜索随机 APP 图标"));
  await user.click(screen.getByRole("button", { name: "全部APP图标" }));
  await user.click(screen.getByLabelText("只看已选"));
  expect(screen.getByLabelText("候选 APP 豆包")).toBeChecked();
  expect(screen.getByLabelText("候选 APP WhatsApp")).toBeChecked();
  await user.click(screen.getByRole("button", { name: "自定义APP图标" }));
  expect(
    screen.getByText("没有找到匹配图标，请尝试其他分类或关键词。"),
  ).toBeVisible();
});
