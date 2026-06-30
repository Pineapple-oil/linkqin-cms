import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  signPayload,
  verifySignature,
  hashWebhookSecret,
  generateWebhookSecret,
} from "./webhook.service.js";

/**
 * Webhook 签名/密钥工具单测（开发文档 §10 / §18）。
 */
describe("webhook crypto utils", () => {
  it("generateWebhookSecret produces unique whsec_ prefixed tokens", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).not.toBe(b);
    expect(a.startsWith("whsec_")).toBe(true);
    expect(a.length).toBeGreaterThan(20);
  });

  it("hashWebhookSecret is deterministic (same input → same hash)", () => {
    const secret = "whsec_test123";
    expect(hashWebhookSecret(secret)).toBe(hashWebhookSecret(secret));
  });

  it("signPayload + verifySignature round-trip", () => {
    const body = JSON.stringify({ event: "entry.published", payload: { entryId: "e1" } });
    const secretHash = hashWebhookSecret("whsec_test");
    const signature = signPayload(body, secretHash);
    expect(verifySignature(body, signature, secretHash)).toBe(true);
  });

  it("verifySignature rejects tampered body", () => {
    const secretHash = hashWebhookSecret("whsec_test");
    const signature = signPayload('{"event":"x"}', secretHash);
    expect(verifySignature('{"event":"y"}', signature, secretHash)).toBe(false);
  });

  it("verifySignature rejects wrong secret", () => {
    const body = '{"event":"x"}';
    const sig1 = signPayload(body, hashWebhookSecret("whsec_a"));
    expect(verifySignature(body, sig1, hashWebhookSecret("whsec_b"))).toBe(false);
  });
});
