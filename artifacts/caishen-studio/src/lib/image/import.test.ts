import { describe, expect, it } from "vitest";
import { validateImageFile } from "./import.ts";

describe("validateImageFile", () => {
  it("accepts png/jpeg/webp within size limit", () => {
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeNull();
  });
  it("rejects other formats, empty and oversized files", () => {
    expect(validateImageFile({ type: "image/gif", size: 1000 })).toMatch(/仅支持/);
    expect(validateImageFile({ type: "image/png", size: 0 })).toMatch(/为空/);
    expect(validateImageFile({ type: "image/png", size: 30 * 1024 * 1024 })).toMatch(/不能超过/);
  });
});
