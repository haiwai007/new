// @vitest-environment node
import { expect, it } from "vitest";
import { uploadAppIcon, MAX_APP_ICON_BYTES } from "./app-icon-upload";
it("rejects an oversized APP icon before allocating a decoded image", async () => {
  const file = new File([new Uint8Array(MAX_APP_ICON_BYTES + 1)], "large.png", {
    type: "image/png",
  });
  await expect(uploadAppIcon(file)).rejects.toThrow("不能超过 2MB");
});
