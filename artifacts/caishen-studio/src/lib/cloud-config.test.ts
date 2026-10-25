import { describe, expect, it } from "vitest";
import { cloudConfiguration } from "./cloud-config";
describe("cloud configuration", () => {
  it("disables incomplete and insecure configurations", () => {
    expect(cloudConfiguration({}).enabled).toBe(false);
    expect(cloudConfiguration({ VITE_CONVEX_URL: "https://test.convex.cloud" }).enabled).toBe(false);
    expect(cloudConfiguration({ VITE_CONVEX_URL: "http://localhost:3000", VITE_HERCULES_OIDC_AUTHORITY: "invalid", VITE_HERCULES_OIDC_CLIENT_ID: "id" }).enabled).toBe(false);
  });
  it("enables a complete HTTPS configuration", () => {
    expect(cloudConfiguration({ VITE_CONVEX_URL: "https://test.convex.cloud", VITE_HERCULES_OIDC_AUTHORITY: "https://auth.example", VITE_HERCULES_OIDC_CLIENT_ID: "id" }).enabled).toBe(true);
  });
});
