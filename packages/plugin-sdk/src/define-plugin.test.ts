import { describe, expect, it } from "vitest";
import { definePlugin } from "./define-plugin.js";
import { z } from "zod";

describe("definePlugin", () => {
  it("returns the plugin definition as-is", () => {
    const plugin = definePlugin({
      name: "example-plugin",
      version: "0.1.0",
      displayName: "Example Plugin",
      configSchema: z.object({ enabled: z.boolean() }),
    });
    expect(plugin.name).toBe("example-plugin");
    expect(plugin.version).toBe("0.1.0");
  });

  it("preserves backend and admin hooks", () => {
    let backendCalled = false;
    const plugin = definePlugin({
      name: "p",
      version: "0.0.1",
      displayName: "P",
      backend: () => {
        backendCalled = true;
      },
    });
    plugin.backend?.({} as never);
    expect(backendCalled).toBe(true);
  });
});
