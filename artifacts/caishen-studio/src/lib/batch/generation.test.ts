import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/canvas/render.ts", () => ({
  renderDoc: vi.fn(async () => ({ canvas: document.createElement("canvas"), warnings: [] })),
  canvasToBlob: vi.fn(async () => new Blob(["png-data"], { type: "image/png" })),
}));

import { createBatchArchive } from "./generation.ts";
import { generateItems } from "./rules.ts";
import { makeTemplate, titleParam } from "./test-fixtures.ts";

describe("createBatchArchive", () => {
  it("renders valid items into a numbered ZIP", async () => {
    const items = generateItems(makeTemplate(), { [titleParam.id]: { mode: "sequence", prefix: "A", start: 1, pad: 3, suffix: "" } }, 2, 1);
    const result = await createBatchArchive({ name: "测试模板", items });

    expect(result.succeeded).toBe(2);
    const files = unzipSync(new Uint8Array(await result.archive!.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(["测试模板-001.png", "测试模板-002.png"]);
    expect(new TextDecoder().decode(files["测试模板-001.png"])).toBe("png-data");
  });

  it("returns failures without exposing an empty ZIP", async () => {
    const items = generateItems(makeTemplate(), { [titleParam.id]: { mode: "fixed", value: "" } }, 1, 1);
    const result = await createBatchArchive({ name: "t", items });

    expect(result.archive).toBeNull();
    expect(result.failed).toBe(1);
    expect(result.outcomes[0]?.message).toContain("不能为空");
  });
});
